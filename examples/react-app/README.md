# cc-example-react

A demo dashboard for exercising the Redline extension end to end. It is a
plain Vite + React app with `@react-dev-inspector/babel-plugin` enabled, so every
element carries `data-inspector-*` source attributes and comments resolve to
`src/App.jsx:line:column`.

## Run

```bash
npm install
npm run dev        # http://localhost:3001
```

## Full end-to-end with Claude Code

The MCP server writes the comment store into the directory of the Claude Code
session that spawns it, and source paths are relative to this app — so run Claude
Code **from this folder**.

1. Start this app (above) and make sure the extension is loaded and activated
   (click the toolbar icon → badge ON).
2. From `examples/react-app`, open Claude Code:
   ```bash
   claude
   ```
   This spawns the `redline` MCP server on `:7474`; the toolbar status dot
   turns green.
3. In the browser at `http://localhost:3001`, leave comments, change a color, or
   edit text, then click **⤴ Send** in the toolbar.
4. In Claude Code, run **`/comments`**. It reads the comments, views the
   screenshots, proposes a plan, applies the changes to `src/App.jsx`, and marks
   each one resolved.

The store lands in `examples/react-app/.claude/design-comments.md` with screenshots
in `examples/react-app/.claude/design-shots/`.

## Notes

- Green status dot = a Claude Code session is running (that is what spawns the
  server). Comments queue locally otherwise and sync on the next Send.
- One project at a time (single port 7474).
- This is a throwaway fixture; its `.claude/` output is local only.
