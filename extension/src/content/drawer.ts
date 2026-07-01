import type { PageRating, PageRatingSection, PinModel } from "../messages.js";
import { ICON_CLOSE, ICON_REFRESH, icon } from "./icons.js";
import type { Surface } from "./surface.js";
import type { Mode } from "./toolbar.js";

export interface DrawerHandlers {
  onEdit: (cid: string, text: string) => void;
  onRemove: (key: string) => void;
  onClose: () => void;
  onRevert: (key: string) => void;
  onHoverComment: (key: string | null) => void;
  onReRequestRating: () => void;
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
  private rankTab: "scores" | "advice" = "scores";

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

    const result = this.rating.status === "scored" ? this.rating.result : null;

    const head = document.createElement("div");
    head.className = "cc-rank-head";
    const label = document.createElement("span");
    label.className = "cc-rank-label";
    label.textContent = "Design score";
    head.append(label);
    if (result) {
      const scoreWrap = document.createElement("span");
      const score = document.createElement("span");
      score.className = "cc-rank-score";
      score.textContent = String(result.score);
      const denom = document.createElement("span");
      denom.className = "cc-rank-denom";
      denom.textContent = "/100";
      const band = document.createElement("span");
      band.className = "cc-rank-band";
      band.textContent = scoreBand(result.score);
      score.append(denom);
      scoreWrap.append(score, band);
      head.append(scoreWrap);
    }
    const refreshBtn = document.createElement("button") as HTMLButtonElement;
    refreshBtn.type = "button";
    refreshBtn.className = "cc-rank-refresh";
    refreshBtn.disabled = this.rating.status === "pending" || !this.ctx?.connected;
    refreshBtn.append(icon(ICON_REFRESH, "cc-rank-refresh-icon"));
    refreshBtn.addEventListener("click", () => this.handlers.onReRequestRating());
    head.append(refreshBtn);
    this.rankEl.append(head);

    if (result) {
      const derivation = document.createElement("div");
      derivation.className = "cc-rank-derivation";
      const caption = document.createElement("span");
      caption.className = "cc-rank-derivation-caption";
      caption.textContent = "avg of";
      const dims = document.createElement("span");
      dims.className = "cc-rank-derivation-dims";
      dims.textContent = `UI ${result.ui} · UX ${result.ux} · Coherence ${result.coherence}`;
      derivation.append(caption, dims);
      this.rankEl.append(derivation);

      const notes = document.createElement("div");
      notes.className = "cc-rank-notes";
      notes.textContent = `"${result.notes}"`;
      this.rankEl.append(notes);
    }

    const tabs = document.createElement("div");
    tabs.className = "cc-rank-tabs";
    const breakdownBtn = document.createElement("button");
    breakdownBtn.type = "button";
    breakdownBtn.className = `cc-rank-tab${this.rankTab === "scores" ? " cc-rank-tab--active" : ""}`;
    breakdownBtn.textContent = "Breakdown";
    breakdownBtn.addEventListener("click", () => {
      this.rankTab = "scores";
      this.renderRank();
    });
    const adviceBtn = document.createElement("button");
    adviceBtn.type = "button";
    adviceBtn.className = `cc-rank-tab${this.rankTab === "advice" ? " cc-rank-tab--active" : ""}`;
    adviceBtn.textContent = "Advice";
    adviceBtn.addEventListener("click", () => {
      this.rankTab = "advice";
      this.renderRank();
    });
    tabs.append(breakdownBtn, adviceBtn);
    this.rankEl.append(tabs);

    const body = document.createElement("div");
    body.className = "cc-rank-body";

    if (this.rankTab === "scores") {
      if (!result) {
        for (const lbl of ["Typography", "Composition", "Motion", "Color", "Details"]) {
          body.append(scoreBar(lbl, null));
        }
      } else {
        for (const s of result.sections) {
          body.append(scoreBar(s.label, s.score));
        }
      }
    } else {
      if (!result) {
        body.append(emptyState("Advice appears once the page is scored."));
      } else {
        const lead = document.createElement("p");
        lead.className = "cc-rank-advice-lead";
        lead.textContent = result.notes;
        body.append(lead);
        const withAdvice = result.sections.filter((s: PageRatingSection) => s.advice);
        if (withAdvice.length === 0) {
          body.append(emptyState("No per-section advice available."));
        } else {
          for (const s of withAdvice) {
            const row = document.createElement("div");
            row.className = "cc-rank-advice";
            const lbl = document.createElement("span");
            lbl.className = "cc-rank-advice-label";
            lbl.textContent = s.label;
            const txt = document.createElement("span");
            txt.className = "cc-rank-advice-text";
            txt.textContent = s.advice;
            row.append(lbl, txt);
            body.append(row);
          }
        }
      }
    }

    this.rankEl.append(body);
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

function scoreBand(score: number): string {
  if (score >= 76) return "Exceptional";
  if (score >= 51) return "Good";
  if (score >= 26) return "Fair";
  return "Needs work";
}

function emptyState(text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "cc-rank-empty";
  el.textContent = text;
  return el;
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
