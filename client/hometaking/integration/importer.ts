import { z } from "zod";
import { Project, Room, roomSchema } from "../model";

// Canonical serialisation is also used to detect edits after a proposal/import.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map(
        (k) =>
          `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
const oldItem = z
  .object({
    id: z.string(),
    name: z.string().min(1),
    w: z.number().positive(),
    d: z.number().positive(),
    x: z.number().finite(),
    y: z.number().finite(),
    rot: z.number().finite(),
    kind: z.enum([
      "furniture",
      "fixed",
      "rug",
      "door",
      "window",
      "socket",
      "shelf",
    ]),
    owned: z.boolean().optional(),
    price: z.number().nonnegative().optional(),
    hinge: z.enum(["left", "right"]).optional(),
  })
  .passthrough();
const oldRoom = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    unit: z.enum(["cm", "in"]).optional(),
    room: z
      .object({ w: z.number().positive(), d: z.number().positive() })
      .optional(),
    width: z.coerce.number().positive().optional(),
    depth: z.coerce.number().positive().optional(),
    items: z.array(oldItem),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough();
export type ImportEntry = {
  room: Room;
  status: "new" | "unchanged" | "changed";
  existingId?: string;
};
export type ImportPreview = {
  source: string;
  entries: ImportEntry[];
  tasks: NonNullable<Project["householdTasks"]>;
  taskChanges: { id: string; title: string }[];
};
export function previewImport(
  raw: unknown,
  project: Project,
  source = "room-planner-file",
): ImportPreview {
  const data = z
    .object({
      rooms: z.array(z.unknown()).optional(),
      tasks: z.array(z.unknown()).optional(),
    })
    .passthrough()
    .parse(raw);
  const entries = (data.rooms ?? [raw]).map((value) => {
    const r = oldRoom.parse(value);
    const fingerprint = canonical(r);
    // Files without IDs use their complete content; names alone never identify a room.
    const sourceId = r.id ?? fingerprint;
    const existing = project.rooms.find(
      (x) => x.imported?.source === source && x.imported.id === sourceId,
    );
    let id = existing?.id ?? r.id ?? `import-${fingerprintHash(fingerprint)}`;
    if (!existing && project.rooms.some((x) => x.id === id))
      id = `import-${fingerprintHash(source + sourceId)}`;
    const room = roomSchema.parse({
      id,
      name: r.name,
      width: r.room?.w ?? r.width,
      depth: r.room?.d ?? r.depth,
      height: null,
      unit: r.unit ?? "cm",
      wallColour: "#F1EDE4",
      items: r.items.map((i) => ({
        id: i.id,
        name: i.name,
        width: i.w,
        depth: i.d,
        height: null,
        x: i.x,
        y: i.y,
        rotation: ((i.rot % 360) + 360) % 360,
        kind: i.kind,
        owned: i.owned ?? false,
        price: i.price,
        hinge: i.hinge,
        colour: "#C9C3B8",
        dimensionsConfirmed: false,
      })),
      ideas: [],
      brief: "",
      works: [],
      sample: false,
      createdAt: r.created_at ?? r.createdAt,
      updatedAt: r.updated_at ?? r.updatedAt ?? new Date().toISOString(),
      imported: { source, id: sourceId, fingerprint, original: r },
    });
    return {
      room: JSON.parse(JSON.stringify(room)),
      status: existing
        ? existing.imported!.fingerprint === fingerprint
          ? "unchanged"
          : "changed"
        : "new",
      existingId: existing?.id,
    } as ImportEntry;
  });
  const tasks = (data.tasks ?? []).map((rawTask) => {
    const t = z
      .object({
        id: z.string(),
        body: z.string().optional(),
        text: z.string().optional(),
        done: z.boolean(),
        comment: z.string().optional(),
        position: z.number().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
      })
      .passthrough()
      .parse(rawTask);
    return {
      id: t.id,
      title: t.body ?? t.text ?? "",
      done: t.done,
      comment: t.comment ?? "",
      position: t.position ?? 0,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      imported: { source, id: t.id, fingerprint: canonical(t) },
    };
  });
  return {
    source,
    entries,
    tasks: JSON.parse(JSON.stringify(tasks)),
    taskChanges: tasks
      .filter(
        (t) =>
          (project.householdTasks ?? []).some(
            (x) =>
              x.imported?.source === source &&
              x.imported?.id === t.id &&
              x.imported?.fingerprint !== t.imported.fingerprint,
          ) &&
          !(project.householdTasks ?? []).some(
            (x) =>
              x.imported?.source === source &&
              x.imported?.id === t.id &&
              x.imported?.fingerprint === t.imported.fingerprint,
          ),
      )
      .map((t) => ({ id: t.id, title: t.title })),
  };
}
function fingerprintHash(s: string) {
  let a = 2166136261;
  for (let i = 0; i < s.length; i++)
    a = Math.imul(a ^ s.charCodeAt(i), 16777619);
  return (a >>> 0).toString(16);
}
export function applyImport(
  project: Project,
  preview: ImportPreview,
  choices: Record<string, "keep" | "copy"> = {},
): Project {
  const rooms = [...project.rooms];
  for (const entry of preview.entries) {
    if (entry.status === "unchanged") continue;
    if (entry.status === "changed" && !choices[entry.room.id])
      throw new Error(
        "Choose keep or import as a separate room for each changed source room.",
      );
    if (entry.status === "changed" && choices[entry.room.id] === "keep")
      continue;
    let r = entry.room;
    // Changed imports become a separate version. Keep all existing edits/references.
    if (entry.status === "changed")
      r = {
        ...r,
        id: `${r.id}-${fingerprintHash(r.imported!.fingerprint)}`,
        name: `${r.name} (imported revision)`,
      };
    if (
      rooms.some(
        (x) =>
          x.imported?.source === r.imported?.source &&
          x.imported?.id === r.imported?.id &&
          x.imported?.fingerprint === r.imported?.fingerprint,
      )
    )
      continue;
    while (rooms.some((x) => x.id === r.id)) r = { ...r, id: r.id + "-copy" };
    rooms.push(r);
  }
  const tasks = [...(project.householdTasks ?? [])];
  for (const t of preview.tasks) {
    const same = tasks.find(
      (x) =>
        x.imported?.source === t.imported?.source &&
        x.imported?.id === t.imported?.id &&
        x.imported?.fingerprint === t.imported?.fingerprint,
    );
    if (same) continue;
    if (preview.taskChanges.some((c) => c.id === t.id)) {
      const choice = choices[`task:${t.id}`];
      if (!choice)
        throw new Error("Choose how to handle changed household tasks.");
      if (choice === "keep") continue;
    }
    const id = tasks.some((x) => x.id === t.id)
      ? `${t.id}-${fingerprintHash(t.imported!.fingerprint)}`
      : t.id;
    tasks.push({ ...t, id });
  }
  return {
    ...project,
    version: 2,
    rooms,
    householdTasks: tasks,
    activeRoomId: project.activeRoomId ?? rooms[0]?.id ?? null,
  };
}

// A migration may append backed-up imports to the local preview server while a
// browser still holds its previous revision. Accept additions only if every
// existing room/task is byte-equivalent in canonical JSON. Otherwise conflict.
export function additiveImport(
  local: Project,
  remote: Project,
): Project | null {
  if (
    !local.rooms.every((r) =>
      remote.rooms.some((x) => x.id === r.id && canonical(x) === canonical(r)),
    )
  )
    return null;
  const added = remote.rooms.filter(
    (r) => !local.rooms.some((x) => x.id === r.id),
  );
  if (!added.every((r) => !!r.imported)) return null;
  if (
    !(local.householdTasks ?? []).every((t) =>
      (remote.householdTasks ?? []).some(
        (x) => x.id === t.id && canonical(x) === canonical(t),
      ),
    )
  )
    return null;
  if (
    !(remote.householdTasks ?? [])
      .filter((t) => !(local.householdTasks ?? []).some((x) => x.id === t.id))
      .every((t) => !!t.imported)
  )
    return null;
  return { ...remote, activeRoomId: local.activeRoomId };
}
