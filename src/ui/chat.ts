import { $, el, icon, sleep, sticker } from './dom';

const CANNED = [
  'hey',
  'have you tried being a leaf',
  "i'm going to be honest i was asleep",
  'have you tried turning the rainforest off and on again',
  'ok',
  "i've escalated this to the frogs",
  'sorry i was hanging',
  "that's above my pay grade. i am paid in leaves",
  'can you describe the problem more slowly',
  'hmm',
  "per my last message (i haven't sent one)",
  'i hear you. i am not going to do anything. but i hear you',
  'this chat may be recorded for frog quality purposes',
];

const KEYWORDS: [RegExp, string][] = [
  [/\b(hi|hello|hey|yo|sup)\b/i, 'hey'],
  [/dopamine/i, 'dopamine is not my department'],
  [/frog/i, "we don't talk about the frogs"],
  [/refund|money|cancel/i, 'refunds are processed in 3–5 business years'],
  [/help/i, 'help is a strong word'],
  [/human|agent|manager|person/i, 'i am the manager. i am also a sloth'],
  [/why/i, 'why not'],
  [/love|thank/i, 'that is the nicest thing anyone has said to me this decade'],
  [/fast|slow|hurry|quick/i, 'i am going as fast as i can. this is it. this is the speed'],
];

/** Gary. Support Sloth. Types one character at a time, like a professional. */
export class Chat {
  private node: HTMLElement;
  private log: HTMLElement;
  private queue: Promise<void> = Promise.resolve();
  private greeted = false;
  private pool = [...CANNED];
  private idleTimer = 0;

  constructor(root: HTMLElement) {
    this.node = el(`
      <div class="chat">
        <button class="chat-bubble" aria-label="Open support chat">
          ${sticker('sloth', '🦥', 'chat-av')}
          <span class="chat-badge">1</span>
          <span class="chat-bubble-t">support</span>
        </button>
        <section class="chat-panel glass" aria-label="Support chat" hidden>
          <header class="chat-head">
            ${sticker('sloth', '🦥', 'chat-av chat-av--lg')}
            <div class="chat-who"><b>Gary</b><span>Support Sloth · usually replies in 3–5 business years</span></div>
            <button class="ib chat-x" aria-label="Close chat">${icon('close', 18)}</button>
          </header>
          <div class="chat-log" aria-live="polite"></div>
          <form class="chat-form">
            <input type="text" placeholder="describe your problem (slowly)" maxlength="200" aria-label="Message Gary">
            <button class="ib chat-send" aria-label="Send">${icon('send', 18)}</button>
          </form>
        </section>
      </div>`);
    root.append(this.node);
    this.log = $(this.node, '.chat-log');

    $(this.node, '.chat-bubble').onclick = () => this.setOpen(true);
    $(this.node, '.chat-x').onclick = () => this.setOpen(false);
    $<HTMLFormElement>(this.node, '.chat-form').onsubmit = (e) => {
      e.preventDefault();
      const input = $<HTMLInputElement>(this.node, '.chat-form input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      this.add('me', text);
      this.reply(this.pickReply(text));
    };
  }

  private setOpen(open: boolean) {
    $(this.node, '.chat-panel').hidden = !open;
    this.node.classList.toggle('open', open);
    $(this.node, '.chat-badge').hidden = true;
    if (open && !this.greeted) {
      this.greeted = true;
      this.reply('hi', 6000, 2500);
      this.reply('welcome to rainforest sounds support. how can i help you today', 2500, 3000);
    }
    if (open) setTimeout(() => $<HTMLInputElement>(this.node, '.chat-form input').focus({ preventScroll: true }), 50);
  }

  private pickReply(text: string) {
    for (const [re, r] of KEYWORDS) if (re.test(text) && Math.random() < 0.75) return r;
    if (!this.pool.length) this.pool = [...CANNED];
    return this.pool.splice(Math.floor(Math.random() * this.pool.length), 1)[0];
  }

  private add(who: 'me' | 'gary', text = '') {
    const m = el(`<div class="msg msg--${who}"></div>`);
    m.textContent = text;
    this.log.append(m);
    this.log.scrollTop = this.log.scrollHeight;
    return m;
  }

  /** Queue a reply: pause, "Gary is typing…", then one character every ~250ms. */
  private reply(text: string, pause = 2200 + Math.random() * 2500, typing = 3500 + Math.random() * 4000) {
    clearTimeout(this.idleTimer);
    this.queue = this.queue.then(async () => {
      await sleep(pause);
      const dots = el('<div class="msg msg--gary msg--typing"><span>Gary is typing</span><i></i><i></i><i></i></div>');
      this.log.append(dots);
      this.log.scrollTop = this.log.scrollHeight;
      await sleep(typing);
      dots.remove();
      const m = this.add('gary');
      for (const ch of text) {
        m.textContent += ch;
        this.log.scrollTop = this.log.scrollHeight;
        await sleep(ch === ' ' ? 120 : 230 + Math.random() * 120);
      }
      clearTimeout(this.idleTimer);
      this.idleTimer = window.setTimeout(() => {
        if (this.node.classList.contains('open')) this.reply('you still there', 0, 5000);
      }, 60000);
    });
  }
}
