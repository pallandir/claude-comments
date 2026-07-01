import type { DeferralNotice, PageRating, PinStatus, QueueStatus } from "../messages.js";
import type {
  CommentMetadata,
  DraftRequest,
  Operation,
  QueuedRequest,
  SourceLocation,
} from "../types.js";

const QUEUE_KEY = "redline-queue";
const SESSION_KEY = "redline-session-id";
const SESSION_TOKEN_KEY = "redline-session-token";
const PORTS = [7474, 7475, 7476];
const PROBE_TIMEOUT_MS = 400;
const SERVER_CACHE_TTL_MS = 30_000;

interface CachedServer {
  info: ServerInfo;
  cachedAt: number;
}

let serverCache: CachedServer | null = null;

export interface ServerComment {
  id: string;
  url: string;
  comment: string;
  operation: Operation;
  operator: string;
  metadata: CommentMetadata;
  status: PinStatus;
  source?: SourceLocation | null;
}

interface Health {
  ok?: boolean;
  service?: string;
  root?: string;
  startedAt?: string;
  version?: number;
  watching?: boolean;
  notices?: DeferralNotice[];
}

interface ServerCandidate {
  port: number;
  root: string;
  startedAt: string;
  watching: boolean;
  notices: DeferralNotice[];
  version: number | null;
}

type LiveStatus = Pick<ServerCandidate, "version" | "watching" | "notices">;

interface ServerInfo extends ServerCandidate {
  token: string;
}

export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

function api(port: number, path: string): string {
  return `http://127.0.0.1:${port}${path}`;
}

function request(
  method: string,
  port: number,
  path: string,
  body?: unknown,
  token?: string,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers["X-Redline-Token"] = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return fetch(api(port, path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function getQueue(): Promise<QueuedRequest[]> {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  return (stored[QUEUE_KEY] as QueuedRequest[] | undefined) ?? [];
}

async function setQueue(queue: QueuedRequest[]): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

export async function getSessionId(): Promise<string> {
  const stored = await chrome.storage.local.get(SESSION_KEY);
  const existing = stored[SESSION_KEY] as string | undefined;
  if (existing) return existing;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [SESSION_KEY]: id });
  return id;
}

export async function getSessionToken(): Promise<string> {
  const stored = await chrome.storage.local.get(SESSION_TOKEN_KEY);
  const existing = stored[SESSION_TOKEN_KEY] as string | undefined;
  if (existing) return existing;
  const token = crypto.randomUUID();
  await chrome.storage.local.set({ [SESSION_TOKEN_KEY]: token });
  return token;
}

export async function enqueue(draft: DraftRequest): Promise<QueuedRequest> {
  const queue = await getQueue();
  const item: QueuedRequest = { ...draft, cid: crypto.randomUUID(), queuedAt: Date.now() };
  queue.push(item);
  await setQueue(queue);
  return item;
}

export async function listForUrl(url: string): Promise<QueuedRequest[]> {
  return (await getQueue()).filter((c) => c.url === url);
}

export async function remove(cid: string): Promise<void> {
  await setQueue((await getQueue()).filter((c) => c.cid !== cid));
}

export async function clearForUrl(url: string): Promise<void> {
  await setQueue((await getQueue()).filter((c) => c.url !== url));
}

export async function clearServerForUrl(url: string): Promise<void> {
  const server = await findServer();
  if (!server) return;
  try {
    await request(
      "DELETE",
      server.port,
      `/comments?url=${encodeURIComponent(url)}`,
      undefined,
      server.token,
    );
  } catch {
    serverCache = null;
  }
}

export async function clearAll(): Promise<void> {
  await setQueue([]);
  const server = await findServer();
  if (!server) return;
  try {
    await request("DELETE", server.port, "/comments?all=true", undefined, server.token);
  } catch {
    serverCache = null;
  }
}

export async function countAll(): Promise<number> {
  const local = (await getQueue()).length;
  const server = await findServer();
  if (!server) return local;
  try {
    const res = await request("GET", server.port, "/comments", undefined, server.token);
    if (!res.ok) return local;
    const all = (await res.json()) as unknown[];
    return local + all.length;
  } catch {
    serverCache = null;
    return local;
  }
}

export async function update(
  cid: string,
  text: string,
  opts?: { planFirst?: boolean; screenshotDataUrl?: string | null },
): Promise<void> {
  const queue = await getQueue();
  const item = queue.find((c) => c.cid === cid);
  if (item) {
    item.comment = text;
    if (opts?.planFirst !== undefined) item.planFirst = opts.planFirst;
    if (opts?.screenshotDataUrl !== undefined) item.screenshotDataUrl = opts.screenshotDataUrl;
    await setQueue(queue);
  }
}

async function probe(port: number): Promise<ServerCandidate | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(api(port, "/health"), { signal: ctrl.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as Health;
    if (body.service !== "redline" || !body.root || !body.startedAt) return null;
    return {
      port,
      root: body.root,
      startedAt: body.startedAt,
      watching: body.watching ?? false,
      notices: body.notices ?? [],
      version: body.version ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const enc = new TextEncoder();

async function hmacHex(key: string, message: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyServer(port: number, token: string): Promise<boolean> {
  const nonce = crypto.randomUUID();
  try {
    const res = await fetch(api(port, "/handshake"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nonce }),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { hmac?: string };
    if (!body.hmac || typeof body.hmac !== "string") return false;
    const expected = await hmacHex(token, nonce);
    return timingSafeEqual(body.hmac, expected);
  } catch {
    return false;
  }
}

async function findServer(): Promise<ServerInfo | null> {
  if (serverCache && Date.now() - serverCache.cachedAt < SERVER_CACHE_TTL_MS) {
    return serverCache.info;
  }
  serverCache = null;

  const token = await getSessionToken();
  const candidates = (await Promise.all(PORTS.map(probe))).filter(
    (r): r is ServerCandidate => r !== null,
  );
  if (candidates.length === 0) return null;

  for (const candidate of candidates.sort((a, b) => b.startedAt.localeCompare(a.startedAt))) {
    if (await verifyServer(candidate.port, token)) {
      const info: ServerInfo = { ...candidate, token };
      serverCache = { info, cachedAt: Date.now() };
      return info;
    }
  }
  return null;
}

export async function fetchServerComments(url: string): Promise<ServerComment[]> {
  const server = await findServer();
  if (!server) return [];
  try {
    const res = await request("GET", server.port, "/comments", undefined, server.token);
    if (!res.ok) return [];
    const all = (await res.json()) as ServerComment[];
    return all.filter((c) => c.url === url);
  } catch {
    serverCache = null;
    return [];
  }
}

export async function dismissNotice(commentId: string): Promise<void> {
  const server = await findServer();
  if (!server) return;
  try {
    await request("POST", server.port, "/notices/dismiss", { commentId }, server.token);
  } catch {
    serverCache = null;
  }
}

function statusFrom(server: ServerInfo | null, queued: number): QueueStatus {
  if (!server) {
    return {
      queued,
      serverReachable: false,
      port: null,
      root: null,
      watching: false,
      notices: [],
      version: null,
    };
  }
  return {
    queued,
    serverReachable: true,
    port: server.port,
    root: server.root,
    watching: server.watching,
    notices: server.notices,
    version: server.version,
  };
}

export async function flush(): Promise<QueueStatus> {
  const server = await findServer();
  const items = await getQueue();
  if (!server) return statusFrom(null, items.length);

  const sessionId = await getSessionId();
  const posted = new Set<string>();
  for (const item of items) {
    try {
      const { cid: _cid, queuedAt: _queuedAt, ...draft } = item;
      const res = await request(
        "POST",
        server.port,
        "/comments",
        { ...draft, sessionId },
        server.token,
      );
      if (res.ok) posted.add(item.cid);
    } catch {
      // keep the item queued for the next flush
    }
  }

  // Re-read the queue rather than overwriting it: items enqueued while we were
  // posting must survive, so only drop the cids we actually delivered.
  await setQueue((await getQueue()).filter((item) => !posted.has(item.cid)));

  const fresh = await findServer();
  return statusFrom(fresh, (await getQueue()).length);
}

// Discovery (port + token handshake) stays cached, but the watching flag and
// notices are read live every call so the toolbar reflects the session ending
// promptly. The GET /ping also refreshes the server's extension-alive heartbeat,
// so a disabled or closed extension stops pinging and the watcher releases.
async function livePing(server: ServerInfo): Promise<LiveStatus | null> {
  try {
    const res = await request("GET", server.port, "/ping", undefined, server.token);
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<LiveStatus>;
    return {
      version: body.version ?? null,
      watching: body.watching ?? false,
      notices: body.notices ?? [],
    };
  } catch {
    return null;
  }
}

export async function status(): Promise<QueueStatus> {
  const [queue, server] = await Promise.all([getQueue(), findServer()]);
  if (!server) return statusFrom(null, queue.length);
  const live = await livePing(server);
  if (!live) {
    serverCache = null;
    return statusFrom(null, queue.length);
  }
  return statusFrom({ ...server, ...live }, queue.length);
}

export async function reopenComment(id: string, note?: string): Promise<void> {
  const server = await findServer();
  if (!server) return;
  try {
    await request("POST", server.port, "/comments/reopen", { id, note }, server.token);
  } catch {
    serverCache = null;
  }
}

export async function requestRating(url: string, screenshotDataUrl: string | null): Promise<void> {
  const server = await findServer();
  if (!server) return;
  const sessionId = await getSessionId();
  try {
    await request(
      "POST",
      server.port,
      "/ratings",
      { url, screenshotDataUrl, sessionId },
      server.token,
    );
  } catch {
    serverCache = null;
  }
}

export async function fetchRating(url: string): Promise<PageRating | null> {
  const server = await findServer();
  if (!server) return null;
  try {
    const res = await request(
      "GET",
      server.port,
      `/ratings?url=${encodeURIComponent(url)}`,
      undefined,
      server.token,
    );
    if (!res.ok) return null;
    const ratings = (await res.json()) as Array<{
      id: string;
      status: "pending" | "scored";
      url: string;
      createdAt: string;
      result?: PageRating["result"];
    }>;
    const forUrl = ratings
      .filter((r) => r.url === url)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (!forUrl.length) return null;
    const latest = forUrl[0];
    return { id: latest.id, status: latest.status, result: latest.result };
  } catch {
    serverCache = null;
    return null;
  }
}
