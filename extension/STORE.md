# Chrome Web Store listing

Reference copy for submitting the Redline extension. Build the upload artifact
with `npm run package --workspace @redline/extension` (produces
`extension/redline-extension.zip` with the manifest at the zip root).

## Single purpose

Redline lets a developer leave real-time, element-anchored comments on a running
frontend and delivers them to an AI coding assistant on the same machine so it
can act on the real source files. The extension's single purpose is annotating a
web UI for that local assistant.

## Short description (132 chars max)

Leave real-time comments on any interface and route them to your local AI coding
assistant.

## Detailed description

Redline is a Figma-style dev toolbar for the frontend you are building, whether
it runs on `localhost` or a remote preview. Click an element to comment on it,
recolor text or background live, or edit copy inline. Each item is pinned to its
element with a cropped screenshot and a stable selector, and (when a framework
inspector is present) an exact `file:line:column` source location.

Comments are delivered to a companion MCP server running on your own machine,
which any MCP-capable AI coding assistant can read. It has been tested with Claude
Code; other MCP clients should work but are unverified.

Everything stays on your computer. The extension has no standing access to any
page: it runs on no site until you click its toolbar button, which injects the
toolbar into that one tab for the session (the `activeTab` grant). Its only
network access is a server on `127.0.0.1`; no captured data is ever sent off the
device, even when the page itself is remote.

## Permission justifications

- **activeTab** — grants access to the current tab only when the user clicks the
  toolbar button, so Redline can read the element being commented on and capture
  a cropped screenshot of it. The extension has no access to any page before that
  click, and the access ends when the tab navigates.
- **scripting** — injects the commenting toolbar into that one active tab on
  demand, in place of a declared content script, so the extension does not run on
  pages automatically.
- **Host access (`http://localhost/*`, `http://127.0.0.1/*`, `http://*.localhost/*`)**
  — used only by the background service worker to reach the companion MCP server
  on loopback. This is not web-page access and does not let the extension contact
  any other site.
- **storage / unlimitedStorage** — queues comments (which include screenshots)
  locally so commenting works even when the assistant's server is not running,
  and drains automatically when it is.
- **alarms** — periodically flushes the local comment queue to the server.

## Data use disclosures

- Does not collect or transmit user data off the device.
- No analytics, tracking, or third-party services.
- All captured data (comment text, selector, screenshot, URL, source hint) stays
  on the user's machine and is sent only to `127.0.0.1`.

## Privacy policy URL

https://github.com/pallandir/redline/blob/main/PRIVACY.md
