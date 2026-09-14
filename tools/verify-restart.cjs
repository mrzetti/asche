const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');

// Verifies the wrapper's automatic game-over restart against the real game:
// load, start, lose the first life on the first platform, and check that the
// wrapper shows its own overlay and reloads the emulator without a click.
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH || undefined,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 try {
  const page=await browser.newPage({viewport:{width:1024,height:800}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.ASCHE_URL || 'https://asche.rammwiki.mrzetti.com';
  // Serve the wrapper files from the checkout so the check covers this tree;
  // the emulator and game stay on the target origin.
  const files={'/':'web/index.html','/app.js':'web/app.js','/loading.js':'web/loading.js','/touch-controls.css':'web/touch-controls.css','/touch-controls.js':'web/touch-controls.js'};
  for(const [url,file] of Object.entries(files)) {
   await page.route(u=>u.origin===base && u.pathname===url,r=>r.fulfill({path:path.resolve(__dirname,'..',file),contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'application/javascript':'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}}));
  }
  await page.goto(base+'/');
  await page.getByRole('button',{name:'Load game',exact:true}).click();
  const emulatorFrame=async()=>{
   for(let i=0;i<240;i++) {
    const frame=page.frames().find(f=>f.url().includes('boxedwine.html'));
    if(frame) return frame;
    await page.waitForTimeout(500);
   }
   throw new Error('emulator frame did not appear');
  };
  const frame=await emulatorFrame();
  await page.locator('.game-loading').waitFor({state:'detached',timeout:180000});
  assert.match(await page.locator('#status').textContent(),/Tap the title screen/);
  // The title screen carries the white logo, so it must never look like game over.
  await page.waitForTimeout(6000);
  assert.equal(await page.locator('#game-over').count(),0,'title screen misdetected as game over');
  await page.screenshot({path:'/tmp/opencode/asche-restart-title.png'});

  await frame.locator('#canvas').click({position:{x:320,y:260}});
  await page.waitForTimeout(2500);
  assert.equal(await page.locator('#game-over').count(),0,'in-game screen misdetected as game over');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(4000);
  await page.keyboard.up('ArrowLeft');
  await page.locator('#game-over').waitFor({state:'visible',timeout:30000});
  const overlay=(await page.locator('#game-over').innerText()).replace(/\n+/g,' | ');
  assert.match(overlay,/GAME OVER/i);
  assert.match(overlay,/Starting a new game in \d+ s/);
  await page.screenshot({path:'/tmp/opencode/asche-restart-gameover.png'});

  // The countdown must reload the emulator on its own, without a click.
  await page.locator('.game-loading').waitFor({state:'visible',timeout:15000});
  await page.locator('.game-loading').waitFor({state:'detached',timeout:180000});
  assert.equal(await page.locator('#game-over').count(),0,'overlay stayed after the restart');
  assert.match(await page.locator('#status').textContent(),/Tap the title screen/);
  assert.deepEqual(errors,[]);
  console.log('PASS: game-over detection, countdown and automatic emulator restart');
 } finally {await browser.close();}
})();
