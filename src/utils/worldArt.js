// Original procedural art for the world backdrop and buildings. Everything is baked into a texture ONCE (cached by key),
// so a detailed building or a 3-layer mountain range costs one image per frame instead of hundreds of Graphics commands.
const INK = 0x16304a;
export const lerp = (a, b, t) => a + (b - a) * t;
export const mix = (c1, c2, t) => (Math.round(lerp(c1 >> 16, c2 >> 16, t)) << 16) | (Math.round(lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t)) << 8) | Math.round(lerp(c1 & 255, c2 & 255, t));
const shade = (c, t) => mix(c, t < 0 ? 0x000000 : 0xffffff, Math.abs(t));
function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }
export function bake(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  draw(g); g.generateTexture(key, w, h); g.destroy();
  return key;
}

// ---------------------------------------------------------------- sky + mountains
export function skyTexture(scene, top) {
  const bottom = mix(top, 0x9cc3e6, 0.55), key = `sky_${top.toString(16)}`;
  return bake(scene, key, 4, 128, (g) => { for (let i = 0; i < 32; i++) { g.fillStyle(mix(top, bottom, (i / 31) ** 1.6)); g.fillRect(0, i * 4, 4, 4); } });
}

// Three ridge layers at HALF resolution (drawn 2x on screen): far = pale + blue, near = dark with pines. 3 x ~1.2 MB.
const LAYERS = [
  { rock: 0x4d6f96, snow: 0xdbe9f6, shadow: 0x7a98ba, h: 190, peak: 0.95, snowLine: 120, fog: 0.5 },
  { rock: 0x34557a, snow: 0xeaf4fb, shadow: 0xa9c2dc, h: 170, peak: 0.8, snowLine: 105, fog: 0.32 },
  { rock: 0x24405f, snow: 0xf6fbff, shadow: 0xbcd3e8, h: 130, peak: 0.6, snowLine: 80, fog: 0.15, pines: true },
];
export function mountainTextures(scene) {
  return LAYERS.map((L, n) => bake(scene, `mt_${n}`, 1600, 200, (g) => {
    const r = rng(11 + n * 37), ph = [r() * 6, r() * 6, r() * 6], N = 1600 / 8, top = [];
    for (let i = 0; i <= N; i++) {                                         // ridge height: layered sines + sharp peaks
      const x = i / N * 6.28 * (1.4 + n * 0.5);
      const hh = 0.5 + 0.22 * Math.sin(x + ph[0]) + 0.16 * Math.sin(x * 2.3 + ph[1]) + 0.1 * Math.abs(Math.sin(x * 4.1 + ph[2]));
      top.push(200 - L.h * Math.min(1, hh * L.peak + 0.12));
    }
    for (let i = 0; i < N; i++) {
      const x0 = i * 8, x1 = x0 + 8, y0 = top[i], y1 = top[i + 1], lit = y1 < y0;            // rising slope = lit face
      const rock = lit ? L.rock : shade(L.rock, -0.28);
      g.fillStyle(rock); g.fillTriangle(x0, y0, x1, y1, x0, 200); g.fillTriangle(x1, y1, x1, 200, x0, 200);
      const snowY = 200 - L.h * 0.62;                                                                    // snow covers only the top ~40% of the range
      const sd0 = Math.max(0, (snowY - y0) * (0.5 + 0.5 * Math.sin(i * 1.7) ** 2));                      // jagged snow edge
      const sd1 = Math.max(0, (snowY - y1) * (0.5 + 0.5 * Math.sin((i + 1) * 1.7) ** 2));
      if (sd0 + sd1 > 0) {
        g.fillStyle(lit ? L.snow : L.shadow);
        g.fillTriangle(x0, y0, x1, y1, x0, y0 + sd0); g.fillTriangle(x1, y1, x1, y1 + sd1, x0, y0 + sd0);
      }
      const ridge = Math.min(y0, y1);
      for (let j = 0; j < 14; j++) {                                                                       // atmospheric haze toward the base, only BELOW the ridge
        const yb = 200 - j * 6 - 6; if (yb + 6 <= ridge) break;
        g.fillStyle(0xcfe4f5, L.fog / 14); g.fillRect(x0, Math.max(yb, ridge), 8, yb + 6 - Math.max(yb, ridge));
      }
    }
    if (L.pines) for (let x = 6; x < 1600; x += 9 + r() * 14) {                                             // pine silhouettes along the foot
      const s = 0.7 + r() * 0.8; g.fillStyle(0x16324a); g.fillTriangle(x, 168 - s * 20, x - 6 * s, 196, x + 6 * s, 196); g.fillStyle(0xe9f4fb, 0.8); g.fillTriangle(x, 168 - s * 20, x - 2.5 * s, 176 - s * 14, x + 2.5 * s, 176 - s * 14);
    }
  }));
}

// ---------------------------------------------------------------- small outdoor decor (baked once, reused as images)
export function decorTextures(scene) {
  bake(scene, 'deco_bank', 120, 36, (g) => {
    g.fillStyle(0xb4d4e6, 0.9); g.fillEllipse(60, 22, 116, 24); g.fillStyle(0xf4fbff); g.fillEllipse(58, 17, 108, 24);
    g.fillStyle(0xffffff); g.fillEllipse(44, 12, 50, 12); g.fillStyle(0xdbeaf5, 0.8); g.fillEllipse(84, 22, 40, 8);
  });
  bake(scene, 'deco_rock', 56, 40, (g) => {
    g.fillStyle(INK, 0.18); g.fillEllipse(28, 35, 54, 10);
    g.fillStyle(0x6f7f8e); g.fillPoints([{ x: 4, y: 34 }, { x: 10, y: 14 }, { x: 24, y: 6 }, { x: 42, y: 12 }, { x: 52, y: 34 }], true);
    g.fillStyle(0x8999a8); g.fillPoints([{ x: 10, y: 14 }, { x: 24, y: 6 }, { x: 30, y: 20 }, { x: 14, y: 30 }], true);
    g.fillStyle(0xffffff); g.fillEllipse(26, 9, 28, 9); g.fillEllipse(12, 17, 10, 5);
  });
  bake(scene, 'deco_fence', 64, 44, (g) => {
    g.fillStyle(INK, 0.15); g.fillEllipse(32, 40, 62, 8);
    g.fillStyle(0x8a6240); g.fillRect(0, 16, 64, 5); g.fillRect(0, 27, 64, 5); g.fillStyle(0x5e4129); g.fillRect(0, 20, 64, 1); g.fillRect(0, 31, 64, 1);
    for (const x of [4, 52]) { g.fillStyle(0x6b4a2f); g.fillRoundedRect(x, 8, 8, 32, 2); g.fillStyle(0xffffff); g.fillRoundedRect(x - 1, 5, 10, 7, 3); }
    g.fillStyle(0xffffff, 0.95); g.fillRoundedRect(8, 13, 44, 4, 2);
  });
  bake(scene, 'deco_sign', 54, 70, (g) => {
    g.fillStyle(INK, 0.18); g.fillEllipse(27, 66, 30, 7); g.fillStyle(0x6b4a2f); g.fillRect(24, 20, 7, 46);
    g.fillStyle(0x9c6b3e); g.fillRoundedRect(2, 4, 50, 22, 5); g.fillStyle(0xc99562); g.fillRoundedRect(4, 6, 46, 6, 3); g.lineStyle(2, 0x5e4129); g.strokeRoundedRect(2, 4, 50, 22, 5);
    g.fillStyle(0xffffff); g.fillRoundedRect(0, 0, 54, 8, 4); g.fillStyle(0xf4fbff); g.fillTriangle(34, 18, 44, 14, 44, 22);
  });
  bake(scene, 'deco_crate', 40, 40, (g) => {
    g.fillStyle(INK, 0.18); g.fillEllipse(20, 36, 38, 7); g.fillStyle(0x7a5330); g.fillRoundedRect(3, 8, 34, 28, 3); g.fillStyle(0x9c6b3e); g.fillRect(6, 11, 28, 22);
    g.lineStyle(2, 0x5e4129); g.lineBetween(6, 11, 34, 33); g.lineBetween(34, 11, 6, 33); g.fillStyle(0xffffff); g.fillRoundedRect(1, 4, 38, 8, 4);
  });
}

// ---------------------------------------------------------------- detailed building (replaces the old per-frame Graphics)
const PAD_X = 44, PAD_T = 50, PAD_B = 34;
export function buildingTexture(scene, b) {
  const { w, h } = b, key = `bld_${b.label}_${w}x${h}_${b.wall.toString(16)}_${b.roof.toString(16)}`;
  const TW = w + PAD_X * 2, TH = h + PAD_T + PAD_B;
  bake(scene, key, TW, TH, (g) => {
    const x = PAD_X, y = PAD_T, cx = x + w / 2, bot = y + h, rc = b.roof, wc = b.wall, r = rng(w * 7 + h);
    // cast shadow (soft base + long offset wedge to the right, away from the lamps)
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, bot + 6, w + 44, 36);
    g.fillStyle(INK, 0.12); g.fillPoints([{ x: x + w, y: y + 50 }, { x: x + w + 40, y: bot + 14 }, { x: x + w, y: bot + 6 }], true);
    // foundation + walls with plank lines and corner trim
    g.fillStyle(0x7c8791); g.fillRoundedRect(x - 3, bot - 16, w + 6, 18, 4);
    for (let sx = x + 2; sx < x + w - 10; sx += 22) { g.fillStyle(0x6b7681); g.fillRoundedRect(sx, bot - 13, 18, 10, 2); }
    g.fillStyle(wc); g.fillRoundedRect(x, y + 44, w, h - 58, { tl: 6, tr: 6, bl: 0, br: 0 });
    g.fillStyle(shade(wc, -0.16), 0.55); for (let ly = y + 62; ly < bot - 18; ly += 16) g.fillRect(x + 2, ly, w - 4, 2);
    g.fillStyle(shade(wc, 0.18), 0.5); g.fillRect(x + 3, y + 46, w - 6, 3);
    g.fillStyle(shade(wc, -0.3)); g.fillRect(x, y + 44, 7, h - 58); g.fillRect(x + w - 7, y + 44, 7, h - 58);                  // corner boards
    g.fillStyle(INK, 0.1); g.fillRect(x + w * 0.5, y + 46, w * 0.5, h - 60);                                                // gentle side shading
    // roof: shingle rows, ridge, scalloped snow, eave
    g.fillStyle(shade(rc, -0.35)); g.fillTriangle(x - 18, y + 54, cx, y - 14, x + w + 18, y + 54);
    g.fillStyle(rc); g.fillTriangle(x - 14, y + 52, cx, y - 8, x + w + 14, y + 52);
    g.fillStyle(shade(rc, -0.2), 0.7);
    for (let i = 1; i < 5; i++) { const t = i / 5, yy = lerp(y - 8, y + 52, t), half = (w / 2 + 14) * t; g.fillRect(cx - half + 4, yy, half * 2 - 8, 2); }
    g.fillStyle(shade(rc, 0.22), 0.7); g.fillTriangle(x - 14, y + 52, cx, y - 8, cx - 22, y + 4);
    g.fillStyle(shade(rc, -0.45)); g.fillRect(x - 18, y + 50, w + 36, 8);
    g.fillStyle(0xffffff); g.fillEllipse(cx, y + 2, w * 0.5, 22); g.fillEllipse(cx - w * 0.2, y + 22, w * 0.3, 14); g.fillEllipse(cx + w * 0.2, y + 22, w * 0.3, 14);
    for (let sx = x - 16; sx < x + w + 14; sx += 18) g.fillEllipse(sx + 9, y + 46, 22, 14);                                  // scalloped snow along the eave
    g.fillStyle(0xdbeaf5); for (let sx = x - 10; sx < x + w + 10; sx += 18) g.fillEllipse(sx + 9, y + 50, 16, 5);
    // attic window in the gable
    g.fillStyle(0x5a3b22); g.fillCircle(cx, y + 30, 11); g.fillStyle(0xfff0b0); g.fillCircle(cx, y + 30, 8); g.lineStyle(2, 0x5a3b22); g.lineBetween(cx - 8, y + 30, cx + 8, y + 30); g.lineBetween(cx, y + 22, cx, y + 38);
    // chimney with snow cap
    g.fillStyle(0x7d6a58); g.fillRect(x + w - 56, y + 2, 28, 46); g.fillStyle(0x66564a); for (let i = 0; i < 4; i++) g.fillRect(x + w - 56, y + 10 + i * 10, 28, 2);
    g.fillStyle(0x4e4137); g.fillRect(x + w - 60, y - 2, 36, 9); g.fillStyle(0xffffff); g.fillRoundedRect(x + w - 62, y - 8, 40, 9, 4);
    // windows: frame, glow, mullions, shutters, snowy sill + flower box
    const winY = y + 76, n = Math.max(2, Math.floor(w / 90));
    for (let i = 0; i < n; i++) {
      const wx = x + (w / (n + 1)) * (i + 1) - 18;
      if (Math.abs(wx + 18 - cx) < 44) continue;
      g.fillStyle(0xffc247, 0.16); g.fillCircle(wx + 18, winY + 20, 34);                                                    // warm spill
      g.fillStyle(shade(rc, -0.1)); g.fillRoundedRect(wx - 11, winY - 2, 10, 42, 3); g.fillRoundedRect(wx + 37, winY - 2, 10, 42, 3);  // shutters
      g.fillStyle(0x5a3b22); g.fillRoundedRect(wx - 3, winY - 4, 42, 44, 5);
      g.fillStyle(0xfff0b0); g.fillRoundedRect(wx, winY, 36, 38, 4); g.fillStyle(0xffffff, 0.45); g.fillTriangle(wx + 2, winY + 2, wx + 16, winY + 2, wx + 2, winY + 22);
      g.fillStyle(0x5a3b22); g.fillRect(wx + 16, winY, 4, 38); g.fillRect(wx, winY + 17, 36, 4);
      g.fillStyle(0xe8483c, 0.9); g.fillRoundedRect(wx + 2, winY + 8, 12, 12, 3);                                           // curtain hint
      g.fillStyle(0x6b4a2f); g.fillRoundedRect(wx - 5, winY + 38, 46, 9, 2); g.fillStyle(0x2f9e5b); for (let k = 0; k < 5; k++) g.fillCircle(wx + 2 + k * 8, winY + 37, 4);
      g.fillStyle(0xff7a8a); g.fillCircle(wx + 10, winY + 35, 2); g.fillCircle(wx + 26, winY + 35, 2);
      g.fillStyle(0xffffff); g.fillRoundedRect(wx - 6, winY - 9, 48, 7, 3);
    }
    // door: arched, panelled, awning, steps, mat, wreath, lanterns
    const dw = 50, dx = cx - dw / 2, dTop = bot - 70;
    g.fillStyle(0xffc247, 0.14); g.fillEllipse(cx, bot - 6, 120, 44);
    g.fillStyle(0x3a2616); g.fillRoundedRect(cx - 38, bot - 10, 76, 12, 4); g.fillStyle(0xf4fbff); g.fillRoundedRect(cx - 38, bot - 13, 76, 6, 3);
    g.fillStyle(0x4a3220); g.fillRoundedRect(dx - 5, dTop - 3, dw + 10, 73, { tl: 28, tr: 28, bl: 0, br: 0 });
    g.fillStyle(0x7a5330); g.fillRoundedRect(dx, dTop + 2, dw, 68, { tl: 24, tr: 24, bl: 0, br: 0 });
    g.fillStyle(0x93673c); g.fillRoundedRect(dx + 6, dTop + 18, 16, 20, 3); g.fillRoundedRect(dx + dw - 22, dTop + 18, 16, 20, 3); g.fillRoundedRect(dx + 6, dTop + 42, 16, 22, 3); g.fillRoundedRect(dx + dw - 22, dTop + 42, 16, 22, 3);
    g.fillStyle(0xfff0b0, 0.9); g.fillCircle(cx, dTop + 16, 7);
    g.fillStyle(0xffc247); g.fillCircle(dx + dw - 8, bot - 32, 3);
    g.fillStyle(0xe8483c); g.fillRect(cx - 22, bot - 3, 44, 4);                                                             // doormat
    for (let i = 0; i < 6; i++) { g.fillStyle(i % 2 ? 0xffffff : rc); g.fillTriangle(cx - 36 + i * 12, dTop - 18, cx - 24 + i * 12, dTop - 18, cx - 30 + i * 12, dTop - 4); }   // striped awning
    g.fillStyle(shade(rc, -0.3)); g.fillRoundedRect(cx - 40, dTop - 24, 80, 8, 3); g.fillStyle(0xffffff); g.fillRoundedRect(cx - 42, dTop - 30, 84, 8, 4);
    g.fillStyle(0x2f9e5b); g.fillCircle(cx, dTop + 34, 8); g.fillStyle(wc); g.fillCircle(cx, dTop + 34, 4); g.fillStyle(0xe8483c); g.fillCircle(cx - 4, dTop + 30, 2); g.fillCircle(cx + 5, dTop + 38, 2);
    [cx - 46, cx + 46].forEach((lx) => {
      g.fillStyle(0xffc247, 0.22); g.fillCircle(lx, bot - 56, 15);
      g.fillStyle(0x3a3f4b); g.fillRect(lx - 1.5, bot - 76, 3, 10); g.fillStyle(0xfff0b0); g.fillRoundedRect(lx - 6, bot - 66, 12, 16, 4); g.fillStyle(0x3a3f4b); g.fillRect(lx - 7, bot - 50, 14, 3);
    });
    // string lights, icicles, snow drifts + a barrel and crate at the corners
    const cols = [0xffc247, 0xe8483c, 0x6fd08c, 0x5bb6e8];
    for (let i = 0, lx = x + 10; lx < x + w - 8; lx += 24, i++) {
      const sag = Math.sin((lx - x) / w * Math.PI) * 8;
      g.fillStyle(0x3a3f4b); g.fillRect(lx, y + 58 + sag, 2, 5); g.fillStyle(cols[i % 4], 0.3); g.fillCircle(lx + 1, y + 66 + sag, 7); g.fillStyle(cols[i % 4]); g.fillCircle(lx + 1, y + 66 + sag, 4);
    }
    g.fillStyle(0xffffff, 0.92); for (let ix = x - 8; ix < x + w + 8; ix += 15) g.fillTriangle(ix, y + 56, ix + 6, y + 56, ix + 3, y + 56 + 5 + r() * 12);
    g.fillStyle(0xf4fbff); g.fillEllipse(x + 10, bot + 2, 70, 22); g.fillEllipse(x + w - 10, bot + 2, 70, 22); g.fillStyle(0xdbeaf5); g.fillEllipse(x + w - 4, bot + 6, 40, 8);
    g.fillStyle(0x6b4a2f); g.fillRoundedRect(x + 8, bot - 30, 22, 28, 5); g.fillStyle(0x4e3622); g.fillRect(x + 8, bot - 22, 22, 3); g.fillRect(x + 8, bot - 11, 22, 3); g.fillStyle(0xffffff); g.fillEllipse(x + 19, bot - 30, 22, 8);
    if (w > 200) { g.fillStyle(0x9c6b3e); g.fillRoundedRect(x + w - 36, bot - 24, 24, 22, 3); g.lineStyle(2, 0x5e4129); g.strokeRoundedRect(x + w - 36, bot - 24, 24, 22, 3); g.fillStyle(0xffffff); g.fillRoundedRect(x + w - 38, bot - 29, 28, 8, 4); }
  });
  return { key, ox: PAD_X, oy: PAD_T };
}
