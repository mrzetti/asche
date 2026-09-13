#!/usr/bin/env node
// Dev-only verification for the Boxedwine fallback runtime.
//
// It drives the build the way a player does:
//   1. wait for the original title screen to render,
//   2. click the canvas to start Level 1,
//   3. hold each control for >100 ms and confirm the game repaints.
//
// The game polls *held* key state, so Playwright's press() (down+up in the same
// tick) does not register. Always use down() -> wait -> up().
//
// Usage:
//   node verify.mjs [url] [outDir]
//
// It expects the same Playwright/Chromium the other browser checks use; override
// with PLAYWRIGHT_PATH / CHROMIUM_PATH. This file is not needed in production.
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH || '/root/repos/rammwiki/benzin/tests/browser/node_modules/playwright',
);

const url = process.argv[2]
  || 'http://127.0.0.1:8138/boxedwine.html?root=boxedwine&app=asche&p=RSTEIN.EXE&auto=true&sound=true&resolution=640x480';
const outDir = process.argv[3] || '/tmp/opencode/asche-fallback-verify';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-features=SharedArrayBuffer', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });

async function stats() {
  return page.evaluate(() => {
    const c = document.getElementById('canvas');
    if (!c || !c.width) return null;
    const tmp = document.createElement('canvas');
    tmp.width = c.width; tmp.height = c.height;
    const ctx = tmp.getContext('2d');
    ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4 * 53) {
      seen.add((d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4));
    }
    return { w: c.width, h: c.height, distinct: seen.size };
  });
}
async function shot(tag) {
  const file = path.join(outDir, tag + '.png');
  await page.screenshot({ path: file });
  return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

let failures = 0;
try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('navigating', url);

  let rendered = false;
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(2000);
    const s = await stats();
    if (s && s.distinct > 10) { console.log(`title rendered after ~${i * 2}s`, JSON.stringify(s)); rendered = true; break; }
  }
  if (!rendered) { console.error('FAIL: title screen never rendered'); process.exitCode = 1; }
  await page.evaluate(() => { const e = document.getElementById('showConsole'); if (e && e.checked) e.click(); });

  await page.locator('#canvas').click();
  await page.waitForTimeout(9000);
  const level = await stats();
  console.log('level frame', JSON.stringify(level));

  const baseline = await shot('baseline');
  for (const [key, ms] of [['Space', 150], ['ArrowUp', 150], ['ArrowLeft', 150]]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(ms);
    const held = await shot('held-' + key);
    await page.keyboard.up(key);
    await page.waitForTimeout(500);
    const changed = held !== baseline;
    console.log(`${changed ? 'PASS' : 'FAIL'} hold ${key} ${ms}ms -> frame ${changed ? 'changed' : 'unchanged'}`);
    if (!changed) failures++;
  }
} finally {
  await browser.close();
}
if (failures) { console.error(`FAIL: ${failures} control(s) produced no repaint`); process.exitCode = 1; }
else console.log('PASS: all held controls repainted the canvas');
