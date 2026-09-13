const { chromium } = require('/root/repos/rammwiki/benzin/tests/browser/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({executablePath:'/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:1400,height:1100}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('https://asche.rammwiki.mrzetti.com/');
    await page.getByRole('button',{name:'Load game',exact:true}).click();
    await page.waitForTimeout(20000);
    const frame = page.frames().find(f => f.url().includes('boxedwine.html'));
    await frame.locator('#canvas').click();
    await page.waitForTimeout(3000);
    await frame.evaluate(() => {
      const context = Module.SDL2.audioContext;
      window.audioMeter = context.createAnalyser();
      context.gameGain.connect(audioMeter);
    });
    async function peak() {
      return frame.evaluate(async () => {
        let peak = 0;
        const samples = new Float32Array(audioMeter.fftSize);
        for (let i=0;i<60;i++) {
          if (audioMeter.context !== Module.SDL2.audioContext) {
            window.audioMeter = Module.SDL2.audioContext.createAnalyser();
            Module.SDL2.audioContext.gameGain.connect(audioMeter);
          }
          audioMeter.getFloatTimeDomainData(samples);
          for (const sample of samples) peak = Math.max(peak,Math.abs(sample));
          await new Promise(r => setTimeout(r,25));
        }
        return peak;
      });
    }
    await page.keyboard.down('Space');
    const audible = await peak();
    console.log(await frame.evaluate(()=>({state:Module.SDL2.audioContext.state,gain:Module.SDL2.audioContext.gameGain.gain.value,audioKeys:Object.keys(Module.SDL2.audio),active:navigator.userActivation.hasBeenActive})));
    await page.screenshot({path:'/tmp/opencode/asche-audio-state.png'});
    await page.keyboard.up('Space');
    assert.ok(audible > 0.001, `Expected audible PCM, got ${audible}`);
    await page.locator('#volume').fill('0');
    await page.waitForTimeout(200);
    await frame.locator('#canvas').click();
    await page.keyboard.down('Space');
    const muted = await peak();
    await page.keyboard.up('Space');
    assert.equal(muted,0);
    await page.locator('#volume').fill('35');
    assert.ok(Math.abs(await frame.evaluate(()=>Module.SDL2.audioContext.gameGain.gain.value)-0.35)<0.0001);
    assert.deepEqual(errors,[]);
    console.log({audible,muted,errors});
    await page.goto('https://benzin.rammwiki.mrzetti.com/');
    await page.waitForTimeout(8000);
    await page.locator('#game').click();
    await page.locator('#volume').fill('25');
    assert.equal(await page.evaluate(()=>document.querySelector('ruffle-player').ruffle().volume),0.25);
    const game = await page.locator('#game').boundingBox();
    const scores = await page.locator('.leaderboard').boundingBox();
    assert.ok(scores.x >= game.x + game.width);
    await page.screenshot({path:'/tmp/opencode/benzin-english.png'});
    await page.setViewportSize({width:390,height:844});
    const smallGame=await page.locator('#game').boundingBox();
    const smallScores=await page.locator('.leaderboard').boundingBox();
    assert.ok(smallScores.y > smallGame.y+smallGame.height);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
    console.log('Benzin volume and responsive layout passed');
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})();
