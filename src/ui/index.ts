import './ui.css';
import type { Bus } from '../bus';
import { asset } from '../asset';
import { $, el, icon, pick } from './dom';
import { Feed } from './feed';
import { Music } from './music';
import { Chaos, Meter } from './controls';
import { Chat } from './chat';
import { cookieBanner, gate, permissionPrompt } from './popups';

const frogWord = (n: number) => (n < 8 ? 'few' : n < 30 ? 'some' : n < 80 ? 'many' : n < 160 ? 'too many' : 'please stop');

export function mountUI(root: HTMLElement, bus: Bus) {
  const top = el(`
    <header class="top">
      <div class="brand glass">
        <img class="brand-cover" src="${asset('cover.webp')}" alt="">
        <div class="brand-txt">
          <div class="brand-name">Rainforest Sounds<sup>™</sup><span class="brand-check">${icon('check', 11)}</span></div>
          <div class="brand-sub" data-nc="a place, i guess">Dopamine Reset Facility</div>
        </div>
      </div>
      <div class="hud glass mono">
        <span class="hud-views">👁 <b>230</b> views</span>
        <span class="hud-stats">bodies: 0 · fps: 60 · frogs: few</span>
      </div>
      <div class="top-r">
        <button class="badge-cool" data-nc="caring is mid">Caring Is Cool Again™</button>
        <button class="pill top-pl">${icon('list', 16)}<span>Playlist</span></button>
      </div>
    </header>`);
  root.append(top);

  const feed = new Feed(root);
  const music = new Music(root, bus, feed);
  new Meter(root, bus);
  const chaos = new Chaos(root, bus, (on) => setNonchalant(on));
  new Chat(root);
  const hint = el('<div class="hint">drag things · click the floor · apologize to no one</div>');
  root.append(hint);

  // tell the camera which parts of the screen are covered by UI, so it frames the frogs in the rest
  const emitInsets = () => {
    const W = innerWidth;
    const H = innerHeight;
    const mobile = W <= 760;
    const rect = (sel: string) => root.querySelector(sel)?.getBoundingClientRect();
    const meter = rect('.meter');
    const chaosR = rect('.chaos');
    const pl = rect('.playlist.open');
    bus.emit('insets', {
      top: Math.round((mobile ? meter?.bottom : rect('.top')?.bottom) ?? 0),
      left: Math.round(mobile ? 0 : (meter?.right ?? 0)),
      right: Math.round(!mobile && pl ? W - pl.left : 0),
      bottom: Math.round(chaosR ? H - chaosR.top : 0),
    });
  };
  let raf = 0;
  const queueInsets = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(emitInsets);
  };
  music.onPanel = queueInsets;
  addEventListener('resize', queueInsets);
  bus.on('ready', queueInsets);
  document.fonts?.ready.then(queueInsets);

  // vertical mouse wheels scroll the chaos toolbar sideways
  const scroller = $(chaos.node, '.chaos-scroll');
  scroller.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      scroller.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });
  const edges = () => {
    chaos.node.classList.toggle('can-l', scroller.scrollLeft > 4);
    chaos.node.classList.toggle('can-r', scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 4);
  };
  scroller.addEventListener('scroll', edges, { passive: true });
  addEventListener('resize', edges);
  setTimeout(edges, 500);
  new ResizeObserver(edges).observe(scroller);

  $(top, '.top-pl').onclick = () => music.setPanel(!root.querySelector('.playlist')!.classList.contains('open'));
  $(top, '.badge-cool').onclick = () => {
    if (root.classList.contains('is-nc')) {
      chaos.setNonchalant(false);
      feed.toast('caring has been restored. welcome back.');
    } else {
      feed.toast(pick(['caring detected. dopamine +12%.', 'you cared. a frog saw.', 'caring is cool again™. please care responsibly.']));
    }
  };

  function setNonchalant(on: boolean) {
    root.classList.toggle('is-nc', on);
    root.querySelectorAll<HTMLElement>('[data-nc]').forEach((n) => {
      if (on) {
        n.dataset.orig ??= n.textContent ?? '';
        n.textContent = n.dataset.nc!;
      } else if (n.dataset.orig !== undefined) {
        n.textContent = n.dataset.orig;
      }
    });
    feed.toast(on ? 'nonchalant mode. nobody cares. especially the frogs.' : 'caring is cool again™');
  }

  // --- world -> ui
  bus.on('caption', ({ text }) => feed.caption(text));
  bus.on('likes', ({ count }) => feed.like(count));
  bus.on('stats', ({ bodies, fps }) => {
    $(top, '.hud-stats').textContent = `bodies: ${bodies} · fps: ${fps} · frogs: ${frogWord(bodies)}`;
  });

  // views go up. irregularly. like real views.
  let views = 230;
  const tickViews = () => {
    views += Math.random() < 0.08 ? 47 : 1 + Math.floor(Math.random() * 3);
    $(top, '.hud-views b').textContent = views.toLocaleString();
    setTimeout(tickViews, 1200 + Math.random() * 5000);
  };

  // --- the intake form
  gate(root, bus, () => {
    root.classList.add('entered');
    music.play('gentle-rain');
    setTimeout(tickViews, 2000);
    setTimeout(() => hint.classList.add('hint--in'), 1800);
    setTimeout(() => hint.classList.remove('hint--in'), 11000);
    setTimeout(() => cookieBanner(root, bus, feed), 4500);
    setTimeout(() => permissionPrompt(root, bus, feed), 26000);
  });

  // --- keyboard
  addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('input, textarea, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!root.classList.contains('entered')) return;
    const k = e.key.toLowerCase();
    if (k === ' ' && !t.closest('button')) {
      e.preventDefault();
      music.toggle();
    } else if (k === 'f') bus.emit('spawn', { kind: 'frog', count: 1 });
    else if (k === 't') bus.emit('spawn', { kind: 'toucan', count: 8 });
    else if (k === 'c') bus.emit('spawn', { kind: 'capybara', count: 1 });
    else if (k === 'm') bus.emit('spawn', { kind: 'molecule', count: 1 });
    else if (k === 'n') chaos.setNonchalant(!root.classList.contains('is-nc'));
    else if (k === 'arrowright') music.next();
    else if (k === 'arrowleft') music.prev();
  });
}
