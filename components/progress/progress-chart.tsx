"use client";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export function ProgressChart({
  data,
  dataKey,
  unit,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  unit: string;
}) {
  if (data.length < 2)
    return (
      <div className="grid h-52 place-items-center rounded-xl bg-surface-alt text-sm text-muted">
        Registre ao menos duas medições para ver o gráfico.
      </div>
    );
  return (
    <div className="h-60 w-full" aria-label={`Gráfico de evolução em ${unit}`}>
      <ResponsiveContainer>
        <LineChart
          data={data}
          margin={{ top: 10, right: 12, bottom: 0, left: -15 }}
        >
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="var(--muted)"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--muted)"
            tickLine={false}
            axisLine={false}
            unit={unit}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              borderRadius: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="var(--accent)"
            strokeWidth={3}
            dot={{ fill: "var(--accent)", r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
