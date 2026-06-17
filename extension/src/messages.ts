import type { DraftRequest, QueuedRequest, Rect, RequestKind } from "./types.js";

export type PinStatus = "pending" | "open" | "resolved" | "wontfix";

export interface PinModel {
  key: string;
  selector: string;
  text: string;
  status: PinStatus;
  kind: RequestKind;
  removable: boolean;
}

export type PlanStatus = "proposed" | "approved" | "rejected" | "applied";

export interface PlanItemView {
  commentId: string;
  file: string;
  summary: string;
}

export interface PlanView {
  id: string;
  status: PlanStatus;
  note: string | null;
  items: PlanItemView[];
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
  | { type: "plan-decision"; id: string; decision: "approve" | "reject" }
  | { type: "queue-status" };

export interface QueueStatus {
  queued: number;
  serverReachable: boolean;
  port: number | null;
  root?: string | null;
  watching?: boolean;
  plan?: PlanView | null;
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
