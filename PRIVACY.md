# Privacy Policy

_Last updated: 2026-06-17_

Northstar (the "Northstar" browser extension and its companion MCP server) is a local
developer tool. This policy explains what it does and does not do with data.

## What Northstar does not do

- It does **not** collect, store, or transmit any personal data.
- It does **not** use analytics, tracking, advertising, or any third-party
  services.
- It does **not** send any data to the developer or to any remote server.

## What data Northstar handles, and where it stays

When you leave a comment on a frontend (a local dev server or a remote preview),
Northstar captures only the information needed to describe that change: your comment
text, a CSS selector and visible text for the element, a cropped screenshot of the
element, the page URL, and, when available, a source file location. It captures
nothing until you activate it on a tab and pick an element, and the screenshot is
cropped to that element, not the whole page. This data:

- is stored locally in your browser's extension storage while queued, and
- is sent **only** to a server running on your own computer
  (`http://127.0.0.1`), which writes it into your project's `.northstar/` folder.

None of it leaves your machine, even when the page itself is remote. The localhost
server rejects requests from web pages, so only the extension can deliver comments
to it.

Sending a batch also makes the server type one line into the terminal your AI
assistant runs in. That line is a fixed constant: none of the data above is ever
typed into your terminal, and nothing is captured from it beyond reading the
visible pane to check the assistant is idle before typing.

## Permissions

- `activeTab`, `scripting` — to inject the overlay into, and read the element you
  comment on from, only the single tab you activate by clicking the toolbar icon.
  The extension has no standing access to any site and runs on no page until you
  click; the access ends when the tab navigates.
- host access to `localhost`/`127.0.0.1`/`*.localhost` — used only by the
  extension's background context to reach the loopback listener. It is not page
  access and grants no ability to contact any other site. On Firefox this is
  opt-in and is requested the first time you activate the overlay.
- `storage`, `unlimitedStorage` — to queue comments (including screenshots)
  locally until your assistant's server is reachable.

## Contact

Questions about this policy: see the contact in `LICENSE.md` or open an issue at
https://github.com/pallandir/northstar/issues.
