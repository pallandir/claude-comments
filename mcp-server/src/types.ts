export type CommentStatus = "open" | "resolved" | "wontfix";

export type OperationType = "comment" | "style" | "text";

export interface SourceLocation {
  path: string;
  line: number;
  column: number;
  via: string;
}

export interface Operation {
  type: OperationType;
  property: string | null;
  from: string | null;
  to: string | null;
}

export interface CommentMetadata {
  page: string;
  viewport: { w: number; h: number };
  elementText: string;
}

export interface Comment {
  id: string;
  createdAt: string;
  comment: string;
  operation: Operation;
  operator: string;
  url: string;
  metadata: CommentMetadata;
  status: CommentStatus;
  source: SourceLocation | null;
  screenshot: string | null;
  sessionId?: string;
  planFirst?: boolean;
}

export interface DeferredComment {
  id: string;
  createdAt: string;
  page: string;
  operationType: OperationType;
  comment: string;
  reason: string;
  flaggedBy: "user" | "assistant";
}

export interface DeferralNotice {
  commentId: string;
  page: string;
  summary: string;
  createdAt: string;
}

export interface IncomingComment {
  comment: string;
  operation: Operation;
  operator: string;
  url: string;
  metadata: CommentMetadata;
  source?: SourceLocation | null;
  screenshotDataUrl?: string | null;
  sessionId?: string;
  planFirst?: boolean;
}

export type RatingStatus = "pending" | "scored";

export interface RatingResult {
  score: number;
  ui: number;
  ux: number;
  coherence: number;
  notes: string;
}

export interface IncomingRatingRequest {
  url: string;
  screenshotDataUrl?: string | null;
  sessionId?: string;
}

export interface RatingRequest {
  id: string;
  createdAt: string;
  url: string;
  screenshot: string | null;
  sessionId?: string;
  status: RatingStatus;
  result?: RatingResult;
}
