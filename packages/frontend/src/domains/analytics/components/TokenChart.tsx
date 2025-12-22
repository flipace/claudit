import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyStats } from "../../../types";
import { format, parseISO } from "date-fns";

interface TokenChartProps {
  data: DailyStats[];
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

export function TokenChart({ data }: TokenChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    date: format(parseISO(d.date), "MMM d"),
    total: d.input_tokens + d.output_tokens,
  }));

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-foreground mb-4">Daily Token Usage</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d97757" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#d97757" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 10% 16%)" />
            <XAxis
              dataKey="date"
              stroke="hsl(220 10% 55%)"
              fontSize={12}
              tickLine={false}
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
            <Area
              type="monotone"
              dataKey="input_tokens"
              name="Input"
              stroke="#d97757"
              fillOpacity={1}
              fill="url(#colorInput)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="output_tokens"
              name="Output"
              stroke="#8b5cf6"
              fillOpacity={1}
              fill="url(#colorOutput)"
              stackId="1"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
