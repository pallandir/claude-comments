import { captureFingerprint } from "../lib/fingerprint.js";
import { resolveSource } from "../lib/source-map.js";
import type { Message, PinModel, QueueStatus, Response } from "../messages.js";
import type { DraftRequest, Rect, RequestKind, StyleChange, TextChange } from "../types.js";
import { Drawer, type DrawerContext } from "./drawer.js";
import { downloadHandoff } from "./handoff.js";
import { Surface } from "./surface.js";
import { type Mode, type ToolId, Toolbar } from "./toolbar.js";
import { openColorPanel, openTextEditor } from "./tools.js";

declare global {
  interface Window {
    __redlineLoaded?: boolean;
  }
}

if (!window.__redlineLoaded) {
  window.__redlineLoaded = true;
  init();
}

const STATUS_POLL_MS = 5000;
const CHECK_TIMEOUT_MS = 4000;

function pageMode(): Mode {
  const host = location.hostname;
  const local =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local");
  return local ? "local" : "remote";
}

function init(): void {
  let active = false;
  let interacting = false;
  let drawerOpen = false;
  let checking = false;
  let lastPins: PinModel[] = [];
  let lastStatus: QueueStatus | null = null;
  let pollTimer: number | null = null;
  const mode = pageMode();

  const surface = new Surface();
  let toolbar: Toolbar | null = null;
  let drawer: Drawer | null = null;

  async function send(message: Message): Promise<Response> {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
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
        onHandoff: handleHandoff,
        onReset: handleReset,
        onReconnect: handleReconnect,
        onApprove: (id) => void handleDecision(id, "approve"),
        onReject: (id) => void handleDecision(id, "reject"),
      });
      drawer = new Drawer(surface, {
        onEdit: (cid, text) => void editComment(cid, text),
        onRemove: (key) => void removePin(key),
        onClose: toggleDrawer,
      });
      void refresh();
      startPolling();
    } else {
      stopPolling();
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
      checking = false;
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
        (changes, summary) => {
          done();
          void record("style", el, { text: summary, styleChanges: changes });
        },
        done,
      );
    } else {
      openTextEditor(
        surface,
        el as HTMLElement,
        (from, to) => {
          done();
          const text = from ? `Change text from "${from}" to "${to}"` : `Set text to "${to}"`;
          void record("text", el, { text, textChange: { from, to } });
        },
        done,
      );
    }
  }

  function toggleDrawer(): void {
    drawerOpen = !drawerOpen;
    drawer?.setOpen(drawerOpen, lastPins, drawerCtx());
    render();
  }

  function drawerCtx(): DrawerContext {
    return {
      mode,
      connected: Boolean(lastStatus?.serverReachable) && !checking,
      watching: Boolean(lastStatus?.watching),
    };
  }

  interface RecordPayload {
    text: string;
    styleChanges?: StyleChange[];
    textChange?: TextChange;
  }

  async function record(kind: RequestKind, el: Element, payload: RecordPayload): Promise<void> {
    const fingerprint = captureFingerprint(el);
    const styleChanges = payload.styleChanges;

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

  async function captureRegion(rect: Rect): Promise<string | null> {
    const res = await send({ type: "capture-region", rect, dpr: window.devicePixelRatio });
    return res.ok && res.dataUrl ? res.dataUrl : null;
  }

  async function handleDecision(id: string, decision: "approve" | "reject"): Promise<void> {
    await send({ type: "plan-decision", id, decision });
    await refresh();
  }

  async function handleReconnect(): Promise<void> {
    if (checking) return;
    checking = true;
    render();
    await withTimeout(refresh(), CHECK_TIMEOUT_MS).catch(() => {});
    checking = false;
    render();
  }

  function startPolling(): void {
    if (pollTimer !== null) return;
    pollTimer = window.setInterval(() => void pollStatus(), STATUS_POLL_MS);
  }

  function stopPolling(): void {
    if (pollTimer === null) return;
    window.clearInterval(pollTimer);
    pollTimer = null;
  }

  async function pollStatus(): Promise<void> {
    if (!active || checking) return;
    const res = await send({ type: "queue-status" });
    const next = res.ok ? (res.status ?? null) : null;
    if (!statusChanged(lastStatus, next)) return;
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
    toolbar?.render({ mode, count: lastPins.length, status: lastStatus, drawerOpen, checking });
    drawer?.render(lastPins, drawerCtx());
  }

  function updateCursor(): void {
    document.documentElement.style.cursor = active && !interacting ? "crosshair" : "";
  }

  function nextPaint(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function statusChanged(a: QueueStatus | null, b: QueueStatus | null): boolean {
  if (a === b) return false;
  if (!a || !b) return true;
  return (
    a.serverReachable !== b.serverReachable ||
    a.port !== b.port ||
    a.queued !== b.queued ||
    a.watching !== b.watching ||
    a.root !== b.root ||
    planKey(a.plan) !== planKey(b.plan)
  );
}

function planKey(plan: QueueStatus["plan"]): string {
  return plan ? `${plan.id}:${plan.status}:${plan.items.length}` : "";
}
