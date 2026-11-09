const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
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
      viewport: { width: 393, height: 852 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const button = (n) => page.getByRole("button", { name: n, exact: true });
    const tab = (n) => page.getByRole("tab", { name: n, exact: true });
    const field = (n) => page.getByRole("textbox", { name: n, exact: true });
    const stored = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1")),
      );
    const bed = (p) => p.rooms[0].items.find((i) => i.name === "Bed");
    await page.goto("http://127.0.0.1:8081");
    await tab("Rooms").click();
    await button("Add furniture or feature").click();
    await button("Start with bed").click();
    await page.screenshot({ path: "artifacts/hometaking/basic-furniture.png" });
    assert.equal(await field("Product link (optional)").count(), 0);
    assert.equal(await field("Width (cm)").inputValue(), "150");
    await button("Add to my room").click();
    await button("Rotate piece").click();
    await button("Move left").click();
    await page.waitForFunction(() => {
      const p = JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1"));
      return p?.rooms[0].items.some(
        (i) => i.name === "Bed" && i.rotation === 90,
      );
    });
    const before = bed(await stored());
    assert.equal(before.stage, "layout");
    assert.equal(before.dimensionsConfirmed, false);
    await tab("Works").click();
    await tab("To buy").click();
    assert.equal(await button("Mark Bed as bought").count(), 0);
    await tab("Rooms").click();
    await button("Edit Bed").click();
    await button("Specify a product or photo").click();
    await field("Product link (optional)").fill("https://example.com/bed");
    await field("Width (cm)").fill("170");
    await field("Price in £ (optional)").fill("600");
    await button("Save piece").click();
    await page
      .getByText("Check and confirm the dimensions before adding this piece.")
      .waitFor();
    await page
      .getByRole("checkbox", { name: "Dimensions confirmed", exact: true })
      .click();
    await button("Save piece").click();
    await page.waitForFunction(() =>
      JSON.parse(
        localStorage.getItem("@hometaking/local-pilot/v1"),
      ).rooms[0].items.some((i) => i.name === "Bed" && i.stage === "product"),
    );
    const after = bed(await stored());
    assert.equal(after.id, before.id);
    assert.equal(after.x, before.x);
    assert.equal(after.y, before.y);
    assert.equal(after.rotation, before.rotation);
    assert.equal(after.width, 170);
    await tab("Works").click();
    await tab("To buy").click();
    await button("Mark Bed as bought").waitFor();
    await page.reload();
    await tab("Rooms").click();
    await button("Edit Bed").click();
    assert.equal(
      await field("Product link (optional)").inputValue(),
      "https://example.com/bed",
    );
    assert.equal(await field("Width (cm)").inputValue(), "170");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: basic bed with estimated dimensions, no premature shopping item, product upgrade preserves identity/position/rotation, updated dimensions, reload.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
