export class LandscapeAudio {
  constructor() { this.context = null; this.enabled = false; this.timer = null; }

  async toggle() {
    if (!this.context) this.create();
    await this.context.resume();
    this.enabled = !this.enabled;
    this.master.gain.setTargetAtTime(this.enabled ? .22 : 0, this.context.currentTime, .3);
    return this.enabled;
  }

  create() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('이 브라우저는 풍경 소리를 지원하지 않습니다.');
    this.context = new AudioContext();
    const ctx = this.context;
    this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
    const noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const channel = noise.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < channel.length; i++) { previous = (previous + (Math.random() * 2 - 1) * .035) / 1.035; channel[i] = previous * 4; }
    this.river = ctx.createBufferSource(); this.river.buffer = noise; this.river.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1600;
    this.river.connect(filter); filter.connect(this.master); this.river.start();
    this.trainGain = ctx.createGain(); this.trainGain.gain.value = .16; this.trainGain.connect(this.master);
    const rumble = ctx.createOscillator(); rumble.frequency.value = 48; rumble.type = 'triangle'; rumble.connect(this.trainGain); rumble.start();
    this.timer = setInterval(() => { if (this.enabled && !document.hidden) this.chirp(); }, 4400);
  }

  chirp() {
    const ctx = this.context, now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain(), start = now + i * .19;
      osc.frequency.setValueAtTime(2200 + Math.random() * 600, start);
      osc.frequency.exponentialRampToValueAtTime(3600, start + .07);
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.06, start + .03); gain.gain.exponentialRampToValueAtTime(.001, start + .13);
      osc.connect(gain); gain.connect(this.master); osc.start(start); osc.stop(start + .15);
    }
  }

  setRunning(running, speed) {
    if (!this.context) return;
    this.trainGain.gain.setTargetAtTime(running ? .12 + speed * .07 : 0, this.context.currentTime, .3);
  }

  async setVisible(visible) {
    if (!this.context) return;
    if (visible && this.enabled) await this.context.resume();
    else await this.context.suspend();
  }
}
