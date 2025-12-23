use crate::services::{config, get_claude_status, SettingsService};
use crate::types::AppSettings;
use crate::AppState;
use std::process::Command;
use std::sync::Mutex;
use tauri::{
    include_image,
    menu::{CheckMenuItem, Menu, MenuBuilder, MenuItem, SubmenuBuilder},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Emitter, Manager, Runtime,
};

/// Cached data for building the tray menu - avoids disk I/O on every interaction
#[derive(Default)]
struct MenuCache {
    /// Project names and paths for the submenu
    projects: Vec<(String, String)>, // (name, path)
    /// Settings cache
    settings: Option<AppSettings>,
}

static MENU_CACHE: Mutex<MenuCache> = Mutex::new(MenuCache {
    projects: Vec::new(),
    settings: None,
});

/// Refresh the menu cache from disk (call in background thread)
pub fn refresh_menu_cache() {
    let mut cache = MENU_CACHE.lock().unwrap();

    // Refresh projects
    cache.projects.clear();
    if let Ok(projects) = config::list_projects() {
        for project in projects.iter().take(5) {
            cache.projects.push((project.name.clone(), project.path.clone()));
        }
    }

    // Refresh settings
    let settings_service = SettingsService::new();
    cache.settings = Some(settings_service.get());
}

/// Update just the settings in the cache (call after settings change from UI)
pub fn update_cached_settings(settings: &AppSettings) {
    let mut cache = MENU_CACHE.lock().unwrap();
    cache.settings = Some(settings.clone());
}

pub fn create_tray<R: Runtime>(app: &AppHandle<R>) -> Result<TrayIcon<R>, tauri::Error> {
    let menu = build_tray_menu(app)?;

    TrayIconBuilder::with_id("main-tray")
        .icon(include_image!("icons/tray-icon.png"))
        .icon_as_template(true)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id().as_ref());
        })
        .build(app)
}

/// Format large numbers with K/M suffixes
fn format_number(n: u64) -> String {
    if n >= 1_000_000 {
        format!("{:.1}M", n as f64 / 1_000_000.0)
    } else if n >= 1_000 {
        format!("{:.1}K", n as f64 / 1_000.0)
    } else {
        n.to_string()
    }
}

/// Format cost as dollars
fn format_cost(cost: f64) -> String {
    if cost >= 1.0 {
        format!("${:.2}", cost)
    } else if cost >= 0.01 {
        format!("${:.3}", cost)
    } else {
        format!("${:.4}", cost)
    }
}

/// Format burn rate as $/hour
fn format_burn_rate(rate: f64) -> String {
    if rate >= 1.0 {
        format!("${:.2}/hr", rate)
    } else if rate >= 0.01 {
        format!("${:.3}/hr", rate)
    } else if rate > 0.0 {
        format!("${:.4}/hr", rate)
    } else {
        "$0/hr".to_string()
    }
}

/// Get the primary model (most used by output tokens)
fn get_primary_model(stats: &crate::types::AnalyticsStats) -> Option<String> {
    stats
        .by_model
        .iter()
        .max_by_key(|(_, model_stats)| model_stats.output_tokens)
        .map(|(name, _)| {
            // Clean up model name for display
            name.replace("claude-", "")
                .split('-')
                .take(2)
                .collect::<Vec<_>>()
                .join("-")
        })
}

fn build_tray_menu<R: Runtime>(app: &AppHandle<R>) -> Result<Menu<R>, tauri::Error> {
    // Get cached stats from AppState (fast - no disk I/O)
    let stats = app
        .try_state::<AppState>()
        .map(|state| state.analytics.get_stats())
        .unwrap_or_default();

    // Detect whether Claude Code data/config exists (used to show a friendly hint instead of silent zeros)
    let claude_status = get_claude_status();

    // Get settings from cache (fast - no disk I/O)
    // If cache is empty, use defaults - cache will be populated on first refresh
    let cache = MENU_CACHE.lock().unwrap();
    let settings = cache.settings.clone().unwrap_or_default();
    let cached_projects = cache.projects.clone();
    drop(cache); // Release lock early

    let mut builder = MenuBuilder::new(app);

    // Header with primary model
    let header_text = if let Some(model) = get_primary_model(&stats) {
        format!("Claudit  ·  {}", model)
    } else {
        "Claudit".to_string()
    };
    builder = builder.item(&MenuItem::with_id(
        app,
        "header",
        header_text,
        false,
        None::<&str>,
    )?);

    builder = builder.separator();

    // Claude Code not installed / no data banner
    if !claude_status.projects_dir_exists && !claude_status.claude_json_exists {
        builder = builder.item(&MenuItem::with_id(
            app,
            "claude_missing",
            "Claude Code not detected (no ~/.claude data)",
            false,
            None::<&str>,
        )?);
        builder = builder.separator();
    }

    // Today's Messages (if enabled)
    if settings.show_messages {
        builder = builder.item(&MenuItem::with_id(
            app,
            "today_messages",
            format!(
                "Messages: {} today / {} total",
                stats.today_messages, stats.total_messages_count
            ),
            false,
            None::<&str>,
        )?);
        builder = builder.separator();
    }

    // Token Stats (if enabled)
    if settings.show_tokens {
        builder = builder.item(&MenuItem::with_id(
            app,
            "tokens_title",
            "Tokens",
            false,
            None::<&str>,
        )?);

        builder = builder.item(&MenuItem::with_id(
            app,
            "today_tokens",
            format!(
                "  Today: {} in / {} out",
                format_number(stats.today_input_tokens),
                format_number(stats.today_output_tokens)
            ),
            false,
            None::<&str>,
        )?);

        builder = builder.item(&MenuItem::with_id(
            app,
            "total_tokens",
            format!(
                "  Total: {} in / {} out",
                format_number(stats.total_input_tokens),
                format_number(stats.total_output_tokens)
            ),
            false,
            None::<&str>,
        )?);
        builder = builder.separator();
    }

    // Cost Stats with burn rate (if enabled)
    if settings.show_cost {
        builder = builder.item(&MenuItem::with_id(
            app,
            "cost_title",
            "Cost",
            false,
            None::<&str>,
        )?);

        // Today's cost with burn rate
        let today_cost_text = if settings.show_burn_rate && stats.cost_per_hour > 0.0 {
            format!(
                "  Today: {} ({})",
                format_cost(stats.today_cost),
                format_burn_rate(stats.cost_per_hour)
            )
        } else {
            format!("  Today: {}", format_cost(stats.today_cost))
        };
        builder = builder.item(&MenuItem::with_id(
            app,
            "today_cost",
            today_cost_text,
            false,
            None::<&str>,
        )?);

        builder = builder.item(&MenuItem::with_id(
            app,
            "total_cost",
            format!("  Total: {}", format_cost(stats.total_cost)),
            false,
            None::<&str>,
        )?);
        builder = builder.separator();
    }

    // Session block info (if enabled)
    if settings.show_sessions && stats.current_session_tokens > 0 {
        builder = builder.item(&MenuItem::with_id(
            app,
            "session_title",
            "Current Session",
            false,
            None::<&str>,
        )?);

        builder = builder.item(&MenuItem::with_id(
            app,
            "session_tokens",
            format!(
                "  Tokens: {}",
                format_number(stats.current_session_tokens)
            ),
            false,
            None::<&str>,
        )?);

        builder = builder.item(&MenuItem::with_id(
            app,
            "session_cost",
            format!("  Cost: {}", format_cost(stats.current_session_cost)),
            false,
            None::<&str>,
        )?);

        builder = builder.separator();
    }

    // Recent Projects submenu (from cache - no disk I/O)
    if !cached_projects.is_empty() {
        let mut projects_submenu = SubmenuBuilder::new(app, "Recent Projects");

        for (i, (name, _path)) in cached_projects.iter().enumerate() {
            projects_submenu = projects_submenu.item(&MenuItem::with_id(
                app,
                format!("project_{}", i),
                name,
                true,
                None::<&str>,
            )?);
        }

        builder = builder.item(&projects_submenu.build()?);
        builder = builder.separator();
    }

    // Navigation submenu
    let nav_submenu = SubmenuBuilder::new(app, "Open Section")
        .items(&[
            &MenuItem::with_id(app, "nav_analytics", "Analytics", true, None::<&str>)?,
            &MenuItem::with_id(app, "nav_projects", "Projects", true, None::<&str>)?,
            &MenuItem::with_id(app, "nav_agents", "Agents", true, None::<&str>)?,
            &MenuItem::with_id(app, "nav_plugins", "Plugins", true, None::<&str>)?,
            &MenuItem::with_id(app, "nav_config", "Config", true, None::<&str>)?,
            &MenuItem::with_id(app, "nav_backup", "Backup", true, None::<&str>)?,
        ])
        .build()?;

    builder = builder.item(&nav_submenu);

    // Quick Actions submenu
    let actions_submenu = SubmenuBuilder::new(app, "Quick Actions")
        .items(&[
            &MenuItem::with_id(app, "action_open_config", "Open ~/.claude.json", true, None::<&str>)?,
            &MenuItem::with_id(app, "action_open_claude_dir", "Open Claude Folder", true, None::<&str>)?,
            &MenuItem::with_id(app, "action_open_settings_json", "Open settings.json", true, None::<&str>)?,
        ])
        .build()?;

    builder = builder.item(&actions_submenu);

    builder = builder.separator();

    // Notifications toggle (from cached settings - no disk I/O)
    builder = builder.item(&CheckMenuItem::with_id(
        app,
        "toggle_notifications",
        "Notifications",
        true,
        settings.notifications_enabled,
        None::<&str>,
    )?);

    builder = builder.separator();

    // Main actions
    builder = builder.item(&MenuItem::with_id(
        app,
        "analytics",
        "Open Claudit",
        true,
        Some("CmdOrCtrl+O"),
    )?);

    builder = builder.item(&MenuItem::with_id(
        app,
        "refresh",
        "Refresh Stats",
        true,
        Some("CmdOrCtrl+R"),
    )?);

    builder = builder.separator();

    builder = builder.item(&MenuItem::with_id(
        app,
        "quit",
        "Quit Claudit",
        true,
        Some("CmdOrCtrl+Q"),
    )?);

    builder.build()
}

/// Update the tray menu with fresh data
pub fn update_tray_menu<R: Runtime>(app: &AppHandle<R>) -> Result<(), tauri::Error> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let menu = build_tray_menu(app)?;
        tray.set_menu(Some(menu))?;
    }
    Ok(())
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, id: &str) {
    println!("Menu event: {}", id);

    // Handle project clicks (project_0, project_1, etc.) - instant from cache
    if id.starts_with("project_") {
        if let Ok(index) = id.replace("project_", "").parse::<usize>() {
            let cache = MENU_CACHE.lock().unwrap();
            if let Some((_name, path)) = cache.projects.get(index) {
                let _ = Command::new("open").arg(path).spawn();
            }
        }
        return;
    }

    // Handle navigation
    if id.starts_with("nav_") {
        let section = id.replace("nav_", "");
        if let Some(window) = app.get_webview_window("analytics") {
            let _ = window.show();
            let _ = window.set_focus();
            let _ = app.emit("navigate", section);
        }
        return;
    }

    match id {
        "analytics" => {
            if let Some(window) = app.get_webview_window("analytics") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "refresh" => {
            let app_handle = app.clone();
            std::thread::spawn(move || {
                // Refresh analytics stats
                if let Some(state) = app_handle.try_state::<AppState>() {
                    let _ = state.analytics.refresh_stats();
                }
                // Refresh menu cache (projects, settings) from disk
                refresh_menu_cache();
                // Update menu with fresh cached data
                let _ = update_tray_menu(&app_handle);
                let _ = app_handle.emit("stats-refreshed", ());
            });
        }
        "toggle_notifications" => {
            // Toggle using cached value for instant response
            let (new_state, cached_settings) = {
                let mut cache = MENU_CACHE.lock().unwrap();
                if let Some(ref mut settings) = cache.settings {
                    settings.notifications_enabled = !settings.notifications_enabled;
                    (settings.notifications_enabled, Some(settings.clone()))
                } else {
                    // No cached settings, default to enabling
                    (true, None)
                }
            };

            // Update menu immediately with new cached state
            let _ = update_tray_menu(app);

            // Notify the frontend immediately with cached settings
            if let Some(settings) = &cached_settings {
                let _ = app.emit("settings-changed", settings);
            }

            // Persist to disk in background (no need to emit again)
            std::thread::spawn(move || {
                let settings_service = SettingsService::new();
                let mut settings = settings_service.get();
                settings.notifications_enabled = new_state;
                let _ = settings_service.update(settings);
            });
        }
        "action_open_config" => {
            let home = dirs::home_dir().unwrap_or_default();
            let config_path = home.join(".claude.json");
            let _ = Command::new("open").arg(config_path).spawn();
        }
        "action_open_claude_dir" => {
            let home = dirs::home_dir().unwrap_or_default();
            let claude_dir = home.join(".claude");
            let _ = Command::new("open").arg(claude_dir).spawn();
        }
        "action_open_settings_json" => {
            let home = dirs::home_dir().unwrap_or_default();
            let settings_path = home.join(".claude").join("settings.json");
            let _ = Command::new("open").arg(settings_path).spawn();
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}
