import net from "net";
import { WebSocket, WebSocketServer } from "ws";

interface VehicleData {
  battery_temperature: number | string;
  timestamp: number;
}

type RawPacket = { battery_temperature: unknown; timestamp: unknown };
type CleanPacket = { battery_temperature: number; timestamp: number };

const MIN_C = 0;
const MAX_C = 200;

function decodeString(s: string): number | null {

  if (s.length === 4) {
    const buf = Buffer.from(s, "latin1");
    const n = buf.readInt32LE(0);
    if (Number.isFinite(n)) return n;
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toNumber(x: unknown): number | null {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") return decodeString(x);
  return null;
}

function sanitize(raw: RawPacket): CleanPacket | null {
  const t = toNumber(raw.battery_temperature);
  const ts =
    typeof raw.timestamp === "number"
      ? raw.timestamp
      : Number((raw.timestamp as any) ?? NaN);

  if (!Number.isFinite(t as number) || !Number.isFinite(ts)) return null;
  if ((t as number) < MIN_C || (t as number) > MAX_C) return null;

  return {
    battery_temperature: Number((t as number)),
    timestamp: Number(ts),
  };
}

// task 2 - safe window
const SAFE_MIN = 20;
const SAFE_MAX = 80;
const WINDOW_MS = 5000;
const THRESHOLD = 3;

const unsafeEvents: number[] = [];
let alertArmed = true;

function recordUnsafeAndMaybeAlert(temp: number) {
  const now = Date.now();

  if (temp < SAFE_MIN || temp > SAFE_MAX) {
    unsafeEvents.push(now);
  }

  const cutoff = now - WINDOW_MS;
  while (unsafeEvents.length && unsafeEvents[0] < cutoff) {
    unsafeEvents.shift();
  }

  const count = unsafeEvents.length;
  if (count > THRESHOLD && alertArmed) {
  const nowIso = new Date(now).toISOString();
  console.error(
    `[${nowIso}] ALERT: Battery temperature exceeded safe range more than ${THRESHOLD} times within ${WINDOW_MS / 1000}s.`
  );

  // sends to front end
  broadcast({
    type: "alert",
    code: "unsafe_window",
    ts: now,
    count,
    windowMs: WINDOW_MS,
    message: "Unsafe temperature burst detected",
  });

  alertArmed = false;
}

}

function broadcast(obj: unknown) {
  const payload = JSON.stringify(obj);
  websocketServer.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}


// extracts json packets
function extractJsonObjects(input: string): { objects: string[]; remainder: string } {
  const objects: string[] = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let start = -1;
  let cursor = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
      continue;
    }

    if (ch === "}") {
      if (depth > 0) depth--;
      if (depth === 0 && start !== -1) {
        objects.push(input.slice(start, i + 1));
        cursor = i + 1;
        start = -1;
      }
    }
  }

  const remainder = input.slice(cursor);
  return { objects, remainder };
}


// server stuff
const TCP_PORT = 12000;
const WS_PORT = 8080;

const tcpServer = net.createServer();
const websocketServer = new WebSocketServer({ port: WS_PORT });

tcpServer.on("connection", (socket) => {
  console.log("TCP client connected");

  let buffer = "";

  socket.on("data", (msg) => {
    buffer += msg.toString();

    const { objects, remainder } = extractJsonObjects(buffer);
    buffer = remainder;

    for (const obj of objects) {
      try {
        const raw = JSON.parse(obj) as RawPacket;
        console.log("Received:", raw);

        const clean = sanitize(raw);
        if (!clean) {
          console.warn("Dropped invalid packet:", raw);
          continue;
        }

        recordUnsafeAndMaybeAlert(clean.battery_temperature);

        const payload = JSON.stringify(clean);
        websocketServer.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) client.send(payload);
        });
      } catch (err) {
        console.warn("Bad JSON object skipped:", obj);
      }
    }
  });

  socket.on("end", () => {
    console.log("Closing connection with the TCP client");
  });

  socket.on("error", (err) => {
    console.log("TCP client error: ", err);
  });
});

websocketServer.on("listening", () =>
  console.log(`Websocket server started on port ${WS_PORT}`)
);

websocketServer.on("connection", async (ws: WebSocket) => {
  console.log("Frontend websocket client connected");
  ws.on("error", console.error);
});

tcpServer.listen(TCP_PORT, () => {
  console.log(`TCP server listening on port ${TCP_PORT}`);
});
