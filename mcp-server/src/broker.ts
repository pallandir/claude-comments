import { OWNERSHIP_TTL_MS } from "./config.js";
import type { DeferralNotice } from "./types.js";

type Waiter = (version: number) => void;

const MAX_NOTICES = 20;

export class Broker {
  readonly startedAt = new Date().toISOString();
  readonly pid = process.pid;

  private version = 1;
  private lastPolled: string | null = null;
  private readonly waiters = new Set<Waiter>();

  private boundToken: string | null = null;
  private boundTokenBuf: Buffer | null = null;
  private boundHeartbeatAt: string | null = null;
  private extensionSeenAt: string | null = null;
  private notices: DeferralNotice[] = [];

  get currentVersion(): number {
    return this.version;
  }

  get lastPolledAt(): string | null {
    return this.lastPolled;
  }

  get pendingNotices(): DeferralNotice[] {
    return [...this.notices];
  }

  get boundHeartbeat(): string | null {
    return this.boundHeartbeatAt;
  }

  markPolled(): void {
    this.lastPolled = new Date().toISOString();
    if (this.boundToken) {
      this.boundHeartbeatAt = new Date().toISOString();
    }
  }

  bump(): void {
    this.version += 1;
    const pending = [...this.waiters];
    this.waiters.clear();
    for (const waiter of pending) waiter(this.version);
  }

  wait(since: number, timeoutMs: number): Promise<number> {
    if (this.version > since) return Promise.resolve(this.version);
    return new Promise((resolve) => {
      const settle = (version: number) => {
        clearTimeout(timer);
        this.waiters.delete(settle);
        resolve(version);
      };
      const timer = setTimeout(() => settle(this.version), timeoutMs);
      this.waiters.add(settle);
    });
  }

  // Stores the token delivered by the user via the trusted MCP stdio channel.
  // The token itself is the credential; a second caller with a different token
  // is rejected while the first session is still alive, preventing silent theft.
  bindSession(token: string): { ok: boolean; reason?: string } {
    if (this.boundToken !== null && this.isBoundAlive(OWNERSHIP_TTL_MS)) {
      if (!this.verifyToken(token)) {
        return { ok: false, reason: "another session is already active" };
      }
    }
    this.boundToken = token;
    this.boundTokenBuf = Buffer.from(token);
    this.boundHeartbeatAt = new Date().toISOString();
    this.extensionSeenAt = new Date().toISOString();
    this.bump();
    return { ok: true };
  }

  unbindSession(): void {
    this.boundToken = null;
    this.boundTokenBuf = null;
    this.boundHeartbeatAt = null;
    this.extensionSeenAt = null;
    this.bump();
  }

  markExtensionSeen(): void {
    this.extensionSeenAt = new Date().toISOString();
  }

  // Mirror of isBoundAlive for the other direction: the extension is alive while
  // a session is bound and it made an authenticated request within the ttl.
  // bindSession seeds extensionSeenAt, so a session whose extension never polls
  // (disabled at bind time) still lapses instead of watching forever.
  isExtensionAlive(ttlMs: number): boolean {
    return (
      this.boundToken !== null &&
      this.extensionSeenAt !== null &&
      Date.now() - Date.parse(this.extensionSeenAt) < ttlMs
    );
  }

  // Constant-time comparison to prevent timing side-channels.
  verifyToken(candidate: string): boolean {
    if (!this.boundTokenBuf) return false;
    const buf = this.boundTokenBuf;
    const a = Buffer.from(candidate);
    if (a.length !== buf.length) return false;
    return a.reduce((acc, byte, i) => acc | (byte ^ (buf[i] ?? 0)), 0) === 0;
  }

  get token(): string | null {
    return this.boundToken;
  }

  isBoundAlive(ttlMs: number): boolean {
    return (
      this.boundToken !== null &&
      this.boundHeartbeatAt !== null &&
      Date.now() - Date.parse(this.boundHeartbeatAt) < ttlMs
    );
  }

  pushNotice(notice: DeferralNotice): void {
    this.notices = [notice, ...this.notices].slice(0, MAX_NOTICES);
    this.bump();
  }

  dismissNotice(commentId: string): void {
    this.notices = this.notices.filter((n) => n.commentId !== commentId);
    this.bump();
  }
}
