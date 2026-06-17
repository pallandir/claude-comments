type Waiter = (version: number) => void;

export class Broker {
  readonly startedAt = new Date().toISOString();
  readonly pid = process.pid;

  private version = 1;
  private lastPolled: string | null = null;
  private readonly waiters = new Set<Waiter>();

  get currentVersion(): number {
    return this.version;
  }

  get lastPolledAt(): string | null {
    return this.lastPolled;
  }

  markPolled(): void {
    this.lastPolled = new Date().toISOString();
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
}
