use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Raw JSONL entry from Claude Code logs
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
pub struct RawLogEntry {
    #[serde(rename = "type")]
    pub entry_type: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub message: Option<MessageData>,
    pub uuid: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MessageData {
    pub role: Option<String>,
    pub model: Option<String>,
    pub usage: Option<UsageData>,
    pub content: Option<Vec<ContentBlock>>,
}

/// Content block in assistant message (text, thinking, tool_use, etc.)
#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
pub enum ContentBlock {
    Text {
        #[serde(rename = "type")]
        block_type: String,
        text: String,
    },
    Thinking {
        #[serde(rename = "type")]
        block_type: String,
        thinking: String,
        #[serde(default)]
        signature: Option<String>,
    },
    ToolUse {
        #[serde(rename = "type")]
        block_type: String,
        id: Option<String>,
        name: Option<String>,
    },
    Other {
        #[serde(rename = "type")]
        block_type: String,
    },
}

impl ContentBlock {
    /// Extract text content if this is a text block
    pub fn as_text(&self) -> Option<&str> {
        match self {
            ContentBlock::Text { block_type, text } if block_type == "text" => Some(text),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct UsageData {
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cache_creation_input_tokens: Option<u64>,
    pub cache_read_input_tokens: Option<u64>,
}

/// Parsed and validated usage entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageEntry {
    pub timestamp: DateTime<Utc>,
    pub session_id: String,
    pub model: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_creation_tokens: u64,
    pub cache_read_tokens: u64,
    pub uuid: String,
    pub project: String,
}

impl UsageEntry {
    pub fn total_tokens(&self) -> u64 {
        self.input_tokens + self.output_tokens
    }
}

/// Token costs per 1M tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenCosts {
    pub input: f64,
    pub output: f64,
    pub cache_read: f64,
    pub cache_write: f64,
}

impl Default for TokenCosts {
    fn default() -> Self {
        // Default pricing (sonnet-like)
        Self {
            input: 3.0,
            output: 15.0,
            cache_read: 0.30,
            cache_write: 3.75,
        }
    }
}

/// Model-specific token breakdown
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ModelStats {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_creation_tokens: u64,
    pub cache_read_tokens: u64,
    pub cost: f64,
    pub message_count: u64,
}

impl ModelStats {
    pub fn total_tokens(&self) -> u64 {
        self.input_tokens + self.output_tokens
    }
}

/// Project-specific stats
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ProjectStats {
    pub name: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cost: f64,
    pub message_count: u64,
}

/// Aggregated analytics stats
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AnalyticsStats {
    // Token totals
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cache_creation_tokens: u64,
    pub total_cache_read_tokens: u64,

    // Today's totals
    pub today_input_tokens: u64,
    pub today_output_tokens: u64,
    pub today_cost: f64,
    pub today_messages: u64,

    // Session tracking (5-hour blocks)
    pub current_session_tokens: u64,
    pub current_session_cost: f64,
    pub today_session_count: u32,
    pub total_session_count: u32,

    // Burn rate
    pub tokens_per_minute: f64,
    pub cost_per_hour: f64,

    // Total cost
    pub total_cost: f64,

    // Per-model breakdown
    pub by_model: HashMap<String, ModelStats>,

    // Per-project breakdown
    pub by_project: HashMap<String, ProjectStats>,

    // Message counts
    pub today_messages_count: u64,
    pub total_messages_count: u64,

    // Last update timestamp
    pub last_updated: Option<DateTime<Utc>>,
}

impl AnalyticsStats {
    pub fn total_tokens(&self) -> u64 {
        self.total_input_tokens + self.total_output_tokens
    }

    pub fn today_tokens(&self) -> u64 {
        self.today_input_tokens + self.today_output_tokens
    }

    pub fn cache_hit_rate(&self) -> f64 {
        let total_input = self.total_input_tokens + self.total_cache_read_tokens;
        if total_input == 0 {
            return 0.0;
        }
        (self.total_cache_read_tokens as f64 / total_input as f64) * 100.0
    }
}

/// Daily stats for chart data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyStats {
    pub date: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cost: f64,
    pub messages: u64,
}

/// Hourly distribution for chart data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HourlyStats {
    pub hour: u8,
    pub tokens: u64,
    pub messages: u64,
}

/// Chart data bundle for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChartData {
    pub daily: Vec<DailyStats>,
    pub hourly: Vec<HourlyStats>,
    pub by_model: Vec<ModelChartData>,
    pub by_project: Vec<ProjectChartData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelChartData {
    pub name: String,
    pub tokens: u64,
    pub cost: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectChartData {
    pub name: String,
    pub tokens: u64,
    pub cost: f64,
}

/// Hook event from Claude Code
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookEvent {
    pub event: String,
    pub tool: Option<String>,
    pub context: Option<String>,
    pub timestamp: Option<String>,
}

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub notifications_enabled: bool,
    pub show_messages: bool,
    pub show_tokens: bool,
    pub show_cost: bool,
    pub show_burn_rate: bool,
    pub show_sessions: bool,
    pub show_model_breakdown: bool,
    pub compact_mode: bool,
    pub auto_start: bool,
    pub hook_port: u16,
    #[serde(default)]
    pub claude_cli_path: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            notifications_enabled: true,
            show_messages: true,
            show_tokens: true,
            show_cost: true,
            show_burn_rate: true,
            show_sessions: true,
            show_model_breakdown: true,
            compact_mode: false,
            auto_start: false,
            hook_port: 3456,
            claude_cli_path: None,
        }
    }
}
