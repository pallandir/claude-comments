# Privacy Policy

_Last updated: 2026-06-17_

Redline (the "Redline" browser extension and its companion MCP server) is a local
developer tool. This policy explains what it does and does not do with data.

## What Redline does not do

- It does **not** collect, store, or transmit any personal data.
- It does **not** use analytics, tracking, advertising, or any third-party
  services.
- It does **not** send any data to the developer or to any remote server.

## What data Redline handles, and where it stays

When you leave a comment on a local frontend, Redline captures the information
needed to describe that change: your comment text, a CSS selector and visible
text for the element, a cropped screenshot of the element, the page URL, and,
when available, a source file location. This data:

- is stored locally in your browser (`chrome.storage`) while queued, and
- is sent **only** to a server running on your own computer
  (`http://127.0.0.1`), which writes it into your project's `.claude/` folder.

None of it leaves your machine. The localhost server rejects requests from web
pages, so only the extension can deliver comments to it.

## Permissions

- `activeTab`, host access to `localhost`/`127.0.0.1` — to read the element you
  comment on and capture its screenshot, only on local dev pages.
- `storage`, `unlimitedStorage` — to queue comments (including screenshots)
  locally until your assistant's server is reachable.
- `alarms` — to periodically flush the local queue.
- `debugger` (optional) — requested only if you enable Precise mode, and used
  only to read the matched CSS rule for an element on your local page.

## Contact

Questions about this policy: see the contact in `LICENSE.md` or open an issue at
https://github.com/pallandir/redline/issues.
