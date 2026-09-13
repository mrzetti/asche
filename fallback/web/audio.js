// Route the emulator's output through a master gain, leaving its PCM untouched.
(() => {
  const NativeAudioContext = window.AudioContext || window.webkitAudioContext;
  const contexts = new Set();
  let volume = 0.7;
  window.setGameVolume = value => {
    volume = Math.max(0, Math.min(1, Number(value) || 0));
    for (const context of contexts) context.gameGain.gain.value = volume;
  };
  window.AudioContext = class extends NativeAudioContext {
    constructor(...args) {
      super(...args);
      this.gameGain = this.createGain();
      this.gameGain.gain.value = volume;
      this.gameGain.connect(this.destination);
      contexts.add(this);
    }
    createScriptProcessor(...args) {
      const node = super.createScriptProcessor(...args);
      const connect = node.connect.bind(node);
      node.connect = (destination, ...ports) => connect(
        destination === this.destination ? this.gameGain : destination, ...ports);
      return node;
    }
    close() {
      contexts.delete(this);
      return super.close();
    }
  };
  document.addEventListener('pointerdown', () => {
    for (const context of contexts) {
      if (context.state === 'suspended') context.resume().catch(console.error);
    }
  });
})();
