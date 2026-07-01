# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[Semantic Versioning](https://semver.org/).

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
  that reports `service: "redline"`.
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

- **Comment on any frontend, not just localhost.** Activate Redline on any site,
  a local dev server or a remote preview, while all captured data still travels
  only to the loopback listener and the assistant edits only the local repo.
- **Watch loop over 11 MCP tools.** `bind_session` / `unbind_session` claim and
  release a browser session, `wait_for_update` long-polls the store and
  heartbeats the binding, `list_comments` returns full per-comment detail as the
  batch read, `resolve_comment` / `resolve_comments` and `defer_comment` /
  `list_deferred` close or park work, and `clear_resolved` prunes finished
  entries. Comments flush only when the user clicks Send to AI.
- **Purpose-fit page scoring.** `list_rating_requests` and `submit_rating`, plus
  the bundled `redline-design-score` skill, rate a page screenshot for fitness to
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
