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
- **Least-privilege extension manifest.** Removed the unused `scripting`
  permission, scoped `host_permissions` from `<all_urls>` to localhost only, and
  moved the powerful `debugger` permission to an optional permission requested at
  runtime only when Precise mode is enabled.

### Added

- Optional-permission flow with an extension settings page for granting Precise
  mode's `debugger` access.
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
