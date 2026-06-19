import type { DraftRequest, OperationType, QueuedRequest, Rect } from "./types.js";

export type PinStatus = "pending" | "open" | "resolved" | "wontfix";

export interface PinModel {
  key: string;
  operator: string;
  text: string;
  status: PinStatus;
  kind: OperationType;
  removable: boolean;
  route: string;
  target: string;
}

export interface DeferralNotice {
  commentId: string;
  page: string;
  summary: string;
  createdAt: string;
}

export type Message =
  | { type: "set-active"; on: boolean }
  | { type: "capture-region"; rect: Rect; dpr: number }
  | { type: "save-request"; draft: DraftRequest }
  | { type: "page-comments"; url: string }
  | { type: "get-comments"; url: string }
  | { type: "remove-comment"; cid: string }
  | { type: "clear-comments"; url: string }
  | { type: "clear-all" }
  | { type: "count-all" }
  | { type: "update-comment"; cid: string; text: string }
  | { type: "flush" }
  | { type: "dismiss-notice"; commentId: string }
  | { type: "queue-status" }
  | { type: "reset-session" };

export interface QueueStatus {
  queued: number;
  serverReachable: boolean;
  port: number | null;
  root?: string | null;
  watching?: boolean;
  notices?: DeferralNotice[];
  sessionId?: string;
}

export type Response =
  | {
      ok: true;
      status?: QueueStatus;
      dataUrl?: string | null;
      cid?: string;
      pins?: PinModel[];
      comments?: QueuedRequest[];
      count?: number;
    }
  | { ok: false; error: string };
