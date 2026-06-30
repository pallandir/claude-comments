import contentScript from "./content/content.ts?script";
import { captureRegion } from "./lib/capture.js";
import {
  clearAll,
  clearForUrl,
  clearServerForUrl,
  countAll,
  dismissNotice,
  enqueue,
  fetchRating,
  fetchServerComments,
  flush,
  getSessionToken,
  isLocalUrl,
  listForUrl,
  remove,
  reopenComment,
  requestRating,
  status,
  update,
} from "./lib/transport.js";
import type { Message, PinModel, QueueStatus, Response } from "./messages.js";
import type { SourceLocation } from "./types.js";

const ACTIVE_KEY = "cc-active";

chrome.runtime.onInstalled.addListener(() => {
  void chrome.action.setBadgeBackgroundColor({ color: "#d97757" });
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
  if (sender.id !== chrome.runtime.id) return { ok: false, error: "forbidden" };
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
      const result = isLocalUrl(sender.tab?.url ?? "") ? await status() : offlineStatus();
      return { ok: true, status: result, cid: item.cid };
    }
    case "page-comments":
      return { ok: true, pins: await pagePins(message.url, sender.tab?.url) };
    case "dismiss-notice": {
      if (!isLocalUrl(sender.tab?.url ?? "")) return { ok: true, status: offlineStatus() };
      await dismissNotice(message.commentId);
      return { ok: true, status: await status() };
    }
    case "get-comments":
      return { ok: true, comments: await listForUrl(message.url) };
    case "remove-comment":
      await remove(message.cid);
      return { ok: true, status: await status() };
    case "clear-comments":
      await clearForUrl(message.url);
      if (isLocalUrl(sender.tab?.url ?? "")) await clearServerForUrl(message.url);
      return { ok: true, status: await status() };
    case "clear-all":
      await clearAll();
      return { ok: true, status: await status() };
    case "count-all":
      return { ok: true, count: isLocalUrl(sender.tab?.url ?? "") ? await countAll() : 0 };
    case "update-comment":
      await update(message.cid, message.text);
      return { ok: true, status: await status() };
    case "flush": {
      const local = isLocalUrl(sender.tab?.url ?? "");
      return { ok: true, status: local ? await flush() : offlineStatus() };
    }
    case "queue-status": {
      const local = isLocalUrl(sender.tab?.url ?? "");
      if (!local) return { ok: true, status: offlineStatus() };
      const st = await status();
      const rating = sender.tab?.url ? await fetchRating(sender.tab.url) : null;
      return { ok: true, status: { ...st, sessionId: await getSessionToken(), rating } };
    }
    case "request-rating": {
      if (!isLocalUrl(sender.tab?.url ?? "")) return { ok: true };
      await requestRating(message.url, message.screenshotDataUrl);
      return { ok: true };
    }
    case "reopen-comment": {
      if (!isLocalUrl(sender.tab?.url ?? "")) return { ok: true };
      await reopenComment(message.id, message.note);
      return { ok: true };
    }
    default:
      return { ok: false, error: `unhandled message: ${(message as Message).type}` };
  }
}

function offlineStatus(): QueueStatus {
  return {
    queued: 0,
    serverReachable: false,
    port: null,
    root: null,
    watching: false,
    notices: [],
  };
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

async function pagePins(url: string, tabUrl?: string): Promise<PinModel[]> {
  const [queued, synced] = await Promise.all([
    listForUrl(url),
    isLocalUrl(tabUrl ?? "") ? fetchServerComments(url) : Promise.resolve([]),
  ]);
  return [
    ...queued.map(
      (q): PinModel => ({
        key: q.cid,
        operator: q.operator,
        text: q.comment,
        status: "pending",
        kind: q.operation.type,
        removable: true,
        route: routeOf(q.url),
        target: targetLabel(q.operator, q.source, q.metadata.elementText),
        operation: { property: q.operation.property, from: q.operation.from, to: q.operation.to },
      }),
    ),
    ...synced.map(
      (s): PinModel => ({
        key: s.id,
        operator: s.operator,
        text: s.comment,
        status: s.status === "open" ? "processing" : s.status,
        kind: s.operation.type,
        removable: false,
        route: s.metadata.page,
        target: targetLabel(s.operator, s.source ?? null, s.metadata.elementText),
        operation: { property: s.operation.property, from: s.operation.from, to: s.operation.to },
      }),
    ),
  ];
}

function routeOf(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function targetLabel(xpath: string, source: SourceLocation | null, elementText: string): string {
  if (source?.path) {
    const base = source.path.split(/[\\/]/).pop() ?? source.path;
    const name = base.replace(/\.[^.]+$/, "");
    if (name) return name;
  }
  const tag = lastTag(xpath);
  const text = elementText.trim();
  return text ? `${tag} · ${text.length > 22 ? `${text.slice(0, 22)}…` : text}` : tag;
}

function lastTag(xpath: string): string {
  const part = xpath.split("/").pop() ?? "";
  const idMatch = part.match(/@id="([^"]+)"/);
  if (idMatch) return `#${idMatch[1]}`;
  const tagMatch = part.match(/^([a-zA-Z][\w-]*)/);
  return tagMatch ? `<${tagMatch[1]}>` : "element";
}
