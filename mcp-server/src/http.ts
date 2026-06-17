import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { CommentStore } from "./store.js";
import { parseIncoming } from "./validate.js";

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const SERVICE = "redline";

export interface IngestServer {
  port: number;
  close: () => Promise<void>;
}

export async function startIngestServer(
  store: CommentStore,
  preferredPorts: number[],
  log: (msg: string) => void,
): Promise<IngestServer> {
  const server = createServer((req, res) => {
    const port = (server.address() as { port: number } | null)?.port ?? 0;
    void handle(req, res, store, log, port);
  });
  const port = await listenFirstAvailable(server, preferredPorts);
  return {
    port,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

// Only the browser extension (chrome-extension:// origin, or no Origin header at
// all) may reach this listener. A web page the user happens to be visiting always
// sends its own http(s) Origin on a cross-origin fetch, so rejecting those closes
// the prompt-injection / CSRF channel into the AI assistant's comment store.
function originAllowed(origin: string | undefined): boolean {
  if (!origin || origin === "null") return true;
  return origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://");
}

// Reject any Host header that is not loopback, defeating DNS-rebinding attacks
// that point an attacker-controlled domain at 127.0.0.1.
function hostAllowed(host: string | undefined, port: number): boolean {
  if (!host) return false;
  const [name, hostPort] = host.split(":");
  if (hostPort && Number(hostPort) !== port) return false;
  return name === "127.0.0.1" || name === "localhost" || name === "[::1]";
}

function setCors(res: ServerResponse, origin: string | undefined): void {
  res.setHeader("Vary", "Origin");
  if (origin && originAllowed(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  store: CommentStore,
  log: (msg: string) => void,
  port: number,
): Promise<void> {
  const origin = req.headers.origin;
  setCors(res, origin);

  if (!originAllowed(origin) || !hostAllowed(req.headers.host, port)) {
    json(res, 403, { error: "forbidden" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true, service: SERVICE });
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/comments")) {
    json(res, 200, await store.list());
    return;
  }

  if (req.method === "DELETE" && req.url?.startsWith("/comments")) {
    const url = new URL(req.url, "http://localhost").searchParams.get("url") ?? undefined;
    const removed = await store.clear(url);
    log(`cleared ${removed} comment(s)${url ? ` on ${url}` : ""}`);
    json(res, 200, { removed });
    return;
  }

  if (req.method === "POST" && req.url === "/comments") {
    try {
      const body = await readBody(req);
      const incoming = parseIncoming(body);
      const comment = await store.add(incoming);
      log(`ingested comment ${comment.id} on ${comment.route}`);
      json(res, 201, { id: comment.id, status: comment.status });
    } catch (err) {
      json(res, 400, { error: (err as Error).message });
    }
    return;
  }

  json(res, 404, { error: "not found" });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function listenFirstAvailable(
  server: ReturnType<typeof createServer>,
  ports: number[],
): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (index: number) => {
      if (index >= ports.length) {
        reject(new Error(`no available port in ${ports.join(", ")}`));
        return;
      }
      const port = ports[index];
      const onError = (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          tryPort(index + 1);
        } else {
          reject(err);
        }
      };
      server.once("error", onError);
      server.listen(port, "127.0.0.1", () => {
        server.removeListener("error", onError);
        resolve((server.address() as { port: number } | null)?.port ?? port);
      });
    };
    tryPort(0);
  });
}
