use crate::types::AppSettings;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};

/// Manages application settings persistence
pub struct SettingsService {
    settings_path: PathBuf,
    cached_settings: Arc<RwLock<AppSettings>>,
}

impl SettingsService {
    pub fn new() -> Self {
        let settings_path = Self::get_settings_path();

        // Load settings from disk or use defaults
        let settings = Self::load_from_disk(&settings_path).unwrap_or_default();

        Self {
            settings_path,
            cached_settings: Arc::new(RwLock::new(settings)),
        }
    }

    fn get_settings_path() -> PathBuf {
        let config_dir = dirs::config_dir()
            .or_else(dirs::home_dir)
            .expect("Could not find config directory");

        let app_config_dir = config_dir.join("claudit");

        // Ensure directory exists
        if !app_config_dir.exists() {
            let _ = fs::create_dir_all(&app_config_dir);
        }

        app_config_dir.join("settings.json")
    }

    fn load_from_disk(path: &PathBuf) -> Option<AppSettings> {
        let contents = fs::read_to_string(path).ok()?;
        serde_json::from_str(&contents).ok()
    }

    fn save_to_disk(&self, settings: &AppSettings) -> Result<(), String> {
        let contents =
            serde_json::to_string_pretty(settings).map_err(|e| format!("Serialize error: {}", e))?;

        fs::write(&self.settings_path, contents).map_err(|e| format!("Write error: {}", e))
    }

    /// Get current settings
    pub fn get(&self) -> AppSettings {
        self.cached_settings.read().unwrap().clone()
    }

    /// Update settings
    pub fn update(&self, settings: AppSettings) -> Result<(), String> {
        self.save_to_disk(&settings)?;
        *self.cached_settings.write().unwrap() = settings;
        Ok(())
    }

    /// Update a single setting
    pub fn set_notifications_enabled(&self, enabled: bool) -> Result<(), String> {
        let mut settings = self.get();
        settings.notifications_enabled = enabled;
        self.update(settings)
    }

    pub fn set_compact_mode(&self, enabled: bool) -> Result<(), String> {
        let mut settings = self.get();
        settings.compact_mode = enabled;
        self.update(settings)
    }

    pub fn set_auto_start(&self, enabled: bool) -> Result<(), String> {
        let mut settings = self.get();
        settings.auto_start = enabled;
        self.update(settings)
    }

    pub fn set_hook_port(&self, port: u16) -> Result<(), String> {
        let mut settings = self.get();
        settings.hook_port = port;
        self.update(settings)
    }

    /// Toggle visibility settings
    pub fn toggle_section(&self, section: &str, visible: bool) -> Result<(), String> {
        let mut settings = self.get();

        match section {
            "messages" => settings.show_messages = visible,
            "tokens" => settings.show_tokens = visible,
            "cost" => settings.show_cost = visible,
            "burn_rate" => settings.show_burn_rate = visible,
            "sessions" => settings.show_sessions = visible,
            "model_breakdown" => settings.show_model_breakdown = visible,
            _ => return Err(format!("Unknown section: {}", section)),
        }

        self.update(settings)
    }
}

impl Default for SettingsService {
    fn default() -> Self {
        Self::new()
    }
}
