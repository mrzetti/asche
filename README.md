# Asche zu Asche browser preservation

Site: https://asche.rammwiki.mrzetti.com

**Hosting on another VPS:** follow [HOSTING.md](HOSTING.md). All public runtime
assets and the background song are included; this is a static nginx deployment.

**Compact wiki player:** add `?embed=1` to the site URL. See [EMBED.md](EMBED.md)
for the click-to-load embed and its browser-isolation requirements.

**Touch controls:** mobile/touch devices automatically show Left, Right, Jump
and Fire buttons below the playfield, including in embeds and fullscreen.
The toolbar toggle can enable them on any device. Multiple fingers can hold
actions together; short taps last at least 160 ms for the original game's
keyboard polling. Cancelling a touch, hiding the page or restarting releases
held buttons. Runtime/HTTPS/isolation requirements still apply on phones.

`tools/verify-touch.cjs` checks native multi-touch input in Chromium mobile
emulation. Set `PLAYWRIGHT_MODULE` and `BROWSER_PATH` if using existing installs.
It routes the local web files over the test site's runtime; set `GAME_URL` to
your deployment (without a trailing slash). Physical iOS/Android device testing
is still useful for memory/performance and browser-specific fullscreen support.

**Startup feedback:** a loading panel covers the blank canvas while downloading
and booting. It reports actual per-file download bytes, elapsed time and the
Windows startup phase. It clears when artwork appears (with a manual Show game
fallback after 45 seconds). Loading may take a minute or more on phones.
Recognizable extension-origin errors are retained separately in diagnostic
reports and do not disable loading updates or claim an emulator failure.
`tools/verify-loading.cjs` covers slow startup, progress, first artwork,
extension errors and failed downloads.

The original 1997 Rammstein game runs through Boxedwine and its stripped Wine 6.0 filesystem in the
browser. The original executable, VB3 runtime, custom DLL and audio files are
preserved in `assets/original/`; provenance is in `assets/SOURCES.md`.

## Layout

- `web/`: public page, English controls and browser wrapper.
- `fallback/web/`: working Boxedwine deployment bundle (historical directory name).
- `fallback/README.md`: Boxedwine build provenance and packaging details.
- `deploy/`: nginx configuration, including TLS and cross-origin isolation.
- `reference/`: extracted original artwork and researched game guide.
- `runtime/`, `RUNTIME.md`: earlier wine-assembly prototype and source patches;
  retained for research. The public page uses Boxedwine.
- `tools/parent-boxedwine-check.cjs`: browser gameplay smoke check.

## Deploy

On this server, as root:

```sh
bash deploy.sh
```

Deploys to `/var/www/asche`, using the existing Let's Encrypt certificate.
Certificate renewal is handled by Certbot. No backend service is needed.

## Controls and verification

Click the title screen to start. Hold Left/Right to move, Up to jump, Space to
fire. Escape quits the original game; the wrapper's Restart button reloads it.
The game polls keyboard state periodically: automated tests must hold keys
(150 ms or longer) rather than sending an instantaneous key press.

Sound is enabled, with a 0–100% volume slider (0 mutes). The SDL sample-rate
query now proxies from the Wine pthread to the main thread where AudioContext
lives. This fixes the exception that caused the earlier Wine audio-lock timeout.
`fallback/web/audio.js` routes output through a master gain, including when Wine
recreates its audio context. Slider settings survive Restart game.

`node tools/verify-audio.cjs` verifies actual nonzero PCM output while firing,
silent output at 0%, gain adjustment, and both sites' volume/layout controls.

To exercise the public page using the installed Playwright and Chromium:

```sh
ASCHE_URL=https://asche.rammwiki.mrzetti.com node tools/parent-boxedwine-check.cjs
```

The check captures screenshots under `/tmp/opencode/asche-parent/` for visual
verification of the original playfield, firing, jumping and movement. It is a
smoke check, not a complete playthrough of all three levels.

Verified on 2026-09-13 against the public HTTPS page: original title and level
artwork, held-key firing, jumping and leftward movement, with no browser
JavaScript errors. The deployed bundle is approximately 40 MB.
