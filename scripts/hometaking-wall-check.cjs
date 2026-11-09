const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {}),
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 393, height: 1000 },
    });
    await page.goto("http://127.0.0.1:8081");
    const p = JSON.parse(
      fs.readFileSync("artifacts/hometaking/test-backup.json", "utf8"),
    );
    const r = p.rooms[0];
    r.width = 420;
    r.depth = 460;
    r.name = "Wall check";
    r.items = [
      {
        ...r.items[0],
        name: "Bed",
        width: 95,
        depth: 190,
        height: 80,
        x: 210,
        y: 230,
        rotation: 0,
      },
    ];
    p.rooms = [r];
    p.activeRoomId = r.id;
    await page.evaluate(
      (p) =>
        localStorage.setItem("@hometaking/local-pilot/v1", JSON.stringify(p)),
      p,
    );
    await page.reload();
    await page.getByRole("tab", { name: "Rooms", exact: true }).click();
    await page
      .getByRole("button", { name: "Select Bed", exact: true })
      .waitFor();
    await page.waitForTimeout(250);
    const results = [];
    for (const rotation of [0, 90]) {
      if (rotation)
        await page
          .getByRole("button", { name: "Rotate piece", exact: true })
          .click();
      for (const [right, bottom] of [
        [false, false],
        [true, false],
        [false, true],
        [true, true],
      ]) {
        const item = page.getByRole("button", {
          name: "Select Bed",
          exact: true,
        });
        const box = await item.boundingBox(),
          floor = await page.getByTestId("room-floor").boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          right ? floor.x + floor.width + 20 : floor.x - 20,
          bottom ? floor.y + floor.height + 20 : floor.y - 20,
          { steps: 15 },
        );
        await page.mouse.up();
        await page.waitForTimeout(150);
        const b = await item.boundingBox(),
          f = await page.getByTestId("room-floor").boundingBox();
        const dx = right ? b.x + b.width - f.x - f.width : b.x - f.x;
        const dy = bottom ? b.y + b.height - f.y - f.height : b.y - f.y;
        assert.ok(Math.abs(dx) < 0.15, `horizontal gap/overlap ${dx}px`);
        assert.ok(Math.abs(dy) < 0.15, `vertical gap/overlap ${dy}px`);
        results.push({ rotation, right, bottom, dx, dy });
        if (rotation === 0 && right === bottom)
          await page
            .getByTestId("room-floor")
            .screenshot({
              path: `artifacts/hometaking/wall-${right ? "bottom-right" : "top-left"}.png`,
            });
      }
    }
    console.log(
      "PASS: eight rendered corner alignments, no gap or overlap (within 0.15 px).",
    );
    fs.writeFileSync(
      "artifacts/hometaking/wall-results.json",
      JSON.stringify(results, null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
