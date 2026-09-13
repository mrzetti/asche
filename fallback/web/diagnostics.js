// Keep the first failure and bounded context independent of DevTools' log.
(() => {
  const started = Date.now();
  const logs = [];
  const inputs = [];
  let firstFailure;
  const text = value => String(value?.stack || value).slice(0, 2000);
  const remember = (list, entry, limit) => {
    list.push(entry);
    if (list.length > limit) list.shift();
  };
  function snapshot(error) {
    const runtime = {};
    try {
      runtime.stackPointer = window.stackSave?.();
      runtime.stackBottom = window._emscripten_stack_get_end?.();
      runtime.stackTop = window._emscripten_stack_get_base?.();
      runtime.memoryBytes = window.HEAPU8?.length;
      runtime.aborted = window.ABORT;
      runtime.audioState = window.Module?.SDL2?.audioContext?.state;
    } catch (failure) { runtime.snapshotError = text(failure); }
    return {
      version: 1, capturedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started, browser: navigator.userAgent,
      isolated: crossOriginIsolated, runtime, error,
      logs: logs.slice(), inputs: inputs.slice(),
    };
  }
  function capture(error) {
    if (firstFailure) return;
    firstFailure = snapshot(error);
    if (parent !== window) parent.postMessage({type: 'asche-runtime-failure'}, location.origin);
  }
  for (const level of ['log', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      const message = args.map(text).join(' ').slice(0, 4000);
      remember(logs, {ms: Date.now() - started, level, message}, 120);
      original(...args);
      // Worker exceptions may only reach the main page via console.error.
      if (/uncaught|memory access out of bounds|stack overflow|Aborted\(/i.test(message)) {
        capture({type: 'console', message});
      }
    };
  }
  addEventListener('error', event => capture({
    type: 'error', message: event.message || 'Resource load failed',
    stack: text(event.error || ''), file: event.filename,
    line: event.lineno, column: event.colno,
  }));
  addEventListener('unhandledrejection', event => capture({type: 'rejection', message: text(event.reason)}));
  for (const type of ['keydown', 'keyup', 'pointerdown']) {
    addEventListener(type, event => {
      // Record game controls only, not arbitrary text input.
      if (type !== 'pointerdown' && !['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'Escape'].includes(event.key)) return;
      if (event.repeat) return;
      remember(inputs, {ms: Date.now() - started, type, key: event.key, x: event.clientX, y: event.clientY}, 40);
    }, true);
  }
  window.getAscheCrashReport = () => firstFailure || snapshot(null);
})();
