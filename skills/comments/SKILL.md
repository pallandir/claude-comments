---
name: comments
description: Pick up UI comments left through the Claude Comments browser extension and plan a revamp. Use when the user says "/comments", "review my design comments", "pick up the UI comments", "apply the frontend feedback", or asks to act on comments left on a local frontend. Reads from the claude-comments MCP server (list_comments, get_comment, resolve_comment) with a fallback to .claude/design-comments.md.
---

# Comments pickup

Turn the comments a developer left on their running frontend into a planned,
applied revamp of the source code.

## 1. Load the comments

Prefer the `claude-comments` MCP server tools:

- `list_comments` with status `open` to get the work list.
- `get_comment(id)` for the screenshot path and source hint when you need detail.

If the MCP server is not connected, read `.claude/design-comments.md` directly
(same data, markdown). Each entry has: status, id, route, the comment text, an
optional screenshot under `.claude/design-shots/`, an optional `source`
(`path:line:column`), a CSS `selector`, the element text, and the URL.

If there are no open comments, say so and stop.

## 2. Locate the code for each comment

For every open comment, in this order:

1. If `source` is present, open that `path` at `line`. This is the precise
   target, injected by a framework inspector plugin.
2. Otherwise, view the screenshot (Read the `screenshot` path) to see the
   element, then find the code by searching for the element text and the
   `selector`'s classes or ids. Confirm the match against the screenshot before
   editing.

Always view the screenshot when one exists, even when `source` is known. The
comment text describes intent; the image shows the actual visual problem.

## 3. Plan before editing

Group related comments (same component, file, or route) so one edit can resolve
several. Then present a short plan to the user: for each comment or group, the
file you will change and what you will do. Do not start editing until the user
approves the plan.

Keep edits minimal and consistent with the surrounding code. Reuse existing
design tokens, utility classes, and components rather than introducing new
patterns.

## 4. Apply and resolve

After the user approves:

1. Make the edits.
2. For each comment you addressed, call `resolve_comment(id, "resolved")`.
3. For any comment you intentionally did not act on, call
   `resolve_comment(id, "wontfix")` and tell the user why.
4. If the MCP server is unavailable, instead change that entry's heading status
   in `.claude/design-comments.md` from `[open]` to `[resolved]` or `[wontfix]`.

## 5. Report

Summarize what changed per file, which comments are resolved, and anything left
open with the reason. Do not run the dev server or commit unless the user asks.

## Notes

- `pending` is an extension-side state for comments not yet synced to the store;
  you will only ever see `open`, `resolved`, or `wontfix` here.
- Screenshots are cropped to the commented element plus a little context. If the
  image is ambiguous, rely on the comment text and the source location.
