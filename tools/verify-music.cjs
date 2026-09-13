const {chromium} = require('/root/repos/rammwiki/benzin/tests/browser/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({executablePath:'/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://asche.rammwiki.mrzetti.com/');
    assert.equal(await page.locator('#music').evaluate(a => a.paused), true);
    await page.getByRole('button',{name:'Load game',exact:true}).click();
    await page.waitForTimeout(20000);
    await page.frameLocator('#game iframe').locator('#canvas').click();
    await page.waitForTimeout(3500);
    if (await page.getByRole('button',{name:'Play music',exact:true}).count()) {
      await page.getByRole('button',{name:'Play music',exact:true}).click();
    }
    await page.waitForFunction(() => document.getElementById('music').currentTime > 0.5);
    const state = await page.locator('#music').evaluate(a => ({volume:a.volume,duration:a.duration,loop:a.loop}));
    assert.ok(Math.abs(state.volume - 0.175) < 0.001);
    assert.ok(state.duration > 230 && state.duration < 233);
    assert.equal(state.loop,true);
    await page.getByRole('button',{name:'Disable music',exact:true}).click();
    assert.equal(await page.locator('#music').evaluate(a => a.paused),true);
    const effectVolume = await page.frames().find(f=>f.url().includes('boxedwine.html')).evaluate(()=>Module.SDL2.audioContext.gameGain.gain.value);
    assert.ok(Math.abs(effectVolume-0.7)<0.001);
    await page.getByRole('button',{name:'Enable music',exact:true}).click();
    await page.waitForFunction(()=>!document.getElementById('music').paused);
    await page.locator('#volume').fill('0');
    assert.equal(await page.locator('#music').evaluate(a=>a.volume),0);
    await page.locator('#volume').fill('40');
    assert.equal(await page.locator('#music').evaluate(a=>a.volume),0.1);
    await page.getByRole('button',{name:'Disable music',exact:true}).click();
    await page.getByRole('button',{name:'Restart game',exact:true}).click();
    assert.deepEqual(await page.locator('#music').evaluate(a=>({paused:a.paused,time:a.currentTime})),{paused:true,time:0});
    await page.reload();
    assert.equal(await page.getByRole('button',{name:'Enable music',exact:true}).count(),1);
    assert.deepEqual(errors,[]);
    console.log('PASS: full track playback, quiet volume, music-only toggle, master mute, restart and saved preference');
  } finally { await browser.close(); }
})();
