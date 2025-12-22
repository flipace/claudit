use crate::services::SettingsService;
use crate::AppState;
use tauri::{
    include_image,
    menu::{Menu, MenuBuilder, MenuItem},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Emitter, Manager, Runtime,
};

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

fn build_tray_menu<R: Runtime>(app: &AppHandle<R>) -> Result<Menu<R>, tauri::Error> {
    // Get cached stats from AppState (fast - no disk I/O)
    let stats = app
        .try_state::<AppState>()
        .map(|state| state.analytics.get_stats())
        .unwrap_or_default();
    let settings = SettingsService::new().get();

    let mut builder = MenuBuilder::new(app);

    // Header
    builder = builder.item(&MenuItem::with_id(
        app,
        "header",
        "Claudit",
        false,
        None::<&str>,
    )?);

    builder = builder.separator();

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

    // Cost Stats (if enabled)
    if settings.show_cost {
        builder = builder.item(&MenuItem::with_id(
            app,
            "cost_title",
            "Cost",
            false,
            None::<&str>,
        )?);

        builder = builder.item(&MenuItem::with_id(
            app,
            "today_cost",
            format!("  Today: {}", format_cost(stats.today_cost)),
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

    // Actions
    builder = builder.item(&MenuItem::with_id(
        app,
        "analytics",
        "Open Claudit",
        true,
        Some("CmdOrCtrl+A"),
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
    match id {
        "analytics" => {
            if let Some(window) = app.get_webview_window("analytics") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "refresh" => {
            // Spawn async task to avoid blocking UI
            let app_handle = app.clone();
            std::thread::spawn(move || {
                // Refresh stats using cached AppState analytics
                if let Some(state) = app_handle.try_state::<AppState>() {
                    let _ = state.analytics.refresh_stats();
                }
                let _ = app_handle.emit("stats-refreshed", ());
                // Rebuild tray menu with fresh data
                let _ = update_tray_menu(&app_handle);
            });
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}
