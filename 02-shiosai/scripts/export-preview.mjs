import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('exports', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://127.0.0.1:5174');
  await page.waitForSelector('[data-ready="true"]', { timeout: 90000 });
  await page.click('#play');
  await page.evaluate(() => { window.__shiosai.state.time = 0; });
  await page.waitForTimeout(1200);
  const photoPromise = page.waitForEvent('download');
  await page.click('#photo');
  await (await photoPromise).saveAs('exports/shiosai-sunset.png');
  await page.click('[data-time="night"]'); await page.waitForTimeout(3200);
  const nightPromise = page.waitForEvent('download');
  await page.click('#photo');
  await (await nightPromise).saveAs('exports/shiosai-blue-hour.png');
  await page.click('[data-time="sunset"]'); await page.waitForTimeout(3200);
  await page.evaluate(() => { window.__shiosai.state.time = 6.5; });
  await page.click('#play');
  const videoPromise = page.waitForEvent('download', { timeout: 40000 });
  await page.click('#record');
  const video = await videoPromise;
  const extension = video.suggestedFilename().split('.').pop();
  await video.saveAs(`exports/shiosai-preview.${extension}`);
  console.log(`사진 2장과 영상: exports/shiosai-preview.${extension}`);
} finally { await browser.close(); }
