import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CommentStore } from "./store.js";
import type { Comment } from "./types.js";

const statusEnum = z.enum(["open", "resolved", "wontfix"]);

export function createMcpServer(store: CommentStore): McpServer {
  const server = new McpServer({
    name: "claude-comments",
    version: "0.1.0",
  });

  server.tool(
    "list_comments",
    "List UI comments left through the Claude Comments extension. Filter by status.",
    { status: statusEnum.optional() },
    async ({ status }) => {
      const comments = await store.list(status);
      return text(comments.length ? comments.map(render).join("\n\n") : "No comments.");
    },
  );

  server.tool(
    "get_comment",
    "Get a single comment by id, including its source hint and screenshot path.",
    { id: z.string() },
    async ({ id }) => {
      const comment = await store.get(id);
      return text(comment ? render(comment) : `No comment with id ${id}.`);
    },
  );

  server.tool(
    "resolve_comment",
    "Set the status of a comment (open, resolved, or wontfix) after acting on it.",
    { id: z.string(), status: statusEnum },
    async ({ id, status }) => {
      const comment = await store.setStatus(id, status);
      return text(comment ? `Comment ${id} -> ${status}.` : `No comment with id ${id}.`);
    },
  );

  server.tool("clear_resolved", "Remove all comments whose status is not open.", {}, async () => {
    const removed = await store.clearResolved();
    return text(`Removed ${removed} comment(s).`);
  });

  return server;
}

function render(c: Comment): string {
  const lines = [
    `[${c.status}] ${c.id} · ${c.route}`,
    c.text,
    c.source
      ? `source: ${c.source.path}:${c.source.line}:${c.source.column} (${c.source.via})`
      : `selector: ${c.fingerprint.selector}`,
  ];
  if (c.screenshot) lines.push(`screenshot: ${c.screenshot}`);
  lines.push(`url: ${c.url}`);
  return lines.join("\n");
}

function text(value: string) {
  return { content: [{ type: "text" as const, text: value }] };
}
