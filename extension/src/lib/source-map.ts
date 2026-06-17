import type { SourceLocation } from "../types.js";

type Reader = (el: Element) => SourceLocation | null;

const reactInspector: Reader = (el) => {
  const path = el.getAttribute("data-inspector-relative-path");
  const line = el.getAttribute("data-inspector-line");
  const column = el.getAttribute("data-inspector-column");
  if (!path || !line) return null;
  return { path, line: Number(line), column: Number(column ?? 0), via: "react-dev-inspector" };
};

const vueInspector: Reader = (el) => {
  const raw = el.getAttribute("data-v-inspector");
  if (!raw) return null;
  const [path, line, column] = raw.split(":");
  if (!path || !line) return null;
  return {
    path,
    line: Number(line),
    column: Number(column ?? 0),
    via: "vite-plugin-vue-inspector",
  };
};

const svelteInspector: Reader = (el) => {
  const raw = el.getAttribute("data-svelte-source") ?? el.getAttribute("data-svelte");
  if (!raw) return null;
  const match = raw.match(/(.+):(\d+):(\d+)/);
  if (!match) return null;
  return {
    path: match[1],
    line: Number(match[2]),
    column: Number(match[3]),
    via: "svelte-inspector",
  };
};

const READERS: Reader[] = [reactInspector, vueInspector, svelteInspector];

export function resolveSource(el: Element): SourceLocation | null {
  let node: Element | null = el;
  while (node && node.nodeType === Node.ELEMENT_NODE) {
    for (const read of READERS) {
      const found = read(node);
      if (found) return found;
    }
    node = node.parentElement;
  }
  return null;
}
