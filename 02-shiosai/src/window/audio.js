// Original procedural soundscape: no music samples, remote audio or permissions.
export class WindowAudio {
  constructor() {
    this.enabled = false;
    this.volume = 0.55;
    this.rain = true;
    this.paused = false;
    this.visible = true;
    this.context = null;
  }
  create() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error("이 브라우저에서는 소리를 재생할 수 없어요.");
    const ctx = (this.context = new Context());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 12;
    limiter.ratio.value = 3;
    this.master.connect(limiter);
    limiter.connect(ctx.destination);
    this.destination = ctx.createMediaStreamDestination();
    limiter.connect(this.destination);
    this.nodes = [];
    this.noise = ctx.createBuffer(2, ctx.sampleRate * 11, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = this.noise.getChannelData(channel);
      let brown = 0;
      for (let i = 0; i < data.length; i++) {
        brown = (brown + (Math.random() * 2 - 1) * 0.03) / 1.03;
        data[i] = brown * 3.5 + (Math.random() * 2 - 1) * 0.16;
      }
      // Crossfade the loop seam without changing either channel's duration.
      const seam = Math.floor(ctx.sampleRate * 0.1);
      for (let i = 0; i < seam; i++) {
        const t = i / seam;
        data[data.length - seam + i] =
          data[data.length - seam + i] * (1 - t) + data[i] * t;
      }
    }
    this.rainGain = this.bed("highpass", 1150, 0.17, -0.2, 1.0);
    this.roofGain = this.bed("bandpass", 640, 0.19, -0.65, 0.93);
    const ocean = this.bed("lowpass", 390, 0.75, 0.6, 0.75);
    const swell = ctx.createOscillator(),
      depth = ctx.createGain();
    swell.frequency.value = 0.074;
    depth.gain.value = 0.3;
    swell.connect(depth);
    depth.connect(ocean.gain);
    swell.start();
    this.nodes.push(swell);
    this.bed("bandpass", 2400, 0.023, 0.8, 1.17);
    for (const [frequency, amplitude] of [
      [55, 0.025],
      [110, 0.009],
      [164.5, 0.003],
    ]) {
      const source = ctx.createOscillator(),
        gain = ctx.createGain();
      source.frequency.value = frequency;
      gain.gain.value = amplitude;
      source.connect(gain);
      gain.connect(this.master);
      source.start();
      this.nodes.push(source);
    }
    this.nextDrip = ctx.currentTime + 1.8;
    this.nextChime = ctx.currentTime + 6;
    this.timer = setInterval(() => this.schedule(), 200);
  }
  bed(type, frequency, amplitude, pan, rate) {
    const ctx = this.context,
      source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    source.playbackRate.value = rate;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.45;
    const gain = ctx.createGain();
    gain.gain.value = amplitude;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(panner);
    panner.connect(this.master);
    source.start();
    this.nodes.push(source);
    return gain;
  }
  bell(frequency, at, amplitude = 0.016, duration = 2.6, pan = -0.55) {
    const ctx = this.context;
    for (const [ratio, level, decay] of [
      [1, 1, 1],
      [2.76, 0.22, 0.4],
      [5.4, 0.04, 0.15],
    ]) {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain(),
        stereo = ctx.createStereoPanner();
      oscillator.frequency.value = frequency * ratio;
      stereo.pan.value = pan;
      gain.gain.setValueAtTime(0.00001, at);
      gain.gain.exponentialRampToValueAtTime(amplitude * level, at + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.00001, at + duration * decay);
      oscillator.connect(gain);
      gain.connect(stereo);
      stereo.connect(this.master);
      oscillator.start(at);
      oscillator.stop(at + duration * decay + 0.1);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        stereo.disconnect();
      };
    }
  }
  schedule() {
    if (
      !this.enabled ||
      this.paused ||
      !this.visible ||
      this.context.state !== "running"
    )
      return;
    const now = this.context.currentTime;
    if (this.rain && now > this.nextDrip) {
      this.bell(
        620 + Math.random() * 650,
        now + 0.01,
        0.01 + Math.random() * 0.01,
        0.14,
        Math.random() * 1.6 - 0.8,
      );
      this.nextDrip = now + 0.7 + Math.random() * 2.2;
    }
    if (now > this.nextChime) {
      [698.46, 880, 783.99, 523.25].forEach((note, i) =>
        this.bell(note, now + 0.05 + i * 0.72, 0.013, 3.5),
      );
      this.nextChime = now + 67 + Math.random() * 24;
    }
  }
  async enable(value) {
    if (!this.context) this.create();
    await this.context.resume();
    this.enabled = value;
    this.sync();
    return value;
  }
  sync() {
    if (!this.context) return;
    const ctx = this.context;
    this.master.gain.setTargetAtTime(
      this.enabled && !this.paused && this.visible ? this.volume * 0.55 : 0,
      ctx.currentTime,
      0.45,
    );
    this.rainGain.gain.setTargetAtTime(
      this.rain ? 0.17 : 0,
      ctx.currentTime,
      0.8,
    );
    this.roofGain.gain.setTargetAtTime(
      this.rain ? 0.19 : 0.018,
      ctx.currentTime,
      0.8,
    );
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    this.sync();
  }
  setRain(value) {
    this.rain = value;
    this.sync();
  }
  setPaused(value) {
    this.paused = value;
    this.sync();
  }
  async visibility(value) {
    this.visible = value;
    this.sync();
    if (!this.context) return;
    if (value && this.enabled) await this.context.resume();
    else if (!value) await this.context.suspend();
  }
  async recordingTrack() {
    if (!this.context) this.create();
    await this.context.resume();
    return this.destination.stream.getAudioTracks()[0].clone();
  }
  dispose() {
    clearInterval(this.timer);
    this.nodes?.forEach((node) => node.stop());
    return this.context?.close();
  }
}
