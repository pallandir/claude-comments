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
    lines.push(`## ${i + 1}. ${kindLabel(r)} · ${r.metadata.page}`, "");
    if (r.comment) lines.push(`> ${r.comment}`, "");
    const op = r.operation;
    if (op.type === "style" && op.property && op.from !== null && op.to !== null) {
      lines.push(`- \`${op.property}\`: \`${op.from}\` → \`${op.to}\``);
    }
    if (op.type === "text" && op.from !== null && op.to !== null) {
      lines.push(`- text: "${op.from}" → "${op.to}"`);
    }
    if (r.source) {
      lines.push(`- Source: \`${r.source.path}:${r.source.line}:${r.source.column}\``);
    }
    lines.push(`- Element: \`${r.operator}\``);
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
  if (r.operation.type === "style") return "Style change";
  if (r.operation.type === "text") return "Text change";
  return "Comment";
}

function safeHost(url: string): string {
  try {
    return new URL(url).host.replace(/[:.]/g, "-");
  } catch {
    return "frontend";
  }
}
