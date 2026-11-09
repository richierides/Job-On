const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage();
    const key = "@hometaking/local-pilot/v1";
    const seed = JSON.parse(
      fs.readFileSync("artifacts/hometaking/test-backup.json", "utf8"),
    );
    seed.rooms[0].name = "Persistence test only";
    await page.addInitScript(
      ({ key, seed }) => {
        if (!localStorage.getItem("test-seeded")) {
          localStorage.setItem(key, JSON.stringify(seed));
          localStorage.setItem("test-seeded", "1");
        }
      },
      { key, seed },
    );
    await page.goto("http://127.0.0.1:8082");
    await page.waitForFunction(() =>
      localStorage.getItem("@hometaking/server-plan-revision/v1"),
    );
    const id = await page.evaluate(() =>
      localStorage.getItem("@hometaking/server-plan-id/v1"),
    );
    const url = `http://127.0.0.1:8082/api/plans/${id}`;
    const record = await (await fetch(url)).json();
    assert.equal(record.project.rooms[0].name, seed.rooms[0].name);
    assert.deepEqual(record.project.rooms[0].items, seed.rooms[0].items);
    await page.evaluate((key) => localStorage.removeItem(key), key);
    await page.reload();
    await page.waitForFunction((key) => localStorage.getItem(key), key);
    assert.equal(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).rooms[0].name,
        key,
      ),
      seed.rooms[0].name,
    );
    const conflict = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: seed, revision: "stale" }),
    });
    assert.equal(conflict.status, 409);
    const invalid = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: {}, revision: record.revision }),
    });
    assert.equal(invalid.status, 400);
    const cross = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://example.com",
      },
      body: "{}",
    });
    assert.equal(cross.status, 403);
    await page.route("**/api/plans/**", (route) => route.abort());
    await page.getByRole("tab", { name: "Rooms", exact: true }).click();
    await page
      .getByText(/Saved on this device only/)
      .first()
      .waitFor();
    assert.ok(await page.evaluate((key) => localStorage.getItem(key), key));
    console.log(
      "PASS: existing browser plan migrates with exact item data; server restores missing browser copy; stale revision, malformed data and cross-origin requests rejected; offline browser copy retained.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
