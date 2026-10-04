import type { Bus } from '../bus';
import { $, el, icon, sticker } from './dom';
import type { Feed } from './feed';

/** Wellness intake form. Also the audio-unlock gesture, legally. */
export function gate(root: HTMLElement, bus: Bus, onEnter: () => void) {
  const g = el(`
    <div class="gate" role="dialog" aria-modal="true" aria-labelledby="gate-title">
      <div class="gate-card">
        ${sticker('frog', '🐸', 'gate-stk gate-stk--frog')}
        ${sticker('toucan', '🦜', 'gate-stk gate-stk--toucan')}
        ${sticker('capybara', '🦫', 'gate-stk gate-stk--capy')}
        ${sticker('sloth', '🦥', 'gate-stk gate-stk--sloth')}
        <div class="gate-form mono"><span>INTAKE FORM #00230</span><span>DEPT. OF WETNESS</span></div>
        <h1 class="gate-title" id="gate-title">Rainforest Sounds<sup>™</sup></h1>
        <div class="gate-sub">Dopamine Reset Facility</div>
        <figure class="gate-quote">
          <div class="gq-top"><span class="gq-av">🐸</span><span class="gq-name">a verified guy <span class="gq-check">${icon('check', 12)}</span></span><span class="gq-x">𝕏</span></div>
          <blockquote>this playlist reset my dopamine</blockquote>
          <figcaption class="mono">2:34 PM · 9/28/26 · <b>230</b> Views · ♡ 5</figcaption>
        </figure>
        <ul class="gate-checks">
          <li><label><input type="checkbox" class="gc-ready" checked> I am ready to be reset</label></li>
          <li><label><input type="checkbox" checked> I understand the frogs are not real <em>(the frogs disagree)</em></label></li>
          <li><label><input type="checkbox" class="gc-family"> I have told my family I am going into the rainforest <em class="gc-note"></em></label></li>
        </ul>
        <button class="gate-go" disabled>loading frogs…</button>
        <p class="gate-fine">Please put on headphones. Or don't. The frogs can't tell.<br>By entering you agree to be perceived by a toucan.</p>
      </div>
    </div>`);
  root.append(g);

  const go = $<HTMLButtonElement>(g, '.gate-go');
  const label = () => ($<HTMLInputElement>(g, '.gc-ready').checked ? 'Enter the rainforest (wetly)' : 'Enter anyway (unready)');
  let ready = false;
  bus.on('ready', () => {
    ready = true;
    go.disabled = false;
    go.textContent = label();
  });
  $<HTMLInputElement>(g, '.gc-ready').onchange = () => ready && (go.textContent = label());
  $<HTMLInputElement>(g, '.gc-family').onchange = (e) => {
    $(g, '.gc-note').textContent = (e.target as HTMLInputElement).checked ? '(they said “ok”)' : '(they would have said “ok”)';
  };
  go.onclick = () => {
    bus.emit('audio:unlock');
    g.classList.add('gate--gone');
    setTimeout(() => g.remove(), 1300);
    onEnter();
  };
}

export function cookieBanner(root: HTMLElement, bus: Bus, feed: Feed) {
  const c = el(`
    <div class="cookie glass" role="dialog" aria-label="Cookie consent">
      ${sticker('cookie', '🍪', 'ck-stk')}
      <div class="ck-body">
        <b class="ck-title">This rainforest uses cookies.</b>
        <p>The cookies are wet. We use them to remember that you were here, and to feel something.</p>
        <div class="ck-prefs" hidden>
          <label><input type="checkbox" checked disabled> Necessary cookies (wet)</label>
          <label><input type="checkbox" checked disabled> Analytics cookies (a frog is watching)</label>
          <label><input type="checkbox" checked disabled> Marketing cookies (toucan-based)</label>
        </div>
        <div class="ck-btns">
          <button class="pill" data-a="accept">Accept</button>
          <button class="pill pill--green" data-a="wet">Accept wetly</button>
          <button class="pill pill--ghost" data-a="reject">Reject (the frogs will know)</button>
        </div>
        <button class="linkish ck-manage">Manage preferences</button>
      </div>
    </div>`);
  root.append(c);
  requestAnimationFrame(() => c.classList.add('in'));
  const close = () => {
    c.classList.remove('in');
    setTimeout(() => c.remove(), 500);
  };
  $(c, '.ck-manage').onclick = () => {
    const p = $(c, '.ck-prefs');
    p.hidden = !p.hidden;
    $(c, '.ck-manage').textContent = p.hidden ? 'Manage preferences' : 'these cannot be managed';
  };
  c.querySelectorAll<HTMLElement>('[data-a]').forEach((b) => {
    b.onclick = () => {
      const a = b.dataset.a;
      if (a === 'accept') {
        bus.emit('spawn', { kind: 'cookie', count: 3 });
        feed.toast('cookies accepted. they are being delivered physically.');
      } else if (a === 'wet') {
        bus.emit('spawn', { kind: 'cookie', count: 12 });
        feed.toast('cookies accepted <b>wetly</b>. brace.');
      } else {
        bus.emit('spawn', { kind: 'frog', count: 15 });
        feed.toast('cookies rejected. <b>the frogs know.</b>');
      }
      close();
    };
  });
}

/** A browser permission prompt, from a frog. Blocking it has consequences. */
export function permissionPrompt(root: HTMLElement, bus: Bus, feed: Feed) {
  let blocks = 0;
  const show = () => {
    const again = ['', ' (again)', ' (please)', ' (we’re begging)'][Math.min(blocks, 3)];
    const p = el(`
      <div class="perm" role="dialog" aria-label="Permission request">
        <div class="perm-head">
          <span class="perm-lock">${icon('lock', 14)}</span>
          <span><b>frog.rainforest</b> wants to</span>
          <button class="ib perm-x" aria-label="Dismiss">${icon('close', 16)}</button>
        </div>
        <ul>
          <li>${icon('pin', 18)} Know your location${again}</li>
          <li>${icon('mic', 18)} Use your microphone</li>
          <li>${icon('eye', 18)} Judge you quietly</li>
        </ul>
        <div class="perm-btns"><button class="perm-block">Block</button><button class="perm-allow">Allow</button></div>
      </div>`);
    root.append(p);
    requestAnimationFrame(() => p.classList.add('in'));
    const close = () => {
      p.classList.remove('in');
      setTimeout(() => p.remove(), 400);
    };
    $(p, '.perm-allow').onclick = () => {
      close();
      bus.emit('spawn', { kind: 'frog', count: 1 });
      feed.toast('frog.rainforest can now see you. <b>hi.</b>');
    };
    const block = () => {
      close();
      blocks++;
      bus.emit('spawn', { kind: 'frog', count: 25 });
      feed.toast(`you blocked a frog. <b>25 frogs</b> have been dispatched.`);
      if (blocks < 4) setTimeout(show, 45000);
    };
    $(p, '.perm-block').onclick = block;
    $(p, '.perm-x').onclick = block;
  };
  show();
}
