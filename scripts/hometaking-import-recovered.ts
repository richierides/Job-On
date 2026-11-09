import { readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { parseProject } from "../client/hometaking/model";
import {
  previewImport,
  applyImport,
  canonical,
} from "../client/hometaking/integration/importer";
async function main() {
  const sourcePath = process.argv[2],
    planPath = process.argv[3];
  if (!sourcePath || !planPath)
    throw new Error(
      "Usage: script source-backup.json local-latest.json [--apply]",
    );
  const source = JSON.parse(await readFile(sourcePath, "utf8")),
    before = await readFile(planPath, "utf8"),
    record = JSON.parse(before),
    original = parseProject(JSON.stringify(record.project));
  const preview = previewImport(
      source,
      original,
      "supabase:" + source.rooms[0].household_id,
    ),
    project = parseProject(JSON.stringify(applyImport(original, preview)));
  if (
    !original.rooms.every((r) =>
      project.rooms.some((x) => canonical(x) === canonical(r)),
    )
  )
    throw new Error("Existing room changed");
  console.log(
    JSON.stringify({
      existingRooms: original.rooms.length,
      resultRooms: project.rooms.length,
      householdTasks: project.householdTasks?.length,
      sourceRooms: preview.entries.map((e) => ({
        name: e.room.name,
        width: e.room.width,
        depth: e.room.depth,
        items: e.room.items.length,
        status: e.status,
      })),
    }),
  );
  await writeFile(
    ".hometaking-backups/2026-09-15/combined-preview.json",
    JSON.stringify(project, null, 2),
    { mode: 0o600 },
  );
  const sourceProject = applyImport(
    { version: 2, rooms: [], activeRoomId: null },
    previewImport(
      source,
      { version: 2, rooms: [], activeRoomId: null },
      "supabase:" + source.rooms[0].household_id,
    ),
  );
  await writeFile(
    ".hometaking-backups/2026-09-15/source-converted.json",
    JSON.stringify(sourceProject),
    { mode: 0o600 },
  );
  if (process.argv.includes("--apply")) {
    if ((await readFile(planPath, "utf8")) !== before)
      throw new Error("Local plan changed during import; retry preview.");
    if (canonical(project) === canonical(original)) {
      console.log("Already imported.");
      process.exit(0);
    }
    const next = JSON.stringify(
        { revision: randomUUID(), savedAt: new Date().toISOString(), project },
        null,
        2,
      ),
      dir = planPath.slice(0, planPath.lastIndexOf("/"));
    await writeFile(`${dir}/${Date.now()}-before-import.json`, before, {
      flag: "wx",
      mode: 0o600,
    });
    await writeFile(`${dir}/${Date.now()}-import.json`, next, {
      flag: "wx",
      mode: 0o600,
    });
    await writeFile(planPath + ".import-next", next, { mode: 0o600 });
    await rename(planPath + ".import-next", planPath);
    console.log("Applied additive import; previous revision preserved.");
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
