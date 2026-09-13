const {chromium}=require('/root/repos/rammwiki/benzin/tests/browser/node_modules/playwright');
(async()=>{
const browser=await chromium.launch({executablePath:'/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
try {
const page=await browser.newPage();
page.on('console',m=>{if(/audio|error|lock|exception|dynCall|winmm|sndPlaySound|PlaySound/i.test(m.text()))console.log(m.text())});
page.on('pageerror',e=>console.log('ERROR',e.stack));
await page.goto(process.env.PROBE_URL || 'http://127.0.0.1:8138/boxedwine.html?root=boxedwine&app=asche&p=RSTEIN.EXE&auto=true&sound=true&resolution=640x480');
await page.waitForTimeout(20000);
await page.locator('#canvas').click();
await page.waitForTimeout(6000);
await page.keyboard.down('Space');await page.waitForTimeout(200);await page.keyboard.up('Space');
await page.waitForTimeout(8000);
console.log(await page.evaluate(()=>({audio:Module.SDL2?.audioContext?.state})));
await page.screenshot({path:'/tmp/opencode/audio-probe.png'});
}finally{await browser.close()}
})();
