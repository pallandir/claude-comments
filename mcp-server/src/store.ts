import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type {
  Comment,
  CommentStatus,
  IncomingComment,
  Lease,
  Plan,
  PlanItem,
  RequestKind,
  StyleChange,
  TextChange,
} from "./types.js";

const STORE_DIR = ".claude";
const STORE_FILE = join(STORE_DIR, "design-comments.md");
const SHOTS_DIR = join(STORE_DIR, "design-shots");
const PLAN_FILE = join(STORE_DIR, "redline-plan.json");
const LEASE_FILE = join(STORE_DIR, "redline-lock.json");

export class CommentStore {
  private readonly storeRoot: string;
  private readonly storePath: string;
  private readonly shotsPath: string;
  private readonly planPath: string;
  private readonly leasePath: string;

  constructor(root: string) {
    this.storeRoot = root;
    this.storePath = join(root, STORE_FILE);
    this.shotsPath = join(root, SHOTS_DIR);
    this.planPath = join(root, PLAN_FILE);
    this.leasePath = join(root, LEASE_FILE);
  }

  get root(): string {
    return this.storeRoot;
  }

  async getLease(): Promise<Lease | null> {
    return readJsonFile<Lease>(this.leasePath);
  }

  async writeLease(lease: Lease): Promise<void> {
    await writeJsonFile(this.leasePath, lease);
  }

  async clearLease(): Promise<void> {
    await rm(this.leasePath, { force: true });
  }

  async getPlan(): Promise<Plan | null> {
    return readJsonFile<Plan>(this.planPath);
  }

  async setPlan(items: PlanItem[], note: string | null): Promise<Plan> {
    const plan: Plan = {
      id: `p-${randomUUID().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      status: "proposed",
      note,
      items,
    };
    await this.writePlan(plan);
    return plan;
  }

  async decidePlan(id: string, status: "approved" | "rejected"): Promise<Plan | null> {
    const plan = await this.getPlan();
    if (!plan || plan.id !== id) return null;
    plan.status = status;
    await this.writePlan(plan);
    return plan;
  }

  async clearPlan(): Promise<void> {
    await rm(this.planPath, { force: true });
  }

  private async writePlan(plan: Plan): Promise<void> {
    await writeJsonFile(this.planPath, plan);
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
      kind: incoming.kind ?? "comment",
      text: incoming.text,
      status: "open",
      source: incoming.source ?? null,
      styleChanges: incoming.styleChanges ?? [],
      textChange: incoming.textChange ?? null,
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

  async clear(url?: string): Promise<number> {
    const comments = await this.read();
    const kept = url ? comments.filter((c) => c.url !== url) : [];
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
    const raw = await readTextFile(this.storePath);
    return raw === null ? [] : parse(raw);
  }

  private async write(comments: Comment[]): Promise<void> {
    await writeFileAtomic(this.storePath, serialize(comments));
  }
}

async function readTextFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

// A truncated or hand-edited sidecar must read as "absent", not crash the
// request handler that reads it; a fresh write repairs it.
async function readJsonFile<T>(path: string): Promise<T | null> {
  const raw = await readTextFile(path);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeFileAtomic(path, `${JSON.stringify(value, null, 2)}\n`);
}

// Write to a temp file and rename over the target so a concurrent reader never
// observes a partially written file.
async function writeFileAtomic(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(tmp, contents, "utf8");
  await rename(tmp, path);
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
    const lines = [`## [${c.status}] ${c.id} · ${c.route} · ${c.kind}`, `> ${c.text}`, ""];
    if (c.screenshot) lines.push(`![${c.id}](${c.screenshot})`, "");
    for (const change of c.styleChanges) {
      const css = change.cssSource ? ` @ ${change.cssSource.file}:${change.cssSource.line}` : "";
      lines.push(`- change: ${change.property}: ${change.from} -> ${change.to}${css}`);
    }
    if (c.textChange) {
      lines.push(
        `- text-change: ${JSON.stringify(c.textChange.from)} -> ${JSON.stringify(c.textChange.to)}`,
      );
    }
    if (c.source) {
      lines.push(
        `- source: ${c.source.path}:${c.source.line}:${c.source.column} (${c.source.via})`,
      );
    }
    const viewport = c.viewport ?? { w: 0, h: 0 };
    const fingerprint = c.fingerprint ?? { selector: "", innerText: "" };
    lines.push(
      `- selector: ${fingerprint.selector ?? ""}`,
      `- text: ${JSON.stringify(fingerprint.innerText ?? "")}`,
      `- viewport: ${viewport.w}x${viewport.h}`,
      `- url: ${c.url}`,
      `- created: ${c.createdAt}`,
    );
    return lines.join("\n");
  });
  return `# Design comments\n\n${blocks.join("\n\n")}\n`;
}

const HEADING = /^## \[(open|resolved|wontfix)\] (\S+) · (.+?)(?: · (comment|style|text))?$/;
const KV = /^- (\w+): (.+)$/;
const SOURCE = /^(.+):(\d+):(\d+) \((.+)\)$/;

interface Draft {
  kv: Record<string, string>;
  status: CommentStatus;
  id: string;
  route: string;
  kind: RequestKind;
  text?: string;
  screenshot?: string;
  styleChanges: StyleChange[];
  textChange: TextChange | null;
}

function parse(raw: string): Comment[] {
  const comments: Comment[] = [];
  let current: Draft | null = null;

  const flush = () => {
    if (!current) return;
    const kv = current.kv;
    const source = kv.source?.match(SOURCE);
    comments.push({
      id: current.id,
      createdAt: kv.created ?? new Date(0).toISOString(),
      url: kv.url ?? "",
      route: current.route,
      kind: current.kind,
      text: current.text ?? "",
      status: current.status,
      source: source
        ? { path: source[1], line: Number(source[2]), column: Number(source[3]), via: source[4] }
        : null,
      styleChanges: current.styleChanges,
      textChange: current.textChange,
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
      current = {
        kv: {},
        status: heading[1] as CommentStatus,
        id: heading[2],
        route: heading[3],
        kind: (heading[4] as RequestKind) ?? "comment",
        styleChanges: [],
        textChange: null,
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("> ")) {
      current.text = line.slice(2);
      continue;
    }
    const shot = line.match(/^!\[.*\]\((.+)\)$/);
    if (shot) {
      current.screenshot = shot[1];
      continue;
    }
    if (line.startsWith("- change: ")) {
      const change = parseChange(line.slice("- change: ".length));
      if (change) current.styleChanges.push(change);
      continue;
    }
    if (line.startsWith("- text-change: ")) {
      current.textChange = parseTextChange(line.slice("- text-change: ".length));
      continue;
    }
    const kv = line.match(KV);
    if (kv) current.kv[kv[1]] = kv[2];
  }
  flush();
  return comments;
}

function parseChange(body: string): StyleChange | null {
  let rest = body;
  let cssSource: StyleChange["cssSource"] = null;
  const at = rest.lastIndexOf(" @ ");
  if (at >= 0) {
    const loc = rest.slice(at + 3).match(/^(.+):(\d+)$/);
    if (loc) cssSource = { file: loc[1], line: Number(loc[2]) };
    rest = rest.slice(0, at);
  }
  const colon = rest.indexOf(": ");
  if (colon < 0) return null;
  const property = rest.slice(0, colon);
  const [from, to] = rest.slice(colon + 2).split(" -> ");
  if (from === undefined || to === undefined) return null;
  return { property, from, to, cssSource };
}

function parseTextChange(body: string): TextChange | null {
  const parts = body.split(" -> ");
  if (parts.length !== 2) return null;
  return { from: safeJson(parts[0]) ?? parts[0], to: safeJson(parts[1]) ?? parts[1] };
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
