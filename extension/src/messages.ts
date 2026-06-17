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

export type Message =
  | { type: "set-active"; on: boolean }
  | { type: "capture-region"; rect: Rect; dpr: number }
  | { type: "resolve-style-source"; selector: string; property: string }
  | { type: "save-request"; draft: DraftRequest }
  | { type: "page-comments"; url: string }
  | { type: "get-comments"; url: string }
  | { type: "remove-comment"; cid: string }
  | { type: "clear-comments"; url: string }
  | { type: "clear-all" }
  | { type: "count-all" }
  | { type: "update-comment"; cid: string; text: string }
  | { type: "flush" }
  | { type: "queue-status" }
  | { type: "precise-status" }
  | { type: "open-settings" };

export interface QueueStatus {
  queued: number;
  serverReachable: boolean;
  port: number | null;
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
      cssSource?: { file: string; line: number } | null;
      granted?: boolean;
    }
  | { ok: false; error: string };
