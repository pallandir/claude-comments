import { resolveStyleSource } from "./lib/cdp.js";
import {
  clearAll,
  clearForUrl,
  clearServerForUrl,
  countAll,
  enqueue,
  fetchServerComments,
  flush,
  listForUrl,
  remove,
  status,
  update,
} from "./lib/transport.js";
import type { Message, PinModel, Response } from "./messages.js";

const FLUSH_ALARM = "claude-comments-flush";
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
  await setActive(tab.id, next);
  await chrome.action.setBadgeText({ tabId: tab.id, text: next ? "ON" : "" });
  chrome.tabs
    .sendMessage(tab.id, { type: "set-active", on: next } satisfies Message)
    .catch(() => {});
});

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
    case "resolve-style-source": {
      const tabId = sender.tab?.id;
      if (tabId === undefined) return { ok: true, cssSource: null };
      try {
        return {
          ok: true,
          cssSource: await resolveStyleSource(tabId, message.selector, message.property),
        };
      } catch {
        return { ok: true, cssSource: null };
      }
    }
    case "capture-region": {
      try {
        const { captureRegion } = await import("./lib/capture.js");
        const dataUrl = await captureRegion(sender.tab?.windowId, message.rect, message.dpr);
        return { ok: true, dataUrl };
      } catch {
        return { ok: true, dataUrl: null };
      }
    }
    case "save-request": {
      const item = await enqueue(message.draft);
      const result = await flush();
      return { ok: true, status: result, cid: item.cid };
    }
    case "page-comments":
      return { ok: true, pins: await pagePins(message.url) };
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
    case "flush":
      return { ok: true, status: await flush() };
    case "queue-status":
      return { ok: true, status: await status() };
    default:
      return { ok: false, error: `unhandled message: ${(message as Message).type}` };
  }
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
  const [queued, synced] = await Promise.all([listForUrl(url), fetchServerComments(url)]);
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
