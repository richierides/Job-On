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
    const field = (n) => page.getByRole("textbox", { name: n, exact: true });
    const tab = (n) => page.getByRole("tab", { name: n, exact: true });
    const state = () =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("@hometaking/local-pilot/v1")),
      );
    const arthur = (p) => p.rooms.find((r) => r.name === "Arthur's bedroom");
    await page.goto("http://127.0.0.1:8081");
    await button("Add a room").click();
    assert.equal(await field("Width (metres)").count(), 0);
    await field("Room name").fill("Arthur's bedroom");
    await field("Who is this room for?").fill(
      "Arthur, a teenage boy who loves video games",
    );
    await field("What does it need to make room for?").fill(
      "Gaming, homework, sleep and having mates over",
    );
    await field("How should it feel?").fill(
      "Comfortable but stylish, a room that impresses his mates",
    );
    await field("What work needs doing?").fill(
      "Paint the walls\nImprove the lighting\nAdd storage",
    );
    await page.waitForTimeout(500);
    await page.screenshot({ path: "artifacts/hometaking/brief-first.png" });
    await button("Next: capture the room").click();
    await field("Width (metres)").fill("4.2");
    await field("Depth (metres)").fill("3.5");
    await button("Back to the brief").click();
    assert.equal(
      await field("How should it feel?").inputValue(),
      "Comfortable but stylish, a room that impresses his mates",
    );
    await button("Next: capture the room").click();
    assert.equal(await field("Width (metres)").inputValue(), "4.2");
    await button("Next: gather inspiration").click();
    await button("Next: arrange the room").waitFor();
    await page.waitForFunction(() =>
      JSON.parse(
        localStorage.getItem("@hometaking/local-pilot/v1"),
      )?.rooms.some((r) => r.name === "Arthur's bedroom"),
    );
    let r = arthur(await state());
    assert.equal(r.journey, "Ideas");
    assert.equal(r.items.length, 0);
    assert.deepEqual(
      r.works.map((w) => w.title),
      ["Paint the walls", "Improve the lighting", "Add storage"],
    );
    assert.equal(r.forWhom, "Arthur, a teenage boy who loves video games");
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("*"))
        if (el.scrollTop) el.scrollTop = 0;
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: "artifacts/hometaking/guided-ideas.png" });
    await button("Next: arrange the room").click();
    await button("Add furniture or feature").click();
    await button("Start with desk").click();
    await button("Add to my room").click();
    await button("Next: reveal the room").click();
    await button("Next: make it happen").click();
    await page
      .getByRole("checkbox", { name: "Paint the walls", exact: true })
      .click();
    await button("Step 1: brief").click();
    assert.equal(
      await field("What does it need to make room for?").inputValue(),
      "Gaming, homework, sleep and having mates over",
    );
    await field("How should it feel?").fill(
      "Comfortable, stylish and calm enough for homework",
    );
    await button("Save brief").click();
    assert.equal(
      await page
        .getByRole("checkbox", { name: "Paint the walls", exact: true })
        .getAttribute("aria-checked"),
      "true",
    );
    await page.reload();
    await button("Continue designing").click();
    await page
      .getByRole("checkbox", { name: "Paint the walls", exact: true })
      .waitFor();
    r = arthur(await state());
    assert.equal(r.journey, "Works");
    assert.equal(r.items[0].name, "Desk");
    assert.equal(r.works[0].done, true);
    assert.equal(r.brief, "Comfortable, stylish and calm enough for homework");
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("*"))
        if (el.scrollTop) el.scrollTop = 0;
    });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "artifacts/hometaking/guided-work.png" });
    assert.deepEqual(errors, []);
    console.log(
      "PASS: brief precedes measurements; back preserves answers; inspiration precedes furniture; jobs carry into work; brief edits preserve layout/tasks; reload resumes the correct stage.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
