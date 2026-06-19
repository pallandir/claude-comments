import type { PinModel } from "../messages.js";
import overlayCss from "./overlay.css?inline";

interface ActivePin {
  model: PinModel;
  el: HTMLElement;
  anchor: Element | null;
}

export interface ActionMenuHandlers {
  onComment: () => void;
  onColor: () => void;
  onText: () => void;
  onDismiss: () => void;
}

export interface ModalAction {
  label: string;
  variant?: "danger" | "ghost";
  onClick: () => void;
}

export interface ModalOptions {
  title: string;
  body: string;
  actions: ModalAction[];
  onDismiss: () => void;
}

export class Surface {
  private readonly host: HTMLElement;
  private readonly shadow: ShadowRoot;
  private pins: ActivePin[] = [];
  private hoverBox: HTMLElement | null = null;
  private selectionBox: HTMLElement | null = null;
  private selectionEl: Element | null = null;
  private composer: HTMLElement | null = null;
  private composerHighlight: HTMLElement | null = null;
  private composerAnchor: Element | null = null;
  private actionMenu: HTMLElement | null = null;
  private actionCleanup: (() => void) | null = null;
  private rafId = 0;

  constructor() {
    this.host = document.createElement("div");
    this.host.id = "redline-root";
    this.shadow = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = overlayCss;
    this.shadow.append(style);
  }

  mount(): void {
    if (!this.host.isConnected) document.documentElement.append(this.host);
  }

  unmount(): void {
    this.closeActionMenu();
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
    this.host.remove();
  }

  append(el: HTMLElement): void {
    this.mount();
    this.shadow.append(el);
  }

  ownsEvent(event: Event): boolean {
    return event.composedPath().includes(this.host);
  }

  owns(el: EventTarget | null): boolean {
    return el instanceof Node && (el === this.host || this.host.contains(el as Node));
  }

  setHidden(hidden: boolean): void {
    this.host.style.visibility = hidden ? "hidden" : "";
  }

  highlightHover(target: Element | null): void {
    if (!target || target === this.selectionEl) {
      this.hoverBox?.remove();
      this.hoverBox = null;
      return;
    }
    this.mount();
    if (!this.hoverBox) {
      this.hoverBox = document.createElement("div");
      this.hoverBox.className = "cc-hover";
      this.shadow.append(this.hoverBox);
    }
    place(this.hoverBox, target);
  }

  setSelection(target: Element | null): void {
    this.selectionEl = target;
    if (!target) {
      this.selectionBox?.remove();
      this.selectionBox = null;
      return;
    }
    this.mount();
    if (!this.selectionBox) {
      this.selectionBox = document.createElement("div");
      this.selectionBox.className = "cc-selection";
      this.shadow.append(this.selectionBox);
    }
    place(this.selectionBox, target);
    this.startTicker();
  }

  selected(): Element | null {
    return this.selectionEl;
  }

  showActionMenu(target: Element, handlers: ActionMenuHandlers): void {
    this.mount();
    this.closeActionMenu();

    const menu = document.createElement("div");
    menu.className = "cc-actions-menu";
    menu.append(
      menuButton("💬", "Comment", handlers.onComment),
      menuButton("◑", "Color", handlers.onColor),
      menuButton("T", "Text", handlers.onText),
    );
    this.actionMenu = menu;
    this.shadow.append(menu);

    const rect = target.getBoundingClientRect();
    const above = rect.top + window.scrollY - menu.offsetHeight - 10;
    const below = rect.bottom + window.scrollY + 10;
    menu.style.top = `${above > window.scrollY ? above : below}px`;
    menu.style.left = `${Math.max(8, rect.left + window.scrollX)}px`;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        this.closeActionMenu();
        handlers.onDismiss();
      }
    };
    const onDoc = (event: Event) => {
      if (event.composedPath().includes(menu)) return;
      this.closeActionMenu();
      handlers.onDismiss();
    };
    setTimeout(() => {
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("click", onDoc, true);
    }, 0);
    this.actionCleanup = () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("click", onDoc, true);
    };
  }

  closeActionMenu(): void {
    this.actionCleanup?.();
    this.actionCleanup = null;
    this.actionMenu?.remove();
    this.actionMenu = null;
  }

  showModal(options: ModalOptions): void {
    this.mount();

    const backdrop = document.createElement("div");
    backdrop.className = "cc-modal-backdrop";

    const card = document.createElement("div");
    card.className = "cc-modal";

    const icon = document.createElement("div");
    icon.className = "cc-modal-icon";
    icon.textContent = "⚠";
    const title = document.createElement("div");
    title.className = "cc-modal-title";
    title.textContent = options.title;
    const body = document.createElement("p");
    body.className = "cc-modal-body";
    body.textContent = options.body;
    const actions = document.createElement("div");
    actions.className = "cc-modal-actions";

    const close = () => {
      document.removeEventListener("keydown", onKey, true);
      backdrop.remove();
      options.onDismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    for (const def of options.actions) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `cc-modal-btn${def.variant ? ` cc-modal-btn--${def.variant}` : ""}`;
      btn.textContent = def.label;
      btn.addEventListener("click", () => {
        close();
        def.onClick();
      });
      actions.append(btn);
    }

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) close();
    });
    document.addEventListener("keydown", onKey, true);

    card.append(icon, title, body, actions);
    backdrop.append(card);
    this.shadow.append(backdrop);
  }

  showComposer(
    target: Element,
    onSubmit: (text: string, planFirst: boolean) => Promise<void> | void,
    onCancel?: () => void,
  ): void {
    this.mount();
    this.closeComposer();
    this.composerAnchor = target;

    const highlight = document.createElement("div");
    highlight.className = "cc-highlight";

    const panel = document.createElement("div");
    panel.className = "cc-panel";
    const textarea = document.createElement("textarea");
    textarea.placeholder = "What should Claude change here?";
    const hint = document.createElement("div");
    hint.className = "cc-hint";
    hint.textContent = "⌘↵ to save · Esc to cancel";

    const planToggle = document.createElement("label");
    planToggle.className = "cc-plan-toggle";
    const planCheckbox = document.createElement("input");
    planCheckbox.type = "checkbox";
    planCheckbox.className = "cc-plan-checkbox";
    const planLabel = document.createElement("span");
    planLabel.textContent = "Plan this first";
    planToggle.append(planCheckbox, planLabel);

    const actions = document.createElement("div");
    actions.className = "cc-actions";
    const save = document.createElement("button");
    save.type = "button";
    save.className = "cc-save";
    save.textContent = "Save";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";

    const dismiss = () => {
      this.closeComposer();
      onCancel?.();
    };
    const submit = async () => {
      const value = textarea.value.trim();
      if (!value) return dismiss();
      this.closeComposer();
      await onSubmit(value, planCheckbox.checked);
    };

    cancel.addEventListener("click", dismiss);
    save.addEventListener("click", () => void submit());
    textarea.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void submit();
      }
    });

    actions.append(save, cancel);
    panel.append(textarea, planToggle, hint, actions);
    this.composerHighlight = highlight;
    this.composer = panel;
    this.shadow.append(highlight, panel);
    this.reposition();
    this.startTicker();
    textarea.focus();
  }

  setPins(models: PinModel[], onRemove: (key: string) => void): void {
    this.mount();
    for (const pin of this.pins) pin.el.remove();

    this.pins = models.map((model) => {
      const wrap = document.createElement("div");
      wrap.className = `cc-pin-wrap cc-pin-wrap--${model.status}`;
      const marker = document.createElement("div");
      marker.className = "cc-pin";
      const glyphEl = document.createElement("span");
      glyphEl.textContent = glyph(model.kind);
      marker.append(glyphEl);
      const tip = document.createElement("div");
      tip.className = "cc-tip";
      tip.textContent = model.text;
      wrap.append(marker, tip);

      if (model.removable) {
        wrap.classList.add("cc-pin-wrap--removable");
        wrap.title = "Click to remove";
        wrap.addEventListener("click", (event) => {
          event.stopPropagation();
          onRemove(model.key);
        });
      }
      this.shadow.append(wrap);
      return { model, el: wrap, anchor: resolve(model.operator) };
    });
    this.reposition();
    this.startTicker();
  }

  private closeComposer(): void {
    this.composer?.remove();
    this.composerHighlight?.remove();
    this.composer = null;
    this.composerHighlight = null;
    this.composerAnchor = null;
  }

  // Anchors (pins, the selection box, the composer) ride DOM elements that can
  // move for reasons no scroll/resize event reports: transform-based scrolling,
  // animations, async layout shifts. A per-frame reconcile keeps them glued; it
  // self-stops once nothing is being tracked, so it costs nothing when idle.
  private startTicker(): void {
    if (this.rafId || !this.host.isConnected) return;
    const tick = () => {
      this.reposition();
      this.rafId = this.hasTracked() ? requestAnimationFrame(tick) : 0;
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private hasTracked(): boolean {
    return this.pins.length > 0 || this.selectionEl !== null || this.composerAnchor !== null;
  }

  private reposition(): void {
    for (const pin of this.pins) {
      if (!pin.anchor?.isConnected) pin.anchor = resolve(pin.model.operator);
      if (!pin.anchor) {
        pin.el.style.display = "none";
        continue;
      }
      const rect = pin.anchor.getBoundingClientRect();
      pin.el.style.display = "";
      pin.el.style.left = `${rect.left + window.scrollX}px`;
      pin.el.style.top = `${rect.top + window.scrollY}px`;
    }

    if (this.selectionEl?.isConnected && this.selectionBox)
      place(this.selectionBox, this.selectionEl);

    if (this.composerAnchor && this.composerHighlight && this.composer) {
      const rect = this.composerAnchor.getBoundingClientRect();
      place(this.composerHighlight, this.composerAnchor);
      this.composer.style.left = `${rect.left + window.scrollX}px`;
      this.composer.style.top = `${rect.bottom + window.scrollY + 8}px`;
    }
  }
}

function menuButton(glyphText: string, label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cc-menu-btn";
  const g = document.createElement("span");
  g.className = "cc-menu-glyph";
  g.textContent = glyphText;
  const l = document.createElement("span");
  l.textContent = label;
  btn.append(g, l);
  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return btn;
}

function place(box: HTMLElement, target: Element): void {
  const rect = target.getBoundingClientRect();
  box.style.left = `${rect.left + window.scrollX}px`;
  box.style.top = `${rect.top + window.scrollY}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}

function glyph(kind: PinModel["kind"]): string {
  if (kind === "style") return "◑";
  if (kind === "text") return "T";
  return "";
}

function resolve(xpath: string): Element | null {
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
