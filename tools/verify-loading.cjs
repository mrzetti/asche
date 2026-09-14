const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH || undefined,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:760},hasTouch:true});
  const base=process.env.ASCHE_URL || 'https://asche.rammwiki.mrzetti.com';
  const files={'/':'web/index.html','/app.js':'web/app.js','/loading.js':'web/loading.js','/emulator/diagnostics.js':'fallback/web/diagnostics.js','/emulator/boxedwine-shell.js':'fallback/web/boxedwine-shell.js'};
  for(const [url,file] of Object.entries(files)) await page.route(u=>u.origin===base && u.pathname===url,r=>r.fulfill({path:path.resolve(__dirname,'..',file),contentType:file.endsWith('.js')?'application/javascript':'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}}));
  let release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('**/boxedwine.zip',async route=>{await gate; await route.continue();});
  await page.addInitScript(()=>{
   window.loadingMessages=[];
   addEventListener('message',e=>{if(e.data?.type==='asche-loading') loadingMessages.push(e.data);});
  });
  await page.goto(base+'/?embed=1');
  await page.getByRole('button',{name:'Load game',exact:true}).click();
  await page.locator('.game-loading').waitFor({state:'visible'});
  await page.frameLocator('#game iframe').locator('#canvas').waitFor();
  const frame=page.frames().find(f=>f.url().includes('boxedwine.html'));
  await frame.waitForFunction(()=>typeof Module?.setStatus==='function');
  await frame.evaluate(()=>{
   window.previousSetStatus=Module.setStatus;
   const error=new Error('Unshortener failure');
   error.stack='onload@moz-extension://test/userscripts/URL-Shortener-Unshortener.user.js:64:31\nAt@https://example.test/emulator/boxedwine.html:10:91';
   dispatchEvent(new ErrorEvent('error',{message:error.message,error,filename:location.href+' line 10 > injectedScript'}));
  });
  assert.equal(await page.locator('#crash-report').isVisible(),false);
  assert.equal(await frame.evaluate(()=>Module.setStatus===previousSetStatus),true);
  const report=await frame.evaluate(()=>getAscheCrashReport());
  assert.equal(report.error,null);
  assert.equal(report.externalErrors.length,1);
  // A real frame at the top must not be ignored just because an extension
  // wrapper appears later in its stack.
  assert.equal(await frame.evaluate(()=>isAscheExtensionError({stack:'fail@https://example.test/boxedwine.js:1:1\nwrap@moz-extension://test/wrapper.js:1:1'})),false);
  await page.screenshot({path:'/tmp/opencode/asche-loading-mobile.png'});
  release();
  await page.locator('.game-loading').waitFor({state:'detached',timeout:90000});
  const messages=await page.evaluate(()=>loadingMessages);
  assert.ok(messages.some(m=>m.stage==='download' && m.loaded>0));
  assert.ok(messages.some(m=>m.stage==='boot'));
  await frame.locator('#canvas').tap();
  await page.screenshot({path:'/tmp/opencode/asche-loading-ready.png'});
  // Failed downloads must produce a visible, actionable state, not black.
  await page.unroute('**/boxedwine.zip');
  await page.route('**/boxedwine.zip',route=>route.fulfill({status:503,body:'Unavailable'}));
  await page.getByRole('button',{name:'Restart game',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.game-loading button')?.hidden===false);
  assert.equal(await page.locator('#crash-report').isVisible(),true);
  assert.equal(await page.locator('.game-loading').isVisible(),true);
  console.log('PASS: loading panel, real download progress, artwork readiness, extension isolation, and failed-download report');
 } finally {await browser.close();}
})();
