import test from "node:test";
import assert from "node:assert/strict";
import {
  sampleRoom,
  blankRoom,
  bounds,
  overlaps,
  outside,
  place,
  issues,
  parseProject,
  initialProject,
  Furniture,
} from "../client/hometaking/model";
const room = blankRoom("Test", 400, 300, 240);
const piece: Furniture = {
  id: "a",
  name: "Chair",
  width: 80,
  depth: 60,
  height: 75,
  x: 100,
  y: 100,
  rotation: 0,
  kind: "furniture",
  colour: "#A64B32",
  owned: false,
  dimensionsConfirmed: true,
};
test("rotation preserves dimensions and places full rotated bounds inside the walls", () => {
  for (const rotation of [0, 30, 45, 90, 137, 270]) {
    const p = place({ ...piece, rotation }, -100, 900, room);
    assert.equal(outside(p, room), false);
    assert.equal(p.width, 80);
    assert.equal(p.depth, 60);
    const b = bounds(p);
    assert.ok(b.left >= -0.01 && b.bottom <= 300.01);
  }
});
test("oversized furniture stays full size and is flagged", () => {
  const p = place({ ...piece, width: 500 }, 0, 0, room);
  assert.equal(p.width, 500);
  assert.equal(p.x, 200);
  assert.equal(outside(p, room), true);
});
test("touching edges are allowed, substantial overlap is flagged", () => {
  assert.equal(overlaps(piece, { ...piece, id: "b", x: 180 }), false);
  assert.equal(overlaps(piece, { ...piece, id: "b", x: 179 }), true);
  assert.equal(
    overlaps(
      { ...piece, rotation: 45 },
      { ...piece, id: "b", x: 130, rotation: 135 },
    ),
    true,
  );
});
test("rugs can sit beneath furniture, fixed features cannot", () => {
  assert.equal(overlaps(piece, { ...piece, kind: "rug" }), false);
  assert.equal(overlaps(piece, { ...piece, kind: "fixed" }), true);
});
test("room resizing reports items outside instead of silently moving them", () => {
  const r = { ...room, width: 90, items: [piece] };
  assert.equal(issues(r).length, 1);
  assert.equal(r.items[0].x, 100);
});
test("sample starts without layout warnings", () =>
  assert.deepEqual(issues(sampleRoom()), []));
test("backup round-trip preserves project, photos, dimensions and completed tasks", () => {
  const p = initialProject();
  p.rooms[0].ideas.push({
    id: "uploaded",
    image: "data:image/png;base64,aGVsbG8=",
    note: "My photograph",
    role: "Keep this",
  });
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
});
test("malformed backups and duplicate room/item IDs are rejected", () => {
  assert.throws(() => parseProject("{"));
  const p = initialProject();
  p.rooms.push(p.rooms[0]);
  assert.throws(() => parseProject(JSON.stringify(p)));
  const q = initialProject();
  q.rooms[0].items.push(q.rooms[0].items[0]);
  assert.throws(() => parseProject(JSON.stringify(q)));
});
test("hostile links, invalid dimensions and excessive payloads are rejected", () => {
  const p = initialProject();
  p.rooms[0].items[0].url = "javascript:alert(1)";
  assert.throws(() => parseProject(JSON.stringify(p)));
  delete p.rooms[0].items[0].url;
  p.rooms[0].width = 0;
  assert.throws(() => parseProject(JSON.stringify(p)));
  assert.throws(() => parseProject(" ".repeat(4_000_001)));
});
test("missing active room safely falls back to the first room", () => {
  const p = initialProject();
  p.activeRoomId = "missing";
  assert.equal(parseProject(JSON.stringify(p)).activeRoomId, p.rooms[0].id);
});

test("drag snaps to grid and nearby walls using rotated furniture bounds", async () => {
  const { snapPlacement } = await import("../client/hometaking/model");
  const grid = snapPlacement(piece, 123, 147, room);
  assert.equal(grid.x, 120);
  assert.equal(grid.y, 150);
  const wall = snapPlacement(piece, 44, 147, room);
  assert.equal(bounds(wall).left, 0);
  const rotated = snapPlacement({ ...piece, rotation: 90 }, 35, 147, room);
  assert.ok(Math.abs(bounds(rotated).left) < 0.001);
  assert.equal(outside(rotated, room), false);
  const huge = snapPlacement({ ...piece, width: 500 }, -100, 147, room);
  assert.equal(huge.x, 200);
  assert.equal(huge.width, 500);
  assert.equal(outside(huge, room), true);
  assert.deepEqual(snapPlacement(grid, grid.x, grid.y, room), grid);
});

test("snapping reaches every interior wall exactly for rotated and unrotated pieces", async () => {
  const { snapPlacement } = await import("../client/hometaking/model");
  for (const rotation of [0, 45, 90, 180, 270])
    for (const x of [-1000, 1000])
      for (const y of [-1000, 1000]) {
        const placed = snapPlacement({ ...piece, rotation }, x, y, room),
          b = bounds(placed);
        assert.ok(Math.abs(x < 0 ? b.left : b.right - room.width) < 0.000001);
        assert.ok(Math.abs(y < 0 ? b.top : b.bottom - room.depth) < 0.000001);
        assert.equal(outside(placed, room), false);
      }
});

test("room purpose, feeling, audience and journey survive backup restore", () => {
  const p = initialProject();
  p.rooms[0].forWhom = "A teenager who loves gaming";
  p.rooms[0].purpose = "Gaming, homework and friends";
  p.rooms[0].brief = "Comfortable and stylish";
  p.rooms[0].journey = "Works";
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
});

test("door dragging stays on its chosen wall and swing points inward", async () => {
  const { doorGeometry, snapPlacement } = await import(
    "../client/hometaking/model"
  );
  for (const wall of ["north", "east", "south", "west"] as const) {
    const door = {
      ...piece,
      kind: "door" as const,
      wall,
      width: 80,
      depth: 4,
      height: 200,
    };
    const p = snapPlacement(door, 130, 160, room),
      g = doorGeometry(p, room);
    assert.equal(p.wall, wall);
    if (wall === "north") assert.equal(p.y, 2);
    if (wall === "south") assert.equal(p.y, room.depth - 2);
    if (wall === "west") assert.equal(p.x, 2);
    if (wall === "east") assert.equal(p.x, room.width - 2);
    assert.ok(
      g.open.x >= 0 &&
        g.open.x <= room.width &&
        g.open.y >= 0 &&
        g.open.y <= room.depth,
    );
    assert.equal(Math.hypot(g.open.x - g.hinge.x, g.open.y - g.hinge.y), 80);
  }
});
test("reveal stage and office-chair type survive backup restore", () => {
  const p = initialProject();
  p.rooms[0].journey = "Reveal";
  p.rooms[0].items[0].archetype = "Office chair";
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
});
test("3D furniture approximations preserve recorded positions and fit their dimensions", async () => {
  const { buildRoomScene, disposeRoomScene } = await import(
    "../client/hometaking/render/scene"
  );
  const { Box3 } = await import("three");
  const { basicFurniture } = await import("../client/hometaking/model");
  for (const basic of basicFurniture) {
    const item = { ...piece, ...basic, archetype: basic.name, rotation: 90 };
    const r = { ...room, items: [item] },
      scene = buildRoomScene(r);
    const group = scene.children.find((o) => o.userData.itemId === item.id)!;
    assert.ok(group);
    assert.equal(group.position.x, item.x / 100 - room.width / 200);
    assert.equal(group.position.z, item.y / 100 - room.depth / 200);
    const b = new Box3().setFromObject(group);
    assert.ok(b.max.x - b.min.x <= item.depth / 100 + 0.001);
    assert.ok(b.max.z - b.min.z <= item.width / 100 + 0.001);
    assert.ok(b.max.y <= item.height / 100 + 0.001);
    disposeRoomScene(scene);
    assert.equal(scene.children.length, 0);
  }
});
