import * as THREE from 'three';
import type { Bus, TrackId } from '../bus';
import { trackById } from '../tracks';
import type { Ent, World } from './world';

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

// Frog Choir melody: 8th notes, pitch multipliers (0 = rest). A pentatonic cry for help.
const FROG_MELODY = [1, 0, 1.25, 1.5, 0, 1.5, 1.667, 1.5, 1.25, 0, 1, 1.125, 1.25, 0, 0.75, 0, 1, 1, 1.25, 1.5, 2, 0, 1.667, 1.5, 1.25, 1.5, 1.25, 1.125, 1, 0, 0, 0];

const SLOTH_LINES = [
  '[sloth begins whispering your full name]',
  '[he is on the first letter]',
  '[still the first letter]',
  '[the sloth is getting closer]',
  "[sloth: 'hhhhhhhh']",
  '[sloth pauses to reconsider everything]',
  "[sloth: 'hey']",
  '[the whisper continues. it will always continue.]',
];

const MEETING_LINES = [
  "[monkey: 'can everyone see my screen']",
  "[monkey: 'let's take this offline']",
  "[monkey: 'you're on mute']",
  "[monkey: 'per my last screech']",
  '[banana assigned as an action item]',
  "[monkey: 'quick sync?']",
  "[monkey: 'this could've been a screech']",
];

export class Director {
  current: TrackId | null = null;
  playing = false;
  elapsed = 0;
  private timers: number[] = [];
  private lastProgress = 0;
  private nextEvent = 0;
  private nextChirp = 3;
  private nextLine = 0;
  private lineIdx = 0;
  private toucans = 0;
  private special: Ent | null = null;
  private landed = false;

  private w: World;
  private bus: Bus;

  constructor(w: World, bus: Bus) {
    this.w = w;
    this.bus = bus;
  }

  private later(ms: number, fn: () => void) {
    this.timers.push(window.setTimeout(fn, ms));
  }

  /** Run a visual at the exact moment a scheduled sound plays. */
  private at(when: number, fn: () => void) {
    this.later(Math.max(0, (when - this.w.sound.now) * 1000), fn);
  }

  private stopFx() {
    const w = this.w;
    w.sound.stopSequence();
    this.timers.forEach(clearTimeout);
    this.timers = [];
    w.timeScale = 1;
    w.gravityOverride = null;
    w.lookTarget = null;
    w.autoHop = true;
    w.rainLevel = 0.25;
    w.sound.setRain(0.2);
    w.sound.setPad(0);
  }

  pause() {
    this.playing = false;
    this.stopFx();
  }

  play(id: TrackId) {
    const resume = id === this.current && !this.playing && id !== 'dopamine-reset';
    this.stopFx();
    if (!resume) this.elapsed = 0;
    this.current = id;
    this.playing = true;
    this.lineIdx = 0;
    this.nextLine = this.elapsed + 1;
    this.nextEvent = this.elapsed + 1.5;
    this.start(id);
  }

  private start(id: TrackId) {
    const w = this.w;
    const s = w.sound;
    switch (id) {
      case 'gentle-rain':
        w.rainLevel = 0.8;
        s.setRain(0.65);
        s.setPad(0.7);
        w.caption('[gentle rain begins. it is wet.]', undefined, 0, true);
        break;

      case 'frog-choir': {
        w.rainLevel = 0.3;
        s.setRain(0.25);
        s.setPad(0.25);
        w.autoHop = false;
        const have = w.creatures('frog').length;
        for (let i = have; i < 16; i++) this.later((i - have) * 120, () => w.spawn('frog'));
        w.caption('[16 frogs begin singing. nobody asked.]', undefined, 0, true);
        s.sequence(112, (step, when) => {
          if (step % 8 === 0) s.kick(when, 0.45);
          if (step % 4 === 2) s.hat(when, 0.05);
          if (step % 2) return;
          const note = FROG_MELODY[(step / 2) % FROG_MELODY.length];
          if (!note) return;
          s.croak(note * 1.1, when, 0.5);
          this.at(when, () => {
            const frogs = w.creatures('frog');
            if (!frogs.length) return;
            const f = pick(frogs);
            w.jump(f, 0.55 + note * 0.25);
            w.boostDopamine(3);
          });
        });
        break;
      }

      case 'toucan-airstrike':
        this.toucans = 0;
        w.rainLevel = 0.15;
        s.setRain(0.15);
        w.caption('[incoming toucans]', undefined, 0, true);
        s.sequence(140, (step, when) => {
          if (step % 4 === 0) s.kick(when, 0.7);
          if (step % 2 === 1) s.hat(when, 0.06);
          if (step % 16 === 4 || step % 16 === 12) s.clap(when, 0.25);
          if (step % 8 === 0 && this.toucans < 28) {
            this.toucans++;
            s.squawk(when, 0.3);
            this.at(when, () => {
              const target = w.randomDrop(0);
              const from = new THREE.Vector3(target.x + rand(-6, 6), 21, target.z - rand(2, 6));
              const vel = target.sub(from).setLength(rand(16, 24));
              w.spawn('toucan', from, vel);
              w.boostDopamine(18);
              if (this.toucans % 5 === 1) w.caption(pick(['[air raid, but beaks]', '[toucan did not consent to gravity]', '[beak incoming]', '[toucan screaming in Portuguese]']), 'airstrike', 3);
            });
          }
        });
        break;

      case 'sloth-asmr': {
        w.timeScale = 0.3;
        w.rainLevel = 0.3;
        s.setRain(0.22);
        s.setPad(0.35);
        const sloth = w.spawn('sloth', new THREE.Vector3(0, 22, 0), new THREE.Vector3(0, -1, 0), { scale: 2.6, giant: true });
        sloth.body.setLinearDamping(1.5);
        this.special = sloth;
        break;
      }

      case 'monkey-meeting': {
        w.rainLevel = 0.1;
        s.setRain(0.1);
        s.ding();
        w.caption('[meeting has started. cameras on please]', undefined, 0, true);
        const have = w.creatures('monkey').length;
        for (let i = have; i < 4; i++) this.later(400 + i * 300, () => w.spawn('monkey'));
        s.sequence(96, (step, when) => {
          if (step % 16 === 0) s.kick(when, 0.6);
          if (step % 16 === 8) s.clap(when, 0.3);
          if (Math.random() < 0.3) s.clack(when, 0.1);
          if (step % 16 === 12) {
            s.howl(when, 0.3);
            this.at(when, () => this.monkeyToss());
          }
        });
        break;
      }

      case 'thunder':
        w.rainLevel = 1.4;
        s.setRain(1, 0.55);
        w.caption("[thunderstorm, but it's personal]", undefined, 0, true);
        this.nextEvent = this.elapsed + 1.2;
        break;

      case 'leaf-4h': {
        w.rainLevel = 0;
        s.setRain(0);
        w.autoHop = false;
        const leaf = w.spawn('leaf', new THREE.Vector3(0, 24, -1), new THREE.Vector3(0, 0, 0), { scale: 3.2, giant: true });
        leaf.body.setLinearDamping(14);
        leaf.body.setAngularDamping(3);
        leaf.body.setAngvel({ x: 0.3, y: 0.6, z: 0.2 }, true);
        this.special = leaf;
        this.landed = false;
        w.lookTarget = new THREE.Vector3(0, 24, -1);
        w.wakeAll();
        s.drone(s.now, 14);
        w.caption('[everyone turns to watch the leaf]', undefined, 0, true);
        break;
      }

      case 'dopamine-reset':
        w.rainLevel = 0;
        s.setRain(0);
        s.riser(5.2);
        w.caption('[dopamine reset initiated. please remain seated]', undefined, 0, true);
        for (let i = 0; i < 20; i++) {
          this.later(i * 250, () => {
            for (const e of w.ents.values()) {
              if (!e.creature && e.kind !== 'letter') continue;
              const m = e.body.mass() * (i / 20) * 1.6;
              e.body.applyImpulse({ x: rand(-1, 1) * m, y: rand(0, 1.2) * m, z: rand(-1, 1) * m }, true);
            }
            w.addShake(i / 30);
          });
        }
        this.later(5200, () => {
          s.boom();
          w.yeet(1.3);
          w.resetDopamine();
          w.caption('[DROP]', undefined, 0, true);
        });
        this.later(6800, () => w.caption('[dopamine successfully reset. please do not enjoy anything for 6–8 business days]', undefined, 0, true));
        break;
    }
  }

  private monkeyToss() {
    const w = this.w;
    const monkeys = w.creatures('monkey');
    if (!monkeys.length) return;
    const m = pick(monkeys);
    w.jump(m, 0.8);
    const p = m.body.translation();
    for (let i = 0; i < 2; i++) {
      const aim = w.camera.position.clone().add(new THREE.Vector3(rand(-6, 6), rand(-5, -2), -8));
      const from = new THREE.Vector3(p.x, p.y + 1.5, p.z);
      const vel = aim.sub(from).setLength(rand(11, 16));
      vel.y += 5;
      this.later(i * 180, () => w.spawn('banana', from.clone(), vel));
    }
    w.boostDopamine(15);
    if (Math.random() < 0.7) w.caption(pick(MEETING_LINES), 'meeting', 4);
  }

  update(dt: number) {
    const w = this.w;
    const s = w.sound;

    // ambient birds when things are calm-ish
    if (s.ctx && (!this.playing || this.current === 'gentle-rain') && w.t > this.nextChirp) {
      this.nextChirp = w.t + rand(3, 8);
      s.chirp();
      if (Math.random() < 0.15) w.caption('[bird says something rude in bird]', 'bird', 20);
    }

    if (!this.playing || !this.current) return;
    this.elapsed += dt;
    const e = this.elapsed;

    switch (this.current) {
      case 'gentle-rain':
        if (e > this.nextEvent) {
          this.nextEvent = e + rand(4, 8);
          w.spawn('leaf');
        }
        break;

      case 'sloth-asmr':
        if (e > this.nextEvent) {
          this.nextEvent = e + rand(3, 5);
          s.whisper();
        }
        if (e > this.nextLine) {
          this.nextLine = e + 7;
          w.caption(SLOTH_LINES[Math.min(this.lineIdx++, SLOTH_LINES.length - 1)], undefined, 0, true);
        }
        break;

      case 'thunder':
        if (e > this.nextEvent) {
          this.nextEvent = e + rand(3, 7);
          w.lightning();
          s.thunder(s.now + rand(0.05, 0.5));
          // the storm briefly redefines "down"
          const g = new THREE.Vector3(rand(-1, 1), rand(-1.2, 0.4), rand(-0.5, 0.5)).normalize().multiplyScalar(11);
          w.gravityOverride = g;
          w.wakeAll();
          this.later(1100, () => (w.gravityOverride = null));
          w.boostDopamine(60);
          w.caption(pick(['[the sky read your group chat]', '[lightning, judgmentally]', '[thunder, but personally]', '[gravity briefly changes its mind]']), 'thunder', 2);
        }
        break;

      case 'leaf-4h': {
        const leaf = this.special;
        if (leaf && w.ents.has(leaf.body.handle)) {
          const p = leaf.body.translation();
          w.lookTarget?.set(p.x, p.y, p.z);
          const v = leaf.body.linvel();
          if (!this.landed && e > 4 && Math.hypot(v.x, v.y, v.z) < 0.05 && p.y < 4) {
            this.landed = true;
            w.caption('[the leaf has landed. 3 hours, 58 minutes of reflection remain]', undefined, 0, true);
          }
        }
        if (e > this.nextEvent) {
          this.nextEvent = e + 14;
          s.drone(s.now, 14);
        }
        if (e > this.nextLine && !this.landed) {
          this.nextLine = e + 9;
          w.caption(`[leaf progress: ${((e / 14400) * 100).toFixed(3)}%]`, undefined, 0, true);
        }
        break;
      }
    }

    if (w.t - this.lastProgress > 0.25) {
      this.lastProgress = w.t;
      const duration = trackById(this.current).duration;
      this.bus.emit('track:progress', { id: this.current, elapsed: Math.min(e, duration), duration });
      if (e >= duration) {
        const id = this.current;
        this.pause();
        this.bus.emit('track:ended', { id });
      }
    }
  }
}
