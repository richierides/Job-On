/** Isolated API test. Uses temporary data, never .hometaking-data. */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { blankRoom, sampleRoom } from "../client/hometaking/model";
import { applyCapture, rectangle } from "../client/hometaking/capture/geometry";
(async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "hometaking-capture-storage-"),
  );
  const port = 18192;
  const server = spawn(
    process.execPath,
    ["--import", "tsx", "server/hometaking/preview.ts"],
    {
      env: {
        ...process.env,
        HOMETAKING_DATA_DIR: root,
        HOMETAKING_PORT: String(port),
      },
      stdio: "pipe",
    },
  );
  try {
    let announced = false;
    server.stdout.on("data", (chunk) => {
      if (String(chunk).includes(`plans: ${root}`)) announced = true;
    });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        if (!announced) throw new Error("Waiting for isolated server");
        await fetch(`http://127.0.0.1:${port}`);
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    assert.ok(ready, "Isolated server starts");
    const geometry = rectangle(420, 350, 240);
    geometry.measurementsReviewed = true;
    geometry.orientationConfirmed = true;
    const room = applyCapture(sampleRoom(), {
      geometry,
      furnitureDecision: "all-going",
      keptObjectIds: [],
    });
    const project = {
      version: 1,
      rooms: [room, blankRoom("Other test room", 300, 300, 240)],
      activeRoomId: room.id,
    };
    const id = randomUUID(),
      url = `http://127.0.0.1:${port}/api/plans/${id}`;
    const put = (value: unknown, revision: string | null) =>
      fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: value, revision }),
      });
    const first = await put(project, null);
    assert.equal(first.status, 200);
    const rev = (await first.json()).revision;
    assert.deepEqual((await (await fetch(url)).json()).project, project);
    const next = structuredClone(project);
    next.rooms[0].structure!.current.geometry.notes =
      "Corrected fixture detail";
    assert.equal((await put(next, rev)).status, 200);
    assert.equal((await put(project, rev)).status, 409);
    assert.deepEqual(
      JSON.parse(await readFile(path.join(root, id, "latest.json"), "utf8"))
        .project,
      next,
    );
    const invalid = structuredClone(next);
    invalid.rooms[0].width = 999;
    const current = (await (await fetch(url)).json()).revision;
    assert.equal((await put(invalid, current)).status, 400);
    const revisions = await readdir(path.join(root, id));
    assert.ok(revisions.length > 1);
    console.log(
      "PASS: reviewed geometry API round-trip, other-room preservation, retained revisions, stale-save rejection and invalid-geometry rejection. Temporary data only.",
    );
  } finally {
    server.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
