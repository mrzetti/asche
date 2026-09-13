const {chromium}=require('/root/repos/rammwiki/benzin/tests/browser/node_modules/playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
(async()=>{
  const browser=await chromium.launch({executablePath:'/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage();
    if (!process.env.LIVE) {
      for (const [url,file] of [['/','web/index.html'],['/app.js','web/app.js'],['/emulator/boxedwine.html','fallback/web/boxedwine.html'],['/emulator/diagnostics.js','fallback/web/diagnostics.js']]) {
        await page.route(u=>u.pathname===url,route=>route.fulfill({path:path.resolve(file),contentType:file.endsWith('.js')?'application/javascript':'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cross-Origin-Resource-Policy':'same-origin'}}));
      }
    }
    await page.goto('https://asche.rammwiki.mrzetti.com/');
    await page.getByRole('button',{name:'Load game',exact:true}).click();
    await page.waitForTimeout(20000);
    const frame=page.frames().find(f=>f.url().includes('boxedwine.html'));
    assert.equal(await page.locator('#crash-report').isVisible(),false);
    await frame.evaluate(()=>{
      console.warn('Before the first failure');
      dispatchEvent(new ErrorEvent('error',{message:'Synthetic first failure',error:new Error('Synthetic first failure')}));
      console.clear();
      dispatchEvent(new ErrorEvent('error',{message:'Secondary mouse failure'}));
    });
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download crash report'}).click();
    const download=await downloadPromise;
    const report=JSON.parse(await fs.readFile(await download.path(),'utf8'));
    assert.equal(report.error.message,'Synthetic first failure');
    assert.ok(report.logs.some(entry=>entry.message==='Before the first failure'));
    assert.ok(report.runtime.stackPointer>0);
    assert.ok(report.runtime.memoryBytes>65536);
    assert.equal(report.isolated,true);
    await page.getByRole('button',{name:'Restart game',exact:true}).click();
    assert.equal(await page.locator('#crash-report').isVisible(),true);
    console.log('PASS: first failure, prior logs and runtime state survive console.clear, later errors and game restart');
  } finally {await browser.close();}
})();
