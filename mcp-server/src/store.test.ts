import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { CommentStore } from "./store.js";
import type { IncomingComment } from "./types.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "redline-store-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function sample(overrides: Partial<IncomingComment> = {}): IncomingComment {
  return {
    kind: "comment",
    url: "http://localhost:3000/dashboard",
    text: "This card padding is off",
    source: { path: "src/Card.tsx", line: 42, column: 8, via: "react-dev-inspector" },
    fingerprint: {
      selector: "main > section:nth-child(2) > .card",
      innerText: "Total revenue",
      styles: { color: "rgb(0,0,0)" },
      rect: { x: 0, y: 0, w: 10, h: 10 },
    },
    viewport: { w: 1440, h: 900 },
    screenshotDataUrl: null,
    ...overrides,
  };
}

test("add then list round-trips core fields through the markdown store", async () => {
  const store = new CommentStore(root);
  const added = await store.add(sample());
  const [got] = await store.list();

  assert.equal(got.id, added.id);
  assert.equal(got.text, "This card padding is off");
  assert.equal(got.route, "/dashboard");
  assert.equal(got.kind, "comment");
  assert.equal(got.status, "open");
  assert.equal(got.source?.path, "src/Card.tsx");
  assert.equal(got.source?.line, 42);
  assert.equal(got.fingerprint.selector, "main > section:nth-child(2) > .card");
  assert.equal(got.viewport.w, 1440);
});

test("setStatus persists and list filters by status", async () => {
  const store = new CommentStore(root);
  const a = await store.add(sample());
  await store.add(sample({ text: "second" }));

  await store.setStatus(a.id, "resolved");
  assert.equal((await store.list("open")).length, 1);
  assert.equal((await store.list("resolved")).length, 1);
});

test("clearResolved keeps only open comments", async () => {
  const store = new CommentStore(root);
  const a = await store.add(sample());
  await store.add(sample({ text: "second" }));
  await store.setStatus(a.id, "wontfix");

  const removed = await store.clearResolved();
  assert.equal(removed, 1);
  const left = await store.list();
  assert.equal(left.length, 1);
  assert.equal(left[0].status, "open");
});

test("style and text changes survive a serialize/parse cycle", async () => {
  const store = new CommentStore(root);
  await store.add(
    sample({
      kind: "style",
      text: "Change color",
      styleChanges: [{ property: "color", from: "rgb(0,0,0)", to: "#d97757", cssSource: null }],
    }),
  );
  const [got] = await store.list();
  assert.equal(got.styleChanges[0].property, "color");
  assert.equal(got.styleChanges[0].to, "#d97757");
});
