#!/usr/bin/env node
// Register the Asche zu Asche app in a wine-assembly engine tree.
//
// The engine's lib/apps.js builds its APPS object inside an IIFE and then
// assigns `window.wineApps`. Appending a guarded assignment after the IIFE is
// therefore enough to add an entry, keeps the change in one delimited block
// that this script can replace idempotently, and never touches the registry
// code itself. The same file is loaded by Node (where `window` is absent), so
// the appended block is inert there.
//
// Usage:
//   node tools/install-app-entry.mjs --engine=runtime/engine \
//     --entry=runtime/app/asche.entry.json [--key=asche]

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const ENGINE = resolve(arg('engine', 'runtime/engine'));
const ENTRY_PATH = resolve(arg('entry', 'runtime/app/asche.entry.json'));
const KEY = arg('key', 'asche');
const APPS_JS = resolve(ENGINE, 'lib/apps.js');

const BEGIN = `/* ==== asche-runtime:app-entry:begin (generated) ==== */`;
const END = `/* ==== asche-runtime:app-entry:end ==== */`;

if (!existsSync(APPS_JS)) {
  console.error(`engine lib/apps.js not found: ${APPS_JS}`);
  process.exit(2);
}
if (!existsSync(ENTRY_PATH)) {
  console.error(`app entry not found: ${ENTRY_PATH}`);
  process.exit(2);
}

const entry = JSON.parse(readFileSync(ENTRY_PATH, 'utf8'));
const body = `${BEGIN}
if (typeof window !== 'undefined' && window.wineApps && window.wineApps.APPS) {
  window.wineApps.APPS[${JSON.stringify(KEY)}] = ${JSON.stringify(entry, null, 2)};
}
${END}`;

let src = readFileSync(APPS_JS, 'utf8');
// Drop a previous generated block so re-runs replace rather than stack.
const beginAt = src.indexOf(BEGIN);
if (beginAt !== -1) {
  const endAt = src.indexOf(END, beginAt);
  if (endAt === -1) throw new Error('unterminated generated app-entry block');
  src = src.slice(0, beginAt) + src.slice(endAt + END.length);
}
if (!src.endsWith('\n')) src += '\n';
src += '\n' + body + '\n';
writeFileSync(APPS_JS, src);
console.log(`installed app '${KEY}' into ${APPS_JS}`);
