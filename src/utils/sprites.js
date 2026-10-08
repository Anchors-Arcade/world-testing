// =====================================================================
// PHASE 13 — real world sprites.
//
// Every object in Anchors World used to be a coloured rectangle with an emoji sitting on it. This file is the
// drawing library that replaces them: one function per THING, drawn with graphics primitives so the game still
// ships with zero downloaded art and every sprite stays a few hundred bytes of code instead of a texture atlas.
//
// Contract, so every caller can treat them identically:
//   draw(g, x, y, w, h, o)   g = a Phaser.Graphics, (x, y) = TOP-LEFT of the object's FOOTPRINT, w/h its size.
//   The footprint is what the player collides with and what the interaction zone is measured from — unchanged
//   from Phases 1-12. The art may rise ABOVE the footprint (tent poles, signposts, trees), which is exactly what
//   makes the world read as a world instead of a grid of boxes.
//   `o` carries optional colour hints: { color, wall, roof, accent }.
//
// Style rules (kept consistent across every sprite): a soft dark ellipse for ground shadow, flat cartoon fills,
// one darker tone for shade, one lighter tone for the lit side, white snow on every up-facing surface outdoors,
// and a 3-4px dark outline only where it reads as a silhouette.
// =====================================================================

const INK = 0x16304a;
const SNOW = 0xffffff;
const WOOD = 0x8c5a3a, WOOD_D = 0x6b4428, WOOD_L = 0xb5703f;

// shared helpers -------------------------------------------------------
const shadow = (g, cx, by, w, h = 18) => { g.fillStyle(INK, 0.18); g.fillEllipse(cx, by, w, h); };
const snowCap = (g, cx, y, w, h = 12) => { g.fillStyle(SNOW, 0.95); g.fillEllipse(cx, y, w, h); };
const plank = (g, x, y, w, h, c = WOOD, d = WOOD_D) => {
  g.fillStyle(d); g.fillRoundedRect(x, y, w, h, 4);
  g.fillStyle(c); g.fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 3);
};

// =====================================================================
// SPRITES
// =====================================================================
export const SPRITES = {
  // ---------- camp & outdoors ----------
  tent(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h, peak = y - h * 0.85;
    shadow(g, cx, base + 4, w + 26, 20);
    g.fillStyle(0x2a7f6f); g.fillTriangle(cx, peak, x - 10, base, cx + 4, base);          // left panel
    g.fillStyle(0x1f6b5e); g.fillTriangle(cx, peak, cx - 4, base, x + w + 10, base);      // right panel (shade)
    g.fillStyle(0x16564c);                                                                 // doorway
    g.fillTriangle(cx, peak + h * 0.55, cx - w * 0.17, base, cx + w * 0.17, base);
    g.fillStyle(0x0d3b34);
    g.fillTriangle(cx, peak + h * 0.75, cx - w * 0.1, base, cx + w * 0.1, base);
    g.fillStyle(SNOW, 0.9);                                                                // snow along the ridge
    g.fillTriangle(cx, peak, cx - w * 0.12, peak + h * 0.42, cx + w * 0.12, peak + h * 0.42);
    g.lineStyle(4, WOOD_D);                                                                // guy poles
    g.lineBetween(cx, peak - 8, cx, peak + 10);
    g.lineBetween(x - 10, base, x - 26, base + 4); g.lineBetween(x + w + 10, base, x + w + 26, base + 4);
    g.fillStyle(0xffc247); g.fillCircle(cx, peak - 10, 5);                                 // little flag knob
  },

  campfire(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w + 20, 16);
    g.fillStyle(0x9aa7b8);                                                                 // ring of stones
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      g.fillEllipse(cx + Math.cos(a) * (w / 2), base - 6 + Math.sin(a) * 7, 17, 13);
    }
    g.fillStyle(WOOD_D);                                                                   // logs
    g.fillRoundedRect(cx - w * 0.36, base - 20, w * 0.72, 11, 5);
    g.fillStyle(WOOD); g.fillRoundedRect(cx - w * 0.3, base - 26, w * 0.6, 9, 4);
    g.fillStyle(0xff6b2c); g.fillTriangle(cx, y - 6, cx - 17, base - 18, cx + 17, base - 18);   // flame
    g.fillStyle(0xffa63c); g.fillTriangle(cx, y + 8, cx - 11, base - 18, cx + 11, base - 18);
    g.fillStyle(0xffe066); g.fillTriangle(cx, y + 22, cx - 5, base - 18, cx + 5, base - 18);
  },

  snowpile(g, x, y, w, h, o = {}) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w + 16, 14);
    g.fillStyle(0xdfeefb); g.fillEllipse(cx, base - h * 0.2, w + 10, h * 1.5);
    g.fillStyle(SNOW); g.fillEllipse(cx - 4, base - h * 0.45, w * 0.8, h * 1.1);
    g.fillStyle(0xeaf6ff); g.fillEllipse(cx + w * 0.26, base - h * 0.18, w * 0.42, h * 0.72);
    if (o.neat) { g.lineStyle(3, 0x9fc6de, 0.9); g.strokeRect(x + 4, y + h * 0.1, w - 8, h * 0.9); }  // suspiciously tidy
  },

  sign(g, x, y, w, h, o = {}) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w, 14);
    g.fillStyle(WOOD_D); g.fillRect(cx - 6, y - 10, 12, h + 10);                            // post
    plank(g, x - 6, y - h * 0.55, w + 12, h * 0.62, o.color ?? 0xd8c9a3, WOOD_D);           // board
    g.fillStyle(SNOW, 0.9); g.fillRoundedRect(x - 8, y - h * 0.6, w + 16, 7, 3);
    g.fillStyle(WOOD_D);                                                                    // two text lines, suggested
    g.fillRoundedRect(x + 6, y - h * 0.38, w - 12, 5, 2);
    g.fillRoundedRect(x + 6, y - h * 0.22, (w - 12) * 0.66, 5, 2);
  },

  noticeboard(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w + 10, 14);
    g.fillStyle(WOOD_D); g.fillRect(x + 8, y + h * 0.4, 11, h * 0.75); g.fillRect(x + w - 19, y + h * 0.4, 11, h * 0.75);
    plank(g, x - 4, y - h * 0.5, w + 8, h, 0x7a4f2f, 0x4e3220);
    g.fillStyle(0xf4fbff); g.fillRoundedRect(x + 6, y - h * 0.38, w * 0.44, h * 0.46, 3);   // pinned notes
    g.fillStyle(0xfff0b0); g.fillRoundedRect(x + w * 0.54, y - h * 0.3, w * 0.38, h * 0.36, 3);
    g.fillStyle(0xe8483c); g.fillCircle(x + 6 + w * 0.22, y - h * 0.34, 3);
    g.fillStyle(0x3b82d9); g.fillCircle(x + w * 0.73, y - h * 0.26, 3);
    g.fillStyle(SNOW, 0.92); g.fillRoundedRect(x - 6, y - h * 0.56, w + 12, 8, 4);
  },

  crate(g, x, y, w, h, o = {}) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w + 12, 14);
    plank(g, x, y, w, h, o.color ?? WOOD_L, WOOD_D);
    g.lineStyle(4, WOOD_D, 0.8);
    g.lineBetween(x + 4, y + 4, x + w - 4, y + h - 4); g.lineBetween(x + w - 4, y + 4, x + 4, y + h - 4);
    g.fillStyle(WOOD_D); g.fillRect(x + 2, y + h * 0.45, w - 4, 5);
    g.fillStyle(SNOW, 0.9); g.fillRoundedRect(x + 2, y - 5, w - 4, 9, 4);
  },

  barrel(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w + 10, 13);
    g.fillStyle(WOOD); g.fillRoundedRect(x, y, w, h, 10);
    g.fillStyle(WOOD_L); g.fillRoundedRect(x + 3, y + 3, w * 0.42, h - 6, 8);
    g.fillStyle(0x7d8c97); g.fillRect(x, y + h * 0.22, w, 7); g.fillRect(x, y + h * 0.68, w, 7);
    g.fillStyle(0xdfeefb); g.fillEllipse(cx, y + 4, w * 0.92, 13);
  },

  fence(g, x, y, w, h) {
    g.fillStyle(WOOD_D);
    for (let i = 0; i <= w; i += 26) g.fillRect(x + i, y - h, 7, h + 6);
    g.fillStyle(WOOD); g.fillRect(x, y - h * 0.8, w, 6); g.fillRect(x, y - h * 0.35, w, 6);
    g.fillStyle(SNOW, 0.85); g.fillRect(x, y - h * 0.86, w, 4);
  },

  flag(g, x, y, w, h, o = {}) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w, 12);
    g.fillStyle(0x9aa7b8); g.fillRect(cx - 4, y - h * 0.9, 8, h * 1.9);
    g.fillStyle(o.color ?? 0xe8483c);
    g.fillTriangle(cx + 4, y - h * 0.85, cx + 4, y - h * 0.2, cx + w * 0.95, y - h * 0.52);
    g.fillStyle(SNOW); g.fillCircle(cx + w * 0.4, y - h * 0.52, 6);
    g.fillStyle(0xffc247); g.fillCircle(cx, y - h * 0.95, 5);
  },

  sled(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w + 10, 12);
    g.fillStyle(0x9fb6c6); g.fillRoundedRect(x, base - 10, w, 6, 3);                        // runners
    g.fillStyle(WOOD_D); g.fillRoundedRect(x + 2, y + 2, w - 4, h * 0.6, 6);
    g.fillStyle(WOOD_L); g.fillRoundedRect(x + 5, y + 5, w - 10, h * 0.5, 5);
    g.lineStyle(3, WOOD_D); for (let i = 1; i < 4; i++) g.lineBetween(x + (w / 4) * i, y + 5, x + (w / 4) * i, y + h * 0.5);
    g.fillStyle(0xd9546a); g.fillRoundedRect(x + 2, y, w - 4, 7, 3);
  },

  bell(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w, 12);
    g.fillStyle(WOOD_D); g.fillRect(x, y - 10, w, 9);                                       // frame
    g.fillRect(x, y - 10, 8, h + 10); g.fillRect(x + w - 8, y - 10, 8, h + 10);
    g.fillStyle(0xc9a227); g.fillTriangle(cx, y + 2, cx - w * 0.33, y + h * 0.72, cx + w * 0.33, y + h * 0.72);
    g.fillStyle(0xe6c252); g.fillTriangle(cx, y + 6, cx - w * 0.16, y + h * 0.72, cx + w * 0.1, y + h * 0.72);
    g.fillStyle(0xc9a227); g.fillRoundedRect(cx - w * 0.36, y + h * 0.68, w * 0.72, 8, 4);
    g.fillStyle(0x8a6a14); g.fillCircle(cx, y + h * 0.86, 5);
  },

  lantern(g, x, y, w, h, o = {}) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w, 12);
    g.fillStyle(0x3a3f4b); g.fillRect(cx - 4, y - 14, 8, h * 0.4);
    g.fillStyle(0x2b3a47); g.fillRoundedRect(x + 2, y + h * 0.15, w - 4, h * 0.72, 6);
    g.fillStyle(o.color ?? 0xfff0b0); g.fillRoundedRect(x + 7, y + h * 0.24, w - 14, h * 0.52, 4);
    g.fillStyle(0xffd977); g.fillCircle(cx, y + h * 0.5, Math.min(w, h) * 0.17);
    g.fillStyle(0x2b3a47); g.fillRoundedRect(x, y + h * 0.84, w, 8, 3);
  },

  post(g, x, y, w, h) {                                                                     // mooring post with rope
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w + 8, 12);
    g.fillStyle(WOOD_D); g.fillRoundedRect(cx - w * 0.35, y, w * 0.7, h, 5);
    g.fillStyle(WOOD); g.fillRoundedRect(cx - w * 0.22, y + 3, w * 0.3, h - 6, 4);
    g.fillStyle(SNOW, 0.9); g.fillEllipse(cx, y + 2, w * 0.8, 10);
    g.lineStyle(5, 0xd8c9a3);                                                                // coiled rope
    g.strokeEllipse(cx, y + h * 0.42, w * 1.15, 14);
    g.strokeEllipse(cx, y + h * 0.6, w * 1.05, 12);
  },

  boat(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 4, w + 20, 16);
    g.fillStyle(0x3d5a80); g.fillTriangle(x, y + h * 0.25, x + w, y + h * 0.25, cx, base);
    g.fillStyle(0x4f74a0); g.fillTriangle(x + 8, y + h * 0.3, cx, y + h * 0.3, cx, base - 6);
    g.fillStyle(0xf4fbff); g.fillRoundedRect(x, y + h * 0.16, w, 12, 5);                     // gunwale + snow
    g.fillStyle(0xd8c9a3); g.fillRoundedRect(x + w * 0.2, y - h * 0.5, w * 0.6, h * 0.62, 8); // canvas cover
    g.fillStyle(WOOD_D); g.fillRect(cx - 4, y - h * 0.8, 8, h * 0.4);
  },

  skates(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w, 10);
    g.fillStyle(WOOD_D); g.fillRect(cx - 4, y - 12, 8, 16);
    for (const dx of [-w * 0.22, w * 0.22]) {
      g.fillStyle(0xf4fbff); g.fillRoundedRect(cx + dx - 13, y + 4, 26, h * 0.5, 6);
      g.fillStyle(0xb8c4d0); g.fillRoundedRect(cx + dx - 15, y + 4 + h * 0.5, 30, 5, 2);
      g.fillStyle(0xdfe8ef); g.fillRoundedRect(cx + dx - 10, y + 8, 20, 8, 3);
    }
  },

  // ---------- rock / nature ----------
  cairn(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w + 14, 14);
    const stones = [[0.52, 0.0], [0.42, 0.3], [0.3, 0.58], [0.2, 0.82]];
    stones.forEach(([sw, t], i) => {
      const sy = base - h * (0.12 + t * 1.15);
      g.fillStyle(i % 2 ? 0x7d8c97 : 0x8e9ca8); g.fillEllipse(cx, sy, w * sw * 2, h * 0.42);
      g.fillStyle(0xa6b3bd, 0.7); g.fillEllipse(cx - w * sw * 0.3, sy - 4, w * sw, h * 0.2);
    });
    g.fillStyle(SNOW, 0.9); g.fillEllipse(cx, base - h * 2.0, w * 0.55, 9);
  },

  berries(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 2, w, 12);
    g.fillStyle(0x1f6b4f); g.fillEllipse(cx, base - h * 0.35, w + 8, h * 1.2);
    g.fillStyle(0x2a8a63); g.fillEllipse(cx - w * 0.2, base - h * 0.5, w * 0.7, h * 0.8);
    g.fillStyle(0x4a2f6b);
    [[-0.26, 0.5], [0.1, 0.75], [0.3, 0.42], [-0.05, 0.3]].forEach(([dx, dy]) =>
      g.fillCircle(cx + w * dx, base - h * dy, 6));
    g.fillStyle(0x7a5ca8); [[-0.28, 0.54], [0.08, 0.79]].forEach(([dx, dy]) => g.fillCircle(cx + w * dx, base - h * dy, 2.4));
    g.fillStyle(SNOW, 0.8); g.fillEllipse(cx, base - h * 0.95, w * 0.6, 8);
  },

  glyph(g, x, y, w, h, o = {}) {                                                             // a carved, glowing mark
    const cx = x + w / 2, cy = y + h / 2, c = o.color ?? 0x66e8ff;
    g.fillStyle(0x2b4a5c); g.fillRoundedRect(x, y, w, h, 14);
    g.fillStyle(0x1b3140); g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 11);
    g.lineStyle(6, c, 0.95);
    for (let i = 0; i < 26; i++) {                                                            // spiral
      const a0 = i * 0.42, a1 = (i + 1) * 0.42, r0 = i * (w * 0.013), r1 = (i + 1) * (w * 0.013);
      g.lineBetween(cx + Math.cos(a0) * r0, cy + Math.sin(a0) * r0, cx + Math.cos(a1) * r1, cy + Math.sin(a1) * r1);
    }
    g.fillStyle(c, 0.35); g.fillCircle(cx, cy, w * 0.42);
  },

  crystalCluster(g, x, y, w, h, o = {}) {
    const cx = x + w / 2, base = y + h, c = o.color ?? 0x8f6fe0;
    shadow(g, cx, base + 2, w + 16, 14);
    [[-0.3, 0.62, 0.3], [0.28, 0.5, 0.26], [0, 1, 0.38]].forEach(([dx, sh, sw]) => {
      const bx = cx + w * dx;
      g.fillStyle(c); g.fillTriangle(bx, base - h * sh, bx - w * sw * 0.5, base, bx + w * sw * 0.5, base);
      g.fillStyle(0xc7aaff); g.fillTriangle(bx, base - h * sh, bx - w * sw * 0.16, base, bx + w * sw * 0.2, base);
      g.fillStyle(SNOW, 0.5); g.fillTriangle(bx - 2, base - h * sh * 0.88, bx - w * sw * 0.1, base - h * sh * 0.2, bx + 2, base - h * sh * 0.2);
    });
    g.fillStyle(c, 0.22); g.fillEllipse(cx, base - h * 0.4, w * 1.6, h * 1.2);
  },

  icehole(g, x, y, w, h) {
    const cx = x + w / 2, cy = y + h / 2;
    g.fillStyle(SNOW, 0.95); g.fillEllipse(cx, cy, w + 18, h + 14);
    g.fillStyle(0x0c2a44); g.fillEllipse(cx, cy, w, h);
    g.fillStyle(0x15405f); g.fillEllipse(cx, cy - 3, w * 0.8, h * 0.7);
    g.fillStyle(0x9fe3ff, 0.4); g.fillEllipse(cx - w * 0.2, cy - h * 0.2, w * 0.3, h * 0.22);
  },

  bubble(g, x, y, w, h) {                                                                    // something frozen into the ice
    const cx = x + w / 2, cy = y + h / 2;
    g.fillStyle(0xbfe8fb, 0.85); g.fillEllipse(cx, cy, w, h);
    g.lineStyle(4, SNOW, 0.9); g.strokeEllipse(cx, cy, w, h);
    g.fillStyle(0xd8f3ff, 0.9); g.fillEllipse(cx - w * 0.18, cy - h * 0.2, w * 0.32, h * 0.26);
    g.fillStyle(0xc9a227); g.fillCircle(cx + w * 0.08, cy + 2, Math.min(w, h) * 0.13);       // the glint inside
    g.lineStyle(3, 0xc9a227, 0.9); g.strokeEllipse(cx + w * 0.08, cy + 2, w * 0.3, h * 0.26);
  },

  // ---------- indoor furniture & shop fittings ----------
  counter(g, x, y, w, h, o = {}) {
    const cx = x + w / 2;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w + 14, 16);
    g.fillStyle(o.color ?? WOOD_D); g.fillRoundedRect(x, y + 10, w, h - 4, 6);
    g.fillStyle(0xd8c9a3); g.fillRoundedRect(x - 6, y, w + 12, 16, 7);                       // worktop
    g.fillStyle(0xeee3c8); g.fillRoundedRect(x - 4, y + 2, w + 8, 7, 4);
    g.fillStyle(0x00000022); for (let i = 1; i < 4; i++) g.fillRect(x + (w / 4) * i, y + 16, 3, h - 14);
  },

  shelf(g, x, y, w, h, o = {}) {
    const cx = x + w / 2;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w + 10, 14);
    g.fillStyle(WOOD_D); g.fillRoundedRect(x, y - h * 0.9, w, h * 1.9, 5);
    g.fillStyle(o.color ?? 0x3f2c1c); g.fillRect(x + 5, y - h * 0.84, w - 10, h * 1.74);
    const rows = 3;
    for (let i = 0; i < rows; i++) {
      const ry = y - h * 0.8 + i * (h * 1.66 / rows);
      g.fillStyle(WOOD); g.fillRect(x + 4, ry + h * 0.44, w - 8, 6);
      for (let b = 0; b < 5; b++) {                                                           // goods on the shelf
        const bw = (w - 20) / 5;
        g.fillStyle([0xe8483c, 0x5bb6e8, 0xffc247, 0x6fd08c, 0xb48cff][(i + b) % 5]);
        g.fillRoundedRect(x + 10 + b * bw, ry + h * 0.1, bw - 5, h * 0.34, 3);
      }
    }
  },

  clothesRack(g, x, y, w, h, o = {}) {
    const cx = x + w / 2;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w, 14);
    g.fillStyle(0x9aa7b8); g.fillRect(x + 4, y - h * 0.7, 7, h * 1.7); g.fillRect(x + w - 11, y - h * 0.7, 7, h * 1.7);
    g.fillStyle(0xb8c4d0); g.fillRoundedRect(x, y - h * 0.72, w, 8, 4);
    const n = Math.max(3, Math.floor(w / 34));
    for (let i = 0; i < n; i++) {
      const gx = x + 16 + i * ((w - 30) / (n - 1 || 1)), c = [o.color ?? 0x2a9d8f, 0xe8483c, 0xffc247, 0x5bb6e8, 0xb48cff][i % 5];
      g.lineStyle(3, 0xdfe8ef); g.lineBetween(gx, y - h * 0.68, gx, y - h * 0.5);
      g.fillStyle(c); g.fillRoundedRect(gx - 13, y - h * 0.5, 26, h * 1.05, 6);
      g.fillStyle(0xffffff, 0.22); g.fillRoundedRect(gx - 10, y - h * 0.44, 9, h * 0.8, 4);
    }
  },

  sofa(g, x, y, w, h, o = {}) {
    const cx = x + w / 2, c = o.color ?? 0xe9a23b;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w + 10, 14);
    g.fillStyle(c); g.fillRoundedRect(x, y - h * 0.5, w, h * 1.4, 12);
    g.fillStyle(0x00000022); g.fillRoundedRect(x + 8, y - h * 0.3, w - 16, h * 0.7, 9);
    g.fillStyle(0xffffff, 0.25); g.fillRoundedRect(x + 10, y - h * 0.26, (w - 16) / 2 - 6, h * 0.6, 8);
    g.fillStyle(c); g.fillRoundedRect(x - 5, y - h * 0.2, 18, h * 1.1, 8); g.fillRoundedRect(x + w - 13, y - h * 0.2, 18, h * 1.1, 8);
    g.fillStyle(WOOD_D); g.fillRect(x + 8, y + h * 0.85, 8, 10); g.fillRect(x + w - 16, y + h * 0.85, 8, 10);
  },

  bed(g, x, y, w, h) {
    const cx = x + w / 2;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w + 10, 14);
    g.fillStyle(WOOD_D); g.fillRoundedRect(x, y - h * 0.75, w, h * 1.7, 8);
    g.fillStyle(0xf4fbff); g.fillRoundedRect(x + 5, y - h * 0.4, w - 10, h * 1.2, 7);
    g.fillStyle(0x5bb6e8); g.fillRoundedRect(x + 5, y + h * 0.1, w - 10, h * 0.7, 7);
    g.fillStyle(0xffffff); g.fillRoundedRect(x + 12, y - h * 0.33, w - 24, h * 0.34, 7);
    g.fillStyle(0xdfe8ef); g.fillRoundedRect(x + 16, y - h * 0.28, w - 32, h * 0.2, 6);
  },

  plant(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, base + 4, w, 12);
    g.fillStyle(0xb5703f); g.fillRoundedRect(cx - w * 0.3, base - h * 0.5, w * 0.6, h * 0.55, 5);
    g.fillStyle(0xc98350); g.fillRoundedRect(cx - w * 0.34, base - h * 0.55, w * 0.68, 10, 4);
    g.fillStyle(0x2a8a63);
    [[-0.3, 0.9, 0.5], [0.3, 0.95, 0.5], [0, 1.25, 0.55]].forEach(([dx, dy, sw]) =>
      g.fillEllipse(cx + w * dx, base - h * dy, w * sw, h * 0.75));
    g.fillStyle(0x3fae7e); g.fillEllipse(cx - w * 0.1, base - h * 1.05, w * 0.4, h * 0.5);
  },

  books(g, x, y, w, h) {
    const cx = x + w / 2;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w, 12);
    g.fillStyle(WOOD_D); g.fillRoundedRect(x, y - h * 0.5, w, h * 1.4, 5);
    const colors = [0xe8483c, 0x5bb6e8, 0xffc247, 0x6fd08c, 0xb48cff, 0xff8a7a];
    for (let i = 0; i < 6; i++) {
      const bw = (w - 14) / 6, bh = h * (0.9 + (i % 3) * 0.12);
      g.fillStyle(colors[i]); g.fillRoundedRect(x + 7 + i * bw, y + h * 0.75 - bh, bw - 3, bh, 2);
      g.fillStyle(0xffffff, 0.35); g.fillRect(x + 8 + i * bw, y + h * 0.75 - bh + 4, bw - 7, 3);
    }
  },

  desk(g, x, y, w, h) {
    const cx = x + w / 2;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w + 10, 14);
    g.fillStyle(WOOD_D); g.fillRoundedRect(x, y + 8, w, h - 6, 5);
    g.fillStyle(WOOD); g.fillRoundedRect(x - 5, y, w + 10, 14, 6);
    g.fillStyle(0xf4fbff); g.fillRoundedRect(cx - w * 0.3, y - 8, w * 0.44, 16, 3);          // open book
    g.fillStyle(0xdfe8ef); g.fillRect(cx - 2, y - 8, 4, 16);
    g.fillStyle(0x3a3f4b); g.fillRect(cx + w * 0.2, y - 12, 3, 16);                          // pen
    g.fillStyle(0xffc247); g.fillCircle(cx + w * 0.3, y - 2, 5);                             // lamp spot
  },

  charts(g, x, y, w, h) {
    g.fillStyle(WOOD_D); g.fillRoundedRect(x - 5, y - 5, w + 10, h + 10, 6);
    g.fillStyle(0xd8c9a3); g.fillRect(x, y, w, h);
    g.lineStyle(3, 0x7a6a4a, 0.8);
    g.strokeEllipse(x + w * 0.4, y + h * 0.5, w * 0.6, h * 0.55);
    g.lineBetween(x + 6, y + h * 0.75, x + w - 6, y + h * 0.3);
    g.fillStyle(0x3d5a80, 0.45); g.fillEllipse(x + w * 0.7, y + h * 0.7, w * 0.45, h * 0.4);
    g.fillStyle(0xe8483c); g.fillCircle(x + w * 0.3, y + h * 0.4, 4);
  },

  telescope(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    g.fillStyle(INK, 0.18); g.fillEllipse(cx, base + 4, w + 10, 16);
    g.fillStyle(0x4a5b6b); g.fillTriangle(cx, base - h * 0.5, cx - w * 0.35, base, cx + w * 0.35, base);   // tripod
    g.fillStyle(0x6a4fb3); g.fillRoundedRect(cx - w * 0.1, base - h * 0.75, w * 0.2, h * 0.3, 5);
    g.save?.();
    g.fillStyle(0xc9a227);                                                                   // brass tube, angled
    g.fillTriangle(cx - w * 0.42, base - h * 0.62, cx + w * 0.48, base - h * 1.25, cx + w * 0.44, base - h * 0.95);
    g.fillTriangle(cx - w * 0.42, base - h * 0.62, cx - w * 0.38, base - h * 0.34, cx + w * 0.44, base - h * 0.95);
    g.fillStyle(0xe6c252); g.fillEllipse(cx + w * 0.44, base - h * 1.1, w * 0.2, h * 0.26);
    g.fillStyle(0x16304a); g.fillEllipse(cx + w * 0.46, base - h * 1.11, w * 0.13, h * 0.17);
    g.restore?.();
  },

  dial(g, x, y, w, h, o = {}) {
    const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
    g.fillStyle(INK, 0.18); g.fillEllipse(cx, y + h + 4, w, 14);
    g.fillStyle(0x7a6a4a); g.fillCircle(cx, cy, r);
    g.fillStyle(o.color ?? 0xc9a227); g.fillCircle(cx, cy, r - 5);
    g.fillStyle(0xf4fbff); g.fillCircle(cx, cy, r - 13);
    g.lineStyle(4, 0x16304a);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.lineBetween(cx + Math.cos(a) * (r - 16), cy + Math.sin(a) * (r - 16), cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10));
    }
    g.fillStyle(0xe8483c); g.fillTriangle(cx, cy - r + 14, cx - 5, cy + 3, cx + 5, cy + 3);
    g.fillStyle(0x16304a); g.fillCircle(cx, cy, 4);
  },

  scroll(g, x, y, w, h) {
    g.fillStyle(INK, 0.16); g.fillEllipse(x + w / 2, y + h + 4, w, 12);
    g.fillStyle(0xeee3c8); g.fillRoundedRect(x, y + 6, w, h - 12, 4);
    g.fillStyle(0xd8c9a3); g.fillRoundedRect(x, y, w, 12, 6); g.fillRoundedRect(x, y + h - 12, w, 12, 6);
    g.lineStyle(3, 0x8a7a5a, 0.8);
    for (let i = 1; i < 4; i++) g.lineBetween(x + 8, y + 10 + i * ((h - 24) / 4), x + w - 8, y + 10 + i * ((h - 24) / 4));
    g.fillStyle(0x3d5a80); g.fillCircle(x + w * 0.3, y + h * 0.42, 4); g.fillCircle(x + w * 0.62, y + h * 0.6, 4);
  },

  globe(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h, r = Math.min(w, h) * 0.42;
    g.fillStyle(INK, 0.18); g.fillEllipse(cx, base + 4, w, 14);
    g.fillStyle(WOOD_D); g.fillRoundedRect(cx - 6, base - h * 0.3, 12, h * 0.3, 4);
    g.fillStyle(0xc9a227); g.fillRoundedRect(cx - w * 0.28, base - 8, w * 0.56, 10, 5);
    g.fillStyle(0x3b82d9); g.fillCircle(cx, base - h * 0.52, r);
    g.fillStyle(0x6fd08c); g.fillEllipse(cx - r * 0.3, base - h * 0.6, r * 0.8, r * 0.5);
    g.fillStyle(0x6fd08c); g.fillEllipse(cx + r * 0.35, base - h * 0.42, r * 0.6, r * 0.42);
    g.lineStyle(4, 0xc9a227); g.strokeCircle(cx, base - h * 0.52, r + 3);
  },

  orrery(g, x, y, w, h) {
    const cx = x + w / 2, base = y + h;
    g.fillStyle(INK, 0.2); g.fillEllipse(cx, base + 4, w, 16);
    g.fillStyle(WOOD_D); g.fillRoundedRect(cx - 10, base - h * 0.45, 20, h * 0.45, 5);
    g.lineStyle(4, 0xc9a227, 0.9);
    g.strokeEllipse(cx, base - h * 0.62, w * 0.9, h * 0.34);
    g.strokeEllipse(cx, base - h * 0.62, w * 0.55, h * 0.2);
    g.fillStyle(0xffc247); g.fillCircle(cx, base - h * 0.62, 11);
    g.fillStyle(0x5bb6e8); g.fillCircle(cx + w * 0.45, base - h * 0.62, 7);
    g.fillStyle(0xe8483c); g.fillCircle(cx - w * 0.27, base - h * 0.55, 5);
    g.fillStyle(0xb48cff); g.fillCircle(cx + w * 0.2, base - h * 0.72, 4);
  },

  ladder(g, x, y, w, h) {
    g.fillStyle(WOOD_D); g.fillRect(x + 2, y - h * 0.4, 8, h * 1.4); g.fillRect(x + w - 10, y - h * 0.4, 8, h * 1.4);
    g.fillStyle(WOOD);
    for (let i = 0; i < 5; i++) g.fillRect(x + 2, y - h * 0.3 + i * (h * 1.1 / 5), w - 4, 6);
  },

  bucket(g, x, y, w, h) {
    const cx = x + w / 2;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w, 12);
    g.fillStyle(0x7d8c97); g.fillTriangle(x + 2, y + 6, x + w - 2, y + 6, cx, y + h);
    g.fillStyle(0x9aa7b8); g.fillRoundedRect(x, y, w, 12, 5);
    g.lineStyle(4, 0x5e6b76); g.beginPath(); g.arc(cx, y + 2, w * 0.42, Math.PI, 0, true); g.strokePath();
  },

  toolbox(g, x, y, w, h) {
    const cx = x + w / 2;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w, 12);
    g.fillStyle(0xe8483c); g.fillRoundedRect(x, y + 8, w, h - 6, 5);
    g.fillStyle(0xc4382d); g.fillRect(x, y + h * 0.5, w, 5);
    g.lineStyle(5, 0x3a3f4b); g.beginPath(); g.arc(cx, y + 6, w * 0.3, Math.PI, 0, true); g.strokePath();
    g.fillStyle(0xffc247); g.fillRect(x + 6, y + 12, 10, 6);
  },

  clock(g, x, y, w, h) {
    const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.42;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w, 12);
    g.fillStyle(WOOD_D); g.fillRoundedRect(x, y, w, h, 8);
    g.fillStyle(0xf4fbff); g.fillCircle(cx, cy, r);
    g.lineStyle(4, 0x16304a); g.lineBetween(cx, cy, cx, cy - r * 0.62); g.lineBetween(cx, cy, cx + r * 0.45, cy + r * 0.2);
    g.fillStyle(0x16304a); g.fillCircle(cx, cy, 3);
  },

  cup(g, x, y, w, h) {                                                                       // café table with a hot drink
    const cx = x + w / 2;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w + 8, 14);
    g.fillStyle(WOOD_D); g.fillRect(cx - 7, y + 14, 14, h - 10);
    g.fillStyle(WOOD_L); g.fillEllipse(cx, y + 14, w, 20);
    g.fillStyle(0xdbc19d); g.fillEllipse(cx, y + 11, w - 10, 15);
    g.fillStyle(0xf4fbff); g.fillRoundedRect(cx - 13, y - 2, 26, 17, 5);                      // mug
    g.fillStyle(0x6b4428); g.fillEllipse(cx, y + 1, 19, 7);
    g.lineStyle(4, 0xf4fbff); g.strokeCircle(cx + 17, y + 7, 6);
    g.fillStyle(0xffffff, 0.5); g.fillCircle(cx - 3, y - 10, 4); g.fillCircle(cx + 4, y - 16, 3);
  },

  cake(g, x, y, w, h) {
    const cx = x + w / 2;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w + 8, 14);
    g.fillStyle(WOOD_D); g.fillRect(cx - 7, y + 16, 14, h - 12);
    g.fillStyle(0xf4fbff); g.fillEllipse(cx, y + 16, w, 18);
    g.fillStyle(0xffd3e0); g.fillRoundedRect(cx - w * 0.3, y, w * 0.6, 18, 4);
    g.fillStyle(0xfff0f5); g.fillRoundedRect(cx - w * 0.3, y - 4, w * 0.6, 8, 4);
    g.fillStyle(0xe8483c); g.fillCircle(cx, y - 7, 5);
  },

  xmastree(g, x, y, w, h) {                                                                  // the decorated town tree
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 4, w + 20, 18);
    g.fillStyle(WOOD_D); g.fillRoundedRect(cx - w * 0.3, base - h * 0.22, w * 0.6, h * 0.28, 5);  // planter
    g.fillStyle(WOOD_L); g.fillRoundedRect(cx - w * 0.34, base - h * 0.26, w * 0.68, 12, 5);
    for (let i = 0; i < 4; i++) {                                                            // tiers
      const t = i / 4, cy = base - h * (0.2 + t * 1.5), hw = (w * 0.62) * (1 - t * 0.5);
      g.fillStyle(i % 2 ? 0x1b5f46 : 0x1f6b4f); g.fillTriangle(cx, cy - h * 0.55, cx - hw, cy, cx + hw, cy);
      g.fillStyle(SNOW, 0.9); g.fillTriangle(cx, cy - h * 0.55, cx - hw * 0.45, cy - h * 0.2, cx + hw * 0.45, cy - h * 0.2);
    }
    [[-0.22, 0.5, 0xe8483c], [0.2, 0.72, 0xffc247], [-0.12, 1.0, 0x5bb6e8], [0.16, 1.24, 0xb48cff],
     [-0.05, 1.5, 0x6fd08c]].forEach(([dx, dy, c]) => { g.fillStyle(c); g.fillCircle(cx + w * dx, base - h * dy, 5); });
    g.fillStyle(0xffd977); g.fillCircle(cx, base - h * 1.88, 8);
    g.fillStyle(SNOW); g.fillCircle(cx, base - h * 1.88, 4);
  },

  fountain(g, x, y, w, h) {                                                                  // frozen mid-splash
    const cx = x + w / 2, cy = y + h / 2;
    shadow(g, cx, y + h + 4, w + 16, 16);
    g.fillStyle(0x9fb6c6); g.fillEllipse(cx, cy, w + 16, h + 12);
    g.fillStyle(0xdfeefb); g.fillEllipse(cx, cy, w + 4, h + 2);
    g.fillStyle(0x8fd3f0); g.fillEllipse(cx, cy, w * 0.78, h * 0.68);
    g.fillStyle(0x9fb6c6); g.fillRoundedRect(cx - w * 0.07, cy - h * 0.55, w * 0.14, h * 0.6, 4);
    g.fillStyle(0xbfe8fb, 0.95);                                                             // frozen jets
    g.fillTriangle(cx, cy - h * 0.95, cx - w * 0.2, cy - h * 0.2, cx + w * 0.2, cy - h * 0.2);
    g.fillStyle(SNOW, 0.9); g.fillEllipse(cx, cy - h * 0.95, w * 0.22, 10);
    g.fillStyle(0xffc247); g.fillCircle(cx - w * 0.22, cy + h * 0.12, 3.5); g.fillCircle(cx + w * 0.26, cy + h * 0.2, 3);
  },

  vault(g, x, y, w, h) {                                                                   // Phase 14: the sealed crate
    const cx = x + w / 2, base = y + h;
    shadow(g, cx, base + 3, w + 16, 16);
    g.fillStyle(0x3a2616); g.fillRoundedRect(x, y, w, h, 7);
    g.fillStyle(0x6b4428); g.fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 5);
    g.fillStyle(0x7d5536); g.fillRoundedRect(x + 6, y + 6, w - 12, h * 0.34, 4);
    g.fillStyle(0x9aa7b8); g.fillRect(x + 2, y + h * 0.44, w - 4, 9);                       // iron bands
    g.fillRect(x + w * 0.44, y + 2, 10, h - 4);
    g.fillStyle(0xb8c4d0); g.fillRect(x + 2, y + h * 0.44, w - 4, 3);
    const sx = cx, sy = y + h * 0.62, R = Math.min(w, h) * 0.17;                            // the star lock
    g.fillStyle(0x0a1cf0, 0.18); g.fillCircle(sx, sy, R * 1.7);
    for (const flip of [0, 1]) {
      const p0 = [0, 1, 2].map((i) => {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 3) + (flip ? Math.PI / 3 : 0);
        return { x: sx + Math.cos(a) * R, y: sy + Math.sin(a) * R };
      });
      g.lineStyle(3, 0x0a1cf0, 1);
      g.beginPath(); g.moveTo(p0[0].x, p0[0].y); g.lineTo(p0[1].x, p0[1].y); g.lineTo(p0[2].x, p0[2].y); g.closePath(); g.strokePath();
    }
    // Phase 16: the keypad, bolted on under the star lock
    const kx = cx - w * 0.16, ky = y + h * 0.1;
    g.fillStyle(0x1b2a41); g.fillRoundedRect(kx, ky, w * 0.32, h * 0.36, 4);
    g.fillStyle(0x8ff0b3); g.fillRect(kx + 3, ky + 3, w * 0.26, h * 0.07);          // little green display
    g.fillStyle(0x4a5b6b);
    for (let r = 0; r < 3; r++) for (let c2 = 0; c2 < 3; c2++) {
      g.fillRect(kx + 4 + c2 * (w * 0.095), ky + h * 0.14 + r * (h * 0.068), w * 0.07, h * 0.045);
    }
    g.fillStyle(SNOW, 0.9); g.fillRoundedRect(x + 2, y - 6, w - 4, 10, 5);
  },

  // Phase 17: a standing character (used for the one hidden visitor in the world).
  character(g, x, y, w, h, o = {}) {
    const cx = x + w / 2, base = y + h, bw = w * 0.86, bh = h * 0.92;
    shadow(g, cx, base + 2, bw + 10, 14);
    g.fillStyle(0x1b2a41); g.fillEllipse(cx, base - bh * 0.46, bw, bh);                   // body
    g.fillStyle(o.color ?? 0x3b4a63); g.fillEllipse(cx, base - bh * 0.46, bw - 7, bh - 7);
    g.fillStyle(0xf4fbff); g.fillEllipse(cx, base - bh * 0.34, bw * 0.56, bh * 0.56);     // belly
    g.fillStyle(0x1b2a41); g.fillCircle(cx - bw * 0.15, base - bh * 0.7, 4.5); g.fillCircle(cx + bw * 0.15, base - bh * 0.7, 4.5);
    g.fillStyle(0xffffff); g.fillCircle(cx - bw * 0.17, base - bh * 0.73, 1.7); g.fillCircle(cx + bw * 0.13, base - bh * 0.73, 1.7);
    g.fillStyle(0xff9a3c); g.fillTriangle(cx, base - bh * 0.6, cx - 6, base - bh * 0.66, cx + 6, base - bh * 0.66);
    g.fillStyle(0x16304a); g.fillEllipse(cx - bw * 0.24, base - 2, 15, 7); g.fillEllipse(cx + bw * 0.24, base - 2, 15, 7);
    // headset
    g.fillStyle(0x2b3a47); g.fillRoundedRect(cx - bw * 0.34, base - bh * 0.96, bw * 0.68, 7, 4);
    g.fillStyle(0xe8483c); g.fillEllipse(cx - bw * 0.34, base - bh * 0.8, 13, 17); g.fillEllipse(cx + bw * 0.34, base - bh * 0.8, 13, 17);
    g.fillStyle(0x2b3a47); g.fillEllipse(cx - bw * 0.34, base - bh * 0.8, 8, 11); g.fillEllipse(cx + bw * 0.34, base - bh * 0.8, 8, 11);
    g.fillStyle(0xffc247); g.fillCircle(cx + bw * 0.4, base - bh * 0.62, 3);
  },

  snowGlobeProp(g, x, y, w, h) {                                                             // generic "nice thing on a stand"
    const cx = x + w / 2;
    g.fillStyle(INK, 0.16); g.fillEllipse(cx, y + h + 4, w, 12);
    g.fillStyle(WOOD_D); g.fillRoundedRect(cx - w * 0.3, y + h * 0.55, w * 0.6, h * 0.45, 5);
    g.fillStyle(0xbfe8fb, 0.85); g.fillCircle(cx, y + h * 0.4, Math.min(w, h) * 0.38);
    g.fillStyle(SNOW); g.fillCircle(cx, y + h * 0.45, Math.min(w, h) * 0.12);
  },
};

// =====================================================================
// Label → sprite. The rooms, shops and interactions of Phases 1-12 identify their objects with an emoji in the
// label; rather than rewrite all that data, this maps those emoji onto the sprites above. Anything unknown falls
// back to a wooden crate, which still reads as an object rather than a coloured rectangle.
// =====================================================================
const BY_EMOJI = {
  '⛺': 'tent', '🔥': 'campfire', '🌨️': 'snowpile', '🪧': 'sign', '📋': 'noticeboard', '📦': 'crate',
  '🐟': 'crate', '🛷': 'sled', '🚩': 'flag', '🔔': 'bell', '💡': 'lantern', '🏮': 'lantern', '🪢': 'post',
  '⛵': 'boat', '⛸️': 'skates', '🪨': 'cairn', '⛰️': 'cairn', '🫐': 'berries', '🔹': 'glyph', '💎': 'crystalCluster',
  '💠': 'icehole', '🕳️': 'icehole', '🫧': 'bubble', '〰️': 'bubble', '☕': 'cup', '🍰': 'cake', '🧥': 'clothesRack',
  '👕': 'clothesRack', '👖': 'clothesRack', '🎩': 'clothesRack', '🧣': 'clothesRack', '👟': 'shelf', '🛋️': 'sofa',
  '🛏️': 'bed', '🪴': 'plant', '📚': 'books', '📖': 'desk', '🪶': 'desk', '🗞️': 'scroll', '📜': 'scroll',
  '🗺️': 'charts', '🧭': 'dial', '🔭': 'telescope', '🌍': 'globe', '🪐': 'orrery', '🪜': 'ladder', '🪣': 'bucket',
  '🧰': 'toolbox', '🕰️': 'clock', '🧶': 'books', '🧸': 'snowGlobeProp', '🎈': 'snowGlobeProp', '🎟️': 'crate',
  '🏀': 'snowGlobeProp', '🪑': 'sofa', '🧊': 'crystalCluster', '💧': 'crystalCluster', '🌀': 'ladder',
  '🎄': 'xmastree', '⛲': 'fountain', '🔊': 'bubble', '🌲': 'plant', '🏘️': 'crate',
};

// The first emoji (or two-code-point emoji) in a label, if any.
const firstEmoji = (s = '') => {
  const m = String(s).match(/\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️|⃣)*/u);
  return m ? m[0] : null;
};

export function spriteFor(nameOrLabel, fallback = 'crate') {
  if (!nameOrLabel) return fallback;
  if (SPRITES[nameOrLabel]) return nameOrLabel;                       // an explicit `art: 'tent'`
  const e = firstEmoji(nameOrLabel);
  if (e && BY_EMOJI[e]) return BY_EMOJI[e];
  if (e) {                                                            // some emoji carry a variation selector
    const bare = e.replace(/️/g, '');
    for (const [k, v] of Object.entries(BY_EMOJI)) if (k.replace(/️/g, '') === bare) return v;
  }
  return fallback;
}

// Draw by name. Returns true when something was drawn, so callers can fall back to their old look if they want.
export function drawSprite(g, name, x, y, w, h, opts = {}) {
  const fn = SPRITES[name];
  if (!fn) return false;
  fn(g, x, y, w, h, opts);
  return true;
}

// Strip the emoji out of a label so the text under a sprite reads as a caption, not a duplicate of the picture.
export const captionOf = (label = '') =>
  String(label).replace(/\p{Extended_Pictographic}(‍\p{Extended_Pictographic}|️|⃣)*/gu, '').trim();
