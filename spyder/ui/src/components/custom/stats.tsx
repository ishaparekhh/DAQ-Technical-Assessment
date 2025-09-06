"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function tempClass(n: number | null, safeMin: number, safeMax: number, nearBand: number): string {
  if (n == null || !Number.isFinite(n)) return "text-muted-foreground";
  const nearLowHi = safeMin + nearBand;
  const nearHiLo = safeMax - nearBand;
  if (n < safeMin || n > safeMax) return "temp-unsafe";
  if ((n >= safeMin && n <= nearLowHi) || (n >= nearHiLo && n <= safeMax)) return "temp-near";
  return "temp-safe";
}

function fmt(n: number | null): string {
  return n == null || !Number.isFinite(n) ? "—" : n.toFixed(3);
}

export default function Stats({
  min,
  avg,
  max,
  windowLabel = "last 60s",
  ranges = { safeMin: 20, safeMax: 80, nearBand: 5 },
}: {
  min: number | null;
  avg: number | null;
  max: number | null;
  windowLabel?: string;
  ranges?: { safeMin: number; safeMax: number; nearBand: number };
}) {
  const { safeMin, safeMax, nearBand } = ranges;
  const items = [
    { label: `Min (${windowLabel})`, value: min },
    { label: `Avg (${windowLabel})`, value: avg },
    { label: `Max (${windowLabel})`, value: max },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map((s) => (
        <Card key={s.label} className="min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {s.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="w-full min-w-0">
              <div
                className={`whitespace-nowrap overflow-hidden max-w-full tabular-nums text-right leading-tight
                            text-base sm:text-lg font-semibold ${tempClass(
                              s.value,
                              safeMin,
                              safeMax,
                              nearBand
                            )}`}
              >
                {fmt(s.value)}°C
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
