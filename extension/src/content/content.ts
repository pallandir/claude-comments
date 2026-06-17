import { captureFingerprint } from "../lib/fingerprint.js";
import { resolveSource } from "../lib/source-map.js";
import type { Message, PinModel, QueueStatus, Response } from "../messages.js";
import type { DraftRequest, Rect, RequestKind, StyleChange, TextChange } from "../types.js";
import { Drawer } from "./drawer.js";
import { downloadHandoff } from "./handoff.js";
import { Surface } from "./surface.js";
import { type ToolId, Toolbar } from "./toolbar.js";
import { openColorPanel, openTextEditor } from "./tools.js";

let active = false;
let precise = false;
let interacting = false;
let drawerOpen = false;
let lastPins: PinModel[] = [];
let lastStatus: QueueStatus | null = null;

const surface = new Surface();
let toolbar: Toolbar | null = null;
let drawer: Drawer | null = null;

function send(message: Message): Promise<Response> {
  return chrome.runtime.sendMessage(message);
}

chrome.runtime.onMessage.addListener((message: Message) => {
  if (message.type === "set-active") setActive(message.on);
});

function setActive(on: boolean): void {
  if (on === active) return;
  active = on;
  if (on) {
    toolbar = new Toolbar(surface, {
      onComments: toggleDrawer,
      onSend: handleSend,
      onHandoff: handleHandoff,
      onTogglePrecise,
      onReset: handleReset,
    });
    drawer = new Drawer(surface, {
      onEdit: (cid, text) => void editComment(cid, text),
      onRemove: (key) => void removePin(key),
      onClose: toggleDrawer,
    });
    void refresh();
  } else {
    surface.closeActionMenu();
    surface.setSelection(null);
    surface.highlightHover(null);
    surface.setPins([], () => {});
    toolbar?.destroy();
    drawer?.destroy();
    toolbar = null;
    drawer = null;
    interacting = false;
    drawerOpen = false;
    surface.unmount();
  }
  updateCursor();
}

document.addEventListener(
  "mousemove",
  (event) => {
    if (!active || interacting) return;
    if (surface.ownsEvent(event)) {
      surface.highlightHover(null);
      return;
    }
    surface.highlightHover(event.target as Element);
  },
  true,
);

document.addEventListener(
  "click",
  (event) => {
    if (!active || interacting || surface.ownsEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    surface.highlightHover(null);
    pick(event.target as Element);
  },
  true,
);

document.addEventListener(
  "keydown",
  (event) => {
    if (active && !interacting && event.key === "Escape") surface.setSelection(null);
  },
  true,
);

function pick(el: Element): void {
  surface.setSelection(el);
  render();

  interacting = true;
  updateCursor();
  surface.showActionMenu(el, {
    onComment: () => runTool("comment", el),
    onColor: () => runTool("color", el),
    onText: () => runTool("text", el),
    onDismiss: () => {
      interacting = false;
      updateCursor();
    },
  });
}

function runTool(which: Exclude<ToolId, "select">, el: Element): void {
  surface.closeActionMenu();
  interacting = true;
  updateCursor();
  const done = () => {
    interacting = false;
    updateCursor();
  };

  if (which === "comment") {
    surface.showComposer(
      el,
      async (text) => {
        done();
        await record("comment", el, { text });
      },
      done,
    );
  } else if (which === "color") {
    openColorPanel(
      surface,
      el as HTMLElement,
      (changes) => {
        done();
        void record("style", el, { text: "Change color", styleChanges: changes });
      },
      done,
    );
  } else {
    openTextEditor(
      surface,
      el as HTMLElement,
      (from, to) => {
        done();
        void record("text", el, { text: `Set text to "${to}"`, textChange: { from, to } });
      },
      done,
    );
  }
}

function toggleDrawer(): void {
  drawerOpen = !drawerOpen;
  drawer?.setOpen(drawerOpen, lastPins);
  render();
}

async function onTogglePrecise(): Promise<void> {
  if (precise) {
    precise = false;
    render();
    return;
  }
  const res = await send({ type: "precise-status" });
  if (res.ok && res.granted) {
    precise = true;
  } else {
    await send({ type: "open-settings" });
    surface.showModal({
      title: "Precise mode needs one-time access",
      body: "Precise CSS source mapping uses the Chrome debugger. Grant access in the settings tab that just opened, then toggle Precise again.",
      actions: [{ label: "Got it", variant: "ghost", onClick: () => {} }],
      onDismiss: () => {},
    });
  }
  render();
}

interface RecordPayload {
  text: string;
  styleChanges?: StyleChange[];
  textChange?: TextChange;
}

async function record(kind: RequestKind, el: Element, payload: RecordPayload): Promise<void> {
  const fingerprint = captureFingerprint(el);
  let styleChanges = payload.styleChanges;
  if (kind === "style" && precise && styleChanges) {
    styleChanges = await attachCssSources(fingerprint.selector, styleChanges);
  }

  const r = el.getBoundingClientRect();
  const rect: Rect = { x: r.x, y: r.y, w: r.width, h: r.height };
  surface.setHidden(true);
  await nextPaint();
  const screenshot = await captureRegion(rect);
  surface.setHidden(false);

  const draft: DraftRequest = {
    kind,
    url: location.href,
    text: payload.text,
    styleChanges,
    textChange: payload.textChange,
    source: resolveSource(el),
    fingerprint,
    screenshotDataUrl: screenshot,
    viewport: { w: window.innerWidth, h: window.innerHeight },
  };
  await send({ type: "save-request", draft });
  await refresh();
}

async function attachCssSources(selector: string, changes: StyleChange[]): Promise<StyleChange[]> {
  return Promise.all(
    changes.map(async (change) => {
      const res = await send({ type: "resolve-style-source", selector, property: change.property });
      return res.ok && res.cssSource ? { ...change, cssSource: res.cssSource } : change;
    }),
  );
}

async function captureRegion(rect: Rect): Promise<string | null> {
  const res = await send({ type: "capture-region", rect, dpr: window.devicePixelRatio });
  return res.ok && res.dataUrl ? res.dataUrl : null;
}

async function handleSend(): Promise<void> {
  await send({ type: "flush" });
  await refresh();
}

async function handleHandoff(): Promise<void> {
  const res = await send({ type: "get-comments", url: location.href });
  if (res.ok && res.comments && res.comments.length > 0) downloadHandoff(res.comments);
}

async function editComment(cid: string, text: string): Promise<void> {
  await send({ type: "update-comment", cid, text });
  await refresh();
}

async function handleReset(): Promise<void> {
  const pageCount = lastPins.length;
  const totalRes = await send({ type: "count-all" });
  const total = totalRes.ok && typeof totalRes.count === "number" ? totalRes.count : pageCount;
  if (total === 0) return;

  interacting = true;
  updateCursor();
  surface.showModal({
    title: "Delete comments?",
    body: "This permanently removes the selected comments and their saved screenshots from this repo. This cannot be undone.",
    actions: [
      {
        label: `This page (${pageCount})`,
        variant: "danger",
        onClick: () => void clearPage(),
      },
      {
        label: `Everything, all pages (${total})`,
        variant: "danger",
        onClick: () => void clearEverything(),
      },
      { label: "Cancel", variant: "ghost", onClick: () => {} },
    ],
    onDismiss: () => {
      interacting = false;
      updateCursor();
    },
  });
}

async function clearPage(): Promise<void> {
  await send({ type: "clear-comments", url: location.href });
  await refresh();
}

async function clearEverything(): Promise<void> {
  await send({ type: "clear-all" });
  await refresh();
}

async function refresh(): Promise<void> {
  const [pinsRes, statusRes] = await Promise.all([
    send({ type: "page-comments", url: location.href }),
    send({ type: "queue-status" }),
  ]);
  lastPins = pinsRes.ok && pinsRes.pins ? pinsRes.pins : [];
  lastStatus = statusRes.ok ? (statusRes.status ?? null) : null;
  surface.setPins(lastPins, (key) => void removePin(key));
  render();
}

async function removePin(cid: string): Promise<void> {
  await send({ type: "remove-comment", cid });
  await refresh();
}

function render(): void {
  toolbar?.render({ count: lastPins.length, status: lastStatus, precise, drawerOpen });
  drawer?.render(lastPins);
}

function updateCursor(): void {
  document.documentElement.style.cursor = active && !interacting ? "crosshair" : "";
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
