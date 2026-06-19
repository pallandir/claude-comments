import type { PinModel } from "../messages.js";
import type { Surface } from "./surface.js";
import type { Mode } from "./toolbar.js";

export interface DrawerHandlers {
  onEdit: (cid: string, text: string) => void;
  onRemove: (key: string) => void;
  onClose: () => void;
}

export interface DrawerContext {
  mode: Mode;
  connected: boolean;
  watching: boolean;
}

const DEFAULT_CTX: DrawerContext = { mode: "remote", connected: false, watching: false };

export class Drawer {
  private readonly root: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly hintsEl: HTMLElement;
  private readonly handlers: DrawerHandlers;
  private open = false;
  private pins: PinModel[] = [];
  private ctx: DrawerContext = DEFAULT_CTX;
  private editing: string | null = null;
  private hintsOpen = true;
  private hintsPinned = false;

  constructor(surface: Surface, handlers: DrawerHandlers) {
    this.handlers = handlers;
    this.root = document.createElement("div");
    this.root.className = "cc-drawer";

    const card = document.createElement("div");
    card.className = "cc-drawer-card";

    const head = document.createElement("div");
    head.className = "cc-drawer-head";
    const title = document.createElement("strong");
    title.textContent = "Comments";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "cc-drawer-close";
    close.textContent = "✕";
    close.addEventListener("click", () => handlers.onClose());
    head.append(title, close);

    this.listEl = document.createElement("div");
    this.listEl.className = "cc-drawer-list";

    card.append(head, this.listEl);

    this.hintsEl = document.createElement("div");
    this.hintsEl.className = "cc-hints";

    this.root.append(card, this.hintsEl);
    surface.append(this.root);
  }

  isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean, pins: PinModel[], ctx: DrawerContext): void {
    this.open = open;
    this.root.classList.toggle("cc-drawer--open", open);
    this.editing = null;
    this.ctx = ctx;
    this.render(pins, ctx);
  }

  render(pins: PinModel[], ctx: DrawerContext = this.ctx): void {
    this.pins = pins;
    this.ctx = ctx;
    if (!this.open) return;
    this.renderList(pins);
    this.renderHints(pins, ctx);
  }

  destroy(): void {
    this.root.remove();
  }

  private renderList(pins: PinModel[]): void {
    this.listEl.replaceChildren();
    if (pins.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cc-drawer-empty";
      empty.textContent = "No comments on this page yet.";
      this.listEl.append(empty);
      return;
    }
    for (const pin of pins) this.listEl.append(this.item(pin));
  }

  private renderHints(pins: PinModel[], ctx: DrawerContext): void {
    if (!this.hintsPinned) this.hintsOpen = pins.length === 0;
    const guide = helpFor(ctx);

    this.hintsEl.replaceChildren();
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "cc-hints-toggle";
    const label = document.createElement("span");
    label.textContent = guide.title;
    const chevron = document.createElement("span");
    chevron.className = "cc-hints-chevron";
    chevron.textContent = "›";
    toggle.append(label, chevron);
    toggle.addEventListener("click", () => {
      this.hintsPinned = true;
      this.hintsOpen = !this.hintsOpen;
      this.renderHints(this.pins, this.ctx);
    });

    this.hintsEl.classList.toggle("cc-hints--open", this.hintsOpen);
    this.hintsEl.append(toggle);

    if (!this.hintsOpen) return;

    const body = document.createElement("div");
    body.className = "cc-hints-body";
    const steps = document.createElement("ol");
    steps.className = "cc-hints-steps";
    for (const step of guide.steps) {
      const li = document.createElement("li");
      li.append(...renderRich(step));
      steps.append(li);
    }
    body.append(steps);
    this.hintsEl.append(body);
  }

  private item(pin: PinModel): HTMLElement {
    const row = document.createElement("div");
    row.className = "cc-drawer-item";

    const meta = document.createElement("div");
    meta.className = "cc-drawer-meta";
    const dot = document.createElement("span");
    dot.className = `cc-dot cc-dot--${pin.status}`;
    const tag = document.createElement("span");
    tag.className = "cc-drawer-tag";
    tag.textContent = pin.removable ? kindLabel(pin) : `${kindLabel(pin)} · synced`;
    const target = document.createElement("span");
    target.className = "cc-drawer-target";
    target.textContent = pin.target;
    target.title = `${pin.target} · ${pin.route}`;
    meta.append(dot, tag, target);
    row.append(meta);

    if (this.editing === pin.key && pin.removable) {
      const textarea = document.createElement("textarea");
      textarea.className = "cc-drawer-edit";
      textarea.value = pin.text;
      const actions = document.createElement("div");
      actions.className = "cc-drawer-actions";
      const save = document.createElement("button");
      save.type = "button";
      save.className = "cc-save";
      save.textContent = "Save";
      save.addEventListener("click", () => {
        const value = textarea.value.trim();
        this.editing = null;
        if (value) this.handlers.onEdit(pin.key, value);
        else this.render(this.pins);
      });
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => {
        this.editing = null;
        this.render(this.pins);
      });
      actions.append(save, cancel);
      row.append(textarea, actions);
      return row;
    }

    const body = document.createElement("div");
    body.className = "cc-drawer-text";
    body.textContent = pin.text;
    row.append(body);

    if (pin.removable) {
      const actions = document.createElement("div");
      actions.className = "cc-drawer-actions";
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => {
        this.editing = pin.key;
        this.render(this.pins);
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "cc-drawer-del";
      del.textContent = "Delete";
      del.addEventListener("click", () => this.handlers.onRemove(pin.key));
      actions.append(edit, del);
      row.append(actions);
    }
    return row;
  }
}

interface Guide {
  title: string;
  steps: string[];
}

function helpFor(ctx: DrawerContext): Guide {
  if (ctx.mode === "remote") {
    return {
      title: "Working on a remote page",
      steps: [
        "Click any element to leave a comment, recolor it, or edit its text.",
        "Add as many as you need; they stay saved in your browser.",
        "Hit `⇩ Handoff` in the toolbar to export a Markdown file.",
        "Share it with your developers or drop it into Claude Code.",
      ],
    };
  }
  if (!ctx.connected) {
    return {
      title: "Connect your editor",
      steps: [
        "Your comments are saved locally for this page.",
        "Start Redline's server in your code editor.",
        "Run `/loop /comments` in Claude Code to pick them up.",
        "Review and apply the changes Claude proposes.",
      ],
    };
  }
  return {
    title: "How the flow works",
    steps: [
      "Click an element to comment, recolor, or edit its text.",
      "Comments sync to your repo automatically.",
      "Claude Code reads them and proposes changes.",
      "Approve or reject right from the toolbar.",
    ],
  };
}

function renderRich(text: string): Node[] {
  const nodes: Node[] = [];
  const parts = text.split(/(`[^`]+`)/);
  for (const part of parts) {
    if (part.startsWith("`") && part.endsWith("`")) {
      const code = document.createElement("code");
      code.textContent = part.slice(1, -1);
      nodes.push(code);
    } else if (part) {
      nodes.push(document.createTextNode(part));
    }
  }
  return nodes;
}

function kindLabel(pin: PinModel): string {
  if (pin.kind === "style") return "Style";
  if (pin.kind === "text") return "Text";
  return "Comment";
}
