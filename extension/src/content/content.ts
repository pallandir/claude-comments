import { captureElement } from "../lib/fingerprint.js";
import { resolveSource } from "../lib/source-map.js";
import { isLocalUrl } from "../lib/transport.js";
import type { Message, PageRating, PinModel, QueueStatus, Response } from "../messages.js";
import type { DraftRequest, Operation, Rect } from "../types.js";
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
const STYLE_ALLOWLIST = new Set(["color", "background-color"]);

function pageMode(): Mode {
  return isLocalUrl(location.href) ? "local" : "remote";
}

function init(): void {
  let active = false;
  let picking = true;
  let interacting = false;
  let drawerOpen = false;
  let lastPins: PinModel[] = [];
  let lastStatus: QueueStatus | null = null;
  let lastRating: PageRating | null = null;
  let lastWatching = false;
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
      picking = true;
      toolbar = new Toolbar(surface, {
        onComments: toggleDrawer,
        onSend: () => void handleSend(),
        onHandoff: handleHandoff,
        onReset: handleReset,
        onDismissNotice: (id) => void handleDismissNotice(id),
        onTogglePick: () => setPicking(!picking),
      });
      drawer = new Drawer(surface, {
        onEdit: (cid, text) => void editComment(cid, text),
        onRemove: (key) => void removePin(key),
        onClose: toggleDrawer,
        onRevert: (key) => void handleRevert(key),
        onHoverComment: (key) => surface.focusPin(key),
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
      picking = true;
      interacting = false;
      drawerOpen = false;
      surface.unmount();
    }
    updateCursor();
  }

  function setPicking(on: boolean): void {
    if (on === picking) return;
    picking = on;
    if (!on) {
      surface.highlightHover(null);
      surface.setSelection(null);
      surface.closeActionMenu();
      interacting = false;
    }
    updateCursor();
    render();
  }

  document.addEventListener(
    "mousemove",
    (event) => {
      if (!active || !picking || interacting) return;
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
      if (!active || !picking || interacting || surface.ownsEvent(event)) return;
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
      if (active && picking && !interacting && event.key === "Escape") surface.setSelection(null);
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
        async (commentText, { planFirst, attachScreenshot }) => {
          done();
          await record(el, {
            comment: commentText,
            operation: { type: "comment", property: null, from: null, to: null },
            planFirst,
            attachScreenshot,
          });
        },
        done,
      );
    } else if (which === "color") {
      openColorPanel(
        surface,
        el as HTMLElement,
        (operation, summary) => {
          done();
          void record(el, { comment: summary, operation, attachScreenshot: true });
        },
        done,
      );
    } else {
      openTextEditor(
        surface,
        el as HTMLElement,
        (from, to) => {
          done();
          const comment = from ? `Change text from "${from}" to "${to}"` : `Set text to "${to}"`;
          void record(el, {
            comment,
            operation: { type: "text", property: null, from, to },
            attachScreenshot: true,
          });
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
      connected: Boolean(lastStatus?.serverReachable) && Boolean(lastStatus?.watching),
      watching: Boolean(lastStatus?.watching),
    };
  }

  interface RecordPayload {
    comment: string;
    operation: Operation;
    planFirst?: boolean;
    attachScreenshot?: boolean;
  }

  async function record(el: Element, payload: RecordPayload): Promise<void> {
    const { operator, elementText } = captureElement(el);

    const r = el.getBoundingClientRect();
    const rect: Rect = { x: r.x, y: r.y, w: r.width, h: r.height };

    let screenshot: string | null = null;
    if (payload.attachScreenshot !== false) {
      surface.setHidden(true);
      await nextPaint();
      screenshot = await captureRegion(rect);
      surface.setHidden(false);
    }

    const draft: DraftRequest = {
      comment: payload.comment,
      operation: payload.operation,
      operator,
      url: location.href,
      metadata: {
        page: location.pathname,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        elementText,
      },
      source: resolveSource(el),
      screenshotDataUrl: screenshot,
      planFirst: payload.planFirst ?? false,
    };
    await send({ type: "save-request", draft });
    await refresh();
  }

  async function captureRegion(rect: Rect): Promise<string | null> {
    const res = await send({ type: "capture-region", rect, dpr: window.devicePixelRatio });
    return res.ok && res.dataUrl ? res.dataUrl : null;
  }

  async function publishPageRating(): Promise<void> {
    const rect: Rect = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
    surface.setHidden(true);
    await nextPaint();
    const screenshot = await captureRegion(rect);
    surface.setHidden(false);
    await send({ type: "request-rating", url: location.href, screenshotDataUrl: screenshot });
    lastRating = { id: "pending", status: "pending" };
    drawer?.setRating(lastRating);
    await refresh();
  }

  async function handleDismissNotice(commentId: string): Promise<void> {
    await send({ type: "dismiss-notice", commentId });
    await refresh();
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
    if (!active) return;
    const res = await send({ type: "queue-status" });
    const next = res.ok ? (res.status ?? null) : null;
    if (!statusChanged(lastStatus, next)) return;
    await refresh();
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
    const total = lastPins.length;
    if (total === 0) return;

    interacting = true;
    updateCursor();
    surface.showModal({
      title: "Delete all comments?",
      body: "This permanently removes all comments and their screenshots from every page. This cannot be undone.",
      actions: [
        { label: "Cancel", variant: "ghost", onClick: () => {} },
        {
          label: "Delete all comments",
          variant: "danger",
          onClick: () => void clearEverything(),
        },
      ],
      onDismiss: () => {
        interacting = false;
        updateCursor();
      },
    });
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
    const newRating = statusRes.ok ? (statusRes.status?.rating ?? null) : null;
    if (newRating !== null) {
      lastRating = newRating;
      drawer?.setRating(lastRating);
    }
    const nowWatching = Boolean(lastStatus?.watching);
    if (nowWatching && !lastWatching && !lastRating) void publishPageRating();
    lastWatching = nowWatching;
    surface.setPins(lastPins, (key) => void removePin(key));
    render();
  }

  async function removePin(cid: string): Promise<void> {
    const pin = lastPins.find((p) => p.key === cid);
    if (pin && (pin.kind === "style" || pin.kind === "text") && pin.operation?.from != null) {
      const el = resolveXPath(pin.operator);
      if (el instanceof HTMLElement) {
        if (
          pin.kind === "style" &&
          pin.operation.property &&
          STYLE_ALLOWLIST.has(pin.operation.property)
        ) {
          el.style.setProperty(pin.operation.property, pin.operation.from);
        } else if (pin.kind === "text") {
          el.textContent = pin.operation.from;
        }
      }
    }
    await send({ type: "remove-comment", cid });
    await refresh();
  }

  async function handleRevert(key: string): Promise<void> {
    const note = "Revert the previous change you made for this comment.";
    await send({ type: "reopen-comment", id: key, note });
    await refresh();
  }

  function render(): void {
    const activeCount = lastPins.filter((p) => p.status !== "resolved").length;
    toolbar?.render({
      mode,
      count: activeCount,
      status: lastStatus,
      drawerOpen,
      sessionId: lastStatus?.sessionId ?? null,
      picking,
    });
    drawer?.render(lastPins, drawerCtx());
  }

  function updateCursor(): void {
    document.documentElement.style.cursor = active && picking && !interacting ? "crosshair" : "";
  }

  function nextPaint(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }
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
    a.version !== b.version ||
    noticesKey(a.notices) !== noticesKey(b.notices) ||
    ratingKey(a.rating) !== ratingKey(b.rating)
  );
}

function ratingKey(r: QueueStatus["rating"]): string {
  return `${r?.id ?? ""}:${r?.status ?? ""}:${r?.result?.score ?? ""}`;
}

function noticesKey(notices: QueueStatus["notices"]): string {
  return notices?.map((n) => n.commentId).join(",") ?? "";
}

function resolveXPath(xpath: string): Element | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    );
    return result.singleNodeValue as Element | null;
  } catch {
    return null;
  }
}
