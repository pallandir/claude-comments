# Chrome Web Store listing

Reference copy for submitting the Redline extension. Build the upload artifact
with `npm run package --workspace @redline/extension` (produces
`extension/redline-extension.zip` with the manifest at the zip root).

## Single purpose

Redline lets a developer leave real-time, element-anchored comments on a locally
running frontend and delivers them to an AI coding assistant so it can act on the
real source files. The extension's single purpose is annotating local
development pages.

## Short description (132 chars max)

Leave real-time comments on any local interface and let your AI coding assistant
act on them.

## Detailed description

Redline is a Figma-style dev toolbar for your own `localhost` apps. Click an
element to comment on it, recolor text or background live, or edit copy inline.
Each item is pinned to its element with a cropped screenshot and a stable
selector, and (when a framework inspector is present) an exact `file:line:column`
source location.

Comments are delivered to a companion MCP server running on your machine, which
any MCP-capable AI coding assistant can read. It has been tested with Claude
Code; other MCP clients should work but are unverified.

Everything stays on your computer. Redline only runs on `localhost`,
`127.0.0.1`, and `*.localhost`, and sends data only to a server on `127.0.0.1`.

## Permission justifications

- **activeTab** — capture a screenshot of the element you are commenting on, on
  the active local tab, only when you use the tool.
- **Host access (`http://localhost/*`, `http://127.0.0.1/*`, `http://*.localhost/*`)**
  — the extension only operates on local development servers; it injects the
  commenting toolbar and reads the element you select there.
- **storage / unlimitedStorage** — queue comments (which include screenshots)
  locally so commenting works even when the assistant's server is not running,
  and drains automatically when it is.
- **alarms** — periodically flush the local comment queue to the server.
- **debugger (optional permission)** — requested at runtime only if the user
  enables "Precise mode", and used solely to read the matched CSS rule for an
  element so a style edit can be mapped to the exact CSS file and line. Not
  requested at install time.

## Data use disclosures

- Does not collect or transmit user data off the device.
- No analytics, tracking, or third-party services.
- All captured data (comment text, selector, screenshot, URL, source hint) stays
  on the user's machine and is sent only to `127.0.0.1`.

## Privacy policy URL

https://github.com/pallandir/redline/blob/main/PRIVACY.md
