export function createAudio() {
  let context, master, surf, filter, stepTime = 0;
  let enabled = false;
  function init() {
    context = new AudioContext(); master = context.createGain(); master.gain.value = 0;
    master.connect(context.destination);
    const buffer = context.createBuffer(1, context.sampleRate * 5, context.sampleRate);
    const data = buffer.getChannelData(0); let previous = 0;
    for (let i = 0; i < data.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .02) / 1.02; data[i] = previous * 3.2; }
    surf = context.createBufferSource(); surf.buffer = buffer; surf.loop = true;
    filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 700;
    surf.connect(filter); filter.connect(master); surf.start();
  }
  return {
    async toggle() {
      try {
        if (!context) init();
        await context.resume(); enabled = !enabled;
        master.gain.setTargetAtTime(enabled ? .3 : 0, context.currentTime, .4);
        return enabled;
      } catch { return false; }
    },
    update(dt, speed, grounded, time, paused) {
      if (!enabled || !context || paused) return;
      filter.frequency.setTargetAtTime(500 + Math.sin(time * .33) * 250, context.currentTime, .2);
      if (speed < .3 || !grounded) { stepTime = 0; return; }
      stepTime += dt;
      if (stepTime < (speed > 4 ? .29 : .47)) return;
      stepTime = 0;
      const source = context.createBufferSource(), gain = context.createGain(), highpass = context.createBiquadFilter();
      source.buffer = surf.buffer; highpass.type = 'highpass'; highpass.frequency.value = 1200;
      gain.gain.setValueAtTime(.7, context.currentTime); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .1);
      source.connect(highpass); highpass.connect(gain); gain.connect(master);
      source.start(0, Math.random() * 4, .12);
      source.onended = () => { source.disconnect(); highpass.disconnect(); gain.disconnect(); };
    },
  };
}
