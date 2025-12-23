use crate::services::SettingsService;
use crate::types::ClaudeStatus;
use std::path::PathBuf;

fn exists(p: &PathBuf) -> bool {
    std::fs::metadata(p).is_ok()
}

pub fn get_claude_status() -> ClaudeStatus {
    let home = dirs::home_dir();

    let (claude_dir, claude_projects_dir, claude_json_path) = if let Some(home) = &home {
        (
            home.join(".claude"),
            home.join(".claude").join("projects"),
            home.join(".claude.json"),
        )
    } else {
        (PathBuf::new(), PathBuf::new(), PathBuf::new())
    };

    let claude_settings_path = if !claude_dir.as_os_str().is_empty() {
        claude_dir.join("settings.json")
    } else {
        PathBuf::new()
    };

    // Detect CLI binary
    let settings = SettingsService::new().get();
    let custom_cli = settings.claude_cli_path.clone().map(PathBuf::from);

    let mut cli_candidates: Vec<PathBuf> = Vec::new();
    if let Some(p) = custom_cli {
        cli_candidates.push(p);
    }
    if let Some(home) = &home {
        cli_candidates.push(home.join(".claude").join("local").join("claude"));
        cli_candidates.push(home.join(".local").join("bin").join("claude"));
        cli_candidates.push(home.join(".npm-global").join("bin").join("claude"));
    }
    cli_candidates.push(PathBuf::from("/opt/homebrew/bin/claude"));
    cli_candidates.push(PathBuf::from("/usr/local/bin/claude"));

    let claude_cli_found = cli_candidates.iter().any(|p| exists(p));

    let claude_dir_exists = !claude_dir.as_os_str().is_empty() && exists(&claude_dir);
    let projects_dir_exists = !claude_projects_dir.as_os_str().is_empty() && exists(&claude_projects_dir);
    let claude_json_exists = !claude_json_path.as_os_str().is_empty() && exists(&claude_json_path);
    let settings_json_exists = !claude_settings_path.as_os_str().is_empty() && exists(&claude_settings_path);

    ClaudeStatus {
        claude_dir_exists,
        projects_dir_exists,
        claude_json_exists,
        settings_json_exists,
        claude_cli_found,
    }
}


