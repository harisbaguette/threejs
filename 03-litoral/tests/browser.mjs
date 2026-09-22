import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], results = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
function track(page) {
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
}
track(page);
const state = () => page.evaluate(() => window.__litoral.state);
const check = (name, condition) => { assert.ok(condition, name); results.push(name); console.log('PASS', name); };
async function hold(key, duration) {
  await page.keyboard.down(key); await page.waitForTimeout(duration); await page.keyboard.up(key);
}
try {
  await page.goto('http://127.0.0.1:5175/?test');
  await page.waitForSelector('[data-ready="true"]', { timeout: 90000 });
  await page.screenshot({ path: 'test-results/desktop-intro.png' });
  await page.click('#start'); await page.waitForTimeout(700);
  check('game starts in playing mode', (await state()).mode === 'playing');
  const avatar = await state();
  check('human model has natural height and stands beside the controller', avatar.avatarHeight > 1.55 && avatar.avatarHeight < 2.05 && Math.hypot(avatar.avatarCenter[0] - avatar.x, avatar.avatarCenter[2] - avatar.z) < .5 && Math.abs(avatar.avatarGround - avatar.y) < .25);
  let before = await state();
  await hold('w', 1200); let walked = await state();
  const walkDistance = Math.hypot(walked.x - before.x, walked.z - before.z);
  check('W walks the character forward', walkDistance > 1.7 && walked.z < before.z);
  await page.waitForTimeout(250); before = await state();
  await page.keyboard.down('Shift'); await hold('w', 1200); await page.keyboard.up('Shift');
  const sprint = await state();
  check('sprint is faster and consumes stamina', Math.hypot(sprint.x - before.x, sprint.z - before.z) > walkDistance * 1.5 && sprint.stamina < 1);
  await page.keyboard.press('Space'); await page.waitForTimeout(160);
  check('space jumps above ground', (await state()).y > .5);
  await page.waitForTimeout(950);
  check('jump lands back on ground', (await state()).grounded && (await state()).y === .16);
  await page.screenshot({ path: 'test-results/desktop-game.png' });

  const yaw = (await state()).cameraYaw;
  await page.mouse.move(740, 400); await page.mouse.down(); await page.mouse.move(900, 425, { steps: 8 }); await page.mouse.up();
  check('drag rotates camera', Math.abs((await state()).cameraYaw - yaw) > .3);
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  before = await state(); await hold('w', 350);
  check('pause freezes movement', (await state()).mode === 'paused' && (await state()).z === before.z);
  await page.selectOption('#quality', 'high'); await page.waitForTimeout(650);
  check('high-quality SSAO renders', (await state()).quality === 'high');
  await page.click('#resume'); await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/desktop-high.png' });
  await page.keyboard.press('Escape');
  await page.selectOption('#quality', 'balanced'); await page.click('#resume');
  await page.keyboard.press('m');
  check('M opens the exploration map', await page.locator('#map-dialog').isVisible());
  await page.screenshot({ path: 'test-results/desktop-map.png' });
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  check('closing map resumes play', (await state()).mode === 'playing');

  for (const [id, x, z] of [['harbor', -23, 5.5], ['cafe', 4.5, -15], ['fountain', 21, -40], ['lighthouse', -31, -70]]) {
    await page.evaluate(([x, z]) => window.__litoralTest.place(x, z), [x, z]);
    await page.waitForTimeout(180);
    check(`${id} is reachable for interaction`, (await state()).near === id);
    await page.keyboard.press('e');
    check(`${id} discovery is recorded`, (await state()).found.includes(id));
  }
  check('all four landmarks complete the journey', (await state()).found.length === 4);
  await page.screenshot({ path: 'test-results/lighthouse.png' });
  await page.reload(); await page.waitForSelector('[data-ready="true"]', { timeout: 90000 });
  await page.click('#start'); await page.waitForTimeout(200);
  check('discoveries and position survive reload', (await state()).found.length === 4 && (await state()).x < -25);
  const downloadPromise = page.waitForEvent('download'); await page.click('#photo');
  const download = await downloadPromise;
  check('photo exports a PNG', download.suggestedFilename().endsWith('.png'));
  await download.saveAs('test-results/postcard.png');
  await page.click('#sound'); check('ambient sound can be enabled', await page.locator('#sound').getAttribute('aria-pressed') === 'true');
  await page.click('#sound');
  await page.keyboard.press('Escape'); await page.click('#reset-position');
  check('return to start resets character safely', Math.abs((await state()).x) < .01 && Math.abs((await state()).z - 33) < .01);

  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage(); track(mobile);
  await mobile.goto('http://127.0.0.1:5175/'); await mobile.waitForSelector('[data-ready="true"]', { timeout: 90000 });
  await mobile.screenshot({ path: 'test-results/mobile-intro.png' });
  await mobile.click('#start'); await mobile.waitForTimeout(500);
  check('mobile joystick is visible', await mobile.locator('#joystick').isVisible());
  const stick = await mobile.locator('#joystick').boundingBox();
  const mobileBefore = await mobile.evaluate(() => window.__litoral.state.z);
  await mobile.mouse.move(stick.x + stick.width / 2, stick.y + 12); await mobile.mouse.down();
  await mobile.waitForTimeout(900); await mobile.mouse.up();
  check('mobile joystick moves the player', await mobile.evaluate(() => window.__litoral.state.z) < mobileBefore - .8);
  await mobile.screenshot({ path: 'test-results/mobile-game.png' });
  check('mobile has no horizontal overflow', await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await mobile.click('#pause'); await mobile.selectOption('#quality', 'low'); await mobile.click('#resume');
  check('low quality works on mobile', await mobile.evaluate(() => window.__litoral.state.quality) === 'low');
  await mobileContext.close();
  check('no browser, asset, or WebGL errors', errors.length === 0);
  await writeFile('test-results/results.json', JSON.stringify({ checks: results, errors, desktop: await state() }, null, 2));
  console.log(`${results.length} checks passed.`);
} catch (e) {
  console.log('ERRORS', errors); await page.screenshot({ path: 'test-results/failure.png' }); throw e;
} finally { await browser.close(); }
