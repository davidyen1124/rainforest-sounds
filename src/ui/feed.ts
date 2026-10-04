import { el, icon, pick } from './dom';

const LIKERS = [
  'a frog',
  'a toucan',
  'one (1) capybara',
  'your mom',
  'a leaf',
  'Gary (support sloth)',
  'a wet cookie',
  'a howler monkey (professionally)',
  'the rain',
  'the 3D letter S',
  'a dopamine molecule',
  'a frog (alt account)',
  'someone named “Jungle Dave”',
];

/** TV-style closed captions + X-style toasts. */
export class Feed {
  private captions = el('<div class="captions" aria-live="polite"></div>');
  private toasts = el('<div class="toasts" aria-live="polite"></div>');

  constructor(root: HTMLElement) {
    root.append(this.captions, this.toasts);
  }

  caption(text: string) {
    const c = el('<div class="cc"></div>');
    c.textContent = text;
    this.captions.append(c);
    while (this.captions.children.length > 3) this.captions.firstElementChild!.remove();
    setTimeout(() => c.classList.add('cc--out'), 4200);
    setTimeout(() => c.remove(), 4700);
  }

  toast(html: string, cls = '', ms = 3400) {
    const t = el(`<div class="toast ${cls}">${html}</div>`);
    this.toasts.prepend(t);
    while (this.toasts.children.length > 3) this.toasts.lastElementChild!.remove();
    setTimeout(() => t.classList.add('toast--out'), ms);
    setTimeout(() => t.remove(), ms + 450);
  }

  like(count: number) {
    this.toast(
      `<span class="toast-heart">${icon('heart', 18)}</span><span><b>${pick(LIKERS)}</b> liked your post<br><span class="toast-sub">“this playlist reset my dopamine” · ${count} likes</span></span>`,
      'toast--x',
    );
  }
}
