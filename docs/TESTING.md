# Manual testing guide

Automated checks cover the inspector-attribute readers, selector fingerprinting,
and the screenshot crop math (see "Validation status" below). The parts that need
a real Chrome with the extension loaded (native right-click menu,
`captureVisibleTab`, on-page pins) must be exercised by hand. This is that script.

## 0. Prerequisites

```bash
# from the repo root
npm install
npm run build --workspace @redline/extension   # produces extension/dist
```

Start the example apps (two terminals, or use the ones already running):

```bash
cd examples/react-app && npm install && npm run dev   # http://localhost:3001
cd examples/vue-app   && npm install && npm run dev   # http://localhost:3002
```

## 1. Load the extension in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/dist` folder.
4. You should see "Redline" appear with no errors.

Important: after every rebuild of the extension, click the **reload** icon on the
extension card, then **refresh** any open localhost tab so the new content script
injects.

## 2. Activate the toolbar

There is no right-click menu and no popup. Activation is a toggle on the
extension icon, and the toolbar only runs on `http://localhost/*` and
`http://127.0.0.1/*` pages.

1. Open `http://localhost:3001` (the React app).
2. Click the **Redline** toolbar icon. The icon badge shows **ON** and a
   draggable toolbar appears bottom-right. Click again to turn it off.
3. Drag the toolbar by its header to reposition it (the position is remembered).

If nothing appears: you are not on a localhost page, or the tab was open before
you loaded the extension (refresh once, then click the icon).

Reloading the page turns the toolbar off on purpose: it keeps the screenshot
permission (`activeTab`, granted by the icon click) fresh, so click the icon
again to re-activate after a reload.

## 3. Tools

With the toolbar on, the page cursor becomes a crosshair and hovering draws a
dashed preview box over the element under it. The tools:

- **⌖ Select** — click an element to select it (solid outline).
- **✎ Comment** — click an element, type a note, ⌘/Ctrl+Enter to save.
- **◑ Color** — click an element; a panel shows its current text and background
  color. Change either and the page updates live. Save records the change.
- **T Text** — click an element, edit its text inline, Enter to save (Esc cancels).

Each saved item drops a pin on its element and appears in the toolbar list. With
no MCP server running they show as queued; that is expected. The cropped
screenshot is written to disk once you sync (next step).

### Precise source (optional)

Toggle **◎ Precise source** to map color edits to the exact CSS rule and file via
the Chrome debugger. Chrome asks for the debugger permission and shows a "started
debugging this tab" banner while it resolves; it clears right after.

## 4. Pickup with the MCP server

```bash
npm run build --workspace @redline/mcp-server
# register once, then open Claude Code in the repo you are commenting on:
claude mcp add redline -- node ./mcp-server/dist/index.js
```

With a Claude Code session open (it spawns the server), click **⤴ Send to Claude**
in the toolbar. Then:

- Confirm `.claude/design-comments.md` contains the comment.
- Open the screenshot under `.claude/design-shots/` and verify it shows the
  element with a little surrounding context and **not** the extension's own pin or
  panel.
- In Claude Code, run `/comments` and confirm it lists the comment, views the
  screenshot, and proposes a plan.

## 5. Pin behavior

- Scroll the page: pins should track their elements.
- Reload the page: pins for this URL should reappear (queued ones from local
  storage, synced ones from the server).
- Hover a pin: the comment text shows.
- Click a queued pin (or the ✕ in the popup): it is removed.

## Source location (gold path)

A comment resolves to `file:line:column` only when the page exposes an inspector
data attribute. The example apps are already configured:

- **React** (`examples/react-app`): `@react-dev-inspector/babel-plugin` emits
  `data-inspector-relative-path/line/column`. Works out of the box.
- **Vue** (`examples/vue-app`): `vite-plugin-vue-inspector` must be configured
  with **`cleanHtml: false`**. By default (`cleanHtml: true`) the plugin strips
  `data-v-inspector` from the rendered DOM, so the extension cannot read it.

Without an inspector attribute the comment still carries a selector, element text,
and screenshot, and Claude finds the code by search.

## Validation status (already verified, automated)

- React `data-inspector-*` attributes are emitted and read correctly into
  `src/App.jsx:line:column`.
- Vue `data-v-inspector` is read correctly into `src/App.vue:line:column` once
  `cleanHtml: false` is set.
- `buildSelector` produces unique, round-tripping selectors, including
  disambiguating repeated classes via `:nth-of-type`.
- The crop pipeline (dpr scaling, 16px padding, edge clamping, OffscreenCanvas,
  base64) produces correctly sized PNGs and clamps at viewport edges.

Not yet exercised end to end: the native context menu, `captureVisibleTab` itself,
and live pin rendering. Those are what this manual script covers.
