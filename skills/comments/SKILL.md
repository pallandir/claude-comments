---
name: comments
description: Pick up UI comments left through the Redline browser extension and plan a revamp. Use when the user says "/comments", "review my design comments", "pick up the UI comments", "apply the frontend feedback", "watch for comments", or asks to act on comments left on a local frontend. Reads from the redline MCP server (list_comments, get_comment, resolve_comment) with a fallback to .claude/design-comments.md.
---

# Comments pickup

Turn the requests a developer or designer left on their running frontend into a
planned revamp of the source code.

**Default behavior: plan only.** Load the open comments, work out the changes,
present a short plan, then stop. Do not edit any file, and do not resolve any
comment, until the user explicitly approves the plan. Picking up comments never
silently turns into editing.

Each request has a `kind`:

- `comment`: a free-text note about what to change.
- `style`: one or more concrete style edits, each as `property: from -> to`
  (for example `color: rgb(17,17,17) -> #d97757`), optionally with the exact CSS
  rule location `(file:line)` when the user captured it in Precise mode.
- `text`: a copy edit, `"old text" -> "new text"`.

## 1. Load the comments

Prefer the `redline` MCP server tools:

- `list_comments` with status `open` to get the work list.
- `get_comment(id)` for the screenshot path and source hint when you need detail.

If the MCP server is not connected, read `.claude/design-comments.md` directly
(same data, markdown). Each entry has: status, id, route, the comment text, an
optional screenshot under `.claude/design-shots/`, an optional `source`
(`path:line:column`), a CSS `selector`, the element text, and the URL.

If there are no open comments, say so and stop. (In watch mode this is the poll
step: nothing open means nothing to do, so report that and back off.)

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

## 2b. What to change per kind

These describe the edit you will name in the plan, not an edit to make now.

- `comment`: implement the described change at the located code.
- `style`: apply each `property: from -> to`. Prefer the `(file:line)` CSS source
  when present; otherwise change the declaration that styles the element (inline
  style, CSS rule, design token, or utility class) so the rendered value matches
  `to`. Keep the codebase's styling approach (do not add inline styles if the
  project uses classes or tokens).
- `text`: replace the `from` string with `to` at the element's source. Watch for
  the string living in a constant, i18n catalog, or data file rather than markup.

## 3. Plan, then stop

Group related comments (same component, file, or route) so one edit can resolve
several. Then present a short, simple plan: one line per comment or group, naming
the file you would change and what you would do. Do not paste file contents and
do not write the code yet.

Then stop and wait. Do not edit any file, and do not call `resolve_comment`,
until the user explicitly tells you to proceed (for example "go", "apply", "do
it"). This is the end of the default flow.

Keep edits minimal and consistent with the surrounding code. Reuse existing
design tokens, utility classes, and components rather than introducing new
patterns.

## 4. Apply and resolve

Only after the user approves the plan:

1. Make the edits.
2. For each comment you addressed, call `resolve_comment(id, "resolved")`.
3. For any comment you intentionally did not act on, call
   `resolve_comment(id, "wontfix")` and tell the user why.
4. If the MCP server is unavailable, instead change that entry's heading status
   in `.claude/design-comments.md` from `[open]` to `[resolved]` or `[wontfix]`.

## 5. Report

Summarize what changed per file, which comments are resolved, and anything left
open with the reason. Do not run the dev server or commit unless the user asks.

## Watch mode

To make the extension's Send button effectively trigger pickup, run the skill in
a loop so Claude polls for newly synced comments:

```
/loop /comments
```

This self-paces: each iteration runs step 1, and when open comments appear it
locates them and presents a plan (step 3), then stops for approval; when nothing
is open it reports that and backs off. After you click Send in the browser, the
next poll picks the comments up, with no need to re-type `/comments`. Watch mode
still never auto-applies: it plans and waits for your go-ahead, exactly like the
default flow.

## Notes

- `pending` is an extension-side state for comments not yet synced to the store;
  you will only ever see `open`, `resolved`, or `wontfix` here.
- Screenshots are cropped to the commented element plus a little context. If the
  image is ambiguous, rely on the comment text and the source location.
