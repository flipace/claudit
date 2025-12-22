import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { HourlyStats } from "../../../types";

interface HourlyChartProps {
  data: HourlyStats[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toString();
}

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

export function HourlyChart({ data }: HourlyChartProps) {
  // Fill in missing hours with zero values
  const fullData = Array.from({ length: 24 }, (_, i) => {
    const existing = data.find((d) => d.hour === i);
    return {
      hour: i,
      hourLabel: formatHour(i),
      tokens: existing?.tokens ?? 0,
      messages: existing?.messages ?? 0,
    };
  });

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-foreground mb-4">
        Usage by Hour of Day
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={fullData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 10% 16%)" />
            <XAxis
              dataKey="hourLabel"
              stroke="hsl(220 10% 55%)"
              fontSize={10}
              tickLine={false}
              interval={2}
            />
            <YAxis
              stroke="hsl(220 10% 55%)"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatNumber}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220 13% 10%)",
                border: "1px solid hsl(220 10% 16%)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(220 10% 55%)" }}
              formatter={(value: number) => formatNumber(value)}
            />
            <Bar
              dataKey="tokens"
              name="Tokens"
              fill="#8b5cf6"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
