import { captureFingerprint } from "../lib/fingerprint.js";
import { resolveSource } from "../lib/source-map.js";
import type { Message, Response } from "../messages.js";
import type { DraftComment, Rect } from "../types.js";
import { Overlay } from "./overlay.js";

let lastTarget: Element | null = null;
const overlay = new Overlay();

document.addEventListener(
  "contextmenu",
  (event) => {
    lastTarget = event.target as Element;
  },
  true,
);

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === "compose-here" && lastTarget) void openComposer(lastTarget);
});

function send(message: Message): Promise<Response> {
  return chrome.runtime.sendMessage(message);
}

async function openComposer(target: Element): Promise<void> {
  const r = target.getBoundingClientRect();
  const rect: Rect = { x: r.x, y: r.y, w: r.width, h: r.height };

  overlay.setHidden(true);
  await nextPaint();
  const screenshot = await captureRegion(rect);
  overlay.setHidden(false);

  overlay.showComposer(target, (text) => submit(target, text, screenshot));
}

async function captureRegion(rect: Rect): Promise<string | null> {
  const res = await send({ type: "capture-region", rect, dpr: window.devicePixelRatio });
  return res.ok && res.dataUrl ? res.dataUrl : null;
}

async function submit(target: Element, text: string, screenshot: string | null): Promise<void> {
  const draft: DraftComment = {
    url: location.href,
    text,
    source: resolveSource(target),
    fingerprint: captureFingerprint(target),
    screenshotDataUrl: screenshot,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
  await send({ type: "save-comment", draft });
  await refreshPins();
}

async function refreshPins(): Promise<void> {
  const res = await send({ type: "page-comments", url: location.href });
  if (res.ok && res.pins) overlay.setPins(res.pins, (key) => void removePin(key));
}

async function removePin(cid: string): Promise<void> {
  await send({ type: "remove-comment", cid });
  await refreshPins();
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

void refreshPins();
