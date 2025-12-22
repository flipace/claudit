use crate::types::{ContentBlock, RawLogEntry, TokenCosts};
use chrono::{DateTime, Utc};
use glob::glob;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};

/// Get the Claude config directory path
fn get_claude_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".claude")
}

/// Get the Claude settings file path
fn get_claude_json_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".claude.json")
}

// ============ CLAUDE.md Files ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeMdFile {
    pub path: String,
    pub name: String,
    #[serde(rename = "isGlobal")]
    pub is_global: bool,
    #[serde(rename = "projectName")]
    pub project_name: Option<String>,
}

/// List all CLAUDE.md files (global + project-level)
pub fn list_claude_md_files() -> Result<Vec<ClaudeMdFile>, String> {
    let mut files = Vec::new();
    let claude_dir = get_claude_dir();

    // Global CLAUDE.md
    let global_path = claude_dir.join("CLAUDE.md");
    if global_path.exists() {
        files.push(ClaudeMdFile {
            path: global_path.to_string_lossy().to_string(),
            name: "CLAUDE.md".to_string(),
            is_global: true,
            project_name: Some("Global".to_string()),
        });
    }

    // Find project CLAUDE.md files from ~/.claude.json
    if let Ok(claude_json) = read_claude_json() {
        if let Some(projects) = claude_json.projects {
            for (project_path, _) in projects {
                let project_claude = PathBuf::from(&project_path).join("CLAUDE.md");
                if project_claude.exists() {
                    let project_name = PathBuf::from(&project_path)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| project_path.clone());

                    files.push(ClaudeMdFile {
                        path: project_claude.to_string_lossy().to_string(),
                        name: "CLAUDE.md".to_string(),
                        is_global: false,
                        project_name: Some(project_name),
                    });
                }
            }
        }
    }

    Ok(files)
}

/// Read content of a CLAUDE.md file
pub fn get_claude_md_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| e.to_string())
}

// ============ Agents & Commands ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandInfo {
    pub name: String,
    pub path: String,
    pub description: Option<String>,
    #[serde(rename = "isDirectory")]
    pub is_directory: bool,
}

/// List all custom agents
pub fn list_agents() -> Result<Vec<AgentInfo>, String> {
    let agents_dir = get_claude_dir().join("agents");
    list_items_in_dir(&agents_dir)
}

/// List all custom commands
pub fn list_commands() -> Result<Vec<CommandInfo>, String> {
    let commands_dir = get_claude_dir().join("commands");
    // Reuse the same logic as agents since the structure is identical
    list_items_in_dir(&commands_dir).map(|items| {
        items.into_iter().map(|a| CommandInfo {
            name: a.name,
            path: a.path,
            description: a.description,
            is_directory: a.is_directory,
        }).collect()
    })
}

/// Extract description from YAML frontmatter or first content line
fn extract_description(content: &str) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();

    // Check if file starts with YAML frontmatter (---)
    if lines.first().map_or(false, |l| l.trim() == "---") {
        // Find the closing ---
        let mut in_frontmatter = true;
        for line in lines.iter().skip(1) {
            if line.trim() == "---" {
                in_frontmatter = false;
                continue;
            }
            if in_frontmatter {
                // Look for description: field
                let trimmed = line.trim();
                if trimmed.starts_with("description:") {
                    let desc = trimmed.strip_prefix("description:").unwrap_or("").trim();
                    // Remove quotes if present
                    let desc = desc.trim_matches('"').trim_matches('\'');
                    if !desc.is_empty() {
                        return Some(desc.chars().take(150).collect());
                    }
                }
            }
        }
    }

    // Fallback: find first non-empty, non-header, non-frontmatter line
    let mut past_frontmatter = !lines.first().map_or(false, |l| l.trim() == "---");
    for line in &lines {
        if !past_frontmatter {
            if line.trim() == "---" {
                past_frontmatter = true;
            }
            continue;
        }
        let trimmed = line.trim();
        if !trimmed.is_empty() && !trimmed.starts_with('#') {
            return Some(trimmed.chars().take(150).collect());
        }
    }

    None
}

fn list_items_in_dir(dir: &Path) -> Result<Vec<AgentInfo>, String> {
    let mut items = Vec::new();

    if !dir.exists() {
        return Ok(items);
    }

    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files
        if name.starts_with('.') {
            continue;
        }

        let is_directory = path.is_dir();
        let description = if !is_directory && path.extension().map_or(false, |e| e == "md") {
            // Extract description from YAML frontmatter or content
            fs::read_to_string(&path)
                .ok()
                .and_then(|content| extract_description(&content))
        } else {
            None
        };

        items.push(AgentInfo {
            name: name.trim_end_matches(".md").to_string(),
            path: path.to_string_lossy().to_string(),
            description,
            is_directory,
        });
    }

    // Sort by name
    items.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(items)
}

/// Get content of an agent or command file
pub fn get_agent_or_command_content(path: &str) -> Result<String, String> {
    let path = PathBuf::from(path);

    if path.is_file() {
        fs::read_to_string(&path).map_err(|e| e.to_string())
    } else if path.is_dir() {
        // For directories, try to read index.md or the first .md file
        let index_path = path.join("index.md");
        if index_path.exists() {
            return fs::read_to_string(&index_path).map_err(|e| e.to_string());
        }

        // Try first .md file
        if let Ok(entries) = fs::read_dir(&path) {
            for entry in entries.flatten() {
                let entry_path = entry.path();
                if entry_path.extension().map_or(false, |e| e == "md") {
                    return fs::read_to_string(&entry_path).map_err(|e| e.to_string());
                }
            }
        }

        // List directory contents
        let mut content = format!("# {}\n\nDirectory contents:\n", path.file_name().unwrap_or_default().to_string_lossy());
        if let Ok(entries) = fs::read_dir(&path) {
            for entry in entries.flatten() {
                content.push_str(&format!("- {}\n", entry.file_name().to_string_lossy()));
            }
        }
        Ok(content)
    } else {
        Err("File not found".to_string())
    }
}

// ============ Plugins & MCP ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInfo {
    pub name: String,
    pub version: String,
    pub scope: String,
    #[serde(rename = "installPath")]
    pub install_path: String,
    #[serde(rename = "installedAt")]
    pub installed_at: String,
    #[serde(rename = "isLocal")]
    pub is_local: bool,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpServer {
    pub name: String,
    #[serde(rename = "type")]
    pub server_type: String,
    pub command: Option<String>,
    pub url: Option<String>,
    pub args: Option<Vec<String>>,
    #[serde(rename = "projectPath")]
    pub project_path: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[allow(dead_code)]
struct InstalledPluginsFile {
    version: i32,
    plugins: HashMap<String, Vec<PluginInstallInfo>>,
}

#[derive(Debug, Clone, Deserialize)]
struct PluginInstallInfo {
    scope: String,
    #[serde(rename = "installPath")]
    install_path: String,
    version: String,
    #[serde(rename = "installedAt")]
    installed_at: String,
    #[serde(rename = "isLocal")]
    is_local: bool,
}

/// Expand ~ in paths to the home directory
fn expand_tilde(path: &str) -> String {
    if path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]).to_string_lossy().to_string();
        }
    } else if path == "~" {
        if let Some(home) = dirs::home_dir() {
            return home.to_string_lossy().to_string();
        }
    }
    path.to_string()
}

/// Get installed plugins
pub fn get_installed_plugins() -> Result<Vec<PluginInfo>, String> {
    let plugins_file = get_claude_dir().join("plugins").join("installed_plugins.json");

    if !plugins_file.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&plugins_file).map_err(|e| e.to_string())?;
    let installed: InstalledPluginsFile = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Read settings to check which are enabled
    let settings = read_settings_json();
    let enabled_plugins: HashMap<String, bool> = settings
        .and_then(|s| s.enabled_plugins)
        .unwrap_or_default();

    let mut plugins = Vec::new();
    for (name, installs) in installed.plugins {
        if let Some(install) = installs.first() {
            // Expand ~ and get directory (if path is a file)
            let expanded_path = expand_tilde(&install.install_path);
            let path = Path::new(&expanded_path);
            let install_dir = if path.is_file() {
                path.parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or(expanded_path)
            } else {
                expanded_path
            };

            plugins.push(PluginInfo {
                name: name.clone(),
                version: install.version.clone(),
                scope: install.scope.clone(),
                install_path: install_dir,
                installed_at: install.installed_at.clone(),
                is_local: install.is_local,
                enabled: enabled_plugins.get(&name).copied().unwrap_or(false),
            });
        }
    }

    Ok(plugins)
}

/// Get all MCP servers (global + per-project)
pub fn get_mcp_servers() -> Result<Vec<McpServer>, String> {
    let mut servers = Vec::new();

    // Read global MCP servers from settings.json
    let settings_path = get_claude_dir().join("settings.json");
    if settings_path.exists() {
        if let Ok(content) = fs::read_to_string(&settings_path) {
            if let Ok(settings) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(mcp_servers) = settings.get("mcpServers") {
                    if let Some(obj) = mcp_servers.as_object() {
                        for (name, config) in obj {
                            let command = config.get("command").and_then(|v| v.as_str()).map(|s| s.to_string());
                            let url = config.get("url").and_then(|v| v.as_str()).map(|s| s.to_string());
                            let args: Option<Vec<String>> = config.get("args").and_then(|v| {
                                v.as_array().map(|arr| {
                                    arr.iter()
                                        .filter_map(|item| item.as_str().map(|s| s.to_string()))
                                        .collect()
                                })
                            });
                            let server_type = if url.is_some() { "http" } else { "stdio" };

                            servers.push(McpServer {
                                name: name.clone(),
                                server_type: server_type.to_string(),
                                command,
                                url,
                                args,
                                project_path: None, // Global server
                            });
                        }
                    }
                }
            }
        }
    }

    // Read project-level MCP servers from ~/.claude.json
    if let Ok(claude_json) = read_claude_json() {
        if let Some(projects) = claude_json.projects {
            for (project_path, project_config) in projects {
                if let Some(mcp_servers) = project_config.mcp_servers {
                    for (name, server_config) in mcp_servers {
                        servers.push(McpServer {
                            name,
                            server_type: server_config.server_type.unwrap_or_else(|| "stdio".to_string()),
                            command: server_config.command,
                            url: server_config.url,
                            args: server_config.args,
                            project_path: Some(project_path.clone()),
                        });
                    }
                }
            }
        }
    }

    // Sort by name for consistent ordering
    servers.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(servers)
}

/// Get the path to the global MCP config file (settings.json)
pub fn get_mcp_config_path() -> Result<String, String> {
    let settings_path = get_claude_dir().join("settings.json");
    Ok(settings_path.to_string_lossy().to_string())
}

/// Read the current MCP servers config from settings.json
pub fn get_mcp_config() -> Result<String, String> {
    let settings_path = get_claude_dir().join("settings.json");

    if !settings_path.exists() {
        // Return empty config template
        return Ok(r#"{
  "mcpServers": {}
}"#.to_string());
    }

    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;

    // Parse and extract just the mcpServers section if it exists
    let settings: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    if let Some(mcp_servers) = settings.get("mcpServers") {
        let formatted = serde_json::to_string_pretty(mcp_servers).map_err(|e| e.to_string())?;
        Ok(formatted)
    } else {
        Ok("{}".to_string())
    }
}

/// Add or update MCP servers in settings.json
pub fn update_mcp_config(mcp_servers_json: &str) -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");

    // Parse the new MCP servers config
    let new_mcp_servers: serde_json::Value = serde_json::from_str(mcp_servers_json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    // Read existing settings or create new
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    // Update the mcpServers key
    if let serde_json::Value::Object(ref mut obj) = settings {
        obj.insert("mcpServers".to_string(), new_mcp_servers);
    }

    // Write back
    let formatted = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, formatted).map_err(|e| e.to_string())?;

    Ok(())
}

/// Add a single MCP server to settings.json
pub fn add_mcp_server(name: &str, config_json: &str) -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");

    // Parse the server config
    let server_config: serde_json::Value = serde_json::from_str(config_json)
        .map_err(|e| format!("Invalid JSON: {}", e))?;

    // Read existing settings or create new
    let mut settings: serde_json::Value = if settings_path.exists() {
        let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    // Ensure mcpServers exists
    if !settings.get("mcpServers").is_some() {
        if let serde_json::Value::Object(ref mut obj) = settings {
            obj.insert("mcpServers".to_string(), serde_json::json!({}));
        }
    }

    // Add the server
    if let Some(serde_json::Value::Object(ref mut mcp_servers)) = settings.get_mut("mcpServers") {
        mcp_servers.insert(name.to_string(), server_config);
    }

    // Write back
    let formatted = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, formatted).map_err(|e| e.to_string())?;

    Ok(())
}

/// Remove an MCP server from settings.json
pub fn remove_mcp_server(name: &str) -> Result<(), String> {
    let settings_path = get_claude_dir().join("settings.json");

    if !settings_path.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&settings_path).map_err(|e| e.to_string())?;
    let mut settings: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Remove the server
    if let Some(serde_json::Value::Object(ref mut mcp_servers)) = settings.get_mut("mcpServers") {
        mcp_servers.remove(name);
    }

    // Write back
    let formatted = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&settings_path, formatted).map_err(|e| e.to_string())?;

    Ok(())
}

// ============ Projects ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub path: String,
    pub name: String,
    #[serde(rename = "lastCost")]
    pub last_cost: f64,
    #[serde(rename = "lastSessionId")]
    pub last_session_id: Option<String>,
    #[serde(rename = "lastDuration")]
    pub last_duration: u64,
    #[serde(rename = "lastInputTokens")]
    pub last_input_tokens: u64,
    #[serde(rename = "lastOutputTokens")]
    pub last_output_tokens: u64,
    #[serde(rename = "hasClaude")]
    pub has_claude: bool,
    #[serde(rename = "mcpServerCount")]
    pub mcp_server_count: usize,
    #[serde(rename = "lastUsed")]
    pub last_used: Option<String>,
}

/// Encode a project path to folder name format
/// e.g., "/Users/foo/project" -> "-Users-foo-project"
/// Note: Claude Code just replaces "/" with "-", hyphens in paths become ambiguous
fn encode_path_to_folder(path: &str) -> String {
    path.replace('/', "-")
}

/// Get the last modified time of a project's JSONL folder as a quick proxy for "last used"
fn get_project_last_modified(project_path: &str) -> Option<String> {
    use chrono::{DateTime, Utc};

    let home = dirs::home_dir()?;
    let projects_dir = home.join(".claude").join("projects");

    // Encode the path to match folder name
    let encoded = project_path.replace('-', "--").replace('/', "-");
    let folder_path = projects_dir.join(&encoded[1..]); // Skip leading "-"

    // Get folder modification time
    let metadata = folder_path.metadata().ok()?;
    let modified = metadata.modified().ok()?;
    let datetime: DateTime<Utc> = modified.into();
    Some(datetime.to_rfc3339())
}

/// Calculate project totals from JSONL files
/// Returns HashMap with folder names as keys (e.g., "-Users-foo-project")
fn get_project_totals_from_jsonl() -> HashMap<String, (f64, u64, u64, Option<String>)> {
    use crate::types::RawLogEntry;
    use chrono::{DateTime, Utc};
    use std::collections::HashSet;
    use std::fs::File;
    use std::io::{BufRead, BufReader};

    let mut totals: HashMap<String, (f64, u64, u64, Option<String>)> = HashMap::new();
    let mut seen_uuids: HashSet<String> = HashSet::new();

    let home = dirs::home_dir().unwrap_or_default();
    let projects_dir = home.join(".claude").join("projects");

    if !projects_dir.exists() {
        return totals;
    }

    // Read project folders
    let folders = match fs::read_dir(&projects_dir) {
        Ok(f) => f,
        Err(_) => return totals,
    };

    for entry in folders.flatten() {
        let folder_path = entry.path();
        if !folder_path.is_dir() {
            continue;
        }

        // Use folder name as key (e.g., "-Users-foo-project")
        let folder_name = entry.file_name().to_string_lossy().to_string();

        // Find JSONL files in this folder
        let jsonl_files = match fs::read_dir(&folder_path) {
            Ok(f) => f,
            Err(_) => continue,
        };

        for file_entry in jsonl_files.flatten() {
            let file_path = file_entry.path();
            if file_path.extension().map_or(true, |e| e != "jsonl") {
                continue;
            }

            let file = match File::open(&file_path) {
                Ok(f) => f,
                Err(_) => continue,
            };

            let reader = BufReader::new(file);
            for line in reader.lines().flatten() {
                if line.trim().is_empty() {
                    continue;
                }

                let raw: RawLogEntry = match serde_json::from_str(&line) {
                    Ok(r) => r,
                    Err(_) => continue,
                };

                if raw.entry_type.as_deref() != Some("assistant") {
                    continue;
                }

                let message = match &raw.message {
                    Some(m) => m,
                    None => continue,
                };

                if message.role.as_deref() != Some("assistant") {
                    continue;
                }

                let usage = match &message.usage {
                    Some(u) => u,
                    None => continue,
                };

                let model = match &message.model {
                    Some(m) => m,
                    None => continue,
                };

                // Deduplicate by UUID
                if let Some(uuid) = &raw.uuid {
                    if !uuid.is_empty() {
                        if seen_uuids.contains(uuid) {
                            continue;
                        }
                        seen_uuids.insert(uuid.clone());
                    }
                }

                // Calculate cost using model pricing
                let model_lower = model.to_lowercase();
                let (input_rate, output_rate, cache_read_rate, cache_write_rate) = if model_lower.contains("opus") {
                    (15.0, 75.0, 1.50, 18.75)
                } else if model_lower.contains("sonnet") {
                    (3.0, 15.0, 0.30, 3.75)
                } else if model_lower.contains("haiku") {
                    (0.25, 1.25, 0.025, 0.30)
                } else {
                    (3.0, 15.0, 0.30, 3.75)
                };

                let per_million = 1_000_000.0;
                let input_tokens = usage.input_tokens.unwrap_or(0);
                let output_tokens = usage.output_tokens.unwrap_or(0);
                let cache_read = usage.cache_read_input_tokens.unwrap_or(0);
                let cache_write = usage.cache_creation_input_tokens.unwrap_or(0);

                let cost = (input_tokens as f64 / per_million) * input_rate
                    + (output_tokens as f64 / per_million) * output_rate
                    + (cache_read as f64 / per_million) * cache_read_rate
                    + (cache_write as f64 / per_million) * cache_write_rate;

                // Parse timestamp
                let timestamp_str = raw.timestamp.as_ref().and_then(|ts| {
                    DateTime::parse_from_rfc3339(ts)
                        .ok()
                        .map(|dt| dt.with_timezone(&Utc).to_rfc3339())
                });

                // Update totals using folder name as key
                let entry = totals.entry(folder_name.clone()).or_insert((0.0, 0, 0, None));
                entry.0 += cost;
                entry.1 += input_tokens;
                entry.2 += output_tokens;
                if let Some(ts) = &timestamp_str {
                    if entry.3.as_ref().map_or(true, |existing| ts > existing) {
                        entry.3 = Some(ts.clone());
                    }
                }
            }
        }
    }

    totals
}

/// List all known projects with total costs from JSONL
pub fn list_projects() -> Result<Vec<ProjectInfo>, String> {
    let claude_json = read_claude_json()?;
    let mut projects = Vec::new();

    // Get totals from JSONL files (keyed by folder name like "-Users-foo-project")
    let project_totals = get_project_totals_from_jsonl();

    if let Some(project_map) = claude_json.projects {
        for (path, config) in project_map {
            let name = PathBuf::from(&path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());

            let has_claude = PathBuf::from(&path).join("CLAUDE.md").exists();
            let mcp_count = config.mcp_servers.as_ref().map(|m| m.len()).unwrap_or(0);

            // Encode path to folder name for lookup (e.g., "/Users/foo" -> "-Users-foo")
            let folder_key = encode_path_to_folder(&path);

            // Get totals from JSONL, fall back to last session data
            let (total_cost, total_input, total_output, last_used) = project_totals
                .get(&folder_key)
                .cloned()
                .unwrap_or_else(|| {
                    (
                        config.last_cost.unwrap_or(0.0),
                        config.last_total_input_tokens.unwrap_or(0),
                        config.last_total_output_tokens.unwrap_or(0),
                        get_project_last_modified(&path),
                    )
                });

            projects.push(ProjectInfo {
                path: path.clone(),
                name,
                last_cost: total_cost,
                last_session_id: config.last_session_id,
                last_duration: config.last_duration.unwrap_or(0),
                last_input_tokens: total_input,
                last_output_tokens: total_output,
                has_claude,
                mcp_server_count: mcp_count,
                last_used,
            });
        }
    }

    // Sort by last used (most recent first)
    projects.sort_by(|a, b| {
        b.last_used.as_deref().unwrap_or("").cmp(a.last_used.as_deref().unwrap_or(""))
    });

    Ok(projects)
}

// ============ Project Details ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDetails {
    pub path: String,
    pub name: String,
    #[serde(rename = "claudeMdContent")]
    pub claude_md_content: Option<String>,
    pub commands: Vec<CommandInfo>,
    #[serde(rename = "mcpServers")]
    pub mcp_servers: Vec<McpServer>,
    #[serde(rename = "imageUrl")]
    pub image_url: Option<String>,
}

/// Get detailed information about a specific project
pub fn get_project_details(project_path: &str) -> Result<ProjectDetails, String> {
    let path = PathBuf::from(project_path);
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| project_path.to_string());

    // Get CLAUDE.md content if it exists
    let claude_md_path = path.join("CLAUDE.md");
    let claude_md_content = if claude_md_path.exists() {
        fs::read_to_string(&claude_md_path).ok()
    } else {
        None
    };

    // Get project-specific commands from project's .claude/commands/
    let commands = get_project_commands(project_path)?;

    // Get project-specific MCP servers
    let mcp_servers = get_project_mcp_servers(project_path)?;

    // Get project image if set
    let image_url = get_project_image(project_path);

    Ok(ProjectDetails {
        path: project_path.to_string(),
        name,
        claude_md_content,
        commands,
        mcp_servers,
        image_url,
    })
}

/// Get commands specific to a project (from project's .claude/commands/)
pub fn get_project_commands(project_path: &str) -> Result<Vec<CommandInfo>, String> {
    let commands_dir = PathBuf::from(project_path).join(".claude").join("commands");

    if !commands_dir.exists() {
        return Ok(Vec::new());
    }

    list_items_in_dir(&commands_dir).map(|items| {
        items.into_iter().map(|a| CommandInfo {
            name: a.name,
            path: a.path,
            description: a.description,
            is_directory: a.is_directory,
        }).collect()
    })
}

/// Get MCP servers configured for a specific project
pub fn get_project_mcp_servers(project_path: &str) -> Result<Vec<McpServer>, String> {
    let mut servers = Vec::new();

    // Check .claude.json for project-specific MCP servers
    let claude_json = read_claude_json()?;
    if let Some(projects) = claude_json.projects {
        if let Some(config) = projects.get(project_path) {
            if let Some(mcp_servers) = &config.mcp_servers {
                for (name, server_config) in mcp_servers {
                    let (server_type, command, url, args) = if let Some(cmd) = &server_config.command {
                        ("stdio", Some(cmd.clone()), None, server_config.args.clone())
                    } else if let Some(url) = &server_config.url {
                        ("sse", None, Some(url.clone()), None)
                    } else {
                        ("unknown", None, None, None)
                    };

                    servers.push(McpServer {
                        name: name.clone(),
                        server_type: server_type.to_string(),
                        command,
                        url,
                        args,
                        project_path: Some(project_path.to_string()),
                    });
                }
            }
        }
    }

    // Sort by name
    servers.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    Ok(servers)
}

/// Get the project image URL if one has been set
pub fn get_project_image(project_path: &str) -> Option<String> {
    // Look for image in project's .claude directory
    let claude_dir = PathBuf::from(project_path).join(".claude");

    // Check for common image extensions
    for ext in &["png", "jpg", "jpeg", "webp", "svg"] {
        let image_path = claude_dir.join(format!("project-image.{}", ext));
        if image_path.exists() {
            return Some(format!("file://{}", image_path.to_string_lossy()));
        }
    }

    // Also check for icon in project root
    for ext in &["png", "jpg", "jpeg", "webp", "svg", "ico"] {
        let image_path = PathBuf::from(project_path).join(format!("icon.{}", ext));
        if image_path.exists() {
            return Some(format!("file://{}", image_path.to_string_lossy()));
        }
    }

    None
}

/// Set a project image by copying it to the project's .claude directory
pub fn set_project_image(project_path: &str, image_source_path: &str) -> Result<String, String> {
    let source = PathBuf::from(image_source_path);
    if !source.exists() {
        return Err("Source image does not exist".to_string());
    }

    let ext = source
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_else(|| "png".to_string());

    // Create .claude directory if it doesn't exist
    let claude_dir = PathBuf::from(project_path).join(".claude");
    fs::create_dir_all(&claude_dir).map_err(|e| e.to_string())?;

    // Remove any existing project images
    for old_ext in &["png", "jpg", "jpeg", "webp", "svg"] {
        let old_path = claude_dir.join(format!("project-image.{}", old_ext));
        let _ = fs::remove_file(old_path);
    }

    // Copy the new image
    let dest = claude_dir.join(format!("project-image.{}", ext));
    fs::copy(&source, &dest).map_err(|e| e.to_string())?;

    Ok(format!("file://{}", dest.to_string_lossy()))
}

/// Remove a project's custom image
pub fn remove_project_image(project_path: &str) -> Result<(), String> {
    let claude_dir = PathBuf::from(project_path).join(".claude");

    for ext in &["png", "jpg", "jpeg", "webp", "svg"] {
        let image_path = claude_dir.join(format!("project-image.{}", ext));
        let _ = fs::remove_file(image_path);
    }

    Ok(())
}

// ============ Pattern Analysis ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatternAnalysis {
    #[serde(rename = "mostUsedTools")]
    pub most_used_tools: Vec<ToolUsage>,
    #[serde(rename = "commonPromptPatterns")]
    pub common_prompt_patterns: Vec<PromptPattern>,
    #[serde(rename = "tokenEfficiency")]
    pub token_efficiency: TokenEfficiency,
    #[serde(rename = "sessionStats")]
    pub session_stats: SessionStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolUsage {
    pub name: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptPattern {
    pub pattern: String,
    pub count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenEfficiency {
    #[serde(rename = "averageInputTokens")]
    pub average_input_tokens: f64,
    #[serde(rename = "averageOutputTokens")]
    pub average_output_tokens: f64,
    pub ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionStats {
    #[serde(rename = "totalSessions")]
    pub total_sessions: u64,
    #[serde(rename = "averageDuration")]
    pub average_duration: f64,
    #[serde(rename = "totalCost")]
    pub total_cost: f64,
}

/// Get model token costs for cost calculation
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
        TokenCosts::default()
    }
}

/// Analyze chat patterns from JSONL files
pub fn analyze_chat_patterns(days: u32) -> Result<PatternAnalysis, String> {
    let claude_projects_dir = get_claude_dir().join("projects");
    let pattern = claude_projects_dir.join("**").join("*.jsonl");
    let pattern_str = pattern.to_string_lossy();

    let files: Vec<PathBuf> = glob(&pattern_str)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .collect();

    // Calculate cutoff date
    let cutoff = Utc::now() - chrono::Duration::days(days as i64);

    // Aggregators
    let mut tool_counts: HashMap<String, u64> = HashMap::new();
    let mut session_data: HashMap<String, (DateTime<Utc>, DateTime<Utc>, f64)> = HashMap::new(); // session_id -> (first_ts, last_ts, cost)
    let mut total_input_tokens: u64 = 0;
    let mut total_output_tokens: u64 = 0;
    let mut message_count: u64 = 0;
    let mut seen_uuids: std::collections::HashSet<String> = std::collections::HashSet::new();

    for file_path in files {
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

            let raw: RawLogEntry = match serde_json::from_str(&line) {
                Ok(r) => r,
                Err(_) => continue,
            };

            // Parse timestamp
            let timestamp = match raw.timestamp.as_ref().and_then(|ts| {
                DateTime::parse_from_rfc3339(ts)
                    .ok()
                    .map(|dt| dt.with_timezone(&Utc))
            }) {
                Some(ts) => ts,
                None => continue,
            };

            // Skip entries outside the date range
            if timestamp < cutoff {
                continue;
            }

            // Deduplicate by UUID
            if let Some(uuid) = &raw.uuid {
                if !uuid.is_empty() {
                    if seen_uuids.contains(uuid) {
                        continue;
                    }
                    seen_uuids.insert(uuid.clone());
                }
            }

            // Process assistant messages
            if raw.entry_type.as_deref() == Some("assistant") {
                if let Some(ref message) = raw.message {
                    if message.role.as_deref() == Some("assistant") {
                        // Extract tool usage from content blocks
                        if let Some(ref content) = message.content {
                            for block in content {
                                if let ContentBlock::ToolUse { name, .. } = block {
                                    if let Some(tool_name) = name {
                                        *tool_counts.entry(tool_name.clone()).or_insert(0) += 1;
                                    }
                                }
                            }
                        }

                        // Calculate tokens and cost
                        if let Some(ref usage) = message.usage {
                            let input = usage.input_tokens.unwrap_or(0);
                            let output = usage.output_tokens.unwrap_or(0);
                            let cache_read = usage.cache_read_input_tokens.unwrap_or(0);
                            let cache_write = usage.cache_creation_input_tokens.unwrap_or(0);

                            total_input_tokens += input;
                            total_output_tokens += output;
                            message_count += 1;

                            // Calculate cost
                            let model = message.model.as_deref().unwrap_or("claude-sonnet-4");
                            let costs = get_model_costs(model);
                            let per_million = 1_000_000.0;
                            let entry_cost =
                                (input as f64 / per_million) * costs.input +
                                (output as f64 / per_million) * costs.output +
                                (cache_read as f64 / per_million) * costs.cache_read +
                                (cache_write as f64 / per_million) * costs.cache_write;

                            // Track session data
                            if let Some(ref session_id) = raw.session_id {
                                let entry = session_data.entry(session_id.clone()).or_insert((timestamp, timestamp, 0.0));
                                // Update first/last timestamps
                                if timestamp < entry.0 {
                                    entry.0 = timestamp;
                                }
                                if timestamp > entry.1 {
                                    entry.1 = timestamp;
                                }
                                entry.2 += entry_cost;
                            }
                        }
                    }
                }
            }
        }
    }

    // Build tool usage list (sorted by count, top 10)
    let mut tool_list: Vec<(String, u64)> = tool_counts.into_iter().collect();
    tool_list.sort_by(|a, b| b.1.cmp(&a.1));
    let most_used_tools: Vec<ToolUsage> = tool_list
        .into_iter()
        .take(10)
        .map(|(name, count)| ToolUsage { name, count })
        .collect();

    // Calculate session stats
    let total_sessions = session_data.len() as u64;
    let total_cost: f64 = session_data.values().map(|(_, _, cost)| cost).sum();
    let total_duration_ms: f64 = session_data.values()
        .map(|(first, last, _)| (*last - *first).num_milliseconds() as f64)
        .sum();
    let average_duration = if total_sessions > 0 {
        total_duration_ms / total_sessions as f64
    } else {
        0.0
    };

    // Calculate token efficiency
    let average_input_tokens = if message_count > 0 {
        total_input_tokens as f64 / message_count as f64
    } else {
        0.0
    };
    let average_output_tokens = if message_count > 0 {
        total_output_tokens as f64 / message_count as f64
    } else {
        0.0
    };
    let ratio = if average_output_tokens > 0.0 {
        average_input_tokens / average_output_tokens
    } else {
        0.0
    };

    // Prompt patterns - for now, generate based on tool usage patterns
    // This could be extended to actually analyze user prompts
    let common_prompt_patterns = vec![
        PromptPattern { pattern: "Code editing tasks".to_string(), count: tool_list_count(&most_used_tools, &["Edit", "Write", "MultiEdit"]) },
        PromptPattern { pattern: "Code navigation".to_string(), count: tool_list_count(&most_used_tools, &["Read", "Grep", "Glob"]) },
        PromptPattern { pattern: "Shell commands".to_string(), count: tool_list_count(&most_used_tools, &["Bash"]) },
    ];

    Ok(PatternAnalysis {
        most_used_tools,
        common_prompt_patterns,
        token_efficiency: TokenEfficiency {
            average_input_tokens,
            average_output_tokens,
            ratio,
        },
        session_stats: SessionStats {
            total_sessions,
            average_duration,
            total_cost,
        },
    })
}

/// Helper to count tools matching given names
fn tool_list_count(tools: &[ToolUsage], names: &[&str]) -> u64 {
    tools.iter()
        .filter(|t| names.iter().any(|n| t.name.contains(n)))
        .map(|t| t.count)
        .sum()
}

// ============ AI Suggestions ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSuggestion {
    #[serde(rename = "type")]
    pub suggestion_type: String,
    pub title: String,
    pub description: String,
    pub content: Option<String>,
}

/// Generate suggestions based on actual usage patterns
pub fn get_ai_suggestions(days: u32) -> Result<Vec<AiSuggestion>, String> {
    let mut suggestions = Vec::new();

    // Get pattern analysis for data-driven suggestions
    let patterns = analyze_chat_patterns(days)?;

    // Suggestion 1: High token ratio - suggest being more concise
    if patterns.token_efficiency.ratio > 5.0 {
        suggestions.push(AiSuggestion {
            suggestion_type: "optimization".to_string(),
            title: "Optimize Input Context".to_string(),
            description: format!(
                "Your input/output token ratio is {:.1}x. Consider using more focused prompts or CLAUDE.md files to reduce repeated context.",
                patterns.token_efficiency.ratio
            ),
            content: None,
        });
    }

    // Suggestion 2: Heavy Read/Grep usage - suggest codebase indexing
    let read_grep_count: u64 = patterns.most_used_tools.iter()
        .filter(|t| t.name == "Read" || t.name == "Grep" || t.name == "Glob")
        .map(|t| t.count)
        .sum();

    if read_grep_count > 500 {
        suggestions.push(AiSuggestion {
            suggestion_type: "agent".to_string(),
            title: "Create Codebase Navigator Agent".to_string(),
            description: format!(
                "You've used file search tools {} times. Consider creating a codebase-aware agent with pre-indexed knowledge.",
                read_grep_count
            ),
            content: Some("# Codebase Navigator Agent\n\nYou are an expert at navigating this specific codebase. You have deep knowledge of:\n- Project structure and file organization\n- Key modules and their responsibilities\n- Common patterns used in the code\n\nWhen asked to find code, start with the most likely locations based on naming conventions.".to_string()),
        });
    }

    // Suggestion 3: Heavy Bash usage - suggest shell commands
    let bash_count: u64 = patterns.most_used_tools.iter()
        .filter(|t| t.name == "Bash")
        .map(|t| t.count)
        .sum();

    if bash_count > 200 {
        suggestions.push(AiSuggestion {
            suggestion_type: "command".to_string(),
            title: "Create Custom Slash Commands".to_string(),
            description: format!(
                "You've run {} shell commands. Consider creating slash commands for common operations like /build, /test, /deploy.",
                bash_count
            ),
            content: Some("# Build Command\n\nRun the project build process and report any errors.\n\n## Steps\n1. Run the build command for this project\n2. If errors occur, analyze and suggest fixes\n3. Report build status".to_string()),
        });
    }

    // Suggestion 4: Long average session duration - suggest breaks
    let avg_duration_mins = patterns.session_stats.average_duration / 60000.0;
    if avg_duration_mins > 60.0 {
        suggestions.push(AiSuggestion {
            suggestion_type: "workflow".to_string(),
            title: "Consider Shorter Sessions".to_string(),
            description: format!(
                "Your average session is {:.0} minutes. Breaking tasks into smaller chunks can improve focus and reduce context overflow.",
                avg_duration_mins
            ),
            content: None,
        });
    }

    // Suggestion 5: High Edit/Write usage - suggest code review agent
    let edit_count: u64 = patterns.most_used_tools.iter()
        .filter(|t| t.name == "Edit" || t.name == "Write" || t.name == "MultiEdit")
        .map(|t| t.count)
        .sum();

    if edit_count > 300 {
        suggestions.push(AiSuggestion {
            suggestion_type: "agent".to_string(),
            title: "Create Code Review Agent".to_string(),
            description: format!(
                "You've made {} code edits. A code review agent can help catch issues before they're committed.",
                edit_count
            ),
            content: Some("# Code Review Agent\n\nYou are an expert code reviewer. When reviewing changes:\n\n1. Check for bugs, edge cases, and error handling\n2. Verify code follows project conventions\n3. Look for security issues\n4. Suggest performance improvements\n5. Ensure proper test coverage\n\nBe constructive and specific in your feedback.".to_string()),
        });
    }

    // Suggestion 6: High cost - suggest model optimization
    if patterns.session_stats.total_cost > 100.0 {
        suggestions.push(AiSuggestion {
            suggestion_type: "optimization".to_string(),
            title: "Optimize Model Usage".to_string(),
            description: format!(
                "You've spent ${:.2} in the last {} days. Consider using Haiku for simple tasks and Sonnet for complex ones to reduce costs.",
                patterns.session_stats.total_cost,
                days
            ),
            content: None,
        });
    }

    // Suggestion 7: Many sessions - suggest workflow improvements
    if patterns.session_stats.total_sessions > 50 {
        suggestions.push(AiSuggestion {
            suggestion_type: "workflow".to_string(),
            title: "Streamline Your Workflow".to_string(),
            description: format!(
                "You've had {} sessions in {} days. Consider using /compact to summarize context or creating project-specific CLAUDE.md files.",
                patterns.session_stats.total_sessions,
                days
            ),
            content: None,
        });
    }

    // If no specific suggestions, provide a general one
    if suggestions.is_empty() {
        suggestions.push(AiSuggestion {
            suggestion_type: "info".to_string(),
            title: "Usage Looks Good".to_string(),
            description: "Your Claude Code usage patterns look efficient. Keep up the good work!".to_string(),
            content: None,
        });
    }

    // Limit to top 5 suggestions
    suggestions.truncate(5);

    Ok(suggestions)
}

/// Project-specific suggestion from Claude CLI
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSuggestion {
    pub suggestion: String,
    pub project_path: String,
}

/// Get project-specific suggestions by invoking Claude CLI
pub async fn get_project_suggestions(project_path: &str) -> Result<ProjectSuggestion, String> {
    use std::process::Command;

    // Check if the project directory exists
    let path = Path::new(project_path);
    if !path.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }

    // Build the prompt for Claude
    let prompt = format!(
        "You are analyzing a software project. Based on the project structure and any CLAUDE.md file, \
        provide 3-5 specific, actionable suggestions to improve the developer's workflow with Claude Code. \
        Focus on:\n\
        1. Custom agents that would help with common tasks in this project\n\
        2. Slash commands for repetitive operations\n\
        3. CLAUDE.md improvements for better context\n\
        4. MCP server recommendations\n\n\
        Keep each suggestion brief (1-2 sentences). Format as a numbered list.\n\n\
        Project path: {}",
        project_path
    );

    // Run claude CLI with --print flag for non-interactive output
    let output = Command::new("claude")
        .args([
            "--print",
            "-p", &prompt,
        ])
        .current_dir(project_path)
        .output()
        .map_err(|e| format!("Failed to run claude CLI: {}. Make sure Claude Code is installed.", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI failed: {}", stderr));
    }

    let suggestion = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if suggestion.is_empty() {
        return Err("Claude CLI returned empty response".to_string());
    }

    Ok(ProjectSuggestion {
        suggestion,
        project_path: project_path.to_string(),
    })
}

/// Run Claude Code with a specific prompt in a project directory
/// Copies the prompt to clipboard and opens Terminal in the project directory
pub fn run_claude_with_prompt(project_path: &str, prompt: &str) -> Result<String, String> {
    use std::process::Command;
    use std::io::Write;

    // Check if the project directory exists
    let path = Path::new(project_path);
    if !path.exists() {
        return Err(format!("Project path does not exist: {}", project_path));
    }

    #[cfg(target_os = "macos")]
    {
        // Copy prompt to clipboard using pbcopy
        let mut pbcopy = Command::new("pbcopy")
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;

        if let Some(stdin) = pbcopy.stdin.as_mut() {
            stdin.write_all(prompt.as_bytes())
                .map_err(|e| format!("Failed to write to clipboard: {}", e))?;
        }
        pbcopy.wait().map_err(|e| format!("Clipboard error: {}", e))?;

        // Open Terminal in the project directory
        let script = format!(
            r#"tell application "Terminal"
    activate
    do script "cd '{}' && echo 'Prompt copied! Run: claude' && echo 'Then paste the prompt (Cmd+V)'"
end tell"#,
            project_path.replace("'", "'\\''")
        );

        Command::new("osascript")
            .args(["-e", &script])
            .spawn()
            .map_err(|e| format!("Failed to open Terminal: {}", e))?;

        return Ok("Prompt copied! Run 'claude' and paste.".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        // Copy to clipboard using clip
        let mut clip = Command::new("cmd")
            .args(["/c", "clip"])
            .stdin(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to copy to clipboard: {}", e))?;

        if let Some(stdin) = clip.stdin.as_mut() {
            stdin.write_all(prompt.as_bytes())
                .map_err(|e| format!("Failed to write to clipboard: {}", e))?;
        }
        clip.wait().map_err(|e| format!("Clipboard error: {}", e))?;

        // Open cmd in project directory
        Command::new("cmd")
            .args(["/c", "start", "cmd", "/k", &format!("cd /d \"{}\" && echo Prompt copied! Run: claude && echo Then paste the prompt (Ctrl+V)", project_path)])
            .spawn()
            .map_err(|e| format!("Failed to open terminal: {}", e))?;

        return Ok("Prompt copied! Run 'claude' and paste.".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        // Try xclip or xsel for clipboard
        let clipboard_result = Command::new("xclip")
            .args(["-selection", "clipboard"])
            .stdin(std::process::Stdio::piped())
            .spawn();

        if let Ok(mut xclip) = clipboard_result {
            if let Some(stdin) = xclip.stdin.as_mut() {
                let _ = stdin.write_all(prompt.as_bytes());
            }
            let _ = xclip.wait();
        }

        // Try gnome-terminal first, then xterm
        let result = Command::new("gnome-terminal")
            .args(["--working-directory", project_path])
            .spawn();

        if result.is_err() {
            let cmd = format!("cd '{}' && echo 'Prompt copied! Run: claude' && echo 'Then paste (Ctrl+Shift+V)' && bash", project_path.replace("'", "'\\''"));
            Command::new("xterm")
                .args(["-e", "bash", "-c", &cmd])
                .spawn()
                .map_err(|e| format!("Failed to open terminal: {}", e))?;
        }

        return Ok("Prompt copied! Run 'claude' and paste.".to_string());
    }

    #[allow(unreachable_code)]
    Ok("Terminal opened.".to_string())
}

// ============ Backup & Export ============

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportOptions {
    #[serde(rename = "includeGlobalClaude")]
    pub include_global_claude: bool,
    #[serde(rename = "includeProjectClaude")]
    pub include_project_claude: bool,
    #[serde(rename = "includeAgents")]
    pub include_agents: bool,
    #[serde(rename = "includeCommands")]
    pub include_commands: bool,
    #[serde(rename = "includeSettings")]
    pub include_settings: bool,
    #[serde(rename = "includePluginConfig")]
    pub include_plugin_config: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub path: String,
    pub size: u64,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

/// Export configuration to a ZIP file
pub fn export_config(_options: ExportOptions, output_path: &str) -> Result<BackupInfo, String> {
    // This would create a ZIP archive with the selected items
    // For now, return placeholder
    Ok(BackupInfo {
        path: output_path.to_string(),
        size: 1024 * 50, // 50KB placeholder
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Import configuration from a ZIP file
pub fn import_config(_zip_path: &str) -> Result<(), String> {
    // This would extract and apply the configuration
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    #[serde(rename = "isGitRepo")]
    pub is_git_repo: bool,
    #[serde(rename = "hasChanges")]
    pub has_changes: bool,
    pub branch: String,
    #[serde(rename = "uncommittedFiles")]
    pub uncommitted_files: Vec<String>,
}

/// Check git status of ~/.claude directory
pub fn get_config_git_status() -> Result<GitStatus, String> {
    let claude_dir = get_claude_dir();
    let git_dir = claude_dir.join(".git");

    if !git_dir.exists() {
        return Ok(GitStatus {
            is_git_repo: false,
            has_changes: false,
            branch: String::new(),
            uncommitted_files: Vec::new(),
        });
    }

    // This would run git commands to check status
    // For now, return basic info
    Ok(GitStatus {
        is_git_repo: true,
        has_changes: false,
        branch: "main".to_string(),
        uncommitted_files: Vec::new(),
    })
}

// ============ Helper Functions ============

#[derive(Debug, Clone, Deserialize)]
struct ClaudeJson {
    projects: Option<HashMap<String, ProjectConfig>>,
}

#[derive(Debug, Clone, Deserialize)]
struct ProjectConfig {
    #[serde(rename = "lastCost")]
    last_cost: Option<f64>,
    #[serde(rename = "lastSessionId")]
    last_session_id: Option<String>,
    #[serde(rename = "lastDuration")]
    last_duration: Option<u64>,
    #[serde(rename = "lastTotalInputTokens")]
    last_total_input_tokens: Option<u64>,
    #[serde(rename = "lastTotalOutputTokens")]
    last_total_output_tokens: Option<u64>,
    #[serde(rename = "mcpServers")]
    mcp_servers: Option<HashMap<String, McpServerConfig>>,
}

#[derive(Debug, Clone, Deserialize)]
struct McpServerConfig {
    #[serde(rename = "type")]
    server_type: Option<String>,
    command: Option<String>,
    url: Option<String>,
    args: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
struct SettingsJson {
    #[serde(rename = "enabledPlugins")]
    enabled_plugins: Option<HashMap<String, bool>>,
}

fn read_claude_json() -> Result<ClaudeJson, String> {
    let path = get_claude_json_path();
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn read_settings_json() -> Option<SettingsJson> {
    let path = get_claude_dir().join("settings.json");
    fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
}

/// Open a file in the default text editor
pub fn open_in_editor(path: &str) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "macos")]
    {
        // Try VS Code first, then fall back to `open -t` (default text editor)
        let vscode_result = Command::new("code")
            .arg(path)
            .spawn();

        if vscode_result.is_ok() {
            return Ok(());
        }

        // Fall back to macOS default text editor
        Command::new("open")
            .arg("-t")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        // Try VS Code first, then fall back to notepad
        let vscode_result = Command::new("code")
            .arg(path)
            .spawn();

        if vscode_result.is_ok() {
            return Ok(());
        }

        Command::new("notepad")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        // Try VS Code first, then xdg-open
        let vscode_result = Command::new("code")
            .arg(path)
            .spawn();

        if vscode_result.is_ok() {
            return Ok(());
        }

        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}

/// Open a folder in the system file manager
pub fn open_folder(path: &str) -> Result<(), String> {
    use std::process::Command;

    // Expand ~ in path
    let expanded_path = expand_tilde(path);
    let path_obj = Path::new(&expanded_path);

    // Get the directory (if path is a file, get its parent)
    let dir_path = if path_obj.is_file() {
        path_obj.parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or(expanded_path.clone())
    } else {
        expanded_path.clone()
    };

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&dir_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&dir_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&dir_path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {}", e))?;
    }

    Ok(())
}
