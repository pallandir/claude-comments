import type { StyleChange } from "../types.js";
import type { Surface } from "./surface.js";

export function openColorPanel(
  surface: Surface,
  el: HTMLElement,
  commit: (changes: StyleChange[]) => void,
  cancel: () => void,
): void {
  const computed = getComputedStyle(el);
  const fromColor = computed.color;
  const fromBg = computed.backgroundColor;
  const originalInline = { color: el.style.color, background: el.style.backgroundColor };

  const panel = document.createElement("div");
  panel.className = "cc-tool-panel";

  const colorInput = field(panel, "Text color", rgbToHex(fromColor), (hex) => {
    el.style.color = hex;
  });
  const bgInput = field(panel, "Background", rgbToHex(fromBg), (hex) => {
    el.style.backgroundColor = hex;
  });

  const actions = document.createElement("div");
  actions.className = "cc-actions";
  const save = document.createElement("button");
  save.type = "button";
  save.className = "cc-save";
  save.textContent = "Save";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Cancel";
  actions.append(save, close);
  panel.append(actions);

  const teardown = () => panel.remove();
  close.addEventListener("click", () => {
    el.style.color = originalInline.color;
    el.style.backgroundColor = originalInline.background;
    teardown();
    cancel();
  });
  save.addEventListener("click", () => {
    const changes: StyleChange[] = [];
    if (colorInput.value && rgbToHex(fromColor) !== colorInput.value) {
      changes.push({ property: "color", from: fromColor, to: colorInput.value });
    }
    if (bgInput.value && rgbToHex(fromBg) !== bgInput.value) {
      changes.push({ property: "background-color", from: fromBg, to: bgInput.value });
    }
    teardown();
    if (changes.length) commit(changes);
    else cancel();
  });

  surface.append(panel);
  positionNear(panel, el);
}

export function openTextEditor(
  surface: Surface,
  el: HTMLElement,
  commit: (from: string, to: string) => void,
  cancel: () => void,
): void {
  const from = (el.textContent ?? "").trim();

  const hint = document.createElement("div");
  hint.className = "cc-tool-hint";
  hint.textContent = "Enter to save · Esc to cancel";
  surface.append(hint);
  positionNear(hint, el);

  el.setAttribute("contenteditable", "true");
  (el as HTMLElement).focus();
  selectAll(el);

  let done = false;
  const finish = (saveIt: boolean) => {
    if (done) return;
    done = true;
    el.removeEventListener("keydown", onKey);
    el.removeAttribute("contenteditable");
    hint.remove();
    const to = (el.textContent ?? "").trim();
    if (saveIt && to !== from) {
      commit(from, to);
    } else {
      if (!saveIt) el.textContent = from;
      cancel();
    }
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      finish(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  };
  el.addEventListener("keydown", onKey);
  el.addEventListener("blur", () => finish(true), { once: true });
}

function field(
  panel: HTMLElement,
  label: string,
  hex: string,
  onInput: (hex: string) => void,
): HTMLInputElement {
  const row = document.createElement("label");
  row.className = "cc-field";
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.type = "color";
  input.value = hex;
  input.addEventListener("input", () => onInput(input.value));
  row.append(span, input);
  panel.append(row);
  return input;
}

function positionNear(box: HTMLElement, el: Element): void {
  const rect = el.getBoundingClientRect();
  const left = Math.min(rect.left, window.innerWidth - 240);
  const top = Math.min(rect.bottom + 8, window.innerHeight - 120);
  box.style.left = `${Math.max(8, left) + window.scrollX}px`;
  box.style.top = `${Math.max(8, top) + window.scrollY}px`;
}

function selectAll(el: Element): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function rgbToHex(rgb: string): string {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return "#000000";
  const hex = (n: string) => Number(n).toString(16).padStart(2, "0");
  return `#${hex(match[1])}${hex(match[2])}${hex(match[3])}`;
}
