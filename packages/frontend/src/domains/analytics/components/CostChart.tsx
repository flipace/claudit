import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyStats } from "../../../types";
import { format, parseISO } from "date-fns";

interface CostChartProps {
  data: DailyStats[];
}

function formatCost(n: number): string {
  if (n >= 1) {
    return `$${n.toFixed(2)}`;
  }
  return `$${n.toFixed(3)}`;
}

export function CostChart({ data }: CostChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    date: format(parseISO(d.date), "MMM d"),
  }));

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-foreground mb-4">Daily Cost</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
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
              tickFormatter={formatCost}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220 13% 10%)",
                border: "1px solid hsl(220 10% 16%)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "hsl(220 10% 55%)" }}
              formatter={(value: number) => formatCost(value)}
            />
            <Bar
              dataKey="cost"
              name="Cost"
              fill="#d97757"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
