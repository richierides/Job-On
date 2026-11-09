/* Isolated fixture-only browser check; never connects to the user's plan server. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 393, height: 852 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/plans/**", (r) =>
      r.fulfill({
        status: r.request().method() === "GET" ? 404 : 200,
        contentType: "application/json",
        body: JSON.stringify({ revision: "fixture-only" }),
      }),
    );
    await page.goto(process.env.HOMETAKING_URL || "http://127.0.0.1:8092");
    const btn = (n) => page.getByRole("button", { name: n, exact: true }),
      field = (n) => page.getByRole("textbox", { name: n, exact: true });
    await page.getByText("A home,").waitFor();
    const before = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1")),
    );
    await page.getByRole("tab", { name: "Rooms", exact: true }).click();
    await btn("Room options").click();
    await btn("Edit measurements").click();
    await page
      .getByText("Apple room scanning is available", { exact: false })
      .waitFor();
    assert.equal(await btn("Scan with LiDAR").isEnabled(), false);
    assert.equal(
      await btn("Apply reviewed geometry to this room").isEnabled(),
      false,
    );
    await field("Width (metres)").fill("4.5");
    await field("Depth (metres)").fill("3.8");
    await btn("Use these rectangular wall measurements").click();
    await btn("Add ceiling-slope").click();
    await field("ceiling-slope 2 notes").fill(
      "Synthetic QA slope, high 240 cm / low 180 cm; no angled floor wall.",
    );
    await field("Ceiling height (cm), inferred").fill("240");
    await field("Ceiling height (cm), user-confirmed").press("End");
    await field("Ceiling height (cm), user-confirmed").pressSequentially(".5");
    assert.equal(
      await field("Ceiling height (cm), user-confirmed").inputValue(),
      "240.5",
    );
    await btn("All existing furniture is going").click();
    await btn("Confirm top / bottom orientation").click();
    await btn("Confirm measurements reviewed and unknowns recorded").click();
    await page.screenshot({ path: "/tmp/hometaking-capture-review.png" });
    await btn("Apply reviewed geometry to this room").click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1")).rooms[0]
          .structure,
    );
    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1")),
    );
    assert.equal(after.rooms[0].width, 450);
    assert.equal(after.rooms[0].depth, 380);
    assert.equal(after.rooms[0].height, 240.5);
    assert.deepEqual(after.rooms[0].items, before.rooms[0].items);
    assert.deepEqual(after.rooms[0].ideas, before.rooms[0].ideas);
    assert.equal(after.rooms[0].structure.current.geometry.walls.length, 4);
    await page.screenshot({ path: "/tmp/hometaking-capture-plan.png" });
    await page.reload();
    await page.getByRole("tab", { name: "Rooms", exact: true }).click();
    await btn("Room options").click();
    await btn("Edit measurements").click();
    await field("Width (metres)").fill("6");
    await btn("Use these rectangular wall measurements").click();
    await btn("Close dialog").click();
    const cancelled = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1")),
    );
    assert.equal(cancelled.rooms[0].width, 450);
    await btn("Room options").click();
    await btn("Edit measurements").click();
    await page.getByText("Bounding size: 600", { exact: false }).waitFor();
    await btn("Close dialog").click();
    await page.getByRole("tab", { name: "Home", exact: true }).click();
    await btn("Add a room").click();
    await field("Room name").fill("Second room QA");
    await field("What does it need to make room for?").fill(
      "Synthetic test only",
    );
    await btn("Next: capture the room").click();
    await btn("All existing furniture is going").click();
    await btn("Confirm top / bottom orientation").click();
    await btn("Confirm measurements reviewed and unknowns recorded").click();
    await btn("Apply reviewed geometry to this room").click();
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1")).rooms
          .length === 2,
    );
    const two = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1")),
    );
    assert.deepEqual(two.rooms[0], cancelled.rooms[0]);
    assert.equal(two.rooms[1].name, "Second room QA");
    await page.getByRole("tab", { name: "Home", exact: true }).click();
    await btn("Add a room").click();
    await field("Room name").waitFor(); // A completed draft must not open again as a duplicate room.
    await btn("Close dialog").click();
    await page.evaluate(() => {
      const key = "@hometaking/local-pilot/v1";
      const project = JSON.parse(localStorage.getItem(key));
      project.activeRoomId = project.rooms[0].id;
      project.rooms[0].updatedAt = "2026-09-12T23:59:59.000Z";
      localStorage.setItem(key, JSON.stringify(project));
    });
    await page.reload();
    await page.getByRole("tab", { name: "Rooms", exact: true }).click();
    await btn("Room options").click();
    await btn("Edit measurements").click();
    await btn("Resume draft against the current room").waitFor();
    assert.equal(
      await btn("Apply reviewed geometry to this room").isEnabled(),
      false,
    );
    await btn("Resume draft against the current room").click();
    await page.getByText("Bounding size: 600", { exact: false }).waitFor();
    await btn("Close dialog").click();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1"))
            .rooms[0].width,
      ),
      450,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS: unsupported fallback, review gates, measurement application, references preserved, reload, cancellation and draft recovery; no browser errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
