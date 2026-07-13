<a name="readme-top"></a>

<br />
<div align="center">
  <a href="#">
    <img src="./public-assets/northstar.png" alt="Northstar logo" width="280" height="280">
  </a>
  <h3 align="center">Northstar</h3>

  <p align="center">
    Click any element on a running frontend, leave a comment, and let your
    AI coding assistant implement the change directly in source.
    <br />
    <br />
    <a href="https://github.com/pallandir/northstar/issues">Report a bug</a>
    ·
    <a href="https://github.com/pallandir/northstar/issues">Request a feature</a>
  </p>

  <p align="center">
    <a href="./LICENSE.md">
      <img src="https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue" alt="License: PolyForm Noncommercial">
    </a>
    <a href="https://www.npmjs.com/package/@pallandir/northstar">
      <img src="https://img.shields.io/npm/v/%40northstar%2Fmcp-server" alt="npm version">
    </a>
    <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node >= 20">
    <img src="https://img.shields.io/badge/Model%20Context%20Protocol-server-blueviolet" alt="MCP server">
  </p>
</div>

## Table of contents

- [What is Northstar](#what-is-northstar)
- [How it works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Usage](#usage)
- [Source mapping](#source-mapping)
- [Compatibility](#compatibility)
- [FAQ](#faq)
- [Security and privacy](#security-and-privacy)
- [Uninstall](#uninstall)
- [License](#license)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## What is Northstar

**Northstar** is a Chromium extension paired with an MCP server. Click any element
on a running frontend, local or a remote preview, leave a structured comment
anchored to it, and have your AI coding assistant pick up the list and implement
the changes directly against your real source files. Nothing is sent to a remote
backend; every comment travels over loopback between the browser and a server
running on your own machine.

### Why "Northstar"?

A north star is the one point in the sky that never moves, the thing you steer by
when everything else is drifting. Northstar makes your design intent that fixed
point: you mark where the UI should go, and your assistant moves the code until it
gets there.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## How it works

```mermaid
flowchart TD
    A["Browser extension\n(Chromium MV3)"]
    B["MCP server\n(127.0.0.1:7474)"]
    C["Comment store\n(.northstar/)"]
    D["/mcp__northstar__watch\nwatch loop"]
    E["Sub-agent\nedits source"]

    A -- "POST /comments\n(loopback only)" --> B
    B -- "writes" --> C
    C -- "list_comments" --> D
    D -- "spawns" --> E
    E -- "resolve / defer" --> D
```

The extension activates per-tab when you click its toolbar icon. Each saved item
carries a stable selector, visible text, computed styles, a cropped screenshot,
and a precise `file:line:column` from the framework inspector plugin that
anchors every edit to the right source location. On a `localhost` dev server the
extension sends those comments directly to the MCP server running in your
project. Your MCP client binds the session, watches for new batches, and applies
each one against your real source files. Comments that need deeper thought are
parked for later; a notice appears in the browser toolbar.

For a deeper look at the architecture and the message flows, see the
[docs folder](./docs).

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Prerequisites

| Need | Why | Required? |
|---|---|---|
| Node 20+ | runs the MCP server via `npx` | Yes |
| An MCP-capable AI coding assistant | reads comments and edits your source (Claude Code, Cursor, Windsurf, or any MCP client) | Yes |
| Chromium browser (Chrome, Edge, Brave, Arc) | extension | Yes |
| Framework inspector plugin | precise `file:line:column` mapping | Yes |
| [`northstar-design-score` skill](./plugin/skills/northstar-design-score/SKILL.md) | purpose-fit page scoring | Optional |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Getting started

Four steps, nothing to clone or build. The MCP server is launched on demand via
`npx`, and the extension updates itself from the store.

### Step 1 · Register the MCP server

There is nothing to install ahead of time. `npx` fetches and runs the server on
demand, so you can start it directly:

```sh
npx -y @pallandir/northstar
```

To wire it into your assistant, add the same command to your MCP configuration.
Any MCP-capable client can launch it on demand via `npx`:

```json
{
  "mcpServers": {
    "northstar": {
      "command": "npx",
      "args": ["-y", "@pallandir/northstar"]
    }
  }
}
```

---

### Step 2 · Install the browser extension

The extension is required, it is what captures your comments on the page.
Install Northstar from the Chrome Web Store and pin it to your toolbar. It runs in
any Chromium browser (Chrome, Edge, Brave, Arc).

[**Add to Chrome →**](https://chrome.google.com/webstore) *(store listing coming soon)*

---

### Step 3 · Connect the extension to your assistant

Open your frontend on a `localhost` dev server, with your assistant running in
the same repo, and click the Northstar toolbar icon to activate it on that tab.
Copy the session id from the toolbar and have your assistant call `bind_session`
with it. The session binds and Northstar starts watching for comments.

---

### Step 4 · Start commenting

Mark up the page with the toolbar tools, then click **Send to AI**. Each batch
you send is applied directly to your source by your assistant. See
[Usage](#usage) for the full tour.

> [!IMPORTANT]
> The comment store (`.northstar/design-comments.md`) and screenshots
> (`.northstar/design-shots/`) are written to the project root where your MCP
> client is running and are gitignored. Keep them out of version control.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Usage

[Getting started](#getting-started) covers the one-time setup. Day to day,
Northstar runs in one of two modes depending on where your frontend lives.

### Online · localhost dev server

Your assistant runs in the repo and comments flow to it live over loopback.

1. **Leave comments** with the four tools: **Select** to inspect an element,
   **Comment** to leave a note, **Color** to change text or background color
   live, **Text** to edit copy inline. Each saved item is pinned to its element
   and listed in the toolbar drawer.

2. **Send to AI.** Saving queues an item locally; clicking **Send to AI**
   flushes the batch to the server. Your assistant applies each comment directly
   to your source, then marks it resolved. Comments that need more thought (new
   dependencies, cross-cutting changes, or anything you flag "Plan this first")
   are parked in `.northstar/northstar-deferred.md` and a notice appears in the
   toolbar.

Any MCP client drives the loop with the raw tools: `bind_session`,
`wait_for_update`, and `list_comments`.

### Offline · remote preview or no local project

There is no local server to reach, so you export the batch and hand it to any
assistant.

1. **Leave comments** on the remote preview the same way as online.

2. **Handoff.** Click **Handoff** to download a Markdown report of the batch.
   Give that report to any AI coding assistant to implement the changes.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Source mapping

Comments carry a selector, element text, and bounding rect as a coarse anchor,
and a precise `file:line:column` from the framework inspector data attribute
your dev build exposes. That precise location is what lets the assistant edit
the exact source that renders each element.

Add the matching plugin to your dev build:

| Framework | Plugin | Notes |
|---|---|---|
| React / Next.js | [`react-dev-inspector`](https://github.com/zthxxx/react-dev-inspector) | |
| Vue / Nuxt | [`vite-plugin-vue-inspector`](https://github.com/webfansplz/vite-plugin-vue-inspector) | Set `Inspector({ cleanHtml: false })`. The default strips `data-v-inspector` from the DOM, so Northstar cannot read it. |
| Svelte / SvelteKit | Svelte Inspector (built into `@sveltejs/vite-plugin-svelte`) | |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Compatibility

Northstar's MCP server speaks standard MCP over stdio and works with any
MCP-capable AI coding assistant, Claude Code, Cursor, Windsurf, and similar
clients all connect the same way. Any client that can call the tools below can
drive the full flow.

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

## FAQ

<details>
<summary><strong>I sent comments but the assistant never picked them up.</strong></summary>

Comments only leave the browser when you click **Send to AI** in the toolbar.
**Save** enqueues a comment locally, **Send** flushes the batch to the server.
Make sure your assistant has bound the session with `bind_session` so it is
watching.
</details>

<details>
<summary><strong>The extension says it cannot reach the server.</strong></summary>

The server listens on loopback only, so the page you are commenting on must be a
`localhost` or `127.0.0.1` dev server, and your MCP client must be running in the
project (starting the client launches the server). On a remote preview there is
no local project to edit, so Northstar keeps comments in the browser and you export
them with **Handoff** instead.
</details>

<details>
<summary><strong>Port 7474 is already in use.</strong></summary>

The server automatically falls back to 7475, then 7476, and the extension probes
the same range, so a busy port usually just works. To pin a specific port, set
`NORTHSTAR_PORT` in the environment where your client launches the server.
</details>

<details>
<summary><strong>Can two projects run Northstar at once?</strong></summary>

Not in v1. One project binds the port and the session at a time. Set a different
`NORTHSTAR_PORT` per project if you need to switch between them.
</details>

<details>
<summary><strong>Where is my data stored, and does anything leave my machine?</strong></summary>

Everything stays local. Queued comments live in the browser's `chrome.storage`;
once sent, they are written to a gitignored `.northstar/` folder at your project
root. Nothing is sent to any remote server, and there is no analytics or
telemetry. See [PRIVACY.md](./PRIVACY.md).
</details>

<details>
<summary><strong>When will the extension be on the Chrome Web Store?</strong></summary>

The store listing is prepared and the release is coming soon. The
[Getting started](#getting-started) section links to it.
</details>

<details>
<summary><strong>How do I report a security issue?</strong></summary>

Please do not open a public issue. Use a
[GitHub security advisory](https://github.com/pallandir/northstar/security/advisories/new).
Full details are in [SECURITY.md](./SECURITY.md).
</details>

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

## Uninstall

Removing Northstar is three independent steps; do the ones that apply to you.

1. **Remove the browser extension.** Open `chrome://extensions`, find the
   Northstar card, and click **Remove**. In Firefox-family builds, use
   `about:addons`. This also clears the extension's local queue and stored
   session token.

2. **Remove the MCP server registration.** Delete the `northstar` entry from your
   assistant's MCP configuration.

3. **Delete the local comment store.** The server writes everything into a
   gitignored `.northstar/` folder at your project root. Delete it to remove all
   comments, deferrals, ratings, and screenshots:

   ```sh
   rm -rf .northstar
   ```

   Nothing lives outside your machine, so there is no account or remote data to
   clean up.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

This repository is under the **PolyForm Noncommercial License 1.0.0**. You may
use, modify, and share it for noncommercial purposes. All commercial rights are
reserved by the copyright holder. See [LICENSE.md](./LICENSE.md) for the full
terms and commercial licensing contact.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
