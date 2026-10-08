// =====================================================================
// PHASE 13 — collectible art.
//
// All 32 collectibles used to be the same four-pointed sparkle in a different tint. Now each one is drawn as the
// object it actually is, so you can tell a lost compass from a snowflake across a room. Everything is drawn into
// the caller's Graphics around (0, 0) at roughly 30px tall, which is what WorldLayer floats and spins.
//
// Shapes are keyed by collectible id prefix, so a new collectible picks up a sensible drawing automatically:
// anything starting `flake_` is a snowflake, `crystal_` a crystal, and so on, with a gem as the final fallback.
// =====================================================================
const INK = 0x16304a;

const flake = (g, tint) => {
  g.lineStyle(4, 0xffffff, 1);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, x = Math.cos(a) * 15, y = Math.sin(a) * 15;
    g.lineBetween(0, 0, x, y);
    g.lineBetween(x * 0.6, y * 0.6, x * 0.6 + Math.cos(a + 0.9) * 6, y * 0.6 + Math.sin(a + 0.9) * 6);
    g.lineBetween(x * 0.6, y * 0.6, x * 0.6 + Math.cos(a - 0.9) * 6, y * 0.6 + Math.sin(a - 0.9) * 6);
  }
  g.fillStyle(tint, 0.9); g.fillCircle(0, 0, 5);
};

const crystal = (g, tint) => {
  g.fillStyle(tint, 1); g.fillTriangle(0, -18, -11, 8, 11, 8);
  g.fillStyle(0xffffff, 0.55); g.fillTriangle(0, -18, -4, 8, 2, 8);
  g.fillStyle(0x16304a, 0.25); g.fillTriangle(0, -18, 7, 8, 11, 8);
  g.fillStyle(tint, 0.9); g.fillRoundedRect(-9, 7, 18, 7, 3);
};

const coin = (g, tint) => {
  g.fillStyle(0xc9931a); g.fillCircle(0, 0, 14);
  g.fillStyle(0xffc247); g.fillCircle(0, 0, 11.5);
  g.fillStyle(0xd9a52a); g.fillCircle(0, 0, 7);
  g.fillStyle(0xffe08a); g.fillRect(-1.5, -6, 3, 12); g.fillRect(-4, -4, 8, 2.5);
};

const compass = (g) => {
  g.fillStyle(0x7a6a4a); g.fillCircle(0, 0, 15);
  g.fillStyle(0xc9a227); g.fillCircle(0, 0, 12.5);
  g.fillStyle(0xf4fbff); g.fillCircle(0, 0, 9.5);
  g.fillStyle(0xe8483c); g.fillTriangle(0, -8, -3.5, 1, 3.5, 1);
  g.fillStyle(0x3d5a80); g.fillTriangle(0, 8, -3.5, 1, 3.5, 1);
  g.fillStyle(INK); g.fillCircle(0, 0, 2);
};

const key = (g) => {
  g.fillStyle(0xb8c4d0); g.fillRoundedRect(-2.5, -6, 5, 20, 2);
  g.lineStyle(4, 0xb8c4d0); g.strokeCircle(0, -11, 7);
  g.fillStyle(0xb8c4d0); g.fillRect(2, 6, 7, 4); g.fillRect(2, 12, 5, 4);
  g.fillStyle(0xffffff, 0.5); g.fillRect(-1.5, -4, 1.5, 14);
};

const locket = (g, tint) => {
  g.lineStyle(3, 0xc9a227); g.beginPath(); g.arc(0, -8, 12, Math.PI, 0, true); g.strokePath();
  g.fillStyle(0xc9a227); g.fillCircle(0, 4, 11);
  g.fillStyle(tint, 0.95); g.fillCircle(0, 4, 8);
  g.fillStyle(0xffffff, 0.6); g.fillEllipse(-3, 1, 6, 4);
};

const book = (g, tint) => {
  g.fillStyle(0x6b4428); g.fillRoundedRect(-13, -10, 26, 21, 3);
  g.fillStyle(tint, 0.9); g.fillRoundedRect(-11, -8, 22, 17, 2);
  g.fillStyle(0xf4fbff); g.fillRect(-9, -6, 18, 13);
  g.fillStyle(0xdfe8ef); g.fillRect(-1, -6, 2, 13);
  g.lineStyle(2, 0x9aa7b8); g.lineBetween(-7, -2, -3, -2); g.lineBetween(3, 2, 7, 2);
};

const medal = (g) => {
  g.fillStyle(0x3b5b92); g.fillRect(-7, -17, 14, 10);
  g.fillStyle(0xe8483c); g.fillRect(-7, -14, 14, 3.5);
  g.fillStyle(0xc9931a); g.fillCircle(0, 3, 12);
  g.fillStyle(0xffc247); g.fillCircle(0, 3, 9.5);
  g.fillStyle(0xd9a52a);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
    g.fillTriangle(0, 3, Math.cos(a) * 7, 3 + Math.sin(a) * 7, Math.cos(a + 0.6) * 7, 3 + Math.sin(a + 0.6) * 7);
  }
};

const gear = (g, tint) => {
  g.fillStyle(tint, 1);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.fillRect(Math.cos(a) * 11 - 3.5, Math.sin(a) * 11 - 3.5, 7, 7);
  }
  g.fillCircle(0, 0, 11);
  g.fillStyle(0x16304a, 0.55); g.fillCircle(0, 0, 4.5);
  g.fillStyle(0xffffff, 0.35); g.fillEllipse(-4, -4, 7, 4);
};

const comet = (g, tint) => {
  g.fillStyle(tint, 0.35); g.fillTriangle(-20, 10, 4, -6, 10, 4);
  g.fillStyle(tint, 0.65); g.fillTriangle(-13, 8, 3, -4, 8, 3);
  g.fillStyle(0xffffff); g.fillCircle(6, 0, 8);
  g.fillStyle(tint); g.fillCircle(6, 0, 5.5);
};

const lens = (g) => {
  g.fillStyle(0xc9a227); g.fillCircle(0, 0, 14);
  g.fillStyle(0x9fe3ff, 0.9); g.fillCircle(0, 0, 10.5);
  g.fillStyle(0xffffff, 0.6); g.fillEllipse(-4, -4, 8, 5);
  g.lineStyle(3, 0xe6c252); g.strokeCircle(0, 0, 12.5);
};

const chart = (g) => {
  g.fillStyle(0xeee3c8); g.fillRoundedRect(-14, -11, 28, 22, 3);
  g.fillStyle(0xd8c9a3); g.fillRect(-14, -11, 28, 4); g.fillRect(-14, 7, 28, 4);
  g.fillStyle(0xffc247);
  [[-7, -3], [2, -6], [7, 2], [-3, 4]].forEach(([x, y]) => g.fillCircle(x, y, 2.2));
  g.lineStyle(1.5, 0x8a7a5a); g.lineBetween(-7, -3, 2, -6); g.lineBetween(2, -6, 7, 2);
};

const kettle = (g) => {
  g.fillStyle(0x7d8c97); g.fillRoundedRect(-11, -4, 22, 16, 7);
  g.fillStyle(0x9aa7b8); g.fillRoundedRect(-9, -2, 12, 10, 5);
  g.fillStyle(0x7d8c97); g.fillTriangle(9, -1, 16, -7, 12, 2);
  g.lineStyle(3, 0x5e6b76); g.beginPath(); g.arc(0, -5, 9, Math.PI, 0, true); g.strokePath();
  g.fillStyle(0x3a3f4b); g.fillCircle(0, -5, 3);
};

const charm = (g, tint) => {
  g.lineStyle(4, 0xd8c9a3); g.strokeCircle(0, 2, 10);
  g.lineStyle(4, 0xc5b48c); g.beginPath(); g.arc(0, 2, 5, 0, Math.PI * 1.6); g.strokePath();
  g.fillStyle(tint); g.fillCircle(0, -10, 4.5);
};

const piton = (g) => {
  g.fillStyle(0x8a6a5a); g.fillTriangle(-3, -14, 3, -14, 0, 12);
  g.fillStyle(0xa98675); g.fillTriangle(-2, -13, 0, -13, 0, 10);
  g.lineStyle(4, 0xb8c4d0); g.strokeCircle(0, -13, 6);
};

const stone = (g) => {
  g.fillStyle(0x8e9ca8); g.fillEllipse(0, 4, 26, 16);
  g.fillStyle(0xa6b3bd); g.fillEllipse(-3, 0, 18, 11);
  g.fillStyle(0xffffff, 0.9); g.fillEllipse(0, -6, 20, 8);
};

const badge = (g, tint) => {
  g.fillStyle(0x2f9e5b); g.fillCircle(0, 0, 14);
  g.fillStyle(tint, 0.95); g.fillCircle(0, 0, 11);
  g.fillStyle(0x1f6b4f); g.fillTriangle(0, -8, -6, 6, 6, 6);
  g.fillStyle(0xffffff, 0.8); g.fillTriangle(0, -5, -3, 4, 3, 4);
};

// id prefix -> drawing. First match wins, so `flake_` beats the generic fallback.
const BY_PREFIX = [
  ['flake_', flake], ['cave_flake', flake], ['lamp_flake', flake],
  ['crystal_', crystal], ['ice_locket', locket], ['locket', locket],
  ['lost_compass', compass], ['rope_charm', charm], ['fish_crate_coin', coin], ['crate_coin', coin],
  ['skate_key', key], ['old_kettle', kettle], ['camp_journal', book], ['keeper_log', book],
  ['cache_medal', medal], ['pine_badge', badge], ['orrery_gear', gear], ['comet_fragment', comet],
  ['brass_lens', lens], ['star_chart', chart], ['rusted_piton', piton], ['cairn_stone', stone],
  ['marker_stone', stone],
];

export function drawCollectible(g, id = '', tint = 0xffffff) {
  const hit = BY_PREFIX.find(([p]) => String(id).startsWith(p));
  g.fillStyle(INK, 0.0);                                   // ensure a clean state
  (hit ? hit[1] : crystal)(g, tint);
  return g;
}
