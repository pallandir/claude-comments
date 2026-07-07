# @northstar/mcp-server

MCP server that ingests real-time UI comments from the Northstar extension and
exposes them to your AI coding assistant. It speaks standard MCP, so it works
with any MCP-capable client; it has been tested with Claude Code.

It does two things in one process:

- Speaks MCP over stdio to your assistant (spawned automatically per session).
- Opens a localhost HTTP listener (7474, then 7475/7476) the browser extension
  posts comments to. The listener binds to `127.0.0.1` only and accepts requests
  solely from the extension (web-page origins and non-loopback hosts are
  rejected); payloads are validated against a strict schema.

Comments are stored in `.northstar/design-comments.md` and screenshots in
`.northstar/design-shots/`, relative to the working directory it is launched from.
The `.northstar/` folder is gitignored (the server also writes a `.gitignore`
inside it).

## Install

```bash
# Register from npm (no clone needed), e.g. with Claude Code:
claude mcp add northstar -- npx -y @northstar/mcp-server
```

## Tools

The server exposes 11 tools. `list_comments` returns full per-comment detail, so
there is no separate per-comment fetch.

| Tool | Purpose |
| --- | --- |
| `bind_session(sessionId)` | Claim ownership of comment processing for this watch session. |
| `unbind_session()` | Release ownership so another session can take over. |
| `wait_for_update(sinceVersion?, timeoutMs?)` | Long-poll until the store changes; heartbeats the session binding. |
| `list_comments(status?)` | List comments with full detail, optionally filtered by `open` / `resolved` / `wontfix`. |
| `defer_comment(id, reason, ...)` | Park a comment (`needs-plan` or `feedback`) and notify the toolbar. |
| `list_deferred()` | List deferred comments with their category and reason. |
| `resolve_comment(id, status)` | Set a single comment to `open` / `resolved` / `wontfix`. |
| `resolve_comments(resolutions[])` | Resolve or wontfix many comments in one call. |
| `list_rating_requests(status?)` | List `pending` or `scored` page rating requests. |
| `submit_rating(id, score, ui, ux, coherence, notes, sections)` | Submit a purpose-fit UI/UX score for a rating request. |
| `clear_resolved()` | Remove every comment that is not open. |

## HTTP endpoints (for the extension)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Port discovery probe; returns `{ ok, service: "northstar" }` so the extension only trusts a Northstar server. |
| `GET` | `/comments` | List stored comments (lets the extension show synced pins). |
| `POST` | `/comments` | Ingest a new comment from the extension. |
| `DELETE` | `/comments?url=<page>` | Delete stored comments for a page (omit `url` to clear all). |

## Env

| Variable | Default | Meaning |
| --- | --- | --- |
| `NORTHSTAR_PORT` | 7474 | Preferred ingest port (falls back to 7475/7476). |
| `NORTHSTAR_ROOT` | `process.cwd()` | Where the store is written. |

## Develop

```bash
npm run dev --workspace @northstar/mcp-server     # tsup watch
npm run build --workspace @northstar/mcp-server
```
