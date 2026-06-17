import type { DraftComment } from "./types.js";

export type Message =
  | { type: "compose-here" }
  | { type: "save-comment"; draft: DraftComment }
  | { type: "flush" }
  | { type: "queue-status" };

export interface QueueStatus {
  queued: number;
  serverReachable: boolean;
  port: number | null;
}

export type Response = { ok: true; status?: QueueStatus } | { ok: false; error: string };
