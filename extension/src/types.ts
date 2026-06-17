export interface SourceLocation {
  path: string;
  line: number;
  column: number;
  via: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Fingerprint {
  selector: string;
  innerText: string;
  styles: Record<string, string>;
  rect: Rect;
}

export type RequestKind = "comment" | "style" | "text";

export interface StyleChange {
  property: string;
  from: string;
  to: string;
  cssSource?: { file: string; line: number } | null;
}

export interface TextChange {
  from: string;
  to: string;
}

export interface DraftRequest {
  kind: RequestKind;
  url: string;
  text: string;
  styleChanges?: StyleChange[];
  textChange?: TextChange;
  source: SourceLocation | null;
  fingerprint: Fingerprint;
  screenshotDataUrl: string | null;
  viewport: { w: number; h: number };
}

export interface QueuedRequest extends DraftRequest {
  cid: string;
  queuedAt: number;
}
