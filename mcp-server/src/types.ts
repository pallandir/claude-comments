export type CommentStatus = "open" | "resolved" | "wontfix";

export type RequestKind = "comment" | "style" | "text";

export interface SourceLocation {
  path: string;
  line: number;
  column: number;
  via: string;
}

export interface Fingerprint {
  selector: string;
  innerText: string;
  styles: Record<string, string>;
  rect: { x: number; y: number; w: number; h: number };
}

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

export interface Comment {
  id: string;
  createdAt: string;
  url: string;
  route: string;
  kind: RequestKind;
  text: string;
  status: CommentStatus;
  source: SourceLocation | null;
  styleChanges: StyleChange[];
  textChange: TextChange | null;
  fingerprint: Fingerprint;
  screenshot: string | null;
  viewport: { w: number; h: number };
}

export interface IncomingComment {
  kind?: RequestKind;
  url: string;
  text: string;
  source?: SourceLocation | null;
  styleChanges?: StyleChange[];
  textChange?: TextChange | null;
  fingerprint: Fingerprint;
  screenshotDataUrl?: string | null;
  viewport: { w: number; h: number };
}
