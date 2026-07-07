# @northstar/extension

Chromium MV3 extension to leave comments on any frontend.

## What it does

- Activates per tab from the toolbar icon, then overlays a draggable toolbar; you
  click any element to comment, recolor, or edit its copy.
- Renders a pin and a composer (in a shadow DOM, isolated from page styles).
- Captures the element fingerprint (selector, text, computed styles, rect) and,
  when present, a build-time source location from an inspector plugin.
- On `localhost`, posts comments to the project's MCP server (choosing the most
  recently started one) so they save into the repo as you go. On a remote page it
  keeps them in `chrome.storage` for **Handoff** export and never calls loopback.

## Source location (the gold path)

Comments resolve to `file:line:column` when the page exposes an inspector data
attribute. Add the matching plugin to your dev build:

- React / Next: [`react-dev-inspector`](https://github.com/zthxxx/react-dev-inspector)
- Vue / Nuxt: [`vite-plugin-vue-inspector`](https://github.com/webfansplz/vite-plugin-vue-inspector),
  configured with `Inspector({ cleanHtml: false })`. The default `cleanHtml: true`
  strips `data-v-inspector` from the rendered DOM, so the extension cannot read it.
- Svelte / SvelteKit: Svelte Inspector (built into `@sveltejs/vite-plugin-svelte`)

Without one, the comment still carries a selector, text, and rect so Claude can
find the code by search.

## Develop

```bash
npm run dev --workspace @northstar/extension      # vite + HMR
npm run build --workspace @northstar/extension    # outputs dist/
```

Load `extension/dist` via `chrome://extensions` → Developer mode → Load unpacked.
