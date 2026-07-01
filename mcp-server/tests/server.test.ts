import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, mock, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Broker } from "../src/broker.js";
import { createMcpServer } from "../src/server.js";
import { CommentStore } from "../src/store.js";
import type { IncomingComment } from "../src/types.js";

let root: string;
let store: CommentStore;
let broker: Broker;
let client: Client;

type CallResult = Awaited<ReturnType<Client["callTool"]>>;

function text(result: CallResult): string {
  const items = result.content as Array<{ type: string; text?: string }>;
  return items
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("");
}

function sample(overrides: Partial<IncomingComment> = {}): IncomingComment {
  return {
    comment: "Fix padding",
    operation: { type: "comment", property: null, from: null, to: null },
    operator: "/html/body/main[1]",
    url: "http://localhost:3000/",
    metadata: { page: "/", viewport: { w: 1440, h: 900 }, elementText: "hi" },
    screenshotDataUrl: null,
    ...overrides,
  };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "redline-server-"));
  store = new CommentStore(root);
  broker = new Broker();

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer(store, broker);
  await server.connect(serverTransport);

  client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  await rm(root, { recursive: true, force: true });
});

test("list_comments returns empty when no comments exist", async () => {
  const result = await client.callTool({ name: "list_comments", arguments: {} });
  assert.ok(text(result).includes("No comments"));
});

test("list_comments returns all comments and filters by status", async () => {
  const c = await store.add(sample());
  await store.setStatus(c.id, "resolved");
  await store.add(sample({ comment: "second open" }));

  const all = await client.callTool({ name: "list_comments", arguments: {} });
  assert.ok(text(all).includes("resolved"));
  assert.ok(text(all).includes("open"));

  const open = await client.callTool({ name: "list_comments", arguments: { status: "open" } });
  assert.ok(text(open).includes("second open"));
  assert.ok(!text(open).includes("resolved"));
});

test("bind_session returns bound:true on first bind", async () => {
  const result = await client.callTool({
    name: "bind_session",
    arguments: { sessionId: "my-token" },
  });
  const parsed = JSON.parse(text(result));
  assert.equal(parsed.bound, true);
});

test("bind_session returns bound:true when re-binding the same token", async () => {
  await client.callTool({ name: "bind_session", arguments: { sessionId: "my-token" } });
  const result = await client.callTool({
    name: "bind_session",
    arguments: { sessionId: "my-token" },
  });
  const parsed = JSON.parse(text(result));
  assert.equal(parsed.bound, true);
});

test("bind_session returns bound:false when a different token tries to steal the session", async () => {
  await client.callTool({ name: "bind_session", arguments: { sessionId: "owner-token" } });
  const result = await client.callTool({
    name: "bind_session",
    arguments: { sessionId: "thief-token" },
  });
  const parsed = JSON.parse(text(result));
  assert.equal(parsed.bound, false);
  assert.ok(typeof parsed.reason === "string");
});

test("unbind_session allows a new token to bind afterwards", async () => {
  await client.callTool({ name: "bind_session", arguments: { sessionId: "original" } });
  await client.callTool({ name: "unbind_session", arguments: {} });
  const result = await client.callTool({
    name: "bind_session",
    arguments: { sessionId: "new-token" },
  });
  const parsed = JSON.parse(text(result));
  assert.equal(parsed.bound, true);
});

test("wait_for_update resolves immediately when version has already advanced", async () => {
  broker.bump();
  const v0 = broker.currentVersion - 1;
  const result = await client.callTool({
    name: "wait_for_update",
    arguments: { sinceVersion: v0, timeoutMs: 5000 },
  });
  const parsed = JSON.parse(text(result));
  assert.ok(typeof parsed.version === "number");
  assert.ok(typeof parsed.openComments === "number");
});

test("wait_for_update times out and returns current state", async () => {
  const v = broker.currentVersion;
  const start = Date.now();
  const result = await client.callTool({
    name: "wait_for_update",
    arguments: { sinceVersion: v, timeoutMs: 1000 },
  });
  assert.ok(Date.now() - start >= 900, "should have waited ~1 second");
  const parsed = JSON.parse(text(result));
  assert.ok(typeof parsed.version === "number");
});

test("wait_for_update signals stop and unbinds when the extension heartbeat lapses", async () => {
  mock.timers.enable({ apis: ["Date"] });
  try {
    broker.bindSession("owner-token");
    mock.timers.tick(91_000);
    const result = await client.callTool({
      name: "wait_for_update",
      arguments: { timeoutMs: 1000 },
    });
    const parsed = JSON.parse(text(result));
    assert.equal(parsed.stop, true);
    assert.equal(parsed.bound, false);
    assert.equal(broker.verifyToken("owner-token"), false);
  } finally {
    mock.timers.reset();
  }
});

test("wait_for_update does not stop a freshly bound session that has not pinged", async () => {
  broker.bindSession("owner-token");
  const result = await client.callTool({
    name: "wait_for_update",
    arguments: { sinceVersion: broker.currentVersion - 1, timeoutMs: 1000 },
  });
  const parsed = JSON.parse(text(result));
  assert.equal(parsed.stop, false);
  assert.equal(broker.verifyToken("owner-token"), true);
});

test("resolve_comment updates a comment's status", async () => {
  const c = await store.add(sample());
  const result = await client.callTool({
    name: "resolve_comment",
    arguments: { id: c.id, status: "resolved" },
  });
  assert.ok(text(result).includes("resolved"));
  const after = await store.get(c.id);
  assert.equal(after?.status, "resolved");
});

test("resolve_comment returns not-found message for unknown id", async () => {
  const result = await client.callTool({
    name: "resolve_comment",
    arguments: { id: "no-such-id", status: "resolved" },
  });
  assert.ok(text(result).includes("no-such-id"));
});

test("resolve_comments resolves a batch of comments", async () => {
  const a = await store.add(sample());
  const b = await store.add(sample({ comment: "second" }));
  const result = await client.callTool({
    name: "resolve_comments",
    arguments: {
      resolutions: [
        { id: a.id, status: "resolved" },
        { id: b.id, status: "wontfix" },
      ],
    },
  });
  const output = text(result);
  assert.ok(output.includes("resolved"));
  assert.ok(output.includes("wontfix"));
  assert.equal((await store.list("open")).length, 0);
});

test("defer_comment parks a comment and creates a deferred entry", async () => {
  const c = await store.add(sample());
  const result = await client.callTool({
    name: "defer_comment",
    arguments: { id: c.id, reason: "needs architecture decision" },
  });
  assert.ok(text(result).includes("deferred"));
  const deferred = await store.listDeferred();
  assert.equal(deferred.length, 1);
  assert.equal(deferred[0].id, c.id);
  const after = await store.get(c.id);
  assert.equal(after?.status, "wontfix");
});

test("defer_comment returns not-found message for unknown id", async () => {
  const result = await client.callTool({
    name: "defer_comment",
    arguments: { id: "no-such-id", reason: "planning" },
  });
  assert.ok(text(result).includes("no-such-id"));
});

test("list_deferred returns deferred entries after deferring", async () => {
  const empty = await client.callTool({ name: "list_deferred", arguments: {} });
  assert.ok(text(empty).includes("No deferred"));

  const c = await store.add(sample({ comment: "complex task" }));
  await client.callTool({
    name: "defer_comment",
    arguments: { id: c.id, reason: "too complex" },
  });
  const result = await client.callTool({ name: "list_deferred", arguments: {} });
  assert.ok(text(result).includes("complex task"));
  assert.ok(text(result).includes("too complex"));
});

test("list_rating_requests returns empty then a pending request", async () => {
  const empty = await client.callTool({ name: "list_rating_requests", arguments: {} });
  assert.ok(text(empty).includes("No rating"));

  await store.addRatingRequest({
    url: "http://localhost:3000/",
    screenshotDataUrl: null,
    sessionId: "s1",
  });
  const result = await client.callTool({ name: "list_rating_requests", arguments: {} });
  assert.ok(text(result).includes("pending"));
  assert.ok(text(result).includes("localhost:3000"));
});

test("submit_rating scores a pending rating request", async () => {
  const req = await store.addRatingRequest({
    url: "http://localhost:3000/",
    screenshotDataUrl: null,
    sessionId: "s1",
  });
  const sections = [
    { key: "typography", label: "Typography", score: 80, advice: "Increase type scale contrast." },
    { key: "composition", label: "Composition", score: 75, advice: "Introduce more asymmetry." },
    {
      key: "motion",
      label: "Motion & Interaction",
      score: 70,
      advice: "Add scroll-reveal animations.",
    },
    {
      key: "color",
      label: "Color & Atmosphere",
      score: 78,
      advice: "Own the palette more boldly.",
    },
    {
      key: "details",
      label: "Details & Craft",
      score: 72,
      advice: "Refine hover states throughout.",
    },
  ];
  const result = await client.callTool({
    name: "submit_rating",
    arguments: {
      id: req.id,
      score: 75,
      ui: 80,
      ux: 70,
      coherence: 78,
      notes: "Good overall",
      sections,
    },
  });
  assert.ok(text(result).includes("75"));
  const after = await store.getRatingRequest(req.id);
  assert.equal(after?.status, "scored");
  assert.equal(after?.result?.score, 75);
  assert.equal(after?.result?.sections?.length, 5);
});

test("submit_rating returns not-found for unknown id", async () => {
  const sections = [
    { key: "typography", label: "Typography", score: 50, advice: "n/a" },
    { key: "composition", label: "Composition", score: 50, advice: "n/a" },
    { key: "motion", label: "Motion & Interaction", score: 50, advice: "n/a" },
    { key: "color", label: "Color & Atmosphere", score: 50, advice: "n/a" },
    { key: "details", label: "Details & Craft", score: 50, advice: "n/a" },
  ];
  const result = await client.callTool({
    name: "submit_rating",
    arguments: { id: "no-such", score: 50, ui: 50, ux: 50, coherence: 50, notes: "n/a", sections },
  });
  assert.ok(text(result).includes("no-such"));
});

test("clear_resolved removes non-open comments and reports the count", async () => {
  const a = await store.add(sample());
  const b = await store.add(sample({ comment: "second" }));
  await store.setStatus(a.id, "resolved");
  await store.setStatus(b.id, "wontfix");
  await store.add(sample({ comment: "still open" }));

  const result = await client.callTool({ name: "clear_resolved", arguments: {} });
  assert.ok(text(result).includes("2"));
  assert.equal((await store.list()).length, 1);
  assert.equal((await store.list())[0].comment, "still open");
});
