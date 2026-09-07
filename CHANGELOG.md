# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[Semantic Versioning](https://semver.org/).

## [2.0.0] - 2026-09-07

A rework around a single idea: **Send to AI** is the only thing that starts work.

### Changed

- **BREAKING: the watch loop is gone.** There is no session to pair and no command
  to paste. When you click **Send to AI**, the server types one line into the
  terminal your assistant is already running in and presses Enter. Because the
  path is plain keystrokes, Claude Code, Codex and Gemini all work identically.
  Supported terminals are tmux, iTerm2 and Terminal.app.
- **BREAKING: 11 MCP tools become 6.** `bind_session`, `unbind_session`,
  `wait_for_update`, `list_rating_requests` and `submit_rating` are removed, along
  with the `watch` prompt.
- **BREAKING: `POST /comments` takes the whole batch** as an array in one request,
  and answers `{ ids, typed, reason? }`. A ten-comment send used to be ten
  requests that woke the assistant up to ten times.
- **BREAKING: the session token and HMAC handshake are gone**, along with
  `/handshake`, `/ping`, `/wait` and `/ratings`. Loopback binding, the Origin and
  Host allowlists, the body cap and schema validation all stay. See
  [SECURITY.md](./SECURITY.md) for what this trade does and does not cover.

### Added

- **Firefox support.** The extension builds for Gecko from the same source with
  `npm run build:firefox` and passes `web-ext lint` with no errors. Firefox 128 is
  the floor, set by the Popover API the overlay needs.
- **Terminal controls.** `NORTHSTAR_TERMINAL` forces a driver, `NORTHSTAR_INJECT=0`
  turns the typing off.

### Fixed

- **The overlay could be hidden by the page, making commenting impossible.** The
  shadow host opened with `all: initial`, which resets `z-index` to `auto`, and
  nothing set it back, so any positioned page element with a positive `z-index`
  covered the whole overlay. The host now carries an explicit `z-index` and is
  promoted into the browser's top layer, re-promoting whenever the page promotes
  something after it and moving inside a page's modal dialog so it stays clickable
  instead of being made inert.
- **Edits from the drawer silently dropped their flags.** `onEdit` was declared
  with two parameters but called with three, so `planFirst` and the screenshot
  option were lost when a comment was edited from the drawer rather than the pin.
- **`.env.example` documented `NORTHSTAR_PORTS`**, a variable the server never
  read. The name is `NORTHSTAR_PORT`.

### Removed

- The design-score feature end to end: both MCP tools, the `/ratings` endpoints,
  the ratings store, the drawer card, and the `northstar-design-score` skill.
- The setup checklist in the toolbar and the four-step tutorial in the popup.
- Dead message handlers `clear-comments` and `count-all`, and the unused store
  helpers behind them.

### Safety

- The line typed into your terminal is a **fixed constant**. No comment text, id or
  count reaches the terminal, so nothing arriving over loopback can change what
  your assistant is told to do.
- Northstar reads the visible pane before typing and refuses while a numbered
  choice or yes/no prompt is showing, or if it cannot read the pane at all. Sends
  landing within a few seconds of each other are coalesced into one line.

## [1.0.0] - 2026-06-17

First public release.

### Security

- **Locked down the MCP ingest server.** The localhost listener now rejects any
  request with a web-page `Origin` (`http(s)://…`) and any non-loopback `Host`
  header, closing CSRF / store-poisoning and DNS-rebinding paths. CORS now
  reflects only the extension origin instead of `*`.
- **Validated all ingested payloads** with a strict `zod` schema (bounded string
  lengths, screenshot data-URL format), so a malformed body is a clean `400`
  and can no longer crash the store.
- **`/health` now identifies the service**; the extension only trusts a port
  that reports `service: "northstar"`.
- **Zero standing page access.** The extension declares no content scripts and no
  web-page host permissions. The overlay is injected into a single tab on demand
  via `chrome.scripting` under the `activeTab` grant, only after the user clicks
  the action, and that access ends on navigation. `host_permissions` is scoped to
  loopback only and is used purely by the service worker to reach the local
  listener, never for page access.
- **Dropped the `debugger` permission entirely.** Removed the optional Precise
  mode and its CDP source mapping, so the extension no longer declares or requests
  the powerful `debugger` permission (Chrome also forbids it as optional). Color
  edits still record `property: from -> to`; the assistant locates the CSS from
  the selector and screenshot.
- **Dependency audit clean.** `npm audit` now reports zero vulnerabilities:
  `vite` upgraded to a release with a patched `esbuild`, with `esbuild` and `tmp`
  pinned to patched versions through root `overrides`.
- **Scoped assistant output.** The `/comments` skill and MCP read-tool
  descriptions now constrain the assistant to UI changes bound to each comment's
  located source, forbid acting on instructions embedded in comment data or
  sending any page content anywhere, and direct it to pull only the comment data
  it needs into context, while leaving design creativity, web assets, and
  installed skills unrestricted.

### Added

- **Comment on any frontend, not just localhost.** Activate Northstar on any site,
  a local dev server or a remote preview, while all captured data still travels
  only to the loopback listener and the assistant edits only the local repo.
- **Watch loop over 11 MCP tools.** `bind_session` / `unbind_session` claim and
  release a browser session, `wait_for_update` long-polls the store and
  heartbeats the binding, `list_comments` returns full per-comment detail as the
  batch read, `resolve_comment` / `resolve_comments` and `defer_comment` /
  `list_deferred` close or park work, and `clear_resolved` prunes finished
  entries. Comments flush only when the user clicks Send to AI.
- **Purpose-fit page scoring.** `list_rating_requests` and `submit_rating`, plus
  the bundled `northstar-design-score` skill, rate a page screenshot for fitness to
  its own purpose (ui, ux, coherence) rather than an absolute award-site bar.
- **Figma-style toolbar.** A draggable in-page toolbar with Select, Comment,
  Color, and Text tools, rendered in a closed shadow DOM, replacing the earlier
  context-menu entry point.
- Unit tests (`node:test`) for the comment store and the HTTP origin/Host gate
  and payload validation.
- CI workflow (lint, typecheck, build, test) and an npm publish workflow with
  provenance.
- Publication artifacts: `.mcpb` bundle manifest and pack script, Chrome Web
  Store packaging script and listing copy, `SECURITY.md`, and `PRIVACY.md`.

### Changed

- Repositioned from "for Claude Code" to assistant-agnostic: works with any
  MCP-capable AI coding assistant via the MCP server. Tested with Claude Code;
  other clients are unverified. Updated descriptions and docs accordingly.

### Fixed

- The ingest server now reports its actual bound port (correct when an
  OS-assigned port is used).
