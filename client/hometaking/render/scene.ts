import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { Room, doorGeometry, nearestWall } from "../model";

export function buildRoomScene(room: Room) {
  if (room.height === null || room.items.some((i) => i.height === null))
    throw new Error("Measure unknown heights before making a 3D preview.");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#F2F0E9");
  const W = room.width / 100,
    D = room.depth / 100,
    H = room.height! / 100;
  const material = (colour: string, roughness = 0.75, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color: colour, roughness, metalness });
  const wall = material(room.wallColour),
    floor = material("#C6B79D"),
    wood = material("#AB8D6A"),
    cloth = material("#E9E3D8"),
    metal = material("#606362", 0.3, 0.7);
  const box = (
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    rounded = false,
  ) => {
    const mesh = new THREE.Mesh(
      rounded
        ? new RoundedBoxGeometry(
            Math.max(w, 0.002),
            Math.max(h, 0.002),
            Math.max(d, 0.002),
            3,
            Math.min(w, h, d) * 0.14,
          )
        : new THREE.BoxGeometry(
            Math.max(w, 0.002),
            Math.max(h, 0.002),
            Math.max(d, 0.002),
          ),
      mat,
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  box(scene, W, 0.08, D, 0, -0.04, 0, floor);
  // Wall openings are built from the same door records used by the measured plan.
  for (const side of ["north", "west", "south", "east"] as const) {
    const horizontal = side === "north" || side === "south",
      length = horizontal ? W : D,
      full = side === "north" || side === "west",
      height = full ? H : 0.09;
    const openings = room.items
      .filter(
        (i) =>
          (i.kind === "door" || i.kind === "window") &&
          nearestWall(i, room) === side,
      )
      .map((i) => ({
        start: Math.max(0, ((horizontal ? i.x : i.y) - i.width / 2) / 100),
        end: Math.min(length, ((horizontal ? i.x : i.y) + i.width / 2) / 100),
        bottom:
          i.kind === "door" ? 0 : Math.max(0.3, (H - i.height! / 100) / 2),
        top:
          i.kind === "door"
            ? Math.min(H, i.height! / 100)
            : Math.min(H, (H + i.height! / 100) / 2),
      }));
    const cuts = [
      ...new Set([0, length, ...openings.flatMap((o) => [o.start, o.end])]),
    ].sort((a, b) => a - b);
    const wallBox = (from: number, to: number, low: number, high: number) => {
      if (to <= from || high <= low) return;
      const middle = (from + to) / 2 - length / 2;
      box(
        scene,
        horizontal ? to - from : 0.08,
        high - low,
        horizontal ? 0.08 : to - from,
        horizontal ? middle : side === "west" ? -W / 2 - 0.04 : W / 2 + 0.04,
        (high + low) / 2,
        horizontal ? (side === "north" ? -D / 2 - 0.04 : D / 2 + 0.04) : middle,
        wall,
      );
    };
    for (let j = 0; j < cuts.length - 1; j++) {
      const a = cuts[j],
        b = cuts[j + 1],
        at = (a + b) / 2,
        cover = openings.filter((o) => at > o.start && at < o.end);
      if (!cover.length) wallBox(a, b, 0, height);
      else {
        wallBox(a, b, 0, Math.min(height, ...cover.map((o) => o.bottom)));
        wallBox(a, b, Math.max(...cover.map((o) => o.top)), height);
      }
    }
  }
  for (const it of room.items) {
    const w = it.width / 100,
      d = it.depth / 100,
      h = it.height! / 100;
    if (it.kind === "door") {
      const g = doorGeometry(it, room),
        dx = (g.open.x - g.hinge.x) / 100,
        dz = (g.open.y - g.hinge.y) / 100;
      const door = box(
        scene,
        Math.abs(dx) > 0.001 ? w : 0.035,
        h,
        Math.abs(dz) > 0.001 ? w : 0.035,
        (g.hinge.x + g.open.x) / 200 - W / 2,
        h / 2,
        (g.hinge.y + g.open.y) / 200 - D / 2,
        wood,
      );
      door.userData.itemId = it.id;
      continue;
    }
    if (it.kind === "window") {
      const side = nearestWall(it, room),
        horizontal = side === "north" || side === "south";
      const frame = new THREE.Group();
      frame.position.set(
        horizontal
          ? it.x / 100 - W / 2
          : side === "west"
            ? -W / 2 - 0.04
            : W / 2 + 0.04,
        H / 2,
        horizontal
          ? side === "north"
            ? -D / 2 - 0.04
            : D / 2 + 0.04
          : it.y / 100 - D / 2,
      );
      frame.rotation.y = horizontal ? 0 : Math.PI / 2;
      scene.add(frame);
      const glass = new THREE.MeshStandardMaterial({
        color: "#BDD7DC",
        roughness: 0.15,
        transparent: true,
        opacity: 0.45,
      });
      box(frame, w, h, 0.015, 0, 0, 0, glass);
      for (const x of [-w / 2, w / 2])
        box(frame, 0.035, h, 0.07, x, 0, 0, cloth);
      for (const y of [-h / 2, 0, h / 2])
        box(frame, w, 0.035, 0.07, 0, y, 0, cloth);
      continue;
    }
    const group = new THREE.Group();
    group.position.set(it.x / 100 - W / 2, 0, it.y / 100 - D / 2);
    group.rotation.y = (-it.rotation * Math.PI) / 180;
    group.userData.itemId = it.id;
    scene.add(group);
    const finish = material(it.colour);
    const kind = (it.archetype ?? it.name).toLowerCase();
    // All approximations stay within the recorded width, depth and height.
    const part = (
      bw: number,
      bh: number,
      bd: number,
      x: number,
      y: number,
      z: number,
      m: THREE.Material = finish,
    ) => box(group, bw * w, bh * h, bd * d, x * w, y * h, z * d, m, true);
    const legs = (top = 0.85) => {
      for (const x of [-0.43, 0.43])
        for (const z of [-0.43, 0.43])
          part(0.06, top, 0.06, x, top / 2, z, wood);
    };
    if (it.kind === "rug") {
      part(1, Math.min(0.015 / h, 1), 1, 0, 0.005 / h, 0);
    } else if (kind.includes("bed")) {
      part(1, 0.25, 1, 0, 0.125, 0, wood);
      part(0.95, 0.2, 0.88, 0, 0.35, 0.035, cloth);
      part(1, 1, 0.045, 0, 0.5, -0.4775);
      part(0.84, 0.07, 0.19, 0, 0.485, -0.25, cloth);
      part(0.96, 0.05, 0.53, 0, 0.475, 0.205);
    } else if (kind.includes("office chair")) {
      part(0.08, 0.42, 0.08, 0, 0.21, 0, metal);
      part(0.9, 0.09, 0.85, 0, 0.465, 0.03);
      part(0.9, 0.5, 0.08, 0, 0.75, -0.46);
      part(0.92, 0.04, 0.1, 0, 0.025, 0, metal);
      part(0.1, 0.04, 0.92, 0, 0.025, 0, metal);
      for (const x of [-0.42, 0.42])
        part(0.07, 0.2, 0.55, x, 0.59, 0.02, metal);
    } else if (kind.includes("sofa") || kind.includes("chair")) {
      part(0.86, 0.35, 0.85, 0, 0.2, 0.025);
      part(0.8, 0.16, 0.76, 0, 0.46, 0.075, cloth);
      part(1, 0.45, 0.12, 0, 0.775, -0.44);
      part(0.1, 0.65, 1, -0.45, 0.325, 0);
      part(0.1, 0.65, 1, 0.45, 0.325, 0);
    } else if (kind.includes("desk") || kind.includes("table")) {
      part(1, 0.08, 1, 0, 0.96, 0);
      legs(0.92);
    } else if (kind.includes("wardrobe") || kind.includes("cupboard")) {
      part(1, 1, 1, 0, 0.5, 0);
      part(0.008, 0.94, 0.008, 0, 0.5, 0.496, wood);
      for (const x of [-0.035, 0.035])
        part(0.012, 0.1, 0.018, x, 0.52, 0.489, metal);
    } else {
      part(1, 1, 1, 0, 0.5, 0);
    }
  }
  const hemi = new THREE.HemisphereLight("#FFF9ED", "#9F9A87", 1.4);
  scene.add(hemi);
  const light = new THREE.DirectionalLight("#FFF2D9", 2.2);
  light.position.set(W * 0.5, H * 2.5, D * 0.8);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  const extent = Math.max(W, D, H);
  light.shadow.camera.left = -extent;
  light.shadow.camera.right = extent;
  light.shadow.camera.top = extent;
  light.shadow.camera.bottom = -extent;
  light.shadow.camera.far = extent * 8;
  light.shadow.normalBias = 0.025;
  scene.add(light);
  return scene;
}
export function disposeRoomScene(scene: THREE.Scene) {
  const materials = new Set<THREE.Material>();
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      for (const m of Array.isArray(obj.material)
        ? obj.material
        : [obj.material])
        materials.add(m);
    }
    if (obj instanceof THREE.DirectionalLight) obj.shadow.dispose();
  });
  materials.forEach((m) => m.dispose());
  scene.clear();
}
