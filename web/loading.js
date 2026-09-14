// The iframe load event only means its HTML loaded, not that Wine has booted.
window.createAscheLoading = (host, frame, onReady) => {
  const panel = document.createElement('div');
  panel.className = 'game-loading';
  panel.innerHTML = '<div class="loading-spinner" aria-hidden="true"></div><strong>Loading Asche zu Asche</strong><p class="loading-stage" role="status">Downloading the emulator…</p><progress aria-label="Current file download"></progress><p class="loading-detail"></p><p>The first load downloads about 40 MB, then starts Windows.<br>On phones this can take a minute or more. Please keep this tab open.</p><button type="button" hidden>Show game</button>';
  host.append(panel);
  const stage = panel.querySelector('.loading-stage');
  const detail = panel.querySelector('.loading-detail');
  const progress = panel.querySelector('progress');
  const reveal = panel.querySelector('button');
  const started = performance.now();
  let done = false;
  let failed = false;
  let bytes = '';
  const sample = document.createElement('canvas');
  sample.width = 32; sample.height = 24;
  const ctx = sample.getContext('2d', {willReadFrequently:true});
  function dispose() { clearInterval(timer); panel.remove(); done = true; }
  function ready() { if (done) return; dispose(); onReady(); }
  reveal.addEventListener('click', ready);
  function update(state) {
    if (done) return;
    if (state.stage === 'error') {
      failed = true;
      stage.textContent = state.message || 'An error was reported. Download the crash report or try restarting.';
      panel.querySelector('.loading-spinner').hidden = true;
      progress.hidden = true;
      reveal.hidden = false;
      return;
    }
    if (failed) return;
    progress.hidden = false;
    if (state.stage === 'download') {
      stage.textContent = state.file === 'boxedwine.zip' ? 'Downloading Windows runtime…' : 'Downloading game files…';
      const mb = number => (number / 1048576).toFixed(1);
      bytes = `${mb(state.loaded || 0)} MB downloaded`;
      if (state.total > 0) {
        progress.max = state.total; progress.value = state.loaded;
        bytes = `${mb(state.loaded)} / ${mb(state.total)} MB`;
      } else progress.removeAttribute('value');
    } else if (state.stage === 'boot') {
      stage.textContent = 'Starting Windows and the game…';
      progress.removeAttribute('value');
      bytes = 'Downloads complete for this step';
    }
  }
  const timer = setInterval(() => {
    const seconds = Math.floor((performance.now() - started) / 1000);
    detail.textContent = [bytes, `${seconds}s elapsed`].filter(Boolean).join(' · ');
    if (seconds >= 45) reveal.hidden = false;
    // Inspect a tiny copy twice per second until real artwork appears. A black
    // canvas or a solid startup surface does not mean the game is ready.
    try {
      const canvas = frame.contentDocument?.getElementById('canvas');
      if (!canvas?.width || !ctx) return;
      ctx.clearRect(0, 0, 32, 24);
      ctx.drawImage(canvas, 0, 0, 32, 24);
      const pixels = ctx.getImageData(0, 0, 32, 24).data;
      const colors = new Set();
      let lit = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] + pixels[i+1] + pixels[i+2] > 90) lit++;
        colors.add(`${pixels[i] >> 4},${pixels[i+1] >> 4},${pixels[i+2] >> 4}`);
      }
      if (lit > 100 && colors.size > 30) ready();
    } catch { /* Show game remains available if canvas readback is unavailable. */ }
  }, 500);
  return {update, dispose};
};
