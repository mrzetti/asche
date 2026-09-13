const game = document.getElementById('game');
const status = document.getElementById('status');
const play = document.getElementById('play');
if (document.documentElement.classList.contains('embed')) {
  document.getElementById('embed-splash').append(play);
}
const volume = document.getElementById('volume');
const music = document.getElementById('music');
const musicButton = document.getElementById('music-toggle');
const crashButton = document.getElementById('crash-report');
let crashReport;
window.addEventListener('message', event => {
  const frame = game.querySelector('iframe');
  if (event.origin !== location.origin || event.source !== frame?.contentWindow
      || event.data?.type !== 'asche-runtime-failure') return;
  crashReport = frame.contentWindow.getAscheCrashReport();
  crashButton.hidden = false;
  status.textContent = 'The emulator reported an error. Download the crash report before restarting.';
});
crashButton.addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(crashReport, null, 2)], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'asche-crash-report.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
let musicEnabled = true;
try { musicEnabled = localStorage.getItem('asche-music') !== 'off'; } catch {}
let musicReady = false;
let musicTimer;
function updateMusicButton() {
  musicButton.textContent = musicEnabled ? 'Disable music' : 'Enable music';
}
async function playMusic() {
  if (!musicEnabled || !musicReady) return;
  try { await music.play(); } catch (error) {
    // A browser may require a direct click in the parent page to unlock audio.
    if (musicEnabled) {
      musicButton.textContent = 'Play music';
      status.textContent = error.name === 'NotAllowedError'
        ? 'Click Play music to enable the background song.'
        : 'The background song could not load. Click Play music to retry.';
    }
  }
}
musicButton.addEventListener('click', () => {
  if (musicButton.textContent === 'Play music') {
    updateMusicButton();
    void playMusic();
    return;
  }
  musicEnabled = !musicEnabled;
  try { localStorage.setItem('asche-music', musicEnabled ? 'on' : 'off'); } catch {}
  updateMusicButton();
  if (musicEnabled) void playMusic();
  else music.pause();
});
updateMusicButton();
function applyVolume() {
  document.getElementById('volume-value').value = `${volume.value}%`;
  game.querySelector('iframe')?.contentWindow.setGameVolume?.(volume.value / 100);
  // Keep music behind the original effects: 17.5% at the default master level.
  music.volume = (volume.value / 100) * 0.25;
}
volume.addEventListener('input', applyVolume);
applyVolume();

function startGame() {
  if (!window.crossOriginIsolated) {
    status.textContent = 'This game needs HTTPS and cross-origin isolation. The containing wiki page must enable COOP/COEP and permit cross-origin isolation for the iframe. Use Open full game to play separately.';
    return;
  }
  clearTimeout(musicTimer);
  musicReady = false;
  music.pause();
  music.currentTime = 0;
  updateMusicButton();
  const frame = document.createElement('iframe');
  frame.title = 'Asche zu Asche — original Windows game';
  frame.allow = 'autoplay; fullscreen; gamepad';
  frame.allowFullscreen = true;
  if (document.documentElement.classList.contains('embed')) {
    // The wrapper owns fullscreen; SDL's own fullscreen request would cover
    // the embed toolbar with the inner emulator iframe.
    frame.allowFullscreen = false;
    frame.allow = "autoplay; gamepad; fullscreen 'none'";
  }
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
    doc.getElementById('canvas').addEventListener('pointerdown', () => {
      // Leave room for the original 2.36-second opening excerpt before the
      // full track. Restart cancels this timer and resets the song.
      musicTimer = setTimeout(() => {
        musicReady = true;
        void playMusic();
      }, 2500);
    }, { once: true });
    status.textContent = 'Wait for the title screen, then click it to start. Hold the arrow keys to move.';
  });
  game.replaceChildren(frame);
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
