<a name="readme-top"></a>

<br />
<div align="center">
  <a href="#">
    <img src="./public-assets/redline.png" alt="Logo" width="280" height="280">
  </a>
  <h3 align="center">Redline</h3>

  <p align="center">
    Leave real-time comments on any interface and let your local AI coding
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
**/comments skill**. The MCP server and skill install together as a Claude Code
plugin; the extension installs from the Chrome Web Store. Nothing to clone or
build:

```sh
# 1. In Claude Code, add the marketplace and install the plugin. This registers
#    the redline MCP server (run on demand via npx) and the /comments skill,
#    with nothing to clone or build:
/plugin marketplace add pallandir/redline
/plugin install redline@redline
```

The browser extension is **coming soon to the Chrome Web Store**. Until then,
build it once and load it unpacked: run `npm install && npm run build`, then in
`chrome://extensions` enable Developer mode and **Load unpacked** →
`extension/dist` (see [Getting Started](#getting-started)).

```sh
# Prefer another MCP client, or no plugin? Register the server directly over
# stdio; it is published to npm and runs with no clone:
claude mcp add redline -- npx -y @redline/mcp-server
```

Now open your frontend and click the Redline toolbar icon. On a `localhost` dev
server, comments save into the project automatically as you leave them; run
`/comments` in Claude Code to pick them up, or `/loop /comments` once to pick up
every comment continuously. On a remote preview there is no local project, so use
**Handoff** to export a Markdown report instead. Clicking the icon is what grants
Redline access to that one tab; it has no access to any page until you do.

> [!NOTE]
> Redline works with any MCP-capable AI coding assistant. It has been **tested
> with Claude Code**; other clients (Cursor, Windsurf, etc.) should work but are
> currently unverified.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## About This Project

**Redline** is a Chromium (Manifest V3) extension paired with an MCP server that
lets you click any element on a running frontend, local or a remote preview,
leave a comment anchored to it, and have your **AI coding assistant** pick up the
list and plan a revamp against your real source files. The comments only ever
travel to a listener on your own machine, never to a remote backend. Because the
server speaks standard MCP, it works with any MCP-capable assistant; it has been
tested with **Claude Code**. It includes:

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

The usual loop for design feedback on a running app is to take a screenshot,
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

**Install the plugin (MCP server + `/comments` skill).** In Claude Code:

```sh
/plugin marketplace add pallandir/redline
/plugin install redline@redline
```

This registers the redline MCP server, run on demand via `npx -y
@redline/mcp-server` (published to npm, no clone), and the `/comments` skill. Your
assistant spawns the server each session from the project root you are working
in, so the comment store lands in that repo: a localhost listener on port 7474
(falling back to 7475/7476), writing to `.claude/design-comments.md` with
screenshots in `.claude/design-shots/`.

**Other MCP clients.** Point any stdio MCP client at `npx -y @redline/mcp-server`,
launched from the project root you want to review:

```sh
claude mcp add redline -- npx -y @redline/mcp-server
```

For Claude Desktop and other one-click clients, install the `redline.mcpb` bundle
(built with `npm run pack:mcpb --workspace @redline/mcp-server`) and pick your
project directory when prompted. Not using the plugin? The `/comments` skill
lives in `plugin/skills/comments`; copy it into `.claude/skills/` (per project)
or `~/.claude/skills/` (global).

**Install the browser extension.** Coming soon to the Chrome Web Store. Until
then, build it from source and load it unpacked (requires Node 20+):

```sh
npm install
npm run build --workspace @redline/extension
# chrome://extensions -> Developer mode -> Load unpacked -> extension/dist
# live development: npm run dev --workspace @redline/extension
```

> [!IMPORTANT]
> Both the comment store and screenshots are written under `.claude/` and are
> gitignored. Keep them out of version control.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## How To Use It

1. Run your frontend (a `localhost` dev server or a remote preview) and open your
   AI coding assistant in the repo whose source you want to edit (the MCP server
   must be registered there).
2. Click the **Redline** toolbar icon to activate it on the current tab. This is
   what grants access to that one tab; the extension touches no page until you
   click, and the access is dropped when the tab navigates. A draggable
   Figma-style toolbar appears.
3. Pick a tool: **Select** to inspect an element, **Comment** to leave a note,
   **Color** to change text or background live, **Text** to edit copy inline.
   Each saved item pins to its element and lists in the toolbar.
4. On `localhost`, items save into the project's MCP server automatically as you
   create them. **Handoff** downloads a Markdown report (with frontmatter) for a
   developer or any AI assistant; use it on remote pages, where there is no local
   project to sync into.
5. In Claude Code, run `/comments`; with any other MCP client, ask it to read the
   comments via `list_comments`. It views the screenshots, proposes a plan, then
   stops. It applies the changes and resolves each comment only after you approve,
   from the toolbar (**Apply**) or in chat.

For hands-off pickup, start the skill in a loop once so new comments trigger a
fresh plan automatically, with no need to re-run `/comments`:

```sh
/loop /comments
```

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
extension's only network access is that loopback listener, and the listener
rejects requests from web pages. You can comment on any site, but the extension
has no standing access to any page; it is injected into a tab only when you click
to activate it (`activeTab`), and that access ends on navigation. See
[SECURITY.md](./SECURITY.md) for the threat model and
[PRIVACY.md](./PRIVACY.md) for data handling.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

This repository and all its content is under the **PolyForm Noncommercial
License 1.0.0**. You may use, modify, and share it for noncommercial purposes
only. All commercial rights are reserved by the copyright holder. See
[LICENSE.md](./LICENSE.md) for the full terms and commercial licensing contact.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
