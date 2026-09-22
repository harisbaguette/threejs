import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, stat } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const url = process.env.SHIOSAI_URL || 'http://127.0.0.1:5174';
const errors = [];
await mkdir('test-results', { recursive: true });
function watch(page) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
}
async function open(page) {
  watch(page);
  await page.goto(url);
  await page.waitForSelector('[data-ready="true"]', { timeout: 90000 });
  await page.waitForTimeout(1000);
}
async function desktop(page) {
  await open(page);
  await page.click('#play');
  const time = await page.evaluate(() => window.__shiosai.state.time);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.__shiosai.state.time), time);
  await page.evaluate(() => { window.__shiosai.state.time = 0; });
  await page.waitForTimeout(250);
  await page.screenshot({ path: 'test-results/desktop-sunset.png' });
  await page.click('#rain');
  assert.equal(await page.evaluate(() => window.__shiosai.state.rain), false);
  await page.click('#rain');
  await page.click('#sound');
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
  await page.click('#sound');
  assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'false');
}
async function views(page) {
  for (const name of ['coast', 'close', 'platform']) {
    await page.click(`[data-camera="${name}"]`);
    assert.equal(await page.evaluate(() => window.__shiosai.state.camera), name);
    await page.waitForTimeout(2200);
    if (name !== 'platform') await page.screenshot({ path: `test-results/desktop-${name}.png` });
  }
  await page.click('[data-time="night"]');
  assert.equal(await page.locator('#scene-time').textContent(), '19:08');
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'test-results/desktop-night.png' });
  await page.click('[data-time="sunset"]');
  await page.click('#hide-ui');
  assert.ok(await page.locator('#app').evaluate(e => e.classList.contains('ui-hidden')));
  await page.click('#show-ui');
  await page.locator('#scene canvas').focus();
  await page.keyboard.press('h');
  assert.ok(await page.locator('#app').evaluate(e => e.classList.contains('ui-hidden')));
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#show-ui').isVisible(), false);
}
async function downloads(page) {
  const photoPromise = page.waitForEvent('download');
  await page.click('#photo');
  const photo = await photoPromise;
  assert.match(photo.suggestedFilename(), /\.png$/);
  await photo.saveAs('test-results/photo.png');
  assert.ok((await stat('test-results/photo.png')).size > 100000);
  await page.click('#play');
  const start = await page.evaluate(() => window.__shiosai.state.time);
  await page.click('#record');
  await page.waitForTimeout(2000);
  assert.ok(await page.evaluate(t => window.__shiosai.state.time > t, start));
  const videoPromise = page.waitForEvent('download');
  await page.click('#record');
  const video = await videoPromise;
  const extension = video.suggestedFilename().split('.').pop();
  assert.match(extension, /^(mp4|webm)$/);
  await video.saveAs(`test-results/video.${extension}`);
  assert.ok((await stat(`test-results/video.${extension}`)).size > 10000);
}
async function keyboard(page) {
  await page.locator('#scene canvas').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.__shiosai.state.running), false);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => window.__shiosai.state.camera), 'free');
  await page.click('[data-camera="platform"]');
  await page.waitForTimeout(2200);
  await page.mouse.move(770, 360); await page.mouse.down();
  await page.mouse.move(880, 390, { steps: 8 }); await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__shiosai.state.camera), 'free');
}
async function mobile(page) {
  await open(page);
  assert.equal(await page.evaluate(() => window.__shiosai.state.running), false);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  for (const selector of ['#play', '#rain', '#sound', '#photo', '#record', '[data-camera="close"]', '[data-time="night"]']) {
    const r = await page.locator(selector).boundingBox();
    assert.ok(r.x >= 0 && r.x + r.width <= 375 && r.y + r.height <= 812, `${selector} 화면 밖`);
    assert.ok(r.height >= 44, `${selector} 터치 영역`);
  }
  await page.screenshot({ path: 'test-results/mobile-sunset.png' });
  await page.click('[data-time="night"]'); await page.waitForTimeout(2400);
  await page.screenshot({ path: 'test-results/mobile-night.png' });
  await page.click('[data-camera="coast"]');
  assert.equal(await page.evaluate(() => window.__shiosai.state.camera), 'coast');
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop(page); await views(page); await downloads(page); await keyboard(page);
  console.log('데스크톱:', await page.evaluate(() => window.__shiosai.stats()));
  await page.close();
  const phone = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await mobile(phone); await phone.close();
  assert.deepEqual(errors, []);
  console.log('데스크톱·모바일, 정지·재생, 3개 시점, 시간대·비·소리, PNG·영상, 드래그·키보드, 모션 감소: 통과');
} finally { await browser.close(); }
