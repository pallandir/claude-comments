import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { CommentStore } from "./store.js";
import type { IncomingComment } from "./types.js";

const MAX_BODY_BYTES = 12 * 1024 * 1024;

export interface IngestServer {
  port: number;
  close: () => Promise<void>;
}

export async function startIngestServer(
  store: CommentStore,
  preferredPorts: number[],
  log: (msg: string) => void,
): Promise<IngestServer> {
  const server = createServer((req, res) => handle(req, res, store, log));
  const port = await listenFirstAvailable(server, preferredPorts);
  return {
    port,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

function setCors(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function handle(
  req: IncomingMessage,
  res: ServerResponse,
  store: CommentStore,
  log: (msg: string) => void,
): Promise<void> {
  setCors(res);

  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && req.url?.startsWith("/comments")) {
    json(res, 200, await store.list());
    return;
  }

  if (req.method === "POST" && req.url === "/comments") {
    try {
      const body = await readBody(req);
      const incoming = JSON.parse(body) as IncomingComment;
      const comment = await store.add(incoming);
      log(`ingested comment ${comment.id} on ${comment.route}`);
      json(res, 201, { id: comment.id, status: comment.status });
    } catch (err) {
      json(res, 400, { error: (err as Error).message });
    }
    return;
  }

  json(res, 404, { error: "not found" });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function listenFirstAvailable(
  server: ReturnType<typeof createServer>,
  ports: number[],
): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (index: number) => {
      if (index >= ports.length) {
        reject(new Error(`no available port in ${ports.join(", ")}`));
        return;
      }
      const port = ports[index];
      const onError = (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          tryPort(index + 1);
        } else {
          reject(err);
        }
      };
      server.once("error", onError);
      server.listen(port, "127.0.0.1", () => {
        server.removeListener("error", onError);
        resolve(port);
      });
    };
    tryPort(0);
  });
}
