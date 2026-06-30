import assert from "node:assert/strict";
import { test } from "node:test";
import { Broker } from "../src/broker.js";

test("bindSession accepts the first token unconditionally", () => {
  const broker = new Broker();
  const result = broker.bindSession("token-a");
  assert.equal(result.ok, true);
  assert.equal(result.reason, undefined);
});

test("bindSession allows re-binding with the same token (idempotent refresh)", () => {
  const broker = new Broker();
  broker.bindSession("token-a");
  const result = broker.bindSession("token-a");
  assert.equal(result.ok, true);
});

test("bindSession rejects a different token while a live session is bound", () => {
  const broker = new Broker();
  broker.bindSession("token-a");
  const result = broker.bindSession("token-b");
  assert.equal(result.ok, false);
  assert.ok(result.reason, "expected a reason string");
});

test("bindSession allows a new token after unbind", () => {
  const broker = new Broker();
  broker.bindSession("token-a");
  broker.unbindSession();
  const result = broker.bindSession("token-b");
  assert.equal(result.ok, true);
});

test("verifyToken returns false when no session is bound", () => {
  const broker = new Broker();
  assert.equal(broker.verifyToken("anything"), false);
});

test("verifyToken returns true for the bound token", () => {
  const broker = new Broker();
  broker.bindSession("my-secret");
  assert.equal(broker.verifyToken("my-secret"), true);
});

test("verifyToken returns false for a different string of same length", () => {
  const broker = new Broker();
  broker.bindSession("aaaaaaaaaa");
  assert.equal(broker.verifyToken("bbbbbbbbbb"), false);
});

test("wait resolves immediately when version has advanced", async () => {
  const broker = new Broker();
  const v0 = broker.currentVersion;
  broker.bump();
  const resolved = await broker.wait(v0, 5000);
  assert.equal(resolved, broker.currentVersion);
});

test("wait times out and resolves with current version", async () => {
  const broker = new Broker();
  const v0 = broker.currentVersion;
  const start = Date.now();
  const resolved = await broker.wait(v0, 50);
  assert.ok(Date.now() - start >= 40, "should have waited ~50ms");
  assert.equal(resolved, v0);
});
