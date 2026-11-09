const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("fs");
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
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    const button = (n) => page.getByRole("button", { name: n, exact: true });
    const field = (n) => page.getByRole("textbox", { name: n, exact: true });
    const tab = (n) => page.getByRole("tab", { name: n, exact: true });
    await page.goto("http://127.0.0.1:8081");
    await tab("Rooms").click();
    await button("Add the door").click();
    await button("Bottom wall").click();
    await field("Door width (cm)").fill("80");
    await field("Distance from left corner (cm)").fill("30");
    await button("Add door").click();
    await button("Select Door").waitFor();
    await page.getByTestId("room-floor").scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page
      .getByTestId("room-floor")
      .screenshot({ path: "artifacts/hometaking/door-plan.png" });
    await button("Add furniture or feature").click();
    await button("Start with office chair").click();
    assert.equal(await field("Width (cm)").inputValue(), "65");
    await button("Add to my room").click();
    await button("Next: reveal the room").click();
    await button("Reveal my room").click();
    await button("Save rendered image").waitFor();
    await page.waitForFunction(
      () =>
        !document
          .querySelector('[aria-label="Save rendered image"]')
          ?.hasAttribute("disabled"),
    );
    await page.getByTestId("room-render").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await page
      .getByTestId("room-render")
      .screenshot({ path: "artifacts/hometaking/reveal-3d.png" });
    await page.screenshot({ path: "artifacts/hometaking/reveal-screen.png" });
    const canvas = page.getByTestId("room-render").locator("canvas");
    assert.equal(await canvas.count(), 1);
    const download = page.waitForEvent("download");
    await button("Save rendered image").click();
    const image = await download;
    await image.saveAs("artifacts/hometaking/render-export.png");
    assert.ok(
      fs.statSync("artifacts/hometaking/render-export.png").size > 10000,
    );
    await button("Specify: Office chair").click();
    await field("Product link (optional)").fill(
      "https://example.com/office-chair",
    );
    await page
      .getByRole("checkbox", { name: "Dimensions confirmed", exact: true })
      .click();
    await button("Save piece").click();
    await button("Edit product: Office chair").waitFor();
    await button("Wall finish: Muted green").click();
    await button("Next: make it happen").click();
    assert.equal(
      await page
        .getByRole("button", { name: "Open existing DIY jobs" })
        .count(),
      0,
    );
    await button("Save and return home").click();
    await button("Manage rooms").waitFor();
    await button("Project settings").click();
    assert.equal(
      await page
        .getByRole("button", { name: "Open existing DIY jobs" })
        .count(),
      0,
    );
    await button("Close dialog").click();
    await page.reload();
    await tab("Rooms").click();
    await button("Select Door").waitFor();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: door symbol, office chair, Layout → Reveal → Work → Home, real WebGL render and PNG export, product specification, finish colour, persistence, no legacy links or console errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
