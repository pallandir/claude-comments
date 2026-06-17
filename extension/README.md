# @claude-comments/extension

Chromium MV3 extension to leave right-click comments on a local frontend.

## What it does

- Adds an "Add Claude comment" entry to the right-click menu on `localhost`.
- Renders a pin and a composer (in a shadow DOM, isolated from page styles).
- Captures the element fingerprint (selector, text, computed styles, rect) and,
  when present, a build-time source location from an inspector plugin.
- Queues comments in `chrome.storage` and posts them to the MCP server's
  localhost listener, draining automatically when Claude Code is running.

## Source location (the gold path)

Comments resolve to `file:line:column` when the page exposes an inspector data
attribute. Add the matching plugin to your dev build:

- React / Next: [`react-dev-inspector`](https://github.com/zthxxx/react-dev-inspector)
- Vue / Nuxt: [`vite-plugin-vue-inspector`](https://github.com/webfansplz/vite-plugin-vue-inspector)
- Svelte / SvelteKit: Svelte Inspector (built into `@sveltejs/vite-plugin-svelte`)

Without one, the comment still carries a selector, text, and rect so Claude can
find the code by search.

## Develop

```bash
npm run dev --workspace @claude-comments/extension      # vite + HMR
npm run build --workspace @claude-comments/extension    # outputs dist/
```

Load `extension/dist` via `chrome://extensions` → Developer mode → Load unpacked.
