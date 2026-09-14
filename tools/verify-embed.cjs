// npm install --no-save playwright; npx playwright install chromium
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.BROWSER_PATH ? {executablePath:process.env.BROWSER_PATH} : {}), args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:820,height:680}});
    const base = process.env.ASCHE_URL || 'https://asche.rammwiki.mrzetti.com';
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    if (!process.env.LIVE) {
      for (const file of ['index.html','app.js']) {
        await page.route(url=>url.origin===base && url.pathname===(file==='index.html'?'/':'/app.js'), route=>route.fulfill({path:path.resolve(__dirname,'../web',file),contentType:file.endsWith('.js')?'application/javascript':'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}}));
      }
    }
    async function parent(isolated) {
      await page.route(`${base}/embed-test`, route=>route.fulfill({contentType:'text/html',headers:isolated?{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}:{},body:'<body style="margin:0"><iframe src="/?embed=1" style="display:block;width:100%;height:100vh;border:0" allow="autoplay; fullscreen; cross-origin-isolated"></iframe>'}));
      await page.goto(`${base}/embed-test`);
      await page.frameLocator('iframe').locator('#embed-splash').waitFor();
      return page.frames().find(frame=>frame.url().includes('?embed=1'));
    }
    const frame = await parent(true);
    assert.equal(await frame.evaluate(()=>crossOriginIsolated),true);
    assert.equal(await frame.locator('#game iframe').count(),0);
    for (const width of [820,360]) {
      await page.setViewportSize({width,height:680});
      assert.equal(await frame.locator('header').isVisible(),false);
      assert.ok(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight));
    }
    await frame.getByRole('button',{name:'Load game',exact:true}).click();
    await page.waitForTimeout(20000);
    const emulator=page.frames().find(f=>f.url().includes('boxedwine.html'));
    assert.equal(await emulator.evaluate(()=>crossOriginIsolated),true);
    await emulator.locator('#canvas').click();
    await page.keyboard.down('Space');
    await page.waitForTimeout(200);
    await page.keyboard.up('Space');
    await frame.locator('#volume').fill('40');
    assert.equal(await frame.locator('audio, #music-toggle').count(),0);
    assert.ok(Math.abs(await emulator.evaluate(async()=>{
      const context=new AudioContext();
      const gain=context.gameGain.gain.value;
      await context.close();
      return gain;
    })-0.4)<0.001);
    await frame.getByRole('button',{name:'Fullscreen',exact:true}).click();
    assert.equal(await frame.evaluate(()=>document.fullscreenElement?.id),'game');
    await frame.evaluate(()=>document.exitFullscreen());
    await frame.getByRole('button',{name:'Restart game',exact:true}).click();
    assert.equal(await frame.locator('#game iframe').count(),1);
    assert.deepEqual(errors,[]);
    await page.unroute(`${base}/embed-test`);
    const blocked = await parent(false);
    assert.equal(await blocked.evaluate(()=>crossOriginIsolated),false);
    await blocked.getByRole('button',{name:'Load game',exact:true}).click();
    assert.equal(await blocked.locator('#game iframe').count(),0);
    assert.match(await blocked.locator('#status').textContent(),/containing wiki page/);
    console.log('PASS: compact nested iframe, lazy load, controls/fullscreen/restart, isolation guidance');
  } finally {await browser.close();}
})();
