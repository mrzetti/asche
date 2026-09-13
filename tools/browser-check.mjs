#!/usr/bin/env node
// Drive the wine-assembly browser runtime with Playwright's bundled Chromium
// and prove the Asche zu Asche (RSTEIN.EXE) Win16 app boots in a real browser.
//
// The engine is the wine-assembly static site; the app is registered at runtime
// by injecting an entry into window.wineApps.APPS, exactly the shape the site's
// own registry uses. Nothing here is deployed — it is the browser half of the
// bring-up evidence for RUNTIME.md.
//
// Usage:
//   node tools/browser-check.mjs --root=/tmp/opencode/wine-assembly \
//     --exe=binaries/asche/RSTEIN.EXE --modules=RAMM16 \
//     --out=/tmp/opencode/asche-browser.png [--click=320,240] [--wait=8000]

import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, resolve } from 'node:path';
import { startStaticServer } from './static-server.mjs';

// Minimal PNG reader (8-bit RGB/RGBA, non-interlaced) so the harness can tell a
// rendered frame from a blank one without depending on the engine's node_modules.
function decodePng(buf) {
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 8;
  let colorType = 6;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!bpp) throw new Error(`unsupported PNG colour type ${colorType}`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(height * stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride);
    p += stride;
    const o = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[o + x - bpp] : 0;
      const b = y > 0 ? out[o - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[o - stride + x - bpp] : 0;
      let v = row[x];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        const pr = pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
        v = (v + pr) & 255;
      }
      out[o + x] = v;
    }
  }
  return { width, height, bpp, data: out };
}

function imageStats(file, rect) {
  const { width, height, bpp, data } = decodePng(readFileSync(file));
  const x0 = rect ? Math.max(0, Math.min(width - 1, Math.round(rect.x))) : 0;
  const y0 = rect ? Math.max(0, Math.min(height - 1, Math.round(rect.y))) : 0;
  const x1 = rect ? Math.max(x0 + 1, Math.min(width, Math.round(rect.x + rect.w))) : width;
  const y1 = rect ? Math.max(y0 + 1, Math.min(height, Math.round(rect.y + rect.h))) : height;
  const colors = new Map();
  let saturated = 0;
  const total = (x1 - x0) * (y1 - y0);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const at = (y * width + x) * bpp;
      const r = data[at];
      const g = data[at + 1];
      const b = data[at + 2];
      const key = (r << 16) | (g << 8) | b;
      colors.set(key, (colors.get(key) || 0) + 1);
      if (Math.max(r, g, b) - Math.min(r, g, b) > 40) saturated++;
    }
  }
  let dominant = 0;
  for (const n of colors.values()) if (n > dominant) dominant = n;
  return {
    width: x1 - x0, height: y1 - y0, distinct: colors.size,
    dominantFraction: dominant / total, saturatedFraction: saturated / total,
  };
}

function reportImage(label, file, rect, expectNonblank) {
  const s = imageStats(file, rect);
  console.log(`[image] ${label} ${s.width}x${s.height} distinct=${s.distinct} ` +
    `dominant=${(s.dominantFraction * 100).toFixed(1)}% ` +
    `saturated=${(s.saturatedFraction * 100).toFixed(2)}%`);
  // A blank VB form is a flat fill (white or the desktop colour) with no
  // saturated pixels. The title screen has red lettering and full-colour
  // artwork, so a small saturated fraction is the signal that art was drawn.
  if (expectNonblank && s.saturatedFraction < 0.005) {
    console.log(`[image] ${label} looks blank (no coloured artwork yet)`);
    return false;
  }
  return true;
}

const require = createRequire(import.meta.url);
const PLAYWRIGHT = process.env.PLAYWRIGHT_PATH
  || '/root/repos/rammwiki/benzin/tests/browser/node_modules/playwright';
const CHROMIUM = process.env.CHROMIUM_PATH
  || '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const ROOT = resolve(arg('root', '/tmp/opencode/wine-assembly'));
const PAGE = arg('page', 'index.html');
const EXE = arg('exe', 'binaries/asche/RSTEIN.EXE');
const ENTRY_PATH = arg('entry', '');
const MODULES = (arg('modules', 'RAMM16') || '').split(',').map((s) => s.trim()).filter(Boolean);
const APP_KEY = arg('app', 'asche-asche');
const OUT = resolve(arg('out', '/tmp/opencode/asche-browser.png'));
const CLICK = arg('click', '');
const WAIT_MS = Number(arg('wait', '9000'));
const SHOT2 = arg('out2', '');
const EXPECT_NONBLANK = process.argv.includes('--expect-nonblank');

if (!existsSync(CHROMIUM)) {
  console.error(`Chromium not found at ${CHROMIUM} (set CHROMIUM_PATH)`);
  process.exit(2);
}
mkdirSync(dirname(OUT), { recursive: true });

const { chromium } = require(PLAYWRIGHT);
const handle = await startStaticServer({ root: ROOT, port: 0 });
const base = `http://127.0.0.1:${handle.port}`;
console.log(`serving ${ROOT} at ${base}`);

const browser = await chromium.launch({
  executablePath: CHROMIUM,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const consoleLines = [];
page.on('console', (m) => consoleLines.push(`[console.${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => consoleLines.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => consoleLines.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText || ''}`));

try {
  // ?debug exposes the test globals; single-app keeps the shell out of the way.
  await page.goto(`${base}/${PAGE}?debug&single-app=1`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!(window.wineApps && window.wineApps.APPS), { timeout: 60000 });

  const isolated = await page.evaluate(() => self.crossOriginIsolated === true);
  console.log(`crossOriginIsolated=${isolated}`);

  const entry = ENTRY_PATH
    ? JSON.parse(readFileSync(resolve(ENTRY_PATH), 'utf8'))
    : { exe: EXE, ...(MODULES.length ? { win16Modules: MODULES } : {}) };
  await page.evaluate(({ key, entry }) => {
    window.wineApps.APPS[key] = entry;
    const sel = document.getElementById('app-select');
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = 'Asche zu Asche';
    sel.appendChild(opt);
    sel.value = key;
    document.body.classList.add('single-app');
    launchApp();
  }, { key: APP_KEY, entry });

  // Wait for the instance to exist and actually execute slices.
  await page.waitForFunction((key) => typeof runningApps !== 'undefined'
    && runningApps.some((a) => a && a.name === key), APP_KEY, { timeout: 120000 });
  await page.waitForFunction((key) => {
    const app = runningApps.find((a) => a && a.name === key);
    return !!(app && app.wine && app.wine._runSliceCount >= 40);
  }, APP_KEY, { timeout: 120000 });

  // Give the guest time to paint its first frame.
  await page.waitForTimeout(WAIT_MS);

  const state = await page.evaluate((key) => {
    const app = runningApps.find((a) => a && a.name === key);
    const wins = Object.values((sharedRenderer && sharedRenderer.windows) || {})
      .map((w) => ({ title: w.title, visible: w.visible, x: w.x, y: w.y, w: w.w, h: w.h }));
    return {
      exists: !!app,
      slices: app && app.wine ? app.wine._runSliceCount : -1,
      windows: wins,
      status: (document.getElementById('status') || {}).textContent || '',
    };
  }, APP_KEY);
  console.log('state=' + JSON.stringify(state, null, 2));

  // The whole canvas includes desktop chrome and the debug overlay, so a blank
  // game form would still look "non-blank". Measure the largest visible window
  // instead: that is the game frame the user actually looks at.
  const gameWin = state.windows
    .filter((w) => w.visible && w.w > 50 && w.h > 50)
    .sort((a, b) => b.w * b.h - a.w * a.h)[0] || null;
  console.log(`measuring ${gameWin ? `window ${JSON.stringify(gameWin.title)} ` +
    `at ${gameWin.x},${gameWin.y} ${gameWin.w}x${gameWin.h}` : 'whole canvas'}`);

  const canvas = page.locator('#screen');
  await canvas.screenshot({ path: OUT });
  console.log(`wrote ${OUT}`);
  let rendered = reportImage('boot', OUT, gameWin, EXPECT_NONBLANK);

  if (CLICK) {
    const [x, y] = CLICK.split(',').map(Number);
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + x, box.y + y);
    console.log(`clicked canvas (${x},${y})`);
    await page.waitForTimeout(WAIT_MS);
    const out2 = SHOT2 || OUT.replace(/\.png$/, '-after.png');
    await canvas.screenshot({ path: out2 });
    console.log(`wrote ${out2}`);
    rendered = reportImage('after-click', out2, gameWin, EXPECT_NONBLANK) && rendered;
  }

  console.log('--- console (tail) ---');
  for (const line of consoleLines.slice(-40)) console.log(line);
  if (state.exists && state.slices >= 0 && rendered) process.exitCode = 0;
  else process.exitCode = 1;
} catch (err) {
  console.error('browser-check failed: ' + (err && err.stack || err));
  console.log('--- console (tail) ---');
  for (const line of consoleLines.slice(-60)) console.log(line);
  process.exitCode = 1;
} finally {
  await browser.close().catch(() => {});
  await handle.close().catch(() => {});
}
