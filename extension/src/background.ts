import { captureRegion } from "./lib/capture.js";
import {
  enqueue,
  fetchServerComments,
  flush,
  listForUrl,
  remove,
  status,
} from "./lib/transport.js";
import type { Message, PinModel, Response } from "./messages.js";

const MENU_ID = "claude-comments-add";
const FLUSH_ALARM = "claude-comments-flush";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Add Claude comment",
    contexts: ["all"],
    documentUrlPatterns: ["http://localhost/*", "http://127.0.0.1/*"],
  });
  chrome.alarms.create(FLUSH_ALARM, { periodInMinutes: 1 });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID || tab?.id === undefined) return;
  chrome.tabs.sendMessage(tab.id, { type: "compose-here" } satisfies Message);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === FLUSH_ALARM) void flush();
});

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  void handle(message, sender).then(sendResponse);
  return true;
});

async function handle(message: Message, sender: chrome.runtime.MessageSender): Promise<Response> {
  switch (message.type) {
    case "capture-region": {
      const dataUrl = await captureRegion(sender.tab?.windowId, message.rect, message.dpr);
      return { ok: true, dataUrl };
    }
    case "save-comment": {
      const item = await enqueue(message.draft);
      const result = await flush();
      return { ok: true, status: result, cid: item.cid };
    }
    case "page-comments":
      return { ok: true, pins: await pagePins(message.url) };
    case "remove-comment":
      await remove(message.cid);
      return { ok: true, status: await status() };
    case "flush":
      return { ok: true, status: await flush() };
    case "queue-status":
      return { ok: true, status: await status() };
    default:
      return { ok: false, error: `unhandled message: ${(message as Message).type}` };
  }
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
        removable: true,
      }),
    ),
    ...synced.map(
      (s): PinModel => ({
        key: s.id,
        selector: s.fingerprint.selector,
        text: s.text,
        status: s.status,
        removable: false,
      }),
    ),
  ];
}
