// Pointer capture keeps held controls working when a finger leaves a button.
// Multiple pointers can hold different controls (or the same one) concurrently.
window.createTouchControls = ({host, toggle, keys, send, minimumHold = 0}) => {
  const bar = document.createElement('div');
  bar.className = 'touch-controls';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Game touch controls');
  const pointers = new Map();
  const held = new Map();
  const timers = new Map();
  const buttons = new Map();
  function release(key) {
    clearTimeout(timers.get(key));
    timers.delete(key);
    if (!held.has(key)) return;
    held.delete(key);
    buttons.get(key).classList.remove('held');
    send(key, false);
  }
  function releaseAll() {
    pointers.clear();
    for (const key of [...held.keys()]) release(key);
  }
  function down(id, key) {
    if (pointers.has(id)) return;
    pointers.set(id, key);
    clearTimeout(timers.get(key));
    timers.delete(key);
    if (!held.has(key)) {
      held.set(key, performance.now());
      buttons.get(key).classList.add('held');
      send(key, true, typeof id === 'string');
    }
  }
  function up(id) {
    const key = pointers.get(id);
    if (!key) return;
    pointers.delete(id);
    if ([...pointers.values()].includes(key)) return;
    const remaining = minimumHold - (performance.now() - held.get(key));
    if (remaining > 0) timers.set(key, setTimeout(() => release(key), remaining));
    else release(key);
  }
  for (const [key, label] of keys) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.key = key;
    button.textContent = label;
    buttons.set(key, button);
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      down(event.pointerId, key);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      button.addEventListener(type, event => { event.preventDefault(); up(event.pointerId); });
    }
    button.addEventListener('contextmenu', event => event.preventDefault());
    button.addEventListener('keydown', event => {
      if (![' ', 'Enter'].includes(event.key)) return;
      event.preventDefault();
      down(`keyboard-${key}`, key);
    });
    button.addEventListener('keyup', event => {
      if (![' ', 'Enter'].includes(event.key)) return;
      event.preventDefault();
      up(`keyboard-${key}`);
    });
    button.addEventListener('blur', () => up(`keyboard-${key}`));
    bar.append(button);
  }
  host.append(bar);
  function show(enabled) {
    releaseAll();
    bar.hidden = !enabled;
    toggle.setAttribute('aria-pressed', String(enabled));
  }
  show(navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches);
  toggle.addEventListener('click', () => show(bar.hidden));
  addEventListener('blur', releaseAll);
  addEventListener('pagehide', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });
  return {releaseAll};
};
