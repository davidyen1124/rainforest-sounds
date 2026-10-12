import type { Bus, TrackId } from '../bus';
import { asset } from '../asset';
import { TRACKS, trackById } from '../tracks';
import { $, el, fmtTime, icon, pick, sticker } from './dom';
import type { Feed } from './feed';

const LYRICS: Record<TrackId, string> = {
  'gentle-rain': '♪ drip ♪ drip ♪ (drip) ♪',
  'frog-choir': '♪ ribbit ribbit ♪ ribbit (key change) ♪ RIBBIT ♪',
  'toucan-airstrike': '♪ AAAAAAAAAAA ♪ (beak solo) ♪',
  'sloth-asmr': '♪ h ♪',
  'monkey-meeting': '♪ per my last screech ♪',
  thunder: "♪ BOOM ♪ (it's about you) ♪",
  'leaf-4h': '♪ ♪',
  'dopamine-reset': '♪ [7 seconds of pure personal growth] ♪',
};

const wetWord = (v: number) => (v === 0 ? 'bone dry' : v < 30 ? 'damp' : v < 60 ? 'moist' : v < 90 ? 'wet' : 'SOAKED');

export class Music {
  current: TrackId = 'gentle-rain';
  playing = false;
  private elapsed = 0;
  private shuffle = false;
  private repeat = 0;
  private liked = false;
  private muted = false;
  private player: HTMLElement;
  private panel: HTMLElement;
  private bus: Bus;
  private feed: Feed;
  onPanel: (() => void) | null = null;

  constructor(root: HTMLElement, bus: Bus, feed: Feed) {
    this.bus = bus;
    this.feed = feed;
    this.player = el(`
      <footer class="player glass">
        <div class="np">
          <img class="np-cover" src="${asset('cover.webp')}" alt="">
          <div class="np-meta">
            <div class="np-title"><span></span></div>
            <div class="np-artist"></div>
          </div>
          <button class="ib np-like" aria-label="Save to Liked Frogs">${icon('heart', 18)}</button>
        </div>
        <div class="ctrl">
          <div class="ctrl-btns">
            <button class="ib c-shuf" aria-label="Shuffle">${icon('shuffle', 18)}</button>
            <button class="ib c-prev" aria-label="Previous">${icon('prev', 22)}</button>
            <button class="play-btn c-play" aria-label="Play">${icon('play', 22)}</button>
            <button class="ib c-next" aria-label="Next">${icon('next', 22)}</button>
            <button class="ib c-rep" aria-label="Repeat">${icon('repeat', 18)}</button>
          </div>
          <div class="prog">
            <span class="t-el mono">0:00</span>
            <div class="bar" role="slider" aria-label="Progress (decorative, like most things)"><div class="fill"></div></div>
            <span class="t-du mono">0:00</span>
          </div>
        </div>
        <div class="extra">
          <button class="ib x-lyr" aria-label="Lyrics">${icon('mic', 18)}</button>
          <button class="ib x-queue" aria-label="Playlist">${icon('list', 18)}</button>
          <button class="ib x-mute" aria-label="Mute">${icon('volume', 18)}</button>
          <label class="wet"><span class="wet-k">Wetness</span><input type="range" min="0" max="100" value="80" aria-label="Wetness (volume)"><span class="wet-v mono">wet</span></label>
        </div>
      </footer>`);

    this.panel = el(`
      <aside class="playlist glass" aria-label="Playlist">
        ${sticker('frog', '🐸', 'pl-peek')}
        <button class="ib pl-close" aria-label="Close playlist">${icon('close', 18)}</button>
        <div class="pl-head">
          <img class="pl-cover" src="${asset('cover.webp')}" alt="Rainforest Sounds cover">
          <div class="pl-info">
            <div class="pl-kicker">Public Playlist</div>
            <h2 class="pl-title">Rainforest Sounds</h2>
            <div class="pl-desc">Recordings from the tropical rainforest</div>
          </div>
        </div>
        <div class="pl-meta"><b>🐸 made for you (by a frog)</b> · 8 songs, 4 hr 27 min <i>(mostly the leaf)</i></div>
        <div class="pl-actions">
          <button class="play-btn play-btn--big pl-play" aria-label="Play">${icon('play', 24)}</button>
          <button class="pill pl-follow">Follow</button>
          <button class="ib pl-dots" aria-label="More">${icon('dots', 22)}</button>
        </div>
        <ol class="pl-rows">
          ${TRACKS.map(
            (t, i) => `
            <li class="row" data-id="${t.id}" tabindex="0">
              <span class="row-n"><span class="num">${i + 1}</span><span class="eq"><i></i><i></i><i></i></span></span>
              <span class="row-main"><span class="row-t">${t.title}</span><span class="row-a">${t.artist}</span></span>
              <span class="row-d mono">${fmtTime(t.duration)}</span>
            </li>`,
          ).join('')}
        </ol>
        <div class="pl-about"><div class="pl-about-k">About this track</div><p></p></div>
      </aside>`);

    root.append(this.panel, this.player);
    if (innerWidth > 1100) this.setPanel(true);
    this.bind();
    this.render();
  }

  private bind() {
    const p = this.player;
    $(p, '.c-play').onclick = () => this.toggle();
    $(p, '.c-next').onclick = () => this.next();
    $(p, '.c-prev').onclick = () => this.prev();
    $(p, '.c-shuf').onclick = (e) => {
      this.shuffle = !this.shuffle;
      const b = e.currentTarget as HTMLElement;
      b.classList.toggle('on', this.shuffle);
      b.classList.remove('boing');
      void b.offsetWidth;
      if (this.shuffle) b.classList.add('boing');
      this.feed.toast(this.shuffle ? '🎉 <b>SHUFFLE IS ON!!!!!</b> 🎉🎉 best day ever' : 'shuffle is off. shuffle is fine. shuffle is totally fine.');
    };
    $(p, '.c-rep').onclick = (e) => {
      this.repeat = (this.repeat + 1) % 3;
      (e.currentTarget as HTMLElement).classList.toggle('on', this.repeat > 0);
      (e.currentTarget as HTMLElement).dataset.rep = ['', '1', '∞'][this.repeat];
      this.feed.toast(['repeat: off', 'repeat: one track', "repeat: emotionally. we're going through this again."][this.repeat]);
    };
    $(p, '.np-like').onclick = (e) => {
      this.liked = !this.liked;
      (e.currentTarget as HTMLElement).classList.toggle('on', this.liked);
      this.feed.toast(this.liked ? `${icon('heart', 16)} Added to <b>Liked Frogs</b>` : 'Removed from Liked Frogs. the frog is hurt.');
    };
    $(p, '.bar').onclick = () => this.feed.toast('seeking is not supported in nature. please wait like a tree.');
    $(p, '.x-lyr').onclick = () => this.feed.toast(`<span class="mono">${LYRICS[this.current]}</span>`, '', 4200);
    $(p, '.x-queue').onclick = () => this.setPanel(!this.panel.classList.contains('open'));
    $(p, '.x-mute').onclick = (e) => {
      this.muted = !this.muted;
      (e.currentTarget as HTMLElement).innerHTML = icon(this.muted ? 'mute' : 'volume', 18);
      this.bus.emit('mute', { muted: this.muted });
      if (this.muted) this.feed.toast('muted. the frogs are still croaking, you just can’t hear it.');
    };
    const range = $<HTMLInputElement>(p, '.wet input');
    range.oninput = () => {
      const v = +range.value;
      $(p, '.wet-v').textContent = wetWord(v);
      this.bus.emit('volume', { value: v / 100 });
    };

    const pn = this.panel;
    $(pn, '.pl-close').onclick = () => this.setPanel(false);
    $(pn, '.pl-play').onclick = () => this.toggle();
    $(pn, '.pl-follow').onclick = (e) => {
      const b = e.currentTarget as HTMLElement;
      const on = b.classList.toggle('on');
      b.textContent = on ? 'Following' : 'Follow';
      this.feed.toast(on ? 'you followed Rainforest Sounds. the frogs now know where you live.' : 'unfollowed. the rainforest will remember this.');
    };
    $(pn, '.pl-dots').onclick = () =>
      this.feed.toast(pick(['Add to queue (there is no queue)', 'Share (with a frog)', 'Report playlist: too wet', 'Download (the rainforest is too big)']));
    pn.querySelectorAll<HTMLElement>('.row').forEach((row) => {
      const go = () => {
        const id = row.dataset.id as TrackId;
        if (id === this.current && this.playing) this.pause();
        else this.play(id);
      };
      row.onclick = go;
      row.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      };
    });

    this.bus.on('track:progress', ({ id, elapsed, duration }) => {
      if (id !== this.current) return;
      this.elapsed = elapsed;
      $(this.player, '.t-el').textContent = fmtTime(elapsed);
      $(this.player, '.t-du').textContent = fmtTime(duration);
      this.player.style.setProperty('--prog', String(Math.min(1, elapsed / duration)));
    });
    this.bus.on('track:ended', ({ id }) => {
      if (id !== this.current) return;
      if (this.repeat > 0) this.play(id);
      else this.next();
    });
  }

  setPanel(open: boolean) {
    this.panel.classList.toggle('open', open);
    document.getElementById('ui')!.classList.toggle('pl-open', open);
    $(this.player, '.x-queue').classList.toggle('on', open);
    this.onPanel?.();
  }

  play(id: TrackId) {
    if (id !== this.current) this.elapsed = 0;
    this.current = id;
    this.playing = true;
    this.bus.emit('track:play', { id });
    this.render();
  }

  pause() {
    this.playing = false;
    this.bus.emit('track:pause');
    this.render();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play(this.current);
  }

  next() {
    const i = TRACKS.findIndex((t) => t.id === this.current);
    let n = (i + 1) % TRACKS.length;
    if (this.shuffle) {
      do n = Math.floor(Math.random() * TRACKS.length);
      while (n === i);
    }
    this.play(TRACKS[n].id);
  }

  prev() {
    if (this.elapsed > 3) return this.play(this.current);
    const i = TRACKS.findIndex((t) => t.id === this.current);
    this.play(TRACKS[(i - 1 + TRACKS.length) % TRACKS.length].id);
  }

  private render() {
    const t = trackById(this.current);
    const p = this.player;
    const title = $(p, '.np-title span');
    title.textContent = t.title;
    $(p, '.np-title').classList.toggle('marquee', t.title.length > 26);
    $(p, '.np-artist').textContent = t.artist;
    $(p, '.t-du').textContent = fmtTime(t.duration);
    if (this.elapsed === 0) {
      $(p, '.t-el').textContent = '0:00';
      p.style.setProperty('--prog', '0');
    }
    const ico = icon(this.playing ? 'pause' : 'play', 22);
    $(p, '.c-play').innerHTML = ico;
    $(p, '.c-play').setAttribute('aria-label', this.playing ? 'Pause' : 'Play');
    $(this.panel, '.pl-play').innerHTML = icon(this.playing ? 'pause' : 'play', 24);
    this.panel.querySelectorAll<HTMLElement>('.row').forEach((r) => {
      r.classList.toggle('cur', r.dataset.id === this.current);
      r.classList.toggle('playing', r.dataset.id === this.current && this.playing);
    });
    $(this.panel, '.pl-about p').textContent = t.blurb;
    document.title = this.playing ? `${t.title} · ${t.artist} — Rainforest Sounds™` : 'Rainforest Sounds™ — Dopamine Reset Facility';
  }
}
