import type { QueuedRequest } from "../types.js";

export function buildHandoffMarkdown(requests: QueuedRequest[]): string {
  const source = requests.length ? safeHost(requests[0].url) : "frontend";
  const lines = [
    "---",
    "title: Design handoff",
    `source: ${source}`,
    `generated: ${new Date().toISOString()}`,
    `count: ${requests.length}`,
    "---",
    "",
    "# Design handoff",
    "",
    "Each item below is a requested change with where to find it. Hand to a developer or paste into your AI coding assistant.",
    "",
  ];

  requests.forEach((r, i) => {
    lines.push(`## ${i + 1}. ${kindLabel(r)} · ${routeOf(r.url)}`, "");
    if (r.text) lines.push(`> ${r.text}`, "");
    for (const change of r.styleChanges ?? []) {
      const at = change.cssSource ? ` (\`${change.cssSource.file}:${change.cssSource.line}\`)` : "";
      lines.push(`- \`${change.property}\`: \`${change.from}\` → \`${change.to}\`${at}`);
    }
    if (r.textChange) lines.push(`- text: "${r.textChange.from}" → "${r.textChange.to}"`);
    if (r.source) {
      lines.push(`- Source: \`${r.source.path}:${r.source.line}:${r.source.column}\``);
    }
    lines.push(`- Element: \`${r.fingerprint.selector}\``);
    lines.push(`- Page: ${r.url}`, "");
    if (r.screenshotDataUrl) lines.push(`![item ${i + 1}](${r.screenshotDataUrl})`, "");
  });

  return lines.join("\n");
}

export function downloadHandoff(requests: QueuedRequest[]): void {
  const blob = new Blob([buildHandoffMarkdown(requests)], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `design-handoff-${safeHost(location.href)}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function kindLabel(r: QueuedRequest): string {
  if (r.kind === "style") return "Style change";
  if (r.kind === "text") return "Text change";
  return "Comment";
}

function routeOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).host.replace(/[:.]/g, "-");
  } catch {
    return "frontend";
  }
}
