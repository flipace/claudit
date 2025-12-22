use crate::services::usage::UsageReader;
use crate::types::{
    AnalyticsStats, ChartData, DailyStats, HourlyStats, ModelChartData, ModelStats,
    ProjectChartData, ProjectStats, TokenCosts, UsageEntry,
};
use chrono::{DateTime, Datelike, Duration, Timelike, Utc};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// Token pricing per 1M tokens for different models
fn get_model_costs(model: &str) -> TokenCosts {
    let model_lower = model.to_lowercase();

    if model_lower.contains("opus") {
        TokenCosts {
            input: 15.0,
            output: 75.0,
            cache_read: 1.50,
            cache_write: 18.75,
        }
    } else if model_lower.contains("sonnet") {
        TokenCosts {
            input: 3.0,
            output: 15.0,
            cache_read: 0.30,
            cache_write: 3.75,
        }
    } else if model_lower.contains("haiku") {
        TokenCosts {
            input: 0.25,
            output: 1.25,
            cache_read: 0.025,
            cache_write: 0.30,
        }
    } else {
        // Default to sonnet pricing
        TokenCosts::default()
    }
}

/// Calculate cost for a single entry
fn calculate_entry_cost(entry: &UsageEntry) -> f64 {
    let costs = get_model_costs(&entry.model);
    let per_million = 1_000_000.0;

    let input_cost = (entry.input_tokens as f64 / per_million) * costs.input;
    let output_cost = (entry.output_tokens as f64 / per_million) * costs.output;
    let cache_read_cost = (entry.cache_read_tokens as f64 / per_million) * costs.cache_read;
    let cache_write_cost = (entry.cache_creation_tokens as f64 / per_million) * costs.cache_write;

    input_cost + output_cost + cache_read_cost + cache_write_cost
}

/// Get the session block key (5-hour blocks)
fn get_session_block_key(timestamp: &DateTime<Utc>) -> String {
    let block = timestamp.hour() / 5;
    format!(
        "{}-{:02}-{:02}-{}",
        timestamp.year(),
        timestamp.month(),
        timestamp.day(),
        block
    )
}

/// Analytics service for calculating usage statistics
pub struct AnalyticsService {
    usage_reader: UsageReader,
    cached_stats: Arc<RwLock<Option<AnalyticsStats>>>,
    last_refresh: Arc<RwLock<Option<DateTime<Utc>>>>,
}

impl AnalyticsService {
    pub fn new() -> Self {
        Self {
            usage_reader: UsageReader::new(),
            cached_stats: Arc::new(RwLock::new(None)),
            last_refresh: Arc::new(RwLock::new(None)),
        }
    }

    /// Check if cache needs refresh (older than 30 seconds)
    fn needs_refresh(&self) -> bool {
        let last = match self.last_refresh.read() {
            Ok(guard) => *guard,
            Err(_) => return true, // If lock is poisoned, force refresh
        };
        match last {
            Some(time) => Utc::now() - time > Duration::seconds(30),
            None => true,
        }
    }

    /// Calculate statistics from usage entries
    fn calculate_stats(&self, entries: &[UsageEntry]) -> AnalyticsStats {
        let now = Utc::now();
        let today_start = now
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .unwrap()
            .and_utc();

        let current_session_key = get_session_block_key(&now);

        let mut stats = AnalyticsStats::default();
        let mut session_blocks: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut today_session_blocks: std::collections::HashSet<String> =
            std::collections::HashSet::new();

        // Track burn rate (last 30 minutes of activity)
        let burn_window_start = now - Duration::minutes(30);
        let mut burn_window_tokens: u64 = 0;
        let mut burn_window_cost: f64 = 0.0;
        let mut burn_window_minutes: i64 = 0;

        for entry in entries {
            let cost = calculate_entry_cost(entry);
            let is_today = entry.timestamp >= today_start;
            let session_key = get_session_block_key(&entry.timestamp);
            let is_current_session = session_key == current_session_key;

            // Total stats
            stats.total_input_tokens += entry.input_tokens;
            stats.total_output_tokens += entry.output_tokens;
            stats.total_cache_creation_tokens += entry.cache_creation_tokens;
            stats.total_cache_read_tokens += entry.cache_read_tokens;
            stats.total_cost += cost;
            stats.total_messages_count += 1;

            // Today's stats
            if is_today {
                stats.today_input_tokens += entry.input_tokens;
                stats.today_output_tokens += entry.output_tokens;
                stats.today_cost += cost;
                stats.today_messages += 1;
                stats.today_messages_count += 1;
                today_session_blocks.insert(session_key.clone());
            }

            // Current session stats
            if is_current_session {
                stats.current_session_tokens += entry.total_tokens();
                stats.current_session_cost += cost;
            }

            // Session tracking
            session_blocks.insert(session_key);

            // Burn rate calculation (last 30 mins)
            if entry.timestamp >= burn_window_start {
                burn_window_tokens += entry.total_tokens();
                burn_window_cost += cost;
                if burn_window_minutes == 0 {
                    burn_window_minutes = (now - entry.timestamp).num_minutes().max(1);
                }
            }

            // Per-model breakdown
            let model_stats = stats
                .by_model
                .entry(entry.model.clone())
                .or_insert_with(ModelStats::default);
            model_stats.input_tokens += entry.input_tokens;
            model_stats.output_tokens += entry.output_tokens;
            model_stats.cache_creation_tokens += entry.cache_creation_tokens;
            model_stats.cache_read_tokens += entry.cache_read_tokens;
            model_stats.cost += cost;
            model_stats.message_count += 1;

            // Per-project breakdown
            let project_stats = stats
                .by_project
                .entry(entry.project.clone())
                .or_insert_with(|| ProjectStats {
                    name: entry.project.clone(),
                    ..Default::default()
                });
            project_stats.input_tokens += entry.input_tokens;
            project_stats.output_tokens += entry.output_tokens;
            project_stats.cost += cost;
            project_stats.message_count += 1;
        }

        // Calculate session counts
        stats.total_session_count = session_blocks.len() as u32;
        stats.today_session_count = today_session_blocks.len() as u32;

        // Calculate burn rate
        if burn_window_minutes > 0 {
            stats.tokens_per_minute = burn_window_tokens as f64 / burn_window_minutes as f64;
            stats.cost_per_hour = (burn_window_cost / burn_window_minutes as f64) * 60.0;
        }

        stats.last_updated = Some(now);

        stats
    }

    /// Get current stats (uses cache if fresh)
    pub fn get_stats(&self) -> AnalyticsStats {
        if !self.needs_refresh() {
            if let Ok(guard) = self.cached_stats.read() {
                if let Some(stats) = guard.clone() {
                    return stats;
                }
            }
        }

        self.refresh_stats()
    }

    /// Force refresh stats
    pub fn refresh_stats(&self) -> AnalyticsStats {
        let entries = self.usage_reader.read_all_entries();
        let stats = self.calculate_stats(&entries);

        // Update cache, ignoring poisoned lock errors
        if let Ok(mut guard) = self.cached_stats.write() {
            *guard = Some(stats.clone());
        }
        if let Ok(mut guard) = self.last_refresh.write() {
            *guard = Some(Utc::now());
        }

        stats
    }

    /// Get chart data for the analytics dashboard
    pub fn get_chart_data(&self, days: u32) -> ChartData {
        let entries = self.usage_reader.read_entries(Some(days));

        // Daily stats
        let mut daily_map: HashMap<String, DailyStats> = HashMap::new();
        for entry in &entries {
            let date_key = entry.timestamp.format("%Y-%m-%d").to_string();
            let cost = calculate_entry_cost(entry);

            let daily = daily_map.entry(date_key.clone()).or_insert_with(|| DailyStats {
                date: date_key,
                input_tokens: 0,
                output_tokens: 0,
                cost: 0.0,
                messages: 0,
            });

            daily.input_tokens += entry.input_tokens;
            daily.output_tokens += entry.output_tokens;
            daily.cost += cost;
            daily.messages += 1;
        }

        let mut daily: Vec<DailyStats> = daily_map.into_values().collect();
        daily.sort_by(|a, b| a.date.cmp(&b.date));

        // Hourly distribution
        let mut hourly_map: HashMap<u8, HourlyStats> = HashMap::new();
        for entry in &entries {
            let hour = entry.timestamp.hour() as u8;
            let hourly = hourly_map.entry(hour).or_insert_with(|| HourlyStats {
                hour,
                tokens: 0,
                messages: 0,
            });
            hourly.tokens += entry.total_tokens();
            hourly.messages += 1;
        }

        let mut hourly: Vec<HourlyStats> = hourly_map.into_values().collect();
        hourly.sort_by_key(|h| h.hour);

        // By model
        let mut model_map: HashMap<String, (u64, f64)> = HashMap::new();
        for entry in &entries {
            let cost = calculate_entry_cost(entry);
            let model_data = model_map.entry(entry.model.clone()).or_insert((0, 0.0));
            model_data.0 += entry.total_tokens();
            model_data.1 += cost;
        }

        let mut by_model: Vec<ModelChartData> = model_map
            .into_iter()
            .map(|(name, (tokens, cost))| ModelChartData { name, tokens, cost })
            .collect();
        by_model.sort_by(|a, b| b.tokens.cmp(&a.tokens));

        // By project
        let mut project_map: HashMap<String, (u64, f64)> = HashMap::new();
        for entry in &entries {
            let cost = calculate_entry_cost(entry);
            let project_data = project_map.entry(entry.project.clone()).or_insert((0, 0.0));
            project_data.0 += entry.total_tokens();
            project_data.1 += cost;
        }

        let mut by_project: Vec<ProjectChartData> = project_map
            .into_iter()
            .map(|(name, (tokens, cost))| ProjectChartData { name, tokens, cost })
            .collect();
        by_project.sort_by(|a, b| b.tokens.cmp(&a.tokens));

        ChartData {
            daily,
            hourly,
            by_model,
            by_project,
        }
    }
}

impl Default for AnalyticsService {
    fn default() -> Self {
        Self::new()
    }
}
