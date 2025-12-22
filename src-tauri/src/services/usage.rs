use crate::types::{RawLogEntry, UsageEntry};
use chrono::{DateTime, Utc};
use glob::glob;
use std::collections::HashSet;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

/// Reads and parses Claude Code usage logs from JSONL files
pub struct UsageReader {
    claude_dir: PathBuf,
}

impl UsageReader {
    pub fn new() -> Self {
        let home = dirs::home_dir().expect("Could not find home directory");
        Self {
            claude_dir: home.join(".claude").join("projects"),
        }
    }

    /// Find all JSONL files in the Claude projects directory
    fn find_jsonl_files(&self) -> Vec<PathBuf> {
        let pattern = self.claude_dir.join("**").join("*.jsonl");
        let pattern_str = pattern.to_string_lossy();

        let mut files: Vec<PathBuf> = glob(&pattern_str)
            .expect("Failed to read glob pattern")
            .filter_map(|entry| entry.ok())
            .collect();

        // Sort by modification time (newest first)
        files.sort_by(|a, b| {
            let a_time = a.metadata().and_then(|m| m.modified()).ok();
            let b_time = b.metadata().and_then(|m| m.modified()).ok();
            b_time.cmp(&a_time)
        });

        files
    }

    /// Extract project name from file path
    fn extract_project_name(file_path: &PathBuf) -> String {
        // Path structure: ~/.claude/projects/{project-hash}/{file}.jsonl
        // The project hash is typically after "projects/"
        if let Some(parent) = file_path.parent() {
            if let Some(name) = parent.file_name() {
                return name.to_string_lossy().to_string();
            }
        }
        "unknown".to_string()
    }

    /// Parse a single JSONL line
    fn parse_line(&self, line: &str, project: &str) -> Option<UsageEntry> {
        let raw: RawLogEntry = serde_json::from_str(line).ok()?;

        // Only process assistant messages with usage data
        if raw.entry_type.as_deref() != Some("assistant") {
            return None;
        }

        let message = raw.message?;
        if message.role.as_deref() != Some("assistant") {
            return None;
        }

        let usage = message.usage?;
        let model = message.model?;

        // Parse timestamp
        let timestamp = raw.timestamp.as_ref().and_then(|ts| {
            DateTime::parse_from_rfc3339(ts)
                .ok()
                .map(|dt| dt.with_timezone(&Utc))
        })?;

        Some(UsageEntry {
            timestamp,
            session_id: raw.session_id.unwrap_or_default(),
            model,
            input_tokens: usage.input_tokens.unwrap_or(0),
            output_tokens: usage.output_tokens.unwrap_or(0),
            cache_creation_tokens: usage.cache_creation_input_tokens.unwrap_or(0),
            cache_read_tokens: usage.cache_read_input_tokens.unwrap_or(0),
            uuid: raw.uuid.unwrap_or_default(),
            project: project.to_string(),
        })
    }

    /// Read all usage entries, optionally filtered by days
    pub fn read_entries(&self, days: Option<u32>) -> Vec<UsageEntry> {
        let files = self.find_jsonl_files();
        let mut entries = Vec::new();
        let mut seen_uuids: HashSet<String> = HashSet::new();

        // Calculate cutoff date if days is specified
        let cutoff = days.map(|d| Utc::now() - chrono::Duration::days(d as i64));

        for file_path in files {
            let project = Self::extract_project_name(&file_path);

            let file = match File::open(&file_path) {
                Ok(f) => f,
                Err(_) => continue,
            };

            let reader = BufReader::new(file);

            for line in reader.lines() {
                let line = match line {
                    Ok(l) => l,
                    Err(_) => continue,
                };

                if line.trim().is_empty() {
                    continue;
                }

                if let Some(entry) = self.parse_line(&line, &project) {
                    // Apply date filter
                    if let Some(cutoff_date) = cutoff {
                        if entry.timestamp < cutoff_date {
                            continue;
                        }
                    }

                    // Deduplicate by UUID
                    if !entry.uuid.is_empty() {
                        if seen_uuids.contains(&entry.uuid) {
                            continue;
                        }
                        seen_uuids.insert(entry.uuid.clone());
                    }

                    entries.push(entry);
                }
            }
        }

        // Sort by timestamp (oldest first)
        entries.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

        entries
    }

    /// Read all entries (for total stats)
    pub fn read_all_entries(&self) -> Vec<UsageEntry> {
        self.read_entries(None)
    }

    /// Get the latest assistant text response (for notifications)
    /// Returns an excerpt of the most recent assistant message's text content
    pub fn get_latest_response(&self, max_chars: usize) -> Option<String> {
        let files = self.find_jsonl_files();

        // Check the most recently modified files first
        for file_path in files.iter().take(5) {
            let file = match File::open(file_path) {
                Ok(f) => f,
                Err(_) => continue,
            };

            let reader = BufReader::new(file);
            let lines: Vec<String> = reader.lines().filter_map(|l| l.ok()).collect();

            // Read from the end to find the latest assistant message with text
            for line in lines.iter().rev() {
                if line.trim().is_empty() {
                    continue;
                }

                if let Ok(raw) = serde_json::from_str::<RawLogEntry>(line) {
                    // Only process assistant messages
                    if raw.entry_type.as_deref() != Some("assistant") {
                        continue;
                    }

                    if let Some(message) = raw.message {
                        if message.role.as_deref() != Some("assistant") {
                            continue;
                        }

                        // Extract text content
                        if let Some(content) = message.content {
                            let text_parts: Vec<&str> = content
                                .iter()
                                .filter_map(|block| block.as_text())
                                .collect();

                            if !text_parts.is_empty() {
                                let full_text = text_parts.join(" ");
                                let trimmed = full_text.trim();

                                if trimmed.is_empty() {
                                    continue;
                                }

                                // Truncate to max_chars with ellipsis
                                let excerpt = if trimmed.len() > max_chars {
                                    format!("{}...", &trimmed[..max_chars])
                                } else {
                                    trimmed.to_string()
                                };

                                return Some(excerpt);
                            }
                        }
                    }
                }
            }
        }

        None
    }
}

impl Default for UsageReader {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_usage_reader_creation() {
        let reader = UsageReader::new();
        assert!(reader.claude_dir.to_string_lossy().contains(".claude/projects"));
    }
}
