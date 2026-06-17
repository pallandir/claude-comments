# Claude Comments

Right-click any element on a local frontend, leave a comment anchored to it, and
have Claude Code pick up the list through an MCP server and plan a revamp.

See [DESIGN.md](./DESIGN.md) for the architecture and rationale.

## Layout

```
claude-comments/
├── extension/     Chromium MV3 extension (right-click, pin, composer)
├── mcp-server/    MCP server: localhost ingest + tools for Claude Code
└── DESIGN.md      Architecture and decisions
```

## Setup

Requires Node 20+.

```bash
npm install        # installs both workspaces and wires git hooks
npm run build      # builds the extension and the MCP server
```

## Install the MCP server in Claude Code

Build it, then register the local binary (runs from your project root so the
comment store lands in the right repo):

```bash
npm run build --workspace @claude-comments/mcp-server
claude mcp add claude-comments -- node ./mcp-server/dist/index.js
```

Claude Code spawns it automatically each session. It opens a localhost listener
on port 7474 (falling back to 7475/7476) for the extension, and writes comments
to `.claude/design-comments.md`.

## Install the extension

```bash
npm run build --workspace @claude-comments/extension
```

Then in Chrome: `chrome://extensions` → enable Developer mode → Load unpacked →
select `extension/dist`. For live development use `npm run dev --workspace
@claude-comments/extension` instead.

## Use it

1. Run your frontend on `localhost`.
2. Right-click an element → "Add Claude comment" → write a note → Save.
3. In Claude Code, ask it to read the comments (it calls `list_comments`), then
   plan and apply the revamp. It marks each item with `resolve_comment`.

Comments queue locally if Claude Code is not running and sync on the next session.

## Quality gates

- `npm run lint` / `npm run format` — Biome.
- Commits run lint-staged (pre-commit) and commitlint (commit-msg, Conventional
  Commits with scopes: extension, mcp-server, root, deps, ci, docs).
