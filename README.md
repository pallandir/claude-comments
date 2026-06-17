<a name="readme-top"></a>

<br />
<div align="center">
  <a href="#">
    <img src="./public-assets/logo.png" alt="Logo" width="80" height="80">
  </a>
  <h3 align="center">Redline</h3>

  <p align="center">
    Comment on any local frontend, picked up by Claude Code.
    <br />
    <br />
    <a href="https://github.com/pallandir/redline/issues">Report Bug</a>
    ·
    <a href="https://github.com/pallandir/redline/issues">Request Feature</a>
  </p>
</div>

## TL;DR

Redline ships three pieces: a **browser extension**, an **MCP server**, and a
**/comments skill**. Build everything, then wire it into Claude Code:

```sh
# 1. Build the extension and the MCP server
npm install
npm run build

# 2. Register the MCP server with Claude Code (run from the repo root once)
claude mcp add redline -- node "$(pwd)/mcp-server/dist/index.js"

# 3. Install the pickup skill into the project you want to review
mkdir -p .claude/skills && cp -r ./skills/comments .claude/skills/

# 4. Load the extension in Chrome:
#    chrome://extensions -> enable Developer mode -> Load unpacked -> select extension/dist
```

Now open a `localhost` frontend, click the Redline toolbar icon, leave comments,
hit **Send to Claude**, and run `/comments` in Claude Code.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## About This Project

**Redline** is a Chromium (Manifest V3) extension paired with an MCP server that
lets you right-click any element on a locally running frontend, leave a comment
anchored to it, and have **Claude Code** pick up the list and plan a revamp
against your real source files. It includes:

- **Browser extension**, a Figma-style dev toolbar to **select**, **comment**,
  recolor **text/background** live, and edit **copy** inline, with each item
  pinned to its element.
- **MCP server** ([`@modelcontextprotocol`](https://modelcontextprotocol.io/)),
  a single process that speaks MCP to Claude Code over stdio and opens a
  localhost listener the extension posts to. It exposes `list_comments`,
  `get_comment`, `resolve_comment`, and `clear_resolved`.
- **`/comments` skill**, the pickup flow that reads the comments, views the
  screenshots, proposes a plan, and only applies edits once you approve.
- **Framework-agnostic source mapping**, reading inspector attributes for React,
  Vue, and Svelte, with a DOM-fingerprint fallback when none are present.

### Why Redline

The usual loop for design feedback on a local app is to take a screenshot,
describe the element by hand, and paste it into chat. Redline replaces that with
structured, element-anchored comments that carry a stable selector, the visible
text, key computed styles, a cropped screenshot, and, when available, a precise
`file:line:column`. Claude Code reads them natively through the MCP tools, so the
feedback lands on the real source instead of a description of it.

Comments stay local and out of version control. They queue in the browser when
Claude Code is closed and drain automatically on the next session.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- GETTING STARTED -->

## Getting Started

Requires Node 20+.

```sh
# Install both workspaces and wire git hooks
npm install

# Build the extension and the MCP server
npm run build
```

**Register the MCP server.** Run it from the project root you want to review so
the comment store lands in that repo:

```sh
claude mcp add redline -- node "$(pwd)/mcp-server/dist/index.js"
```

Claude Code spawns it automatically each session. It opens a localhost listener
on port 7474 (falling back to 7475/7476) and writes comments to
`.claude/design-comments.md` with screenshots in `.claude/design-shots/`.

**Install the `/comments` skill** into the project you want to review, or globally:

```sh
mkdir -p .claude/skills && cp -r ./skills/comments .claude/skills/      # per project
# or: mkdir -p ~/.claude/skills && cp -r ./skills/comments ~/.claude/skills/
```

**Load the extension.** In Chrome, open `chrome://extensions`, enable Developer
mode, choose **Load unpacked**, and select `extension/dist`. For live development
use `npm run dev --workspace @redline/extension` instead.

> [!IMPORTANT]
> Both the comment store and screenshots are written under `.claude/` and are
> gitignored. Keep them out of version control.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## How To Use It

1. Run your frontend on `localhost` and open Claude Code in the same repo.
2. Click the **Redline** toolbar icon to activate it on the page. A draggable
   Figma-style toolbar appears.
3. Pick a tool: **Select** to inspect an element, **Comment** to leave a note,
   **Color** to change text or background live, **Text** to edit copy inline.
   Each saved item pins to its element and lists in the toolbar.
4. **Send to Claude** syncs the items to the MCP server. **Handoff** instead
   downloads a Markdown report (with frontmatter) for a developer or any other AI
   assistant.
5. In Claude Code, run `/comments`. It reads the items via `list_comments`, views
   the screenshots, and proposes a plan, then stops. It applies the changes and
   marks each `resolve_comment` only after you approve.

For hands-off pickup, start the skill in a loop once so clicking **Send** is
enough to trigger a fresh plan on the next poll:

```sh
/loop /comments
```

Optional: toggle **Precise source** to map color edits to the exact CSS rule and
file via the Chrome debugger.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

This repository and all its content is under the **PolyForm Noncommercial
License 1.0.0**. You may use, modify, and share it for noncommercial purposes
only. All commercial rights are reserved by the copyright holder. See
[LICENSE.md](./LICENSE.md) for the full terms and commercial licensing contact.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
