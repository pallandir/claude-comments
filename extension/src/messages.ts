import type { DraftComment, Rect } from "./types.js";

export type PinStatus = "pending" | "open" | "resolved" | "wontfix";

export interface PinModel {
  key: string;
  selector: string;
  text: string;
  status: PinStatus;
  removable: boolean;
}

export type Message =
  | { type: "compose-here" }
  | { type: "capture-region"; rect: Rect; dpr: number }
  | { type: "save-comment"; draft: DraftComment }
  | { type: "page-comments"; url: string }
  | { type: "remove-comment"; cid: string }
  | { type: "flush" }
  | { type: "queue-status" };

export interface QueueStatus {
  queued: number;
  serverReachable: boolean;
  port: number | null;
}

export type Response =
  | { ok: true; status?: QueueStatus; dataUrl?: string; cid?: string; pins?: PinModel[] }
  | { ok: false; error: string };
