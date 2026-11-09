import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import {
  blankRoom,
  sampleRoom,
  parseProject,
  outside,
  Furniture,
} from "../client/hometaking/model";
import { Scan } from "../client/hometaking/capture/schema";
import {
  applyCapture,
  convertScan,
  extents,
  geometryErrors,
  geometryForRoom,
  keptObjects,
  outline,
  rectangle,
  rotateCapture,
} from "../client/hometaking/capture/geometry";
const matrix = (x: number, y: number, z: number, a = 0) => [
  Math.cos(a),
  0,
  Math.sin(a),
  0,
  0,
  1,
  0,
  0,
  -Math.sin(a),
  0,
  Math.cos(a),
  0,
  x,
  y,
  z,
  1,
];
const element = (id: string, x: number, z: number, width: number, a = 0) => ({
  id,
  category: "wall",
  dimensions: [width, 2.4, 0],
  transform: matrix(x, 1.2, z, a),
  confidence: "high",
});
// Synthetic API contract fixture, not evidence of a successful physical scan.
function fixture(angle = 0): Scan {
  const walls = [
    element("n", 2.1, 0, 4.2),
    element("e", 4.2, 1.75, 3.5, Math.PI / 2),
    element("s", 2.1, 3.5, 4.2),
    element("w", 0, 1.75, 3.5, Math.PI / 2),
  ];
  const doors = [element("door", 1, 0, 0.8)],
    windows = [element("window", 2.1, 3.5, 0.9)];
  const objects = [{ ...element("bed", 1, 2, 1), dimensions: [1, 1, 2] }];
  for (const e of [...walls, ...doors, ...windows, ...objects]) {
    const t = e.transform,
      x = t[12],
      z = t[14],
      a = Math.atan2(t[2], t[0]) + angle;
    e.transform = matrix(
      x * Math.cos(angle) - z * Math.sin(angle) + 9,
      1.2,
      x * Math.sin(angle) + z * Math.cos(angle) - 4,
      a,
    );
  }
  return {
    id: "fixture",
    capturedAt: "2026-09-12",
    provider: "apple-roomplan",
    raw: '{"synthetic":true}',
    walls,
    doors,
    windows,
    openings: [],
    objects,
  };
}
function reviewed() {
  const c = convertScan(fixture());
  c.geometry.orientationConfirmed = true;
  c.geometry.measurementsReviewed = true;
  c.furnitureDecision = "all-going";
  return c;
}
test("metres, column-major transforms, arbitrary yaw and translation convert to cm without changing topology", () => {
  for (const angle of [0, 0.37, 1.2, Math.PI]) {
    const c = convertScan(fixture(angle));
    assert.deepEqual(extents(c.geometry), { width: 420, depth: 350 });
    assert.equal(outline(c.geometry)?.length, 4);
    assert.deepEqual(geometryErrors(c.geometry), []);
    assert.equal(c.geometry.features[0].a.y, 0);
    assert.equal(c.geometry.features[1].a.y, 350);
    assert.equal(c.geometry.features[1].base.value, null);
    assert.equal(c.geometry.features[0].swing, "unknown");
    assert.equal(c.geometry.ceilingHeight.source, "inferred");
    assert.deepEqual(c.original, fixture(angle));
  }
});
test("four rotations preserve original, topology, dimensions and retained furniture positions", () => {
  let c = reviewed();
  c.furnitureDecision = "choose";
  c.keptObjectIds = ["bed"];
  const original = structuredClone(c),
    objects = keptObjects(c);
  for (let i = 0; i < 4; i++) c = rotateCapture(c);
  assert.deepEqual(c.geometry.walls, original.geometry.walls);
  assert.deepEqual(c.original, original.original);
  assert.ok(Math.abs(keptObjects(c)[0].x - objects[0].x) < 0.001);
  assert.ok(Math.abs(keptObjects(c)[0].y - objects[0].y) < 0.001);
});
test("review gates prevent accidental application", () => {
  assert.throws(
    () =>
      applyCapture(blankRoom("Test", 400, 300, 240), convertScan(fixture())),
    /Review/,
  );
});
test("scan review preserves every room, item, reference, stable ID, and previous dimensions", () => {
  const a = sampleRoom(),
    b = sampleRoom();
  a.name = "Arthur";
  a.width = 420;
  a.depth = 350;
  const before = structuredClone(a),
    other = structuredClone(b),
    capture = reviewed();
  const changed = applyCapture(a, capture);
  const parsed = parseProject(
    JSON.stringify({ version: 1, rooms: [changed, b], activeRoomId: b.id }),
  );
  assert.deepEqual(a, before);
  assert.deepEqual(parsed.rooms[1], other);
  for (const field of ["items", "ideas", "brief", "works"] as const)
    assert.deepEqual(parsed.rooms[0][field], before[field]);
  assert.deepEqual(
    parsed.rooms[0].structure?.current.original,
    JSON.parse(JSON.stringify(capture.original)),
  );
  assert.equal(parsed.rooms[0].structure?.history.length, 1);
  assert.deepEqual(parsed.rooms[0].structure?.previousDimensions, {
    width: 420,
    depth: 350,
    height: before.height,
  });
  const again = applyCapture(changed, reviewed());
  assert.equal(again.structure?.history.length, 2);
});
test("legacy rooms are not eagerly migrated or stripped; legacy fixed features survive manual review", () => {
  const room = sampleRoom(),
    project = { version: 1, rooms: [room], activeRoomId: room.id };
  assert.deepEqual(parseProject(JSON.stringify(project)), project);
  assert.equal(
    geometryForRoom(room).features[0].id,
    room.items.find((i) => i.kind === "window")?.id,
  );
});
test("concave wall topology is preserved and furniture across a notch is flagged", () => {
  const points = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 150 },
    { x: 200, y: 150 },
    { x: 200, y: 300 },
    { x: 0, y: 300 },
  ];
  const g = rectangle(400, 300, 240);
  g.walls = points.map((a, i) => ({
    ...g.walls[0],
    id: String(i),
    a,
    b: points[(i + 1) % points.length],
  }));
  assert.deepEqual(outline(g), points);
  assert.deepEqual(geometryErrors(g), []);
  const c = reviewed();
  c.geometry = { ...g, orientationConfirmed: true, measurementsReviewed: true };
  const room = applyCapture(blankRoom("L shape", 400, 300, 240), c);
  const item: Furniture = {
    id: "test",
    name: "Chair",
    x: 300,
    y: 220,
    width: 50,
    depth: 50,
    height: 80,
    rotation: 0,
    kind: "furniture",
    colour: "#AAAAAA",
    owned: false,
    dimensionsConfirmed: true,
  };
  assert.equal(outside(item, room), true);
  assert.equal(outside({ ...item, x: 100 }, room), false);
});
test("open, crossed, degenerate and unsupported curved scans do not become usable room geometry", () => {
  const g = rectangle(400, 300, 240);
  g.walls[0].b = { x: 100, y: 0 };
  assert.ok(geometryErrors(g).length);
  const c = fixture();
  c.walls[0].curved = true;
  assert.throws(() => convertScan(c), /curved/);
  const bad = fixture();
  bad.walls[0].transform[12] = NaN;
  assert.throws(() => convertScan(bad));
});
test("all-going excludes scanned furniture without deleting planned pieces; choices survive backup", () => {
  const c = reviewed();
  assert.deepEqual(keptObjects(c), []);
  c.furnitureDecision = "choose";
  c.keptObjectIds = ["bed"];
  assert.equal(keptObjects(c).length, 1);
  const room = applyCapture(sampleRoom(), c);
  assert.equal(
    parseProject(
      JSON.stringify({ version: 1, rooms: [room], activeRoomId: room.id }),
    ).rooms[0].structure?.current.keptObjectIds[0],
    "bed",
  );
});
test("real local saved projects round-trip read-only when present", (t) => {
  if (!existsSync(".hometaking-data")) {
    t.skip("No private projects in this checkout");
    return;
  }
  let count = 0;
  for (const dir of readdirSync(".hometaking-data", {
    withFileTypes: true,
  }).filter((d) => d.isDirectory() && /^[a-f0-9-]{36}$/.test(d.name))) {
    const record = JSON.parse(
      readFileSync(`.hometaking-data/${dir.name}/latest.json`, "utf8"),
    );
    assert.deepEqual(
      parseProject(JSON.stringify(record.project)),
      record.project,
    );
    count++;
  }
  if (!count) t.skip("No private projects in this checkout");
  else
    t.diagnostic(
      `${count} saved local projects round-tripped without writing to disk.`,
    );
});

test("inconsistent reviewed bounds and duplicate wall identifiers are rejected at restore", () => {
  const room = applyCapture(blankRoom("Test", 400, 300, 240), reviewed());
  const project = { version: 1, rooms: [room], activeRoomId: room.id };
  assert.throws(
    () =>
      parseProject(
        JSON.stringify({ ...project, rooms: [{ ...room, width: 900 }] }),
      ),
    /inconsistent/,
  );
  room.structure!.current.geometry.walls[1].id =
    room.structure!.current.geometry.walls[0].id;
  assert.throws(() => parseProject(JSON.stringify(project)), /Duplicate/);
});

test("original capture history remains intact across correction and all-going decisions", () => {
  const room = applyCapture(sampleRoom(), reviewed()),
    before = JSON.stringify(room);
  const next = structuredClone(room.structure!.current);
  next.geometry.features[0].swing = "inward-right";
  next.geometry.features[1].base = { value: 85, source: "user-confirmed" };
  const changed = applyCapture(room, next);
  assert.equal(JSON.stringify(room), before);
  assert.equal(
    changed.structure!.history[1].geometry.features[0].swing,
    "unknown",
  );
  assert.equal(
    changed.structure!.current.original!.raw,
    room.structure!.current.original!.raw,
  );
  assert.equal(changed.structure!.current.geometry.features[1].base.value, 85);
});
