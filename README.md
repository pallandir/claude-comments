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

## Install the /comments skill

The pickup flow ships as a Claude Code skill in `skills/comments`. Install it into
the project you want to review (or globally):

```bash
mkdir -p .claude/skills && cp -r skills/comments .claude/skills/   # per project
# or: mkdir -p ~/.claude/skills && cp -r skills/comments ~/.claude/skills/
```

Then run `/comments` in Claude Code: it reads the comments (via the MCP tools,
falling back to `.claude/design-comments.md`), views the screenshots, proposes a
revamp plan, applies it on approval, and marks each comment resolved.

## Install the extension

```bash
npm run build --workspace @claude-comments/extension
```

Then in Chrome: `chrome://extensions` → enable Developer mode → Load unpacked →
select `extension/dist`. For live development use `npm run dev --workspace
@claude-comments/extension` instead.

## Use it

1. Run your frontend on `localhost`.
2. Click the **Claude Comments** toolbar icon to activate it on the page. A
   draggable Figma-style toolbar appears.
3. Use a tool: **Select** to inspect, **Comment** to leave a note, **Color** to
   change text/background color live, **Text** to edit copy inline. Each saved
   item pins to its element and lists in the toolbar.
4. **Send to Claude** syncs to the MCP server; **Handoff** downloads a Markdown
   report (with frontmatter) for a developer or any AI assistant.
5. In Claude Code, run `/comments`: it reads the items (`list_comments`), views
   screenshots, plans and applies the changes, and marks each `resolve_comment`.

Items queue locally if Claude Code is not running and sync on the next session.
Optional: toggle **Precise source** to map color edits to the exact CSS rule and
file via the Chrome debugger.

## Quality gates

- `npm run lint` / `npm run format` — Biome.
- Commits run lint-staged (pre-commit) and commitlint (commit-msg, Conventional
  Commits with scopes: extension, mcp-server, root, deps, ci, docs).
