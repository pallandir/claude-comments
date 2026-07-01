import { createHmac } from "node:crypto";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import { Broker } from "./broker.js";
import { HTTP_WAIT_TIMEOUT_MS, SESSION_ALIVE_TTL_MS } from "./config.js";
import type { CommentStore } from "./store.js";
import { parseIncoming, parseRatingRequest } from "./validate.js";

const MAX_BODY_BYTES = 12 * 1024 * 1024;
const SERVICE = "redline";

export interface IngestServer {
  port: number;
  broker: Broker;
  close: () => Promise<void>;
}

export async function startIngestServer(
  store: CommentStore,
  preferredPorts: number[],
  log: (msg: string) => void,
  broker: Broker = new Broker(),
): Promise<IngestServer> {
  const server = createServer((req, res) => {
    const port = (server.address() as { port: number } | null)?.port ?? 0;
    handle(req, res, store, log, port, broker).catch(() => {
      if (!res.headersSent) json(res, 500, { error: "internal" });
    });
  });
  const port = await listenFirstAvailable(server, preferredPorts);
  return {
    port,
    broker,
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Redline-Token");
}

// Verify the bearer token on state-changing / data endpoints. Routes exempt from
// this check: OPTIONS, GET /health, POST /handshake (those are the probe/auth
// path itself and must be reachable before a token is established).
function authorized(req: IncomingMessage, broker: Broker): boolean {
  const header = req.headers["x-redline-token"];
  const candidate = Array.isArray(header) ? header[0] : header;
  if (!candidate) return false;
  return broker.verifyToken(candidate);
}

export function hmacHex(key: string, message: string): string {
  return createHmac("sha256", key).update(message).digest("hex");
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  store: CommentStore,
  log: (msg: string) => void,
  port: number,
  broker: Broker,
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

  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (req.method === "GET" && pathname === "/health") {
    const pendingRatings = (await store.listRatingRequests("pending")).length;
    json(res, 200, {
      ok: true,
      service: SERVICE,
      root: store.root,
      startedAt: broker.startedAt,
      pid: broker.pid,
      version: broker.currentVersion,
      lastPolledAt: broker.lastPolledAt,
      watching: broker.isBoundAlive(SESSION_ALIVE_TTL_MS),
      notices: broker.pendingNotices,
      pendingRatings,
    });
    return;
  }

  // HMAC challenge-response: the extension sends a random nonce, the server
  // signs it with the bound token. A port-squatting process cannot forge this
  // because it never learns the token (it is delivered only over MCP stdio).
  if (req.method === "POST" && pathname === "/handshake") {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body) as { nonce?: string };
      if (!parsed.nonce || typeof parsed.nonce !== "string") {
        json(res, 400, { error: "nonce required" });
        return;
      }
      const token = broker.token;
      if (!token) {
        json(res, 401, { error: "no session bound" });
        return;
      }
      json(res, 200, { hmac: hmacHex(token, parsed.nonce) });
    } catch (err) {
      log((err as Error).message);
      json(res, 400, { error: "bad request" });
    }
    return;
  }

  // All routes below this point require a valid bearer token. A valid token means
  // the request came from the paired extension, so any authenticated call is a
  // liveness signal — the reverse heartbeat behind isExtensionAlive.
  if (!authorized(req, broker)) {
    json(res, 401, { error: "unauthorized" });
    return;
  }
  broker.markExtensionSeen();

  // The extension's steady poll: a lightweight live-status read (no comment list)
  // so the toolbar reflects watching changes promptly. Being authenticated, it
  // also refreshes the extension heartbeat via the gate above.
  if (req.method === "GET" && pathname === "/ping") {
    json(res, 200, {
      version: broker.currentVersion,
      watching: broker.isBoundAlive(SESSION_ALIVE_TTL_MS),
      notices: broker.pendingNotices,
    });
    return;
  }

  if (req.method === "GET" && pathname === "/state") {
    json(res, 200, await snapshot(store, broker));
    return;
  }

  if (req.method === "GET" && pathname === "/wait") {
    const raw = query(req.url, "since");
    const since = raw === null ? broker.currentVersion : Number(raw);
    const base = Number.isFinite(since) ? since : broker.currentVersion;
    await broker.wait(base, HTTP_WAIT_TIMEOUT_MS);
    json(res, 200, await snapshot(store, broker));
    return;
  }

  if (req.method === "POST" && pathname === "/notices/dismiss") {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body) as { commentId?: string };
      if (!parsed.commentId || typeof parsed.commentId !== "string") {
        json(res, 400, { error: "commentId required" });
        return;
      }
      broker.dismissNotice(parsed.commentId);
      json(res, 200, { ok: true });
    } catch (err) {
      log((err as Error).message);
      json(res, 400, { error: "bad request" });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/comments") {
    json(res, 200, await store.list());
    return;
  }

  if (req.method === "DELETE" && pathname === "/comments") {
    const url = query(req.url, "url");
    const all = query(req.url, "all");
    if (!url && all !== "true") {
      json(res, 400, { error: "url or ?all=true required" });
      return;
    }
    const removed = await store.clear(url ?? undefined);
    broker.bump();
    log(`cleared ${removed} comment(s)${url ? ` on ${url}` : ""}`);
    json(res, 200, { removed });
    return;
  }

  if (req.method === "POST" && pathname === "/comments") {
    try {
      const body = await readBody(req);
      const incoming = parseIncoming(body);
      const comment = await store.add(incoming, store.root);
      broker.bump();
      log(`ingested comment ${comment.id} on ${comment.metadata.page}`);
      json(res, 201, { id: comment.id, status: comment.status });
    } catch (err) {
      log((err as Error).message);
      json(res, 400, { error: "bad request" });
    }
    return;
  }

  if (req.method === "POST" && pathname === "/comments/reopen") {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body) as { id?: string; note?: string };
      if (!parsed.id || typeof parsed.id !== "string") {
        json(res, 400, { error: "id required" });
        return;
      }
      const comment = await store.reopenWithNote(parsed.id, parsed.note);
      if (!comment) {
        json(res, 404, { error: "not found" });
        return;
      }
      broker.bump();
      json(res, 200, { ok: true });
    } catch (err) {
      log((err as Error).message);
      json(res, 400, { error: "bad request" });
    }
    return;
  }

  if (req.method === "GET" && pathname === "/ratings") {
    const url = query(req.url, "url");
    const ratings = await store.listRatingRequests();
    const filtered = url ? ratings.filter((r) => r.url === url) : ratings;
    json(res, 200, filtered);
    return;
  }

  if (req.method === "POST" && pathname === "/ratings") {
    try {
      const body = await readBody(req);
      const incoming = parseRatingRequest(body);
      const entry = await store.addRatingRequest(incoming);
      broker.bump();
      try {
        log(`rating request ${entry.id} for ${new URL(incoming.url).pathname}`);
      } catch {
        log(`rating request ${entry.id}`);
      }
      json(res, 201, { id: entry.id, status: entry.status });
    } catch (err) {
      log((err as Error).message);
      json(res, 400, { error: "bad request" });
    }
    return;
  }

  json(res, 404, { error: "not found" });
}

async function snapshot(store: CommentStore, broker: Broker) {
  return {
    version: broker.currentVersion,
    lastPolledAt: broker.lastPolledAt,
    comments: await store.list(),
    watching: broker.isBoundAlive(SESSION_ALIVE_TTL_MS),
    notices: broker.pendingNotices,
  };
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

function query(url: string | undefined, key: string): string | null {
  return new URL(url ?? "", "http://localhost").searchParams.get(key);
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
