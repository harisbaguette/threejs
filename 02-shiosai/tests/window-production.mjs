import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
try {
  const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
  await page.goto('http://127.0.0.1:4174');
  await page.waitForSelector('[data-ready="true"]');
  assert.equal(await page.evaluate(()=>typeof window.__windowSeat),'undefined');
  await page.click('#enter');
  await page.click('[data-moment="night"]');
  await page.click('#postcard-open');
  await page.fill('#memory','바다가 있던 저녁.');
  const promise=page.waitForEvent('download');await page.click('#postcard-save');
  await(await promise).saveAs('test-results/window/production-postcard.png');
  for(const [width,height] of [[320,568],[375,812],[768,1024],[812,375]]){
    await page.setViewportSize({width,height});
    await page.waitForTimeout(200);
    for(const button of await page.locator('.chrome button').all()){
      const r=await button.boundingBox();
      assert.ok(r.width>=44&&r.height>=44);
      assert.ok(r.x>=0&&r.x+r.width<=width+.5&&r.y>=0&&r.y+r.height<=height+.5,'control outside viewport');
    }
  }
  await page.screenshot({path:'test-results/window/production-landscape.png'});
  await page.click('#menu-open');
  await page.click('.station-link');
  await page.waitForSelector('#app[data-ready="true"]');
  assert.equal(await page.evaluate(()=>typeof window.__shiosai),'undefined');
  assert.deepEqual(errors,[]);
  console.log('배포 빌드: 창가 진입·밤·엽서·4개 화면 크기·기존 승강장 경로 정상');
}finally{await browser.close();}
