import { captureFingerprint } from "../lib/fingerprint.js";
import { resolveSource } from "../lib/source-map.js";
import type { Message } from "../messages.js";
import type { DraftComment } from "../types.js";
import overlayCss from "./overlay.css?inline";

let lastTarget: Element | null = null;

document.addEventListener(
  "contextmenu",
  (event) => {
    lastTarget = event.target as Element;
  },
  true,
);

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === "compose-here" && lastTarget) {
    openComposer(lastTarget);
  }
});

const host = document.createElement("div");
host.id = "claude-comments-root";
const shadow = host.attachShadow({ mode: "open" });
const style = document.createElement("style");
style.textContent = overlayCss;
shadow.append(style);

function ensureMounted(): void {
  if (!host.isConnected) document.documentElement.append(host);
}

function openComposer(target: Element): void {
  ensureMounted();
  const rect = target.getBoundingClientRect();

  const pin = document.createElement("div");
  pin.className = "cc-pin";
  pin.style.left = `${rect.left + window.scrollX}px`;
  pin.style.top = `${rect.top + window.scrollY}px`;

  const panel = document.createElement("div");
  panel.className = "cc-panel";
  panel.style.left = `${rect.left + window.scrollX}px`;
  panel.style.top = `${rect.bottom + window.scrollY + 8}px`;

  const textarea = document.createElement("textarea");
  textarea.placeholder = "What should Claude change here?";

  const actions = document.createElement("div");
  actions.className = "cc-actions";
  const save = document.createElement("button");
  save.textContent = "Save";
  save.className = "cc-save";
  const cancel = document.createElement("button");
  cancel.textContent = "Cancel";

  const teardown = () => {
    pin.remove();
    panel.remove();
  };

  cancel.addEventListener("click", teardown);
  save.addEventListener("click", async () => {
    const text = textarea.value.trim();
    if (!text) return teardown();
    await submit(target, text);
    teardown();
  });

  actions.append(save, cancel);
  panel.append(textarea, actions);
  shadow.append(pin, panel);
  textarea.focus();
}

async function submit(target: Element, text: string): Promise<void> {
  const draft: DraftComment = {
    url: location.href,
    text,
    source: resolveSource(target),
    fingerprint: captureFingerprint(target),
    screenshotDataUrl: null,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
  await chrome.runtime.sendMessage({ type: "save-comment", draft } satisfies Message);
}
