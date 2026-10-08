// Procedural top-down art for every furniture piece (so rotating by 90° always looks right).
// Each texture is exactly the piece's footprint. Replace any entry with a loaded image of the same key later.
import { FURNITURE } from '../shops/furniture.js';

const INK = 0x1b2a41;
const rr = (g, x, y, w, h, r, c) => { g.fillStyle(INK); g.fillRoundedRect(x, y, w, h, r); g.fillStyle(c); g.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, Math.max(r - 2, 1)); };
const ell = (g, x, y, w, h, c) => { g.fillStyle(INK); g.fillEllipse(x, y, w, h); g.fillStyle(c); g.fillEllipse(x, y, w - 6, h - 6); };
const dot = (g, x, y, r, c) => { g.fillStyle(c); g.fillCircle(x, y, r); };
const star = (g, cx, cy, ro, ri, c) => {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? ri : ro; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
  g.fillStyle(c); g.fillPoints(pts, true);
};
const leaves = (g, cx, cy, n, len, wid, c) => {
  g.fillStyle(c);
  for (let i = 0; i < n; i++) {
    const a = (i * Math.PI * 2) / n, px = -Math.sin(a) * wid, py = Math.cos(a) * wid;
    g.fillTriangle(cx + px, cy + py, cx - px, cy - py, cx + Math.cos(a) * len, cy + Math.sin(a) * len);
  }
};

const ART = {
  chair_wood: (g) => { rr(g, 0, 0, 48, 48, 8, 0xc58b55); rr(g, 3, 0, 42, 12, 4, 0x9c693c); rr(g, 9, 16, 30, 26, 6, 0xd9a470); },
  chair_beanbag: (g) => { ell(g, 32, 32, 64, 64, 0x6a4fb3); ell(g, 28, 28, 24, 20, 0x8a6fd6); dot(g, 40, 40, 3, 0x56409a); },
  chair_armchair: (g) => { rr(g, 0, 0, 64, 64, 10, 0xb82f25); rr(g, 12, 18, 40, 40, 8, 0xe8574b); rr(g, 0, 14, 12, 50, 6, 0xd7392e); rr(g, 52, 14, 12, 50, 6, 0xd7392e); rr(g, 0, 0, 64, 18, 8, 0xd7392e); },
  sofa_plaid: (g) => {
    rr(g, 0, 0, 144, 64, 10, 0x2e4057); rr(g, 14, 22, 58, 36, 6, 0x4a6fa5); rr(g, 72, 22, 58, 36, 6, 0x4a6fa5);
    rr(g, 0, 12, 16, 52, 6, 0x3d5a80); rr(g, 128, 12, 16, 52, 6, 0x3d5a80); rr(g, 0, 0, 144, 20, 8, 0x3d5a80);
    g.lineStyle(2, 0xffffff, 0.35); for (let x = 24; x < 130; x += 16) g.lineBetween(x, 26, x, 56); g.lineBetween(18, 38, 126, 38);
  },
  table_coffee: (g) => { rr(g, 0, 0, 80, 48, 8, 0x9c693c); rr(g, 9, 9, 62, 30, 4, 0xbfe3f2); g.lineStyle(2, 0xffffff, 0.6); g.lineBetween(16, 30, 30, 16); },
  table_round: (g) => { ell(g, 40, 40, 80, 80, 0xc58b55); ell(g, 40, 40, 52, 52, 0xd9a470); },
  table_long: (g) => { rr(g, 0, 0, 128, 64, 8, 0xc58b55); g.lineStyle(2, 0x9c693c); g.lineBetween(6, 21, 122, 21); g.lineBetween(6, 43, 122, 43); },
  bed_single: (g) => { rr(g, 0, 0, 80, 144, 8, 0x8a5a36); rr(g, 6, 14, 68, 124, 6, 0xf4fbff); rr(g, 6, 58, 68, 80, 6, 0x4a8fd8); rr(g, 16, 20, 48, 28, 8, 0xffffff); },
  bed_double: (g) => { rr(g, 0, 0, 112, 144, 8, 0x8a5a36); rr(g, 6, 14, 100, 124, 6, 0xf4fbff); rr(g, 6, 58, 100, 80, 6, 0xe8483c); rr(g, 12, 20, 44, 28, 8, 0xffffff); rr(g, 56, 20, 44, 28, 8, 0xffffff); },
  bed_igloo: (g) => {
    ell(g, 56, 56, 112, 112, 0xe9f8ff); g.lineStyle(2, 0xa9dcf5); g.strokeCircle(56, 56, 40); g.strokeCircle(56, 56, 22);
    rr(g, 38, 82, 36, 28, 12, 0x27496d); rr(g, 42, 90, 28, 12, 6, 0x4a8fd8);
  },
  lamp_floor: (g) => { ell(g, 16, 16, 32, 32, 0xffc247); ell(g, 16, 16, 16, 16, 0xfff0b0); },
  lamp_lantern: (g) => { rr(g, 2, 2, 28, 28, 6, 0x2f9e5b); ell(g, 16, 16, 14, 14, 0xffe28a); },
  lamp_star: (g) => { star(g, 20, 21, 20, 9, INK); star(g, 20, 21, 16, 7, 0xffd24a); dot(g, 20, 21, 3, 0xfff6c9); },
  plant_cactus: (g) => { ell(g, 16, 16, 30, 30, 0x3f9b5a); ell(g, 16, 16, 14, 14, 0x56b873); dot(g, 16, 16, 4, 0xff7a8a); },
  plant_fern: (g) => { leaves(g, 24, 24, 10, 23, 5, INK); leaves(g, 24, 24, 10, 20, 4, 0x3f9b5a); dot(g, 24, 24, 7, 0xc4472b); dot(g, 24, 24, 4, 0x8a3b24); },
  plant_fir: (g) => { ell(g, 28, 28, 56, 56, 0x1f6b4f); ell(g, 28, 28, 38, 38, 0x2f8f67); ell(g, 28, 28, 18, 18, 0x3fae80); dot(g, 18, 22, 2.5, 0xffffff); dot(g, 36, 36, 2.5, 0xffffff); dot(g, 38, 20, 2, 0xffffff); },
  shelf_books: (g) => { rr(g, 0, 0, 128, 40, 4, 0x8a5a36); const c = [0xe8483c, 0x4a8fd8, 0xffc247, 0x6fd08c, 0xb48cff, 0xff9a52]; for (let i = 0; i < 11; i++) { g.fillStyle(c[i % 6]); g.fillRect(8 + i * 10, 9, 8, 22); } },
  shelf_cabinet: (g) => { rr(g, 0, 0, 96, 48, 6, 0xb9814f); g.lineStyle(2, INK); g.lineBetween(48, 4, 48, 44); dot(g, 42, 24, 3, 0xffc247); dot(g, 54, 24, 3, 0xffc247); },
  deco_radio: (g) => { rr(g, 0, 0, 48, 32, 6, 0x6b4428); ell(g, 14, 17, 16, 16, 0xf4fbff); dot(g, 14, 17, 2, INK); g.lineStyle(2, 0xd9a470); [10, 16, 22].forEach((y) => g.lineBetween(28, y + 2, 42, y + 2)); },
  deco_fishbowl: (g) => { ell(g, 20, 20, 40, 40, 0x8fd3f0); ell(g, 20, 20, 26, 26, 0xbfe9fa); g.fillStyle(0xff9a3c); g.fillEllipse(18, 20, 12, 7); g.fillTriangle(24, 20, 31, 15, 31, 25); dot(g, 14, 19, 1.2, INK); },
  deco_trophy: (g) => { ell(g, 16, 16, 32, 32, 0xffc247); ell(g, 16, 16, 18, 18, 0xffe28a); dot(g, 16, 16, 4, 0xfff6c9); },
  deco_fireplace: (g) => {
    rr(g, 0, 0, 112, 56, 6, 0x8c8f99); rr(g, 18, 12, 76, 38, 4, 0x2a2a33);
    g.fillStyle(0xff7a2b); g.fillTriangle(34, 48, 44, 22, 54, 48); g.fillTriangle(50, 48, 60, 18, 70, 48); g.fillTriangle(66, 48, 76, 24, 86, 48);
    g.fillStyle(0xffd24a); g.fillTriangle(42, 48, 48, 32, 54, 48); g.fillTriangle(58, 48, 64, 30, 70, 48);
  },
  rug_round: (g) => { ell(g, 64, 64, 128, 128, 0xc4472b); ell(g, 64, 64, 100, 100, 0xf4d9a0); ell(g, 64, 64, 60, 60, 0x3d5a80); ell(g, 64, 64, 24, 24, 0xf4d9a0); },
  rug_stripe: (g) => { rr(g, 0, 0, 160, 96, 10, 0x2f6fb5); g.fillStyle(0xffffff); for (let x = 20; x < 150; x += 30) g.fillRect(x, 8, 12, 80); g.fillStyle(0xffc247); g.fillRect(8, 44, 144, 8); },
  rug_polar: (g) => {
    [[16, 28], [128, 28], [18, 92], [126, 92]].forEach(([x, y]) => ell(g, x, y, 28, 22, 0xe9f4fb));
    ell(g, 72, 60, 112, 80, 0xffffff); ell(g, 72, 18, 48, 34, 0xf4fbff); ell(g, 52, 6, 14, 12, 0xe9f4fb); ell(g, 92, 6, 14, 12, 0xe9f4fb);
    dot(g, 64, 16, 2, INK); dot(g, 80, 16, 2, INK); g.fillStyle(INK); g.fillEllipse(72, 24, 9, 6);
  },
  snow_snowman: (g) => { ell(g, 28, 28, 56, 56, 0xffffff); ell(g, 28, 28, 34, 34, 0xf4fbff); dot(g, 22, 22, 2, INK); dot(g, 34, 22, 2, INK); g.fillStyle(0xff7a2b); g.fillTriangle(24, 28, 32, 28, 28, 40); g.lineStyle(3, 0xe8483c); g.strokeCircle(28, 28, 21); },
  snow_iceblock: (g) => { rr(g, 0, 0, 64, 64, 10, 0xbfe9fa); rr(g, 8, 8, 48, 48, 6, 0xdff5ff); g.lineStyle(3, 0xffffff, 0.8); g.lineBetween(14, 40, 40, 14); g.lineBetween(26, 50, 50, 26); },
  snow_penguin: (g) => { ell(g, 24, 24, 46, 46, 0x27496d); ell(g, 24, 28, 26, 30, 0xf4fbff); g.fillStyle(0xff9a3c); g.fillTriangle(20, 14, 28, 14, 24, 22); dot(g, 18, 11, 2, 0xffffff); dot(g, 30, 11, 2, 0xffffff); ell(g, 6, 28, 8, 20, 0x27496d); ell(g, 42, 28, 8, 20, 0x27496d); },
  season_pumpkin: (g) => { ell(g, 20, 21, 40, 36, 0xff8a2b); g.lineStyle(2, 0xc4561a); [12, 20, 28].forEach((x) => g.lineBetween(x, 6, x, 36)); rr(g, 17, 1, 7, 10, 2, 0x3f9b5a); },
  season_tree: (g) => {
    ell(g, 40, 40, 80, 80, 0x1f6b4f); ell(g, 40, 40, 56, 56, 0x2f8f67); ell(g, 40, 40, 30, 30, 0x3fae80);
    [[18, 30, 0xe8483c], [60, 24, 0xffc247], [58, 58, 0x4a8fd8], [22, 56, 0xb48cff], [40, 16, 0xe8483c], [44, 66, 0xffc247]].forEach(([x, y, c]) => dot(g, x, y, 4, c));
    star(g, 40, 40, 9, 4, 0xffd24a);
  },
};

export function makeFurnitureTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  for (const f of FURNITURE) {
    g.clear();
    (ART[f.id] || ((gg, ) => rr(gg, 0, 0, f.w, f.h, 8, 0xc58b55)))(g, f.w, f.h);
    g.generateTexture(f.asset, f.w, f.h);
  }
  g.destroy();
}
