// =====================================================================
// PHASE 12 — ski slopes & sled routes, as data.
//
// These are NOT arcade games. Every slope below is a real room in the world: you walk to the ski base,
// ride a lift to the summit, and sled down a long snowy room that exits into another part of Anchors World.
// The sled "course" (obstacles, ramps, coins, gates) is generated deterministically from a seed, so:
//   * every player sees the identical course without a single database write,
//   * the rooms file stays short instead of carrying thousands of hand-placed coordinates,
//   * each slope still gets its own distinct layout and difficulty.
//
// A route is consumed by src/world/SkiArea.js, which is built by RoomScene exactly like props and portals are.
// =====================================================================

// Small deterministic PRNG (mulberry32). Same seed -> same course, on every client, forever.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The rideable width of a slope narrows and widens down the run so the path reads as a mountain trail
// rather than a straight corridor. Returns the centre x and half-width at a given y.
function trailAt(cfg, y) {
  const t = (y - cfg.startY) / (cfg.finishY - cfg.startY);
  let cx = cfg.w / 2;
  for (const b of cfg.bends) cx += Math.sin(t * Math.PI * b.freq + b.phase) * b.amp;
  const half = cfg.halfMin + (cfg.halfMax - cfg.halfMin) * (0.5 + 0.5 * Math.sin(t * Math.PI * 3 + 1.2));
  return { cx, half };
}

// Build one course. Everything is laid out relative to the trail centre so nothing ever spawns off-piste.
function buildRoute(cfg) {
  const r = rng(cfg.seed);
  const obstacles = [], ramps = [], coins = [], gates = [], banks = [];
  const span = cfg.finishY - cfg.startY;

  // --- snowbanks: visual edges of the trail, sampled down the run ---
  for (let y = cfg.startY; y < cfg.finishY; y += 120) {
    const { cx, half } = trailAt(cfg, y);
    banks.push([cx - half, y], [cx + half, y]);
  }

  // --- obstacles: trees and rocks that cost you speed ---
  let y = cfg.startY + 320;
  while (y < cfg.finishY - 260) {
    const count = 1 + Math.floor(r() * cfg.density);
    for (let i = 0; i < count; i++) {
      // place against the trail at the item's OWN y, or a bend will push it onto the bank
      const oy = Math.round(y + r() * 90);
      const at = trailAt(cfg, oy);
      const off = (r() * 2 - 1) * (at.half - 60);
      obstacles.push({ x: Math.round(at.cx + off), y: oy, kind: r() < 0.6 ? 'tree' : 'rock' });
    }
    y += cfg.gap + r() * cfg.gapVar;
  }

  // --- ramps: speed + a hop, always near the trail centre so they are a reward, not a trap ---
  const rampCount = cfg.ramps;
  for (let i = 0; i < rampCount; i++) {
    const ry = cfg.startY + span * ((i + 0.7) / (rampCount + 0.4));
    const { cx, half } = trailAt(cfg, ry);
    ramps.push({ x: Math.round(cx + (r() * 2 - 1) * half * 0.45), y: Math.round(ry) });
  }

  // --- coins: short arcs, so collecting them means committing to a line ---
  const arcs = cfg.coinArcs;
  for (let i = 0; i < arcs; i++) {
    const ay = cfg.startY + 260 + span * (i / arcs) * 0.94;
    const laneOff = (r() * 2 - 1) * 0.6;
    const n = 4 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) {
      const cy2 = Math.round(ay + j * 58);
      const at = trailAt(cfg, cy2);
      coins.push([Math.round(at.cx + laneOff * (at.half - 50) + Math.sin(j * 0.9) * 30), cy2]);
    }
  }

  // --- timing gates: optional, purely for the clock/score feel ---
  for (let i = 1; i <= cfg.gates; i++) {
    const gy = cfg.startY + (span * i) / (cfg.gates + 1);
    const { cx } = trailAt(cfg, gy);
    gates.push({ x: Math.round(cx), y: Math.round(gy) });
  }

  return { ...cfg, obstacles, ramps, coins, gates, banks, trailAt: (yy) => trailAt(cfg, yy) };
}

// ---------------------------------------------------------------------
// The five slopes. Each exits into a DIFFERENT existing part of the world, so sledding is travel.
// `par` is the target time in seconds used for the time bonus; `to`/`spawn` is where you end up.
// ---------------------------------------------------------------------
const DEFAULTS = {
  halfMin: 150, halfMax: 250, density: 2, gap: 190, gapVar: 120,
  ramps: 3, coinArcs: 7, gates: 3, accel: 54, maxSpeed: 470, steer: 250,
  // `bends` shape the trail's centre line. Each is a sine wave down the run; stacking two or three
  // uneven frequencies is what stops a slope feeling like a straight corridor.
  bends: [{ freq: 2, amp: 120, phase: 0 }, { freq: 5, amp: 45, phase: 1.1 }],
};

export const SKI_ROUTES = {
  // Gentle, wide, forgiving. Ends back at the base so new players can loop it.
  slope_beginner: buildRoute({
    ...DEFAULTS, id: 'slope_beginner', seed: 10127, w: 1200, startY: 200, finishY: 3000,
    halfMin: 210, halfMax: 300, density: 1, gap: 260, gapVar: 140,
    bends: [{ freq: 1.5, amp: 70, phase: 0.3 }],
    ramps: 2, coinArcs: 6, accel: 44, maxSpeed: 400, par: 34,
    to: 'ski_base', spawn: { x: 800, y: 300 },
  }),
  // Tight, tree-lined, twisty. Drops you into the Deep Forest.
  slope_forest: buildRoute({
    ...DEFAULTS, id: 'slope_forest', seed: 20231, w: 1200, startY: 200, finishY: 3400,
    halfMin: 130, halfMax: 210, density: 3, gap: 160, gapVar: 90,
    bends: [{ freq: 3, amp: 150, phase: 0.6 }, { freq: 7, amp: 50, phase: 2.0 }],
    ramps: 4, coinArcs: 9, accel: 56, maxSpeed: 480, par: 38,
    to: 'deep_forest', spawn: { x: 800, y: 220 },
  }),
  // Long, exposed, sweeping bends. Comes out on the Mountain Pass.
  slope_ridge: buildRoute({
    ...DEFAULTS, id: 'slope_ridge', seed: 30449, w: 1300, startY: 200, finishY: 3800,
    halfMin: 160, halfMax: 260, density: 2, gap: 200, gapVar: 110,
    bends: [{ freq: 2, amp: 210, phase: 0 }, { freq: 4.5, amp: 60, phase: 1.4 }],
    ramps: 5, coinArcs: 10, accel: 60, maxSpeed: 520, par: 42,
    to: 'mountain_pass', spawn: { x: 700, y: 300 },
  }),
  // Steep and mean. Ends out on the Frozen Lake.
  slope_extreme: buildRoute({
    ...DEFAULTS, id: 'slope_extreme', seed: 40961, w: 1100, startY: 200, finishY: 4200,
    halfMin: 110, halfMax: 180, density: 4, gap: 140, gapVar: 70,
    bends: [{ freq: 4, amp: 180, phase: 0.9 }, { freq: 9, amp: 55, phase: 2.6 }],
    ramps: 6, coinArcs: 12, gates: 4, accel: 72, maxSpeed: 610, par: 44,
    to: 'frozen_lake', spawn: { x: 800, y: 260 },
  }),
  // The quiet one, behind the cornice. Drops into Snow Camp.
  slope_hidden: buildRoute({
    ...DEFAULTS, id: 'slope_hidden', seed: 50833, w: 1200, startY: 200, finishY: 3200,
    halfMin: 150, halfMax: 240, density: 2, gap: 190, gapVar: 100,
    bends: [{ freq: 2.5, amp: 160, phase: 1.8 }, { freq: 6, amp: 40, phase: 0.2 }],
    ramps: 4, coinArcs: 11, accel: 58, maxSpeed: 500, par: 36,
    to: 'snow_camp', spawn: { x: 800, y: 300 },
  }),
};

// Scoring: coins are the bulk, finishing under par pays a time bonus, clean runs pay a little more.
// Mirrors supabase/phase12.sql so the client preview and the server payout agree.
export function sledScore({ coins, seconds, hits, par }) {
  const coinPts = coins * 55;
  const timePts = Math.max(0, Math.round((par - seconds) * 45));
  const clean = hits === 0 ? 400 : Math.max(0, 200 - hits * 40);
  return Math.max(1, coinPts + timePts + clean + 250);
}

export const routeFor = (id) => SKI_ROUTES[id] || null;
