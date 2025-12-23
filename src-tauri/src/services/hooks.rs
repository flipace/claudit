use crate::services::{SettingsService, UsageReader};
use crate::types::HookEvent;
use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};

/// Message sent when a hook event is received
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct HookMessage {
    pub event_type: String,
    pub tool: Option<String>,
}

/// Shared state for the hook server
pub struct HookServerState<R: Runtime> {
    pub app_handle: AppHandle<R>,
    pub tx: broadcast::Sender<HookMessage>,
}

/// Hook server that receives events from Claude Code
pub struct HookServer {
    port: u16,
    shutdown_tx: Option<tokio::sync::oneshot::Sender<()>>,
}

impl HookServer {
    pub fn new(port: u16) -> Self {
        Self {
            port,
            shutdown_tx: None,
        }
    }

    /// Start the hook server
    pub async fn start<R: Runtime + 'static>(
        &mut self,
        app_handle: AppHandle<R>,
    ) -> Result<u16, String> {
        let (tx, _rx) = broadcast::channel::<HookMessage>(100);
        let state = Arc::new(HookServerState {
            app_handle: app_handle.clone(),
            tx,
        });

        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);

        let app = Router::new()
            .route("/", get(health_check))
            .route("/hook", post(handle_hook::<R>))
            .layer(cors)
            .with_state(state);

        // Try to bind to the specified port, incrementing if busy
        let mut port = self.port;
        let listener = loop {
            let addr = SocketAddr::from(([127, 0, 0, 1], port));
            match tokio::net::TcpListener::bind(addr).await {
                Ok(listener) => break listener,
                Err(_) => {
                    port += 1;
                    if port > self.port + 10 {
                        return Err("Could not find available port".to_string());
                    }
                }
            }
        };

        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
        self.shutdown_tx = Some(shutdown_tx);
        self.port = port;

        // Spawn the server with proper error handling (no unwrap)
        tokio::spawn(async move {
            if let Err(e) = axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    let _ = shutdown_rx.await;
                })
                .await
            {
                eprintln!("Hook server error: {}", e);
            }
        });

        Ok(port)
    }

    /// Stop the hook server
    pub fn stop(&mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
    }

    /// Get the current port
    pub fn port(&self) -> u16 {
        self.port
    }
}

/// Health check endpoint
async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, Json(serde_json::json!({ "status": "ok" })))
}

/// Handle incoming hook events
async fn handle_hook<R: Runtime>(
    State(state): State<Arc<HookServerState<R>>>,
    Json(event): Json<HookEvent>,
) -> impl IntoResponse {
    // Send event to broadcast channel for internal subscribers
    let _ = state.tx.send(HookMessage {
        event_type: event.event.clone(),
        tool: event.tool.clone(),
    });

    // Emit event to frontend
    let _ = state.app_handle.emit("hook-event", &event);

    // Debug: Log all hook events
    println!("Hook received: event={}, tool={:?}", event.event, event.tool);

    // Handle specific events
    match event.event.as_str() {
        "Stop" | "SubagentStop" => {
            println!("Claude finished - checking notification settings");
            // Claude finished responding - trigger notification
            let _ = state.app_handle.emit("claude-finished", &event);

            // Check if notifications are enabled before sending
            let settings = SettingsService::new().get();
            println!("Notifications enabled: {}", settings.notifications_enabled);

            if settings.notifications_enabled {
                println!("Attempting to send notification...");

                // Get the latest response excerpt for the notification body
                let reader = UsageReader::new();
                let body = reader
                    .get_latest_response(120)
                    .unwrap_or_else(|| "Claude has finished responding".to_string());

                // Send system notification with response excerpt
                match state
                    .app_handle
                    .notification()
                    .builder()
                    .title("Claude Code")
                    .body(&body)
                    .show()
                {
                    Ok(_) => println!("Notification sent successfully"),
                    Err(e) => eprintln!("Failed to send notification: {}", e),
                }
            }
        }
        "PostToolUse" => {
            // Tool was used - can be used for granular tracking
            // Intentionally quiet to avoid notification spam
        }
        "PreToolUse" | "UserPromptSubmit" => {
            // Received but not actively handled
        }
        _ => {}
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({ "success": true })),
    )
}

/// Hook installer for Claude Code settings
pub struct HookInstaller;

impl HookInstaller {
    /// Get the Claude Code settings path
    fn settings_path() -> std::path::PathBuf {
        dirs::home_dir()
            .unwrap_or_default()
            .join(".claude")
            .join("settings.json")
    }

    /// Check if hooks are already installed
    pub fn is_installed() -> bool {
        let path = Self::settings_path();
        if !path.exists() {
            return false;
        }

        match std::fs::read_to_string(&path) {
            Ok(contents) => {
                if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&contents) {
                    settings.get("hooks").is_some()
                } else {
                    false
                }
            }
            Err(_) => false,
        }
    }

    /// Install hooks into Claude Code settings
    pub fn install(port: u16) -> Result<(), String> {
        let path = Self::settings_path();

        // Create backup
        if path.exists() {
            let backup_path = path.with_extension("json.backup");
            std::fs::copy(&path, &backup_path)
                .map_err(|e| format!("Failed to create backup: {}", e))?;
        }

        // Load existing settings or create new
        let mut settings: serde_json::Value = if path.exists() {
            let contents =
                std::fs::read_to_string(&path).map_err(|e| format!("Failed to read: {}", e))?;
            serde_json::from_str(&contents).unwrap_or(serde_json::json!({}))
        } else {
            // Ensure parent directory exists
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory: {}", e))?;
            }
            serde_json::json!({})
        };

        // Create hooks configuration
        // Event type is determined by which hook fires, tool name from $CLAUDE_TOOL_NAME
        let stop_command = format!(
            r#"curl -s -X POST http://localhost:{}/hook -H "Content-Type: application/json" -d '{{"event": "Stop"}}' > /dev/null 2>&1 &"#,
            port
        );
        let subagent_stop_command = format!(
            r#"curl -s -X POST http://localhost:{}/hook -H "Content-Type: application/json" -d '{{"event": "SubagentStop"}}' > /dev/null 2>&1 &"#,
            port
        );
        let post_tool_command = format!(
            r#"curl -s -X POST http://localhost:{}/hook -H "Content-Type: application/json" -d "{{"event": "PostToolUse", "tool": "$CLAUDE_TOOL_NAME"}}" > /dev/null 2>&1 &"#,
            port
        );

        let hooks = serde_json::json!({
            "Stop": [{
                "matcher": "*",
                "hooks": [{
                    "type": "command",
                    "command": stop_command
                }]
            }],
            "SubagentStop": [{
                "matcher": "*",
                "hooks": [{
                    "type": "command",
                    "command": subagent_stop_command
                }]
            }],
            "PostToolUse": [{
                "matcher": "Bash",
                "hooks": [{
                    "type": "command",
                    "command": post_tool_command
                }]
            }]
        });

        settings["hooks"] = hooks;

        // Write back to file
        let contents = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("Failed to serialize: {}", e))?;

        std::fs::write(&path, contents).map_err(|e| format!("Failed to write: {}", e))?;

        Ok(())
    }

    /// Uninstall hooks from Claude Code settings
    pub fn uninstall() -> Result<(), String> {
        let path = Self::settings_path();

        if !path.exists() {
            return Ok(());
        }

        let contents =
            std::fs::read_to_string(&path).map_err(|e| format!("Failed to read: {}", e))?;

        let mut settings: serde_json::Value =
            serde_json::from_str(&contents).map_err(|e| format!("Failed to parse: {}", e))?;

        // Remove hooks
        if let Some(obj) = settings.as_object_mut() {
            obj.remove("hooks");
        }

        let contents = serde_json::to_string_pretty(&settings)
            .map_err(|e| format!("Failed to serialize: {}", e))?;

        std::fs::write(&path, contents).map_err(|e| format!("Failed to write: {}", e))?;

        Ok(())
    }
}
