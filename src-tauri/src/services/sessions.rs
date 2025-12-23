use crate::types::{ConversationMessage, MessageContentBlock, SessionConversation, SessionInfo, SessionSearchResult};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

/// Get the Claude projects directory
fn get_claude_projects_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("projects"))
}

/// Encode a project path to its folder name (same logic as usage.rs)
fn encode_path_to_folder(path: &str) -> String {
    path.replace('/', "-")
}

/// Get the project folder path for a given project path
fn get_project_folder(project_path: &str) -> Option<PathBuf> {
    let projects_dir = get_claude_projects_dir()?;
    let folder_name = encode_path_to_folder(project_path);
    let folder_path = projects_dir.join(&folder_name);

    if folder_path.exists() {
        Some(folder_path)
    } else {
        None
    }
}

use super::pricing;

/// List all sessions for a project
pub fn list_sessions(project_path: &str) -> Result<Vec<SessionInfo>, String> {
    let folder = get_project_folder(project_path)
        .ok_or_else(|| format!("Project folder not found for: {}", project_path))?;

    let mut sessions: Vec<SessionInfo> = Vec::new();

    // Find all .jsonl files in the folder
    let entries = std::fs::read_dir(&folder)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().map(|e| e == "jsonl").unwrap_or(false) {
            if let Some(session_id) = path.file_stem().and_then(|s| s.to_str()) {
                // Skip if it's a directory with same name
                if path.is_file() {
                    if let Ok(info) = parse_session_info(&path, session_id) {
                        sessions.push(info);
                    }
                }
            }
        }
    }

    // Sort by last message time (newest first)
    sessions.sort_by(|a, b| {
        let a_time = a.last_message_at.as_deref().unwrap_or("");
        let b_time = b.last_message_at.as_deref().unwrap_or("");
        b_time.cmp(a_time)
    });

    Ok(sessions)
}

/// Parse session info from a JSONL file
fn parse_session_info(path: &PathBuf, session_id: &str) -> Result<SessionInfo, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);

    let mut summary: Option<String> = None;
    let mut first_user_message: Option<String> = None;
    let mut first_message_at: Option<String> = None;
    let mut last_message_at: Option<String> = None;
    let mut message_count: u32 = 0;
    let mut total_input_tokens: u64 = 0;
    let mut total_output_tokens: u64 = 0;
    let mut total_cache_creation_tokens: u64 = 0;
    let mut total_cache_read_tokens: u64 = 0;
    let mut model: Option<String> = None;

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.trim().is_empty() {
            continue;
        }

        let entry: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let entry_type = entry.get("type").and_then(|t| t.as_str());

        match entry_type {
            Some("summary") => {
                if let Some(s) = entry.get("summary").and_then(|s| s.as_str()) {
                    summary = Some(s.to_string());
                }
            }
            Some("user") => {
                message_count += 1;

                if let Some(ts) = entry.get("timestamp").and_then(|t| t.as_str()) {
                    if first_message_at.is_none() {
                        first_message_at = Some(ts.to_string());
                    }
                    last_message_at = Some(ts.to_string());
                }

                // Capture first user message content as fallback title
                if first_user_message.is_none() {
                    if let Some(msg) = entry.get("message") {
                        if let Some(content_str) = msg.get("content").and_then(|c| c.as_str()) {
                            // Truncate to reasonable length for title
                            let truncated = if content_str.len() > 100 {
                                format!("{}...", &content_str[..100])
                            } else {
                                content_str.to_string()
                            };
                            first_user_message = Some(truncated);
                        } else if let Some(content_arr) = msg.get("content").and_then(|c| c.as_array()) {
                            // Look for first text block
                            for block in content_arr {
                                if block.get("type").and_then(|t| t.as_str()) == Some("text") {
                                    if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                                        let truncated = if text.len() > 100 {
                                            format!("{}...", &text[..100])
                                        } else {
                                            text.to_string()
                                        };
                                        first_user_message = Some(truncated);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Some("assistant") => {
                message_count += 1;

                if let Some(ts) = entry.get("timestamp").and_then(|t| t.as_str()) {
                    if first_message_at.is_none() {
                        first_message_at = Some(ts.to_string());
                    }
                    last_message_at = Some(ts.to_string());
                }

                if let Some(msg) = entry.get("message") {
                    if let Some(m) = msg.get("model").and_then(|m| m.as_str()) {
                        model = Some(m.to_string());
                    }

                    if let Some(usage) = msg.get("usage") {
                        if let Some(input) = usage.get("input_tokens").and_then(|t| t.as_u64()) {
                            total_input_tokens += input;
                        }
                        if let Some(output) = usage.get("output_tokens").and_then(|t| t.as_u64()) {
                            total_output_tokens += output;
                        }
                        if let Some(cache_creation) = usage
                            .get("cache_creation_input_tokens")
                            .and_then(|t| t.as_u64())
                        {
                            total_cache_creation_tokens += cache_creation;
                        }
                        if let Some(cache_read) = usage
                            .get("cache_read_input_tokens")
                            .and_then(|t| t.as_u64())
                        {
                            total_cache_read_tokens += cache_read;
                        }
                    }
                }
            }
            _ => {}
        }
    }

    let total_cost = model
        .as_deref()
        .map(|m| {
            pricing::calculate_cost(
                m,
                total_input_tokens,
                total_output_tokens,
                total_cache_creation_tokens,
                total_cache_read_tokens,
            )
        })
        .unwrap_or(0.0);

    Ok(SessionInfo {
        session_id: session_id.to_string(),
        summary,
        first_user_message,
        first_message_at,
        last_message_at,
        message_count,
        total_input_tokens,
        total_output_tokens,
        total_cache_creation_tokens,
        total_cache_read_tokens,
        total_cost,
        model,
    })
}

/// Get the full conversation for a session
pub fn get_session_conversation(project_path: &str, session_id: &str) -> Result<SessionConversation, String> {
    let folder = get_project_folder(project_path)
        .ok_or_else(|| format!("Project folder not found for: {}", project_path))?;

    let file_path = folder.join(format!("{}.jsonl", session_id));
    if !file_path.exists() {
        return Err(format!("Session file not found: {}", session_id));
    }

    let file = File::open(&file_path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);

    let mut summary: Option<String> = None;
    let mut messages: Vec<ConversationMessage> = Vec::new();

    // Track message UUIDs to deduplicate (assistant messages come in multiple chunks)
    let mut seen_uuids: HashMap<String, usize> = HashMap::new();

    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };

        if line.trim().is_empty() {
            continue;
        }

        let entry: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let entry_type = entry.get("type").and_then(|t| t.as_str());

        match entry_type {
            Some("summary") => {
                if let Some(s) = entry.get("summary").and_then(|s| s.as_str()) {
                    summary = Some(s.to_string());
                }
            }
            Some("user") => {
                let uuid = entry.get("uuid")
                    .and_then(|u| u.as_str())
                    .unwrap_or("")
                    .to_string();

                let timestamp = entry.get("timestamp")
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string());

                let content = if let Some(msg) = entry.get("message") {
                    if let Some(content_str) = msg.get("content").and_then(|c| c.as_str()) {
                        vec![MessageContentBlock::Text { text: content_str.to_string() }]
                    } else if let Some(content_arr) = msg.get("content").and_then(|c| c.as_array()) {
                        parse_content_blocks(content_arr)
                    } else {
                        vec![]
                    }
                } else {
                    vec![]
                };

                if !uuid.is_empty() && !content.is_empty() {
                    messages.push(ConversationMessage {
                        uuid,
                        role: "user".to_string(),
                        timestamp,
                        content,
                        model: None,
                        input_tokens: None,
                        output_tokens: None,
                    });
                }
            }
            Some("assistant") => {
                let uuid = entry.get("uuid")
                    .and_then(|u| u.as_str())
                    .unwrap_or("")
                    .to_string();

                let timestamp = entry.get("timestamp")
                    .and_then(|t| t.as_str())
                    .map(|s| s.to_string());

                let msg = entry.get("message");

                let model = msg.and_then(|m| m.get("model"))
                    .and_then(|m| m.as_str())
                    .map(|s| s.to_string());

                let (input_tokens, output_tokens) = if let Some(usage) = msg.and_then(|m| m.get("usage")) {
                    (
                        usage.get("input_tokens").and_then(|t| t.as_u64()),
                        usage.get("output_tokens").and_then(|t| t.as_u64()),
                    )
                } else {
                    (None, None)
                };

                let content = if let Some(m) = msg {
                    if let Some(content_arr) = m.get("content").and_then(|c| c.as_array()) {
                        parse_content_blocks(content_arr)
                    } else {
                        vec![]
                    }
                } else {
                    vec![]
                };

                if uuid.is_empty() {
                    continue;
                }

                // Check if we've seen this UUID before (assistant messages can have multiple chunks)
                if let Some(&idx) = seen_uuids.get(&uuid) {
                    // Merge content blocks into existing message
                    if let Some(existing) = messages.get_mut(idx) {
                        for block in content {
                            // Only add if not already present
                            if !existing.content.iter().any(|b| blocks_equal(b, &block)) {
                                existing.content.push(block);
                            }
                        }
                        // Update tokens if present
                        if input_tokens.is_some() {
                            existing.input_tokens = input_tokens;
                        }
                        if output_tokens.is_some() {
                            existing.output_tokens = output_tokens;
                        }
                    }
                } else if !content.is_empty() {
                    let idx = messages.len();
                    seen_uuids.insert(uuid.clone(), idx);
                    messages.push(ConversationMessage {
                        uuid,
                        role: "assistant".to_string(),
                        timestamp,
                        content,
                        model,
                        input_tokens,
                        output_tokens,
                    });
                }
            }
            _ => {}
        }
    }

    Ok(SessionConversation {
        session_id: session_id.to_string(),
        summary,
        messages,
    })
}

/// Parse content blocks from JSON array
fn parse_content_blocks(arr: &[serde_json::Value]) -> Vec<MessageContentBlock> {
    arr.iter().filter_map(|block| {
        let block_type = block.get("type").and_then(|t| t.as_str())?;

        match block_type {
            "text" => {
                let text = block.get("text").and_then(|t| t.as_str())?.to_string();
                Some(MessageContentBlock::Text { text })
            }
            "thinking" => {
                let thinking = block.get("thinking").and_then(|t| t.as_str())?.to_string();
                Some(MessageContentBlock::Thinking { thinking })
            }
            "tool_use" => {
                let id = block.get("id").and_then(|i| i.as_str()).map(|s| s.to_string());
                let name = block.get("name").and_then(|n| n.as_str()).map(|s| s.to_string());
                let input = block.get("input").cloned();
                Some(MessageContentBlock::ToolUse { id, name, input })
            }
            "tool_result" => {
                let tool_use_id = block.get("tool_use_id").and_then(|i| i.as_str()).map(|s| s.to_string());
                let content = block.get("content").cloned();
                Some(MessageContentBlock::ToolResult { tool_use_id, content })
            }
            _ => None,
        }
    }).collect()
}

/// Check if two content blocks are equal (for deduplication)
fn blocks_equal(a: &MessageContentBlock, b: &MessageContentBlock) -> bool {
    match (a, b) {
        (MessageContentBlock::Text { text: a }, MessageContentBlock::Text { text: b }) => a == b,
        (MessageContentBlock::Thinking { thinking: a }, MessageContentBlock::Thinking { thinking: b }) => a == b,
        (MessageContentBlock::ToolUse { id: a_id, .. }, MessageContentBlock::ToolUse { id: b_id, .. }) => a_id == b_id,
        (MessageContentBlock::ToolResult { tool_use_id: a_id, .. }, MessageContentBlock::ToolResult { tool_use_id: b_id, .. }) => a_id == b_id,
        _ => false,
    }
}

/// Export a session to HTML format
pub fn export_session_html(project_path: &str, session_id: &str) -> Result<String, String> {
    let conversation = get_session_conversation(project_path, session_id)?;

    let mut html = String::new();
    html.push_str(r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Code Session - "#);
    html.push_str(&conversation.summary.clone().unwrap_or_else(|| session_id.to_string()));
    html.push_str(r#"</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #18181b; color: #fafafa; line-height: 1.6; padding: 2rem; }
        .container { max-width: 900px; margin: 0 auto; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #a1a1aa; }
        .summary { font-size: 1.1rem; color: #71717a; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid #27272a; }
        .message { margin-bottom: 1.5rem; padding: 1rem; border-radius: 0.5rem; }
        .user { background: #27272a; border-left: 3px solid #3b82f6; }
        .assistant { background: #1f1f23; border-left: 3px solid #10b981; }
        .role { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.5rem; }
        .user .role { color: #3b82f6; }
        .assistant .role { color: #10b981; }
        .content { white-space: pre-wrap; }
        .thinking { background: #292524; padding: 0.75rem; border-radius: 0.25rem; margin: 0.5rem 0; font-size: 0.9rem; color: #a8a29e; border-left: 2px solid #78716c; }
        .thinking-label { font-size: 0.7rem; color: #78716c; margin-bottom: 0.25rem; }
        .tool-use { background: #1e1b4b; padding: 0.75rem; border-radius: 0.25rem; margin: 0.5rem 0; font-size: 0.85rem; border-left: 2px solid #6366f1; }
        .tool-name { color: #818cf8; font-weight: 600; }
        .timestamp { font-size: 0.7rem; color: #52525b; float: right; }
        .tokens { font-size: 0.7rem; color: #52525b; margin-top: 0.5rem; }
        code { background: #27272a; padding: 0.1rem 0.3rem; border-radius: 0.2rem; font-family: 'SF Mono', Monaco, monospace; font-size: 0.9em; }
        pre { background: #27272a; padding: 1rem; border-radius: 0.25rem; overflow-x: auto; margin: 0.5rem 0; }
        pre code { background: none; padding: 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Claude Code Session</h1>
        <div class="summary">"#);

    html.push_str(&html_escape(&conversation.summary.unwrap_or_else(|| "No summary".to_string())));
    html.push_str(r#"</div>"#);

    for msg in &conversation.messages {
        let role_class = if msg.role == "user" { "user" } else { "assistant" };
        html.push_str(&format!(r#"
        <div class="message {}">
            <div class="role">{}"#, role_class, msg.role));

        if let Some(ts) = &msg.timestamp {
            html.push_str(&format!(r#"<span class="timestamp">{}</span>"#, ts));
        }

        html.push_str(r#"</div>
            <div class="content">"#);

        for block in &msg.content {
            match block {
                MessageContentBlock::Text { text } => {
                    html.push_str(&html_escape(text));
                }
                MessageContentBlock::Thinking { thinking } => {
                    html.push_str(r#"<div class="thinking"><div class="thinking-label">Thinking</div>"#);
                    html.push_str(&html_escape(thinking));
                    html.push_str(r#"</div>"#);
                }
                MessageContentBlock::ToolUse { name, input, .. } => {
                    html.push_str(r#"<div class="tool-use"><span class="tool-name">"#);
                    html.push_str(&name.clone().unwrap_or_else(|| "Unknown tool".to_string()));
                    html.push_str(r#"</span>"#);
                    if let Some(inp) = input {
                        html.push_str(r#"<pre><code>"#);
                        html.push_str(&html_escape(&serde_json::to_string_pretty(inp).unwrap_or_default()));
                        html.push_str(r#"</code></pre>"#);
                    }
                    html.push_str(r#"</div>"#);
                }
                MessageContentBlock::ToolResult { content, .. } => {
                    if let Some(c) = content {
                        html.push_str(r#"<div class="tool-use"><pre><code>"#);
                        html.push_str(&html_escape(&serde_json::to_string_pretty(c).unwrap_or_default()));
                        html.push_str(r#"</code></pre></div>"#);
                    }
                }
                MessageContentBlock::Other => {}
            }
        }

        html.push_str(r#"</div>"#);

        if let (Some(input), Some(output)) = (msg.input_tokens, msg.output_tokens) {
            html.push_str(&format!(r#"<div class="tokens">Tokens: {} in / {} out</div>"#, input, output));
        }

        html.push_str(r#"</div>"#);
    }

    html.push_str(r#"
    </div>
</body>
</html>"#);

    Ok(html)
}

/// Basic HTML escaping
fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Search through session messages for a query string
/// Returns sessions that have matching message content
pub fn search_sessions(project_path: &str, query: &str) -> Result<Vec<SessionSearchResult>, String> {
    let folder = get_project_folder(project_path)
        .ok_or_else(|| format!("Project folder not found for: {}", project_path))?;

    let query_lower = query.to_lowercase();
    let mut results: Vec<SessionSearchResult> = Vec::new();
    let mut seen_sessions: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Find all .jsonl files
    let entries = std::fs::read_dir(&folder)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.extension().map(|e| e == "jsonl").unwrap_or(false) || !path.is_file() {
            continue;
        }

        let session_id = match path.file_stem().and_then(|s| s.to_str()) {
            Some(s) => s.to_string(),
            None => continue,
        };

        // Skip if we already found a match in this session
        if seen_sessions.contains(&session_id) {
            continue;
        }

        let file = match File::open(&path) {
            Ok(f) => f,
            Err(_) => continue,
        };
        let reader = BufReader::new(file);

        let mut summary: Option<String> = None;
        let mut first_user_message: Option<String> = None;

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };

            if line.trim().is_empty() {
                continue;
            }

            let entry: serde_json::Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let entry_type = entry.get("type").and_then(|t| t.as_str());

            match entry_type {
                Some("summary") => {
                    if let Some(s) = entry.get("summary").and_then(|s| s.as_str()) {
                        summary = Some(s.to_string());
                    }
                }
                Some("user") | Some("assistant") => {
                    let role = entry_type.unwrap_or("unknown").to_string();

                    // Capture first user message
                    if first_user_message.is_none() && entry_type == Some("user") {
                        if let Some(msg) = entry.get("message") {
                            if let Some(content_str) = msg.get("content").and_then(|c| c.as_str()) {
                                let truncated = if content_str.len() > 100 {
                                    format!("{}...", &content_str[..100])
                                } else {
                                    content_str.to_string()
                                };
                                first_user_message = Some(truncated);
                            }
                        }
                    }

                    // Search in message content
                    if let Some(msg) = entry.get("message") {
                        // Check string content
                        if let Some(content_str) = msg.get("content").and_then(|c| c.as_str()) {
                            if let Some(match_result) = find_match_with_context(content_str, &query_lower) {
                                seen_sessions.insert(session_id.clone());
                                results.push(SessionSearchResult {
                                    session_id: session_id.clone(),
                                    summary: summary.clone(),
                                    first_user_message: first_user_message.clone(),
                                    matched_text: match_result.0,
                                    match_context: match_result.1,
                                    message_role: role.clone(),
                                });
                                break;
                            }
                        }

                        // Check array content (text blocks)
                        if let Some(content_arr) = msg.get("content").and_then(|c| c.as_array()) {
                            let mut found = false;
                            for block in content_arr {
                                if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                                    if let Some(match_result) = find_match_with_context(text, &query_lower) {
                                        seen_sessions.insert(session_id.clone());
                                        results.push(SessionSearchResult {
                                            session_id: session_id.clone(),
                                            summary: summary.clone(),
                                            first_user_message: first_user_message.clone(),
                                            matched_text: match_result.0,
                                            match_context: match_result.1,
                                            message_role: role.clone(),
                                        });
                                        found = true;
                                        break;
                                    }
                                }
                            }
                            if found {
                                break;
                            }
                        }
                    }
                }
                _ => {}
            }
        }
    }

    // Sort by session_id (most recent first, assuming UUIDs are time-ordered)
    results.sort_by(|a, b| b.session_id.cmp(&a.session_id));

    Ok(results)
}

/// Find a match in text and return (matched_text, context)
fn find_match_with_context(text: &str, query_lower: &str) -> Option<(String, String)> {
    let text_lower = text.to_lowercase();
    if let Some(pos) = text_lower.find(query_lower) {
        // Extract matched text (preserve original case)
        let matched_text = text[pos..pos + query_lower.len()].to_string();

        // Extract context around the match (50 chars before and after)
        let context_start = pos.saturating_sub(50);
        let context_end = (pos + query_lower.len() + 50).min(text.len());

        let mut context = String::new();
        if context_start > 0 {
            context.push_str("...");
        }
        context.push_str(&text[context_start..context_end]);
        if context_end < text.len() {
            context.push_str("...");
        }

        Some((matched_text, context))
    } else {
        None
    }
}
