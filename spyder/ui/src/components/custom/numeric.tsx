interface TemperatureProps {
  temp: number | string;
  ranges?: { safeMin: number; safeMax: number; nearBand: number };
}

function Numeric({ temp, ranges = { safeMin: 20, safeMax: 80, nearBand: 5 } }: TemperatureProps) {
  const n = typeof temp === "number" ? temp : Number(temp);
  const isNum = Number.isFinite(n);

  const display = isNum ? n.toFixed(3) : "—";
  const { safeMin, safeMax, nearBand } = ranges;

  let colorClass = "text-foreground";
  if (isNum) {
    const nearLowHi = safeMin + nearBand;
    const nearHiLo = safeMax - nearBand;
    if (n < safeMin || n > safeMax) {
      colorClass = "temp-unsafe";
    } else if ((n >= safeMin && n <= nearLowHi) || (n >= nearHiLo && n <= safeMax)) {
      colorClass = "temp-near";
    } else {
      colorClass = "temp-safe";
    }
  }

  return (
    <div className={`text-4xl font-bold ${colorClass}`}>
      {`${display}°C`}
    </div>
  );
}

export default Numeric;
