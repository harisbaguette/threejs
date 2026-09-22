import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [], results = {};
await mkdir('test-results/review', { recursive: true });
async function open(viewport) {
  const p = await browser.newPage({ viewport, reducedMotion: 'reduce' });
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  p.on('response', r => { if (r.status() >= 400) errors.push(r.url()); });
  await p.goto('http://127.0.0.1:5174/station.html');
  await p.waitForSelector('[data-ready="true"]', { timeout: 90000 });
  await p.waitForTimeout(1200);
  return p;
}
async function stationary(page) {
  await page.waitForTimeout(500);
  const start = await page.evaluate(() => window.__shiosai.stats().renderedFrames);
  await page.waitForTimeout(1100);
  const end = await page.evaluate(() => window.__shiosai.stats().renderedFrames);
  results.pausedFramesInOneSecond = end - start;
  assert.equal(end, start, '정지 상태에서 불필요하게 렌더한다');
}
async function cameras(page) {
  for (const name of ['close', 'coast', 'platform']) {
    await page.click(`[data-camera="${name}"]`);
    await page.waitForTimeout(350);
    assert.equal(await page.evaluate(() => window.__shiosai.state.camera), name);
    await page.screenshot({ path: `test-results/review/after-${name}.png` });
  }
  await page.locator('canvas').focus();
  for (let i = 0; i < 50; i++) await page.keyboard.press('ArrowDown');
  const [x, y, z] = await page.evaluate(() => window.__shiosai.stats().camera);
  assert.ok(y >= 1.2 && Number.isFinite(x + z));
  await page.screenshot({ path: 'test-results/review/after-camera-down.png' });
  await page.click('[data-camera="platform"]');
}
async function recordingFromPause(page) {
  assert.equal(await page.evaluate(() => window.__shiosai.state.running), false);
  const t = await page.evaluate(() => window.__shiosai.state.time);
  await page.click('#record'); await page.waitForTimeout(1300);
  assert.ok(await page.evaluate(start => window.__shiosai.state.time > start, t));
  assert.ok(await page.locator('#play').isDisabled());
  const promise = page.waitForEvent('download'); await page.click('#record');
  const video = await promise; await video.saveAs('test-results/review/paused-recording.mp4');
  assert.equal(await page.evaluate(() => window.__shiosai.state.running), false);
  assert.equal(await page.locator('#play').isDisabled(), false);
}
async function screenSizes(page) {
  for (const [width, height] of [[375, 812], [768, 1024], [812, 375], [320, 568]]) {
    await page.setViewportSize({ width, height });
    await page.click('[data-camera="platform"]'); await page.waitForTimeout(300);
    for (const control of await page.locator('button:visible').all()) {
      const r = await control.boundingBox();
      assert.ok(r.width >= 44 && r.height >= 44, `${await control.getAttribute('aria-label')} 터치 크기`);
      assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.width <= width + .5 && r.y + r.height <= height + .5, '버튼 화면 밖');
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight));
    await page.screenshot({ path: `test-results/review/after-${width}x${height}.png` });
  }
}
try {
  const p = await open({ width: 1440, height: 900 });
  await stationary(p); await cameras(p);
  await p.click('[data-time="night"]'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'test-results/review/after-night.png' });
  await p.click('[data-time="sunset"]'); await p.waitForTimeout(300);
  const photo = p.waitForEvent('download'); await p.click('#photo');
  await (await photo).saveAs('exports/review-after.png');
  await recordingFromPause(p);
  await p.click('#hide-ui');
  await p.waitForFunction(() => document.activeElement.id === 'show-ui');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'show-ui');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => document.activeElement.id === 'hide-ui');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'hide-ui');
  await p.click('#play');
  const frames = await p.evaluate(() => new Promise(resolve => {
    const times = []; let last = performance.now();
    function sample(now) { times.push(now - last); last = now; if (times.length < 100) requestAnimationFrame(sample); else resolve(times.slice(10).sort((a, b) => a - b)); }
    requestAnimationFrame(sample);
  }));
  results.medianFrameMs = frames[45]; results.p95FrameMs = frames[85];
  results.render = await p.evaluate(() => window.__shiosai.stats());
  await p.click('#play'); await screenSizes(p);
  assert.deepEqual(errors, []);
  await writeFile('test-results/review/after.json', JSON.stringify(results, null, 2));
  console.log('정지 렌더·카메라 경계·정지 중 녹화·포커스 복귀·4개 화면 크기: 통과', results);
} finally { await browser.close(); }
