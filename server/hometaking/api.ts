import express from "express";
import { conversation } from "./conversation";
const app = express();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS ?? "").split(",");
  if (
    origin &&
    (allowed.includes(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
  ) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: "2mb" }));
app.use("/api/hometaking", conversation);
app.get("/health", (_req, res) =>
  res.json({ ok: true, assistantConfigured: !!process.env.OPENAI_API_KEY }),
);
app.listen(Number(process.env.HOMETAKING_API_PORT ?? 5001), "0.0.0.0", () =>
  console.log(
    "Hometaking development API listening on port " +
      (process.env.HOMETAKING_API_PORT ?? 5001),
  ),
);
