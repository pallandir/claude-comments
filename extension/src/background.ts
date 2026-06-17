import { enqueue, flush, status } from "./lib/transport.js";
import type { Message, Response } from "./messages.js";

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

chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
  void handle(message).then(sendResponse);
  return true;
});

async function handle(message: Message): Promise<Response> {
  switch (message.type) {
    case "save-comment": {
      await enqueue(message.draft);
      const result = await flush();
      return { ok: true, status: result };
    }
    case "flush":
      return { ok: true, status: await flush() };
    case "queue-status":
      return { ok: true, status: await status() };
    default:
      return { ok: false, error: `unhandled message: ${(message as Message).type}` };
  }
}
