import type { QueueStatus } from "../messages.js";
import type { DraftComment, QueuedComment } from "../types.js";

const QUEUE_KEY = "claude-comments-queue";
const PORTS = [7474, 7475, 7476];

async function getQueue(): Promise<QueuedComment[]> {
  const stored = await chrome.storage.local.get(QUEUE_KEY);
  return (stored[QUEUE_KEY] as QueuedComment[] | undefined) ?? [];
}

async function setQueue(queue: QueuedComment[]): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue });
}

export async function enqueue(draft: DraftComment): Promise<void> {
  const queue = await getQueue();
  queue.push({ ...draft, queuedAt: Date.now() });
  await setQueue(queue);
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

export async function flush(): Promise<QueueStatus> {
  const port = await findPort();
  let queue = await getQueue();
  if (port === null) {
    return { queued: queue.length, serverReachable: false, port: null };
  }

  const remaining: QueuedComment[] = [];
  for (const item of queue) {
    try {
      const { queuedAt: _queuedAt, ...draft } = item;
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
