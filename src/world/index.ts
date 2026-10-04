import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Bus, SpawnKind } from '../bus';
import { World } from './world';
import { Director } from './director';

const rand = (a: number, b: number) => a + Math.random() * (b - a);

const SPAWN_CAPTIONS: Record<SpawnKind, string> = {
  frog: '[a frog has been added. it did not ask to be.]',
  toucan: '[toucan airstrike inbound]',
  sloth: '[sloth deployed. ETA: eventually]',
  capybara: '[one (1) capybara, calm]',
  monkey: '[a monkey joins the meeting late]',
  leaf: '[leaf]',
  banana: '[banana, for scale]',
  cookie: '[wet cookie delivered]',
  molecule: '[pure dopamine, now in 3D]',
};

export async function createWorld(canvas: HTMLCanvasElement, bus: Bus) {
  await RAPIER.init();
  const w = new World(canvas, bus);
  w.init();
  const d = new Director(w, bus);
  let titled = false;

  bus.on('audio:unlock', () => {
    w.sound.unlock();
    w.sound.setRain(0.2);
    w.rainLevel = 0.25;
    if (!titled) {
      titled = true;
      w.spawnTitle();
    }
  });

  bus.on('spawn', ({ kind, count = 1 }) => {
    for (let i = 0; i < count; i++) {
      window.setTimeout(() => {
        if (kind === 'toucan') {
          const target = w.randomDrop(0);
          const from = new THREE.Vector3(target.x + rand(-5, 5), 20, target.z - rand(2, 5));
          w.spawn('toucan', from, target.sub(from).setLength(rand(15, 22)));
          if (w.sound.allow(10)) w.sound.squawk();
        } else {
          w.spawn(kind);
        }
      }, i * (kind === 'toucan' ? 160 : 70));
    }
    w.boostDopamine(12 * count);
    w.caption(count > 1 && kind !== 'toucan' ? `[${count} ${kind}s. that's a lot of ${kind}s.]` : SPAWN_CAPTIONS[kind], `spawn-${kind}`, 3, true);
    if (kind === 'frog' && w.sound.allow()) w.sound.croak(1.2);
    if (kind === 'capybara') w.sound.thud(0.5);
    if (kind === 'molecule') w.sound.ping();
  });

  bus.on('track:play', ({ id }) => d.play(id));
  bus.on('track:pause', () => d.pause());
  bus.on('nonchalant', ({ on }) => w.setNonchalant(on));
  bus.on('gravity', ({ mode }) => w.setGravityMode(mode));
  bus.on('mute', ({ muted }) => w.sound.setMuted(muted));
  bus.on('volume', ({ value }) => w.sound.setVolume(value));
  bus.on('insets', (i) => w.setInsets(i));

  bus.on('dopamine:reset', () => {
    const s = w.sound;
    s.riser(1.3);
    w.caption('[resetting dopamine…]', undefined, 0, true);
    window.setTimeout(() => {
      s.boom();
      w.yeet(1);
      w.resetDopamine();
      w.caption('[dopamine has been reset to factory settings]', undefined, 0, true);
    }, 1300);
    window.setTimeout(() => {
      s.sadTrombone();
      w.caption('[please do not enjoy anything for 6–8 business days]', undefined, 0, true);
    }, 3600);
  });

  const timer = new THREE.Timer();
  timer.connect(document);
  const loop = (now: number) => {
    timer.update(now);
    const raw = timer.getDelta();
    // song time is wall-clock time; physics time is capped so a slow frame can't explode the frogs
    d.update(Math.min(raw, 0.25));
    w.update(Math.min(raw, 1 / 20));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  bus.emit('ready');
  // handy for poking frogs from devtools
  (window as unknown as { rainforest: unknown }).rainforest = { world: w, director: d, bus };
}
