// Every sound on the site is synthesized with Web Audio. No recordings of an actual rainforest
// were harmed (or used) in the making of this rainforest recording.

type Step = (step: number, when: number) => void;

export class Sound {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private noise!: AudioBuffer;
  private rainGain!: GainNode;
  private rainTone!: BiquadFilterNode;
  private rumbleGain!: GainNode;
  private padGain!: GainNode;
  private volume = 0.8;
  private muted = false;
  private recent: number[] = [];
  private seqTimer = 0;

  unlock() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;

    // master -> compressor so 40 simultaneous frogs don't clip your ears off
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(comp);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // rain bed: filtered noise
    const rain = ctx.createBufferSource();
    rain.buffer = this.noise;
    rain.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 500;
    this.rainTone = ctx.createBiquadFilter();
    this.rainTone.type = 'lowpass';
    this.rainTone.frequency.value = 5000;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(hp).connect(this.rainTone).connect(this.rainGain).connect(this.master);
    rain.start();

    const rumble = ctx.createBufferSource();
    rumble.buffer = this.noise;
    rumble.loop = true;
    rumble.playbackRate.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    rumble.connect(lp).connect(this.rumbleGain).connect(this.master);
    rumble.start();

    // a soft, slightly too earnest wellness pad
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0;
    const padLp = ctx.createBiquadFilter();
    padLp.type = 'lowpass';
    padLp.frequency.value = 900;
    padLp.connect(this.padGain).connect(this.master);
    [174.6, 220, 261.6, 329.6].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 12;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + i * 0.03;
      const lg = ctx.createGain();
      lg.gain.value = 0.04;
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(padLp);
      o.start();
      lfo.start();
    });
  }

  get now() {
    return this.ctx?.currentTime ?? 0;
  }

  setVolume(v: number) {
    this.volume = v;
    this.applyMaster();
  }

  setMuted(m: boolean) {
    this.muted = m;
    this.applyMaster();
  }

  private applyMaster() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.now, 0.05);
  }

  /** 0..1. Also darkens/brightens the rain tone. */
  setRain(level: number, rumble = 0) {
    if (!this.ctx) return;
    this.rainGain.gain.setTargetAtTime(level * 0.35, this.now, 0.8);
    this.rainTone.frequency.setTargetAtTime(2500 + level * 5000, this.now, 0.8);
    this.rumbleGain.gain.setTargetAtTime(rumble * 0.5, this.now, 0.8);
  }

  setPad(level: number) {
    if (!this.ctx) return;
    this.padGain.gain.setTargetAtTime(level, this.now, 1.5);
  }

  /** Rate limiter for collision sounds, so 200 frogs landing at once is merely loud. */
  allow(maxPerSec = 14) {
    const t = performance.now();
    this.recent = this.recent.filter((x) => t - x < 1000);
    if (this.recent.length >= maxPerSec) return false;
    this.recent.push(t);
    return true;
  }

  // ---------------------------------------------------------------- primitives

  private env(g: GainNode, when: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  }

  private osc(type: OscillatorType, f: number, when: number, dur: number) {
    const o = this.ctx!.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, when);
    o.start(when);
    o.stop(when + dur + 0.05);
    return o;
  }

  private noiseSrc(when: number, dur: number, rate = 1) {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.playbackRate.value = rate;
    s.start(when, Math.random() * 1.5);
    s.stop(when + dur + 0.05);
    return s;
  }

  private filter(type: BiquadFilterType, f: number, q = 1) {
    const b = this.ctx!.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  private out(gain = 1) {
    const g = this.ctx!.createGain();
    g.gain.value = gain;
    g.connect(this.sfx);
    return g;
  }

  // ---------------------------------------------------------------- sound effects

  /** "rib-bit". pitch ~0.6..2 */
  croak(pitch = 1, when = this.now, vol = 0.5) {
    if (!this.ctx) return;
    const f = 95 * pitch;
    for (const [start, len] of [
      [0, 0.1],
      [0.14, 0.14],
    ]) {
      const t = when + start;
      const o = this.osc('sawtooth', f, t, len);
      o.frequency.linearRampToValueAtTime(f * (start ? 1.25 : 0.9), t + len);
      const am = this.osc('square', 32 + pitch * 6, t, len);
      const amG = this.ctx.createGain();
      amG.gain.value = 0.5;
      const vca = this.ctx.createGain();
      vca.gain.value = 0.5;
      am.connect(amG).connect(vca.gain);
      const bp = this.filter('bandpass', 650 * pitch, 3.5);
      const g = this.out();
      this.env(g, t, vol, 0.01, len);
      o.connect(bp).connect(vca).connect(g);
    }
  }

  squawk(when = this.now, vol = 0.35) {
    if (!this.ctx) return;
    const o = this.osc('sawtooth', 700, when, 0.45);
    o.frequency.exponentialRampToValueAtTime(1500 + Math.random() * 400, when + 0.08);
    o.frequency.exponentialRampToValueAtTime(600, when + 0.4);
    const vib = this.osc('sine', 38, when, 0.45);
    const vg = this.ctx.createGain();
    vg.gain.value = 120;
    vib.connect(vg).connect(o.frequency);
    const shaper = this.ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = Math.tanh(x * 4);
    }
    shaper.curve = curve;
    const bp = this.filter('bandpass', 1600, 2);
    const g = this.out();
    this.env(g, when, vol, 0.02, 0.4);
    o.connect(shaper).connect(bp).connect(g);
  }

  thud(strength = 1, when = this.now) {
    if (!this.ctx) return;
    const o = this.osc('sine', 130, when, 0.25);
    o.frequency.exponentialRampToValueAtTime(42, when + 0.18);
    const g = this.out();
    this.env(g, when, 0.6 * strength, 0.005, 0.22);
    o.connect(g);
    const n = this.noiseSrc(when, 0.08);
    const ng = this.out();
    this.env(ng, when, 0.2 * strength, 0.002, 0.07);
    n.connect(this.filter('lowpass', 900)).connect(ng);
  }

  knock(strength = 1, when = this.now) {
    if (!this.ctx) return;
    const f = 280 + Math.random() * 260;
    const o = this.osc('triangle', f, when, 0.08);
    o.frequency.exponentialRampToValueAtTime(f * 0.7, when + 0.07);
    const g = this.out();
    this.env(g, when, 0.45 * strength, 0.002, 0.08);
    o.connect(g);
    const n = this.noiseSrc(when, 0.03);
    const ng = this.out();
    this.env(ng, when, 0.25 * strength, 0.001, 0.03);
    n.connect(this.filter('bandpass', 2500, 2)).connect(ng);
  }

  ping(when = this.now, vol = 0.25) {
    if (!this.ctx) return;
    const base = 1400 + Math.random() * 900;
    [1, 1.51, 2.37].forEach((m, i) => {
      const o = this.osc('sine', base * m, when, 0.6);
      const g = this.out();
      this.env(g, when, vol / (i + 1), 0.002, 0.5 - i * 0.12);
      o.connect(g);
    });
  }

  squish(when = this.now, vol = 0.4) {
    if (!this.ctx) return;
    const n = this.noiseSrc(when, 0.25, 0.6);
    const bp = this.filter('bandpass', 900, 5);
    bp.frequency.exponentialRampToValueAtTime(220, when + 0.22);
    const g = this.out();
    this.env(g, when, vol, 0.01, 0.22);
    n.connect(bp).connect(g);
  }

  boing(when = this.now, vol = 0.35) {
    if (!this.ctx) return;
    const o = this.osc('sine', 160, when, 0.6);
    o.frequency.exponentialRampToValueAtTime(420, when + 0.5);
    const lfo = this.osc('sine', 14, when, 0.6);
    const lg = this.ctx.createGain();
    lg.gain.setValueAtTime(60, when);
    lg.gain.exponentialRampToValueAtTime(1, when + 0.55);
    lfo.connect(lg).connect(o.frequency);
    const g = this.out();
    this.env(g, when, vol, 0.005, 0.55);
    o.connect(g);
  }

  plink(when = this.now, vol = 0.12) {
    if (!this.ctx) return;
    const f = 1200 + Math.random() * 1800;
    const o = this.osc('sine', f, when, 0.08);
    o.frequency.exponentialRampToValueAtTime(f * 0.45, when + 0.06);
    const g = this.out();
    this.env(g, when, vol, 0.002, 0.07);
    o.connect(g);
  }

  chirp(when = this.now, vol = 0.12) {
    if (!this.ctx) return;
    const base = 2800 + Math.random() * 1500;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const t = when + i * 0.11;
      const o = this.osc('sine', base, t, 0.08);
      o.frequency.exponentialRampToValueAtTime(base * 1.4, t + 0.03);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.07);
      const g = this.out();
      this.env(g, t, vol, 0.005, 0.07);
      o.connect(g);
    }
  }

  howl(when = this.now, vol = 0.35) {
    if (!this.ctx) return;
    const f = 180 + Math.random() * 80;
    const o = this.osc('sawtooth', f, when, 1.1);
    o.frequency.linearRampToValueAtTime(f * 2.1, when + 0.35);
    o.frequency.linearRampToValueAtTime(f * 1.3, when + 1.0);
    const vib = this.osc('sine', 7, when, 1.1);
    const vg = this.ctx.createGain();
    vg.gain.value = 18;
    vib.connect(vg).connect(o.frequency);
    const f1 = this.filter('bandpass', 700, 6);
    f1.frequency.linearRampToValueAtTime(1100, when + 0.4);
    f1.frequency.linearRampToValueAtTime(600, when + 1);
    const g = this.out();
    this.env(g, when, vol, 0.08, 1.0);
    o.connect(f1).connect(g);
  }

  thunder(when = this.now, vol = 0.9) {
    if (!this.ctx) return;
    // crack
    const c = this.noiseSrc(when, 0.3);
    const cg = this.out();
    this.env(cg, when, vol * 0.5, 0.003, 0.28);
    c.connect(this.filter('highpass', 1200)).connect(cg);
    // rumble
    const r = this.noiseSrc(when, 4.5, 0.35);
    const lp = this.filter('lowpass', 260, 0.7);
    lp.frequency.exponentialRampToValueAtTime(70, when + 4);
    const rg = this.out();
    rg.gain.setValueAtTime(0.0001, when);
    rg.gain.exponentialRampToValueAtTime(vol, when + 0.12);
    for (let i = 1; i < 8; i++) rg.gain.setTargetAtTime(vol * (0.3 + Math.random() * 0.7) * (1 - i / 9), when + i * 0.35, 0.12);
    rg.gain.setTargetAtTime(0.0001, when + 3, 0.5);
    r.connect(lp).connect(rg);
  }

  kick(when = this.now, vol = 0.8) {
    if (!this.ctx) return;
    const o = this.osc('sine', 150, when, 0.3);
    o.frequency.exponentialRampToValueAtTime(40, when + 0.13);
    const g = this.out();
    this.env(g, when, vol, 0.003, 0.28);
    o.connect(g);
  }

  clap(when = this.now, vol = 0.3) {
    if (!this.ctx) return;
    for (let i = 0; i < 3; i++) {
      const t = when + i * 0.012;
      const n = this.noiseSrc(t, 0.12);
      const g = this.out();
      this.env(g, t, vol, 0.002, i === 2 ? 0.12 : 0.02);
      n.connect(this.filter('bandpass', 1400, 1.5)).connect(g);
    }
  }

  hat(when = this.now, vol = 0.08) {
    if (!this.ctx) return;
    const n = this.noiseSrc(when, 0.05);
    const g = this.out();
    this.env(g, when, vol, 0.001, 0.04);
    n.connect(this.filter('highpass', 7000)).connect(g);
  }

  ding(when = this.now, vol = 0.3) {
    if (!this.ctx) return;
    [
      [1318.5, 0],
      [1046.5, 0.22],
    ].forEach(([f, dt]) => {
      const o = this.osc('sine', f, when + dt, 1.2);
      const o2 = this.osc('sine', f * 2.76, when + dt, 0.5);
      const g = this.out();
      this.env(g, when + dt, vol, 0.004, 1.1);
      o.connect(g);
      const g2 = this.out();
      this.env(g2, when + dt, vol * 0.2, 0.004, 0.4);
      o2.connect(g2);
    });
  }

  clack(when = this.now, vol = 0.12) {
    if (!this.ctx) return;
    const n = this.noiseSrc(when, 0.03);
    const g = this.out();
    this.env(g, when, vol, 0.001, 0.025);
    n.connect(this.filter('bandpass', 3500 + Math.random() * 2000, 4)).connect(g);
  }

  /** "sssshhhh… hhh… sss" — syllables of an extremely slow whisper. */
  whisper(when = this.now, vol = 0.22) {
    if (!this.ctx) return;
    const syll = 2 + Math.floor(Math.random() * 3);
    let t = when;
    for (let i = 0; i < syll; i++) {
      const len = 0.25 + Math.random() * 0.5;
      const n = this.noiseSrc(t, len);
      const bp = this.filter('bandpass', 2500 + Math.random() * 3000, 1.2);
      const g = this.out();
      this.env(g, t, vol, len * 0.4, len * 0.6);
      n.connect(bp).connect(g);
      t += len + 0.1 + Math.random() * 0.3;
    }
  }

  riser(dur: number, when = this.now) {
    if (!this.ctx) return;
    const n = this.noiseSrc(when, dur);
    const bp = this.filter('bandpass', 200, 3);
    bp.frequency.exponentialRampToValueAtTime(9000, when + dur);
    const g = this.out();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.5, when + dur);
    g.gain.setValueAtTime(0.0001, when + dur + 0.01);
    n.connect(bp).connect(g);
    const o = this.osc('sawtooth', 90, when, dur);
    o.frequency.exponentialRampToValueAtTime(1800, when + dur);
    const og = this.out();
    og.gain.setValueAtTime(0.0001, when);
    og.gain.exponentialRampToValueAtTime(0.18, when + dur);
    og.gain.setValueAtTime(0.0001, when + dur + 0.01);
    o.connect(this.filter('lowpass', 3000)).connect(og);
  }

  boom(when = this.now) {
    if (!this.ctx) return;
    this.kick(when, 1);
    const o = this.osc('sine', 55, when, 2.2);
    o.frequency.exponentialRampToValueAtTime(30, when + 2);
    const g = this.out();
    this.env(g, when, 0.9, 0.01, 2);
    o.connect(g);
    this.thunder(when, 0.6);
  }

  sadTrombone(when = this.now) {
    if (!this.ctx) return;
    const notes = [
      [392, 0, 0.35],
      [370, 0.4, 0.35],
      [349, 0.8, 0.35],
      [330, 1.2, 1.2],
    ];
    notes.forEach(([f, dt, len], i) => {
      const t = when + dt;
      const o = this.osc('sawtooth', f, t, len);
      if (i === 3) {
        const lfo = this.osc('sine', 6, t, len);
        const lg = this.ctx!.createGain();
        lg.gain.value = 9;
        lfo.connect(lg).connect(o.frequency);
      }
      const g = this.out();
      this.env(g, t, 0.25, 0.04, len);
      o.connect(this.filter('lowpass', 1100, 2)).connect(g);
    });
  }

  /** The one note in "One Leaf Falling (4 Hour Version)". */
  drone(when = this.now, dur = 12) {
    if (!this.ctx) return;
    const o = this.osc('sine', 110, when, dur);
    const o2 = this.osc('sine', 110.6, when, dur);
    const g = this.out();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(0.08, when + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    o2.connect(g);
  }

  // ---------------------------------------------------------------- sequencer

  /** Lookahead step sequencer. Calls fn(step, when) for each 16th note. */
  sequence(bpm: number, fn: Step) {
    this.stopSequence();
    if (!this.ctx) return;
    const stepDur = 60 / bpm / 4;
    let next = this.now + 0.08;
    let step = 0;
    const tick = () => {
      while (next < this.now + 0.12) {
        fn(step++, next);
        next += stepDur;
      }
    };
    tick();
    this.seqTimer = window.setInterval(tick, 25);
  }

  stopSequence() {
    clearInterval(this.seqTimer);
    this.seqTimer = 0;
  }
}
