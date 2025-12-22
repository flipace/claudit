mod services;
mod tray;
mod types;

use services::{
    AnalyticsService, HookInstaller, HookServer, SettingsService,
    // Config service types
    ClaudeMdFile, AgentInfo, CommandInfo, PluginInfo, McpServer, ProjectInfo, ProjectDetails,
    PatternAnalysis, AiSuggestion, ProjectSuggestion, ExportOptions, BackupInfo, GitStatus,
};
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tokio::sync::Mutex;
use tray::create_tray;
use types::{AnalyticsStats, AppSettings, ChartData};

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
    state: tauri::State<'_, AppState>,
    settings: AppSettings,
) -> Result<(), String> {
    state.settings.update(settings)
}

#[tauri::command]
async fn toggle_section(
    state: tauri::State<'_, AppState>,
    section: String,
    visible: bool,
) -> Result<(), String> {
    state.settings.toggle_section(&section, visible)
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

// ============ Main Entry ============

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
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
            // Config commands
            list_claude_md_files,
            get_claude_md_content,
            list_agents,
            list_commands,
            get_agent_or_command_content,
            get_installed_plugins,
            get_mcp_servers,
            get_mcp_config_path,
            get_mcp_config,
            add_mcp_server,
            remove_mcp_server,
            list_projects,
            get_project_details,
            get_project_commands,
            get_project_mcp_servers,
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
        ])
        .setup(|app| {
            let handle = app.handle().clone();

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
