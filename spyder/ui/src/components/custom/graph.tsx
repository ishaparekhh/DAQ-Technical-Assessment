"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  YAxis,
  XAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Point = { t: number; y: number };

interface GraphProps {
  data: Point[];
  height?: number;
  domain?: [number, number];
  className?: string;
}


function levelLabel(v: number): string {
  if (v <= 20) return "Unsafe";
  if (v <= 25) return "Near unsafe";
  if (v < 75)  return "Safe";
  if (v <= 80) return "Near unsafe";
  return "Unsafe";
}

// middle of range
const LEVEL_TICKS = [10, 22.5, 50, 77.5, 90];

export default function Graph({
  data,
  height = 300,
  domain = [0, 100],
  className = "text-foreground",
}: GraphProps) {
  const chartData = data.map(d => ({ t: d.t, y: d.y }));

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 12, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(ts: any) => new Date(ts).toLocaleTimeString()}
            tick={{ fontSize: 12 }}
            axisLine={false}
          />
          <YAxis
            dataKey="y"
            type="number"
            domain={domain}
            ticks={LEVEL_TICKS}
            tickFormatter={levelLabel}
            tick={{ fontSize: 12 }}
            axisLine={false}
            label={{ value: "Level", angle: -90, position: "insideLeft", offset: 10 }}
          />
          <Tooltip
            formatter={(val: any) => [`${Number(val).toFixed(3)} °C`, "Temp"]}
            labelFormatter={(ts: any) => new Date(ts).toLocaleTimeString()}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke="currentColor"
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
