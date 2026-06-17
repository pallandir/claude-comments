import type { Message, PinModel, Response } from "../messages.js";

const statusEl = document.getElementById("status") as HTMLParagraphElement;
const listEl = document.getElementById("list") as HTMLUListElement;
const flushBtn = document.getElementById("flush") as HTMLButtonElement;

function send(message: Message): Promise<Response> {
  return chrome.runtime.sendMessage(message);
}

async function activeTabUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? null;
}

function paintStatus(res: Response): void {
  if (!res.ok || !res.status) {
    statusEl.textContent = res.ok ? "No status." : res.error;
    return;
  }
  const { queued, serverReachable, port } = res.status;
  statusEl.textContent = serverReachable
    ? `Connected on :${port}. ${queued} queued.`
    : `Claude Code not running. ${queued} queued, will sync when it starts.`;
}

function renderList(pins: PinModel[]): void {
  listEl.replaceChildren();
  if (pins.length === 0) {
    const empty = document.createElement("li");
    empty.className = "cc-empty";
    empty.textContent = "No comments on this page.";
    listEl.append(empty);
    return;
  }

  for (const pin of pins) {
    const item = document.createElement("li");

    const badge = document.createElement("span");
    badge.className = `cc-badge cc-badge--${pin.status}`;
    badge.textContent = pin.status === "pending" ? "queued" : pin.status;

    const text = document.createElement("span");
    text.className = "cc-text";
    text.textContent = pin.text;

    item.append(badge, text);

    if (pin.removable) {
      const remove = document.createElement("button");
      remove.className = "cc-remove";
      remove.textContent = "✕";
      remove.title = "Remove";
      remove.addEventListener("click", async () => {
        await send({ type: "remove-comment", cid: pin.key });
        await refresh();
      });
      item.append(remove);
    }

    listEl.append(item);
  }
}

async function refresh(): Promise<void> {
  paintStatus(await send({ type: "queue-status" }));
  const url = await activeTabUrl();
  if (!url) return;
  const res = await send({ type: "page-comments", url });
  if (res.ok && res.pins) renderList(res.pins);
}

flushBtn.addEventListener("click", async () => {
  flushBtn.disabled = true;
  paintStatus(await send({ type: "flush" }));
  await refresh();
  flushBtn.disabled = false;
});

void refresh();
