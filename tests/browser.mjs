import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, stat } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
await mkdir('test-results', { recursive: true });
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
try {
  await page.goto('http://127.0.0.1:5173');
  await page.waitForSelector('[data-ready="true"]');
  await page.click('#play');
  const paused = await page.evaluate(() => window.__slowRail.state.distance);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__slowRail.state.distance), paused);
  await page.screenshot({ path: 'test-results/desktop-day.png' });
  await page.locator('#speed').fill('1.8');
  assert.equal(await page.locator('#speed-value').textContent(), '1.8×');
  await page.click('#play');
  await page.waitForTimeout(300);
  assert.notEqual(await page.evaluate(() => window.__slowRail.state.distance), paused);
  await page.click('#play');
  for (const time of ['sunset', 'night', 'day']) {
    await page.click(`button[data-time="${time}"]`);
    assert.equal(await page.locator('#app').getAttribute('data-time'), time);
    assert.equal(await page.locator(`button[data-time="${time}"]`).getAttribute('aria-pressed'), 'true');
    await page.waitForTimeout(1800);
    if (time !== 'day') await page.screenshot({ path: `test-results/desktop-${time}.png` });
  }
  await page.click('#follow'); assert.equal(await page.locator('#follow').getAttribute('aria-pressed'), 'false');
  await page.click('#follow'); assert.equal(await page.locator('#follow').getAttribute('aria-pressed'), 'true');
  await page.click('#zoom-in'); await page.click('#zoom-out'); await page.click('#reset');
  await page.mouse.move(800, 400); await page.mouse.down(); await page.mouse.move(900, 430, { steps: 6 }); await page.mouse.up();
  assert.equal(await page.locator('#follow').getAttribute('aria-pressed'), 'false');
  await page.click('#reset');
  await page.click('#sound'); assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
  await page.click('#sound'); assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
  const downloadPromise = page.waitForEvent('download'); await page.click('#save');
  const download = await downloadPromise; assert.ok(download.suggestedFilename().endsWith('.png'));
  await download.saveAs('test-results/postcard.png'); assert.ok((await stat('test-results/postcard.png')).size > 30000);
  await page.click('#record'); await page.waitForTimeout(1600);
  const videoPromise = page.waitForEvent('download'); await page.click('#record');
  const video = await videoPromise; assert.match(video.suggestedFilename(), /\.(mp4|webm)$/);
  await video.saveAs(`test-results/recording.${video.suggestedFilename().split('.').pop()}`);
  await page.locator('#scene canvas').focus(); await page.keyboard.press('Space');
  assert.equal(await page.locator('#play').getAttribute('aria-pressed'), 'false');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#follow').getAttribute('aria-pressed'), 'false');
  await page.click('#reset');
  const mobile = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.goto('http://127.0.0.1:5173'); await mobile.waitForSelector('[data-ready="true"]');
  assert.equal(await mobile.locator('#play').getAttribute('aria-pressed'), 'true');
  assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.screenshot({ path: 'test-results/mobile.png' });
  for (const selector of ['#play', '#follow', '#save', '#record']) {
    const rect = await mobile.locator(selector).boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= 375, `${selector} 화면 밖`);
  }
  await mobile.click('button[data-time="night"]'); await mobile.waitForTimeout(1500);
  await mobile.screenshot({ path: 'test-results/mobile-night.png' });
  await mobile.close();
  assert.deepEqual(errors, []);
  console.log('데스크톱·모바일 렌더, 시간대, 정지·속도, 추적·드래그, 소리, PNG·영상 저장, 키보드, 모션 감소: 통과');
  console.log(await page.evaluate(() => window.__slowRail.stats()));
} finally { await browser.close(); }
