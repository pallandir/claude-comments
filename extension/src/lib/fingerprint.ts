import type { Fingerprint } from "../types.js";

const STYLE_KEYS = [
  "display",
  "color",
  "backgroundColor",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "padding",
  "margin",
  "borderRadius",
];

export function captureFingerprint(el: Element): Fingerprint {
  const rect = el.getBoundingClientRect();
  return {
    selector: buildSelector(el),
    innerText: (el.textContent ?? "").trim().slice(0, 120),
    styles: pickStyles(el),
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    },
  };
}

function pickStyles(el: Element): Record<string, string> {
  const computed = getComputedStyle(el);
  const out: Record<string, string> = {};
  for (const key of STYLE_KEYS) {
    out[key] = computed.getPropertyValue(toKebab(key));
  }
  return out;
}

function toKebab(value: string): string {
  return value.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function buildSelector(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === Node.ELEMENT_NODE) {
    const id = node.id ? `#${CSS.escape(node.id)}` : null;
    if (id && isUnique(id)) {
      parts.unshift(id);
      break;
    }
    parts.unshift(`${node.tagName.toLowerCase()}:nth-child(${childIndex(node)})`);
    const candidate = parts.join(" > ");
    if (isUnique(candidate)) return candidate;
    node = node.parentElement;
  }
  return parts.join(" > ");
}

function childIndex(el: Element): number {
  let index = 1;
  let sibling = el.previousElementSibling;
  while (sibling) {
    index++;
    sibling = sibling.previousElementSibling;
  }
  return index;
}

function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}
