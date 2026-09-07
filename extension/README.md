# @northstar/extension

MV3 extension to leave comments on any frontend. Builds for Chromium and Firefox.

## What it does

- Activates per tab from the toolbar icon, then overlays a draggable toolbar; you
  click any element to comment, recolor, or edit its copy.
- Renders a pin and a composer in a closed shadow DOM, isolated from page styles,
  and promotes that host into the browser's top layer so no page can stack above it.
- Captures the element fingerprint (selector, text, computed styles, rect) and,
  when present, a build-time source location from an inspector plugin.
- On `localhost`, posts comments to the project's MCP server (choosing the most
  recently started one) so they save into the repo as you go. On a remote page it
  keeps them in extension storage for **Handoff** export and never calls loopback.
- Sending a batch is one request. The server answers whether it managed to type the
  request into your terminal, and the toolbar shows the reason when it did not.

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
npm run dev --workspace @northstar/extension              # vite + HMR (Chromium only)
npm run build --workspace @northstar/extension            # outputs dist/
npm run build:firefox --workspace @northstar/extension    # outputs dist-firefox/
npm run dev:firefox --workspace @northstar/extension      # rebuild dist-firefox on change
npm run lint:firefox --workspace @northstar/extension     # AMO validator
```

Load `extension/dist` via `chrome://extensions` → Developer mode → Load unpacked.

For Firefox, load `extension/dist-firefox` via `about:debugging` → This Firefox →
Load Temporary Add-on, or run `npm run start:firefox --workspace @northstar/extension`.
The CRXJS dev server injects an `unsafe-eval` CSP that Firefox rejects, so Gecko
development uses `dev:firefox` (a watching build) rather than `dev`.

Everything reaches the browser API through `src/lib/browser.ts`, which resolves to
`browser` on Firefox and `chrome` on Chromium. Never call `chrome.*` directly: on
Firefox it is callback-style and every `await` resolves to `undefined`.
