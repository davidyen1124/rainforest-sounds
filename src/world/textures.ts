import * as THREE from 'three';

const cache = new Map<string, THREE.Texture>();

/**
 * Loads /assets/<name>.webp onto a canvas texture. Until (or if never) the image loads,
 * the texture shows a big emoji, so a missing asset degrades to "emoji sticker" instead of a white square.
 */
export function stickerTexture(name: string, emoji: string): THREE.Texture {
  const hit = cache.get(name);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.font = '380px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(emoji, 256, 290);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const img = new Image();
  img.onload = () => {
    g.clearRect(0, 0, 512, 512);
    g.drawImage(img, 0, 0, 512, 512);
    tex.needsUpdate = true;
  };
  img.src = `/assets/${name}.webp`;
  cache.set(name, tex);
  return tex;
}

function noiseCanvas(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  paint(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function groundTexture() {
  return noiseCanvas(512, 512, (g) => {
    g.fillStyle = '#1f3d1c';
    g.fillRect(0, 0, 512, 512);
    const blobs = ['#28502a', '#173016', '#3a4a1c', '#2d2416', '#33612e', '#1a2a12'];
    for (let i = 0; i < 900; i++) {
      g.fillStyle = blobs[i % blobs.length];
      g.globalAlpha = 0.25 + Math.random() * 0.4;
      const r = 2 + Math.random() * 14;
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      g.beginPath();
      g.ellipse(x, y, r, r * (0.4 + Math.random() * 0.6), Math.random() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
    // tiny fallen leaves
    for (let i = 0; i < 120; i++) {
      g.globalAlpha = 0.7;
      g.fillStyle = ['#5c7a1f', '#7a5a1f', '#3f6b2a', '#8a6d2b'][i % 4];
      g.save();
      g.translate(Math.random() * 512, Math.random() * 512);
      g.rotate(Math.random() * Math.PI * 2);
      g.beginPath();
      g.ellipse(0, 0, 7, 3, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });
}

export function barkTexture() {
  return noiseCanvas(256, 512, (g) => {
    g.fillStyle = '#4a3522';
    g.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 220; i++) {
      g.strokeStyle = ['#2e2014', '#5c4430', '#3a2a1a', '#6b7a3a'][i % 4];
      g.globalAlpha = 0.3 + Math.random() * 0.5;
      g.lineWidth = 1 + Math.random() * 4;
      const x = Math.random() * 256;
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y <= 512; y += 32) g.lineTo(x + Math.sin(y * 0.05 + i) * 5, y);
      g.stroke();
    }
    // moss
    g.globalAlpha = 0.35;
    g.fillStyle = '#4f7d2c';
    for (let i = 0; i < 60; i++) g.fillRect(Math.random() * 256, Math.random() * 512, 6 + Math.random() * 30, 4 + Math.random() * 20);
  });
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** The legendary post, as a physical object. Redraws when it gets liked by a frog. */
export class TweetTexture {
  canvas = document.createElement('canvas');
  texture: THREE.CanvasTexture;
  private views = 230;

  constructor() {
    this.canvas.width = 1024;
    this.canvas.height = 680;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.draw(5);
  }

  draw(likes: number) {
    this.views += 1 + Math.floor(Math.random() * 3);
    const g = this.canvas.getContext('2d')!;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const sans = '-apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif';
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, W, H);

    // avatar: an extremely generic guy (a frog)
    g.fillStyle = '#2f7d4f';
    g.beginPath();
    g.arc(78, 78, 44, 0, Math.PI * 2);
    g.fill();
    g.font = '54px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🐸', 78, 82);

    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#0f1419';
    g.font = `bold 34px ${sans}`;
    g.fillText('a verified guy', 140, 70);
    const nameW = g.measureText('a verified guy').width;
    // blue check
    g.fillStyle = '#1d9bf0';
    g.beginPath();
    g.arc(140 + nameW + 22, 58, 15, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(140 + nameW + 14, 58);
    g.lineTo(140 + nameW + 20, 65);
    g.lineTo(140 + nameW + 31, 51);
    g.stroke();
    g.fillStyle = '#536471';
    g.font = `30px ${sans}`;
    g.fillText('@probably_fine', 140, 108);
    g.fillStyle = '#0f1419';
    g.font = `bold 44px ${sans}`;
    g.fillText('𝕏', W - 80, 80);

    g.font = `40px ${sans}`;
    g.fillStyle = '#0f1419';
    g.fillText('this playlist reset my dopamine', 36, 190);

    // playlist embed
    roundRect(g, 36, 225, W - 72, 250, 26);
    g.fillStyle = '#1e4d1f';
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = `28px ${sans}`;
    g.fillText('Public Playlist', 70, 280);
    g.font = `bold 92px ${sans}`;
    g.fillText('Rainforest Sounds', 64, 380);
    g.fillStyle = '#9fd3a0';
    g.font = `30px ${sans}`;
    g.fillText('Recordings from the tropical rainforest', 70, 440);

    g.fillStyle = '#536471';
    g.font = `30px ${sans}`;
    const meta = '2:34 PM · 9/28/26 · ';
    g.fillText(meta, 36, 535);
    const mw = g.measureText(meta).width;
    g.fillStyle = '#0f1419';
    g.font = `bold 30px ${sans}`;
    const vs = this.views.toLocaleString();
    g.fillText(vs, 36 + mw, 535);
    g.fillStyle = '#536471';
    g.font = `30px ${sans}`;
    g.fillText(' Views', 36 + mw + g.measureText(vs).width + 2, 535);

    g.strokeStyle = '#eff3f4';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(0, 570);
    g.lineTo(W, 570);
    g.stroke();

    // heart + likes
    const hx = 480;
    const hy = 625;
    g.fillStyle = likes > 5 ? '#f91880' : '#536471';
    g.beginPath();
    g.moveTo(hx, hy + 12);
    g.bezierCurveTo(hx - 30, hy - 8, hx - 14, hy - 30, hx, hy - 14);
    g.bezierCurveTo(hx + 14, hy - 30, hx + 30, hy - 8, hx, hy + 12);
    g.fill();
    g.font = `bold 34px ${sans}`;
    g.fillText(String(likes), hx + 34, hy + 10);
    g.fillStyle = '#536471';
    g.font = `30px ${sans}`;
    g.fillText('💬', 60, hy + 10);
    g.fillText('🔁', 270, hy + 10);
    g.fillText('🔖', 700, hy + 10);
    g.fillText('⤴', 900, hy + 10);
    this.texture.needsUpdate = true;
  }
}
