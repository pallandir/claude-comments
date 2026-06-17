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
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === Node.ELEMENT_NODE && parts.length < 5) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      parts.unshift(`#${CSS.escape(node.id)}`);
      break;
    }
    const index = indexAmongSiblings(node);
    if (index !== null) part += `:nth-of-type(${index})`;
    parts.unshift(part);
    node = node.parentElement;
  }
  return parts.join(" > ");
}

function indexAmongSiblings(el: Element): number | null {
  const parent = el.parentElement;
  if (!parent) return null;
  const sameTag = [...parent.children].filter((c) => c.tagName === el.tagName);
  if (sameTag.length < 2) return null;
  return sameTag.indexOf(el) + 1;
}
