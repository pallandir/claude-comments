# @claude-comments/mcp-server

MCP server that ingests UI comments from the Claude Comments extension and
exposes them to Claude Code.

It does two things in one process:

- Speaks MCP over stdio to Claude Code (spawned automatically per session).
- Opens a localhost HTTP listener (7474, then 7475/7476) the browser extension
  posts comments to.

Comments are stored in `.claude/design-comments.md` and screenshots in
`.claude/design-shots/`, relative to the working directory it is launched from.
Both are gitignored.

## Tools

| Tool | Purpose |
| --- | --- |
| `list_comments(status?)` | List comments, optionally filtered by status. |
| `get_comment(id)` | One comment with its source hint and screenshot path. |
| `resolve_comment(id, status)` | Set `open` / `resolved` / `wontfix`. |
| `clear_resolved()` | Remove every comment that is not open. |

## Env

| Variable | Default | Meaning |
| --- | --- | --- |
| `CLAUDE_COMMENTS_PORT` | 7474 | Preferred ingest port (falls back to 7475/7476). |
| `CLAUDE_COMMENTS_ROOT` | `process.cwd()` | Where the store is written. |

## Develop

```bash
npm run dev --workspace @claude-comments/mcp-server     # tsup watch
npm run build --workspace @claude-comments/mcp-server
```
