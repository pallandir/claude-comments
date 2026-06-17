<a name="readme-top"></a>

<br />
<div align="center">
  <a href="#">
    <img src="./public-assets/logo.png" alt="Logo" width="280" height="280">
  </a>
  <h3 align="center">Redline</h3>

  <p align="center">
    Leave real-time comments on any local interface and let your AI coding
    assistant act on them.
    <br />
    <br />
    <a href="https://github.com/pallandir/redline/issues">Report Bug</a>
    ·
    <a href="https://github.com/pallandir/redline/issues">Request Feature</a>
  </p>
</div>

## TL;DR

Redline ships three pieces: a **browser extension**, an **MCP server**, and a
**/comments skill**. Build everything, then wire it into your AI coding
assistant (the example below uses Claude Code, the tested path):

```sh
# 1. Build the extension and the MCP server
npm install
npm run build

# 2. Register the MCP server with your assistant (run from the repo root once).
#    Claude Code:
claude mcp add redline -- node "$(pwd)/mcp-server/dist/index.js"
#    Any other MCP client: point it at `node <repo>/mcp-server/dist/index.js`
#    over stdio (see "Compatibility" below).

# 3. Install the pickup skill into the project you want to review
mkdir -p .claude/skills && cp -r ./skills/comments .claude/skills/

# 4. Load the extension in Chrome:
#    chrome://extensions -> enable Developer mode -> Load unpacked -> select extension/dist
```

Now open a `localhost` frontend, click the Redline toolbar icon, leave comments,
hit **Send**, and run `/comments` in Claude Code (or have your assistant call the
`list_comments` MCP tool).

> [!NOTE]
> Redline works with any MCP-capable AI coding assistant. It has been **tested
> with Claude Code**; other clients (Cursor, Windsurf, etc.) should work but are
> currently unverified.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## About This Project

**Redline** is a Chromium (Manifest V3) extension paired with an MCP server that
lets you click any element on a locally running frontend, leave a comment
anchored to it, and have your **AI coding assistant** pick up the list and plan a
revamp against your real source files. Because the server speaks standard MCP, it
works with any MCP-capable assistant; it has been tested with **Claude Code**. It
includes:

- **Browser extension**, a Figma-style dev toolbar to **select**, **comment**,
  recolor **text/background** live, and edit **copy** inline, with each item
  pinned to its element.
- **MCP server** ([`@modelcontextprotocol`](https://modelcontextprotocol.io/)),
  a single process that speaks MCP to your assistant over stdio and opens a
  localhost listener the extension posts to. It exposes `list_comments`,
  `get_comment`, `resolve_comment`, and `clear_resolved`.
- **`/comments` skill** (Claude Code), the pickup flow that reads the comments,
  views the screenshots, proposes a plan, and only applies edits once you
  approve. Other assistants call the same MCP tools directly.
- **Framework-agnostic source mapping**, reading inspector attributes for React,
  Vue, and Svelte, with a DOM-fingerprint fallback when none are present.

### Why Redline

The usual loop for design feedback on a local app is to take a screenshot,
describe the element by hand, and paste it into chat. Redline replaces that with
structured, element-anchored comments that carry a stable selector, the visible
text, key computed styles, a cropped screenshot, and, when available, a precise
`file:line:column`. Your assistant reads them natively through the MCP tools, so
the feedback lands on the real source instead of a description of it.

Comments stay local and out of version control. They queue in the browser when
the assistant's server is closed and drain automatically on the next session.

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
the comment store lands in that repo. Pick whichever install channel suits your
assistant:

```sh
# From source (this repo, after npm run build):
claude mcp add redline -- node "$(pwd)/mcp-server/dist/index.js"

# From npm (no clone needed), once published:
claude mcp add redline -- npx -y @redline/mcp-server

# Claude Desktop / one-click MCP clients: install the redline.mcpb bundle
# (built with `npm run pack:mcpb --workspace @redline/mcp-server`) and pick your
# project directory when prompted.

# Any other MCP client: configure a stdio server whose command is
# `node <repo>/mcp-server/dist/index.js` (or `npx -y @redline/mcp-server`),
# launched from the project root you want to review.
```

Your assistant spawns it automatically each session. It opens a localhost
listener on port 7474 (falling back to 7475/7476) and writes comments to
`.claude/design-comments.md` with screenshots in `.claude/design-shots/`.

**Install the `/comments` skill** into the project you want to review, or globally:

```sh
mkdir -p .claude/skills && cp -r ./skills/comments .claude/skills/      # per project
# or: mkdir -p ~/.claude/skills && cp -r ./skills/comments ~/.claude/skills/
```

**Load the extension.** Once published, install it from the Chrome Web Store. To
run a local build, open `chrome://extensions`, enable Developer mode, choose
**Load unpacked**, and select `extension/dist`. For live development use
`npm run dev --workspace @redline/extension` instead.

> [!IMPORTANT]
> Both the comment store and screenshots are written under `.claude/` and are
> gitignored. Keep them out of version control.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## How To Use It

1. Run your frontend on `localhost` and open your AI coding assistant in the same
   repo (the MCP server must be registered there).
2. Click the **Redline** toolbar icon to activate it on the page. A draggable
   Figma-style toolbar appears.
3. Pick a tool: **Select** to inspect an element, **Comment** to leave a note,
   **Color** to change text or background live, **Text** to edit copy inline.
   Each saved item pins to its element and lists in the toolbar.
4. **Send** syncs the items to the MCP server. **Handoff** instead downloads a
   Markdown report (with frontmatter) for a developer or any AI assistant.
5. In Claude Code, run `/comments`; with any other MCP client, ask it to read the
   comments via `list_comments`. It views the screenshots, proposes a plan, then
   stops. It applies the changes and marks each `resolve_comment` only after you
   approve.

For hands-off pickup, start the skill in a loop once so clicking **Send** is
enough to trigger a fresh plan on the next poll:

```sh
/loop /comments
```

Optional: toggle **Precise** to map color edits to the exact CSS rule and file
via the Chrome debugger. The first time you enable it, Redline asks for a
one-time `debugger` permission grant (it is not requested at install time).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Compatibility

Redline's server speaks standard MCP over stdio, so it works with any MCP-capable
AI coding assistant. It has been **tested with Claude Code**. Other clients
(Cursor, Windsurf, and similar) should work but are currently unverified; the
`/comments` skill and `claude mcp add`/`/loop` commands are Claude Code
conveniences, while `list_comments`, `get_comment`, `resolve_comment`, and
`clear_resolved` are plain MCP tools any client can call.

The extension targets Chromium (Manifest V3): Chrome, Edge, Brave, Arc. A Firefox
port is not yet available.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Security & privacy

Everything stays on your machine: the server binds to `127.0.0.1` only, the
extension runs only on localhost, and the listener rejects requests from web
pages. See [SECURITY.md](./SECURITY.md) for the threat model and
[PRIVACY.md](./PRIVACY.md) for data handling.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

This repository and all its content is under the **PolyForm Noncommercial
License 1.0.0**. You may use, modify, and share it for noncommercial purposes
only. All commercial rights are reserved by the copyright holder. See
[LICENSE.md](./LICENSE.md) for the full terms and commercial licensing contact.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
