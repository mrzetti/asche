const {chromium}=require('/root/repos/rammwiki/benzin/tests/browser/node_modules/playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:'/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required'],headless:true});
try {
const page=await browser.newPage({viewport:{width:1000,height:760}});
const errors=[];
page.on('pageerror', error=>errors.push(error.message));
await page.goto(process.env.ASCHE_URL || 'http://127.0.0.1:8138/boxedwine.html?root=boxedwine&app=asche&p=RSTEIN.EXE&auto=true&sound=true&resolution=640x480');
const wrapped = !!process.env.ASCHE_URL;
if(wrapped) await page.getByRole('button',{name:'Load game',exact:true}).click();
assert.equal(await page.evaluate(()=>crossOriginIsolated),true);
await page.waitForTimeout(20000);
const canvas = wrapped ? page.frameLocator('#game iframe').locator('#canvas') : page.locator('#canvas');
await canvas.click();
await page.waitForTimeout(6000);
fs.mkdirSync('/tmp/opencode/asche-parent',{recursive:true});
await page.screenshot({path:'/tmp/opencode/asche-parent/start.png'});
let previous=await canvas.screenshot();
for(const [key, duration] of [['Space',150],['ArrowUp',150],['ArrowLeft',150]]) {
await page.keyboard.down(key);
await page.waitForTimeout(duration);
await page.screenshot({path:'/tmp/opencode/asche-parent/held-'+key+'.png'});
const current=await canvas.screenshot();
assert.ok(!current.equals(previous), 'Game canvas did not change after holding '+key);
previous=current;
await page.keyboard.up(key);
await page.screenshot({path:'/tmp/opencode/asche-parent/'+key+'.png'});
}
assert.deepEqual(errors,[]);
if(wrapped) {
await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
assert.equal(await page.evaluate(()=>document.fullscreenElement?.id),'game');
await page.evaluate(()=>document.exitFullscreen());
const oldFrame=await page.locator('#game iframe').elementHandle();
await page.getByRole('button',{name:'Restart game',exact:true}).click();
assert.equal(await oldFrame.evaluate(el=>el.isConnected),false);
await page.waitForTimeout(16000);
await page.screenshot({path:'/tmp/opencode/asche-parent/restarted.png'});
assert.deepEqual(errors,[]);
}
console.log('Held-key probe complete');
} finally {await browser.close();}
})();
