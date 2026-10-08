// Procedural placeholder art for every cosmetic. Replace any entry with a loaded image of the same key later.
const INK = 0x1b2a41;
const ART = {};
const add = (id, w, h, fn) => (ART[id] = [w, h, fn]);

add('av_beak', 12, 9, (g) => { g.fillStyle(INK); g.fillTriangle(0, 0, 12, 0, 6, 9); g.fillStyle(0xff9a3c); g.fillTriangle(2, 1, 10, 1, 6, 7); });

// eyes (30x14)
const eyeBase = (g) => { g.fillStyle(0xffffff); g.fillCircle(8, 7, 6); g.fillCircle(22, 7, 6); };
add('eyes_0', 30, 14, (g) => { eyeBase(g); g.fillStyle(INK); g.fillCircle(9, 8, 3); g.fillCircle(21, 8, 3); });
add('eyes_1', 30, 14, (g) => { g.lineStyle(3, INK); [8, 22].forEach((x) => { g.beginPath(); g.arc(x, 10, 5, Math.PI, 0, false); g.strokePath(); }); });
add('eyes_2', 30, 14, (g) => { g.lineStyle(3, INK); g.lineBetween(3, 8, 13, 8); g.lineBetween(17, 8, 27, 8); g.lineBetween(3, 8, 1, 11); g.lineBetween(27, 8, 29, 11); });
add('eyes_3', 30, 14, (g) => { eyeBase(g); g.fillStyle(INK); g.fillCircle(8, 7, 4.5); g.fillCircle(22, 7, 4.5); g.fillStyle(0xffffff); g.fillCircle(6.5, 5.5, 1.8); g.fillCircle(20.5, 5.5, 1.8); g.fillCircle(9.5, 9, 1); g.fillCircle(23.5, 9, 1); });

// face extras (36x20; eyes sit at y=7)
add('face_blush', 36, 20, (g) => { g.fillStyle(0xff7f96, 0.75); g.fillEllipse(5, 15, 9, 5); g.fillEllipse(31, 15, 9, 5); });
add('face_freckles', 36, 20, (g) => { g.fillStyle(0x8a5a36); [[4, 14], [8, 16], [6, 12], [32, 14], [28, 16], [30, 12]].forEach(([x, y]) => g.fillCircle(x, y, 1.2)); });
add('face_glasses', 36, 20, (g) => { g.lineStyle(2.5, 0x2b2b2b); g.strokeCircle(11, 7, 7.5); g.strokeCircle(25, 7, 7.5); g.lineBetween(18, 6, 18, 6); g.lineBetween(17.5, 6, 18.5, 6); });
add('face_sunglasses', 36, 20, (g) => { g.fillStyle(0x15151c); g.fillRoundedRect(2, 1, 15, 11, 4); g.fillRoundedRect(19, 1, 15, 11, 4); g.fillRect(16, 3, 4, 2); g.fillStyle(0xffffff, 0.35); g.fillRect(5, 3, 4, 2); g.fillRect(22, 3, 4, 2); });

// hats (anchored at y=-50)
const beanie = (color) => (g) => {
  g.fillStyle(INK); g.fillEllipse(20, 20, 40, 32); g.fillStyle(color); g.fillEllipse(20, 19, 35, 28);
  g.fillStyle(0xffffff); g.fillRoundedRect(2, 19, 36, 9, 4); g.fillStyle(color); [8, 18, 28].forEach((x) => g.fillRect(x, 20, 4, 7));
  g.fillStyle(0xffffff); g.fillCircle(20, 4, 5);
};
add('hat_beanie', 40, 30, beanie(0xe8483c));
add('hat_beanie_blue', 40, 30, beanie(0x3b82d9));
add('hat_earmuffs', 54, 30, (g) => { g.lineStyle(4, 0x3a3f4b); g.beginPath(); g.arc(27, 26, 21, Math.PI, 0, false); g.strokePath(); g.fillStyle(INK); g.fillCircle(6, 24, 8); g.fillCircle(48, 24, 8); g.fillStyle(0xff7a8a); g.fillCircle(6, 24, 6); g.fillCircle(48, 24, 6); });
add('hat_party', 28, 38, (g) => { g.fillStyle(INK); g.fillTriangle(14, 0, -1, 38, 29, 38); g.fillStyle(0xc44fd8); g.fillTriangle(14, 4, 3, 36, 25, 36); g.fillStyle(0xffe066); g.fillRect(7, 22, 14, 4); g.fillRect(10, 12, 8, 4); g.fillCircle(14, 3, 4); });
add('hat_tophat', 38, 36, (g) => { g.fillStyle(0x20222b); g.fillRoundedRect(7, 2, 24, 26, 3); g.fillEllipse(19, 30, 38, 9); g.fillStyle(0xe8483c); g.fillRect(7, 20, 24, 5); });
add('hat_crown', 36, 26, (g) => { g.fillStyle(INK); g.fillRect(2, 8, 32, 17); g.fillTriangle(2, 8, 2, -1, 11, 8); g.fillTriangle(13, 8, 18, -1, 23, 8); g.fillTriangle(25, 8, 34, -1, 34, 8); g.fillStyle(0xffc247); g.fillRect(4, 10, 28, 13); g.fillTriangle(4, 10, 4, 2, 11, 10); g.fillTriangle(14, 10, 18, 2, 22, 10); g.fillTriangle(25, 10, 32, 2, 32, 10); g.fillStyle(0x66d9ff); g.fillCircle(18, 17, 3); g.fillStyle(0xff6b8a); g.fillCircle(8, 17, 2); g.fillCircle(28, 17, 2); });

// neck accessories (anchored at y=-16)
add('accessory_scarf', 44, 22, (g) => { g.fillStyle(0xd7392e); g.fillRoundedRect(2, 0, 40, 10, 5); g.fillRoundedRect(26, 6, 9, 15, 3); g.fillStyle(0xffffff); [8, 18, 28, 36].forEach((x) => g.fillRect(x, 1, 3, 8)); g.fillRect(26, 12, 9, 3); });
add('accessory_bowtie', 22, 12, (g) => { g.fillStyle(INK); g.fillTriangle(0, 0, 0, 12, 11, 6); g.fillTriangle(22, 0, 22, 12, 11, 6); g.fillStyle(0xe8483c); g.fillTriangle(1.5, 2, 1.5, 10, 9, 6); g.fillTriangle(20.5, 2, 20.5, 10, 13, 6); g.fillCircle(11, 6, 3); });
add('accessory_bell', 30, 18, (g) => { g.fillStyle(0x2f9e5b); g.fillRoundedRect(0, 0, 30, 6, 3); g.fillStyle(INK); g.fillCircle(15, 11, 7); g.fillStyle(0xffc247); g.fillCircle(15, 11, 5.5); g.fillStyle(INK); g.fillRect(14, 12, 2, 4); });

// shirts (38x22)
add('shirt_stripe', 38, 22, (g) => { g.fillStyle(0x2f6fb5); g.fillRoundedRect(0, 0, 38, 22, 9); g.fillStyle(0xffffff); g.fillRect(0, 6, 38, 4); g.fillRect(0, 14, 38, 4); });
add('shirt_hoodie', 38, 22, (g) => { g.fillStyle(0x6d7a8c); g.fillRoundedRect(0, 0, 38, 22, 9); g.fillStyle(0x56627a); g.fillRoundedRect(9, 11, 20, 9, 3); g.fillStyle(0xffffff); g.fillRect(14, 1, 2, 8); g.fillRect(22, 1, 2, 8); });
add('shirt_sweater', 38, 22, (g) => { g.fillStyle(0x2b3a67); g.fillRoundedRect(0, 0, 38, 22, 9); g.fillStyle(0xffffff); for (let x = 4; x < 36; x += 8) { g.fillTriangle(x, 11, x + 4, 6, x + 8, 11); g.fillTriangle(x, 11, x + 4, 16, x + 8, 11); } g.fillStyle(0xe8483c); g.fillRect(0, 1, 38, 2); });
add('shirt_tux', 38, 22, (g) => { g.fillStyle(0x20222b); g.fillRoundedRect(0, 0, 38, 22, 9); g.fillStyle(0xffffff); g.fillTriangle(12, 0, 26, 0, 19, 14); g.fillStyle(0xe8483c); g.fillCircle(19, 14, 2.5); });

// pants (36x14)
const pants = (color, seam) => (g) => { g.fillStyle(color); g.fillRoundedRect(0, 0, 36, 14, { tl: 2, tr: 2, bl: 7, br: 7 }); g.fillStyle(seam); g.fillRect(17, 2, 2, 12); };
add('pants_jeans', 36, 14, pants(0x3b5b92, 0x2a4270));
add('pants_cargo', 36, 14, (g) => { pants(0x5b7a3a, 0x465f2c)(g); g.fillStyle(0x465f2c); g.fillRect(4, 6, 8, 5); g.fillRect(24, 6, 8, 5); });
add('pants_snow', 36, 14, (g) => { pants(0xff7a3c, 0xd95d22)(g); g.fillStyle(0xffffff); g.fillRect(0, 9, 36, 2); });

// shoes (18x10) — drawn for each foot
add('shoes_boots', 18, 10, (g) => { g.fillStyle(INK); g.fillRoundedRect(0, 0, 18, 10, 4); g.fillStyle(0x8a5a36); g.fillRoundedRect(1.5, 1.5, 15, 6, 3); g.fillStyle(0x3a2616); g.fillRect(1.5, 7.5, 15, 2); });
add('shoes_sneakers', 18, 10, (g) => { g.fillStyle(INK); g.fillRoundedRect(0, 0, 18, 10, 4); g.fillStyle(0xffffff); g.fillRoundedRect(1.5, 1.5, 15, 7, 3); g.fillStyle(0xe8483c); g.fillRect(3, 4, 12, 2); });
add('shoes_skates', 18, 12, (g) => { g.fillStyle(INK); g.fillRoundedRect(0, 0, 18, 8, 4); g.fillStyle(0xffffff); g.fillRoundedRect(1.5, 1.5, 15, 5, 3); g.fillStyle(0xb8c4d0); g.fillRect(0, 9, 18, 2); g.fillRect(2, 7, 2, 3); g.fillRect(14, 7, 2, 3); });

// back items (behind body)
add('back_backpack', 52, 40, (g) => { g.fillStyle(INK); g.fillRoundedRect(0, 0, 52, 40, 12); g.fillStyle(0x8a5a36); g.fillRoundedRect(2, 2, 48, 36, 10); g.fillStyle(0x6b4428); g.fillRoundedRect(14, 22, 24, 14, 4); g.fillStyle(0xffc247); g.fillRect(24, 8, 4, 6); });
add('back_cape', 60, 54, (g) => { g.fillStyle(INK); g.fillPoints([{ x: 12, y: 0 }, { x: 48, y: 0 }, { x: 60, y: 54 }, { x: 0, y: 54 }], true); g.fillStyle(0xd7392e); g.fillPoints([{ x: 14, y: 3 }, { x: 46, y: 3 }, { x: 56, y: 50 }, { x: 4, y: 50 }], true); g.fillStyle(0xffc247); g.fillRect(8, 48, 44, 3); });
add('back_wings', 76, 48, (g) => { [[16, 1], [60, -1]].forEach(([cx]) => { g.fillStyle(INK); g.fillEllipse(cx, 24, 32, 46); g.fillStyle(0xe9f8ff); g.fillEllipse(cx, 24, 28, 42); g.fillStyle(0xa9dcf5); g.fillEllipse(cx, 28, 18, 28); }); });

// hand items (anchored right of body)
add('hand_snowball', 15, 15, (g) => { g.fillStyle(0xaac8dd); g.fillCircle(7.5, 7.5, 7.5); g.fillStyle(0xffffff); g.fillCircle(6.5, 6.5, 6); });
add('hand_icecream', 16, 30, (g) => { g.fillStyle(0xd9a05b); g.fillTriangle(2, 14, 14, 14, 8, 29); g.fillStyle(0xff9fc1); g.fillCircle(8, 9, 7); g.fillStyle(0xfff0f5); g.fillCircle(6, 7, 2); });
add('hand_balloon', 24, 56, (g) => { g.lineStyle(1.5, 0x666666); g.lineBetween(12, 30, 8, 55); g.fillStyle(INK); g.fillEllipse(12, 14, 24, 28); g.fillStyle(0xe8483c); g.fillEllipse(12, 14, 21, 25); g.fillStyle(0xffffff, 0.5); g.fillEllipse(8, 8, 5, 8); g.fillStyle(0xe8483c); g.fillTriangle(8, 31, 16, 31, 12, 26); });
add('hand_umbrella', 42, 44, (g) => { g.lineStyle(3, 0x555b66); g.lineBetween(21, 14, 21, 42); g.fillStyle(INK); g.fillEllipse(21, 14, 42, 26); g.fillStyle(0x3b82d9); g.fillEllipse(21, 14, 38, 22); g.fillStyle(0xffffff); g.fillRect(19, 3, 4, 12); g.fillStyle(0x3b82d9); g.fillRect(0, 14, 42, 12); });


// ---------------------------------------------------------------------
// Phase 9: the bigger wardrobe. Same `add(key, w, h, draw)` shape as everything above, same anchors from LAYOUT,
// so a new item is one entry here plus one line in src/shops/items.js (and one row in supabase/phase9.sql).
// ---------------------------------------------------------------------
add('eyes_4', 30, 14, (g) => { eyeBase(g); g.fillStyle(INK); g.fillCircle(8, 7, 4); g.fillCircle(22, 7, 4);
  g.fillStyle(0xffc247); [[8, 7], [22, 7]].forEach(([x, y]) => { g.fillTriangle(x, y - 5, x - 1.6, y, x + 1.6, y); g.fillTriangle(x, y + 5, x - 1.6, y, x + 1.6, y); g.fillTriangle(x - 5, y, x, y - 1.6, x, y + 1.6); g.fillTriangle(x + 5, y, x, y - 1.6, x, y + 1.6); }); });
add('eyes_5', 30, 14, (g) => { eyeBase(g); g.fillStyle(INK); g.fillCircle(8, 7, 3.2); g.fillStyle(0xffffff); g.fillCircle(7, 5.8, 1.3);
  g.lineStyle(3, INK); g.beginPath(); g.arc(22, 9, 5, Math.PI, 0, false); g.strokePath(); });
add('eyes_6', 30, 14, (g) => { g.fillStyle(INK); g.fillRoundedRect(0, 2, 30, 10, 5); g.fillStyle(0x66e8ff); g.fillRoundedRect(2, 4, 26, 6, 3);
  g.fillStyle(0xffffff, 0.75); g.fillRect(4, 5, 7, 2); });

add('face_mask', 36, 20, (g) => { g.fillStyle(0x3b5b92); g.fillRoundedRect(3, 10, 30, 10, 5); g.fillStyle(0x2a4270); g.fillRect(3, 13, 30, 2);
  g.fillStyle(0xffffff, 0.5); g.fillRect(6, 11, 6, 2); });
add('face_eyepatch', 36, 20, (g) => { g.fillStyle(INK); g.fillRect(0, 5, 36, 3); g.fillRoundedRect(19, 0, 14, 13, 4); g.fillStyle(0x2b2b2b); g.fillRoundedRect(20.5, 1.5, 11, 10, 3); });
add('face_warpaint', 36, 20, (g) => { g.fillStyle(0x5bb6e8); g.fillRoundedRect(3, 10, 5, 9, 2); g.fillRoundedRect(10, 11, 5, 8, 2);
  g.fillRoundedRect(21, 11, 5, 8, 2); g.fillRoundedRect(28, 10, 5, 9, 2); });

add('hat_ushanka', 52, 32, (g) => { g.fillStyle(INK); g.fillEllipse(26, 18, 46, 30); g.fillStyle(0x5a4635); g.fillEllipse(26, 17, 41, 26);
  g.fillStyle(0xd8c9a3); g.fillRoundedRect(4, 14, 44, 12, 6); g.fillStyle(INK); g.fillEllipse(5, 24, 12, 16); g.fillEllipse(47, 24, 12, 16);
  g.fillStyle(0xd8c9a3); g.fillEllipse(5, 24, 9, 13); g.fillEllipse(47, 24, 9, 13); g.fillStyle(0xe8483c); g.fillCircle(26, 12, 3.5); });
add('hat_viking', 58, 34, (g) => { g.fillStyle(INK); g.fillEllipse(29, 24, 38, 28); g.fillStyle(0x9aa7b8); g.fillEllipse(29, 23, 33, 24);
  g.fillStyle(0x7d8c97); g.fillRect(12, 20, 34, 5); g.fillStyle(0xf0e6cf); g.fillTriangle(10, 22, 0, 2, 16, 10); g.fillTriangle(48, 22, 58, 2, 42, 10);
  g.fillStyle(0xd8c9a3); g.fillTriangle(10, 20, 3, 6, 14, 11); g.fillTriangle(48, 20, 55, 6, 44, 11); });
add('hat_santa', 42, 36, (g) => { g.fillStyle(INK); g.fillTriangle(10, 26, 20, -1, 40, 18); g.fillStyle(0xe8483c); g.fillTriangle(12, 24, 20, 3, 36, 18);
  g.fillStyle(0xffffff); g.fillRoundedRect(2, 22, 36, 10, 5); g.fillCircle(38, 17, 5.5); });
add('hat_pilot', 48, 32, (g) => { g.fillStyle(INK); g.fillEllipse(24, 18, 42, 28); g.fillStyle(0x6b4428); g.fillEllipse(24, 17, 37, 24);
  g.fillStyle(0x4a3220); g.fillEllipse(6, 23, 11, 15); g.fillEllipse(42, 23, 11, 15);
  g.fillStyle(0x3a3f4b); g.fillRoundedRect(4, 8, 40, 10, 4); g.fillStyle(0x9fe3ff); g.fillCircle(14, 13, 4.4); g.fillCircle(34, 13, 4.4);
  g.fillStyle(0xffffff, 0.55); g.fillCircle(12.5, 11.5, 1.6); g.fillCircle(32.5, 11.5, 1.6); });
add('hat_flower', 40, 26, (g) => { g.fillStyle(0x2f9e5b); g.fillRoundedRect(2, 18, 36, 7, 4);
  [[12, 12], [26, 10]].forEach(([cx, cy]) => { g.fillStyle(0xfff0f5); [0, 1.26, 2.51, 3.77, 5.03].forEach((a) => g.fillCircle(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 3.6)); g.fillStyle(0xffc247); g.fillCircle(cx, cy, 3); }); });
add('hat_halo', 48, 26, (g) => { g.lineStyle(5, 0x8ff0b3, 0.55); g.strokeEllipse(24, 16, 42, 14); g.lineStyle(3, 0xffffff, 0.9); g.strokeEllipse(24, 16, 40, 12);
  g.fillStyle(0xb48cff, 0.4); g.fillEllipse(24, 16, 46, 18); });
add('hat_astro', 48, 38, (g) => { g.fillStyle(INK); g.fillEllipse(24, 20, 44, 36); g.fillStyle(0xf0f4f7); g.fillEllipse(24, 19, 39, 32);
  g.fillStyle(0x16304a); g.fillEllipse(24, 21, 29, 22); g.fillStyle(0x3b82d9, 0.85); g.fillEllipse(24, 21, 26, 19);
  g.fillStyle(0xffffff, 0.5); g.fillEllipse(17, 16, 9, 5); g.fillStyle(0xffc247); g.fillRect(2, 16, 5, 7); g.fillRect(41, 16, 5, 7); });

add('accessory_necklace', 36, 20, (g) => { g.lineStyle(2, 0xd8c9a3); g.beginPath(); g.arc(18, 2, 13, 0.2, Math.PI - 0.2, false); g.strokePath();
  g.fillStyle(INK); g.fillTriangle(18, 20, 12, 10, 24, 10); g.fillStyle(0x9fe3ff); g.fillTriangle(18, 18, 13.5, 11, 22.5, 11); });
add('accessory_medal', 34, 22, (g) => { g.fillStyle(0x3b5b92); g.fillRoundedRect(11, 0, 12, 10, 2); g.fillStyle(0xe8483c); g.fillRect(11, 3, 12, 3);
  g.fillStyle(INK); g.fillCircle(17, 15, 7); g.fillStyle(0xffc247); g.fillCircle(17, 15, 5.5); g.fillStyle(0xd99000); g.fillCircle(17, 15, 2.2); });
add('accessory_compass', 32, 20, (g) => { g.lineStyle(2, 0x6b4428); g.beginPath(); g.arc(16, 1, 12, 0.25, Math.PI - 0.25, false); g.strokePath();
  g.fillStyle(INK); g.fillCircle(16, 13, 7); g.fillStyle(0xf4fbff); g.fillCircle(16, 13, 5.5); g.fillStyle(0xe8483c); g.fillTriangle(16, 8.5, 14, 13, 18, 13);
  g.fillStyle(0x3b5b92); g.fillTriangle(16, 17.5, 14, 13, 18, 13); });

add('shirt_puffer', 38, 24, (g) => { g.fillStyle(0x2f9e5b); g.fillRoundedRect(0, 0, 38, 24, 10);
  g.fillStyle(0x268a4e); [4, 11, 18].forEach((y) => g.fillRect(1, y, 36, 2)); g.fillStyle(0x1f6e3f); g.fillRect(17, 0, 3, 24);
  g.fillStyle(0xffc247); g.fillRect(17.5, 10, 2, 5); });
add('shirt_raincoat', 38, 24, (g) => { g.fillStyle(0xffc247); g.fillRoundedRect(0, 0, 38, 24, 10); g.fillStyle(0xd99000); g.fillRect(16, 0, 3, 24);
  g.fillRoundedRect(4, 13, 10, 7, 2); g.fillRoundedRect(24, 13, 10, 7, 2); g.fillStyle(0xffffff, 0.45); g.fillRect(2, 2, 34, 3); });
add('shirt_sailor', 38, 24, (g) => { g.fillStyle(0x1f3a63); g.fillRoundedRect(0, 0, 38, 24, 10); g.fillStyle(0xffffff); g.fillTriangle(12, 0, 26, 0, 19, 11);
  g.fillStyle(0xffc247); [7, 13, 19].forEach((y) => { g.fillCircle(14, y + 2, 1.5); g.fillCircle(24, y + 2, 1.5); }); g.fillStyle(0xe8483c); g.fillRect(0, 20, 38, 3); });
add('shirt_knight', 38, 24, (g) => { g.fillStyle(0x9fd8ef); g.fillRoundedRect(0, 0, 38, 24, 10); g.fillStyle(0xd9f2ff); g.fillRoundedRect(2, 2, 34, 9, 6);
  g.fillStyle(0x7fb8d8); g.fillRect(0, 12, 38, 2); g.fillRect(17, 12, 3, 12); g.fillStyle(0xffffff, 0.7); g.fillEllipse(10, 6, 9, 4);
  g.fillStyle(0xffc247); g.fillCircle(19, 17, 3); });
add('shirt_astro', 38, 24, (g) => { g.fillStyle(0xf0f4f7); g.fillRoundedRect(0, 0, 38, 24, 10); g.fillStyle(0xdfe7ee); g.fillRect(0, 13, 38, 3);
  g.fillStyle(0x3b82d9); g.fillRoundedRect(11, 4, 16, 8, 3); g.fillStyle(0x8ff0b3); g.fillCircle(15, 8, 1.8); g.fillStyle(0xe8483c); g.fillCircle(20, 8, 1.8);
  g.fillStyle(0xffc247); g.fillCircle(25, 8, 1.8); });

add('pants_shorts', 36, 11, (g) => { g.fillStyle(0xe8483c); g.fillRoundedRect(0, 0, 36, 11, { tl: 2, tr: 2, bl: 6, br: 6 }); g.fillStyle(0xffffff); g.fillRect(17, 2, 2, 9); g.fillRect(0, 0, 36, 2); });
add('pants_plaid', 36, 14, (g) => { g.fillStyle(0xb5703f); g.fillRoundedRect(0, 0, 36, 14, { tl: 2, tr: 2, bl: 7, br: 7 });
  g.fillStyle(0x8a4f26); [4, 12, 20, 28].forEach((x) => g.fillRect(x, 0, 3, 14)); [4, 10].forEach((y) => g.fillRect(0, y, 36, 2));
  g.fillStyle(0xf4fbff, 0.5); g.fillRect(8, 0, 1, 14); });
add('pants_armor', 36, 14, (g) => { g.fillStyle(0x9fd8ef); g.fillRoundedRect(0, 0, 36, 14, { tl: 2, tr: 2, bl: 7, br: 7 });
  g.fillStyle(0x7fb8d8); g.fillRect(17, 2, 2, 12); g.fillRect(0, 6, 36, 2); g.fillStyle(0xffffff, 0.6); g.fillRect(3, 1, 10, 3); g.fillRect(23, 1, 10, 3); });

add('shoes_flippers', 24, 10, (g) => { g.fillStyle(INK); g.fillEllipse(12, 5, 24, 10); g.fillStyle(0x2f9e5b); g.fillEllipse(12, 5, 20, 7); g.fillStyle(0x268a4e); g.fillRect(2, 4, 20, 1.5); });
add('shoes_mukluks', 18, 12, (g) => { g.fillStyle(INK); g.fillRoundedRect(0, 2, 18, 10, 4); g.fillStyle(0x6b4428); g.fillRoundedRect(1.5, 3.5, 15, 7, 3);
  g.fillStyle(0xf0e6cf); g.fillRoundedRect(0, 0, 18, 4, 2); g.fillStyle(0x3a2616); g.fillRect(1.5, 9.5, 15, 2); });

add('back_jetpack', 52, 46, (g) => { g.fillStyle(INK); g.fillRoundedRect(4, 0, 44, 34, 10); g.fillStyle(0xb8c4d0); g.fillRoundedRect(6, 2, 40, 30, 9);
  g.fillStyle(0x7d8c97); g.fillRect(24, 2, 4, 30); g.fillStyle(0xe8483c); g.fillRoundedRect(10, 6, 12, 8, 3); g.fillRoundedRect(30, 6, 12, 8, 3);
  g.fillStyle(0xffc247); g.fillTriangle(16, 34, 10, 46, 22, 46); g.fillTriangle(36, 34, 30, 46, 42, 46); g.fillStyle(0xff9a3c); g.fillTriangle(16, 36, 13, 44, 19, 44); g.fillTriangle(36, 36, 33, 44, 39, 44); });
add('back_sled', 56, 40, (g) => { g.fillStyle(INK); g.fillRoundedRect(2, 0, 52, 32, 8); g.fillStyle(0xb5703f); g.fillRoundedRect(4, 2, 48, 28, 7);
  g.fillStyle(0x8a4f26); [10, 19, 28] .forEach((y) => g.fillRect(5, y, 46, 2.5)); g.fillStyle(0xd9546a); g.fillRect(4, 2, 48, 4);
  g.fillStyle(0xb8c4d0); g.fillRoundedRect(0, 32, 56, 4, 2); });
add('back_aurora', 64, 58, (g) => { [[0x8ff0b3, 0.55, 0], [0x66e8ff, 0.45, 8], [0xb48cff, 0.4, 16]].forEach(([c, a, off]) => {
    g.fillStyle(c, a); g.fillPoints([{ x: 14 + off * 0.2, y: 0 }, { x: 50 - off * 0.2, y: 0 }, { x: 64 - off, y: 58 }, { x: off, y: 58 }], true); });
  g.fillStyle(0xffffff, 0.35); g.fillRect(16, 0, 32, 4); });

add('hand_lantern', 20, 34, (g) => { g.lineStyle(2, 0x6b4428); g.beginPath(); g.arc(10, 10, 6, Math.PI, 0, false); g.strokePath();
  g.fillStyle(INK); g.fillRoundedRect(2, 12, 16, 20, 4); g.fillStyle(0xffc247); g.fillRoundedRect(4, 14, 12, 14, 3);
  g.fillStyle(0xfff0b0); g.fillCircle(10, 21, 4); g.fillStyle(0x6b4428); g.fillRect(2, 29, 16, 3); });
add('hand_rod', 16, 48, (g) => { g.fillStyle(0x6b4428); g.fillRoundedRect(6, 26, 4, 22, 2); g.lineStyle(2.5, 0x8a5a36); g.lineBetween(8, 26, 13, 2);
  g.lineStyle(1, 0xdfeefb); g.lineBetween(13, 2, 3, 20); g.fillStyle(0xb8c4d0); g.fillCircle(3, 21, 2.2); g.fillStyle(0x3a3f4b); g.fillCircle(8, 28, 3); });
add('hand_cocoa', 18, 20, (g) => { g.fillStyle(INK); g.fillRoundedRect(0, 4, 14, 14, 3); g.fillStyle(0xf4fbff); g.fillRoundedRect(1.5, 5.5, 11, 11, 2);
  g.fillStyle(0x6b4428); g.fillRoundedRect(2.5, 6.5, 9, 3, 1); g.lineStyle(2, 0xf4fbff); g.strokeCircle(16, 11, 3.5);
  g.fillStyle(0xffffff, 0.6); g.fillCircle(5, 2, 2); g.fillCircle(9, 0.5, 1.5); });
add('hand_crystal', 20, 32, (g) => { g.fillStyle(0xb48cff, 0.4); g.fillEllipse(10, 18, 20, 30); g.fillStyle(0x8f6fe0); g.fillTriangle(10, 0, 2, 26, 18, 26);
  g.fillStyle(0xc7aaff); g.fillTriangle(10, 0, 7, 26, 13, 26); g.fillStyle(0xffffff, 0.6); g.fillTriangle(9, 4, 6, 22, 10, 22);
  g.fillStyle(0x6a4fb3); g.fillRoundedRect(4, 25, 12, 6, 2); });

// ---------------------------------------------------------------------
// Phase 14
// ---------------------------------------------------------------------
// The Blue Star — two interlocking outlined triangles with an open hexagon in the middle, worn on a chain.
// Drawn as outlines (thick strokes) so the hollow centre reads exactly like the symbol it is.
add('accessory_star', 44, 30, (g) => {
  g.lineStyle(2.5, 0xd8c9a3, 1);                                        // chain
  g.beginPath(); g.arc(22, 1, 14, 0.25, Math.PI - 0.25, false); g.strokePath();
  const cx = 22, cy = 15, R = 9.5;
  const tri = (flip) => {
    const pts = [0, 1, 2].map((i) => {
      const a = -Math.PI / 2 + i * (Math.PI * 2 / 3) + (flip ? Math.PI / 3 : 0);
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R };
    });
    g.lineStyle(2.8, 0x0a1cf0, 1);
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    g.lineTo(pts[1].x, pts[1].y); g.lineTo(pts[2].x, pts[2].y); g.closePath(); g.strokePath();
  };
  tri(false); tri(true);
});

// The Aurora Jetpack — the founder's jetpack. Twin tanks, a ribbed spine, warning stripes and a live aurora flame.
add('back_jetpack_x', 56, 52, (g) => {
  g.fillStyle(0x16304a); g.fillRoundedRect(4, 0, 48, 36, 11);
  g.fillStyle(0x2e4a6b); g.fillRoundedRect(6, 2, 44, 32, 10);
  g.fillStyle(0x9fd8ef); g.fillRoundedRect(9, 5, 15, 26, 7);            // left tank
  g.fillRoundedRect(32, 5, 15, 26, 7);                                   // right tank
  g.fillStyle(0xffffff, 0.45); g.fillRoundedRect(11, 7, 5, 20, 3); g.fillRoundedRect(34, 7, 5, 20, 3);
  g.fillStyle(0x6a4fb3); g.fillRect(26, 2, 4, 32);                       // spine
  g.fillStyle(0xffc247); g.fillRect(9, 16, 15, 3); g.fillRect(32, 16, 15, 3);
  g.fillStyle(0x8ff0b3); g.fillCircle(16.5, 11, 3); g.fillStyle(0x66e8ff); g.fillCircle(39.5, 11, 3);
  // aurora exhaust
  g.fillStyle(0x8ff0b3, 0.75); g.fillTriangle(16.5, 36, 10, 52, 23, 52);
  g.fillStyle(0x66e8ff, 0.75); g.fillTriangle(39.5, 36, 33, 52, 46, 52);
  g.fillStyle(0xffffff, 0.85); g.fillTriangle(16.5, 38, 13, 48, 20, 48);
  g.fillTriangle(39.5, 38, 36, 48, 43, 48);
});

export function makeItemTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  for (const [key, [w, h, fn]] of Object.entries(ART)) { g.clear(); fn(g); g.generateTexture(key, w, h); }
  g.destroy();
}
