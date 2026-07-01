import type { DraftRequest, OperationType, QueuedRequest, Rect } from "./types.js";

export type PinStatus = "pending" | "open" | "processing" | "resolved" | "wontfix";

export interface PinOperation {
  property: string | null;
  from: string | null;
  to: string | null;
}

export interface PinModel {
  key: string;
  operator: string;
  text: string;
  status: PinStatus;
  kind: OperationType;
  removable: boolean;
  route: string;
  target: string;
  operation?: PinOperation;
}

export interface DeferralNotice {
  commentId: string;
  page: string;
  summary: string;
  createdAt: string;
}

export interface PageRatingSection {
  key: "typography" | "composition" | "motion" | "color" | "details";
  label: string;
  score: number;
  advice: string;
}

export interface PageRating {
  id: string;
  status: "pending" | "scored";
  result?: {
    score: number;
    ui: number;
    ux: number;
    coherence: number;
    notes: string;
    sections: PageRatingSection[];
  };
}

export type Message =
  | { type: "set-active"; on: boolean }
  | { type: "sync-active"; tabId?: number }
  | { type: "set-overlay"; tabId: number; on: boolean }
  | { type: "tab-status"; tabId: number; url: string }
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
  | { type: "request-rating"; url: string; screenshotDataUrl: string | null }
  | { type: "reopen-comment"; id: string; note?: string };

export interface QueueStatus {
  queued: number;
  serverReachable: boolean;
  port: number | null;
  root?: string | null;
  watching?: boolean;
  notices?: DeferralNotice[];
  sessionId?: string;
  version?: number | null;
  rating?: PageRating | null;
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
      active?: boolean;
    }
  | { ok: false; error: string };
