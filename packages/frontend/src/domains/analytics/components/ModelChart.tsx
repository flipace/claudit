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
  return n.toString();
}

function shortenModelName(name: string): string {
  // e.g., "claude-sonnet-4-20250514" -> "sonnet-4"
  const parts = name.split("-");
  if (parts.length >= 3) {
    return `${parts[1]}-${parts[2]}`;
  }
  return name;
}

export function ModelChart({ data }: ModelChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    shortName: shortenModelName(d.name),
  }));

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-foreground mb-4">Usage by Model</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="tokens"
              nameKey="shortName"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label={({ shortName, percent }) =>
                `${shortName} (${(percent * 100).toFixed(0)}%)`
              }
              labelLine={false}
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
    </div>
  );
}
