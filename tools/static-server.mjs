#!/usr/bin/env node
// Minimal dependency-free static file server for the Asche-zu-Asche browser
// runtime. It exists so `tools/browser-check.mjs` and local development can
// serve the emulator engine plus the original game assets without pulling in
// the benzin backend or nginx.
//
// Usage:
//   node tools/static-server.mjs --root=runtime/engine [--port=8137]
//
// The server is read-only: GET/HEAD only, no directory listing beyond index.html.

import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.exe': 'application/octet-stream',
  '.dll': 'application/octet-stream',
  '.wav': 'audio/wav',
  '.mid': 'audio/midi',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.fon': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

export function startStaticServer({ root, port = 0 } = {}) {
  const rootDir = resolve(root || arg('root', 'runtime/engine'));
  if (!existsSync(rootDir)) throw new Error(`site root does not exist: ${rootDir}`);

  const server = createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end('method not allowed');
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end('bad request');
      return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const target = normalize(join(rootDir, pathname));
    // Containment check: never serve outside the site root through `..`.
    if (target !== rootDir && !target.startsWith(rootDir + sep)) {
      res.writeHead(403).end('forbidden');
      return;
    }
    if (!existsSync(target) || !statSync(target).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    const type = MIME[extname(target).toLowerCase()] || 'application/octet-stream';
    const size = statSync(target).size;
    res.writeHead(200, {
      'content-type': type,
      'content-length': size,
      // The emulator hands a shared WebAssembly.Memory to workers, which the
      // browser only allows on a cross-origin-isolated document.
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
      'cross-origin-resource-policy': 'same-origin',
      // The engine ships versioned cache keys, but during bring-up a stale
      // wasm is the single most confusing failure, so never cache locally.
      'cache-control': 'no-store',
    });
    if (req.method === 'HEAD') { res.end(); return; }
    createReadStream(target).pipe(res);
  });

  return new Promise((resolvePromise) => {
    server.listen(port, '127.0.0.1', () => {
      resolvePromise({
        server,
        port: server.address().port,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = arg('root', 'runtime/engine');
  const port = Number(arg('port', '8137'));
  const handle = await startStaticServer({ root, port });
  console.log(`serving ${resolve(root)} on http://127.0.0.1:${handle.port}/`);
}
