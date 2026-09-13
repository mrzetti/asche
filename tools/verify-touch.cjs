const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH || undefined,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:800,height:850},hasTouch:true,isMobile:true});
  const base=process.env.GAME_URL || 'https://asche.rammwiki.mrzetti.com';
  const benzin=process.env.GAME==='benzin';
  const root=path.resolve(process.env.PROJECT_ROOT || path.join(__dirname,'..'));
  for(const file of ['index.html','app.js','touch-controls.js','touch-controls.css']) {
   await page.route(u=>u.origin===base && u.pathname===(file==='index.html'?'/':'/'+file),r=>r.fulfill({path:path.join(root,'web',file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',headers:{'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'}}));
  }
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?embed=1');
  assert.equal(await page.locator('.touch-controls').isVisible(),true);
  if(!benzin) await page.getByRole('button',{name:'Load game',exact:true}).click();
  await page.waitForTimeout(benzin?7000:20000);
  const target=benzin?page:page.frames().find(f=>f.url().includes('boxedwine.html'));
  await target.evaluate(benzin=>{
   window.touchEvents=[];
   const element=benzin?document.querySelector('ruffle-player'):document.getElementById('canvas');
   for(const type of ['keydown','keyup']) element.addEventListener(type,e=>window.touchEvents.push([type,e.code,e.keyCode]));
  },benzin);
  if(!benzin) await target.locator('#canvas').tap();
  await page.waitForTimeout(1000);
  if(benzin) {
   // Coordinates are in the SWF's 800x600 letterboxed stage.
   const tap=async(x,y)=>{
    const b=await page.locator('#game-screen').boundingBox();
    const scale=Math.min(b.width/800,b.height/600);
    await page.touchscreen.tap(b.x+(b.width-800*scale)/2+x*scale,b.y+(b.height-600*scale)/2+y*scale);
    await page.waitForTimeout(1200);
   };
   await tap(700,560);
   await tap(700,560);
   await tap(150,390);
   await tap(650,550);
  }
  await page.screenshot({path:`/tmp/opencode/${benzin?'benzin':'asche'}-touch-before.png`});
  // Native touch contacts exercise pointer capture and real multi-touch routing.
  const cdp=await page.context().newCDPSession(page);
  const point=async(key,id)=>{
   const b=await page.locator(`[data-key="${key}"]`).boundingBox();
   return {x:b.x+b.width/2,y:b.y+b.height/2,id};
  };
  const left=await point('ArrowLeft',1), action=await point(benzin?'ArrowUp':'Space',2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[left,action]});
  await page.waitForTimeout(1500);
  await page.screenshot({path:`/tmp/opencode/${benzin?'benzin':'asche'}-touch-held.png`});
  assert.equal(await page.locator('.touch-controls .held').count(),2);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[action]});
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.touch-controls .held').count(),1);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.touch-controls .held').count(),0);
  const events=await target.evaluate(()=>touchEvents);
  for(const key of ['ArrowLeft',benzin?'ArrowUp':'Space']) {
   assert.equal(events.filter(e=>e[0]==='keydown' && e[1]===key).length,1);
   assert.equal(events.filter(e=>e[0]==='keyup' && e[1]===key).length,1);
  }
  await page.screenshot({path:`/tmp/opencode/${benzin?'benzin':'asche'}-touch.png`});
  await page.getByRole('button',{name:'Touch controls',exact:true}).click();
  assert.equal(await page.locator('.touch-controls').isVisible(),false);
  await page.getByRole('button',{name:'Touch controls',exact:true}).click();
  const again=await point('ArrowLeft',3);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[again]});
  await page.evaluate(()=>dispatchEvent(new Event('blur')));
  assert.equal(await page.locator('.touch-controls .held').count(),0);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  await page.getByRole('button',{name:'Fullscreen',exact:true}).click();
  assert.equal(await page.evaluate(()=>document.fullscreenElement?.id),'game');
  assert.equal(await page.locator('.touch-controls').isVisible(),true);
  await page.evaluate(()=>document.exitFullscreen());
  await page.setViewportSize({width:360,height:700});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.getByRole('button',{name:'Restart game',exact:true}).click();
  assert.equal(await page.locator('.touch-controls').count(),1);
  assert.deepEqual(errors,[]);
  console.log('PASS: actual multi-touch down/up/cancel reaches emulator, simultaneous controls, toggle, fullscreen and narrow layout');
 }finally{await browser.close();}
})();
