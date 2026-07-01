# Security

Redline is a developer tool that runs entirely on your machine. You can leave
comments on any running frontend, local or a remote preview, but everything you
capture stays local: the only thing that crosses a trust boundary is a comment
you explicitly created, and it only ever travels to the loopback listener owned
by your own AI coding assistant.

## Threat model

- **Processing stays local.** The MCP server binds to `127.0.0.1` only and never
  listens on a public interface. Wherever you leave a comment, the extension
  sends it only to that loopback listener. No comment, screenshot, or source path
  leaves your machine, and there is no remote backend.
- **No standing access to any page.** The extension declares no content scripts
  and no web-page host permissions, so it runs on no site by default. The overlay
  is injected only into the single tab you activate, only after you click the
  toolbar button, under the `activeTab` grant, and that access is dropped as soon
  as the tab navigates. Visiting a page never gives the extension a foothold.
- **The network surface is loopback only.** The extension's only host permissions
  are `localhost`, `127.0.0.1`, and `*.localhost`, used solely by the service
  worker to reach the ingest listener. It cannot make a network request to any
  other origin.
- **The ingest listener only accepts the extension.** The localhost HTTP server
  rejects any request whose `Origin` is a web page (`http(s)://…`) and any
  request whose `Host` header is not loopback. This closes two attack paths a
  malicious web page you happen to be visiting could otherwise use:
  - **CSRF / store poisoning:** injecting comments into your store (which your AI
    assistant later reads and may act on) or deleting your comments.
  - **DNS rebinding:** pointing an attacker-controlled hostname at `127.0.0.1`.
  Every ingested payload is also validated against a strict schema with bounded
  field sizes.
- **Comments are untrusted input to the assistant.** The `/comments` skill and
  the MCP read tools treat every comment's text and selector as *data describing
  a change*, never as instructions. The assistant acts only on the design intent,
  binds edits to the located source, stays within UI changes, and sends no page
  content or comment data anywhere.
- **Least-privilege extension.** The extension requests only `activeTab`,
  `scripting`, `storage`, and `unlimitedStorage`, plus the loopback host
  permissions above. It requests no `debugger` permission and holds no capability
  to drive a page over the DevTools protocol.
- **No remote code, no telemetry.** The extension and server build to static
  assets. The published npm package ships only `dist/`. There is no analytics,
  tracking, or external network call.

## Supply chain

- Production dependencies are minimal (`@modelcontextprotocol/sdk`, `zod`) and
  carry no known vulnerabilities.
- Build-time tooling carries no known advisories: `npm audit` reports zero
  vulnerabilities. `vite` is pinned to a release with a patched `esbuild`, and
  `esbuild` and `tmp` are held at fixed patched versions through root
  `overrides`.
- The npm package is published from CI with **provenance** enabled.

## Reporting a vulnerability

Please do not open a public issue for security problems. Report privately via a
[GitHub security advisory](https://github.com/pallandir/redline/security/advisories/new)
or by contacting the maintainer through the address in `LICENSE.md`. We aim to
acknowledge reports within a few days.
