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
}

// Hook events
export interface HookEvent {
  event: string;
  tool?: string;
  context?: string;
  timestamp?: string;
}
