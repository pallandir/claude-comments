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

export interface DraftComment {
  url: string;
  text: string;
  source: SourceLocation | null;
  fingerprint: Fingerprint;
  screenshotDataUrl: string | null;
  viewport: { w: number; h: number };
}

export interface QueuedComment extends DraftComment {
  queuedAt: number;
}
