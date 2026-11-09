/* Run against the local web preview. PLAYWRIGHT_MODULE may point to a bundled runtime. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const out = path.resolve("artifacts/hometaking");
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 852 },
      deviceScaleFactor: 1,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const button = (n) => page.getByRole("button", { name: n, exact: true });
    const tab = (n) => page.getByRole("tab", { name: n, exact: true });
    const field = (n) => page.getByRole("textbox", { name: n, exact: true });
    const saved = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1")),
      );
    await page.goto(process.env.HOMETAKING_URL || "http://127.0.0.1:8081");
    await page.getByText("A home,").waitFor();
    await page.screenshot({ path: path.join(out, "home.png") });
    await tab("Ideas").click();
    await page.screenshot({ path: path.join(out, "ideas.png") });
    await tab("Rooms").click();
    await button("Select Lounge chair").click();
    await button("Rotate piece").click();
    await page.waitForFunction(() =>
      localStorage.getItem("@hometaking/local-pilot/v1"),
    );
    assert.equal(
      (await saved()).rooms[0].items.find((i) => i.name === "Lounge chair")
        .rotation,
      90,
    );
    await button("Undo last change").click();
    await page.waitForFunction(
      () =>
        JSON.parse(
          localStorage.getItem("@hometaking/local-pilot/v1"),
        ).rooms[0].items.find((i) => i.name === "Lounge chair").rotation === 0,
    );
    await page.screenshot({ path: path.join(out, "room.png") });
    await tab("Works").click();
    await page.screenshot({ path: path.join(out, "works.png") });
    await tab("Home").click();
    await button("Add a room").click();
    await button("Next: capture the room").click();
    await page
      .getByText(
        "Give the room a name and describe what it needs to make room for.",
      )
      .waitFor();
    await field("Room name").fill("Study");
    await field("What does it need to make room for?").fill(
      "Reading and working from home",
    );
    await button("Next: capture the room").click();
    await button("Next: gather inspiration").click();
    await page
      .getByText(
        "Give the room a name and enter dimensions between 0.5 and 30 metres.",
      )
      .waitFor();
    await field("Width (metres)").fill("4");
    await field("Depth (metres)").fill("3");
    await button("Next: gather inspiration").click();
    await button("Next: arrange the room").click();
    await button("Add furniture or feature").click();
    await field("Item name").fill("Reading chair");
    await button("Specify a product or photo").click();
    await field("Product link (optional)").fill("https://example.com/chair");
    await field("Width (cm)").fill("80");
    await field("Depth (cm)").fill("90");
    await field("Height (cm)").fill("76");
    await field("Price in £ (optional)").fill("249");
    await button("Add to my room").click();
    await page
      .getByText("Check and confirm the dimensions before adding this piece.")
      .waitFor();
    await page
      .getByRole("checkbox", { name: "Dimensions confirmed", exact: true })
      .click();
    await button("Add to my room").click();
    await button("Rotate piece").click();
    await button("Move right").click();
    await page.waitForFunction(() => {
      const p = JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1"));
      return p.rooms.find((r) => r.name === "Study")?.items[0]?.x === 210;
    });
    let p = await saved();
    let r = p.rooms.find((r) => r.name === "Study");
    assert.equal(r.items[0].rotation, 90);
    assert.equal(r.items[0].price, 249);
    await button("Select Reading chair").scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    const bounds = await button("Select Reading chair").boundingBox();
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      bounds.x + bounds.width / 2 + 30,
      bounds.y + bounds.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
    await page.waitForFunction(() => {
      const p = JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1"));
      return p.rooms.find((r) => r.name === "Study")?.items[0]?.x > 220;
    });
    const snapped = (await saved()).rooms.find((r) => r.name === "Study")
      .items[0];
    assert.equal(snapped.x % 10, 0);
    assert.equal(snapped.y % 10, 0);
    await tab("Works").click();
    await tab("To buy").click();
    await page.getByText("£249.00").first().waitFor();
    await button("Mark Reading chair as bought").click();
    await page.getByText("No products to buy yet.", { exact: false }).waitFor();
    await tab("To do").click();
    await button("Add a task").click();
    await field("Task name").fill("Paint the walls");
    await button("Save").click();
    await page
      .getByRole("checkbox", { name: "Paint the walls", exact: true })
      .click();
    await tab("Ideas").click();
    await button("Edit design brief").click();
    await field("How should it feel?").fill(
      "Warm white walls and a rust chair.",
    );
    await button("Save brief").click();
    const chooser = page.waitForEvent("filechooser");
    await button("Add pictures").click();
    await (
      await chooser
    ).setFiles({
      name: "inspiration.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await field("Your note").fill("This warm palette");
    await button("Save idea").click();
    await page.getByText("This warm palette").waitFor();
    await button("Project settings").click();
    const download = page.waitForEvent("download");
    await button("Export backup").click();
    const downloaded = await download;
    const backup = path.join(out, "test-backup.json");
    await downloaded.saveAs(backup);
    const exported = JSON.parse(fs.readFileSync(backup, "utf8"));
    assert.equal(
      exported.rooms.find((r) => r.name === "Study").ideas[0].note,
      "This warm palette",
    );
    await button("Close dialog").click();
    await page.reload();
    await page.getByText("A home,").waitFor();
    await tab("Works").click();
    await page
      .getByRole("checkbox", { name: "Paint the walls", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Paint the walls" })
        .getAttribute("aria-checked"),
      "true",
    );
    await button("Project settings").click();
    const restore = page.waitForEvent("filechooser");
    await button("Restore backup").click();
    await (await restore).setFiles(backup);
    await button("Replace with backup").click();
    await page.getByText("A home,").waitFor();
    p = await saved();
    assert.equal(
      p.rooms.find((r) => r.name === "Study").brief,
      "Warm white walls and a rust chair.",
    );
    await tab("Rooms").click();
    await button("Room options").click();
    await button("Delete this room").click();
    await button("Delete room").click();
    await button("Project settings").click();
    await button("Undo last change").click();
    await button("Close dialog").click();
    await page.getByText("Study", { exact: true }).waitFor();
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.screenshot({
        path: path.join(out, `responsive-${width}.png`),
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await tab("Rooms").click();
      await page.screenshot({ path: path.join(out, `rooms-${width}.png`) });
      await tab("Home").click();
    }
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, "browser-results.json"),
      JSON.stringify(
        {
          result: "passed",
          viewports: [393, 320, 768, 1440],
          checks: [
            "room validation",
            "furniture dimensions confirmation",
            "rotation",
            "10 cm move",
            "drag",
            "undo",
            "shopping totals and bought status",
            "tasks",
            "brief",
            "photo upload",
            "reload persistence",
            "backup export and restore",
            "room delete and undo",
          ],
          consoleErrors: errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "PASS: room, furniture, drag, shopping, tasks, photos, persistence, backup, undo and responsive checks.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
