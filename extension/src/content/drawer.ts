import type { PinModel } from "../messages.js";
import type { Surface } from "./surface.js";

export interface DrawerHandlers {
  onEdit: (cid: string, text: string) => void;
  onRemove: (key: string) => void;
  onClose: () => void;
}

export class Drawer {
  private readonly root: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly handlers: DrawerHandlers;
  private open = false;
  private pins: PinModel[] = [];
  private editing: string | null = null;

  constructor(surface: Surface, handlers: DrawerHandlers) {
    this.handlers = handlers;
    this.root = document.createElement("div");
    this.root.className = "cc-drawer";

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

    this.root.append(head, this.listEl);
    surface.append(this.root);
  }

  isOpen(): boolean {
    return this.open;
  }

  setOpen(open: boolean, pins: PinModel[]): void {
    this.open = open;
    this.root.classList.toggle("cc-drawer--open", open);
    this.editing = null;
    this.render(pins);
  }

  render(pins: PinModel[]): void {
    this.pins = pins;
    if (!this.open) return;
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

  destroy(): void {
    this.root.remove();
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
    meta.append(dot, tag);
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

function kindLabel(pin: PinModel): string {
  if (pin.kind === "style") return "Style";
  if (pin.kind === "text") return "Text";
  return "Comment";
}
