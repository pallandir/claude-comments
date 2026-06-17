import contentScript from "./content/content.ts?script";
import { captureRegion } from "./lib/capture.js";
import {
  clearAll,
  clearForUrl,
  clearServerForUrl,
  countAll,
  decidePlan,
  enqueue,
  fetchServerComments,
  flush,
  isLocalUrl,
  listForUrl,
  remove,
  status,
  update,
} from "./lib/transport.js";
import type { Message, PinModel, QueueStatus, Response } from "./messages.js";

const FLUSH_ALARM = "redline-flush";
const ACTIVE_KEY = "cc-active";

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
  void chrome.action.setBadgeBackgroundColor({ color: "#d97757" });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) void flush();
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id === undefined) return;
  const next = !(await isActive(tab.id));

  if (next && !(await injectOverlay(tab.id))) return;

  await setActive(tab.id, next);
  await chrome.action.setBadgeText({ tabId: tab.id, text: next ? "ON" : "" });
  chrome.tabs
    .sendMessage(tab.id, { type: "set-active", on: next } satisfies Message)
    .catch(() => {});
});

// The overlay is injected only here, into the one tab the user just clicked, under
// the activeTab grant. The content script guards against re-injection, so toggling
// off then on without a reload is safe. Restricted pages (chrome://, the Web
// Store, view-source) reject injection; we report that and stay off.
async function injectOverlay(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: [contentScript] });
    return true;
  } catch {
    await chrome.action.setBadgeText({ tabId, text: "n/a" });
    return false;
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  void setActive(tabId, false);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status !== "loading") return;
  void setActive(tabId, false);
  void chrome.action.setBadgeText({ tabId, text: "" });
});

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  handle(message, sender)
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: (err as Error).message }));
  return true;
});

async function handle(message: Message, sender: chrome.runtime.MessageSender): Promise<Response> {
  switch (message.type) {
    case "capture-region": {
      try {
        const dataUrl = await captureRegion(sender.tab?.windowId, message.rect, message.dpr);
        return { ok: true, dataUrl };
      } catch (err) {
        console.warn("[redline] capture failed:", (err as Error).message);
        return { ok: true, dataUrl: null };
      }
    }
    case "save-request": {
      const item = await enqueue(message.draft);
      const result = isLocalUrl(message.draft.url) ? await flush() : offlineStatus();
      return { ok: true, status: result, cid: item.cid };
    }
    case "page-comments":
      return { ok: true, pins: await pagePins(message.url) };
    case "plan-decision": {
      if (!isLocalUrl(sender.tab?.url ?? "")) return { ok: true, status: offlineStatus() };
      await decidePlan(message.id, message.decision);
      return { ok: true, status: await status() };
    }
    case "get-comments":
      return { ok: true, comments: await listForUrl(message.url) };
    case "remove-comment":
      await remove(message.cid);
      return { ok: true, status: await status() };
    case "clear-comments":
      await clearForUrl(message.url);
      await clearServerForUrl(message.url);
      return { ok: true, status: await status() };
    case "clear-all":
      await clearAll();
      return { ok: true, status: await status() };
    case "count-all":
      return { ok: true, count: await countAll() };
    case "update-comment":
      await update(message.cid, message.text);
      return { ok: true, status: await status() };
    case "flush": {
      const local = isLocalUrl(sender.tab?.url ?? "");
      return { ok: true, status: local ? await flush() : offlineStatus() };
    }
    case "queue-status": {
      const local = isLocalUrl(sender.tab?.url ?? "");
      return { ok: true, status: local ? await status() : offlineStatus() };
    }
    default:
      return { ok: false, error: `unhandled message: ${(message as Message).type}` };
  }
}

function offlineStatus(): QueueStatus {
  return { queued: 0, serverReachable: false, port: null, root: null, watching: false, plan: null };
}

async function isActive(tabId: number): Promise<boolean> {
  const stored = await chrome.storage.session.get(ACTIVE_KEY);
  const map = (stored[ACTIVE_KEY] as Record<number, boolean> | undefined) ?? {};
  return Boolean(map[tabId]);
}

async function setActive(tabId: number, on: boolean): Promise<void> {
  const stored = await chrome.storage.session.get(ACTIVE_KEY);
  const map = (stored[ACTIVE_KEY] as Record<number, boolean> | undefined) ?? {};
  if (on) map[tabId] = true;
  else delete map[tabId];
  await chrome.storage.session.set({ [ACTIVE_KEY]: map });
}

async function pagePins(url: string): Promise<PinModel[]> {
  const [queued, synced] = await Promise.all([
    listForUrl(url),
    isLocalUrl(url) ? fetchServerComments(url) : Promise.resolve([]),
  ]);
  return [
    ...queued.map(
      (q): PinModel => ({
        key: q.cid,
        selector: q.fingerprint.selector,
        text: q.text,
        status: "pending",
        kind: q.kind,
        removable: true,
      }),
    ),
    ...synced.map(
      (s): PinModel => ({
        key: s.id,
        selector: s.fingerprint.selector,
        text: s.text,
        status: s.status,
        kind: s.kind,
        removable: false,
      }),
    ),
  ];
}
