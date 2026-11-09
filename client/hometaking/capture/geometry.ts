import {
  Capture,
  Geometry,
  Point,
  Scan,
  scanSchema,
  captureSchema,
} from "./schema";
import type { Room } from "../model";
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function extents(g: Geometry) {
  const points = g.walls.flatMap((w) => [w.a, w.b]);
  return {
    width: Math.max(...points.map((p) => p.x)),
    depth: Math.max(...points.map((p) => p.y)),
  };
}
export function rectangle(
  width: number,
  depth: number,
  height: number | null,
): Geometry {
  const points = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: depth },
    { x: 0, y: depth },
  ];
  return {
    version: 1,
    units: "cm",
    walls: points.map((a, i) => ({
      id: `manual-wall-${i}`,
      a,
      b: points[(i + 1) % 4],
      height: { value: height, source: "inferred" },
      source: "inferred",
    })),
    features: [],
    ceilingHeight: { value: height, source: "inferred" },
    notes: "",
    orientationConfirmed: false,
    measurementsReviewed: false,
    frame: { rotation: 0, originX: 0, originZ: 0, floorY: 0 },
  };
}
export function convertScan(input: Scan): Capture {
  const scan = scanSchema.parse(input);
  if (scan.walls.some((w) => w.curved))
    throw new Error(
      "This scan contains curved walls. The original is retained on the device. Use manual measurements for this pilot; curved-wall conversion is not supported yet.",
    );
  const longest = [...scan.walls].sort(
    (a, b) => b.dimensions[0] - a.dimensions[0],
  )[0];
  const angle = -Math.atan2(longest.transform[2], longest.transform[0]);
  const rotate = (x: number, z: number) => ({
    x: 100 * (x * Math.cos(angle) - z * Math.sin(angle)),
    y: 100 * (x * Math.sin(angle) + z * Math.cos(angle)),
  });
  const ends = (e: Scan["walls"][number]) =>
    [-1, 1].map((sign) =>
      rotate(
        e.transform[12] + (sign * e.transform[0] * e.dimensions[0]) / 2,
        e.transform[14] + (sign * e.transform[2] * e.dimensions[0]) / 2,
      ),
    );
  const pts = scan.walls.flatMap(ends),
    ox = Math.min(...pts.map((p) => p.x)),
    oz = Math.min(...pts.map((p) => p.y));
  const point = (p: Point) => ({
    x: Math.round((p.x - ox) * 100) / 100,
    y: Math.round((p.y - oz) * 100) / 100,
  });
  const floorY = Math.min(
    ...scan.walls.map((w) => w.transform[13] - w.dimensions[1] / 2),
  );
  const height = Math.max(...scan.walls.map((w) => w.dimensions[1] * 100));
  const geometry: Geometry = {
    version: 1,
    units: "cm",
    walls: scan.walls.map((w) => ({
      id: w.id,
      a: point(ends(w)[0]),
      b: point(ends(w)[1]),
      height: { value: w.dimensions[1] * 100, source: "detected" },
      source: "detected",
      confidence: w.confidence,
    })),
    features: (["doors", "windows", "openings"] as const).flatMap((key) =>
      scan[key].map((e) => ({
        id: e.id,
        kind: (
          { doors: "door", windows: "window", openings: "opening" } as const
        )[key],
        a: point(ends(e)[0]),
        b: point(ends(e)[1]),
        height: { value: e.dimensions[1] * 100, source: "detected" as const },
        base: { value: null, source: "inferred" as const },
        projection: { value: null, source: "inferred" as const },
        source: "detected" as const,
        note: "Check against the room. Base/sill height and swing are not confirmed by scanning.",
        swing: "unknown" as const,
      })),
    ),
    ceilingHeight: { value: height, source: "inferred" },
    notes:
      "Check ceiling slopes, bulkheads, radiators, sill heights and door swings manually. Wall height is not a verified ceiling measurement.",
    orientationConfirmed: false,
    measurementsReviewed: false,
    frame: { rotation: angle, originX: ox, originZ: oz, floorY },
  };
  return {
    original: scan,
    geometry,
    furnitureDecision: "undecided",
    keptObjectIds: [],
  };
}
// Reconstruct wall topology by endpoint proximity, never angle-sort concave rooms.
export function outline(g: Geometry): Point[] | null {
  const remaining = g.walls.map((w) => ({ a: { ...w.a }, b: { ...w.b } }));
  const first = remaining.shift()!;
  const points = [first.a, first.b];
  while (remaining.length) {
    const end = points[points.length - 1];
    const candidates = remaining
      .flatMap((w, i) => [
        { i, reverse: false, d: distance(end, w.a) },
        { i, reverse: true, d: distance(end, w.b) },
      ])
      .filter((c) => c.d <= 15);
    if (candidates.length !== 1) return null;
    const c = candidates[0],
      w = remaining.splice(c.i, 1)[0];
    points.push(c.reverse ? w.a : w.b);
  }
  if (distance(points[points.length - 1], points[0]) > 15) return null;
  return points.slice(0, -1);
}
function cross(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
export function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  return (
    cross(a, b, c) * cross(a, b, d) < -0.0001 &&
    cross(c, d, a) * cross(c, d, b) < -0.0001
  );
}
export function geometryErrors(g: Geometry): string[] {
  const errors: string[] = [];
  const { width, depth } = extents(g);
  if (
    ![width, depth, g.ceilingHeight.value ?? 0].every(
      (v) => Number.isFinite(v) && v >= 50 && v <= 3000,
    )
  )
    errors.push(
      "Room bounds and ceiling height must be between 50 and 3000 cm.",
    );
  if (
    g.walls.some(
      (w) =>
        distance(w.a, w.b) < 1 || [w.a, w.b].some((p) => p.x < 0 || p.y < 0),
    )
  )
    errors.push(
      "Walls need positive lengths and non-negative plan coordinates.",
    );
  const ends = g.walls.flatMap((w) => [w.a, w.b]);
  if (
    Math.abs(Math.min(...ends.map((p) => p.x))) > 0.01 ||
    Math.abs(Math.min(...ends.map((p) => p.y))) > 0.01
  )
    errors.push(
      "Keep the plan origin at the top left: the smallest wall x and y coordinates must each be zero.",
    );
  const poly = outline(g);
  if (!poly)
    errors.push(
      "Connect the wall ends to form one closed room (maximum join gap 15 cm).",
    );
  else {
    for (let i = 0; i < poly.length; i++)
      for (let j = i + 1; j < poly.length; j++)
        if (
          segmentsCross(
            poly[i],
            poly[(i + 1) % poly.length],
            poly[j],
            poly[(j + 1) % poly.length],
          )
        )
          errors.push(
            "The room outline crosses itself. Correct the wall ends.",
          );
    const area =
      Math.abs(
        poly.reduce(
          (sum, p, i) =>
            sum +
            p.x * poly[(i + 1) % poly.length].y -
            p.y * poly[(i + 1) % poly.length].x,
          0,
        ),
      ) / 2;
    if (area < 2500) errors.push("The room outline has no usable floor area.");
  }
  return [...new Set(errors)];
}
export function inside(p: Point, polygon: Point[]) {
  let yes = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      Math.abs(cross(a, b, p)) < 0.01 &&
      p.x >= Math.min(a.x, b.x) - 0.01 &&
      p.x <= Math.max(a.x, b.x) + 0.01 &&
      p.y >= Math.min(a.y, b.y) - 0.01 &&
      p.y <= Math.max(a.y, b.y) + 0.01
    )
      return true;
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      yes = !yes;
  }
  return yes;
}
export function rotateCapture(c: Capture): Capture {
  const { depth } = extents(c.geometry);
  const p = (a: Point) => ({ x: depth - a.y, y: a.x });
  return {
    ...c,
    geometry: {
      ...c.geometry,
      walls: c.geometry.walls.map((w) => ({ ...w, a: p(w.a), b: p(w.b) })),
      features: c.geometry.features.map((f) => ({
        ...f,
        a: p(f.a),
        b: p(f.b),
      })),
      orientationConfirmed: false,
      frame: {
        ...c.geometry.frame,
        rotation: c.geometry.frame.rotation + Math.PI / 2,
        originX: depth + c.geometry.frame.originZ,
        originZ: -c.geometry.frame.originX,
      },
    },
  };
}
export function applyCapture(room: Room, capture: Capture): Room {
  capture = captureSchema.parse(capture);
  const errors = geometryErrors(capture.geometry);
  if (errors.length) throw new Error(errors.join(" "));
  if (
    !capture.geometry.orientationConfirmed ||
    !capture.geometry.measurementsReviewed ||
    capture.furnitureDecision === "undecided"
  )
    throw new Error(
      "Review measurements, orientation and what furniture stays before saving.",
    );
  const history = room.structure
    ? [...room.structure.history, room.structure.current]
    : [
        {
          geometry: geometryForRoom(room),
          furnitureDecision: "undecided" as const,
          keptObjectIds: [],
        },
      ];
  if (history.length > 20)
    throw new Error(
      "This room has 20 capture revisions. Export a backup before starting a separate room record.",
    );
  const current = { ...capture, reviewedAt: new Date().toISOString() };
  return {
    ...room,
    ...extents(capture.geometry),
    height: capture.geometry.ceilingHeight.value!,
    structure: {
      current,
      history,
      previousDimensions: room.structure?.previousDimensions ?? {
        width: room.width,
        depth: room.depth,
        height: room.height,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}
// Portable handoff for future Blender ingestion. This is the same reviewed geometry the planner draws.
export function geometryForRoom(room: Room): Geometry {
  if (room.structure) return room.structure.current.geometry;
  const g = rectangle(room.width, room.depth, room.height);
  g.features = room.items
    .filter((i) => ["door", "window", "fixed"].includes(i.kind))
    .map((i) => {
      const a = (i.rotation * Math.PI) / 180,
        dx = (Math.cos(a) * i.width) / 2,
        dy = (Math.sin(a) * i.width) / 2;
      return {
        id: i.id,
        kind: i.kind === "fixed" ? "other" : (i.kind as "door" | "window"),
        a: { x: i.x - dx, y: i.y - dy },
        b: { x: i.x + dx, y: i.y + dy },
        height: {
          value: i.height,
          source: i.dimensionsConfirmed ? "user-confirmed" : "inferred",
        },
        base: { value: null, source: "inferred" },
        projection: {
          value: i.depth,
          source: i.dimensionsConfirmed ? "user-confirmed" : "inferred",
        },
        source: "inferred",
        note: `Preserved from the previous plan: ${i.name}. Verify wall attachment, base height and swing.`,
        swing: "unknown",
      };
    });
  return g;
}
export function keptObjects(c: Capture) {
  const f = c.geometry.frame;
  return (c.furnitureDecision === "choose" ? (c.original?.objects ?? []) : [])
    .filter((o) => c.keptObjectIds.includes(o.id))
    .map((o) => {
      const t = o.transform,
        a = f.rotation;
      return {
        id: `scan-${o.id}`,
        name: `Existing ${o.category}`,
        x: 100 * (t[12] * Math.cos(a) - t[14] * Math.sin(a)) - f.originX,
        y: 100 * (t[12] * Math.sin(a) + t[14] * Math.cos(a)) - f.originZ,
        width: o.dimensions[0] * 100,
        depth: o.dimensions[2] * 100,
        height: o.dimensions[1] * 100,
        rotation: (((Math.atan2(t[2], t[0]) + a) * 180) / Math.PI + 720) % 360,
        kind: "furniture" as const,
        colour: "#B4AD98",
        owned: true,
        dimensionsConfirmed: false,
      };
    });
}

// Fixed-feature footprint extends towards the room interior. This direction is inferred;
// the review retains endpoints and explicit measured projection independently.
export function featureFootprint(
  g: Geometry,
  f: Geometry["features"][number],
): Point[] | null {
  const length = distance(f.a, f.b),
    depth = f.projection.value;
  if (!depth || length < 1) return null;
  const poly = outline(g);
  if (!poly) return null;
  let nx = -(f.b.y - f.a.y) / length,
    ny = (f.b.x - f.a.x) / length;
  const mid = { x: (f.a.x + f.b.x) / 2, y: (f.a.y + f.b.y) / 2 };
  if (
    !inside({ x: mid.x + (nx * depth) / 2, y: mid.y + (ny * depth) / 2 }, poly)
  ) {
    nx = -nx;
    ny = -ny;
  }
  return [
    f.a,
    f.b,
    { x: f.b.x + nx * depth, y: f.b.y + ny * depth },
    { x: f.a.x + nx * depth, y: f.a.y + ny * depth },
  ];
}
