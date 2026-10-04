import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { FontLoader, type Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontJson from './fonts/luckiest.typeface.json';
import type { Bus, GravityMode, SpawnKind } from '../bus';
import { Sound } from './audio';
import { barkTexture, groundTexture, stickerTexture, TweetTexture } from './textures';

type EKind = SpawnKind | 'letter' | 'tweet' | 'drop';

export interface Ent {
  kind: EKind;
  body: RAPIER.RigidBody;
  obj: THREE.Object3D;
  born: number;
  size: number;
  creature: boolean;
  nextHop: number;
  lastSound: number;
  life?: number;
  char?: string;
  fallen?: boolean;
  giant?: boolean;
}

interface StickerSpec {
  emoji: string;
  size: number;
  density: number;
  restitution: number;
  creature: boolean;
  linDamp?: number;
  angDamp?: number;
  back: [string, string];
}

const STICKERS: Record<Exclude<SpawnKind, 'molecule'>, StickerSpec> = {
  frog: { emoji: '🐸', size: 1.5, density: 1, restitution: 0.55, creature: true, back: ['BACK OF FROG', 'not currently accepting feedback'] },
  toucan: { emoji: '🦜', size: 1.9, density: 0.8, restitution: 0.35, creature: true, back: ['TOUCAN (REAR)', 'direct all complaints to the beak'] },
  sloth: { emoji: '🦥', size: 2.2, density: 1.2, restitution: 0.1, creature: true, angDamp: 1.5, back: ['OUT OF OFFICE', 'back in 3–5 business years'] },
  capybara: { emoji: '🦫', size: 2.2, density: 7, restitution: 0.05, creature: true, back: ['CAPYBARA', 'has never cared. will never care.'] },
  monkey: { emoji: '🐒', size: 2, density: 1, restitution: 0.3, creature: true, back: ['IN A MEETING', 'please do not knock'] },
  leaf: { emoji: '🍃', size: 1.7, density: 0.15, restitution: 0.1, creature: false, linDamp: 2.2, angDamp: 1.2, back: ['', ''] },
  banana: { emoji: '🍌', size: 1.1, density: 0.8, restitution: 0.4, creature: false, back: ['BANANA', 'an action item'] },
  cookie: { emoji: '🍪', size: 1.1, density: 0.9, restitution: 0.15, creature: false, back: ['COOKIE', 'wet. sorry.'] },
};

const CAPTIONS: Record<string, string[]> = {
  frog: ['[frog making direct eye contact]', '[ribbit (derogatory)]', '[frog jumps for no reason]', '[frog, emotionally: ribbit]', '[frog knows what you did]', '[a frog clears its throat]'],
  toucan: ['[toucan screaming in Portuguese]', '[beak noises]', '[toucan did not consent to gravity]', '[toucan, loudly: HELLO]'],
  capybara: ['[capybara remains unbothered]', '[capybara has achieved inner peace. again.]', '[capybara: no comment]'],
  sloth: ["[sloth, six seconds from now: 'hey']", '[sloth breathing audibly]', '[sloth has entered the chat. slowly.]'],
  monkey: ["[monkey: 'let's circle back']", "[monkey: 'you're on mute']", '[howler monkey interrupts]', "[monkey: 'can everyone see my screen']"],
  cookie: ['[wet cookie noises]', '[soggy crunch]', '[cookie, damply]'],
  molecule: ['[raw dopamine clinking]', '[dopamine molecule tries to escape]', '[chemistry happening]'],
  banana: ['[banana thrown with intent]', '[banana peel foreshadowing]'],
  leaf: ['[a leaf, loudly]', '[leaf lands. nobody claps.]'],
  letter: ['[typography falling over]', '[the brand is collapsing]'],
  idle: ['[distant frog judging you]', '[rain, but quietly disappointed]', '[wet silence]', '[bird says something rude in bird]', '[the rainforest is buffering]', '[a mosquito has opinions]', '[somewhere, a frog is filming this]'],
};

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const LETTER_COLORS = ['#ffd23f', '#3bceac', '#ee4266', '#0ead69', '#ff8c42', '#b4e33d', '#7b61ff', '#f7f7f2'];
const FIXED = 1 / 60;
const UP = new THREE.Vector3(0, 1, 0);

export class World {
  readonly sound = new Sound();
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  physics!: RAPIER.World;
  private events!: RAPIER.EventQueue;
  private font: Font;

  ents = new Map<number, Ent>();
  private byCollider = new Map<number, Ent>();
  private pickables: THREE.Object3D[] = [];
  private ground!: THREE.Mesh;
  private wallL?: RAPIER.RigidBody;
  private wallR?: RAPIER.RigidBody;
  private wallX = 17;
  private insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private viewOff = new THREE.Vector2();
  private viewOffTarget = new THREE.Vector2();
  private stickerMats = new Map<string, THREE.Material>();
  private planeGeo = new THREE.PlaneGeometry(1, 1);
  private dropGeo = new THREE.SphereGeometry(0.1, 8, 6);
  private dropMat = new THREE.MeshStandardMaterial({ color: '#bfe6ff', roughness: 0.05, transparent: true, opacity: 0.75 });

  // state
  t = 0;
  timeScale = 1;
  gravityMode: GravityMode = 'normal';
  private sidewaysSign = 1;
  gravityOverride: THREE.Vector3 | null = null;
  readonly gravity = new THREE.Vector3(0, -9.81, 0);
  nonchalant = false;
  /** When set, creatures stare at this point instead of at you. */
  lookTarget: THREE.Vector3 | null = null;
  autoHop = true;
  rainLevel = 0;
  private dopamine = 40;
  private dopBoost = 0;
  private dopSuppress = 1;
  private dopHold = 0;
  private likes = 5;
  private lastLike = 0;
  private tweet = new TweetTexture();
  private shake = 0;
  private flash = 0;
  private lastCaption = 0;
  private captionCooldown = new Map<string, number>();
  private lastInteraction = 0;
  private spawnHalfW = 10;

  // lights & fx
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private rain!: THREE.LineSegments;
  private rainPos!: Float32Array;
  private camBase = new THREE.Vector3(0, 7, 18);
  private camTarget = new THREE.Vector3(0, 3, -1);
  private pointer = new THREE.Vector2();

  // grab
  private grabbed: Ent | null = null;
  private grabLocal = new THREE.Vector3();
  private grabPlane = new THREE.Plane();
  private grabTarget = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();

  // perf
  private frames = 0;
  private fps = 60;
  private lastStats = 0;
  private lastDop = 0;

  private canvas: HTMLCanvasElement;
  private bus: Bus;

  constructor(canvas: HTMLCanvasElement, bus: Bus) {
    this.canvas = canvas;
    this.bus = bus;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.font = new FontLoader().parse(fontJson as never);
  }

  init() {
    this.physics = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.physics.timestep = FIXED;
    this.events = new RAPIER.EventQueue(true);
    this.resize();
    this.buildEnvironment();
    this.buildTweetSign();
    addEventListener('resize', () => this.resize());
    this.bindPointer();

    // a few locals already hanging around before you arrive
    for (let i = 0; i < 4; i++) this.spawn('frog', new THREE.Vector3(rand(-8, 8), rand(1, 4), rand(-6, 3)));
    this.spawn('capybara', new THREE.Vector3(-6, 2, 2));
    for (let i = 0; i < 3; i++) this.spawn('leaf');
    this.spawn('molecule', new THREE.Vector3(4, 6, 1));
  }

  // ------------------------------------------------------------------ environment

  private buildEnvironment() {
    const s = this.scene;
    s.background = new THREE.Color('#0d2614');
    s.fog = new THREE.FogExp2('#12301a', 0.022);

    this.hemi = new THREE.HemisphereLight('#d8ffd0', '#1b2a12', 1.5);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4d6', 2.4);
    this.sun.position.set(-8, 22, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -20;
    sc.right = 20;
    sc.top = 20;
    sc.bottom = -20;
    sc.near = 1;
    sc.far = 60;
    this.sun.shadow.bias = -0.0005;
    s.add(this.sun);
    const fill = new THREE.DirectionalLight('#7fd6ff', 0.5);
    fill.position.set(10, 6, 14);
    s.add(fill);

    // backdrop: a curved wall of painted jungle
    const backTex = new THREE.TextureLoader().load('/assets/backdrop.webp');
    backTex.colorSpace = THREE.SRGBColorSpace;
    const backdrop = new THREE.Mesh(
      new THREE.CylinderGeometry(55, 55, 60, 48, 1, true, Math.PI * 0.55, Math.PI * 0.9),
      new THREE.MeshBasicMaterial({ map: backTex, side: THREE.BackSide, fog: false, color: '#8fa88f' }),
    );
    backdrop.position.set(0, 12, 0);
    s.add(backdrop);

    // ground
    const gt = groundTexture();
    gt.repeat.set(8, 8);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ map: gt, roughness: 0.95 }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    s.add(this.ground);
    this.pickables.push(this.ground);

    const fixed = (x: number, y: number, z: number) => this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(60, 1, 60).setFriction(0.9), fixed(0, -1, 0));
    // invisible arena: side walls, back wall, a "glass" front wall right in front of your face, and a ceiling
    this.wallL = fixed(-17, 15, 0);
    this.wallR = fixed(17, 15, 0);
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(1, 30, 30), this.wallL);
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(1, 30, 30), this.wallR);
    this.placeWalls();
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(30, 30, 1), fixed(0, 15, -14));
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(30, 30, 1).setRestitution(0.3), fixed(0, 15, 9));
    this.physics.createCollider(RAPIER.ColliderDesc.cuboid(30, 1, 30), fixed(0, 27, 0));

    // trees
    const bark = barkTexture();
    bark.repeat.set(1, 4);
    const barkMat = new THREE.MeshStandardMaterial({ map: bark, roughness: 1 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: '#1d4a22', roughness: 0.8, flatShading: true });
    const canopyMat2 = new THREE.MeshStandardMaterial({ color: '#2c6b2a', roughness: 0.8, flatShading: true });
    const trees: [number, number, number][] = [
      [-13, -9, 0.9],
      [-8.5, -12, 0.7],
      [12.5, -6, 1.0],
      [8, -12.5, 0.8],
      [-15, 1, 0.8],
      [15, 3, 0.7],
      [-2, -13, 0.6],
    ];
    for (const [x, z, r] of trees) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r * 1.25, 30, 12), barkMat);
      trunk.position.set(x, 15, z);
      trunk.castShadow = trunk.receiveShadow = true;
      s.add(trunk);
      this.physics.createCollider(RAPIER.ColliderDesc.cylinder(15, r).setFriction(0.6), fixed(x, 15, z));
      for (let i = 0; i < 4; i++) {
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(3, 5), 0), i % 2 ? canopyMat : canopyMat2);
        blob.position.set(x + rand(-3, 3), rand(20, 26), z + rand(-3, 3));
        blob.rotation.set(rand(0, 3), rand(0, 3), 0);
        s.add(blob);
      }
      // roots/buttresses
      for (let i = 0; i < 4; i++) {
        const root = new THREE.Mesh(new THREE.ConeGeometry(r * 0.9, 2.5, 5), barkMat);
        const a = (i / 4) * Math.PI * 2 + rand(0, 1);
        root.position.set(x + Math.cos(a) * r * 1.1, 0.8, z + Math.sin(a) * r * 1.1);
        root.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
        root.castShadow = true;
        s.add(root);
      }
    }

    // hanging vines
    const vineMat = new THREE.MeshStandardMaterial({ color: '#3f7a2a', roughness: 0.9 });
    for (let i = 0; i < 14; i++) {
      const x = rand(-16, 16);
      const z = rand(-12, -2);
      const len = rand(6, 16);
      const pts = [];
      for (let k = 0; k <= 6; k++) pts.push(new THREE.Vector3(x + Math.sin(k + i) * 0.4, 26 - (k / 6) * len, z + Math.cos(k * 0.7) * 0.3));
      const vine = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.06, 5), vineMat);
      s.add(vine);
    }

    // decorative ground leaves (not physical, just vibes)
    const leafMat = this.stickerMaterial('leaf');
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(this.planeGeo, leafMat);
      const sz = rand(2, 4.5);
      m.scale.set(sz, sz, 1);
      const a = rand(0, Math.PI * 2);
      const d = rand(10, 18);
      m.position.set(Math.cos(a) * d, rand(0.05, 1.5), Math.sin(a) * d * 0.7 - 4);
      m.rotation.set(-Math.PI / 2 + rand(0, 1.1), rand(-0.5, 0.5), rand(0, Math.PI * 2));
      m.receiveShadow = true;
      s.add(m);
    }

    // god rays
    const rayMat = new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.6, rand(2.5, 4), 34, 16, 1, true), rayMat);
      ray.position.set(rand(-10, 10), 12, rand(-10, 2));
      ray.rotation.set(0.25, 0, rand(-0.35, -0.15));
      s.add(ray);
    }

    // rain streaks
    const N = 1400;
    this.rainPos = new Float32Array(N * 6);
    for (let i = 0; i < N; i++) {
      const x = rand(-22, 22);
      const y = rand(-1, 26);
      const z = rand(-14, 12);
      this.rainPos.set([x, y, z, x, y - 0.6, z], i * 6);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: '#d4ecff', transparent: true, opacity: 0 }));
    this.rain.frustumCulled = false;
    s.add(this.rain);
  }

  private backTexture(kind: string, spec: StickerSpec) {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d')!;
    if (kind === 'leaf') {
      g.fillStyle = '#2d5a22';
      g.fillRect(0, 0, 512, 512);
    } else {
      g.fillStyle = '#e4d6b8';
      g.fillRect(0, 0, 512, 512);
      g.strokeStyle = 'rgba(120,95,60,0.18)';
      g.lineWidth = 3;
      for (let x = -512; x < 512; x += 14) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 512, 512);
        g.stroke();
      }
      g.save();
      g.translate(256, 250);
      g.rotate(-0.12);
      g.textAlign = 'center';
      g.fillStyle = '#5a3d1e';
      g.font = 'bold 50px "Arial Black", Impact, sans-serif';
      g.fillText(spec.back[0], 0, -10);
      g.font = 'italic 27px Georgia, serif';
      const words = spec.back[1].split(' ');
      let line = '';
      let y = 40;
      for (const w of words) {
        if (g.measureText(line + w).width > 330) {
          g.fillText(line.trim(), 0, y);
          line = '';
          y += 34;
        }
        line += w + ' ';
      }
      g.fillText(line.trim(), 0, y);
      g.restore();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** One double-sided material per sticker kind: art on the front, cardboard + passive-aggressive label on the back. */
  private stickerMaterial(kind: Exclude<SpawnKind, 'molecule'>) {
    const hit = this.stickerMats.get(kind);
    if (hit) return hit;
    const spec = STICKERS[kind];
    const tex = stickerTexture(kind, spec.emoji);
    const backMap = this.backTexture(kind, spec);
    const m = new THREE.MeshStandardMaterial({
      map: tex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      roughness: 0.38,
      emissive: '#ffffff',
      emissiveMap: tex,
      emissiveIntensity: 0.22,
    });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.backMap = { value: backMap };
      sh.fragmentShader = 'uniform sampler2D backMap;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\nif (!gl_FrontFacing) diffuseColor.rgb = texture2D(backMap, vec2(1.0 - vMapUv.x, vMapUv.y)).rgb;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nif (!gl_FrontFacing) totalEmissiveRadiance *= 0.15;');
    };
    this.stickerMats.set(kind, m);
    return m;
  }

  // ------------------------------------------------------------------ entities

  private register(ent: Ent) {
    this.ents.set(ent.body.handle, ent);
    for (let i = 0; i < ent.body.numColliders(); i++) this.byCollider.set(ent.body.collider(i).handle, ent);
    ent.obj.traverse((o) => {
      o.userData.ent = ent;
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        this.pickables.push(o);
      }
    });
    this.scene.add(ent.obj);
    this.enforceCap();
    return ent;
  }

  remove(ent: Ent) {
    if (!this.ents.has(ent.body.handle)) return;
    if (this.grabbed === ent) this.grabbed = null;
    for (let i = 0; i < ent.body.numColliders(); i++) this.byCollider.delete(ent.body.collider(i).handle);
    this.ents.delete(ent.body.handle);
    this.physics.removeRigidBody(ent.body);
    this.scene.remove(ent.obj);
    const meshes = new Set<THREE.Object3D>();
    ent.obj.traverse((o) => meshes.add(o));
    this.pickables = this.pickables.filter((p) => !meshes.has(p));
    if (ent.kind === 'letter') (ent.obj as THREE.Mesh).geometry.dispose();
  }

  private enforceCap() {
    const MAX = 230;
    let count = 0;
    for (const e of this.ents.values()) if (e.kind !== 'letter' && e.kind !== 'tweet') count++;
    if (count <= MAX) return;
    let oldest: Ent | null = null;
    for (const e of this.ents.values()) {
      if (e.kind === 'letter' || e.kind === 'tweet' || e.giant) continue;
      if (!oldest || e.born < oldest.born) oldest = e;
    }
    if (oldest) {
      this.remove(oldest);
      this.caption(`[the oldest ${oldest.kind} has been quietly recycled]`, 'recycle', 12);
    }
  }

  randomDrop(y = rand(12, 18)) {
    return new THREE.Vector3(rand(-this.spawnHalfW, this.spawnHalfW), y, rand(-9, 5));
  }

  spawn(kind: SpawnKind, pos = this.randomDrop(), vel?: THREE.Vector3, opts: { scale?: number; giant?: boolean } = {}) {
    this.lastInteraction = this.t;
    if (kind === 'molecule') return this.spawnMolecule(pos, vel);
    const spec = STICKERS[kind];
    const size = spec.size * (opts.scale ?? 1) * rand(0.9, 1.1);
    const mesh = new THREE.Mesh(this.planeGeo, this.stickerMaterial(kind));
    mesh.scale.set(size, size, 1);
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-0.6, 0.6), rand(-0.8, 0.8), rand(-0.8, 0.8)));
    const bd = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, pos.y, pos.z)
      .setRotation(q)
      .setLinearDamping(spec.linDamp ?? 0.05)
      .setAngularDamping(spec.angDamp ?? 0.4)
      .setCcdEnabled(kind === 'toucan' || kind === 'banana');
    if (vel) bd.setLinvel(vel.x, vel.y, vel.z);
    bd.setAngvel({ x: rand(-2, 2), y: rand(-2, 2), z: rand(-2, 2) });
    const body = this.physics.createRigidBody(bd);
    const col = this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(size * 0.4, size * 0.44, Math.max(0.12, size * 0.1))
        .setDensity(spec.density)
        .setRestitution(spec.restitution)
        .setFriction(0.8)
        .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS),
      body,
    );
    col.setContactForceEventThreshold(col.mass() * 70);
    return this.register({
      kind,
      body,
      obj: mesh,
      born: this.t,
      size,
      creature: spec.creature,
      nextHop: this.t + rand(2, 6),
      lastSound: 0,
      giant: opts.giant,
    });
  }

  /** A 3D ball-and-stick dopamine molecule (C8H11NO2, hydrogens mostly omitted for your comfort). */
  private spawnMolecule(pos: THREE.Vector3, vel?: THREE.Vector3) {
    const r = 0.75;
    const ring: THREE.Vector3[] = [];
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 2 - (k * Math.PI) / 3;
      ring.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    const o1 = ring[2].clone().multiplyScalar(1.85);
    const o2 = ring[3].clone().multiplyScalar(1.85);
    const ca = new THREE.Vector3(0, r + 0.75, 0.15);
    const cb = new THREE.Vector3(0.66, r + 1.12, -0.1);
    const n = new THREE.Vector3(0.66, r + 1.9, 0.1);
    const h1 = o1.clone().add(new THREE.Vector3(0.5, -0.2, 0));
    const h2 = o2.clone().add(new THREE.Vector3(0.25, -0.45, 0));
    const hn1 = n.clone().add(new THREE.Vector3(0.45, 0.35, 0.1));
    const hn2 = n.clone().add(new THREE.Vector3(-0.45, 0.35, -0.1));
    const atoms: [THREE.Vector3, string, number][] = [
      ...ring.map((p) => [p, '#3a3a3a', 0.3] as [THREE.Vector3, string, number]),
      [o1, '#ff3b3b', 0.32],
      [o2, '#ff3b3b', 0.32],
      [ca, '#3a3a3a', 0.3],
      [cb, '#3a3a3a', 0.3],
      [n, '#3b6bff', 0.32],
      [h1, '#f4f4f4', 0.18],
      [h2, '#f4f4f4', 0.18],
      [hn1, '#f4f4f4', 0.18],
      [hn2, '#f4f4f4', 0.18],
    ];
    const bonds: [THREE.Vector3, THREE.Vector3][] = [
      ...ring.map((p, i) => [p, ring[(i + 1) % 6]] as [THREE.Vector3, THREE.Vector3]),
      [ring[2], o1],
      [ring[3], o2],
      [ring[0], ca],
      [ca, cb],
      [cb, n],
      [o1, h1],
      [o2, h2],
      [n, hn1],
      [n, hn2],
    ];
    // center it
    const c = new THREE.Vector3();
    atoms.forEach(([p]) => c.add(p));
    c.divideScalar(atoms.length);
    const g = new THREE.Group();
    const bd = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setAngvel({ x: rand(-3, 3), y: rand(-3, 3), z: rand(-3, 3) });
    if (vel) bd.setLinvel(vel.x, vel.y, vel.z);
    const body = this.physics.createRigidBody(bd);
    for (const [p, color, rad] of atoms) {
      const lp = p.clone().sub(c);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(rad, 18, 14),
        new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 }),
      );
      m.position.copy(lp);
      g.add(m);
      const col = this.physics.createCollider(
        RAPIER.ColliderDesc.ball(rad).setTranslation(lp.x, lp.y, lp.z).setDensity(1.5).setRestitution(0.5).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS),
        body,
      );
      col.setContactForceEventThreshold(40);
    }
    const bondMat = new THREE.MeshStandardMaterial({ color: '#d9d9d9', roughness: 0.3 });
    for (const [a, b] of bonds) {
      const len = a.distanceTo(b);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 8), bondMat);
      m.position.copy(a).add(b).multiplyScalar(0.5).sub(c);
      m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
      g.add(m);
    }
    return this.register({ kind: 'molecule', body, obj: g, born: this.t, size: 2.5, creature: false, nextHop: 0, lastSound: 0 });
  }

  spawnTitle() {
    const rows: [string, number, number][] = [
      ['RAINFOREST', -4.5, 1.45],
      ['SOUNDS', 1.5, 1.7],
    ];
    let delay = 0;
    rows.forEach(([word, z, size], ri) => {
      const geos = [...word].map((ch) => {
        const geo = new TextGeometry(ch, {
          font: this.font,
          size,
          depth: 0.6,
          curveSegments: 5,
          bevelEnabled: true,
          bevelThickness: 0.06,
          bevelSize: 0.04,
          bevelSegments: 2,
        });
        geo.computeBoundingBox();
        geo.center();
        return geo;
      });
      const widths = geos.map((g) => g.boundingBox!.max.x - g.boundingBox!.min.x);
      const gap = 0.12;
      const total = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
      const scale = Math.min(1, (this.spawnHalfW * 2 + 1) / total);
      let x = (-total / 2) * scale;
      geos.forEach((geo, i) => {
        geo.scale(scale, scale, scale);
        geo.computeBoundingBox();
        const bb = geo.boundingBox!;
        const w = widths[i] * scale;
        const cx = x + w / 2;
        x += w + gap * scale;
        const color = LETTER_COLORS[(i + ri * 3) % LETTER_COLORS.length];
        setTimeout(() => {
          const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 }));
          const body = this.physics.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic()
              .setTranslation(cx, rand(6, 8.5), z)
              .setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(-0.03, 0.03), rand(-0.05, 0.05), rand(-0.04, 0.04))))
              .setAngularDamping(0.3),
          );
          const col = this.physics.createCollider(
            RAPIER.ColliderDesc.cuboid((bb.max.x - bb.min.x) / 2, (bb.max.y - bb.min.y) / 2, (bb.max.z - bb.min.z) / 2)
              .setDensity(0.8)
              .setRestitution(0.2)
              .setFriction(0.9)
              .setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS),
            body,
          );
          col.setContactForceEventThreshold(col.mass() * 60);
          this.register({ kind: 'letter', body, obj: mesh, born: this.t, size: 1.5, creature: false, nextHop: 0, lastSound: 0, char: word[i] });
        }, delay);
        delay += 110;
      });
    });
  }

  private buildTweetSign() {
    const halfW = Math.min(6, this.spawnHalfW * 0.6);
    const anchorPos = new THREE.Vector3(halfW, 10.2, -7);
    const anchor = this.physics.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(anchorPos.x, anchorPos.y, anchorPos.z));
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 14, 10), new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 1 }));
    branch.rotation.z = Math.PI / 2;
    branch.position.copy(anchorPos).add(new THREE.Vector3(3, 0.25, 0));
    branch.castShadow = true;
    this.scene.add(branch);

    const W = 4.2;
    const H = W * (680 / 1024);
    const hang = H / 2 + 0.45;
    const body = this.physics.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(anchorPos.x, anchorPos.y - hang, anchorPos.z).setAngularDamping(0.25).setLinearDamping(0.1),
    );
    const col = this.physics.createCollider(
      RAPIER.ColliderDesc.cuboid(W / 2, H / 2, 0.06).setDensity(0.6).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS),
      body,
    );
    col.setContactForceEventThreshold(8);
    for (const sx of [-1, 1]) {
      this.physics.createImpulseJoint(
        RAPIER.JointData.spherical({ x: sx * W * 0.4, y: 0, z: 0 }, { x: sx * W * 0.4, y: hang, z: 0 }),
        anchor,
        body,
        true,
      );
    }
    const white = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.6 });
    const front = new THREE.MeshStandardMaterial({ map: this.tweet.texture, roughness: 0.5, emissive: '#ffffff', emissiveMap: this.tweet.texture, emissiveIntensity: 0.35 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.12), [white, white, white, white, front, white]);
    const ropeMat = new THREE.MeshStandardMaterial({ color: '#c9b48a', roughness: 1 });
    for (const sx of [-1, 1]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 6), ropeMat);
      rope.position.set(sx * W * 0.4, H / 2 + 0.22, 0);
      mesh.add(rope);
    }
    this.register({ kind: 'tweet', body, obj: mesh, born: 0, size: W, creature: false, nextHop: 0, lastSound: 0 });
  }

  // ------------------------------------------------------------------ actions

  setGravityMode(mode: GravityMode) {
    if (mode === 'sideways' && this.gravityMode === 'sideways') this.sidewaysSign *= -1;
    this.gravityMode = mode;
    this.wakeAll();
    const lines: Record<GravityMode, string> = {
      normal: '[gravity returns to its day job]',
      moon: '[everything becomes 83% less committed]',
      sideways: '[gravity has chosen a side]',
      'upside-down': '[the floor is now optional]',
      emotional: '[gravity is going through something]',
    };
    this.caption(lines[mode], undefined, 0, true);
  }

  setNonchalant(on: boolean) {
    this.nonchalant = on;
    this.wakeAll();
    this.caption(on ? '[everyone pretends they didn’t see you]' : '[caring is cool again. everyone turns around.]', undefined, 0, true);
  }

  wakeAll() {
    for (const e of this.ents.values()) e.body.wakeUp();
  }

  /** The Great Yeet. Used by the big red button. */
  yeet(strength = 1) {
    const g = this.gravity.clone().normalize().negate();
    for (const e of this.ents.values()) {
      if (e.kind === 'drop') continue;
      const m = e.body.mass();
      const up = g.clone().multiplyScalar(rand(10, 20) * strength * m);
      up.x += rand(-5, 5) * m;
      up.z += rand(-4, 2) * m;
      e.body.applyImpulse(up, true);
      e.body.setAngvel({ x: rand(-8, 8), y: rand(-8, 8), z: rand(-8, 8) }, true);
    }
    this.shake = 1.4;
    this.flash = 0.7;
  }

  resetDopamine() {
    this.dopSuppress = 0;
    this.dopHold = 2.5;
    this.dopBoost = 0;
  }

  boostDopamine(v: number) {
    this.dopBoost = Math.min(600, this.dopBoost + v);
  }

  lightning() {
    this.flash = 1;
    this.shake = 0.6;
  }

  addShake(v: number) {
    this.shake = Math.max(this.shake, v);
  }

  jump(e: Ent, power = 1) {
    const m = e.body.mass();
    const up = this.gravity.clone().normalize().negate();
    const imp = up.multiplyScalar(rand(5.5, 8) * power * m);
    imp.x += rand(-1.5, 1.5) * m;
    imp.z += rand(-1.5, 1.5) * m;
    e.body.applyImpulse(imp, true);
    e.body.applyTorqueImpulse({ x: rand(-0.3, 0.3) * m, y: rand(-0.3, 0.3) * m, z: rand(-0.3, 0.3) * m }, true);
  }

  creatures(kind?: SpawnKind) {
    return [...this.ents.values()].filter((e) => (kind ? e.kind === kind : e.creature));
  }

  caption(text: string, key?: string, cooldown = 5, force = false) {
    const k = key ?? text;
    const last = this.captionCooldown.get(k) ?? -99;
    if (!force && (this.t - last < cooldown || this.t - this.lastCaption < 1.4)) return;
    this.captionCooldown.set(k, this.t);
    this.lastCaption = this.t;
    this.bus.emit('caption', { text });
  }

  // ------------------------------------------------------------------ input

  private bindPointer() {
    const c = this.canvas;
    const setNdc = (e: PointerEvent) => {
      this.pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    };
    c.addEventListener('pointerdown', (e) => {
      setNdc(e);
      this.lastInteraction = this.t;
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
      if (!hit) return;
      const ent = hit.object.userData.ent as Ent | undefined;
      if (ent) {
        this.grabbed = ent;
        const bp = ent.body.translation();
        const br = ent.body.rotation();
        const inv = new THREE.Quaternion(br.x, br.y, br.z, br.w).invert();
        this.grabLocal.copy(hit.point).sub(new THREE.Vector3(bp.x, bp.y, bp.z)).applyQuaternion(inv);
        this.grabPlane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()).negate(), hit.point);
        this.grabTarget.copy(hit.point);
        c.setPointerCapture(e.pointerId);
        c.style.cursor = 'grabbing';
        ent.body.wakeUp();
        if (ent.kind === 'tweet') this.caption('[you are touching the tweet. it has been noted.]', 'grab-tweet', 10);
        else if (ent.kind === 'capybara') this.caption('[you picked up a capybara. it is fine with this.]', 'grab-capy', 10);
        else if (ent.kind === 'letter') this.caption(`[you are holding the letter ${ent.char}. why]`, 'grab-letter', 10);
        else this.caption(`[you picked up a ${ent.kind}. the ${ent.kind} noticed.]`, 'grab', 8);
        this.playHitSound(ent, 0.7);
      } else {
        // clicked the jungle floor: something falls from the sky exactly there
        const kinds: SpawnKind[] = ['frog', 'frog', 'frog', 'toucan', 'capybara', 'monkey', 'sloth', 'banana', 'cookie', 'molecule', 'leaf'];
        const k = pick(kinds);
        this.spawn(k, new THREE.Vector3(THREE.MathUtils.clamp(hit.point.x, -this.wallX + 1, this.wallX - 1), rand(11, 14), THREE.MathUtils.clamp(hit.point.z, -12, 7)));
        this.boostDopamine(12);
        this.sound.boing();
      }
    });
    c.addEventListener('pointermove', (e) => {
      setNdc(e);
      if (this.grabbed) {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        this.raycaster.ray.intersectPlane(this.grabPlane, this.grabTarget);
      } else if (e.pointerType === 'mouse') {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        const hit = this.raycaster.intersectObjects(this.pickables, false)[0];
        c.style.cursor = hit?.object.userData.ent ? 'grab' : 'crosshair';
      }
    });
    const release = () => {
      const e = this.grabbed;
      if (!e) return;
      this.grabbed = null;
      c.style.cursor = 'crosshair';
      const v = e.body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z) * 3.6;
      if (speed > 25) {
        const who = e.kind === 'letter' ? `the letter ${e.char}` : `a ${e.kind}`;
        this.caption(`[${who} launched at ${Math.round(speed)} km/h]`, 'fling', 2, true);
        this.boostDopamine(speed * 0.6);
      }
    };
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);
  }

  // ------------------------------------------------------------------ sim

  private updateGravity() {
    const G = 9.81;
    if (this.gravityOverride) {
      this.gravity.copy(this.gravityOverride);
    } else {
      switch (this.gravityMode) {
        case 'normal':
          this.gravity.set(0, -G, 0);
          break;
        case 'moon':
          this.gravity.set(0, -1.62, 0);
          break;
        case 'sideways':
          this.gravity.set(G * this.sidewaysSign, -1.5, 0);
          break;
        case 'upside-down':
          this.gravity.set(0, G, 0);
          break;
        case 'emotional': {
          const t = this.t;
          this.gravity
            .set(Math.sin(t * 0.9) * 0.9, -1 + Math.sin(t * 0.37) * 1.35, Math.cos(t * 0.61) * 0.5)
            .normalize()
            .multiplyScalar(G * (0.7 + Math.sin(t * 1.7) * 0.3));
          if (Math.random() < 0.01) this.wakeAll();
          break;
        }
      }
    }
    const pg = this.physics.gravity;
    if (pg.x !== this.gravity.x || pg.y !== this.gravity.y || pg.z !== this.gravity.z) {
      this.physics.gravity = { x: this.gravity.x, y: this.gravity.y, z: this.gravity.z };
    }
  }

  private tmpQ = new THREE.Quaternion();
  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();
  private tmpC = new THREE.Vector3();

  private behave(h: number) {
    const desiredUp = this.tmpC.copy(this.gravity).normalize().negate();
    const camPos = this.camera.position;
    for (const e of this.ents.values()) {
      if (e === this.grabbed) {
        const p = e.body.translation();
        const r = e.body.rotation();
        const anchor = this.tmpA.copy(this.grabLocal).applyQuaternion(this.tmpQ.set(r.x, r.y, r.z, r.w)).add(p as THREE.Vector3Like);
        const v = this.tmpB.copy(this.grabTarget).sub(anchor).multiplyScalar(14);
        if (v.length() > 45) v.setLength(45);
        e.body.setLinvel(v, true);
        const w = e.body.angvel();
        e.body.setAngvel({ x: w.x * 0.9, y: w.y * 0.9, z: w.z * 0.9 }, true);
        continue;
      }
      if (e.life !== undefined) {
        e.life -= h;
        if (e.life <= 0) {
          this.remove(e);
          continue;
        }
      }
      if (!e.creature || e.body.isSleeping()) continue;
      const lv = e.body.linvel();
      const speed = Math.hypot(lv.x, lv.y, lv.z);
      if (speed > 3.5) continue;

      const r = e.body.rotation();
      this.tmpQ.set(r.x, r.y, r.z, r.w);
      const up = this.tmpA.set(0, 1, 0).applyQuaternion(this.tmpQ);
      const fwd = this.tmpB.set(0, 0, 1).applyQuaternion(this.tmpQ);
      const p = e.body.translation();

      // stand up (relative to whatever gravity currently believes in)
      const corr = new THREE.Vector3().crossVectors(up, desiredUp);
      if (up.dot(desiredUp) < -0.6) corr.add(fwd.clone().cross(desiredUp).multiplyScalar(0.5)).addScalar(0.3);

      // turn to face the target (you), or turn away if we're being nonchalant
      const target = this.lookTarget ?? camPos;
      const toT = new THREE.Vector3(target.x - p.x, target.y - p.y, target.z - p.z);
      if (this.nonchalant && !this.lookTarget) toT.negate();
      toT.addScaledVector(desiredUp, -toT.dot(desiredUp)).normalize();
      const f2 = fwd.clone().addScaledVector(desiredUp, -fwd.dot(desiredUp)).normalize();
      const yaw = new THREE.Vector3().crossVectors(f2, toT).dot(desiredUp);
      const backwards = f2.dot(toT) < -0.2 ? 1.5 : 0;

      const k = e.kind === 'capybara' ? 10 : e.kind === 'sloth' ? 2.5 : 7;
      const target_w = corr.multiplyScalar(k).addScaledVector(desiredUp, (yaw + backwards) * (this.nonchalant ? 1.2 : 3.5));
      const w = e.body.angvel();
      const blend = this.nonchalant ? 0.05 : 0.14;
      const nx = w.x + (target_w.x - w.x) * blend;
      const ny = w.y + (target_w.y - w.y) * blend;
      const nz = w.z + (target_w.z - w.z) * blend;
      if (Math.abs(nx) + Math.abs(ny) + Math.abs(nz) > 0.03 || corr.lengthSq() > 0.001) e.body.setAngvel({ x: nx, y: ny, z: nz }, true);

      // random frog hops
      if (this.autoHop && e.kind === 'frog' && this.t > e.nextHop && speed < 0.8) {
        e.nextHop = this.t + rand(2.5, 7) * (this.nonchalant ? 3 : 1);
        this.jump(e);
        if (this.sound.allow(10)) this.sound.croak(rand(0.8, 1.4));
        if (Math.random() < 0.3) this.caption(pick(CAPTIONS.frog), 'frog');
      }
    }
  }

  private drainEvents() {
    this.events.drainContactForceEvents((ev) => {
      const a = this.byCollider.get(ev.collider1());
      const b = this.byCollider.get(ev.collider2());
      const force = ev.totalForceMagnitude();
      for (const e of [a, b]) {
        if (!e) continue;
        if (e.kind === 'tweet') {
          const other = e === a ? b : a;
          if (this.t - this.lastLike > 0.35 && other) {
            this.lastLike = this.t;
            this.likes++;
            this.tweet.draw(this.likes);
            this.bus.emit('likes', { count: this.likes });
          }
          continue;
        }
        const strength = Math.min(1, force / (e.body.mass() * 700));
        if (this.t - e.lastSound < 0.15) continue;
        e.lastSound = this.t;
        this.playHitSound(e, 0.35 + strength * 0.65);
        if (strength > 0.4 && Math.random() < 0.35) {
          const lines = CAPTIONS[e.kind];
          if (lines) this.caption(pick(lines), e.kind, 6);
        }
      }
    });
  }

  private playHitSound(e: Ent, s: number) {
    const snd = this.sound;
    if (!snd.allow(14)) return;
    switch (e.kind) {
      case 'frog':
        snd.croak(rand(0.9, 1.6) * (e.size < 1.4 ? 1.2 : 1), snd.now, 0.35 * s);
        break;
      case 'toucan':
        snd.squawk(snd.now, 0.28 * s);
        break;
      case 'capybara':
        snd.thud(s * 1.2);
        break;
      case 'sloth':
        snd.thud(s * 0.6);
        break;
      case 'monkey':
        if (Math.random() < 0.4) snd.howl(snd.now, 0.2 * s);
        else snd.thud(s * 0.6);
        break;
      case 'letter':
        snd.knock(s);
        break;
      case 'molecule':
        snd.ping(snd.now, 0.22 * s);
        break;
      case 'cookie':
        snd.squish(snd.now, 0.35 * s);
        break;
      case 'banana':
        snd.boing(snd.now, 0.18 * s);
        break;
      case 'leaf':
        break;
      case 'drop':
        snd.plink(snd.now, 0.06 * s);
        break;
      default:
        snd.knock(s * 0.5);
    }
  }

  private spawnDrop() {
    const x = rand(-this.wallX, this.wallX);
    const z = rand(-10, 6);
    const up = this.gravity.clone().normalize().negate().multiplyScalar(18);
    const body = this.physics.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x + up.x, Math.max(2, up.y) + rand(0, 4), z + up.z)
        .setLinvel(this.gravity.x, this.gravity.y * 1.5 - 4, this.gravity.z),
    );
    const col = this.physics.createCollider(
      RAPIER.ColliderDesc.ball(0.1).setDensity(0.5).setRestitution(0.1).setActiveEvents(RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS),
      body,
    );
    col.setContactForceEventThreshold(0.5);
    const mesh = new THREE.Mesh(this.dropGeo, this.dropMat);
    this.ents.set(body.handle, { kind: 'drop', body, obj: mesh, born: this.t, size: 0.2, creature: false, nextHop: 0, lastSound: 0, life: 2.5 });
    this.byCollider.set(col.handle, this.ents.get(body.handle)!);
    this.scene.add(mesh);
  }

  private dropAcc = 0;
  private acc = 0;

  update(dt: number) {
    this.t += dt;
    this.updateGravity();

    // physics raindrops that actually hit things
    this.dropAcc += dt * this.rainLevel * 7;
    while (this.dropAcc > 1) {
      this.dropAcc -= 1;
      this.spawnDrop();
    }

    // fixed physics steps; slow-mo shrinks the step instead of skipping frames
    this.acc = Math.min(this.acc + dt, FIXED * 4);
    while (this.acc >= FIXED) {
      this.acc -= FIXED;
      this.physics.timestep = FIXED * this.timeScale;
      this.behave(this.physics.timestep);
      this.physics.step(this.events);
      this.drainEvents();
    }

    // sync + cleanup
    let ke = 0;
    let n = 0;
    for (const e of this.ents.values()) {
      const p = e.body.translation();
      const r = e.body.rotation();
      e.obj.position.set(p.x, p.y, p.z);
      e.obj.quaternion.set(r.x, r.y, r.z, r.w);
      if (p.y < -30 || p.y > 60 || Math.abs(p.x) > 60 || Math.abs(p.z) > 60) {
        if (e.kind !== 'drop') this.caption(`[a ${e.kind === 'letter' ? 'letter' : e.kind} has left the chat]`, 'void', 5);
        this.remove(e);
        continue;
      }
      if (e.kind === 'drop' || e.kind === 'tweet') continue;
      const v = e.body.linvel();
      ke += 0.5 * Math.min(e.body.mass(), 20) * (v.x * v.x + v.y * v.y + v.z * v.z);
      n++;
      if (e.kind === 'letter' && !e.fallen && this.t - e.born > 3) {
        const up = this.tmpA.set(0, 1, 0).applyQuaternion(e.obj.quaternion);
        if (up.y < 0.35 && this.gravityMode === 'normal') {
          e.fallen = true;
          this.caption(`[the letter ${e.char} has fallen and would like help]`, 'fallen', 9);
        }
      }
    }

    this.updateFx(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);

    // dopamine (it's just kinetic energy with a marketing budget)
    if (this.t - this.lastDop > 0.1) {
      this.lastDop = this.t;
      if (this.dopHold > 0) this.dopHold -= 0.1;
      else this.dopSuppress = Math.min(1, this.dopSuppress + 0.1 / 14);
      this.dopBoost *= 0.97;
      const raw = (25 + Math.sqrt(ke) * 9 + n * 1.1 + this.dopBoost) * this.dopSuppress;
      this.dopamine += (Math.min(999, raw) - this.dopamine) * (this.dopHold > 0 ? 0.5 : 0.18);
      this.bus.emit('dopamine', { value: Math.max(0, this.dopamine) });
    }

    this.frames++;
    if (this.t - this.lastStats > 0.5) {
      this.fps = Math.round(this.frames / (this.t - this.lastStats));
      this.frames = 0;
      this.lastStats = this.t;
      let bodies = 0;
      for (const e of this.ents.values()) if (e.kind !== 'drop') bodies++;
      this.bus.emit('stats', { bodies, fps: this.fps });
    }

    if (this.t - this.lastInteraction > 18 && this.t - this.lastCaption > 12) {
      this.caption(pick(CAPTIONS.idle), 'idle', 10);
    }
  }

  private updateFx(dt: number) {
    // rain falls along gravity, obviously
    const dir = this.tmpA.copy(this.gravity).normalize();
    const speed = 26 * dt;
    const P = this.rainPos;
    for (let i = 0; i < P.length; i += 6) {
      let x = P[i] + dir.x * speed;
      let y = P[i + 1] + dir.y * speed;
      let z = P[i + 2] + dir.z * speed;
      if (y < -1 || y > 27 || x < -23 || x > 23) {
        x = dir.x > 0.3 ? -22 : dir.x < -0.3 ? 22 : rand(-22, 22);
        y = dir.y > 0.3 ? -1 : dir.y < -0.3 ? 26 : rand(0, 26);
        z = rand(-14, 12);
      }
      P[i] = x;
      P[i + 1] = y;
      P[i + 2] = z;
      P[i + 3] = x - dir.x * 0.7;
      P[i + 4] = y - dir.y * 0.7;
      P[i + 5] = z - dir.z * 0.7;
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
    const rm = this.rain.material as THREE.LineBasicMaterial;
    rm.opacity += (this.rainLevel * 0.45 - rm.opacity) * 0.05;

    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.hemi.intensity = 1.5 + this.flash * 9 * (Math.random() * 0.5 + 0.5);
    this.sun.intensity = 2.4 + this.flash * 4;
  }

  private updateCamera(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const s = this.shake * this.shake;
    const cam = this.camera;
    const tx = this.camBase.x + this.pointer.x * 1.2 + Math.sin(this.t * 0.25) * 0.5;
    const ty = this.camBase.y + this.pointer.y * 0.6 + Math.sin(this.t * 0.33) * 0.25;
    cam.position.x += (tx - cam.position.x) * 0.04;
    cam.position.y += (ty - cam.position.y) * 0.04;
    cam.position.z += (this.camBase.z - cam.position.z) * 0.06;
    this.viewOff.lerp(this.viewOffTarget, 0.08);
    cam.setViewOffset(innerWidth, innerHeight, this.viewOff.x, this.viewOff.y, innerWidth, innerHeight);
    cam.position.x += rand(-1, 1) * s * 0.8;
    cam.position.y += rand(-1, 1) * s * 0.8;
    cam.lookAt(this.camTarget);
    cam.rotation.z += rand(-1, 1) * s * 0.05;
  }

  setInsets(i: { top: number; right: number; bottom: number; left: number }) {
    this.insets = i;
    this.resize(false);
  }

  resize(snap = true) {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.setSize(w, h, false);
    const { top, right, bottom, left } = this.insets;
    // frame the scene inside the part of the screen the UI isn't covering
    const fw = Math.max(200, w - left - right);
    const fh = Math.max(200, h - top - bottom);
    const portrait = fw / fh < 0.9;
    this.camera.aspect = w / h;
    this.camera.fov = portrait ? 60 : 50;
    this.viewOffTarget.set(-(left - right) / 2, -(top - bottom) / 2);
    const tanH = (Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * fw) / h;
    // pull the camera back on narrow screens so the frogs remain in frame (legal requirement)
    const dist = THREE.MathUtils.clamp((portrait ? 8.5 : 12.5) / tanH, 16, 40);
    if (portrait) {
      // phones get a steeper, bird's-eye view so the jungle floor fills the screen
      this.camBase.set(0, 5 + dist * 0.45, dist * 0.85);
      this.camTarget.set(0, 1.5, -2.5);
    } else {
      this.camBase.set(0, 7.5 + (dist - 17) * 0.35, dist - 1);
      this.camTarget.set(0, 2.6, -1.5);
    }
    if (snap) {
      this.camera.position.copy(this.camBase);
      this.viewOff.copy(this.viewOffTarget);
    }
    this.camera.setViewOffset(w, h, this.viewOff.x, this.viewOff.y, w, h);
    this.camera.updateProjectionMatrix();
    // visible half-width around z≈0, used for spawning and for where the invisible walls go
    const visHalf = tanH * (dist + 1);
    this.spawnHalfW = THREE.MathUtils.clamp(visHalf * 0.8, 4.5, 13);
    this.wallX = THREE.MathUtils.clamp(visHalf + 1, 8, 17);
    this.placeWalls();
  }

  private placeWalls() {
    this.wallL?.setTranslation({ x: -this.wallX - 1, y: 15, z: 0 }, true);
    this.wallR?.setTranslation({ x: this.wallX + 1, y: 15, z: 0 }, true);
  }

}
