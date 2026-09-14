const game = document.getElementById('game');
const status = document.getElementById('status');
const play = document.getElementById('play');
const controls = createTouchControls({
  host: game, toggle: document.getElementById('touch-toggle'), minimumHold: 160,
  keys: [['ArrowLeft', '← Left'], ['ArrowRight', 'Right →'], ['ArrowUp', '↑ Jump'], ['Space', 'Fire']],
  send(code, down) {
    const win = game.querySelector('iframe')?.contentWindow;
    const canvas = win?.document.getElementById('canvas');
    if (!canvas) return;
    const keyCode = {ArrowLeft:37, ArrowUp:38, ArrowRight:39, Space:32}[code];
    canvas.dispatchEvent(new win.KeyboardEvent(down ? 'keydown' : 'keyup', {
      key: code === 'Space' ? ' ' : code, code, keyCode, which:keyCode,
      bubbles:true, cancelable:true,
    }));
  },
});
if (document.documentElement.classList.contains('embed')) {
  document.getElementById('embed-splash').append(play);
}
const volume = document.getElementById('volume');
const crashButton = document.getElementById('crash-report');
let crashReport;
let loadingUI;
let gameOverWatch;
let gameOverTimer;
let gameOverDismissed = false;

const GAME_OVER_CONFIRM_MS = 6000;
const GAME_OVER_RESTART_SECONDS = 3;
const GAME_OVER_POLL_MS = 800;
window.addEventListener('message', event => {
  const frame = game.querySelector('iframe');
  if (event.origin !== location.origin || event.source !== frame?.contentWindow) return;
  if (event.data?.type === 'asche-loading') {
    loadingUI?.update(event.data);
    return;
  }
  if (event.data?.type !== 'asche-runtime-failure') return;
  crashReport = frame.contentWindow.getAscheCrashReport();
  crashButton.hidden = false;
  status.textContent = 'An error was reported. If the game does not start or stops responding, download the crash report.';
  loadingUI?.update({stage:'error', message:status.textContent});
});
crashButton.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(crashReport, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'asche-crash-report.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function applyVolume() {
  document.getElementById('volume-value').value = `${volume.value}%`;
  game.querySelector('iframe')?.contentWindow.setGameVolume?.(volume.value / 100);
}
volume.addEventListener('input', applyVolume);
applyVolume();

function clearGameOverUi() {
  gameOverDismissed = false;
  if (gameOverWatch) {
    clearInterval(gameOverWatch);
    gameOverWatch = undefined;
  }
  if (gameOverTimer) {
    clearInterval(gameOverTimer);
    gameOverTimer = undefined;
  }
  document.getElementById('game-over')?.remove();
}

// The original game-over form is the fixed 640x480 "game over" bitmap extracted
// from RSTEIN.EXE (reference/extracted/game-over.png), downscaled to 32x24
// luminance. Comparing the sampled canvas against that exact screen avoids
// false positives on black loading/fade screens that also carry red text.
const GAME_OVER_REFERENCE = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABEhYWFBQSCRQWFhUSAgAAAAAAAAAAAAAAAAAAAAAAAAoqMSopKS4jLisrMSQOAAAAAAAAAAAAAAAAAAAAAAAACiQcEhMTEwkQEBEUEwcAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const GAME_OVER_MAX_DISTANCE = 7;

const GAME_OVER_LUMINANCE = (() => {
  const raw = atob(GAME_OVER_REFERENCE);
  const values = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) values[i] = raw.charCodeAt(i);
  return values;
})();

function sampleGameCanvas(frame) {
  const canvas = frame.contentDocument?.getElementById('canvas');
  if (!canvas?.width || !canvas?.height) return null;
  const sample = document.createElement('canvas');
  sample.width = 32;
  sample.height = 24;
  const context = sample.getContext('2d', {willReadFrequently: true});
  context.drawImage(canvas, 0, 0, 32, 24);
  const pixels = context.getImageData(0, 0, 32, 24).data;
  const luminance = new Float32Array(32 * 24);
  for (let i = 0, p = 0; p < luminance.length; i += 4, p += 1) {
    luminance[p] = pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114;
  }
  return luminance;
}

function looksLikeGameOver(luminance) {
  if (!luminance || luminance.length !== GAME_OVER_LUMINANCE.length) return false;
  let total = 0;
  for (let i = 0; i < luminance.length; i += 1) {
    total += Math.abs(luminance[i] - GAME_OVER_LUMINANCE[i]);
  }
  return total / luminance.length <= GAME_OVER_MAX_DISTANCE;
}

function watchForGameOver(frame) {
  let matchedSince = 0;
  gameOverWatch = setInterval(() => {
    if (gameOverDismissed || document.getElementById('game-over')) return;
    const luminance = sampleGameCanvas(frame);
    if (!luminance || !looksLikeGameOver(luminance)) {
      matchedSince = 0;
      return;
    }
    if (!matchedSince) matchedSince = Date.now();
    // The final game-over screen waits for a key press, so only a screen that
    // stays game-over for several seconds is treated as a real game over.
    // Loading/transition screens clear themselves well before this.
    if (Date.now() - matchedSince >= GAME_OVER_CONFIRM_MS) showGameOver(frame);
  }, GAME_OVER_POLL_MS);
}

function showGameOver(frame) {
  if (document.getElementById('game-over')) return;
  if (gameOverWatch) {
    clearInterval(gameOverWatch);
    gameOverWatch = undefined;
  }
  const overlay = document.createElement('div');
  overlay.id = 'game-over';
  overlay.className = 'game-over';
  overlay.innerHTML = '<strong>Game over</strong>' +
    '<p>Starting a new game in <span id="game-over-count">' + GAME_OVER_RESTART_SECONDS + '</span> s\u2026</p>' +
    '<div class="game-over-actions">' +
    '<button type="button" class="primary" id="game-over-now">Play again now</button>' +
    '<button type="button" id="game-over-stay">Stay on this screen</button>' +
    '</div>';
  document.getElementById('game-screen').append(overlay);
  status.textContent = 'Game over. A new game starts automatically; press Play again now to skip the wait.';
  let remaining = GAME_OVER_RESTART_SECONDS;
  gameOverTimer = setInterval(() => {
    remaining -= 1;
    const counter = document.getElementById('game-over-count');
    if (counter) counter.textContent = String(Math.max(0, remaining));
    if (remaining > 0) return;
    // Never reload if the screen changed: this makes a detection mistake
    // self-healing instead of interrupting a running game.
    const current = sampleGameCanvas(frame);
    if (current && !looksLikeGameOver(current)) {
      clearInterval(gameOverTimer);
      gameOverTimer = undefined;
      overlay.remove();
      status.textContent = 'The game continued; the automatic restart was cancelled.';
      watchForGameOver(frame);
      return;
    }
    startGame();
  }, 1000);
  document.getElementById('game-over-now').addEventListener('click', startGame);
  document.getElementById('game-over-stay').addEventListener('click', () => {
    if (gameOverTimer) clearInterval(gameOverTimer);
    gameOverTimer = undefined;
    overlay.remove();
    gameOverDismissed = true;
    status.textContent = 'Game over. Restart game to play again.';
  });
}

function startGame() {
  controls.releaseAll();
  clearGameOverUi();
  if (!window.crossOriginIsolated) {
    status.textContent = 'This game needs HTTPS and cross-origin isolation. The containing wiki page must enable COOP/COEP and permit cross-origin isolation for the iframe. Use Open full game to play separately.';
    return;
  }
  loadingUI?.dispose();
  const frame = document.createElement('iframe');
  frame.title = 'Asche zu Asche — original Windows game';
  // The wrapper owns fullscreen so the touch controls remain available.
  // SDL fullscreen on the inner iframe would cover them.
  frame.allow = "autoplay; gamepad; fullscreen 'none'";
  frame.src = '/emulator/boxedwine.html?root=boxedwine&app=asche&p=RSTEIN.EXE&auto=true&sound=true&resolution=640x480';
  status.textContent = 'Loading the emulator…';
  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    applyVolume();
    const style = doc.createElement('style');
    style.textContent = `
      html, body { margin: 0; background: #000; color: #ddd; overflow: hidden; }
      body > div:not(#loading) > .emscripten, #output, hr { display: none !important; }
      .emscripten_border { border: 0 !important; }
      canvas.emscripten { display: block; width: min(100vw, 133.333vh) !important; height: min(75vw, 100vh) !important; margin: auto !important; }
    `;
    doc.head.append(style);
    doc.getElementById('pointerLock').checked = false;
    if (frame.contentWindow.ascheLoadingState) loadingUI?.update(frame.contentWindow.ascheLoadingState);
  });
  document.getElementById('game-screen').replaceChildren(frame);
  loadingUI = createAscheLoading(document.getElementById('game-screen'), frame, () => {
    status.textContent = 'Tap the title screen to start. Use the arrow keys or touch controls to play.';
    if (!gameOverDismissed) watchForGameOver(frame);
  });
  play.hidden = true;
}

play.addEventListener('click', startGame);
document.getElementById('restart').addEventListener('click', startGame);
document.getElementById('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await game.requestFullscreen();
  } catch {
    status.textContent = 'Fullscreen is unavailable in this browser.';
  }
});
