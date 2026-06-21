import type { PageRating, PinModel } from "../messages.js";
import { ICON_CLOSE, icon } from "./icons.js";
import type { Surface } from "./surface.js";
import type { Mode } from "./toolbar.js";

export interface DrawerHandlers {
  onEdit: (cid: string, text: string) => void;
  onRemove: (key: string) => void;
  onClose: () => void;
  onRevert: (key: string) => void;
  onHoverComment: (key: string | null) => void;
}

export interface DrawerContext {
  mode: Mode;
  connected: boolean;
  watching: boolean;
}

const DEFAULT_CTX: DrawerContext = { mode: "remote", connected: false, watching: false };

export class Drawer {
  private readonly root: HTMLElement;
  private readonly rankEl: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly tabsEl: HTMLElement;
  private readonly handlers: DrawerHandlers;
  private open = false;
  private pins: PinModel[] = [];
  private ctx: DrawerContext = DEFAULT_CTX;
  private editing: string | null = null;
  private rating: PageRating | null = null;
  private activeTab: "comments" | "history" = "comments";

  constructor(surface: Surface, handlers: DrawerHandlers) {
    this.handlers = handlers;
    this.root = document.createElement("div");
    this.root.className = "cc-drawer";

    this.rankEl = document.createElement("div");
    this.rankEl.className = "cc-drawer-card cc-rank-card";

    const card = document.createElement("div");
    card.className = "cc-drawer-card";

    const head = document.createElement("div");
    head.className = "cc-drawer-head";
    this.tabsEl = document.createElement("div");
    this.tabsEl.className = "cc-drawer-tabs";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "cc-drawer-close";
    close.append(icon(ICON_CLOSE, "cc-drawer-close-icon"));
    close.addEventListener("click", () => handlers.onClose());
    head.append(this.tabsEl, close);

    this.listEl = document.createElement("div");
    this.listEl.className = "cc-drawer-list";

    card.append(head, this.listEl);
    this.root.append(card, this.rankEl);
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

  setRating(rating: PageRating | null): void {
    this.rating = rating;
    if (this.open) {
      this.renderRank();
    }
  }

  render(pins: PinModel[], ctx: DrawerContext = this.ctx): void {
    this.pins = pins;
    this.ctx = ctx;
    if (!this.open) return;
    this.renderRank();
    this.renderTabs(pins);
    this.renderList(pins);
  }

  destroy(): void {
    this.root.remove();
  }

  private renderRank(): void {
    this.rankEl.replaceChildren();

    if (!this.rating) {
      this.rankEl.hidden = true;
      return;
    }
    this.rankEl.hidden = false;

    const head = document.createElement("div");
    head.className = "cc-rank-head";
    const label = document.createElement("span");
    label.className = "cc-rank-label";
    label.textContent = "Website ranking";
    head.append(label);

    const result = this.rating.status === "scored" ? this.rating.result : null;
    if (result) {
      const score = document.createElement("span");
      score.className = "cc-rank-score";
      score.textContent = String(result.score);
      const denom = document.createElement("span");
      denom.className = "cc-rank-denom";
      denom.textContent = "/100";
      score.append(denom);
      head.append(score);
    }
    this.rankEl.append(head);

    const dims: Array<[string, number | null]> = result
      ? [
          ["UI", result.ui],
          ["UX", result.ux],
          ["Coherence", result.coherence],
        ]
      : [
          ["UI", null],
          ["UX", null],
          ["Coherence", null],
        ];

    for (const [name, value] of dims) {
      this.rankEl.append(scoreBar(name, value));
    }
  }

  private renderTabs(pins: PinModel[]): void {
    const active = pins.filter((p) => p.status !== "resolved");
    const history = pins.filter((p) => p.status === "resolved");

    this.tabsEl.replaceChildren();
    const commentsTab = document.createElement("button");
    commentsTab.type = "button";
    commentsTab.className = `cc-drawer-tab${this.activeTab === "comments" ? " cc-drawer-tab--active" : ""}`;
    commentsTab.textContent = `Comments (${active.length})`;
    commentsTab.addEventListener("click", () => {
      this.activeTab = "comments";
      this.renderTabs(this.pins);
      this.renderList(this.pins);
    });
    const historyTab = document.createElement("button");
    historyTab.type = "button";
    historyTab.className = `cc-drawer-tab${this.activeTab === "history" ? " cc-drawer-tab--active" : ""}`;
    historyTab.textContent = `History (${history.length})`;
    historyTab.addEventListener("click", () => {
      this.activeTab = "history";
      this.renderTabs(this.pins);
      this.renderList(this.pins);
    });
    this.tabsEl.append(commentsTab, historyTab);
  }

  private renderList(pins: PinModel[]): void {
    const active = pins.filter((p) => p.status !== "resolved");
    const history = pins.filter((p) => p.status === "resolved");

    this.listEl.replaceChildren();

    const list = this.activeTab === "comments" ? active : history;

    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "cc-drawer-empty";
      empty.textContent =
        this.activeTab === "comments"
          ? "No comments on this page yet."
          : "No implemented comments yet.";
      this.listEl.append(empty);
      return;
    }

    for (const pin of list) {
      this.listEl.append(this.item(pin));
    }
  }

  private item(pin: PinModel): HTMLElement {
    const row = document.createElement("div");
    row.className = "cc-drawer-item";

    row.addEventListener("mouseenter", () => this.handlers.onHoverComment(pin.key));
    row.addEventListener("mouseleave", () => this.handlers.onHoverComment(null));

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

    if (pin.status === "resolved") {
      const body = document.createElement("div");
      body.className = "cc-drawer-text";
      body.textContent = pin.text;
      row.append(body);

      const actions = document.createElement("div");
      actions.className = "cc-drawer-actions";
      const revert = document.createElement("button");
      revert.type = "button";
      revert.className = "cc-btn cc-btn--secondary";
      revert.textContent = "Revert";
      revert.addEventListener("click", () => this.handlers.onRevert(pin.key));
      actions.append(revert);
      row.append(actions);
      return row;
    }

    if (this.editing === pin.key && pin.removable) {
      const textarea = document.createElement("textarea");
      textarea.className = "cc-drawer-edit";
      textarea.value = pin.text;
      const actions = document.createElement("div");
      actions.className = "cc-drawer-actions cc-drawer-edit-actions";
      const save = document.createElement("button");
      save.type = "button";
      save.className = "cc-btn cc-btn--primary";
      save.textContent = "Save";
      save.addEventListener("click", () => {
        const value = textarea.value.trim();
        this.editing = null;
        if (value) this.handlers.onEdit(pin.key, value);
        else this.render(this.pins);
      });
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "cc-btn cc-btn--secondary-danger";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", () => {
        this.editing = null;
        this.render(this.pins);
      });
      actions.append(cancel, save);
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
      edit.className = "cc-btn cc-btn--secondary";
      edit.textContent = "Edit";
      edit.addEventListener("click", () => {
        this.editing = pin.key;
        this.render(this.pins);
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "cc-btn cc-drawer-del";
      del.textContent = "Delete";
      del.addEventListener("click", () => this.handlers.onRemove(pin.key));
      actions.append(edit, del);
      row.append(actions);
    }
    return row;
  }
}

function scoreBar(label: string, value: number | null): HTMLElement {
  const row = document.createElement("div");
  row.className = "cc-rank-row";

  const name = document.createElement("span");
  name.className = "cc-rank-row-label";
  name.textContent = label;

  const bar = document.createElement("div");
  bar.className = "cc-rank-bar";
  const fill = document.createElement("div");
  if (value === null) {
    fill.className = "cc-rank-fill cc-rank-fill--indeterminate";
  } else {
    fill.className = "cc-rank-fill";
    fill.style.width = `${value}%`;
  }
  bar.append(fill);

  const val = document.createElement("span");
  val.className = "cc-rank-row-val";
  val.textContent = value === null ? "" : String(value);

  row.append(name, bar, val);
  return row;
}

function kindLabel(pin: PinModel): string {
  if (pin.kind === "style") return "Style";
  if (pin.kind === "text") return "Text";
  return "Comment";
}
