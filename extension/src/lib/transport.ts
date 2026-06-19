import type { PinStatus, PlanView, QueueStatus } from "../messages.js";
import type { DraftRequest, QueuedRequest, RequestKind, SourceLocation } from "../types.js";

const QUEUE_KEY = "redline-queue";
const PORTS = [7474, 7475, 7476];
const PROBE_TIMEOUT_MS = 400;
const WATCH_TTL_MS = 35_000;

export interface ServerComment {
  id: string;
  url: string;
  route?: string;
  text: string;
  status: PinStatus;
  kind: RequestKind;
  source?: SourceLocation | null;
  fingerprint: { selector: string; innerText?: string };
}

interface Lease {
  pid: number;
  startedAt: string;
  heartbeatAt: string;
}

interface Health {
  ok?: boolean;
  service?: string;
  root?: string;
  startedAt?: string;
  version?: number;
  lastPolledAt?: string | null;
  lease?: Lease | null;
}

interface ServerInfo {
  port: number;
  root: string;
  startedAt: string;
  lastPolledAt: string | null;
  lease: Lease | null;
}

// A page is "local" when it is served from this machine. Only then may the
// extension reach the loopback ingest server; on a deployed site it must not.
export function isLocalUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

function api(port: number, path: string): string {
  return `http://127.0.0.1:${port}${path}`;
}

function postJson(port: number, path: string, body: unknown): Promise<Response> {
  return fetch(api(port, path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getQueue(): Promise<QueuedRequest[]> {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  return (stored[QUEUE_KEY] as QueuedRequest[] | undefined) ?? [];
}

async function setQueue(queue: QueuedRequest[]): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
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
    await fetch(api(server.port, `/comments?url=${encodeURIComponent(url)}`), {
      method: "DELETE",
    });
  } catch {
    // server gone; local clear already happened
  }
}

export async function clearAll(): Promise<void> {
  await setQueue([]);
  const server = await findServer();
  if (!server) return;
  try {
    await fetch(api(server.port, "/comments"), { method: "DELETE" });
  } catch {
    // server gone; local clear already happened
  }
}

export async function countAll(): Promise<number> {
  const local = (await getQueue()).length;
  const server = await findServer();
  if (!server) return local;
  try {
    const res = await fetch(api(server.port, "/comments"));
    if (!res.ok) return local;
    const all = (await res.json()) as unknown[];
    return local + all.length;
  } catch {
    return local;
  }
}

export async function update(cid: string, text: string): Promise<void> {
  const queue = await getQueue();
  const item = queue.find((c) => c.cid === cid);
  if (item) {
    item.text = text;
    await setQueue(queue);
  }
}

async function probe(port: number): Promise<ServerInfo | null> {
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
      lastPolledAt: body.lastPolledAt ?? null,
      lease: body.lease ?? null,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Several redline servers can be alive at once (one per editor session, or a
// stale one squatting a port). Probe them all and pick the most recently
// started: that is the live session, never a leftover from a prior run.
async function findServer(): Promise<ServerInfo | null> {
  const live = (await Promise.all(PORTS.map(probe))).filter((r): r is ServerInfo => r !== null);
  if (live.length === 0) return null;
  return live.reduce((best, cur) => (cur.startedAt > best.startedAt ? cur : best));
}

function isWatching(lease: Lease | null): boolean {
  if (!lease) return false;
  return Date.now() - Date.parse(lease.heartbeatAt) < WATCH_TTL_MS;
}

export async function fetchServerComments(url: string): Promise<ServerComment[]> {
  const server = await findServer();
  if (!server) return [];
  try {
    const res = await fetch(api(server.port, "/comments"));
    if (!res.ok) return [];
    const all = (await res.json()) as ServerComment[];
    return all.filter((c) => c.url === url);
  } catch {
    return [];
  }
}

async function fetchPlan(port: number): Promise<PlanView | null> {
  try {
    const res = await fetch(api(port, "/plan"));
    if (!res.ok) return null;
    return (await res.json()) as PlanView | null;
  } catch {
    return null;
  }
}

export async function decidePlan(id: string, decision: "approve" | "reject"): Promise<void> {
  const server = await findServer();
  if (!server) return;
  try {
    await postJson(server.port, "/plan/decision", { id, decision });
  } catch {
    // server gone; caller will re-poll status
  }
}

async function statusFrom(server: ServerInfo | null): Promise<QueueStatus> {
  const queued = (await getQueue()).length;
  if (!server) {
    return { queued, serverReachable: false, port: null, root: null, watching: false, plan: null };
  }
  return {
    queued,
    serverReachable: true,
    port: server.port,
    root: server.root,
    watching: isWatching(server.lease),
    plan: await fetchPlan(server.port),
  };
}

export async function flush(): Promise<QueueStatus> {
  const server = await findServer();
  if (!server) return statusFrom(null);

  const posted = new Set<string>();
  for (const item of await getQueue()) {
    try {
      const { cid: _cid, queuedAt: _queuedAt, ...draft } = item;
      const res = await postJson(server.port, "/comments", draft);
      if (res.ok) posted.add(item.cid);
    } catch {
      // keep the item queued for the next flush
    }
  }

  // Re-read the queue rather than overwriting it: items enqueued while we were
  // posting must survive, so only drop the cids we actually delivered.
  await setQueue((await getQueue()).filter((item) => !posted.has(item.cid)));
  return statusFrom(server);
}

export async function status(): Promise<QueueStatus> {
  return statusFrom(await findServer());
}
