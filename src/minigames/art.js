// All minigame art is drawn procedurally (like the rest of Anchors World): zero external assets, tiny memory footprint.
// Textures are generated ONCE per game session and shared by every minigame scene.
const INK = 0x1b2a41;

function snowman(g, w, body, accent) {
  const cx = w / 2;
  g.lineStyle(3, INK);
  g.fillStyle(body); g.fillCircle(cx, 52, 19); g.strokeCircle(cx, 52, 19);
  g.fillCircle(cx, 31, 14); g.strokeCircle(cx, 31, 14);
  g.fillCircle(cx, 15, 10); g.strokeCircle(cx, 15, 10);
  g.fillStyle(accent); g.fillRect(cx - 12, 26, 24, 6);                      // scarf
  g.fillStyle(INK); g.fillRect(cx - 12, 1, 24, 4); g.fillRect(cx - 8, -4, 16, 8); // hat (clips a little: fine)
  g.fillCircle(cx - 4, 13, 1.6); g.fillCircle(cx + 4, 13, 1.6);
  g.fillStyle(0xff9a3c); g.fillTriangle(cx, 15, cx + 11, 18, cx, 19);        // carrot
  g.fillStyle(INK); g.fillCircle(cx, 38, 1.8); g.fillCircle(cx, 46, 1.8);
}

function pine(g, x, y, s) {
  g.fillStyle(0x6b4428); g.fillRect(x - 3 * s, y - 10 * s, 6 * s, 10 * s);
  for (let i = 0; i < 3; i++) {
    const cy = y - 12 * s - i * 17 * s, hw = (26 - i * 6) * s;
    g.fillStyle(0x1f6b4f); g.fillTriangle(x, cy - 24 * s, x - hw, cy + 8 * s, x + hw, cy + 8 * s);
    g.fillStyle(0xffffff); g.fillTriangle(x, cy - 24 * s, x - hw * 0.55, cy - 6 * s, x + hw * 0.55, cy - 6 * s);
  }
}

function sky(scene, key, top, bottom) {
  const c = scene.textures.createCanvas(key, 4, 540), ctx = c.getContext();
  const gr = ctx.createLinearGradient(0, 0, 0, 540); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  ctx.fillStyle = gr; ctx.fillRect(0, 0, 4, 540); c.refresh();
}

export function makeMinigameTextures(scene) {
  if (scene.textures.exists('mg_ready')) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const gen = (key, w, h, draw) => { g.clear(); draw(g); g.generateTexture(key, w, h); };
  let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // ---------- Snow Dash ----------
  gen('mg_sled', 64, 30, (g) => {
    g.lineStyle(3, INK); g.fillStyle(0xb9814f); g.fillRoundedRect(6, 6, 52, 14, 6); g.strokeRoundedRect(6, 6, 52, 14, 6);
    g.fillStyle(0x9aa7b8); g.fillRoundedRect(1, 21, 62, 6, 3); g.strokeRoundedRect(1, 21, 62, 6, 3);
    g.fillStyle(0xe8483c); g.fillRect(16, 7, 6, 12); g.fillRect(42, 7, 6, 12);
  });
  gen('mg_rock', 56, 44, (g) => {
    g.lineStyle(3, INK); g.fillStyle(0x8793a6); g.fillEllipse(28, 26, 52, 34); g.strokeEllipse(28, 26, 52, 34);
    g.fillStyle(0xaab5c6); g.fillEllipse(22, 20, 22, 12); g.fillStyle(0xffffff); g.fillEllipse(30, 12, 34, 12);
  });
  gen('mg_snowman', 48, 72, (g) => snowman(g, 48, 0xffffff, 0xe8483c));
  gen('mg_ice', 120, 56, (g) => {
    g.fillStyle(0x7fcdf0, 0.9); g.fillEllipse(60, 28, 112, 46); g.lineStyle(3, 0xd9f2ff); g.strokeEllipse(60, 28, 112, 46);
    g.lineStyle(3, 0xffffff, 0.9); g.lineBetween(26, 24, 54, 16); g.lineBetween(62, 36, 94, 26);
  });
  gen('mg_boost', 64, 64, (g) => {
    g.lineStyle(3, INK); g.fillStyle(0xff9a3c); g.fillRoundedRect(4, 4, 56, 56, 14); g.strokeRoundedRect(4, 4, 56, 56, 14);
    g.fillStyle(0xffffff); for (const y of [14, 32]) g.fillTriangle(14, y, 50, y, 32, y + 16);
  });
  gen('mg_checker', 32, 32, (g) => { g.fillStyle(0xffffff); g.fillRect(0, 0, 32, 32); g.fillStyle(INK); g.fillRect(0, 0, 16, 16); g.fillRect(16, 16, 16, 16); });
  gen('mg_lane', 520, 128, (g) => {
    g.fillStyle(0xf4fbff); g.fillRect(0, 0, 520, 128);
    g.fillStyle(0xdcecf7); g.fillRect(176, 0, 7, 128); g.fillRect(337, 0, 7, 128);
    for (let i = 0; i < 46; i++) { g.fillStyle(i % 3 ? 0xffffff : 0xd5e8f4); g.fillCircle(rnd() * 520, rnd() * 128, 1 + rnd() * 2.2); }
  });
  for (const side of ['l', 'r']) {
    gen(`mg_edge_${side}`, 240, 320, (g) => {
      g.fillStyle(0xcfe6f4); g.fillRect(0, 0, 240, 320);
      const bank = side === 'l' ? 196 : 0; g.fillStyle(0xb9d8ea); g.fillRect(bank, 0, 44, 320);
      g.fillStyle(0xe9f4fb); for (let i = 0; i < 4; i++) g.fillEllipse(side === 'l' ? 214 : 26, 40 + i * 80, 40, 56);
      const spots = [[40, 80, 1], [140, 150, 0.8], [70, 235, 1.1], [150, 300, 0.9]];
      for (const [x, y, s] of spots) pine(g, side === 'l' ? x : 240 - x, y, s);
    });
  }

  // ---------- Coin Catcher ----------
  gen('mg_flakec', 28, 28, (g) => {
    g.lineStyle(3, INK); g.fillStyle(0x9fe0ff); g.fillCircle(14, 14, 11); g.strokeCircle(14, 14, 11);
    g.lineStyle(2, 0xffffff); for (let a = 0; a < 3; a++) { const r = (a * Math.PI) / 3; g.lineBetween(14 - Math.cos(r) * 7, 14 - Math.sin(r) * 7, 14 + Math.cos(r) * 7, 14 + Math.sin(r) * 7); }
  });
  gen('mg_coin', 32, 32, (g) => {
    g.lineStyle(3, INK); g.fillStyle(0xffc247); g.fillCircle(16, 16, 13); g.strokeCircle(16, 16, 13);
    g.lineStyle(2, 0xc97f12); g.strokeCircle(16, 16, 8); g.fillStyle(0xfff2b0); g.fillCircle(11, 11, 3); g.fillStyle(0xc97f12); g.fillRect(14, 10, 4, 12);
  });
  gen('mg_gem', 34, 38, (g) => {
    const pts = [{ x: 17, y: 36 }, { x: 2, y: 14 }, { x: 9, y: 3 }, { x: 25, y: 3 }, { x: 32, y: 14 }];
    g.fillStyle(0xff6fae); g.fillPoints(pts, true); g.lineStyle(3, INK); g.strokePoints(pts, true);
    g.fillStyle(0xffb3d4); g.fillTriangle(9, 3, 25, 3, 17, 14); g.lineStyle(2, INK, 0.6); g.lineBetween(2, 14, 32, 14); g.lineBetween(9, 3, 17, 14); g.lineBetween(25, 3, 17, 14);
  });
  gen('mg_bomb', 40, 40, (g) => {
    g.fillStyle(0x3b4a66); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.fillTriangle(20 + Math.cos(a - 0.3) * 13, 20 + Math.sin(a - 0.3) * 13, 20 + Math.cos(a + 0.3) * 13, 20 + Math.sin(a + 0.3) * 13, 20 + Math.cos(a) * 19, 20 + Math.sin(a) * 19); }
    g.lineStyle(3, INK); g.fillStyle(0x56688c); g.fillCircle(20, 20, 13); g.strokeCircle(20, 20, 13);
    g.fillStyle(0xffffff); g.fillCircle(15, 18, 3.5); g.fillCircle(25, 18, 3.5); g.fillStyle(INK); g.fillCircle(15, 19, 1.6); g.fillCircle(25, 19, 1.6);
    g.lineStyle(3, 0xe8483c); g.lineBetween(11, 12, 18, 15); g.lineBetween(29, 12, 22, 15);
  });
  gen('mg_icicle', 22, 52, (g) => {
    g.lineStyle(3, INK); g.fillStyle(0x9fe0ff); g.fillTriangle(2, 2, 20, 2, 11, 50); g.strokeTriangle(2, 2, 20, 2, 11, 50);
    g.fillStyle(0xffffff, 0.8); g.fillTriangle(5, 4, 9, 4, 8, 28);
  });
  gen('mg_basket', 78, 38, (g) => {
    g.lineStyle(3, INK); g.fillStyle(0xc99a5b); g.fillPoints([{ x: 6, y: 10 }, { x: 72, y: 10 }, { x: 64, y: 34 }, { x: 14, y: 34 }], true); g.strokePoints([{ x: 6, y: 10 }, { x: 72, y: 10 }, { x: 64, y: 34 }, { x: 14, y: 34 }], true);
    g.lineStyle(2, 0x8a6030); for (let x = 16; x < 68; x += 12) g.lineBetween(x, 12, x - 3, 33); g.lineBetween(10, 22, 68, 22);
    g.fillStyle(0xe0b877); g.fillEllipse(39, 9, 74, 14); g.lineStyle(3, INK); g.strokeEllipse(39, 9, 74, 14); g.fillStyle(0x6e4a22); g.fillEllipse(39, 10, 62, 8);
  });

  // ---------- Snowball Arena ----------
  gen('mg_ball', 18, 18, (g) => { g.lineStyle(2, INK); g.fillStyle(0xffffff); g.fillCircle(9, 9, 7); g.strokeCircle(9, 9, 7); g.fillStyle(0xcfe4f2); g.fillCircle(11, 12, 3); });
  gen('mg_bull', 52, 52, (g) => {
    g.lineStyle(3, INK); g.fillStyle(0xe8483c); g.fillCircle(26, 26, 23); g.strokeCircle(26, 26, 23);
    g.fillStyle(0xffffff); g.fillCircle(26, 26, 16); g.fillStyle(0xe8483c); g.fillCircle(26, 26, 9); g.fillStyle(0xffffff); g.fillCircle(26, 26, 3.5);
  });
  gen('mg_golden', 48, 72, (g) => snowman(g, 48, 0xffd45e, 0xff6fae));
  gen('mg_friend', 44, 54, (g) => {
    g.lineStyle(3, INK); g.fillStyle(0x4aa8ff); g.fillEllipse(22, 34, 34, 36); g.strokeEllipse(22, 34, 34, 36);
    g.fillStyle(0xf4fbff); g.fillEllipse(22, 38, 20, 24); g.fillStyle(0xffffff); g.fillCircle(17, 27, 4); g.fillCircle(27, 27, 4);
    g.fillStyle(INK); g.fillCircle(17, 28, 1.7); g.fillCircle(27, 28, 1.7); g.fillStyle(0xff9a3c); g.fillTriangle(18, 33, 26, 33, 22, 38);
    g.fillStyle(0x6fd08c); g.fillRect(8, 40, 28, 5); g.fillStyle(0xff9a3c); g.fillEllipse(14, 52, 12, 5); g.fillEllipse(30, 52, 12, 5);
    g.fillStyle(0xff6fae); g.fillCircle(18, 8, 5); g.fillCircle(26, 8, 5); g.fillTriangle(13, 10, 31, 10, 22, 21);   // heart: "friend"
  });
  gen('mg_cross', 36, 36, (g) => {
    g.lineStyle(3, 0xffffff, 0.95); g.strokeCircle(18, 18, 11); g.lineBetween(18, 1, 18, 9); g.lineBetween(18, 27, 18, 35); g.lineBetween(1, 18, 9, 18); g.lineBetween(27, 18, 35, 18);
    g.lineStyle(1.5, INK, 0.7); g.strokeCircle(18, 18, 13);
  });

  // ---------- shared ----------
  gen('mg_conf', 9, 9, (g) => { g.fillStyle(0xffffff); g.fillRect(0, 0, 9, 9); });
  gen('mg_dot', 6, 6, (g) => { g.fillStyle(0xffffff); g.fillCircle(3, 3, 3); });
  gen('mg_ground', 8, 8, (g) => { g.fillStyle(0xeaf5fc); g.fillRect(0, 0, 8, 8); });
  sky(scene, 'mg_sky_night', '#10213f', '#2f6a97');
  sky(scene, 'mg_sky_day', '#7fc8ee', '#e6f5fc');
  gen('mg_ready', 2, 2, () => {});
  g.destroy();
}
