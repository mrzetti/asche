const {chromium}=require('/root/repos/rammwiki/benzin/tests/browser/node_modules/playwright');
// Exploratory input/stack sampler, not proof of reaching the helicopter.
(async()=>{
const browser=await chromium.launch({executablePath:'/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
try {
const page=await browser.newPage();
page.on('pageerror',e=>console.log('ERROR',e.stack));
page.on('console',m=>{if(/exception|error|overflow|lock/i.test(m.text()))console.log(m.text());});
await page.goto('https://asche.rammwiki.mrzetti.com/');
await page.getByRole('button',{name:'Load game',exact:true}).click();
await page.waitForTimeout(20000);
const frame=page.frames().find(f=>f.url().includes('boxedwine.html'));
console.log('before',await frame.evaluate(()=>({sp:stackSave(),bottom:_emscripten_stack_get_end(),top:_emscripten_stack_get_base()})));
await frame.locator('#canvas').click();
await page.keyboard.down('ArrowRight');
for(let i=0;i<60;i++){
 await page.keyboard.down('Space');
 await page.waitForTimeout(150);
 await page.keyboard.up('Space');
 if(i%3===0) await page.keyboard.down('ArrowUp');
 if(i%3===1) await page.keyboard.up('ArrowUp');
 await page.mouse.move(200+i,300,{steps:3});
 await page.waitForTimeout(350);
 console.log('move',i,await frame.evaluate(()=>stackSave()));
 if(i%10===0) await page.screenshot({path:`/tmp/opencode/asche-long-${i}.png`});
}
await page.keyboard.press('Escape');
await page.waitForTimeout(4000);
await page.mouse.move(300,400,{steps:10});
console.log('exit',await frame.evaluate(()=>stackSave()));
}finally{await browser.close();}
})();
