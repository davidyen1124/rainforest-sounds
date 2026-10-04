import type { Bus, GravityMode, SpawnKind } from '../bus';
import { $, el, sleep, sticker } from './dom';

const LEVELS: [number, string][] = [
  [0, 'factory settings'],
  [60, 'baseline'],
  [150, 'mildly stimulated'],
  [260, '3 energy drinks'],
  [420, 'influencer'],
  [620, 'group chat at 2am'],
  [820, 'CRITICAL: touch grass (wet)'],
];

const RESET_STEPS = [
  'resetting…',
  'flushing TikTok…',
  'unsubscribing from 1,204 newsletters…',
  'installing frogs…',
  'calibrating wetness…',
  'done. you are now calm.',
];

// value -> 0..1 gauge position (sqrt so the interesting middle gets room)
const gauge = (v: number) => Math.sqrt(Math.min(999, Math.max(0, v)) / 999);

export class Meter {
  private node: HTMLElement;
  private busy = false;

  constructor(root: HTMLElement, bus: Bus) {
    this.node = el(`
      <section class="meter glass" aria-label="Dopamine meter">
        <div class="m-head">
          <span class="m-k">Dopamine</span>
          <span class="m-v mono">0%</span>
        </div>
        <div class="m-status">factory settings</div>
        <div class="m-tube">
          <div class="m-fill"><div class="m-bubbles"></div></div>
          ${LEVELS.slice(1)
            .map(([v, label]) => `<div class="m-tick" style="--p:${gauge(v)}"><span>${label}</span></div>`)
            .join('')}
        </div>
        <button class="m-reset" data-nc="eh">Reset my dopamine</button>
        <div class="m-log mono" aria-live="polite"></div>
      </section>`);
    root.append(this.node);

    const btn = $<HTMLButtonElement>(this.node, '.m-reset');
    btn.onclick = async () => {
      if (this.busy) return;
      this.busy = true;
      btn.disabled = true;
      bus.emit('dopamine:reset');
      const log = $(this.node, '.m-log');
      for (const s of RESET_STEPS) {
        log.textContent = s;
        await sleep(620);
      }
      await sleep(1500);
      log.textContent = '';
      btn.disabled = false;
      this.busy = false;
    };

    bus.on('dopamine', ({ value }) => this.set(value));
  }

  private set(v: number) {
    const n = this.node;
    n.style.setProperty('--lvl', gauge(v).toFixed(3));
    $(n, '.m-v').textContent = `${Math.round(v)}%`;
    let idx = 0;
    LEVELS.forEach(([t], i) => {
      if (v >= t) idx = i;
    });
    n.dataset.level = String(idx);
    $(n, '.m-status').textContent = LEVELS[idx][1];
  }
}

const SPAWNS: { kind: SpawnKind; count: number; label: string; nc: string; img: [string, string] | null }[] = [
  { kind: 'frog', count: 1, label: 'add frog (why)', nc: 'frog i guess', img: ['frog', '🐸'] },
  { kind: 'frog', count: 12, label: 'frog rain', nc: 'frogs. whatever', img: ['frog', '🐸'] },
  { kind: 'toucan', count: 8, label: 'toucan airstrike', nc: 'birds or w/e', img: ['toucan', '🦜'] },
  { kind: 'capybara', count: 1, label: 'deploy 1 capybara (calm)', nc: 'capybara', img: ['capybara', '🦫'] },
  { kind: 'sloth', count: 1, label: 'sloth (eventually)', nc: 'sloth', img: ['sloth', '🦥'] },
  { kind: 'monkey', count: 1, label: 'hire monkey', nc: 'monkey. sure', img: ['monkey', '🐒'] },
  { kind: 'molecule', count: 1, label: 'raw dopamine (3D)', nc: 'chemicals', img: null },
  { kind: 'banana', count: 5, label: 'bananas', nc: 'fruit', img: ['banana', '🍌'] },
  { kind: 'cookie', count: 3, label: 'wet cookies', nc: 'cookies', img: ['cookie', '🍪'] },
  { kind: 'leaf', count: 8, label: 'leaves', nc: 'leaves', img: ['leaf', '🍃'] },
];

const GRAVITY: [GravityMode, string][] = [
  ['normal', 'normal'],
  ['moon', 'moon'],
  ['sideways', 'sideways (why)'],
  ['upside-down', 'upside down'],
  ['emotional', 'emotional'],
];

const MOLECULE_SVG = `<span class="stk stk--svg"><svg viewBox="0 0 40 40" aria-hidden="true"><g stroke="#ddd" stroke-width="2.2"><path d="M20 9 29 14v10l-9 5-9-5V14z" fill="none"/><path d="M20 9V3M29 24l6 3.5M11 24l-6 3.5"/></g><g><circle cx="20" cy="9" r="3.4" fill="#444"/><circle cx="29" cy="14" r="3.4" fill="#444"/><circle cx="29" cy="24" r="3.4" fill="#444"/><circle cx="20" cy="29" r="3.4" fill="#444"/><circle cx="11" cy="24" r="3.4" fill="#444"/><circle cx="11" cy="14" r="3.4" fill="#444"/><circle cx="20" cy="3" r="3" fill="#3b6bff"/><circle cx="35" cy="27.5" r="3" fill="#ff3b3b"/><circle cx="5" cy="27.5" r="3" fill="#ff3b3b"/></g></svg></span>`;

export class Chaos {
  node: HTMLElement;

  constructor(root: HTMLElement, bus: Bus, onNonchalant: (on: boolean) => void) {
    this.node = el(`
      <nav class="chaos glass" aria-label="Chaos controls">
        <div class="chaos-scroll">
          ${SPAWNS.map(
            (s, i) => `
            <button class="spawn" data-i="${i}">
              ${s.img ? sticker(s.img[0], s.img[1]) : MOLECULE_SVG}
              <span data-nc="${s.nc}">${s.label}</span>
              ${s.count > 1 ? `<b class="spawn-x mono">×${s.count}</b>` : ''}
            </button>`,
          ).join('')}
          <div class="chaos-sep"></div>
          <div class="grav" role="radiogroup" aria-label="Gravity">
            <span class="grav-k" data-nc="gravity idk">gravity</span>
            ${GRAVITY.map(([m, l]) => `<button class="grav-b${m === 'normal' ? ' on' : ''}" data-m="${m}" role="radio" aria-checked="${m === 'normal'}">${l}</button>`).join('')}
          </div>
          <div class="chaos-sep"></div>
          <label class="nc-toggle">
            <input type="checkbox">
            <span class="sw" aria-hidden="true"></span>
            <span data-nc="whatever">act nonchalant</span>
          </label>
        </div>
      </nav>`);
    root.append(this.node);

    this.node.querySelectorAll<HTMLElement>('.spawn').forEach((b) => {
      b.onclick = () => {
        const s = SPAWNS[+b.dataset.i!];
        bus.emit('spawn', { kind: s.kind, count: s.count });
        b.classList.remove('pop');
        void b.offsetWidth;
        b.classList.add('pop');
      };
    });
    this.node.querySelectorAll<HTMLElement>('.grav-b').forEach((b) => {
      b.onclick = () => {
        this.node.querySelectorAll('.grav-b').forEach((x) => {
          x.classList.toggle('on', x === b);
          x.setAttribute('aria-checked', String(x === b));
        });
        bus.emit('gravity', { mode: b.dataset.m as GravityMode });
      };
    });
    const nc = $<HTMLInputElement>(this.node, '.nc-toggle input');
    nc.onchange = () => {
      bus.emit('nonchalant', { on: nc.checked });
      onNonchalant(nc.checked);
    };
  }

  setNonchalant(on: boolean) {
    const nc = $<HTMLInputElement>(this.node, '.nc-toggle input');
    if (nc.checked !== on) {
      nc.checked = on;
      nc.dispatchEvent(new Event('change'));
    }
  }
}
