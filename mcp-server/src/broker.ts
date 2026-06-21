import type { DeferralNotice } from "./types.js";

type Waiter = (version: number) => void;

const MAX_NOTICES = 20;

export class Broker {
  readonly startedAt = new Date().toISOString();
  readonly pid = process.pid;

  private version = 1;
  private lastPolled: string | null = null;
  private readonly waiters = new Set<Waiter>();

  private expectedSessionId: string | null = null;
  private boundSessionId: string | null = null;
  private boundHeartbeatAt: string | null = null;
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

  get expectedSession(): string | null {
    return this.expectedSessionId;
  }

  get boundSession(): string | null {
    return this.boundSessionId;
  }

  get boundHeartbeat(): string | null {
    return this.boundHeartbeatAt;
  }

  markPolled(): void {
    this.lastPolled = new Date().toISOString();
    if (this.boundSessionId) {
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

  publishSession(id: string): void {
    this.expectedSessionId = id;
    this.bump();
  }

  bindSession(id: string): { ok: boolean; reason?: string } {
    if (!this.expectedSessionId) {
      return { ok: false, reason: "no-session-published" };
    }
    if (id !== this.expectedSessionId) {
      return { ok: false, reason: "id-mismatch" };
    }
    this.boundSessionId = id;
    this.boundHeartbeatAt = new Date().toISOString();
    this.bump();
    return { ok: true };
  }

  unbindSession(): void {
    this.boundSessionId = null;
    this.boundHeartbeatAt = null;
    this.bump();
  }

  isBoundAlive(ttlMs: number): boolean {
    return (
      this.boundSessionId !== null &&
      this.expectedSessionId !== null &&
      this.boundSessionId === this.expectedSessionId &&
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
