import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

await mkdir('exports', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1456, height: 916 } });
  await page.goto('http://127.0.0.1:5173');
  await page.waitForSelector('[data-ready="true"]');
  await page.locator('#speed').fill('0.8');
  const postcardPromise = page.waitForEvent('download');
  await page.click('#save');
  const postcard = await postcardPromise;
  await postcard.saveAs('exports/slow-rail-postcard.png');
  const videoPromise = page.waitForEvent('download', { timeout: 30000 });
  await page.click('#record');
  await page.waitForTimeout(6500);
  await page.click('button[data-time="sunset"]');
  const video = await videoPromise;
  const extension = video.suggestedFilename().split('.').pop();
  await video.saveAs(`exports/slow-rail-preview.${extension}`);
  console.log(`엽서: exports/slow-rail-postcard.png\n영상: exports/slow-rail-preview.${extension}`);
  await page.close();
} finally { await browser.close(); }
