import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, stat, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const base = process.env.SHIOSAI_WINDOW_URL || "http://127.0.0.1:5174";
const errors = [],
  results = {};
await mkdir("test-results/window", { recursive: true });
function watch(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (e) => {
    if (e.type() === "error") errors.push(e.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
}
async function open(options) {
  const page = await browser.newPage(options);
  watch(page);
  await page.goto(base);
  await page.waitForSelector('[data-ready="true"]');
  return page;
}
async function settle(page, ms = 1400) {
  await page.waitForTimeout(ms);
}
async function bounds(page) {
  const viewport = page.viewportSize();
  assert.ok(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
    "페이지가 화면 밖으로 넘칩니다",
  );
  const inDialog = await page.locator("dialog[open]").count();
  const locator = inDialog
    ? "dialog[open] button, dialog[open] a, dialog[open] input"
    : ".chrome button, .chrome a";
  for (const button of await page.locator(locator).all()) {
    if (
      !(await button.isVisible()) ||
      (await button.evaluate((e) => !!e.closest("[inert]")))
    )
      continue;
    const r = await button.boundingBox();
    assert.ok(
      r.width >= 43.9 && r.height >= 43.9,
      `${await button.getAttribute("id")} 터치 영역 ${r.width}x${r.height}`,
    );
    // A short dialog may scroll, but controls must stay inside horizontally.
    assert.ok(r.x >= 0 && r.x + r.width <= viewport.width + 0.5, "가로 잘림");
    if (!inDialog)
      assert.ok(
        r.y >= 0 && r.y + r.height <= viewport.height + 0.5,
        "세로 잘림",
      );
  }
}
try {
  const page = await open({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  await settle(page, 400);
  const initial = await page.evaluate(
    () => window.__windowSeat.stats().renderedFrames,
  );
  await settle(page, 1000);
  assert.equal(
    await page.evaluate(() => window.__windowSeat.stats().renderedFrames),
    initial,
    "모션 감소에서 연속 렌더",
  );
  await page.screenshot({ path: "test-results/window/arrival.png" });
  await page.click("#enter");
  await settle(page, 500);
  assert.equal(await page.getAttribute("#experience", "data-entered"), "true");
  assert.equal(await page.getAttribute("#sound", "aria-pressed"), "true");
  assert.equal(
    await page.evaluate(() => window.__windowSeat.audio().context),
    "running",
  );
  assert.equal(
    await page.evaluate(() => window.__windowSeat.audio().paused),
    false,
    "모션 감소 때문에 소리까지 꺼짐",
  );
  await settle(page, 6500);
  await page.screenshot({ path: "test-results/window/entered.png" });
  const original = await page.locator("canvas").screenshot();
  await page.mouse.move(500, 300);
  await page.mouse.down();
  await page.mouse.move(850, 550, { steps: 20 });
  await page.mouse.up();
  assert.ok(
    await page.evaluate(() => window.__windowSeat.stats().wipeCount > 10),
  );
  const wiped = await page.locator("canvas").screenshot();
  assert.notDeepEqual(original, wiped, "유리를 닦아도 화면이 바뀌지 않음");
  await page.screenshot({ path: "test-results/window/wiped.png" });
  await page.locator("canvas").focus();
  await page.keyboard.press("c");
  await page.keyboard.press("ArrowRight");
  await settle(page, 100);
  assert.ok(
    await page.evaluate(() => window.__windowSeat.stats().camera[0] > 0),
  );
  await page.click('[data-moment="night"]');
  await settle(page, 200);
  assert.equal(await page.evaluate(() => window.__windowSeat.stats().mood), 1);
  await page.screenshot({ path: "test-results/window/night.png" });
  await page.click("#menu-open");
  await page.locator("#rain").uncheck();
  assert.equal(
    await page.evaluate(() => window.__windowSeat.state.rain),
    false,
  );
  assert.equal(
    await page.evaluate(() => window.__windowSeat.audio().rain),
    false,
  );
  await page.locator("#volume").fill("25");
  assert.equal(
    await page.evaluate(() => window.__windowSeat.audio().volume),
    0.25,
  );
  await page.locator("#rain").check();
  await page.locator("#volume").fill("55");
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "menu-open",
  );
  await page.keyboard.press("h");
  assert.ok(await page.evaluate(() => document.querySelector(".quiet")));
  await page.keyboard.press("Escape");
  await settle(page, 100);
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "menu-open",
  );
  assert.equal(
    await page.evaluate(() => document.querySelector(".quiet")),
    null,
  );
  await page.click("#postcard-open");
  await page.fill("#memory", "오늘은 여기까지. 내일도 바다가 있기를.");
  await page.screenshot({ path: "test-results/window/postcard-desktop.png" });
  const photoPromise = page.waitForEvent("download");
  await page.click("#postcard-save");
  await (await photoPromise).saveAs("test-results/window/postcard.png");
  assert.ok((await stat("test-results/window/postcard.png")).size > 100000);
  await page.click("#postcard-open");
  assert.equal(
    await page.inputValue("#memory"),
    "오늘은 여기까지. 내일도 바다가 있기를.",
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => window.__windowSeat.state.running),
    false,
  );
  await page.click("#menu-open");
  await page.click("#record");
  await settle(page, 1400);
  assert.equal(await page.locator("#pause").isDisabled(), true);
  const videoPromise = page.waitForEvent("download");
  await page.click("#menu-open");
  await page.click("#record");
  const video = await videoPromise;
  const extension = video.suggestedFilename().split(".").pop();
  await video.saveAs(`test-results/window/recording.${extension}`);
  assert.equal(
    await page.evaluate(() => window.__windowSeat.state.running),
    false,
  );
  assert.equal(await page.locator("#pause").isDisabled(), false);
  await page.keyboard.press("Escape");
  await page.click("#pause");
  const times = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const frames = [];
        let previous;
        function sample(now) {
          if (previous) frames.push(now - previous);
          previous = now;
          if (frames.length >= 120) resolve(frames);
          else requestAnimationFrame(sample);
        }
        requestAnimationFrame(sample);
      }),
  );
  times.sort((a, b) => a - b);
  results.performance = {
    medianMs: times[60],
    p95Ms: times[114],
    ...(await page.evaluate(() => window.__windowSeat.stats())),
  };
  await page.click("#pause");
  await settle(page, 400);
  const paused = await page.evaluate(
    () => window.__windowSeat.stats().renderedFrames,
  );
  await settle(page, 1000);
  results.pausedExtraFrames =
    (await page.evaluate(() => window.__windowSeat.stats().renderedFrames)) -
    paused;
  assert.equal(results.pausedExtraFrames, 0);
  for (const [width, height] of [
    [1440, 900],
    [375, 812],
    [320, 568],
    [812, 375],
    [768, 1024],
  ]) {
    await page.setViewportSize({ width, height });
    await settle(page, 250);
    await bounds(page);
    await page.screenshot({
      path: `test-results/window/${width}x${height}.png`,
    });
    await page.click("#menu-open");
    await bounds(page);
    await page.keyboard.press("Escape");
  }
  await page.close();
  const mobile = await open({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  await settle(mobile, 300);
  await mobile.screenshot({ path: "test-results/window/mobile-arrival.png" });
  await mobile.tap("#enter");
  await settle(mobile, 1100);
  await mobile.tap("#sound");
  assert.equal(await mobile.getAttribute("#sound", "aria-pressed"), "false");
  await mobile.tap("#pause");
  await mobile.tap("#menu-open");
  await mobile.tap("#clear-glass");
  assert.ok(
    await mobile.evaluate(() => window.__windowSeat.stats().wipeCount > 0),
  );
  await mobile.tap("#postcard-open");
  await mobile.screenshot({ path: "test-results/window/mobile-postcard.png" });
  await mobile.close();
  assert.deepEqual(errors, []);
  results.errors = errors;
  await writeFile(
    "test-results/window/results.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
  console.log(
    "창가: 진입·소리·시간대·김 닦기·키보드·설정·엽서·영상·정지·5개 화면 크기 통과",
  );
} finally {
  await browser.close();
}
