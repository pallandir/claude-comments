import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { type IngestServer, startIngestServer } from "./http.js";
import { CommentStore } from "./store.js";

let server: IngestServer;
let root: string;

const validBody = JSON.stringify({
  comment: "tweak this",
  operation: { type: "comment", property: null, from: null, to: null },
  operator: "/html/body/main[1]",
  url: "http://localhost:3000/",
  metadata: { page: "/", viewport: { w: 800, h: 600 }, elementText: "hi" },
});

interface Reply {
  status: number;
  body: string;
}

function call(
  method: string,
  path: string,
  headers: Record<string, string>,
  body?: string,
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: "127.0.0.1", port: server.port, method, path, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

const ext = "chrome-extension://abc";
function loopbackHost(): string {
  return `127.0.0.1:${server.port}`;
}

before(async () => {
  root = await mkdtemp(join(tmpdir(), "redline-http-"));
  server = await startIngestServer(new CommentStore(root), [0], () => {});
});

after(async () => {
  await server.close();
  await rm(root, { recursive: true, force: true });
});

test("/health identifies the service to the extension", async () => {
  const res = await call("GET", "/health", { Host: loopbackHost(), Origin: ext });
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, true);
  assert.equal(body.service, "redline");
  assert.equal(body.root, root);
  assert.equal(typeof body.startedAt, "string");
  assert.equal(typeof body.pid, "number");
});

test("rejects a web-page origin (CSRF / prompt-injection channel)", async () => {
  const res = await call(
    "POST",
    "/comments",
    { Host: loopbackHost(), Origin: "http://evil.test", "Content-Type": "application/json" },
    validBody,
  );
  assert.equal(res.status, 403);
});

test("rejects a non-loopback Host header (DNS rebinding)", async () => {
  const res = await call("GET", "/comments", { Host: "attacker.test", Origin: ext });
  assert.equal(res.status, 403);
});

test("accepts a valid comment from the extension origin", async () => {
  const res = await call(
    "POST",
    "/comments",
    { Host: loopbackHost(), Origin: ext, "Content-Type": "application/json" },
    validBody,
  );
  assert.equal(res.status, 201);
  assert.equal(JSON.parse(res.body).status, "open");
});

test("rejects a malformed payload with 400 and stays up", async () => {
  const res = await call(
    "POST",
    "/comments",
    { Host: loopbackHost(), Origin: ext, "Content-Type": "application/json" },
    "{ not json",
  );
  assert.equal(res.status, 400);
  const health = await call("GET", "/health", { Host: loopbackHost(), Origin: ext });
  assert.equal(health.status, 200);
});

test("rejects a comment missing required fields", async () => {
  const res = await call(
    "POST",
    "/comments",
    { Host: loopbackHost(), Origin: ext, "Content-Type": "application/json" },
    JSON.stringify({ comment: "no operator or metadata" }),
  );
  assert.equal(res.status, 400);
});
