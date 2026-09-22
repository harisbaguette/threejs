import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

await mkdir("exports", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.SHIOSAI_WINDOW_URL || "http://127.0.0.1:5174");
  await page.waitForSelector('[data-ready="true"]');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "exports/window-arrival.png" });
  await page.click("#enter");
  await page.waitForTimeout(7000);
  await page.screenshot({ path: "exports/window-dusk.png" });
  await page.click("#postcard-open");
  await page.fill("#memory", "오늘은 여기까지. 내일도 바다가 있기를.");
  const postcard = page.waitForEvent("download");
  await page.click("#postcard-save");
  await (await postcard).saveAs("exports/window-postcard.png");
  await page.click('[data-moment="night"]');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "exports/window-night.png" });
  await page.click('[data-moment="dusk"]');
  await page.waitForTimeout(4000);
  await page.click("#menu-open");
  const video = page.waitForEvent("download", { timeout: 30000 });
  await page.click("#record");
  const file = await video;
  const extension = file.suggestedFilename().split(".").pop();
  await file.saveAs(`exports/window-preview.${extension}`);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.click('[data-moment="night"]');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "exports/window-mobile.png" });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("창가 데스크톱·모바일 4장, 1800×1440 엽서, 12초 영상 생성 완료.");
} finally {
  await browser.close();
}
