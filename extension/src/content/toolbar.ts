import type { PlanView, QueueStatus } from "../messages.js";
import type { Surface } from "./surface.js";

export type ToolId = "select" | "comment" | "color" | "text";
export type Mode = "local" | "remote";

const POS_KEY = "cc-toolbar-pos";
const WATCH_COMMAND = "/loop /comments";

export interface ToolbarHandlers {
  onComments: () => void;
  onHandoff: () => void;
  onReset: () => void;
  onReconnect: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export interface ToolbarState {
  mode: Mode;
  count: number;
  status: QueueStatus | null;
  drawerOpen: boolean;
  checking: boolean;
}

export class Toolbar {
  private readonly root: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly commentsBtn: HTMLButtonElement;
  private readonly handoffBtn: HTMLButtonElement;
  private readonly connBtn: HTMLButtonElement;
  private readonly connSep: HTMLElement;
  private readonly connLabel: HTMLElement;
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

    this.connBtn = document.createElement("button");
    this.connBtn.type = "button";
    this.connBtn.className = "cc-conn cc-has-tip";
    this.connBtn.addEventListener("click", () => handlers.onReconnect());
    this.connLabel = document.createElement("span");
    this.connLabel.className = "cc-conn-label";
    this.connBtn.append(icon(ICON_ROTATE_CW, "cc-conn-icon"), this.connLabel);

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

    this.connSep = sep();

    this.root.append(
      this.panel,
      grip,
      this.commentsBtn,
      sep(),
      this.handoffBtn,
      resetBtn,
      this.connSep,
      this.connBtn,
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

    if (state.mode === "remote") {
      this.connBtn.hidden = true;
      this.connSep.hidden = true;
      this.handoffBtn.classList.add("cc-action--primary");
      this.setPanel("remote", () => remotePanel());
      return;
    }

    this.connBtn.hidden = false;
    this.connSep.hidden = false;

    const status = state.status;
    const reachable = Boolean(status?.serverReachable);
    const watching = Boolean(status?.watching);
    const connected = reachable && !state.checking;

    this.connBtn.classList.toggle("cc-conn--on", connected && watching);
    this.connBtn.classList.toggle("cc-conn--idle", connected && !watching);
    this.connBtn.classList.toggle("cc-conn--off", !reachable && !state.checking);
    this.connBtn.classList.toggle("cc-conn--checking", state.checking);
    this.connLabel.textContent = connText(reachable, watching, state.checking);
    this.connBtn.dataset.tip = connTip(reachable, watching, state.checking);

    this.handoffBtn.classList.toggle("cc-action--primary", !connected);

    const plan = status?.plan ?? null;
    if (plan && (plan.status === "proposed" || plan.status === "approved")) {
      this.setPanel(`plan:${plan.id}:${plan.status}:${plan.items.length}`, () =>
        this.planPanel(plan),
      );
    } else if (!reachable) {
      this.setPanel("setup:server", () => setupPanel("server", null));
    } else if (!watching) {
      this.setPanel("setup:watch", () => setupPanel("watch", status?.root ?? null));
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

  private planPanel(plan: PlanView): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cc-approve";

    const title = document.createElement("div");
    title.className = "cc-approve-title";
    const n = plan.items.length;
    title.textContent =
      plan.status === "approved"
        ? `Applying ${n} change${n === 1 ? "" : "s"}…`
        : `Claude proposed ${n} change${n === 1 ? "" : "s"}`;
    wrap.append(title);

    const list = document.createElement("ul");
    list.className = "cc-approve-list";
    for (const item of plan.items.slice(0, 6)) {
      const li = document.createElement("li");
      const file = document.createElement("code");
      file.textContent = item.file;
      li.append(file, document.createTextNode(` ${item.summary}`));
      list.append(li);
    }
    if (plan.items.length > 6) {
      const more = document.createElement("li");
      more.className = "cc-approve-more";
      more.textContent = `+${plan.items.length - 6} more`;
      list.append(more);
    }
    wrap.append(list);

    if (plan.status === "proposed") {
      const actions = document.createElement("div");
      actions.className = "cc-approve-actions";
      const apply = document.createElement("button");
      apply.type = "button";
      apply.className = "cc-action cc-action--primary";
      apply.textContent = "Apply";
      apply.addEventListener("click", () => this.handlers.onApprove(plan.id));
      const reject = document.createElement("button");
      reject.type = "button";
      reject.className = "cc-action cc-action--ghost";
      reject.textContent = "Reject";
      reject.addEventListener("click", () => this.handlers.onReject(plan.id));
      actions.append(apply, reject);
      wrap.append(actions);
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

const ICON_ROTATE_CW = ["M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8", "M21 3v5h-5"];

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

function setupPanel(step: "server" | "watch", root: string | null): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "cc-setup";

  const title = document.createElement("div");
  title.className = "cc-setup-title";
  title.textContent = "Set up auto-pickup";
  wrap.append(title);

  wrap.append(
    setupRow(true, "Comment on the page", "Click anything and leave a note."),
    setupRow(
      step === "watch",
      "Project connected",
      root ? short(root) : "Start Redline in your editor.",
    ),
    watchRow(step === "watch"),
  );
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

function watchRow(ready: boolean): HTMLElement {
  const row = document.createElement("div");
  row.className = "cc-setup-row";
  const mark = document.createElement("span");
  mark.className = "cc-setup-mark";
  mark.textContent = "•";
  const body = document.createElement("div");
  const strong = document.createElement("div");
  strong.className = "cc-setup-label";
  strong.textContent = "Turn on auto-pickup";
  const cmd = document.createElement("div");
  cmd.className = "cc-setup-cmd";
  const code = document.createElement("code");
  code.textContent = WATCH_COMMAND;
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "cc-copy";
  copy.textContent = "Copy";
  copy.addEventListener("click", () => {
    void navigator.clipboard?.writeText(WATCH_COMMAND);
    copy.textContent = "Copied";
    window.setTimeout(() => {
      copy.textContent = "Copy";
    }, 1400);
  });
  cmd.append(code, copy);
  const sub = document.createElement("div");
  sub.className = "cc-setup-hint";
  sub.textContent = ready
    ? "Connected. Paste this once in Claude Code to pick up comments automatically."
    : "Paste this in Claude Code once the project is connected.";
  body.append(strong, cmd, sub);
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

function connText(reachable: boolean, watching: boolean, checking: boolean): string {
  if (checking) return "Checking";
  if (!reachable) return "Assistant off";
  return watching ? "Watching" : "Connected";
}

function connTip(reachable: boolean, watching: boolean, checking: boolean): string {
  if (checking) return "Checking for your AI assistant";
  if (!reachable) return "Start Redline's server in your editor, then click to retry.";
  if (!watching) return `Connected. Run ${WATCH_COMMAND} in Claude Code to pick up comments.`;
  return "A watch session is picking up your comments. Click to re-check.";
}
