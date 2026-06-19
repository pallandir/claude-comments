import type { DeferralNotice, QueueStatus } from "../messages.js";
import type { Surface } from "./surface.js";

export type ToolId = "select" | "comment" | "color" | "text";
export type Mode = "local" | "remote";

const POS_KEY = "cc-toolbar-pos";

export interface ToolbarHandlers {
  onComments: () => void;
  onHandoff: () => void;
  onReset: () => void;
  onDismissNotice: (commentId: string) => void;
}

export interface ToolbarState {
  mode: Mode;
  count: number;
  status: QueueStatus | null;
  drawerOpen: boolean;
  sessionId: string | null;
}

export class Toolbar {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly commentsBtn: HTMLButtonElement;
  private readonly handoffBtn: HTMLButtonElement;
  private readonly handlers: ToolbarHandlers;
  private panelKey = "";

  constructor(surface: Surface, handlers: ToolbarHandlers) {
    this.handlers = handlers;
    this.root = document.createElement("div");
    this.root.className = "cc-toolbar";

    this.panel = document.createElement("div");
    this.panel.className = "cc-tb-panel";
    this.panel.hidden = true;

    const grip = document.createElement("div");
    grip.className = "cc-grip cc-has-tip";
    grip.textContent = "⠿";
    grip.dataset.tip = "Drag to move";
    this.makeDraggable(grip);

    this.commentsBtn = action("💬 Comments", "Open the comments panel", () =>
      handlers.onComments(),
    );

    this.handoffBtn = action("⇩ Handoff", "Download a Markdown handoff", () =>
      handlers.onHandoff(),
    );

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "cc-action cc-action--icon cc-action--danger cc-has-tip";
    resetBtn.dataset.tip = "Delete all comments on this page";
    resetBtn.append(icon(ICON_TRASH, "cc-action-glyph"));
    resetBtn.addEventListener("click", () => handlers.onReset());

    this.root.append(this.panel, grip, this.commentsBtn, sep(), this.handoffBtn, resetBtn);
    surface.append(this.root);
    void this.restorePosition();
  }

  destroy(): void {
    this.root.remove();
  }

  render(state: ToolbarState): void {
    this.commentsBtn.classList.toggle("cc-action--active", state.drawerOpen);
    this.commentsBtn.textContent = `💬 Comments (${state.count})`;

    if (state.mode === "remote") {
      this.handoffBtn.classList.add("cc-action--primary");
      this.setPanel("remote", () => remotePanel());
      return;
    }

    const status = state.status;
    const reachable = Boolean(status?.serverReachable);
    const watching = Boolean(status?.watching);

    this.handoffBtn.classList.toggle("cc-action--primary", !reachable);

    const notices = status?.notices ?? [];
    if (notices.length > 0) {
      this.setPanel(`notices:${notices.map((n) => n.commentId).join(",")}`, () =>
        this.noticePanel(notices),
      );
    } else if (!reachable) {
      this.setPanel("setup:server", () => setupPanel(false, false, null, state.sessionId));
    } else if (!watching) {
      this.setPanel("setup:watch", () =>
        setupPanel(true, false, status?.root ?? null, state.sessionId),
      );
    } else {
      this.clearPanel();
    }
  }

  private setPanel(key: string, build: () => HTMLElement): void {
    if (this.panelKey === key) return;
    this.panelKey = key;
    this.panel.replaceChildren(build());
    this.panel.hidden = false;
  }

  private clearPanel(): void {
    if (this.panelKey === "") return;
    this.panelKey = "";
    this.panel.replaceChildren();
    this.panel.hidden = true;
  }

  private noticePanel(notices: DeferralNotice[]): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cc-notices";

    const title = document.createElement("div");
    title.className = "cc-notices-title";
    title.textContent =
      notices.length === 1 ? "1 comment needs a plan" : `${notices.length} comments need a plan`;
    wrap.append(title);

    for (const notice of notices) {
      const row = document.createElement("div");
      row.className = "cc-notice-row";

      const body = document.createElement("div");
      body.className = "cc-notice-body";

      const route = document.createElement("code");
      route.className = "cc-notice-route";
      route.textContent = notice.page;

      const summary = document.createElement("div");
      summary.className = "cc-notice-summary";
      summary.textContent = notice.summary;

      const hint = document.createElement("div");
      hint.className = "cc-notice-hint";
      hint.textContent = "Understood, needs a plan. Discuss in chat.";

      body.append(route, summary, hint);

      const dismiss = document.createElement("button");
      dismiss.type = "button";
      dismiss.className = "cc-action cc-action--ghost cc-notice-dismiss";
      dismiss.textContent = "Dismiss";
      dismiss.addEventListener("click", () => this.handlers.onDismissNotice(notice.commentId));

      row.append(body, dismiss);
      wrap.append(row);
    }

    return wrap;
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

const SVG_NS = "http://www.w3.org/2000/svg";

const ICON_TRASH = [
  "M10 11v6",
  "M14 11v6",
  "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
  "M3 6h18",
  "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
];

function icon(paths: string[], className: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("class", className);
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
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

function setupPanel(
  reachable: boolean,
  watching: boolean,
  root: string | null,
  sessionId: string | null,
): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "cc-setup";

  const title = document.createElement("div");
  title.className = "cc-setup-title";
  title.textContent = "Set up auto-pickup";
  wrap.append(title);

  const projectHint = reachable
    ? root
      ? short(root)
      : "Waiting for Claude…"
    : "Start Redline in your editor.";

  wrap.append(watchRow(sessionId), setupRow(watching, "Project connected", projectHint));
  return wrap;
}

function setupRow(done: boolean, label: string, hint: string): HTMLElement {
  const row = document.createElement("div");
  row.className = `cc-setup-row${done ? " cc-setup-row--done" : ""}`;
  const mark = document.createElement("span");
  mark.className = "cc-setup-mark";
  mark.textContent = done ? "✓" : "•";
  const body = document.createElement("div");
  const strong = document.createElement("div");
  strong.className = "cc-setup-label";
  strong.textContent = label;
  const sub = document.createElement("div");
  sub.className = "cc-setup-hint";
  sub.textContent = hint;
  body.append(strong, sub);
  row.append(mark, body);
  return row;
}

function watchRow(sessionId: string | null): HTMLElement {
  const row = document.createElement("div");
  row.className = "cc-setup-row";
  const mark = document.createElement("span");
  mark.className = "cc-setup-mark";
  mark.textContent = "•";
  const body = document.createElement("div");
  const strong = document.createElement("div");
  strong.className = "cc-setup-label";
  strong.textContent = "Pair with Claude";

  const cmdRow = document.createElement("div");
  cmdRow.className = "cc-setup-cmd cc-setup-id";
  const cmdCode = document.createElement("code");
  cmdCode.textContent = sessionId ? `/redline ${sessionId}` : "loading…";
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "cc-copy";
  copy.textContent = "Copy";
  copy.addEventListener("click", () => {
    void navigator.clipboard?.writeText(sessionId ? `/redline ${sessionId}` : "");
    copy.textContent = "Copied";
    window.setTimeout(() => {
      copy.textContent = "Copy";
    }, 1400);
  });
  cmdRow.append(cmdCode, copy);

  const sub = document.createElement("div");
  sub.className = "cc-setup-hint";
  sub.textContent = "Paste into Claude to start.";
  body.append(strong, cmdRow, sub);
  row.append(mark, body);
  return row;
}

function remotePanel(): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "cc-setup";
  const title = document.createElement("div");
  title.className = "cc-setup-title";
  title.textContent = "Remote page";
  const sub = document.createElement("div");
  sub.className = "cc-setup-hint";
  sub.textContent = "Comment freely, then click Handoff to export a file for your developers.";
  wrap.append(title, sub);
  return wrap;
}

function short(root: string): string {
  const parts = root.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || root;
}
