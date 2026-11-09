import { z } from "zod";
// A separate capture coordinate system. Never substitute it for reviewed walls.
export const visualCaptureSchema = z.object({
  id: z.string().uuid(),
  capturedAt: z.string(),
  provider: z.literal("arkit-camera-mesh"),
  alignment: z.literal("independent"),
  quality: z.literal("unverified"),
  photoCount: z.number().int().min(1).max(80),
  triangleCount: z.number().int().min(1).max(500000),
  texturedTriangleCount: z.number().int().min(0).max(500000),
  chunks: z.array(z.string().min(1).max(2_000_000)).min(1).max(30),
});
export type VisualCapture = z.infer<typeof visualCaptureSchema>;
export function packVisual(raw: string): VisualCapture {
  if (raw.length > 60_000_000)
    throw new Error(
      "The visual scan exceeds the device backup limit. The native recovery copy is retained.",
    );
  const d = JSON.parse(raw);
  if (
    d.version !== 1 ||
    d.units !== "metres" ||
    d.texturedTriangleCount > d.triangleCount
  )
    throw new Error("Unsupported visual capture format.");
  return visualCaptureSchema.parse({
    id: d.id,
    capturedAt: d.capturedAt,
    provider: "arkit-camera-mesh",
    alignment: "independent",
    quality: "unverified",
    photoCount: d.photos?.length,
    triangleCount: d.triangleCount,
    texturedTriangleCount: d.texturedTriangleCount,
    chunks: raw.match(/[\s\S]{1,2000000}/g),
  });
}
