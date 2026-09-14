# Fallback runtime — original *Asche zu Asche* (1997) in the browser via Boxedwine

This is a **second, independent** way to run the original 1997 Windows game
unmodified in a browser. It is an alternative to the wine-assembly engine in
`runtime/`, kept separate on purpose.

It uses **Boxedwine** (an x86 emulator + Wine, built to WebAssembly) to run the
shipping Win16 binaries — `RSTEIN.EXE` + `VBRUN300.DLL` + `RAMM16.DLL` + the
`WAV/` sounds — inside an emulated 32-bit Linux + Wine 6.0 filesystem. No
Windows OS image is used; the Wine filesystem is open source.

## Status

| | |
| --- | --- |
| Title screen (Rammstein logo, artwork) | ✅ renders |
| Click → Level 1 | ✅ loads and renders the full level artwork + HUD |
| Gameplay | ✅ **verified**: hold **Space** fires a projectile, hold **ArrowUp** jumps, hold **ArrowLeft** moves |
| Sound | Works with `sound=true` after the local SDL main-thread proxy fix; `audio.js` provides master volume. See `web/PROVENANCE.md`. |
| Windows OS image | none, not needed |

This fallback also clears the one thing the wine-assembly engine currently
blocks on: the Level 1 background renders here (no clip-region loss).

## Layout

```
fallback/
├── README.md                     ← this file
└── web/                          ← the static runtime, self-contained
    ├── boxedwine.html            ← entry page (upstream)
    ├── boxedwine.js              ← emulator JS (upstream, unmodified)
    ├── boxedwine.wasm            ← emulator wasm (upstream, unmodified)
    ├── boxedwine-shell.js        ← upstream shell + optional `args=` param (see PROVENANCE.md)
    ├── boxedwine.css             ← upstream
    ├── boxedwine.zip             ← stripped Wine 6.0 filesystem (upstream release)
    ├── asche.zip                  ← built from assets/original/ (exe + DLLs + WAV)
    ├── server.mjs                 ← dependency-free dev server with the required headers
    ├── verify.mjs                 ← dev-only Playwright check (held-key gameplay)
    ├── PROVENANCE.md              ← sources, licences, SHA-256, exact commands
    └── licenses/                  ← GPL-2.0 (Boxedwine), LGPL-2.1 (Wine)
```

Original game files in `assets/original/` are untouched; `asche.zip` is a
reproducible copy of them.

## Serve

The multi-threaded build needs a cross-origin-isolated document, so the server
**must** send:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Resource-Policy: same-origin   (for the .wasm/.zip/.exe/.dll/.wav)
Content-Type: application/wasm   for .wasm
Content-Type: application/zip    for .zip
```

The nginx deployment template relaxes CORP to `same-site` so the sibling
Flashcards desktop can embed the game; the local dev server above stays
`same-origin`.

`tools/static-server.mjs` (the existing project dev server) already sends these;
`fallback/web/server.mjs` is a standalone copy:

```bash
node fallback/web/server.mjs fallback/web --port=8138
# → http://127.0.0.1:8138/boxedwine.html?root=boxedwine&app=asche&p=RSTEIN.EXE&auto=true&sound=true&resolution=640x480
```

If the production host does not send COOP/COEP, the emulator's worker threads
will not start. The deploy config in `deploy/` is owned elsewhere; add the
headers there before switching this on.

## Embed URL

Serve `fallback/web/` as a static directory and embed:

```html
<iframe
  src="/fallback/web/boxedwine.html?root=boxedwine&app=asche&p=RSTEIN.EXE&auto=true&sound=true&resolution=640x480"
  title="Asche zu Asche"
  style="width:100%;aspect-ratio:4/3;border:0"
  allow="autoplay; fullscreen"
  allowfullscreen></iframe>
```

Keep the query string exactly as above — those are the verified parameters:

| Parameter | Meaning |
| --- | --- |
| `root=boxedwine` | loads the Wine filesystem `boxedwine.zip` |
| `app=asche` | mounts `asche.zip` as the app directory |
| `p=RSTEIN.EXE` | auto-runs the game executable |
| `auto=true` | start without a Start button |
| `sound=true` | enable the original WAV audio through the patched SDL bridge |
| `resolution=640x480` | native game resolution; the Wine desktop matches |

## Controls

The game is keyboard-driven and **polls held key state**. A key must be held for
at least ~100 ms to register — a synthetic `press()` (down+up in one tick) does
nothing. In a real browser the keys work normally as held keys.

| Input | Action | Verified |
| --- | --- | --- |
| Mouse click on the title screen | start Level 1 | ✅ (the click that leads to the level) |
| Hold **Space** | fire / shoot | ✅ projectile appears |
| Hold **ArrowUp** | jump | ✅ frame changes (2526 px vs idle) |
| Hold **ArrowLeft** | move left | ✅ character moves, projectile visible |
| **ArrowRight** | move right (expected mirror of ArrowLeft) | not covered by the check |
| **Esc** | ends the session → result / high-score screen | not covered by the check |

Note: between inputs the level can look completely static — the game repaints on
input, not on a visible idle animation. That is normal for this title under
emulation; it is not a hang. This was the source of an earlier false negative
when instant `keyboard.press()` calls were used.

## Verify

With Playwright + the cached Chromium (same paths the other browser checks use):

```bash
node fallback/web/server.mjs fallback/web --port=8138 &
node fallback/web/verify.mjs \
  "http://127.0.0.1:8138/boxedwine.html?root=boxedwine&app=asche&p=RSTEIN.EXE&auto=true&sound=true&resolution=640x480" \
  /tmp/opencode/asche-fallback-verify
```

`verify.mjs` waits for the title, clicks into Level 1, then holds Space, ArrowUp
and ArrowLeft for 150 ms each and asserts the canvas repaints. Expected:

```
title rendered after ~12s { w: 640, h: 480, distinct: 67 }
level frame { w: 640, h: 480, distinct: 55 }
PASS hold Space 150ms -> frame changed
PASS hold ArrowUp 150ms -> frame changed
PASS hold ArrowLeft 150ms -> frame changed
```

## Licensing

Boxedwine is **GPL-2.0**; Wine is **LGPL-2.1-or-later**. The licences are in
`web/licenses/`. `RSTEIN.EXE`, `VBRUN300.DLL`, `RAMM16.DLL` and the WAVs are the
original 1997 promotional/demo files already in `assets/original/` and are
preserved byte-for-byte. See `web/PROVENANCE.md` for sources, versions,
SHA-256 and the exact repro commands.
