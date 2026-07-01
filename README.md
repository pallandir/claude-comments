<a name="readme-top"></a>

<br />
<div align="center">
  <a href="#">
    <img src="./public-assets/redline.png" alt="Redline logo" width="280" height="280">
  </a>
  <h3 align="center">Redline</h3>

  <p align="center">
    Click any element on a running frontend, leave a comment, and let your
    AI coding assistant implement the change directly in source.
    <br />
    <br />
    <a href="https://github.com/pallandir/redline/issues">Report a bug</a>
    ·
    <a href="https://github.com/pallandir/redline/issues">Request a feature</a>
  </p>

  <p align="center">
    <a href="./LICENSE.md">
      <img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue" alt="License: PolyForm Noncommercial">
    </a>
    <a href="https://www.npmjs.com/package/@redline/mcp-server">
      <img src="https://img.shields.io/npm/v/%40redline%2Fmcp-server" alt="npm version">
    </a>
    <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node >= 20">
    <img src="https://img.shields.io/badge/Claude%20Code-plugin-blueviolet" alt="Claude Code plugin">
  </p>
</div>

## Table of contents

- [What is Redline](#what-is-redline)
- [How it works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Source mapping](#source-mapping)
- [Compatibility](#compatibility)
- [Security and privacy](#security-and-privacy)
- [License](#license)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## What is Redline

**Redline** is a Chromium extension paired with an MCP server. Click any element
on a running frontend, local or a remote preview, leave a structured comment
anchored to it, and have your AI coding assistant pick up the list and implement
the changes directly against your real source files. Nothing is sent to a remote
backend; every comment travels over loopback between the browser and a server
running on your own machine.

### Why "Redline"?

In editorial, architectural, and engineering practice, "redlining" means marking
up a draft in red ink with the corrections that must be made before it ships.
That is exactly what this tool does to a running UI: you redline the interface,
and the assistant closes the marks.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## How it works

```mermaid
flowchart LR
    A["Browser extension\n(Chromium MV3)"]
    B["MCP server\n(127.0.0.1:7474)"]
    C["Comment store\n(.claude/)"]
    D["/mcp__redline__watch\nwatch loop"]
    E["Sub-agent\nedits source"]

    A -- "POST /comments\n(loopback only)" --> B
    B -- "writes" --> C
    C -- "list_comments" --> D
    D -- "spawns" --> E
    E -- "resolve / defer" --> D
```

The extension activates per-tab when you click its toolbar icon. Each saved item
carries a stable selector, visible text, computed styles, a cropped screenshot,
and, when available, a precise `file:line:column` from a framework inspector
plugin. On a `localhost` dev server the extension sends those comments directly
to the MCP server running in your project. In Claude Code, you paste the watch
command from the toolbar and the MCP server binds the session, watches for new
batches, and dispatches a sub-agent to implement each one with no approval step.
Comments that need deeper thought are parked for later; a notice appears in the
browser toolbar.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Prerequisites

| Need | Why | Required? |
|---|---|---|
| Node 20+ | runs the MCP server via `npx` | Yes |
| [Claude Code](https://claude.ai/code) | plugin host and `/redline` skill | Yes |
| Chromium browser (Chrome, Edge, Brave, Arc) | extension | Yes |
| Framework inspector plugin | precise `file:line:column` mapping | Optional |
| [`/top-design` skill](https://github.com/pallandir/redline) | Awwwards-style page scoring | Optional |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Installation

### Step 1: Install the plugin in Claude Code

In Claude Code, run these two commands. They register the MCP server (launched
on demand via `npx`, nothing to clone) and the `/redline` skill:

```
/plugin marketplace add pallandir/redline
/plugin install redline@redline
```

That is the only step that happens inside Claude Code. Everything else is
automated by the setup script below.

### Step 2: Run the setup script

Clone this repo once (only needed for the browser extension; the MCP server
installs from npm):

```sh
git clone https://github.com/pallandir/redline.git
cd redline
npm run setup
```

The script checks your Node version, installs all dependencies, builds the
extension, and prints exactly what to do next. It optionally registers the MCP
server with the `claude` CLI if you want a global registration outside the
plugin.

### Step 3: Load the extension

The Chrome Web Store release is coming soon. For now, load the built extension
unpacked:

1. Open `chrome://extensions` in Chrome (or any Chromium browser).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select the `extension/dist` folder printed by the
   setup script.

The setup script prints the full absolute path so you can paste it directly.

### Updating

After a `git pull`, run:

```sh
npm run update
```

Then, in Claude Code:

```
/plugin update redline
```

And reload the extension in `chrome://extensions` (click the refresh icon on the
Redline card). The update script handles everything else.

### Other MCP clients

Redline's server speaks standard MCP over stdio and works with any MCP-capable
client. Register it directly without using the plugin:

```sh
claude mcp add redline -- npx -y @redline/mcp-server
```

For Claude Desktop and other bundle-based clients, build the `.mcpb` bundle and
install it from there:

```sh
npm run pack:mcpb --workspace @redline/mcp-server
```

The skill lives at `plugin/skills/redline/SKILL.md`. Copy it into
`.claude/skills/` (per project) or `~/.claude/skills/` (global) to use it
outside the plugin.

> [!IMPORTANT]
> The comment store (`.claude/design-comments.md`) and screenshots
> (`.claude/design-shots/`) are written to the project root where Claude Code is
> open and are gitignored. Keep them out of version control.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

1. **Run your frontend** on a `localhost` dev server (or open a remote preview).
   Open Claude Code in the repo whose source you want to edit. Launching Claude
   starts the Redline MCP server, which opens a listener on `127.0.0.1:7474`
   (falling back to 7475, then 7476).

2. **Click the Redline toolbar icon** to activate it on the current tab. This
   is the only moment Redline gains page access; the access ends when the tab
   navigates. A draggable Figma-style toolbar appears.

3. **Leave comments** with the four tools: **Select** to inspect an element,
   **Comment** to leave a note, **Color** to change text or background color
   live, **Text** to edit copy inline. Each saved item is pinned to its element
   and listed in the toolbar drawer.

4. **Send to your assistant.** On `localhost`, items queue locally and clicking
   **Send to AI** flushes the batch to the MCP server, waking the watch loop.
   On a remote preview there is no local project, so use **Handoff** to download
   a Markdown report for any assistant.

5. **Copy the watch command** from the toolbar or popup (the Copy button writes
   the full `/mcp__redline__watch <id>` command; the display shows only the
   short id for readability). Paste it into Claude Code. The MCP `watch` prompt
   binds the session and starts watching: each time you send a batch it
   implements the comments directly via a sub-agent, then marks them resolved.
   Comments that need more thought (new dependencies, cross-cutting changes, or
   anything you flag "Plan this first") are parked in
   `.claude/redline-deferred.md` and a notice appears in the toolbar.

With any other MCP client, call `bind_session`, `wait_for_update`, and
`list_comments` directly.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Source mapping

Comments always carry a selector, element text, and bounding rect so the
assistant can locate the code by search. When the page's dev build exposes an
inspector data attribute, comments also carry a precise `file:line:column`.

Add the matching plugin to your dev build to enable this:

| Framework | Plugin | Notes |
|---|---|---|
| React / Next.js | [`react-dev-inspector`](https://github.com/zthxxx/react-dev-inspector) | |
| Vue / Nuxt | [`vite-plugin-vue-inspector`](https://github.com/webfansplz/vite-plugin-vue-inspector) | Set `Inspector({ cleanHtml: false })`. The default strips `data-v-inspector` from the DOM, so Redline cannot read it. |
| Svelte / SvelteKit | Svelte Inspector (built into `@sveltejs/vite-plugin-svelte`) | |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Compatibility

Redline's MCP server speaks standard MCP over stdio and works with any
MCP-capable AI coding assistant. It has been **tested with Claude Code**; other
clients (Cursor, Windsurf, and similar) should work but are currently
unverified.

The extension targets **Chromium Manifest V3**: Chrome, Edge, Brave, and Arc. A
Firefox port is not yet available.

### MCP tools

The server exposes 11 tools that any MCP client can call directly:

| Tool | Purpose |
|---|---|
| `list_comments` | List comments, optionally filtered by status (`open`, `resolved`, `wontfix`) |
| `wait_for_update` | Long-poll until the store changes; heartbeats the session binding |
| `bind_session` | Claim ownership of comment processing for this session |
| `unbind_session` | Release ownership so another session can take over |
| `defer_comment` | Park a comment for planning and notify the browser toolbar |
| `list_deferred` | List comments that were deferred with their reasons |
| `resolve_comment` | Set the status of a single comment |
| `resolve_comments` | Batch-resolve multiple comments in one call |
| `list_rating_requests` | List pending or scored page rating requests |
| `submit_rating` | Submit an Awwwards-style score for a rating request |
| `clear_resolved` | Remove all non-open comments from the store |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Security and privacy

Everything stays on your machine. The MCP server binds to `127.0.0.1` only and
rejects any request whose `Host` header is not loopback (anti-DNS rebinding) or
whose `Origin` is not a browser extension origin (blocking CSRF from web pages).
The extension's only network access is that loopback listener; it has no standing
access to any page. `activeTab` grants access to one tab for as long as it stays
on the current URL, and that access is revoked on navigation.

See [SECURITY.md](./SECURITY.md) for the full threat model and
[PRIVACY.md](./PRIVACY.md) for data handling details.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

This repository is under the **PolyForm Noncommercial License 1.0.0**. You may
use, modify, and share it for noncommercial purposes. All commercial rights are
reserved by the copyright holder. See [LICENSE.md](./LICENSE.md) for the full
terms and commercial licensing contact.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
