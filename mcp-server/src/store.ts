import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type { Comment, CommentStatus, IncomingComment } from "./types.js";

const STORE_DIR = ".claude";
const STORE_FILE = join(STORE_DIR, "design-comments.md");
const SHOTS_DIR = join(STORE_DIR, "design-shots");

export class CommentStore {
  private readonly root: string;
  private readonly storePath: string;
  private readonly shotsPath: string;

  constructor(root: string) {
    this.root = root;
    this.storePath = join(root, STORE_FILE);
    this.shotsPath = join(root, SHOTS_DIR);
  }

  async list(status?: CommentStatus): Promise<Comment[]> {
    const all = await this.read();
    return status ? all.filter((c) => c.status === status) : all;
  }

  async get(id: string): Promise<Comment | undefined> {
    return (await this.read()).find((c) => c.id === id);
  }

  async add(incoming: IncomingComment): Promise<Comment> {
    const comments = await this.read();
    const id = `c${comments.length + 1}-${randomUUID().slice(0, 6)}`;
    const screenshot = incoming.screenshotDataUrl
      ? await this.saveShot(id, incoming.screenshotDataUrl)
      : null;

    const comment: Comment = {
      id,
      createdAt: new Date().toISOString(),
      url: incoming.url,
      route: routeOf(incoming.url),
      text: incoming.text,
      status: "open",
      source: incoming.source ?? null,
      fingerprint: incoming.fingerprint,
      screenshot,
      viewport: incoming.viewport,
    };
    comments.push(comment);
    await this.write(comments);
    return comment;
  }

  async setStatus(id: string, status: CommentStatus): Promise<Comment | undefined> {
    const comments = await this.read();
    const comment = comments.find((c) => c.id === id);
    if (!comment) return undefined;
    comment.status = status;
    await this.write(comments);
    return comment;
  }

  async clearResolved(): Promise<number> {
    const comments = await this.read();
    const kept = comments.filter((c) => c.status === "open");
    await this.write(kept);
    return comments.length - kept.length;
  }

  private async saveShot(id: string, dataUrl: string): Promise<string> {
    await mkdir(this.shotsPath, { recursive: true });
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const file = join(this.shotsPath, `${id}.png`);
    await writeFile(file, Buffer.from(base64, "base64"));
    return relative(this.root, file);
  }

  private async read(): Promise<Comment[]> {
    try {
      const raw = await readFile(this.storePath, "utf8");
      return parse(raw);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  private async write(comments: Comment[]): Promise<void> {
    await mkdir(dirname(this.storePath), { recursive: true });
    await writeFile(this.storePath, serialize(comments), "utf8");
  }
}

function routeOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function serialize(comments: Comment[]): string {
  const blocks = comments.map((c) => {
    const lines = [`## [${c.status}] ${c.id} · ${c.route}`, `> ${c.text}`, ""];
    if (c.screenshot) lines.push(`![${c.id}](${c.screenshot})`, "");
    if (c.source) {
      lines.push(
        `- source: ${c.source.path}:${c.source.line}:${c.source.column} (${c.source.via})`,
      );
    }
    lines.push(
      `- selector: ${c.fingerprint.selector}`,
      `- text: ${JSON.stringify(c.fingerprint.innerText)}`,
      `- viewport: ${c.viewport.w}x${c.viewport.h}`,
      `- url: ${c.url}`,
      `- created: ${c.createdAt}`,
    );
    return lines.join("\n");
  });
  return `# Design comments\n\n${blocks.join("\n\n")}\n`;
}

const HEADING = /^## \[(open|resolved|wontfix)\] (\S+) · (.+)$/;
const KV = /^- (\w+): (.+)$/;
const SOURCE = /^(.+):(\d+):(\d+) \((.+)\)$/;

function parse(raw: string): Comment[] {
  const comments: Comment[] = [];
  let current: Partial<Comment> & { kv: Record<string, string> } = { kv: {} };
  let inBlock = false;

  const flush = () => {
    if (!inBlock || !current.id) return;
    const kv = current.kv;
    const source = kv.source?.match(SOURCE);
    comments.push({
      id: current.id,
      createdAt: kv.created ?? new Date(0).toISOString(),
      url: kv.url ?? "",
      route: current.route ?? routeOf(kv.url ?? ""),
      text: current.text ?? "",
      status: current.status ?? "open",
      source: source
        ? { path: source[1], line: Number(source[2]), column: Number(source[3]), via: source[4] }
        : null,
      fingerprint: {
        selector: kv.selector ?? "",
        innerText: safeJson(kv.text) ?? "",
        styles: {},
        rect: { x: 0, y: 0, w: 0, h: 0 },
      },
      screenshot: current.screenshot ?? null,
      viewport: parseViewport(kv.viewport),
    });
  };

  for (const line of raw.split("\n")) {
    const heading = line.match(HEADING);
    if (heading) {
      flush();
      inBlock = true;
      current = {
        kv: {},
        status: heading[1] as CommentStatus,
        id: heading[2],
        route: heading[3],
      };
      continue;
    }
    if (!inBlock) continue;
    if (line.startsWith("> ")) {
      current.text = line.slice(2);
      continue;
    }
    const shot = line.match(/^!\[.*\]\((.+)\)$/);
    if (shot) {
      current.screenshot = shot[1];
      continue;
    }
    const kv = line.match(KV);
    if (kv) current.kv[kv[1]] = kv[2];
  }
  flush();
  return comments;
}

function parseViewport(value?: string): { w: number; h: number } {
  const match = value?.match(/^(\d+)x(\d+)$/);
  return match ? { w: Number(match[1]), h: Number(match[2]) } : { w: 0, h: 0 };
}

function safeJson(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
