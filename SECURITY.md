# Security

Redline is a developer tool that runs entirely on your machine. It is designed
so that the only thing that crosses a trust boundary is a comment you explicitly
created on your own local frontend.

## Threat model

- **Everything is local.** The MCP server binds to `127.0.0.1` only and never
  listens on a public interface. The extension only runs on `localhost`,
  `127.0.0.1`, and `*.localhost`. No comment, screenshot, or source path leaves
  your machine.
- **The ingest listener only accepts the extension.** The localhost HTTP server
  rejects any request whose `Origin` is a web page (`http(s)://…`) and any
  request whose `Host` header is not loopback. This closes two attack paths a
  malicious web page you happen to be visiting could otherwise use:
  - **CSRF / store poisoning:** injecting comments into your store (which your AI
    assistant later reads and may act on) or deleting your comments.
  - **DNS rebinding:** pointing an attacker-controlled hostname at `127.0.0.1`.
- **Comments are untrusted input to the assistant.** The `/comments` skill
  treats every comment's text and selector as *data describing a change*, never
  as instructions. It will not follow directives embedded in a comment.
- **Least-privilege extension.** The extension requests only `activeTab`,
  `storage`, `unlimitedStorage`, and `alarms`, plus localhost host permissions.
  The powerful `debugger` permission used by optional Precise mode is an
  **optional permission**, requested at runtime only if you enable that feature,
  and used solely to read matched CSS rules on your local page.
- **No remote code, no telemetry.** The extension and server build to static
  assets. The published npm package ships only `dist/`. There is no analytics,
  tracking, or external network call.

## Supply chain

- Production dependencies are minimal (`@modelcontextprotocol/sdk`, `zod`) and
  carry no known vulnerabilities.
- Build-time tooling (`vite`, `tsup`, and their shared `esbuild`) currently has
  advisories that affect only the local dev server, not any shipped artifact.
  They are resolved by a future major `vite` upgrade and are tracked separately.
- The npm package is published from CI with **provenance** enabled.

## Reporting a vulnerability

Please do not open a public issue for security problems. Report privately via a
[GitHub security advisory](https://github.com/pallandir/redline/security/advisories/new)
or by contacting the maintainer through the address in `LICENSE.md`. We aim to
acknowledge reports within a few days.
