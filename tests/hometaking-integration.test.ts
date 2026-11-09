import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import {
  blankRoom,
  parseProject,
  Project,
  corners,
} from "../client/hometaking/model";
import {
  previewImport,
  applyImport,
  canonical,
} from "../client/hometaking/integration/importer";
import { reconcile } from "../client/hometaking/integration/sync";
import {
  applyProposal,
  roomRevision,
  Proposal,
} from "../client/hometaking/integration/proposals";
import { resizeCorner } from "../client/hometaking/integration/editing";
const empty: Project = { version: 1, rooms: [], activeRoomId: null };
const old = {
  id: "old-room",
  name: "Old",
  unit: "in",
  room: { w: 420, d: 350 },
  items: [
    {
      id: "bed",
      name: "Bed",
      w: 90,
      d: 190,
      x: 95,
      y: 150,
      rot: 90,
      kind: "furniture",
      owned: true,
      price: 123.45,
    },
    {
      id: "socket",
      name: "Socket",
      w: 15,
      d: 3,
      x: 200,
      y: 1.5,
      rot: 0,
      kind: "socket",
      owned: false,
    },
  ],
};
test("legacy import preserves centre coordinates, units, ownership, precision and unknown heights", () => {
  const p = applyImport(empty, previewImport(old, empty));
  assert.equal(p.rooms[0].unit, "in");
  assert.equal(p.rooms[0].height, null);
  assert.equal(p.rooms[0].items[0].x, 95);
  assert.equal(p.rooms[0].items[0].rotation, 90);
  assert.equal(p.rooms[0].items[0].price, 123.45);
  assert.equal(p.rooms[0].items[1].kind, "socket");
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
});
test("reimport is idempotent and changed source requires choice, preserving edits", () => {
  let p = applyImport(empty, previewImport(old, empty));
  p.rooms[0].brief = "Keep my edited brief";
  assert.deepEqual(applyImport(p, previewImport(old, p)), p);
  const changed = { ...old, room: { w: 430, d: 350 } };
  const preview = previewImport(changed, p);
  assert.throws(() => applyImport(p, preview));
  const next = applyImport(p, preview, { [p.rooms[0].id]: "copy" });
  assert.equal(next.rooms.length, 2);
  assert.equal(next.rooms[0].brief, "Keep my edited brief");
  assert.equal(next.rooms[0].width, 420);
  assert.deepEqual(
    applyImport(next, previewImport(changed, next), {
      [p.rooms[0].id]: "copy",
    }),
    next,
  );
});
test("same names are not merged and collisions retain source ID", () => {
  const r = blankRoom("Old", 500, 400, 240);
  r.id = old.id;
  const p = { ...empty, rooms: [r] };
  const next = applyImport(p, previewImport(old, p));
  assert.equal(next.rooms.length, 2);
  assert.notEqual(next.rooms[1].id, old.id);
  assert.equal(next.rooms[1].imported?.id, old.id);
});
test("sync merges independent rooms and detects same room conflicts and deletes", () => {
  const base = {
    a: { revision: "1", payload: { x: 1 }, deleted: false },
    b: { revision: "2", payload: { x: 1 }, deleted: false },
  };
  const remote = [
    {
      id: "a",
      kind: "room" as const,
      revision: "1",
      payload: { x: 1 },
      deleted: false,
    },
    {
      id: "b",
      kind: "room" as const,
      revision: "3",
      payload: { x: 2 },
      deleted: false,
    },
  ];
  const result = reconcile({ a: { x: 2 }, b: { x: 1 } }, base, remote);
  assert.equal(result.conflicts.length, 0);
  assert.equal(result.writes.length, 1);
  assert.deepEqual(result.merged.b, { x: 2 });
  assert.equal(
    reconcile({ a: { x: 1 }, b: { x: 3 } }, base, remote).conflicts.length,
    1,
  );
  assert.equal(reconcile({ a: { x: 1 } }, base, remote).conflicts.length, 1);
});
test("retry after a lost save response recognises the saved payload", () => {
  const result = reconcile(
    { a: { x: 2 } },
    { a: { revision: "1", payload: { x: 1 }, deleted: false } },
    [
      {
        id: "a",
        kind: "room",
        revision: "2",
        payload: { x: 2 },
        deleted: false,
      },
    ],
  );
  assert.equal(result.writes.length, 0);
  assert.equal(result.conflicts.length, 0);
});
const room = applyImport(empty, previewImport(old, empty)).rooms[0];
const proposal = (actions: Proposal["actions"]): Proposal => ({
  roomId: room.id,
  revision: roomRevision(room),
  reply: "Proposed",
  reasons: [],
  uncertainties: [],
  actions,
});
test("proposals reject stale, architectural and resize operations without mutating original", () => {
  const before = canonical(room);
  assert.throws(() => applyProposal({ ...room, width: 500 }, proposal([])));
  assert.throws(() =>
    applyProposal(
      room,
      proposal([{ op: "move", id: "socket", x: 20, y: 10, rotation: 0 }]),
    ),
  );
  assert.throws(() =>
    applyProposal(
      room,
      proposal([{ op: "resize", id: "bed", width: 20 } as any]),
    ),
  );
  assert.equal(canonical(room), before);
});
test("proposals preserve exact dimensions and reject out-of-bounds moves", () => {
  const next = applyProposal(
    room,
    proposal([{ op: "move", id: "bed", x: 200, y: 200, rotation: 0 }]),
  );
  assert.equal(next.items[0].width, 90);
  assert.equal(next.items[0].depth, 190);
  assert.equal(next.items[0].owned, true);
  assert.throws(() =>
    applyProposal(
      room,
      proposal([{ op: "move", id: "bed", x: -100, y: 10, rotation: 0 }]),
    ),
  );
});
test("rotated resize keeps opposite corner fixed", () => {
  for (const rotation of [0, 45, 90, 137, 270]) {
    const it = { ...room.items[0], rotation };
    const before = corners(it)[0],
      after = corners(resizeCorner(it, 24, 17))[0];
    assert.ok(Math.abs(before.x - after.x) < 1e-8);
    assert.ok(Math.abs(before.y - after.y) < 1e-8);
  }
});
test(
  "actual private backups preserve all existing rooms and references through import",
  {
    skip: !existsSync(
      ".hometaking-backups/2026-09-15/room-planner-original.json",
    ),
  },
  () => {
    const local = JSON.parse(
      readFileSync(
        ".hometaking-data/cf364737-da89-4fb9-a693-8f8aeeaf983b/latest.json",
        "utf8",
      ),
    ).project;
    const source = JSON.parse(
      readFileSync(
        ".hometaking-backups/2026-09-15/room-planner-original.json",
        "utf8",
      ),
    );
    const next = applyImport(
      local,
      previewImport(
        source,
        local,
        "supabase:9fc26ee9-0aa0-4d56-b5bc-406d0dfffefe",
      ),
    );
    assert.deepEqual(next.rooms.slice(0, local.rooms.length), local.rooms);
    assert.equal(next.householdTasks?.length, 30);
    assert.deepEqual(parseProject(JSON.stringify(next)), next);
    for (const r of source.rooms) {
      const target = next.rooms.find((x) => x.imported?.id === r.id)!;
      assert.equal(target.width, Number(r.width));
      assert.equal(target.depth, Number(r.depth));
      r.items.forEach((i: any, n: number) => {
        assert.equal(target.items[n].x, i.x);
        assert.equal(target.items[n].y, i.y);
        assert.equal(target.items[n].width, i.w);
        assert.equal(target.items[n].depth, i.d);
        assert.equal(target.items[n].rotation, i.rot);
      });
    }
  },
);

test("undo keeps unrelated remote rooms and refuses undo over a newer edit", async () => {
  const { undoChange } = await import(
    "../client/hometaking/integration/history"
  );
  const a = blankRoom("A", 400, 300, 240),
    b = blankRoom("B", 400, 300, 240);
  const before: Project = { version: 1, rooms: [a, b], activeRoomId: a.id },
    after = { ...before, rooms: [{ ...a, brief: "edit" }, b] };
  const current = {
    ...after,
    rooms: [after.rooms[0], { ...b, brief: "remote" }],
  };
  const undone = undoChange(current, before, after);
  assert.equal(undone.rooms.find((r) => r.id === b.id)?.brief, "remote");
  assert.equal(undone.rooms.find((r) => r.id === a.id)?.brief, "");
  assert.throws(() =>
    undoChange(
      { ...current, rooms: [{ ...a, brief: "newer" }, b] },
      before,
      after,
    ),
  );
});
test("new furniture cannot collide with retained scanned objects or other furniture", () => {
  const bed = room.items[0];
  assert.throws(() =>
    applyProposal(room, proposal([{ op: "add", item: { ...bed, id: "new" } }])),
  );
});
test("changed tasks require an explicit choice and retain original task comments", () => {
  const raw = {
    rooms: [],
    tasks: [
      {
        id: "task",
        body: "Do it",
        done: false,
        comment: "Original",
        position: 0,
      },
    ],
  };
  const p = applyImport(empty, previewImport(raw, empty));
  const changed = { ...raw, tasks: [{ ...raw.tasks[0], comment: "Changed" }] };
  const preview = previewImport(changed, p);
  assert.throws(() => applyImport(p, preview));
  const next = applyImport(p, preview, { "task:task": "copy" });
  assert.equal(next.householdTasks?.length, 2);
  assert.equal(next.householdTasks?.[0].comment, "Original");
});

test("private assets round-trip and interrupted or corrupt transfers never produce a usable manifest", async () => {
  const { encodeAssets, decodeAssets } = await import(
    "../client/hometaking/integration/assets"
  );
  const { createHash } = await import("node:crypto");
  const hash = async (s: string) =>
    createHash("sha256").update(s).digest("hex");
  const saved = new Map<string, string>();
  const original = {
    image: "data:image/png;base64," + "a".repeat(70000),
    raw: "scan".repeat(20000),
    small: "note",
  };
  const wire = await encodeAssets(original, "home", hash, async (p, t) => {
    saved.set(p, t);
  });
  assert.ok(JSON.stringify(wire).length < 1000);
  assert.deepEqual(
    await decodeAssets(wire, "home", hash, async (p) => saved.get(p)!),
    original,
  );
  await assert.rejects(() =>
    encodeAssets(original, "home", hash, async () => {
      throw new Error("connection lost");
    }),
  );
  await assert.rejects(() =>
    decodeAssets(wire, "other-household", hash, async (p) => saved.get(p)!),
  );
  await assert.rejects(() =>
    decodeAssets(wire, "home", hash, async () => "corrupted"),
  );
});
test("an imported floor plan does not become an angled wall when a slope is present", async () => {
  const { rectangle } = await import("../client/hometaking/capture/geometry");
  const geometry = rectangle(400, 300, 240);
  geometry.features.push({
    id: "slope",
    kind: "ceiling-slope",
    a: { x: 0, y: 0 },
    b: { x: 400, y: 0 },
    height: { value: null, source: "inferred" },
    base: { value: null, source: "inferred" },
    projection: { value: null, source: "inferred" },
    note: "Unmeasured",
    source: "inferred",
    swing: "unknown",
  });
  const r = {
    ...room,
    width: 400,
    depth: 300,
    height: 240,
    structure: {
      current: {
        geometry,
        keptObjectIds: [],
        furnitureDecision: "all-going" as const,
      },
      history: [],
      previousDimensions: { width: 400, depth: 300, height: 240 },
    },
  };
  const p = { ...proposal([]), roomId: r.id, revision: roomRevision(r) };
  assert.deepEqual(
    applyProposal(r, p).structure?.current.geometry.walls,
    geometry.walls,
  );
});

test("camera capture backups preserve source data without changing reviewed dimensions or other rooms", async () => {
  const { packVisual } = await import("../client/hometaking/capture/visual");
  const raw = JSON.stringify({
    version: 1,
    units: "metres",
    id: "584c12c7-4b53-43a8-8353-6f94d8ab1e91",
    capturedAt: "2026-09-15T12:00:00Z",
    photos: [{ jpeg: "test-only" }],
    triangleCount: 1,
    texturedTriangleCount: 1,
    surfaces: [],
    padding: "x".repeat(2_000_010),
  });
  const capture = packVisual(raw);
  assert.equal(capture.chunks.length, 2);
  assert.equal(capture.chunks.join(""), raw);
  const first = blankRoom("First", 420, 350, 240),
    other = blankRoom("Other", 300, 250, 240);
  other.id = "unrelated-room";
  const updated = { ...first, visualCaptures: [capture] };
  const restored = parseProject(
    JSON.stringify({
      version: 2,
      rooms: [updated, other],
      activeRoomId: first.id,
    }),
  );
  assert.deepEqual(restored.rooms[1], other);
  assert.equal(restored.rooms[0].visualCaptures![0].chunks.join(""), raw);
  assert.equal(restored.rooms[0].width, first.width);
  assert.equal(
    roomRevision(updated),
    roomRevision(first),
    "Appearance must not change planner geometry or enter model prompts",
  );
});
