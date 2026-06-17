import type { QueueStatus } from "../messages.js";
import type { Surface } from "./surface.js";

export type ToolId = "select" | "comment" | "color" | "text";

const POS_KEY = "cc-toolbar-pos";

export interface ToolbarHandlers {
  onComments: () => void;
  onSend: () => void;
  onHandoff: () => void;
  onReset: () => void;
}

export interface ToolbarState {
  count: number;
  status: QueueStatus | null;
  drawerOpen: boolean;
}

export class Toolbar {
  private readonly root: HTMLElement;
  private readonly commentsBtn: HTMLButtonElement;
  private readonly statusDot: HTMLElement;

  constructor(surface: Surface, handlers: ToolbarHandlers) {
    this.root = document.createElement("div");
    this.root.className = "cc-toolbar";

    const grip = document.createElement("div");
    grip.className = "cc-grip cc-has-tip";
    grip.textContent = "⠿";
    grip.dataset.tip = "Drag to move";
    this.makeDraggable(grip);

    this.commentsBtn = action("💬 Comments", "Open the comments panel", () =>
      handlers.onComments(),
    );

    const sendBtn = action("⤴ Send", "Send all comments to Claude Code", () => handlers.onSend());
    sendBtn.classList.add("cc-action--primary");

    const handoffBtn = action("⇩ Handoff", "Download a Markdown handoff", () =>
      handlers.onHandoff(),
    );

    const resetBtn = action("↺", "Delete all comments on this page", () => handlers.onReset());
    resetBtn.classList.add("cc-action--danger");

    this.statusDot = document.createElement("span");
    this.statusDot.className = "cc-status-dot cc-has-tip";

    this.root.append(
      grip,
      this.commentsBtn,
      sep(),
      sendBtn,
      handoffBtn,
      resetBtn,
      sep(),
      this.statusDot,
    );
    surface.append(this.root);
    void this.restorePosition();
  }

  destroy(): void {
    this.root.remove();
  }

  render(state: ToolbarState): void {
    this.commentsBtn.classList.toggle("cc-action--active", state.drawerOpen);
    this.commentsBtn.textContent = `💬 Comments (${state.count})`;
    this.statusDot.dataset.tip = statusText(state.status);
    this.statusDot.classList.toggle("cc-status-dot--on", Boolean(state.status?.serverReachable));
  }

  private makeDraggable(handle: HTMLElement): void {
    handle.classList.add("cc-drag");
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    const onMove = (event: PointerEvent) => {
      this.root.style.left = `${Math.max(0, originLeft + (event.clientX - startX))}px`;
      this.root.style.top = `${Math.max(0, originTop + (event.clientY - startY))}px`;
      this.root.style.transform = "none";
      this.root.style.bottom = "auto";
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      void chrome.storage.local.set({
        [POS_KEY]: { left: this.root.style.left, top: this.root.style.top },
      });
    };
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const rect = this.root.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      originLeft = rect.left;
      originTop = rect.top;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  private async restorePosition(): Promise<void> {
    const stored = await chrome.storage.local.get(POS_KEY);
    const pos = stored[POS_KEY] as { left: string; top: string } | undefined;
    if (pos?.left && pos.top) {
      this.root.style.left = pos.left;
      this.root.style.top = pos.top;
      this.root.style.transform = "none";
      this.root.style.bottom = "auto";
    }
  }
}

function action(label: string, tip: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cc-action cc-has-tip";
  btn.dataset.tip = tip;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

function sep(): HTMLElement {
  const el = document.createElement("span");
  el.className = "cc-sep";
  return el;
}

function statusText(status: QueueStatus | null): string {
  if (!status) return "Not connected";
  if (status.serverReachable) return `Connected on :${status.port} · ${status.queued} queued`;
  return `Offline · ${status.queued} queued`;
}
