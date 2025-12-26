mod services;
mod tray;
mod types;

use services::{
    AnalyticsService, HookInstaller, HookServer, ModelPricing, SettingsService,
    // Config service types
    ClaudeMdFile, AgentInfo, CommandInfo, PluginInfo, McpServer, ProjectInfo, ProjectDetails,
    PatternAnalysis, AiSuggestion, ProjectSuggestion, ExportOptions, BackupInfo, GitStatus,
};
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tray::{create_tray, refresh_menu_cache, update_cached_settings, update_tray_menu};
use types::{AnalyticsStats, AppSettings, ChartData, ClaudeStatus, SessionInfo, SessionConversation, SessionSearchResult};

/// Application state
pub struct AppState {
    pub analytics: AnalyticsService,
    pub settings: SettingsService,
    pub hook_server: Arc<Mutex<HookServer>>,
}

// ============ Tauri Commands ============

#[tauri::command]
async fn get_stats(state: tauri::State<'_, AppState>) -> Result<AnalyticsStats, String> {
    Ok(state.analytics.get_stats())
}

#[tauri::command]
async fn refresh_stats(state: tauri::State<'_, AppState>) -> Result<AnalyticsStats, String> {
    Ok(state.analytics.refresh_stats())
}

#[tauri::command]
async fn get_chart_data(
    state: tauri::State<'_, AppState>,
    days: u32,
) -> Result<ChartData, String> {
    Ok(state.analytics.get_chart_data(days))
}

#[tauri::command]
async fn get_settings(state: tauri::State<'_, AppState>) -> Result<AppSettings, String> {
    Ok(state.settings.get())
}

#[tauri::command]
async fn update_settings(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    // Update cached settings for tray menu
    update_cached_settings(&settings);
    // Persist to disk
    state.settings.update(settings)?;
    // Refresh tray menu to reflect changes
    let _ = update_tray_menu(&app);
    Ok(())
}

#[tauri::command]
async fn toggle_section(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    section: String,
    visible: bool,
) -> Result<(), String> {
    state.settings.toggle_section(&section, visible)?;
    // Update cache and tray menu
    update_cached_settings(&state.settings.get());
    let _ = update_tray_menu(&app);
    Ok(())
}

#[tauri::command]
async fn check_hooks_installed() -> Result<bool, String> {
    Ok(HookInstaller::is_installed())
}

#[tauri::command]
async fn install_hooks(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let port = state.hook_server.lock().await.port();
    HookInstaller::install(port)
}

#[tauri::command]
async fn uninstall_hooks() -> Result<(), String> {
    HookInstaller::uninstall()
}

#[tauri::command]
async fn get_hook_port(state: tauri::State<'_, AppState>) -> Result<u16, String> {
    Ok(state.hook_server.lock().await.port())
}

#[tauri::command]
async fn open_analytics_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("analytics") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn refresh_tray_menu(app: tauri::AppHandle) -> Result<(), String> {
    tray::update_tray_menu(&app).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_claude_status() -> Result<ClaudeStatus, String> {
    Ok(services::get_claude_status())
}

// ============ Config Commands ============

#[tauri::command]
async fn list_claude_md_files() -> Result<Vec<ClaudeMdFile>, String> {
    services::config::list_claude_md_files()
}

#[tauri::command]
async fn get_claude_md_content(path: String) -> Result<String, String> {
    services::config::get_claude_md_content(&path)
}

#[tauri::command]
async fn list_agents() -> Result<Vec<AgentInfo>, String> {
    services::config::list_agents()
}

#[tauri::command]
async fn list_commands() -> Result<Vec<CommandInfo>, String> {
    services::config::list_commands()
}

#[tauri::command]
async fn get_agent_or_command_content(path: String) -> Result<String, String> {
    services::config::get_agent_or_command_content(&path)
}

#[tauri::command]
async fn list_directory_files(path: String) -> Result<Vec<services::config::DirectoryFile>, String> {
    services::config::list_directory_files(&path)
}

#[tauri::command]
async fn get_installed_plugins() -> Result<Vec<PluginInfo>, String> {
    services::config::get_installed_plugins()
}

#[tauri::command]
async fn get_mcp_servers() -> Result<Vec<McpServer>, String> {
    services::config::get_mcp_servers()
}

#[tauri::command]
async fn get_mcp_config_path() -> Result<String, String> {
    services::config::get_mcp_config_path()
}

#[tauri::command]
async fn get_mcp_config() -> Result<String, String> {
    services::config::get_mcp_config()
}

#[tauri::command]
async fn add_mcp_server(name: String, config_json: String) -> Result<(), String> {
    services::config::add_mcp_server(&name, &config_json)
}

#[tauri::command]
async fn remove_mcp_server(name: String) -> Result<(), String> {
    services::config::remove_mcp_server(&name)
}

#[tauri::command]
async fn update_mcp_server(name: String, config_json: String) -> Result<(), String> {
    services::config::update_mcp_server(&name, &config_json)
}

#[tauri::command]
async fn list_projects() -> Result<Vec<ProjectInfo>, String> {
    services::config::list_projects()
}

#[tauri::command]
async fn get_project_details(project_path: String) -> Result<ProjectDetails, String> {
    services::config::get_project_details(&project_path)
}

#[tauri::command]
async fn get_project_commands(project_path: String) -> Result<Vec<CommandInfo>, String> {
    services::config::get_project_commands(&project_path)
}

#[tauri::command]
async fn get_project_mcp_servers(project_path: String) -> Result<Vec<McpServer>, String> {
    services::config::get_project_mcp_servers(&project_path)
}

#[tauri::command]
async fn update_project_mcp_server(project_path: String, name: String, config_json: String) -> Result<(), String> {
    services::config::update_project_mcp_server(&project_path, &name, &config_json)
}

#[tauri::command]
async fn remove_project_mcp_server(project_path: String, name: String) -> Result<(), String> {
    services::config::remove_project_mcp_server(&project_path, &name)
}

#[tauri::command]
async fn set_project_image(project_path: String, image_source_path: String) -> Result<String, String> {
    services::config::set_project_image(&project_path, &image_source_path)
}

#[tauri::command]
async fn remove_project_image(project_path: String) -> Result<(), String> {
    services::config::remove_project_image(&project_path)
}

#[tauri::command]
async fn analyze_chat_patterns(days: u32) -> Result<PatternAnalysis, String> {
    services::config::analyze_chat_patterns(days)
}

#[tauri::command]
async fn get_ai_suggestions(days: u32) -> Result<Vec<AiSuggestion>, String> {
    services::config::get_ai_suggestions(days)
}

#[tauri::command]
async fn get_project_suggestions(project_path: String) -> Result<ProjectSuggestion, String> {
    services::config::get_project_suggestions(&project_path).await
}

#[tauri::command]
async fn run_claude_with_prompt(project_path: String, prompt: String) -> Result<String, String> {
    services::config::run_claude_with_prompt(&project_path, &prompt)
}

#[tauri::command]
async fn export_config(options: ExportOptions, output_path: String) -> Result<BackupInfo, String> {
    services::config::export_config(options, &output_path)
}

#[tauri::command]
async fn import_config(zip_path: String) -> Result<(), String> {
    services::config::import_config(&zip_path)
}

#[tauri::command]
async fn get_config_git_status() -> Result<GitStatus, String> {
    services::config::get_config_git_status()
}

#[tauri::command]
async fn open_in_editor(path: String) -> Result<(), String> {
    services::config::open_in_editor(&path)
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    services::config::open_folder(&path)
}

#[tauri::command]
async fn get_model_pricing() -> Result<Vec<ModelPricing>, String> {
    Ok(services::pricing::get_all_pricing())
}

// ============ Session Commands ============

#[tauri::command]
async fn list_project_sessions(project_path: String) -> Result<Vec<SessionInfo>, String> {
    services::list_sessions(&project_path)
}

#[tauri::command]
async fn get_session_conversation(project_path: String, session_id: String) -> Result<SessionConversation, String> {
    services::get_session_conversation(&project_path, &session_id)
}

#[tauri::command]
async fn export_session_to_html(project_path: String, session_id: String) -> Result<String, String> {
    services::export_session_html(&project_path, &session_id)
}

#[tauri::command]
async fn search_project_sessions(project_path: String, query: String) -> Result<Vec<SessionSearchResult>, String> {
    services::search_sessions(&project_path, &query)
}

/// Detect available terminal apps on macOS
#[cfg(target_os = "macos")]
fn detect_terminal_app() -> String {
    // Check for common terminal apps in order of preference
    let terminals = ["iTerm", "Warp", "Alacritty", "kitty", "Terminal"];

    for terminal in terminals {
        let check = std::process::Command::new("osascript")
            .arg("-e")
            .arg(format!(r#"tell application "System Events" to (name of processes) contains "{}""#, terminal))
            .output();

        if let Ok(output) = check {
            let result = String::from_utf8_lossy(&output.stdout);
            if result.trim() == "true" {
                return terminal.to_string();
            }
        }
    }

    // Check if apps exist in /Applications
    for terminal in terminals {
        let app_path = format!("/Applications/{}.app", terminal);
        if std::path::Path::new(&app_path).exists() {
            return terminal.to_string();
        }
    }

    // Default to Terminal
    "Terminal".to_string()
}

#[tauri::command]
async fn open_terminal_with_resume(
    state: tauri::State<'_, AppState>,
    project_path: String,
    session_id: String,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let settings = state.settings.get();
        let terminal = if settings.terminal_app == "auto" {
            detect_terminal_app()
        } else {
            settings.terminal_app.clone()
        };

        // Escape single quotes in the path
        let escaped_path = project_path.replace("'", "'\\''");
        let command = format!("cd '{}' && claude --resume {}", escaped_path, session_id);

        let script = match terminal.as_str() {
            "iTerm" => format!(
                r#"tell application "iTerm"
                    activate
                    try
                        tell current window
                            create tab with default profile
                            tell current session
                                write text "{}"
                            end tell
                        end tell
                    on error
                        create window with default profile
                        tell current window
                            tell current session
                                write text "{}"
                            end tell
                        end tell
                    end try
                end tell"#,
                command, command
            ),
            "Warp" => format!(
                r#"tell application "Warp"
                    activate
                    do script "{}"
                end tell"#,
                command
            ),
            "Alacritty" | "kitty" => {
                // For these terminals, use open command with shell
                return std::process::Command::new("open")
                    .arg("-a")
                    .arg(&terminal)
                    .spawn()
                    .map_err(|e| format!("Failed to open {}: {}", terminal, e))
                    .and_then(|_| {
                        // Give the terminal time to open, then use pbcopy + paste approach
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        // Copy command to clipboard
                        let mut child = std::process::Command::new("pbcopy")
                            .stdin(std::process::Stdio::piped())
                            .spawn()
                            .map_err(|e| format!("Failed to copy command: {}", e))?;
                        if let Some(stdin) = child.stdin.as_mut() {
                            use std::io::Write;
                            stdin.write_all(command.as_bytes()).ok();
                        }
                        child.wait().ok();
                        Ok(())
                    });
            }
            _ => format!(
                r#"tell application "Terminal"
                    activate
                    do script "{}"
                end tell"#,
                command
            ),
        };

        std::process::Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .spawn()
            .map_err(|e| format!("Failed to open {}: {}", terminal, e))?;
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Terminal launch only supported on macOS".to_string())
    }
}

// ============ Main Entry ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(AppState {
            analytics: AnalyticsService::new(),
            settings: SettingsService::new(),
            hook_server: Arc::new(Mutex::new(HookServer::new(3456))),
        })
        .invoke_handler(tauri::generate_handler![
            get_stats,
            refresh_stats,
            get_chart_data,
            get_settings,
            update_settings,
            toggle_section,
            check_hooks_installed,
            install_hooks,
            uninstall_hooks,
            get_hook_port,
            open_analytics_window,
            refresh_tray_menu,
            get_claude_status,
            // Config commands
            list_claude_md_files,
            get_claude_md_content,
            list_agents,
            list_commands,
            get_agent_or_command_content,
            list_directory_files,
            get_installed_plugins,
            get_mcp_servers,
            get_mcp_config_path,
            get_mcp_config,
            add_mcp_server,
            remove_mcp_server,
            update_mcp_server,
            list_projects,
            get_project_details,
            get_project_commands,
            get_project_mcp_servers,
            update_project_mcp_server,
            remove_project_mcp_server,
            set_project_image,
            remove_project_image,
            analyze_chat_patterns,
            get_ai_suggestions,
            get_project_suggestions,
            run_claude_with_prompt,
            export_config,
            import_config,
            get_config_git_status,
            open_in_editor,
            open_folder,
            get_model_pricing,
            // Session commands
            list_project_sessions,
            get_session_conversation,
            export_session_to_html,
            search_project_sessions,
            open_terminal_with_resume,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            // Initialize menu cache before creating tray (does disk I/O once at startup)
            refresh_menu_cache();

            // Create system tray
            create_tray(&handle)?;

            // Start hook server
            let state = app.state::<AppState>();
            let hook_server = state.hook_server.clone();
            let _settings = state.settings.get();

            tauri::async_runtime::spawn(async move {
                let mut server = hook_server.lock().await;
                match server.start(handle.clone()).await {
                    Ok(port) => {
                        println!("Hook server started on port {}", port);
                    }
                    Err(e) => {
                        eprintln!("Failed to start hook server: {}", e);
                    }
                }
            });

            // Set up auto-refresh timer for tray menu
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(30));
                    // Update tray menu with fresh data
                    let _ = tray::update_tray_menu(&app_handle);
                    let _ = app_handle.emit("refresh-stats", ());
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    // Keep app running when window is closed (minimize to tray)
                    let _ = window.hide();
                    // Hide from dock on macOS
                    #[cfg(target_os = "macos")]
                    {
                        use tauri::ActivationPolicy;
                        let app = window.app_handle();
                        let _ = app.set_activation_policy(ActivationPolicy::Accessory);
                    }
                    api.prevent_close();
                }
                tauri::WindowEvent::Focused(true) => {
                    // Show in dock when window is focused
                    #[cfg(target_os = "macos")]
                    {
                        use tauri::ActivationPolicy;
                        let app = window.app_handle();
                        let _ = app.set_activation_policy(ActivationPolicy::Regular);
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
