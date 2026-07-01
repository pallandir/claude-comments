import type { Message, QueueStatus } from "../messages.js";

async function send(
  message: Message,
): Promise<{ ok: boolean; status?: QueueStatus; active?: boolean }> {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch {
    return { ok: false };
  }
}

async function init(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    app.innerHTML = `<p class="rl-unavailable">No active tab found.</p>`;
    return;
  }

  const tabId = tab.id;
  const tabUrl = tab.url ?? "";

  const [activeRes, statusRes] = await Promise.all([
    send({ type: "sync-active", tabId }),
    send({ type: "tab-status", tabId, url: tabUrl }),
  ]);

  const isActive = Boolean(activeRes.ok && activeRes.active);
  const status = statusRes.ok ? (statusRes.status ?? null) : null;

  render(app, { isActive, status, tabId });
}

interface State {
  isActive: boolean;
  status: QueueStatus | null;
  tabId: number;
}

function render(app: HTMLElement, state: State): void {
  const { isActive, status, tabId } = state;
  const watching = Boolean(status?.watching);

  app.innerHTML = "";

  const header = el("div", "rl-header");
  const wordmark = el("span", "rl-wordmark");
  wordmark.textContent = "Redline";
  const badge = el("span", watching ? "rl-badge rl-badge--live" : "rl-badge");
  badge.textContent = watching ? "● Watching" : isActive ? "Active" : "";
  header.append(wordmark, badge);

  const body = el("div", "rl-body");

  const activateRow = el("div", "rl-activate");
  const activateText = el("div", "");
  const activateLabel = el("div", "rl-activate-label");
  activateLabel.textContent = isActive ? "Overlay active" : "Activate on this page";
  const activateSub = el("div", "rl-activate-sub");
  activateSub.textContent = isActive
    ? "Click elements to leave comments."
    : "Enables element picking and the comment toolbar.";
  activateText.append(activateLabel, activateSub);

  const activateBtn = el(
    "button",
    `cc-btn ${isActive ? "cc-btn--secondary" : "cc-btn--primary"}`,
  ) as HTMLButtonElement;
  activateBtn.textContent = isActive ? "Deactivate" : "Activate";
  activateBtn.addEventListener("click", async () => {
    activateBtn.disabled = true;
    await send({ type: "set-overlay", tabId, on: !isActive });
    window.close();
  });

  activateRow.append(activateText, activateBtn);

  const divider1 = el("div", "rl-divider");

  const tips = el("div", "rl-tips");
  const tipsTitle = el("div", "rl-tips-title");
  tipsTitle.textContent = "How it works";
  tips.append(
    tipsTitle,
    tipItem(1, "Activate on your local dev page."),
    tipItem(2, "Click any element to leave a comment."),
    tipItem(3, 'Hit "Send to AI" to flush your batch.'),
    tipItem(4, "Paste the command into your AI assistant."),
  );

  body.append(activateRow, divider1, tips);

  app.append(header, body);
}

function tipItem(num: number, text: string): HTMLElement {
  const tip = el("div", "rl-tip");
  const n = el("span", "rl-tip-num");
  n.textContent = String(num);
  const t = el("span", "");
  t.textContent = text;
  tip.append(n, t);
  return tip;
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}

void init();
