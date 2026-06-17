import { z } from "zod";
import type { IncomingComment } from "./types.js";

const MAX_TEXT = 8_000;
const MAX_SHORT = 2_000;
const MAX_URL = 4_000;
const MAX_CHANGES = 100;

const sourceSchema = z
  .object({
    path: z.string().max(MAX_SHORT),
    line: z.number().int().nonnegative(),
    column: z.number().int().nonnegative(),
    via: z.string().max(MAX_SHORT),
  })
  .strict();

const styleChangeSchema = z
  .object({
    property: z.string().max(MAX_SHORT),
    from: z.string().max(MAX_SHORT),
    to: z.string().max(MAX_SHORT),
    cssSource: z
      .object({ file: z.string().max(MAX_SHORT), line: z.number().int().nonnegative() })
      .strict()
      .nullish(),
  })
  .strict();

const textChangeSchema = z
  .object({ from: z.string().max(MAX_TEXT), to: z.string().max(MAX_TEXT) })
  .strict();

const fingerprintSchema = z
  .object({
    selector: z.string().max(MAX_SHORT),
    innerText: z.string().max(MAX_TEXT),
    styles: z.record(z.string().max(MAX_SHORT)),
    rect: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).strict(),
  })
  .strict();

const screenshotSchema = z
  .string()
  .regex(/^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/, "invalid screenshot data url")
  .nullish();

export const incomingCommentSchema = z
  .object({
    kind: z.enum(["comment", "style", "text"]).optional(),
    url: z.string().max(MAX_URL),
    text: z.string().max(MAX_TEXT),
    source: sourceSchema.nullish(),
    styleChanges: z.array(styleChangeSchema).max(MAX_CHANGES).optional(),
    textChange: textChangeSchema.nullish(),
    fingerprint: fingerprintSchema,
    screenshotDataUrl: screenshotSchema,
    viewport: z.object({ w: z.number(), h: z.number() }).strict(),
  })
  .strict();

export function parseIncoming(raw: string): IncomingComment {
  return incomingCommentSchema.parse(JSON.parse(raw)) as IncomingComment;
}
