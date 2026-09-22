export class StationAudio {
  constructor() {
    this.enabled = false;
    this.context = null;
  }
  async toggle() {
    if (!this.context) this.create();
    await this.context.resume();
    this.enabled = !this.enabled;
    this.master.gain.setTargetAtTime(
      this.enabled ? 0.16 : 0,
      this.context.currentTime,
      0.4,
    );
    return this.enabled;
  }
  create() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error("이 브라우저는 소리를 지원하지 않아요.");
    const ctx = (this.context = new Context());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 5, ctx.sampleRate),
      data = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < data.length; i++) {
      previous = (previous + (Math.random() * 2 - 1) * 0.04) / 1.04;
      data[i] = previous * 5;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    const waveGain = ctx.createGain();
    waveGain.gain.value = 0.7;
    source.connect(filter);
    filter.connect(waveGain);
    waveGain.connect(this.master);
    source.start();
    const swell = ctx.createOscillator(),
      swellGain = ctx.createGain();
    swell.frequency.value = 0.11;
    swellGain.gain.value = 0.24;
    swell.connect(swellGain);
    swellGain.connect(waveGain.gain);
    swell.start();
  }
  async visibility(visible) {
    if (!this.context) return;
    if (visible && this.enabled) await this.context.resume();
    else await this.context.suspend();
  }
}
