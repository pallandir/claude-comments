import type { PinStatus, QueueStatus } from "../messages.js";
import type { DraftRequest, QueuedRequest, RequestKind } from "../types.js";

const QUEUE_KEY = "redline-queue";
const PORTS = [7474, 7475, 7476];

export interface ServerComment {
  id: string;
  url: string;
  text: string;
  status: PinStatus;
  kind: RequestKind;
  fingerprint: { selector: string };
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
  const port = await findPort();
  if (port === null) return;
  try {
    await fetch(`http://127.0.0.1:${port}/comments?url=${encodeURIComponent(url)}`, {
      method: "DELETE",
    });
  } catch {
    // server gone; local clear already happened
  }
}

export async function clearAll(): Promise<void> {
  await setQueue([]);
  const port = await findPort();
  if (port === null) return;
  try {
    await fetch(`http://127.0.0.1:${port}/comments`, { method: "DELETE" });
  } catch {
    // server gone; local clear already happened
  }
}

export async function countAll(): Promise<number> {
  const local = (await getQueue()).length;
  const port = await findPort();
  if (port === null) return local;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/comments`);
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

async function findPort(): Promise<number | null> {
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`, { method: "GET" });
      if (res.ok) return port;
    } catch {
      // try next port
    }
  }
  return null;
}

export async function fetchServerComments(url: string): Promise<ServerComment[]> {
  const port = await findPort();
  if (port === null) return [];
  try {
    const res = await fetch(`http://127.0.0.1:${port}/comments`);
    if (!res.ok) return [];
    const all = (await res.json()) as ServerComment[];
    return all.filter((c) => c.url === url);
  } catch {
    return [];
  }
}

export async function flush(): Promise<QueueStatus> {
  const port = await findPort();
  let queue = await getQueue();
  if (port === null) {
    return { queued: queue.length, serverReachable: false, port: null };
  }

  const remaining: QueuedRequest[] = [];
  for (const item of queue) {
    try {
      const { cid: _cid, queuedAt: _queuedAt, ...draft } = item;
      const res = await fetch(`http://127.0.0.1:${port}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) remaining.push(item);
    } catch {
      remaining.push(item);
    }
  }

  queue = remaining;
  await setQueue(queue);
  return { queued: queue.length, serverReachable: true, port };
}

export async function status(): Promise<QueueStatus> {
  const port = await findPort();
  const queue = await getQueue();
  return { queued: queue.length, serverReachable: port !== null, port };
}
