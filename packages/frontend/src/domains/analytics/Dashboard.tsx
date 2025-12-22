import { useState } from "react";
import { useStats, useChartData, useRefreshStats, useHooksStatus, useInstallHooks, useHookPort } from "./hooks";
import {
  StatCard,
  TokenChart,
  CostChart,
  ModelChart,
  HourlyChart,
  ProjectChart,
} from "./components";
import {
  RefreshCw,
  MessageSquare,
  Coins,
  Zap,
  Clock,
  TrendingUp,
  Bell,
  Check,
} from "lucide-react";

function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toString();
}

function formatCost(n: number): string {
  if (n >= 1) {
    return `$${n.toFixed(2)}`;
  }
  return `$${n.toFixed(3)}`;
}

type TimeRange = 7 | 30 | 90;

export function Dashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>(30);
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: chartData, isLoading: chartLoading } = useChartData(timeRange);
  const refreshMutation = useRefreshStats();
  const { data: hooksInstalled } = useHooksStatus();
  const { data: hookPort } = useHookPort();
  const installHooksMutation = useInstallHooks();

  const isLoading = statsLoading || chartLoading;

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Claude Code usage statistics
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Time Range Selector */}
          <div className="flex bg-secondary/50 rounded-lg p-1">
            {([7, 30, 90] as const).map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  timeRange === days
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="flex items-center gap-2 px-3 py-1.5 bg-secondary hover:bg-secondary/80 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={refreshMutation.isPending ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Hook Setup Banner */}
      {hooksInstalled === false && (
        <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell size={20} className="text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Enable real-time notifications
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Install Claude Code hooks to get notified when Claude finishes responding.
                  Server running on port {hookPort ?? 3456}.
                </p>
              </div>
            </div>
            <button
              onClick={() => installHooksMutation.mutate()}
              disabled={installHooksMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/80 text-primary-foreground rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {installHooksMutation.isPending ? "Installing..." : "Install Hooks"}
            </button>
          </div>
        </div>
      )}

      {hooksInstalled === true && (
        <div className="mb-6 p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-lg">
          <div className="flex items-center gap-2 text-emerald-400">
            <Check size={16} />
            <span className="text-sm">Claude Code hooks installed - notifications enabled</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard
              title="Messages Today"
              value={stats?.today_messages ?? 0}
              subtitle={`${stats?.total_messages_count ?? 0} total`}
              icon={<MessageSquare size={20} />}
            />
            <StatCard
              title="Tokens Today"
              value={formatNumber(
                (stats?.today_input_tokens ?? 0) +
                  (stats?.today_output_tokens ?? 0)
              )}
              subtitle={`${formatNumber(stats?.today_input_tokens ?? 0)} in / ${formatNumber(stats?.today_output_tokens ?? 0)} out`}
              icon={<Zap size={20} />}
            />
            <StatCard
              title="Cost Today"
              value={formatCost(stats?.today_cost ?? 0)}
              subtitle={`${formatCost(stats?.total_cost ?? 0)} total`}
              icon={<Coins size={20} />}
            />
            <StatCard
              title="Burn Rate"
              value={`${(stats?.tokens_per_minute ?? 0).toFixed(0)}/min`}
              subtitle={`${formatCost(stats?.cost_per_hour ?? 0)}/hr`}
              icon={<TrendingUp size={20} />}
            />
            <StatCard
              title="Sessions Today"
              value={stats?.today_session_count ?? 0}
              subtitle={`${stats?.total_session_count ?? 0} total`}
              icon={<Clock size={20} />}
            />
            <StatCard
              title="Cache Hit Rate"
              value={`${((stats?.total_cache_read_tokens ?? 0) / Math.max(1, (stats?.total_input_tokens ?? 0) + (stats?.total_cache_read_tokens ?? 0)) * 100).toFixed(1)}%`}
              subtitle={`${formatNumber(stats?.total_cache_read_tokens ?? 0)} cached`}
              icon={<Zap size={20} />}
            />
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {chartData && (
              <>
                <TokenChart data={chartData.daily} />
                <CostChart data={chartData.daily} />
                <ModelChart data={chartData.by_model} />
                <HourlyChart data={chartData.hourly} />
                <div className="lg:col-span-2">
                  <ProjectChart data={chartData.by_project} />
                </div>
              </>
            )}
          </div>

          {/* Last Updated */}
          {stats?.last_updated && (
            <div className="mt-4 text-center text-xs text-muted-foreground">
              Last updated: {new Date(stats.last_updated).toLocaleString()}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="mt-8 text-center text-xs text-muted-foreground/60">
        Made by{" "}
        <a
          href="https://github.com/flipace"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          @flipace
        </a>{" "}
        and{" "}
        <a
          href="https://claude.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground"
        >
          Claude Code
        </a>
      </div>
    </div>
  );
}
