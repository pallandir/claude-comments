export type CommentStatus = "open" | "resolved" | "wontfix";

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

export interface Comment {
  id: string;
  createdAt: string;
  url: string;
  route: string;
  text: string;
  status: CommentStatus;
  source: SourceLocation | null;
  fingerprint: Fingerprint;
  screenshot: string | null;
  viewport: { w: number; h: number };
}

export interface IncomingComment {
  url: string;
  text: string;
  source?: SourceLocation | null;
  fingerprint: Fingerprint;
  screenshotDataUrl?: string | null;
  viewport: { w: number; h: number };
}
