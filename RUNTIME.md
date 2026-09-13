# Asche zu Asche — original browser runtime

How the original 1997 *Asche zu Asche* Windows game runs in a web browser, and
what was learned building the wine-assembly path.

**Deployment decision: the site ships the Boxedwine (Wine 9) WASM runtime.**
The parent verified it playable — title, level, and held-key input (move, jump,
fire) all work. See [Deploy runtime](#deploy-runtime-boxedwine) below.
`runtime/engine/` (wine-assembly) is retained as a **diagnostic fallback** and
is *not* the deploy runtime.

Scope: `runtime/` and `tools/`. `web/` and the deployment configuration are
owned by the parent and were not touched here.

---

## Deploy runtime: Boxedwine (Wine 9)

* Wine 9's 32-bit Win16 support (NE loader + `USER.10 SetTimer` + message
  dispatch) runs the original binaries: `RSTEIN.EXE`, `VBRUN300.DLL`,
  `RAMM16.DLL` and the `WAV/` assets.
* Verified by the parent with held keys (not `keyboard.press`, which is too
  brief for the game's polling loop): Space fires (projectile travels), ArrowUp
  jumps, ArrowLeft moves. Captures:
  `/tmp/opencode/asche-parent/held-{Space,ArrowUp,ArrowLeft}.png`.
* Parent's check tool: `tools/parent-boxedwine-check.cjs`, target
  `http://127.0.0.1:8138/boxedwine.html?root=boxedwine&app=asche&p=RSTEIN.EXE&auto=true&sound=false&resolution=640x480`.
* The Boxedwine/Wine filesystem and packaging live under the parent's fallback
  tree, not here.

**Input lesson worth keeping in any wrapper:** the game reads key state in a
polling loop, so a synthetic press must be *held* (≥150 ms) for the guest to
observe it. An instant `keyboard.press` is a false negative.

---

## Wine-assembly: diagnostic fallback (not deployable for gameplay)

wine-assembly (MIT, WASM x86 + reimplemented Win16 API, no OS image) boots the
original binaries and **renders the original title screen and Level 1 artwork in
Chromium**, but cannot start the game loop. It is retained because the diagnosis
and the source changes below are precise and reusable.

Final status:

| Capability | State |
| --- | --- |
| Load `RSTEIN.EXE` + `VBRUN300.DLL` + `RAMM16.DLL` from the original files | ✅ |
| VB3 runtime boot; forms/windows created (`RSTEIN`, `Startscreen`, `Rammstein Level 1`) | ✅ |
| Title screen rendered in Chromium and headless (`saturated≈2%`, 68 KB frame) | ✅ |
| Level 1 artwork + HUD rendered after the start click (393 KB frame) | ✅ |
| Game loop (`timerMain`) and keyboard movement/jump/fire | ❌ |

### Why the game loop never starts

The level form `frmScreen1` owns three VB Timer controls — `timerMain`,
`timerHeliFire`, `timerSterben` — created as `ThunderTimer` windows. The game's
main loop is the `timerMain` event.

* Under Wine 9 the game arms the loop with
  `USER.10 SETTIMER(0076, 0076, 60, 0)` (later 80 ms) during form/control
  creation, and `GetKeyboardState` is polled from the timer event.
* Under wine-assembly `USER.10 SetTimer` is **never called**. VBRUN's Timer-arm
  helper (VBRUN300 segment 95, offset `0x1bc`/`0x200`; guest linear `0x7c01bc`
  in this load) is never entered — no executed EIP lands in that range.
* VBRUN's arm gate was checked and is satisfied: its run-mode global (task
  DGROUP `+0x21e0`) is `2`, as on Windows.
* The `ThunderTimer` control windows (guest handles `0x12a`, `0x12c`, `0x12d`)
  receive **no messages at all** under wine-assembly, while the sibling
  `ThunderPictureBox` (`0x125`) does. VB3 arms the timer from within its own
  control-window procedure; the engine never invokes it, so the interval is
  never applied and `SetTimer` never happens.

Root cause is therefore **VB3 control-window semantics**: wine-assembly's Win16
layer targets VB1 (`VBRUN100`) and does not reproduce the VB3 control-creation
path that drives `ThunderTimer` arming. Fixing it means implementing VBRUN300's
control message protocol, not a small API stub.

Contrast: forcing a `WM_TIMER` into the Timer windows does run the game code,
but it immediately raises VB "Subscript out of range" because the start code
that initializes the level state has not run — confirming the loop is being
started out of order rather than the code being absent.

---

## What the original binaries are

Measured with the engine's `tools/ne-dump.js` (NE = New Executable, Win16):

| File | Size | Format | Notes |
| --- | ---: | --- | --- |
| `assets/original/RSTEIN.EXE` | 5,045,289 | NE @0x600, linker 5.10 | 13 segments, **one module ref `VBRUN300`**, imports `VBRUN300.#100` only; artwork in `RT_RCDATA`; reads its own EXE for resources. |
| `assets/original/RAMM16.DLL` | 26,976 | NE @0x80 | Imports `GDI`/`USER`/`WIN87EM`/`KERNEL`; loaded by name at runtime. |
| `assets/original/VBRUN300.DLL` | 398,416 | NE @0x80 | Visual Basic 3.0 runtime; 101 segments. |
| `assets/original/WAV/*.WAV` | ~600 KB | PCM | 15 clips, opened as `\WAV\<NAME>.WAV`. |

`WIN87EM` is emulated internally; no file is needed. `RSTEIN.EXE` strings reveal
`/GODMODE`, `Godmode aktiviert`, `Timer-Interval=` and the `Esc` quit message.

---

## The wine-assembly patch (`runtime/patches/0001-win16-vb3-support.patch`)

All source changes are in `src/09a-handlers.wat` and `src/09e-win16-api.wat`
against `runtime/engine.pin` (`fbccf19d2ed1…`). Applied by
`tools/fetch-runtime.sh`.

1. **`KERNEL.199 SetHandleCount`** — VB3 calls it at startup; returns the
   requested count (no DOS descriptor table).
2. **`KERNEL.102 DOS3Call`** — routes the guest `INT 21h` request into the
   engine's existing DOS interrupt handler.
3. **`USER.237 GetUpdateRgn`** — VB3 asks for the pending paint region after the
   start click.
4. **`USER.59 SetActiveWindow`** — VB raises `Form_Activate` from the
   `WM_ACTIVATE` this sends; VBRUN calls it while handling activation and the
   engine previously trapped on it.
5. **`USER.287 GetLastActivePopup`** — VB control initialization asks for it.
6. **`BeginPaint` child class-brush fill** — the engine filled the class
   background for *every* Win16 child on `BeginPaint`, erasing the scene VB
   paints in `WM_ERASEBKGND`. The fill now requires the erase to still be
   outstanding and the call not to be a Win16-thunk `BeginPaint`. This is what
   made the **title screen** visible.
7. **Show a top-level form -> activate it** — a Win16 form shown after being
   hidden becomes the active window, matching Windows, so `Form_Activate` runs.
8. **Child erase on expose posts `WM_ERASEBKGND`** instead of painting the class
   brush directly — the app must receive the message to draw its own scene.
   This is what made the **level artwork** visible.

The patch is a clean `git diff` (no debug instrumentation) and reverse-applies
against the pin.

---

## Build, serve, test (wine-assembly path)

```bash
tools/fetch-runtime.sh --force          # clone pin, apply patches, build engine
node tools/static-server.mjs --root=. --port=8137
# http://127.0.0.1:8137/runtime/engine/index.html?app=asche&single-app=1

# Browser check; --expect-nonblank fails on a flat frame
node tools/browser-check.mjs --root=. --page=runtime/engine/index.html \
  --entry=runtime/app/asche.entry.json --app=asche \
  --out=/tmp/boot.png --out2=/tmp/level.png --click=320,240 --expect-nonblank

# Headless engine CLI
node test/run.js --exe=test/binaries/asche/RSTEIN.EXE --vfs-include='**/*' \
  --max-batches=1400 --batch-size=2000 --no-close \
  --no-build --wasm=build/wine-assembly.named.wasm --png=/tmp/frame.png
```

Verified with the shipped engine: boot
`distinct=250 dominant=89.6% saturated=1.99%` (title), after-click
`distinct=243 dominant=60.8% saturated=17.28%` (level + HUD).

Regression checks passed on the patched engine: `test-win16-wait-message`,
`test-nested-child-paint`, `test-parent-child-paint-order`,
`test-win16-solitaire-play`, `test-win16-minesweeper-smiley`,
`test-win16-winexec`, `test-win16-destroy-icon`, `test-win16-temp-file`,
`test-win16-menus`, `test-win16-version`. (`test-win16-dialog` fails identically
on the unpatched pin.)

---

## Ground-truth procedure used for the diagnosis

Native Wine 9 under Xvfb runs the original (screenshot confirmed the title and
an animating level), and `WINEDEBUG=+relay` exposed the 16-bit API sequence:
`USER.10 SETTIMER(0076,0076,60,0)` after the Timer control's
`WM_MOVE`/`WM_SIZE`, then `USER.222 GETKEYBOARDSTATE` from the timer event.
The set of 16-bit calls Wine makes and wine-assembly does not was diffed to
isolate the missing path (`SETTIMER`/`KILLTIMER`, `GETKEYBOARDSTATE`,
`GETACTIVEWINDOW`, `GETFOCUS`, `ISWINDOWENABLED`, `POSTMESSAGE`, `PTINRECT`,
`SNDPLAYSOUND`). Boxedwine uses that same Wine 9 behaviour, which is why it
works.

## Licensing

* wine-assembly is MIT; Boxedwine is GPL-2.0; Wine is LGPL-2.1+. No proprietary
  Windows OS image is downloaded or required.
* `RSTEIN.EXE`, `VBRUN300.DLL`, `RAMM16.DLL` and the WAVs are the original
  promotional files already in `assets/original/`; the runtimes preserve and run
  them in place.
