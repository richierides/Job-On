import {conversation} from "./conversation";
import express from "express";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseProject } from "../../client/hometaking/model";

const app = express();
const port = Number(process.env.HOMETAKING_PORT || 8081);
const root = path.resolve(
  process.env.HOMETAKING_DATA_DIR || ".hometaking-data",
);
app.use("/api/plans", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  if (
    !["127.0.0.1", "localhost"].includes(req.hostname) ||
    (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`)
  ) {
    res.sendStatus(403);
    return;
  }
  next();
});
app.use(express.json({ limit: "100mb" }));
app.use("/api/hometaking", conversation);
const valid = (id: string) => /^[a-f0-9-]{36}$/.test(id);
let queue = Promise.resolve();
app.get("/api/plans/:id", async (req, res) => {
  if (!valid(req.params.id)) {
    res.sendStatus(400);
    return;
  }
  try {
    res.json(
      JSON.parse(
        await readFile(path.join(root, req.params.id, "latest.json"), "utf8"),
      ),
    );
  } catch (e: any) {
    res.sendStatus(e.code === "ENOENT" ? 404 : 500);
  }
});
// Local, pre-rendered study. Only expose it to a plan containing its source room.
app.get("/api/plans/:id/rooms/:roomId/render/:asset", async (req, res) => {
  if (!valid(req.params.id)) {
    res.sendStatus(400);
    return;
  }
  const files: Record<string, string> = {
    main: "arthur-bedroom.png",
    second: "arthur-bedroom-second-view.png",
    scene: "arthur-bedroom.blend",
    plan: "top-down.png",
  };
  try {
    const record = JSON.parse(
      await readFile(path.join(root, req.params.id, "latest.json"), "utf8"),
    );
    const dir = path.join(root, "renders", "arthur-v3");
    const source = JSON.parse(
      await readFile(path.join(dir, "source-room.json"), "utf8"),
    );
    if (
      source.id !== req.params.roomId ||
      !record.project.rooms.some((r: { id: string }) => r.id === source.id)
    ) {
      res.sendStatus(404);
      return;
    }
    if (req.params.asset === "metadata") {
      res.json({ source });
      return;
    }
    const file = files[req.params.asset];
    if (!file) {
      res.sendStatus(404);
      return;
    }
    res.sendFile(path.join(dir, file), { dotfiles: "allow" });
  } catch {
    res.sendStatus(404);
  }
});
app.put("/api/plans/:id", (req, res) => {
  queue = queue
    .then(async () => {
      try {
        if (!valid(req.params.id)) {
          res.sendStatus(400);
          return;
        }
        const project = parseProject(JSON.stringify(req.body.project));
        const dir = path.join(root, req.params.id);
        await mkdir(dir, { recursive: true, mode: 0o700 });
        let previous: { revision: string } | null = null;
        try {
          previous = JSON.parse(
            await readFile(path.join(dir, "latest.json"), "utf8"),
          );
        } catch (e: any) {
          if (e.code !== "ENOENT") throw e;
        }
        if ((previous?.revision ?? null) !== (req.body.revision ?? null)) {
          res.sendStatus(409);
          return;
        }
        const revision = randomUUID();
        const record = { revision, savedAt: new Date().toISOString(), project };
        const body = JSON.stringify(record, null, 2);
        // Preserve revisions for recovery; publish latest with an atomic rename.
        await writeFile(
          path.join(dir, `${Date.now()}-${revision}.json`),
          body,
          { mode: 0o600, flag: "wx" },
        );
        await writeFile(path.join(dir, "latest.tmp"), body, { mode: 0o600 });
        await rename(
          path.join(dir, "latest.tmp"),
          path.join(dir, "latest.json"),
        );
        res.json({ revision, savedAt: record.savedAt });
      } catch {
        res.status(400).json({
          error:
            "The plan could not be saved. Existing revisions were preserved.",
        });
      }
    })
    .catch(() => {
      if (!res.headersSent) res.sendStatus(500);
    });
});
app.use(express.static(path.resolve("dist-hometaking")));
app.listen(port, "127.0.0.1", () =>
  console.log(`Hometaking: http://127.0.0.1:${port}, plans: ${root}`),
);
