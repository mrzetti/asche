# Local audio fix — 2026-09-13

The upstream Boxedwine 26R1 multi-threaded JS bridge calls SDL's sample-rate
EM_ASM (`330197`) on a Wine pthread. `Module.SDL2` exists only on the main thread,
so the worker throws while the Wine audio lock is held; subsequent sound calls
then hang. This was the cause of the previously documented sound limitation.

In `boxedwine.js`, `_emscripten_asm_const_int` now routes just that callback to
`runMainThreadEmAsm(code, sigPtr, argbuf, 1)` when `ENVIRONMENT_IS_PTHREAD`.
This uses Emscripten's existing synchronous proxy and returns the real sample
rate. The WASM and game files are unchanged. The callback address is specific
to the pinned 26R1 JS/WASM pair; review it before upgrading the emulator.

`boxedwine.html` loads `audio.js` before the engine. It wraps AudioContext to
insert a master GainNode for SDL output. `setGameVolume(0..1)` updates current
contexts and the value used for future contexts. Wine closes/reopens audio when
sample formats change, so a one-time change to the initial context is insufficient.
Pointer input resumes suspended contexts in browsers enforcing autoplay rules.

Verified on the public HTTPS wrapper in Chromium without an autoplay override:
nonzero PCM while firing, exact silence at 0%, gain 0.35 at 35%, no page errors.
The gameplay smoke check also passes with sound enabled (fire/jump/move,
fullscreen and restart). `tools/verify-audio.cjs` is the audio regression check.

## Opening clip duration

The opening sound is intentionally short. A Wine `+winmm` trace against the
public runtime identifies `WAV/ENTER.WAV`, played with `fdwSound=0x00000001`
(`SND_ASYNC`, without `SND_LOOP`). Its original WAV contains 52,080 mono 8-bit
samples at 22,050 Hz: 2.362 seconds. The trace submits all 52,080 bytes (seven
7,350-byte buffers and one 630-byte buffer), then closes the output normally.
A later shot opens and plays `FIRE.WAV` successfully. Thus silence after the
opening clip is normal game behavior, not the earlier audio-thread failure.
The original download contains 15 short WAV effects, no continuous music file.
That inventory alone does not establish whether every historical release or
recorded playthrough used an external soundtrack.

Reproduce with `tools/audio-probe.cjs`, setting `PROBE_URL` to the emulator URL
with `sound=true&args=-env;WINEDEBUG%3D%2Bwinmm` appended to enable Wine tracing.

## Startup diagnostics update (2026-09-14)

A separate Android Firefox report at 312 ms had a first stack frame in
`moz-extension://…/URL-Shortener-Unshortener.user.js`. This was an extension
exception, not evidence of the late-stage WASM crash. The shell's global
`onerror` used to permanently replace Module.setStatus on any uncaught error.
It now leaves status updates intact for recognizable extension-origin errors.
Diagnostics retains up to ten such errors separately; they do not occupy the
first game-failure slot. Classification examines the first stack frame or a
direct extension file URL, not arbitrary later extension wrappers.

The wrapper now shows a loading panel until artwork is detected on the canvas.
Archive downloads use XMLHttpRequest's native progress events with an
ArrayBuffer response, and report network/HTTP failures. The status throttle's
timestamp comparison was corrected too. `web/loading.js` samples a 32×24 canvas
copy twice a second during startup only; Show game is available after 45 seconds
if canvas readback cannot detect readiness. No fake overall percentage is used.

## Unresolved gameplay crash (2026-09-13)

The user reported a crash near the end of stage one while shooting a helicopter,
possibly taking a hit simultaneously. The available errors are repeated WASM
out-of-bounds reads at `0x1a1dd4` and `0x1a1ffc` from the mouse callbacks.
Disassembly identifies stack-local `f64.load` instructions in functions 7287
and the subsequent mouse callback; this does not establish what originally
invalidated the stack. Mouse movement/repeated-fire probes did not reproduce
the failure or recreate the exact encounter. No runtime fix is claimed.

`diagnostics.js` now retains the first error, a bounded console history, recent
game-control inputs and runtime stack/memory information. The wrapper exposes
Download crash report on a failure; the downloaded JSON is generated locally,
not uploaded. Console clearing and subsequent errors do not discard the first
report, and it remains downloadable after Restart game (until page reload).
`tools/verify-crash-report.cjs` checks this with an injected error;
`tools/probe-mouse.cjs` is an exploratory stack sampler.

## Referenced playthrough details

User reference: https://www.youtube.com/watch?v=sVU7FDqIiY8 — “Rammstein
Videogame \"Asche zu Asche\"”, Fukken Hanzel, published 2012-06-12. The user
reports that the song plays throughout the video. Playback from the research
server is blocked by YouTube's sign-in/bot check; the video has not been watched
as part of this investigation.

The watch page's description links to
https://www.mediafire.com/?q4epil40kus7kr8 (`HzuH by Hannstein.rar`, 1,102,841
bytes). All 19 file entries in that archive have the same uncompressed sizes
and CRC32 values as `assets/original/`, including the executable, both DLLs,
README and all 15 WAVs. There is no additional music file in that linked copy.
The executable's external function declarations include `MMSystem.sndPlaySound`;
string inspection found no MCI/CD-audio declarations or commands. These findings
support separately added music as a possibility, but do not prove the source of
the music heard in the video. Do not describe continuous music as restored or
conclusively absent from all versions on the strength of this evidence alone.

The hashes in PROVENANCE.md describe the pre-audio-fix package. Local changes
now include `boxedwine.js`, `boxedwine.html` and the added `audio.js` as well as
the earlier shell patch. Keep all three audio files together when deploying.
