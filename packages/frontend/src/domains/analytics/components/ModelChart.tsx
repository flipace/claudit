import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { ModelChartData } from "../../../types";

interface ModelChartProps {
  data: ModelChartData[];
}

// Claude-inspired color palette with coral accent
const COLORS = ["#d97757", "#8b5cf6", "#f59e0b", "#10b981", "#3b82f6", "#ec4899"];

function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString();
}

function formatModelName(name: string): string {
  // e.g., "claude-opus-4-5-20251101" -> "Opus 4.5"
  // e.g., "claude-sonnet-4-20250514" -> "Sonnet 4"
  const lowerName = name.toLowerCase();

  // Extract model family and version
  const families = ["opus", "sonnet", "haiku"];
  for (const family of families) {
    if (lowerName.includes(family)) {
      // Check for x.5 versions (e.g., opus-4-5 means 4.5)
      const match = lowerName.match(new RegExp(`${family}-(\\d+)(?:-(5))?`));
      if (match) {
        const majorVersion = match[1];
        const isPointFive = match[2] === "5";
        const capitalFamily = family.charAt(0).toUpperCase() + family.slice(1);
        return `${capitalFamily} ${majorVersion}${isPointFive ? ".5" : ""}`;
      }
    }
  }

  // Fallback: just capitalize and clean up
  return name.replace(/^claude-/i, "").replace(/-\d{8}$/, "");
}

export function ModelChart({ data }: ModelChartProps) {
  const total = data.reduce((sum, d) => sum + d.tokens, 0);
  const chartData = data.map((d) => ({
    ...d,
    shortName: formatModelName(d.name),
    percent: total > 0 ? (d.tokens / total) * 100 : 0,
  }));

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-foreground mb-4">Usage by Model</h3>
      <div className="flex items-center gap-6">
        {/* Pie Chart */}
        <div className="h-40 w-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="tokens"
                nameKey="shortName"
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={60}
                paddingAngle={2}
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220 13% 10%)",
                  border: "1px solid hsl(220 10% 16%)",
                  borderRadius: "8px",
                }}
                formatter={(value: number) => formatNumber(value)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {chartData.map((entry, index) => (
            <div key={entry.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-foreground truncate">{entry.shortName}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                <span>{formatNumber(entry.tokens)}</span>
                <span className="w-10 text-right">{entry.percent.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
