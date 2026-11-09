import { z } from "zod";
const n = z.number().finite().min(-10000).max(10000);
export const pointSchema = z.object({ x: n, y: n });
export const evidenceSchema = z.enum([
  "detected",
  "inferred",
  "user-confirmed",
]);
const measurement = z.object({
  value: z.number().finite().min(0).max(3000).nullable(),
  source: evidenceSchema,
});
export const wallSchema = z.object({
  id: z.string().max(100),
  a: pointSchema,
  b: pointSchema,
  height: measurement,
  source: evidenceSchema,
  confidence: z.string().max(30).optional(),
});
export const featureSchema = z.object({
  id: z.string().max(100),
  kind: z.enum([
    "door",
    "window",
    "opening",
    "radiator",
    "bulkhead",
    "ceiling-slope",
    "other",
  ]),
  a: pointSchema,
  b: pointSchema,
  height: measurement,
  base: measurement,
  projection: measurement,
  source: evidenceSchema,
  note: z.string().max(1000),
  swing: z.enum([
    "unknown",
    "inward-left",
    "inward-right",
    "outward-left",
    "outward-right",
    "sliding",
  ]),
});
export const geometrySchema = z.object({
  version: z.literal(1),
  units: z.literal("cm"),
  walls: z.array(wallSchema).min(3).max(100),
  features: z.array(featureSchema).max(150),
  ceilingHeight: measurement,
  notes: z.string().max(3000),
  orientationConfirmed: z.boolean(),
  measurementsReviewed: z.boolean(),
  // XZ plane mapped to screen XY, never a photograph-derived floor angle.
  frame: z.object({ rotation: n, originX: n, originZ: n, floorY: n }),
});
const scanElement = z.object({
  id: z.string().max(100),
  category: z.string().max(100),
  dimensions: z.array(z.number().finite().min(0).max(30)).length(3),
  transform: z.array(z.number().finite()).length(16),
  confidence: z.string().max(30),
  curved: z.boolean().optional(),
});
export const scanSchema = z.object({
  id: z.string().max(100),
  capturedAt: z.string(),
  provider: z.literal("apple-roomplan"),
  raw: z.string().max(2_000_000),
  walls: z.array(scanElement).min(3).max(100),
  doors: z.array(scanElement).max(100),
  windows: z.array(scanElement).max(100),
  openings: z.array(scanElement).max(100),
  objects: z.array(scanElement).max(100),
});
export const captureSchema = z.object({
  original: scanSchema.optional(),
  geometry: geometrySchema,
  furnitureDecision: z.enum(["undecided", "all-going", "choose"]),
  keptObjectIds: z.array(z.string().max(100)).max(100),
  reviewedAt: z.string().optional(),
});
export const structureSchema = z.object({
  current: captureSchema,
  history: z.array(captureSchema).max(20),
  previousDimensions: z.object({ width: n, depth: n, height: n.nullable() }),
});
export type Geometry = z.infer<typeof geometrySchema>;
export type Capture = z.infer<typeof captureSchema>;
export type Scan = z.infer<typeof scanSchema>;
export type Point = z.infer<typeof pointSchema>;
export type Feature = z.infer<typeof featureSchema>;
