import { z } from "zod";
import { visualCaptureSchema } from "./capture/visual";
import { structureSchema } from "./capture/schema";
import {
  outline,
  inside,
  segmentsCross,
  geometryErrors,
  featureFootprint,
  extents,
  keptObjects,
} from "./capture/geometry";
import { bedSizeIds } from "./bedSizes";

const dimension = z.number().finite().min(1).max(3000);
const imageUri = z
  .string()
  .max(1_500_000)
  .refine(
    (v) => /^(data:image\/(jpeg|png|webp);base64,|sample:)/.test(v),
    "Unsupported image",
  );
export const itemSchema = z.object({
  id: z.string().max(100),
  name: z.string().trim().min(1).max(100),
  width: dimension,
  depth: dimension,
  height: dimension.nullable(),
  x: z.number().finite().min(-3000).max(6000),
  y: z.number().finite().min(-3000).max(6000),
  rotation: z.number().finite().min(0).max(359),
  kind: z.enum([
    "furniture",
    "fixed",
    "rug",
    "door",
    "window",
    "socket",
    "shelf",
  ]),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  hinge: z.enum(["left", "right"]).optional(),
  owned: z.boolean(),
  dimensionsConfirmed: z.boolean(),
  stage: z.enum(["layout", "product"]).optional(),
  archetype: z.string().max(100).optional(),
  bedSize: z.enum(bedSizeIds).optional(),
  wall: z.enum(["north", "east", "south", "west"]).optional(),
  price: z.number().finite().min(0).max(1_000_000).optional(),
  url: z
    .string()
    .max(2000)
    .refine((v) => !v || /^https?:\/\//i.test(v))
    .optional(),
  image: imageUri.optional(),
});
export const ideaSchema = z.object({
  id: z.string().max(100),
  image: imageUri,
  note: z.string().max(1000),
  role: z.enum([
    "Room photo",
    "Inspiration",
    "Colour",
    "Materials",
    "Keep this",
    "Include this",
  ]),
});
export const workSchema = z.object({
  id: z.string().max(100),
  title: z.string().trim().min(1).max(200),
  done: z.boolean(),
});
export const roomSchema = z.object({
  id: z.string().max(100),
  name: z.string().trim().min(1).max(100),
  width: dimension.min(50),
  depth: dimension.min(50),
  height: dimension.min(50).nullable(),
  wallColour: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  items: z.array(itemSchema).max(100),
  ideas: z.array(ideaSchema).max(30),
  brief: z.string().max(3000),
  forWhom: z.string().max(300).optional(),
  purpose: z.string().max(1500).optional(),
  journey: z.enum(["Ideas", "Rooms", "Reveal", "Works"]).optional(),
  works: z.array(workSchema).max(200),
  sample: z.boolean().default(false),
  updatedAt: z.string(),
  structure: structureSchema.optional(),
  visualCaptures: z.array(visualCaptureSchema).max(3).optional(),
  unit: z.enum(["cm", "in"]).optional(),
  createdAt: z.string().optional(),
  conversation: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(5000),
      }),
    )
    .max(40)
    .optional(),
  imported: z
    .object({
      source: z.string(),
      id: z.string(),
      fingerprint: z.string(),
      original: z.unknown(),
    })
    .optional(),
});
export const projectSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  householdTasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        done: z.boolean(),
        comment: z.string(),
        position: z.number(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
        imported: z
          .object({
            source: z.string(),
            id: z.string(),
            fingerprint: z.string(),
          })
          .optional(),
      }),
    )
    .max(2000)
    .optional(),
  rooms: z.array(roomSchema).max(50),
  activeRoomId: z.string().nullable(),
});
export type Furniture = z.infer<typeof itemSchema>;
export type Idea = z.infer<typeof ideaSchema>;
export type Room = z.infer<typeof roomSchema>;
export type Project = z.infer<typeof projectSchema>;
export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export const cm = (v: number | null) =>
  v === null ? "Unknown" : `${(v / 100).toFixed(2)} m`;
export const money = (v: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(v);

// Ported from Richie's Room Planner: centimetres, centre-origin items,
// clockwise rotation, and separating-axis overlap checks. No global state.
export function corners(it: Furniture) {
  const a = (it.rotation * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return [
    [-it.width / 2, -it.depth / 2],
    [it.width / 2, -it.depth / 2],
    [it.width / 2, it.depth / 2],
    [-it.width / 2, it.depth / 2],
  ].map(([x, y]) => ({ x: it.x + x * c - y * s, y: it.y + x * s + y * c }));
}
export function solid(it: Furniture) {
  return it.kind === "furniture" || it.kind === "fixed";
}
export function bounds(it: Furniture) {
  const points = corners(it);
  return {
    left: Math.min(...points.map((p) => p.x)),
    right: Math.max(...points.map((p) => p.x)),
    top: Math.min(...points.map((p) => p.y)),
    bottom: Math.max(...points.map((p) => p.y)),
  };
}
export function overlaps(a: Furniture, b: Furniture) {
  if (!solid(a) || !solid(b)) return false;
  const A = corners(a),
    B = corners(b);
  for (const p of [A, B])
    for (let i = 0; i < 2; i++) {
      const dx = p[i + 1].x - p[i].x,
        dy = p[i + 1].y - p[i].y,
        l = Math.hypot(dx, dy);
      const project = (q: { x: number; y: number }) =>
        (-dy * q.x + dx * q.y) / l;
      const ap = A.map(project),
        bp = B.map(project);
      if (
        Math.max(...ap) - 0.5 <= Math.min(...bp) ||
        Math.max(...bp) - 0.5 <= Math.min(...ap)
      )
        return false;
    }
  return true;
}
export function outside(
  it: Furniture,
  room: Pick<Room, "width" | "depth"> & Partial<Pick<Room, "structure">>,
) {
  const polygon = room.structure && outline(room.structure.current.geometry);
  if (polygon) {
    const points = corners(it);
    if (points.some((p) => !inside(p, polygon))) return true;
    for (let i = 0; i < points.length; i++)
      for (let j = 0; j < polygon.length; j++)
        if (
          segmentsCross(
            points[i],
            points[(i + 1) % points.length],
            polygon[j],
            polygon[(j + 1) % polygon.length],
          )
        )
          return true;
  }
  const b = bounds(it),
    m = 0;
  return (
    b.left < m - 0.01 ||
    b.top < m - 0.01 ||
    b.right > room.width - m + 0.01 ||
    b.bottom > room.depth - m + 0.01
  );
}
export function place(
  it: Furniture,
  x: number,
  y: number,
  room: Pick<Room, "width" | "depth">,
): Furniture {
  if (it.kind === "door" && it.wall) {
    const horizontal = it.wall === "north" || it.wall === "south";
    const length = horizontal ? room.width : room.depth;
    const centre = Math.max(
      it.width / 2,
      Math.min(length - it.width / 2, horizontal ? x : y),
    );
    return {
      ...it,
      rotation: horizontal ? 0 : 90,
      x: horizontal
        ? centre
        : it.wall === "west"
          ? it.depth / 2
          : room.width - it.depth / 2,
      y: horizontal
        ? it.wall === "north"
          ? it.depth / 2
          : room.depth - it.depth / 2
        : centre,
    };
  }
  const b = bounds({ ...it, x: 0, y: 0 }),
    hx = (b.right - b.left) / 2,
    hy = (b.bottom - b.top) / 2,
    m = 0;
  // Oversized pieces stay centred and visibly flagged. Never silently shrink them.
  return {
    ...it,
    x:
      hx * 2 > room.width - 2 * m
        ? room.width / 2
        : Math.max(hx + m, Math.min(room.width - hx - m, x)),
    y:
      hy * 2 > room.depth - 2 * m
        ? room.depth / 2
        : Math.max(hy + m, Math.min(room.depth - hy - m, y)),
  };
}
export function issues(room: Room) {
  const result: { ids: string[]; message: string }[] = [];
  const items = room.structure
    ? [
        ...room.items.filter(
          (i) => !["door", "window", "fixed"].includes(i.kind),
        ),
        ...keptObjects(room.structure.current),
      ]
    : room.items;
  items.forEach((it, i) => {
    if (room.structure && solid(it))
      for (const f of room.structure.current.geometry.features) {
        if (f.kind === "door" || f.kind === "window" || f.kind === "opening")
          continue;
        const footprint = featureFootprint(room.structure.current.geometry, f);
        if (
          !footprint ||
          (f.base.value !== null &&
            it.height !== null &&
            it.height <= f.base.value)
        )
          continue;
        const points = corners(it);
        if (
          points.some((p) => inside(p, footprint)) ||
          footprint.some((p) => inside(p, points)) ||
          points.some((a, i) =>
            footprint.some((c, j) =>
              segmentsCross(a, points[(i + 1) % 4], c, footprint[(j + 1) % 4]),
            ),
          )
        )
          result.push({
            ids: [it.id, f.id],
            message: `${it.name} meets the ${f.kind} footprint. Check its height and projection.`,
          });
      }
    if (outside(it, room))
      result.push({
        ids: [it.id],
        message: `${it.name} extends beyond the room.`,
      });
    items.slice(i + 1).forEach((b) => {
      if (overlaps(it, b))
        result.push({
          ids: [it.id, b.id],
          message: `${it.name} overlaps ${b.name.toLowerCase()}.`,
        });
    });
  });
  return result;
}
export function blankRoom(
  name: string,
  width: number,
  depth: number,
  height: number,
): Room {
  return {
    id: newId(),
    name,
    width,
    depth,
    height,
    wallColour: "#E4DFD5",
    items: [],
    ideas: [],
    brief: "",
    works: [],
    sample: false,
    updatedAt: new Date().toISOString(),
  };
}
export function sampleRoom(): Room {
  const room = blankRoom("Living room", 420, 350, 280);
  room.sample = true;
  room.brief = "Warm colours. Chrome details. Keep the sofa.";
  room.items = [
    {
      id: newId(),
      name: "Olive sofa",
      width: 210,
      depth: 90,
      height: 80,
      x: 290,
      y: 72,
      rotation: 0,
      kind: "furniture",
      colour: "#65674A",
      owned: true,
      dimensionsConfirmed: true,
    },
    {
      id: newId(),
      name: "Lounge chair",
      width: 78,
      depth: 84,
      height: 76,
      x: 80,
      y: 205,
      rotation: 0,
      kind: "furniture",
      colour: "#A64B32",
      owned: false,
      dimensionsConfirmed: true,
      image: "sample:chair",
    },
    {
      id: newId(),
      name: "Coffee table",
      width: 110,
      depth: 65,
      height: 38,
      x: 260,
      y: 215,
      rotation: 0,
      kind: "furniture",
      colour: "#C6B99F",
      owned: false,
      dimensionsConfirmed: true,
    },
    {
      id: newId(),
      name: "Window",
      width: 160,
      depth: 8,
      height: 170,
      x: 4,
      y: 125,
      rotation: 90,
      kind: "window",
      colour: "#97AFB0",
      owned: true,
      dimensionsConfirmed: true,
    },
  ];
  room.ideas = [
    {
      id: newId(),
      image: "sample:room",
      role: "Inspiration",
      note: "Warm colours and natural light",
    },
    {
      id: newId(),
      image: "sample:chair",
      role: "Include this",
      note: "A sculptural chair in rust",
    },
  ];
  room.works = [
    { id: newId(), title: "Confirm the layout", done: true },
    { id: newId(), title: "Choose wall paint", done: false },
    { id: newId(), title: "Paint the room", done: false },
  ];
  return room;
}
export function initialProject(): Project {
  const room = sampleRoom();
  return { version: 1, rooms: [room], activeRoomId: room.id };
}
export function parseProject(raw: string): Project {
  if (raw.length > 100_000_000)
    throw new Error(
      "This backup is too large. Keep the portable backup below 100 MB.",
    );
  const p = projectSchema.parse(JSON.parse(raw));
  const taskIds = (p.householdTasks ?? []).map((t) => t.id);
  if (new Set(taskIds).size !== taskIds.length)
    throw new Error("Duplicate household task IDs in backup.");
  const ids = p.rooms.map((r) => r.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate room IDs in backup.");
  for (const r of p.rooms)
    for (const items of [r.items, r.ideas, r.works]) {
      if (new Set(items.map((i) => i.id)).size !== items.length)
        throw new Error("Duplicate item IDs in backup.");
    }
  for (const room of p.rooms) {
    if (!room.structure) continue;
    const current = room.structure.current;
    const size = extents(current.geometry);
    if (
      geometryErrors(current.geometry).length ||
      !current.reviewedAt ||
      !current.geometry.orientationConfirmed ||
      !current.geometry.measurementsReviewed ||
      current.furnitureDecision === "undecided" ||
      Math.abs(size.width - room.width) > 0.01 ||
      Math.abs(size.depth - room.depth) > 0.01 ||
      current.geometry.ceilingHeight.value !== room.height
    )
      throw new Error(
        "The saved reviewed geometry is inconsistent with the room dimensions.",
      );
    for (const capture of [current, ...room.structure.history]) {
      for (const elements of [
        capture.geometry.walls,
        capture.geometry.features,
        ...(capture.original
          ? [
              capture.original.walls,
              capture.original.doors,
              capture.original.windows,
              capture.original.openings,
              capture.original.objects,
            ]
          : []),
      ])
        if (new Set(elements.map((e) => e.id)).size !== elements.length)
          throw new Error("Duplicate capture element IDs.");
      if (
        capture.keptObjectIds.some(
          (id) => !capture.original?.objects.some((o) => o.id === id),
        )
      )
        throw new Error("Kept furniture is missing from the original scan.");
    }
  }
  return {
    ...p,
    activeRoomId: p.rooms.some((r) => r.id === p.activeRoomId)
      ? p.activeRoomId
      : (p.rooms[0]?.id ?? null),
  };
}

// Older backups predate stages; preserve their attached product details.
export function isSpecified(item: Furniture) {
  return item.stage
    ? item.stage === "product"
    : Boolean(item.url || item.image || item.price !== undefined);
}
export const basicFurniture = [
  { name: "Office chair", width: 65, depth: 65, height: 110 },
  { name: "Bed", width: 150, depth: 210, height: 100 },
  { name: "Cupboard", width: 100, depth: 45, height: 90 },
  { name: "Wardrobe", width: 120, depth: 60, height: 200 },
  { name: "Sofa", width: 210, depth: 90, height: 80 },
  { name: "Armchair", width: 80, depth: 85, height: 80 },
  { name: "Dining table", width: 160, depth: 90, height: 75 },
  { name: "Desk", width: 120, depth: 60, height: 75 },
  { name: "Coffee table", width: 110, depth: 60, height: 40 },
];

// Snap the item centre to a 10 cm grid; nearby wall positions take priority.
// Use rotated extents and the same wall allowance as ordinary placement.
export function snapPlacement(
  it: Furniture,
  x: number,
  y: number,
  room: Pick<Room, "width" | "depth">,
): Furniture {
  const b = bounds({ ...it, x: 0, y: 0 }),
    margin = 0;
  const axis = (value: number, half: number, length: number) => {
    const min = half + margin,
      max = length - half - margin;
    if (min > max) return length / 2;
    const edge = Math.abs(value - min) <= Math.abs(value - max) ? min : max;
    return Math.abs(value - edge) <= 6 ? edge : Math.round(value / 10) * 10;
  };
  return place(
    it,
    axis(x, (b.right - b.left) / 2, room.width),
    axis(y, (b.bottom - b.top) / 2, room.depth),
    room,
  );
}

export function nearestWall(
  it: Furniture,
  room: Pick<Room, "width" | "depth">,
): NonNullable<Furniture["wall"]> {
  if (it.wall) return it.wall;
  const candidates: [NonNullable<Furniture["wall"]>, number][] = [
    ["north", it.y],
    ["south", room.depth - it.y],
    ["west", it.x],
    ["east", room.width - it.x],
  ];
  return candidates.sort((a, b) => a[1] - b[1])[0][0];
}
export function doorGeometry(
  it: Furniture,
  room: Pick<Room, "width" | "depth">,
): {
  hinge: { x: number; y: number };
  closed: { x: number; y: number };
  open: { x: number; y: number };
} {
  const wall = nearestWall(it, room),
    w = it.width;
  if (it.hinge && !it.wall) {
    const a = (it.rotation * Math.PI) / 180,
      c = Math.cos(a),
      s = Math.sin(a),
      hx = it.hinge === "right" ? w / 2 : -w / 2;
    const point = (x: number, y: number) => ({
      x: it.x + c * x - s * y,
      y: it.y + s * x + c * y,
    });
    return { hinge: point(hx, 0), closed: point(-hx, 0), open: point(hx, -w) };
  }
  if (it.hinge === "right") {
    const base = doorGeometry({ ...it, hinge: "left" }, room);
    const mirror = (p: { x: number; y: number }) =>
      wall === "north" || wall === "south"
        ? { x: 2 * it.x - p.x, y: p.y }
        : { x: p.x, y: 2 * it.y - p.y };
    return {
      hinge: mirror(base.hinge),
      closed: mirror(base.closed),
      open: mirror(base.open),
    };
  }
  if (wall === "north")
    return {
      hinge: { x: it.x - w / 2, y: 0 },
      closed: { x: it.x + w / 2, y: 0 },
      open: { x: it.x - w / 2, y: w },
    };
  if (wall === "south")
    return {
      hinge: { x: it.x + w / 2, y: room.depth },
      closed: { x: it.x - w / 2, y: room.depth },
      open: { x: it.x + w / 2, y: room.depth - w },
    };
  if (wall === "east")
    return {
      hinge: { x: room.width, y: it.y - w / 2 },
      closed: { x: room.width, y: it.y + w / 2 },
      open: { x: room.width - w, y: it.y - w / 2 },
    };
  return {
    hinge: { x: 0, y: it.y + w / 2 },
    closed: { x: 0, y: it.y - w / 2 },
    open: { x: w, y: it.y + w / 2 },
  };
}
