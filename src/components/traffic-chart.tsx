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
import type { DailyMetrics } from "@/lib/types";
import { formatDate, formatPercent, formatPosition } from "@/lib/format";

/**
 * Organic traffic over time. Impressions and clicks live on separate axes
 * because on a site with 698 impressions and 0 clicks a shared axis would
 * flatten the clicks line into the baseline and hide it entirely.
 */
export function TrafficChart({ data }: { data: DailyMetrics[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-[var(--color-muted)]">
        No data in this range yet. Run `npm run sync:lite` to pull Search Console data.
      </div>
    );
  }

  return (
    <div className="h-72 w-full overflow-hidden px-2 py-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)" }}
            minTickGap={24}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "var(--color-muted)" }}
            tickLine={false}
            axisLine={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--color-border)",
              fontSize: 12,
            }}
            labelFormatter={(v) => formatDate(String(v))}
            formatter={(value, name) => {
              const n = Number(value);
              if (name === "CTR") return [formatPercent(n), name];
              if (name === "Position") return [formatPosition(n), name];
              return [n.toLocaleString(), name];
            }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="impressions"
            name="Impressions"
            stroke="var(--color-primary)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="clicks"
            name="Clicks"
            stroke="var(--color-success)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="position"
            name="Position"
            stroke="var(--color-warning)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
