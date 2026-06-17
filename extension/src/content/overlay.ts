import type { PinModel } from "../messages.js";
import overlayCss from "./overlay.css?inline";

interface ActivePin {
  model: PinModel;
  el: HTMLElement;
  anchor: Element | null;
}

export class Overlay {
  private readonly host: HTMLElement;
  private readonly shadow: ShadowRoot;
  private pins: ActivePin[] = [];
  private highlight: HTMLElement | null = null;
  private composer: HTMLElement | null = null;
  private composerAnchor: Element | null = null;
  private rafQueued = false;

  constructor() {
    this.host = document.createElement("div");
    this.host.id = "claude-comments-root";
    this.shadow = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = overlayCss;
    this.shadow.append(style);

    const onMove = () => this.scheduleReposition();
    window.addEventListener("scroll", onMove, { passive: true, capture: true });
    window.addEventListener("resize", onMove, { passive: true });
  }

  setHidden(hidden: boolean): void {
    this.host.style.visibility = hidden ? "hidden" : "";
  }

  showComposer(
    target: Element,
    onSubmit: (text: string) => Promise<void>,
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

    const actions = document.createElement("div");
    actions.className = "cc-actions";
    const save = document.createElement("button");
    save.className = "cc-save";
    save.textContent = "Save";
    const cancel = document.createElement("button");
    cancel.textContent = "Cancel";

    const dismiss = () => {
      this.closeComposer();
      onCancel?.();
    };
    const submit = async () => {
      const text = textarea.value.trim();
      if (!text) return dismiss();
      this.closeComposer();
      await onSubmit(text);
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
    panel.append(textarea, hint, actions);
    this.highlight = highlight;
    this.composer = panel;
    this.shadow.append(highlight, panel);
    this.reposition();
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
      return { model, el: wrap, anchor: resolve(model.selector) };
    });

    this.reposition();
  }

  private mount(): void {
    if (!this.host.isConnected) document.documentElement.append(this.host);
  }

  private closeComposer(): void {
    this.composer?.remove();
    this.highlight?.remove();
    this.composer = null;
    this.highlight = null;
    this.composerAnchor = null;
  }

  private scheduleReposition(): void {
    if (this.rafQueued) return;
    this.rafQueued = true;
    requestAnimationFrame(() => {
      this.rafQueued = false;
      this.reposition();
    });
  }

  private reposition(): void {
    for (const pin of this.pins) {
      if (!pin.anchor?.isConnected) pin.anchor = resolve(pin.model.selector);
      if (!pin.anchor) {
        pin.el.style.display = "none";
        continue;
      }
      const rect = pin.anchor.getBoundingClientRect();
      pin.el.style.display = "";
      pin.el.style.left = `${rect.left + window.scrollX}px`;
      pin.el.style.top = `${rect.top + window.scrollY}px`;
    }

    if (this.composerAnchor && this.highlight && this.composer) {
      const rect = this.composerAnchor.getBoundingClientRect();
      this.highlight.style.left = `${rect.left + window.scrollX}px`;
      this.highlight.style.top = `${rect.top + window.scrollY}px`;
      this.highlight.style.width = `${rect.width}px`;
      this.highlight.style.height = `${rect.height}px`;
      this.composer.style.left = `${rect.left + window.scrollX}px`;
      this.composer.style.top = `${rect.bottom + window.scrollY + 8}px`;
    }
  }
}

function resolve(selector: string): Element | null {
  try {
    return document.querySelector(selector);
  } catch {
    return null;
  }
}
