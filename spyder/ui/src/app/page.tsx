"use client"

import { useState, useEffect, useMemo } from "react"
import useWebSocket, { ReadyState } from "react-use-websocket"
import { useTheme } from "next-themes"
import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Thermometer, Sun, Moon } from "lucide-react"
import Numeric from "../components/custom/numeric"
import Graph from "../components/custom/graph"
import Stats from "../components/custom/stats"
import RedbackLogoDarkMode from "../../public/logo-darkmode.svg"
import RedbackLogoLightMode from "../../public/logo-lightmode.svg"
import { toast } from "sonner"

const WS_URL = "ws://localhost:8080"

interface VehicleData {
  battery_temperature: number
  timestamp: number
}

interface AlertMessage {
  type: "alert";
  code: "unsafe_window";
  ts?: number;
  count?: number;
  windowMs?: number;
  message?: string;
}

type Incoming = VehicleData | AlertMessage;
type Point = { t: number; y: number }

const ROLLING_MS = 60_000 // keep ~60s of data in the chart
const DEFAULTS = { safeMin: 20, safeMax: 80, nearBand: 5 } // task spec defaults

function isAlert(m: any): m is AlertMessage {
  return m && m.type === "alert" && m.code === "unsafe_window";
}
function isVehicleData(m: any): m is VehicleData {
  return m && typeof m.battery_temperature === "number";
}

export default function Page(): JSX.Element {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const effectiveTheme = mounted ? (resolvedTheme ?? theme ?? "dark") : "dark";
  const isDark = effectiveTheme === "dark";

  const [temperature, setTemperature] = useState<number>(0)
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected")
  const [series, setSeries] = useState<Point[]>([])

  const [safeMin, setSafeMin] = useState<number>(DEFAULTS.safeMin)
  const [safeMax, setSafeMax] = useState<number>(DEFAULTS.safeMax)
  const [nearBand, setNearBand] = useState<number>(DEFAULTS.nearBand)


  useEffect(() => {
    try {
      const raw = localStorage.getItem("safeRanges");
      if (raw) {
        const { safeMin: sm, safeMax: sx, nearBand: nb } = JSON.parse(raw);
        if (Number.isFinite(sm)) setSafeMin(sm);
        if (Number.isFinite(sx)) setSafeMax(sx);
        if (Number.isFinite(nb)) setNearBand(nb);
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem("safeRanges", JSON.stringify({ safeMin, safeMax, nearBand }));
  }, [safeMin, safeMax, nearBand]);

  // Allow both telemetry and alert messages from the socket
  const { lastJsonMessage, readyState }: { lastJsonMessage: Incoming | null; readyState: ReadyState } =
    useWebSocket(WS_URL, {
      share: false,
      shouldReconnect: () => true,
    })

  /** Effect hook to handle WebSocket connection state changes. */
  useEffect(() => {
    switch (readyState) {
      case ReadyState.OPEN:
        setConnectionStatus("Connected"); break
      case ReadyState.CONNECTING:
        setConnectionStatus("Connecting"); break
      case ReadyState.CLOSED:
      default:
        setConnectionStatus("Disconnected"); break
    }
  }, [readyState])

  useEffect(() => {
    if (!lastJsonMessage) return

    if (isAlert(lastJsonMessage)) {
      const when = new Date(lastJsonMessage.ts ?? Date.now()).toLocaleTimeString()
      const secs = Math.round((lastJsonMessage.windowMs ?? 5000) / 1000)
      toast.error(lastJsonMessage.message ?? "Unsafe temperature burst detected", {
        description: `Time: ${when} • Window: ${secs}s • Count: ${lastJsonMessage.count ?? "n/a"}`,
      })
      return
    }

    if (isVehicleData(lastJsonMessage)) {
      const { battery_temperature, timestamp } = lastJsonMessage

      setTemperature(battery_temperature)

      const now = Date.now()
      const ts = typeof timestamp === "number" ? timestamp : now

      setSeries(prev => {
        const next = [...prev, { t: ts, y: battery_temperature }]
        const cutoff = now - ROLLING_MS
        return next.filter(p => p.t >= cutoff)
      })
    }
  }, [lastJsonMessage])

  const stats = useMemo(() => {
    const cutoff = Date.now() - ROLLING_MS
    const vals = series.filter(p => p.t >= cutoff).map(p => p.y)
    if (vals.length === 0) return { min: null as number | null, avg: null as number | null, max: null as number | null }

    let min = vals[0], max = vals[0], sum = 0
    for (const v of vals) {
      if (v < min) min = v
      if (v > max) max = v
      sum += v
    }
    return { min, avg: sum / vals.length, max }
  }, [series])

  const ranges = useMemo(() => ({ safeMin, safeMax, nearBand }), [safeMin, safeMax, nearBand])
  const clampSafeMin = (v: number) => Math.max(0, Math.min(v, safeMax - 1))
  const clampSafeMax = (v: number) => Math.min(120, Math.max(v, safeMin + 1))
  const clampNearBand = (v: number) => Math.max(0, Math.min(v, Math.floor((safeMax - safeMin) / 2)))


  function resetSafeRanges() {
    setSafeMin(DEFAULTS.safeMin);
    setSafeMax(DEFAULTS.safeMax);
    setNearBand(DEFAULTS.nearBand);
    localStorage.setItem("safeRanges", JSON.stringify(DEFAULTS));
    toast.success("Safe range reset", { description: "Back to 20–80°C with a 5°C near band" });
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-5 h-20 flex items-center gap-5 border-b">
        <Image
          src={isDark ? RedbackLogoDarkMode : RedbackLogoLightMode}
          className="h-12 w-auto"
          alt="Redback Racing Logo"
        />
        <h1 className="text-foreground text-xl font-semibold">DAQ Technical Assessment</h1>
        <Badge variant={connectionStatus === "Connected" ? "success" : "destructive"} className="ml-auto">
          {connectionStatus}
        </Badge>
        {/* Light/Dark toggle */}
        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="Toggle theme"
          className="ml-3 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDark ? "Light" : "Dark"}
        </button>
      </header>

      <main className="flex-grow p-6">
  <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
    <Card className="lg:col-span-8">
      <CardHeader>
        <CardTitle className="text-xl font-light">Thermal Trend (last 60s)</CardTitle>
      </CardHeader>
      <CardContent>
        <Graph
          data={series}
          height={360}
          domain={[0, 100]}
          className="text-muted-foreground"
        />
      </CardContent>
    </Card>

    <div className="lg:col-span-4 flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-light flex items-center gap-2">
            <Thermometer className="h-5 w-5" />
            Live Battery Temperature
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center">
          <Numeric temp={temperature} ranges={ranges} />
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-light">Stats (last 60s)</CardTitle>
        </CardHeader>
        <CardContent>
          <Stats min={stats.min} avg={stats.avg} max={stats.max} ranges={ranges} />
        </CardContent>
      </Card>

      {/* Safe range settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-light">Safe range settings</CardTitle>
          <button
            type="button"
            onClick={resetSafeRanges}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Reset to defaults
          </button>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Safe Min */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
            <label className="sm:col-span-1 text-sm text-muted-foreground">Safe Min (°C)</label>
            <input
              type="range"
              min={0}
              max={safeMax - 1}
              value={safeMin}
              onChange={(e) => setSafeMin(clampSafeMin(Number(e.target.value)))}
              className="sm:col-span-3 w-full"
            />
            <input
              type="number"
              min={0}
              max={safeMax - 1}
              value={safeMin}
              onChange={(e) => setSafeMin(clampSafeMin(Number(e.target.value)))}
              className="sm:col-span-1 w-full rounded-md border bg-background px-2 py-1"
            />
          </div>

          {/* Safe Max */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
            <label className="sm:col-span-1 text-sm text-muted-foreground">Safe Max (°C)</label>
            <input
              type="range"
              min={safeMin + 1}
              max={120}
              value={safeMax}
              onChange={(e) => setSafeMax(clampSafeMax(Number(e.target.value)))}
              className="sm:col-span-3 w-full"
            />
            <input
              type="number"
              min={safeMin + 1}
              max={120}
              value={safeMax}
              onChange={(e) => setSafeMax(clampSafeMax(Number(e.target.value)))}
              className="sm:col-span-1 w-full rounded-md border bg-background px-2 py-1"
            />
          </div>

          {/* Near band */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
            <label className="sm:col-span-1 text-sm text-muted-foreground">Near band width (°C)</label>
            <input
              type="range"
              min={0}
              max={Math.floor((safeMax - safeMin) / 2)}
              value={nearBand}
              onChange={(e) => setNearBand(clampNearBand(Number(e.target.value)))}
              className="sm:col-span-3 w-full"
            />
            <input
              type="number"
              min={0}
              max={Math.floor((safeMax - safeMin) / 2)}
              value={nearBand}
              onChange={(e) => setNearBand(clampNearBand(Number(e.target.value)))}
              className="sm:col-span-1 w-full rounded-md border bg-background px-2 py-1"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Bands: <span className="font-medium">Unsafe</span> &lt; {safeMin}°C or &gt; {safeMax}°C •{" "}
            <span className="font-medium">Near</span> {safeMin}–{safeMin + nearBand}°C and {safeMax - nearBand}–{safeMax}°C •{" "}
            <span className="font-medium">Safe</span> otherwise within {safeMin}–{safeMax}°C.
          </p>
        </CardContent>
      </Card>
    </div>
  </div>
</main>

    </div>
  )
}
