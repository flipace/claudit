import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ProjectChartData } from "../../../types";

interface ProjectChartProps {
  data: ProjectChartData[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return n.toLocaleString();
}

function getProjectFolderName(name: string): string {
  // The analytics service returns folder names like "-Users-foo-project"
  // Extract just the last segment (project name)
  // e.g., "-Users-patrick-Development-myproject" -> "myproject"

  // Handle encoded folder names (starting with -)
  if (name.startsWith("-")) {
    const parts = name.split("-").filter(Boolean);
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
  }

  // Handle regular paths (shouldn't happen but fallback)
  const parts = name.split("/").filter(Boolean);
  if (parts.length > 0) {
    return parts[parts.length - 1];
  }
  return name;
}

export function ProjectChart({ data }: ProjectChartProps) {
  const chartData = data.slice(0, 10).map((d) => ({
    ...d,
    shortName: getProjectFolderName(d.name),
  }));

  return (
    <div className="bg-card/50 backdrop-blur-sm border border-border rounded-lg p-4">
      <h3 className="text-sm font-medium text-foreground mb-4">
        Top Projects by Usage
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 10% 16%)" />
            <XAxis
              type="number"
              stroke="hsl(220 10% 55%)"
              fontSize={12}
              tickLine={false}
              tickFormatter={formatNumber}
            />
            <YAxis
              dataKey="shortName"
              type="category"
              stroke="hsl(220 10% 55%)"
              fontSize={10}
              tickLine={false}
              width={80}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(220 13% 10%)",
                border: "1px solid hsl(220 10% 16%)",
                borderRadius: "8px",
              }}
              formatter={(value: number) => [formatNumber(value), "Tokens"]}
              labelFormatter={(label) => label}
            />
            <Bar
              dataKey="tokens"
              name="Tokens"
              fill="#d97757"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
