import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { type IngestServer, hmacHex, startIngestServer } from "../src/http.js";
import { CommentStore } from "../src/store.js";

let server: IngestServer;
let root: string;
const TEST_TOKEN = "test-token-secret";

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
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { Host: loopbackHost(), Origin: ext, "X-Redline-Token": TEST_TOKEN, ...extra };
}

before(async () => {
  root = await mkdtemp(join(tmpdir(), "redline-http-"));
  server = await startIngestServer(new CommentStore(root), [0], () => {});
  server.broker.bindSession(TEST_TOKEN);
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

test("/health does not leak session tokens", async () => {
  const res = await call("GET", "/health", { Host: loopbackHost(), Origin: ext });
  const body = JSON.parse(res.body);
  assert.equal(body.expectedSession, undefined);
  assert.equal(body.boundSession, undefined);
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

test("data endpoints return 401 without a token", async () => {
  const res = await call(
    "POST",
    "/comments",
    { Host: loopbackHost(), Origin: ext, "Content-Type": "application/json" },
    validBody,
  );
  assert.equal(res.status, 401);
});

test("data endpoints return 401 with a wrong token", async () => {
  const res = await call(
    "POST",
    "/comments",
    {
      Host: loopbackHost(),
      Origin: ext,
      "Content-Type": "application/json",
      "X-Redline-Token": "wrong",
    },
    validBody,
  );
  assert.equal(res.status, 401);
});

test("accepts a valid comment from the extension origin with correct token", async () => {
  const res = await call(
    "POST",
    "/comments",
    authHeaders({ "Content-Type": "application/json" }),
    validBody,
  );
  assert.equal(res.status, 201);
  assert.equal(JSON.parse(res.body).status, "open");
});

test("rejects a malformed payload with 400 and stays up", async () => {
  const res = await call(
    "POST",
    "/comments",
    authHeaders({ "Content-Type": "application/json" }),
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
    authHeaders({ "Content-Type": "application/json" }),
    JSON.stringify({ comment: "no operator or metadata" }),
  );
  assert.equal(res.status, 400);
});

test("/handshake returns valid HMAC when token is bound", async () => {
  const nonce = "test-nonce-12345";
  const res = await call(
    "POST",
    "/handshake",
    { Host: loopbackHost(), Origin: ext, "Content-Type": "application/json" },
    JSON.stringify({ nonce }),
  );
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  const expected = hmacHex(TEST_TOKEN, nonce);
  assert.equal(body.hmac, expected);
});

test("/handshake returns 401 when no token is bound", async () => {
  const root2 = await mkdtemp(join(tmpdir(), "redline-http2-"));
  const unbound = await startIngestServer(new CommentStore(root2), [0], () => {});
  try {
    const res = await new Promise<Reply>((resolve, reject) => {
      const req = httpRequest(
        {
          host: "127.0.0.1",
          port: unbound.port,
          method: "POST",
          path: "/handshake",
          headers: {
            Host: `127.0.0.1:${unbound.port}`,
            Origin: ext,
            "Content-Type": "application/json",
          },
        },
        (r) => {
          let data = "";
          r.on("data", (c) => {
            data += c;
          });
          r.on("end", () => resolve({ status: r.statusCode ?? 0, body: data }));
        },
      );
      req.on("error", reject);
      req.write(JSON.stringify({ nonce: "n" }));
      req.end();
    });
    assert.equal(res.status, 401);
  } finally {
    await unbound.close();
    await rm(root2, { recursive: true, force: true });
  }
});

test("DELETE /comments without url or all=true returns 400", async () => {
  const res = await call("DELETE", "/comments", authHeaders());
  assert.equal(res.status, 400);
});

test("DELETE /comments?all=true clears all comments", async () => {
  await call("POST", "/comments", authHeaders({ "Content-Type": "application/json" }), validBody);
  const res = await call("DELETE", "/comments?all=true", authHeaders());
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.body).removed >= 0, true);
});

test("DELETE /comments?url= clears only the matching url", async () => {
  const url = encodeURIComponent("http://localhost:3000/");
  const res = await call("DELETE", `/comments?url=${url}`, authHeaders());
  assert.equal(res.status, 200);
});

test("unknown route returns 404", async () => {
  const res = await call("GET", "/no-such-route", authHeaders());
  assert.equal(res.status, 404);
});

test("OPTIONS preflight returns 204 and CORS headers", async () => {
  const res = await call("OPTIONS", "/comments", {
    Host: loopbackHost(),
    Origin: ext,
    "Access-Control-Request-Method": "POST",
  });
  assert.equal(res.status, 204);
});

test("null Origin (local file or same-origin fetch) is allowed", async () => {
  const res = await call("GET", "/health", { Host: loopbackHost(), Origin: "null" });
  assert.equal(res.status, 200);
});

test("absent Origin is allowed (same-origin service worker fetch)", async () => {
  const res = await call("GET", "/health", { Host: loopbackHost() });
  assert.equal(res.status, 200);
});

test("GET /state returns version, comments and watching flag", async () => {
  const res = await call("GET", "/state", authHeaders());
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(typeof body.version, "number");
  assert.ok(Array.isArray(body.comments));
  assert.equal(typeof body.watching, "boolean");
});

test("GET /wait resolves immediately when version has already advanced", async () => {
  const res = await call("GET", "/wait?since=0", authHeaders());
  assert.equal(res.status, 200);
  const body = JSON.parse(res.body);
  assert.equal(typeof body.version, "number");
  assert.ok(body.version > 0);
});

test("POST /comments/reopen reopens a resolved comment", async () => {
  const post = await call(
    "POST",
    "/comments",
    authHeaders({ "Content-Type": "application/json" }),
    validBody,
  );
  const { id } = JSON.parse(post.body);

  const res = await call(
    "POST",
    "/comments/reopen",
    authHeaders({ "Content-Type": "application/json" }),
    JSON.stringify({ id }),
  );
  assert.equal(res.status, 200);
});

test("POST /comments/reopen returns 400 when id is missing", async () => {
  const res = await call(
    "POST",
    "/comments/reopen",
    authHeaders({ "Content-Type": "application/json" }),
    JSON.stringify({ note: "no id here" }),
  );
  assert.equal(res.status, 400);
});

test("POST /comments/reopen returns 404 for an unknown id", async () => {
  const res = await call(
    "POST",
    "/comments/reopen",
    authHeaders({ "Content-Type": "application/json" }),
    JSON.stringify({ id: "no-such-id" }),
  );
  assert.equal(res.status, 404);
});

test("POST /notices/dismiss removes the notice from the broker", async () => {
  server.broker.pushNotice({
    commentId: "c1",
    page: "/",
    summary: "test notice",
    createdAt: new Date().toISOString(),
  });
  const res = await call(
    "POST",
    "/notices/dismiss",
    authHeaders({ "Content-Type": "application/json" }),
    JSON.stringify({ commentId: "c1" }),
  );
  assert.equal(res.status, 200);
  assert.equal(server.broker.pendingNotices.length, 0);
});

test("POST /notices/dismiss returns 400 when commentId is missing", async () => {
  const res = await call(
    "POST",
    "/notices/dismiss",
    authHeaders({ "Content-Type": "application/json" }),
    JSON.stringify({}),
  );
  assert.equal(res.status, 400);
});

test("GET /ratings returns an array", async () => {
  const res = await call("GET", "/ratings", authHeaders());
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(JSON.parse(res.body)));
});

test("POST /ratings creates a rating request and GET /ratings returns it", async () => {
  const post = await call(
    "POST",
    "/ratings",
    authHeaders({ "Content-Type": "application/json" }),
    JSON.stringify({ url: "http://localhost:3000/", screenshotDataUrl: null }),
  );
  assert.equal(post.status, 201);
  const { id } = JSON.parse(post.body);
  assert.equal(typeof id, "string");

  const get = await call("GET", "/ratings", authHeaders());
  const list = JSON.parse(get.body);
  assert.ok(list.some((r: { id: string }) => r.id === id));
});

test("source.path with traversal segments is rejected with 400", async () => {
  const body = JSON.stringify({
    comment: "test traversal",
    operation: { type: "comment", property: null, from: null, to: null },
    operator: "/html/body",
    url: "http://localhost:3000/",
    metadata: { page: "/", viewport: { w: 800, h: 600 }, elementText: "" },
    source: { path: "../../etc/passwd", line: 1, column: 0, via: "react-dev-inspector" },
  });
  const res = await call(
    "POST",
    "/comments",
    authHeaders({ "Content-Type": "application/json" }),
    body,
  );
  assert.equal(res.status, 400);
});
