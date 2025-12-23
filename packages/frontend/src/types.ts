// Analytics stats from backend
export interface ModelStats {
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  cost: number;
  message_count: number;
}

export interface ProjectStats {
  name: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  message_count: number;
}

export interface AnalyticsStats {
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
  today_input_tokens: number;
  today_output_tokens: number;
  today_cost: number;
  today_messages: number;
  current_session_tokens: number;
  current_session_cost: number;
  today_session_count: number;
  total_session_count: number;
  tokens_per_minute: number;
  cost_per_hour: number;
  total_cost: number;
  by_model: Record<string, ModelStats>;
  by_project: Record<string, ProjectStats>;
  today_messages_count: number;
  total_messages_count: number;
  last_updated: string | null;
}

// Chart data
export interface DailyStats {
  date: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  messages: number;
}

export interface HourlyStats {
  hour: number;
  tokens: number;
  messages: number;
}

export interface ModelChartData {
  name: string;
  tokens: number;
  cost: number;
}

export interface ProjectChartData {
  name: string;
  tokens: number;
  cost: number;
}

export interface ChartData {
  daily: DailyStats[];
  hourly: HourlyStats[];
  by_model: ModelChartData[];
  by_project: ProjectChartData[];
}

// Settings
export interface AppSettings {
  notifications_enabled: boolean;
  show_messages: boolean;
  show_tokens: boolean;
  show_cost: boolean;
  show_burn_rate: boolean;
  show_sessions: boolean;
  show_model_breakdown: boolean;
  compact_mode: boolean;
  auto_start: boolean;
  hook_port: number;
  claude_cli_path?: string;
  terminal_app: string; // "auto", "Terminal", "iTerm", "Warp", "Alacritty", "kitty"
}

// Hook events
export interface HookEvent {
  event: string;
  tool?: string;
  context?: string;
  timestamp?: string;
}

// Model pricing for display
export interface ModelPricing {
  model_name: string;
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
}

// Session types
export interface SessionInfo {
  session_id: string;
  summary: string | null;
  first_user_message: string | null;
  first_message_at: string | null;
  last_message_at: string | null;
  message_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_creation_tokens: number;
  total_cache_read_tokens: number;
  total_cost: number;
  model: string | null;
}

export type MessageContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "tool_use"; id?: string; name?: string; input?: unknown }
  | { type: "tool_result"; tool_use_id?: string; content?: unknown }
  | { type: "Other" };

export interface ConversationMessage {
  uuid: string;
  role: "user" | "assistant";
  timestamp: string | null;
  content: MessageContentBlock[];
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
}

export interface SessionConversation {
  session_id: string;
  summary: string | null;
  messages: ConversationMessage[];
}

export interface SessionSearchResult {
  session_id: string;
  summary: string | null;
  first_user_message: string | null;
  matched_text: string;
  match_context: string;
  message_role: string;
}
