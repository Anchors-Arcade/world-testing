// Pure game maths (no Phaser, no network) so it can be unit-tested with plain node: `node scripts/test-phase7.mjs`.
// Every score a game produces goes through these functions and is then clamped to the server's max (see `clampScore`).
export const MAX_SCORE = {
  snow_dash: 10000, coin_catcher: 9000, snowball_arena: 9000,                      // mirrors minigames.max_score in phase7.sql
  firefly_catch: 9000, cocoa_rush: 9000, ice_fishing: 9000, crate_stack: 9000,     // ... and in phase10.sql
  cliff_climb: 9000, crystal_echo: 9000, star_link: 9000,
  slope_sled: 10000, snow_runner: 10000,                                           // ... and in phase11.sql
};
export const clampScore = (game, s) => Math.max(0, Math.min(MAX_SCORE[game] ?? 0, Math.round(Number.isFinite(s) ? s : 0)));

// ---- Snow Dash: faster = better. 8000 pts for time (24 s or faster = full marks, 80 s = 0) + up to 2000 clean-run bonus.
export const DASH = { length: 9000, timeLimitMs: 90000, parMs: 24000, zeroMs: 80000, timePts: 8000, cleanPts: 2000, crashPenalty: 400 };
export function snowDashScore({ timeMs, crashes = 0, finished = true, progress = 1 }) {
  if (!finished) return clampScore('snow_dash', Math.floor(1500 * Math.min(1, Math.max(0, progress))));      // ran out of time: partial credit
  const t = Math.min(1, Math.max(0, (DASH.zeroMs - timeMs) / (DASH.zeroMs - DASH.parMs)));
  const clean = Math.max(0, DASH.cleanPts - crashes * DASH.crashPenalty);
  return clampScore('snow_dash', Math.round(DASH.timePts * t + clean));
}

// ---- Coin Catcher: streaks raise a multiplier (x1 .. x5)
export const CATCH = { timeMs: 45000, values: { flake: 5, coin: 15, gem: 50 }, penalty: { bomb: 100, icicle: 60 }, perStep: 6, maxMult: 5 };
export const catchMultiplier = (streak) => Math.min(CATCH.maxMult, 1 + Math.floor(streak / CATCH.perStep));

// ---- Snowball Arena: consecutive hits raise the multiplier (x1 .. x5); a miss or a friendly penguin resets it
export const ARENA = { timeMs: 45000, values: { snowman: 10, bullseye: 25, golden: 75 }, friendPenalty: 60, perStep: 3, maxMult: 5 };
export const arenaMultiplier = (streak) => Math.min(ARENA.maxMult, 1 + Math.floor(streak / ARENA.perStep));


// =====================================================================
// PHASE 10 — the seven world activities. Same contract as above: pure functions, clamped to the server's maximum,
// and the server re-checks every number it is sent (score range, score-per-second, run length).
// =====================================================================

// Deep Forest — tap the sprites, avoid the angry ones.
export const FIREFLY = { timeMs: 45000, spark: 20, bright: 60, penalty: 120, perStep: 5, maxMult: 5,
  spawnMinMs: 260, spawnMaxMs: 620, lifeMs: 2600, maxLive: 7, badChance: 0.22 };
export const fireflyScore = ({ points }) => clampScore('firefly_catch', points);

// Snow Camp — serve the cocoa orders.
export const COCOA = { timeMs: 45000, startLen: 3, maxLen: 7, growEvery: 3, base: 90, cleanBonus: 60, penalty: 40 };
export const cocoaScore = ({ points }) => clampScore('cocoa_rush', points);

// Frozen Lake — stop the marker in the green.
export const FISHING = { timeMs: 45000, values: { small: 60, big: 110, golden: 220 }, perStep: 3, maxMult: 5,
  zoneW: 150, minZone: 48, shrink: 9, speed: 0.75, maxSpeed: 2.1, speedUp: 0.07 };
export const fishingScore = ({ points }) => clampScore('ice_fishing', points);

// Harbour Village — stack the crates.
export const CRATES = { timeMs: 90000, startW: 190, minW: 26, h: 34, lives: 3, speed: 230, maxSpeed: 560, speedUp: 14,
  fall: 1500, perfectPx: 8, base: 60, perfectBonus: 90, heightBonus: 10 };
export const crateScore = ({ points }) => clampScore('crate_stack', points);

// Mountain Pass — climb and dodge.
export const CLIMB = { timeMs: 75000, lives: 3, speed: 150, maxSpeed: 420, accel: 7, moveSpeed: 420,
  spawnMinMs: 220, spawnMaxMs: 820, pxPerMetre: 22, perMetre: 9, perDodge: 12, surviveBonus: 900 };
export const climbScore = ({ metres, dodged = 0, survived = false }) =>
  clampScore('cliff_climb', Math.round(Math.max(0, metres) * CLIMB.perMetre + dodged * CLIMB.perDodge + (survived ? CLIMB.surviveBonus : 0)));

// Ice Caves / Observatory — repeat the pattern. Later rounds are worth more, so one long run beats many short ones.
export const ECHO = { timeMs: 90000, lives: 3, base: 60, perRound: 45, stepMs: 480, minStepMs: 190 };
export const echoScore = ({ points }) => clampScore('crystal_echo', points);     // both echo games share one ceiling


// =====================================================================
// PHASE 11 — Slope Sled Run + Snow Runner. Same contract: pure functions, clamped, re-validated by the server.
// =====================================================================
// Slope Sled Run: ride the lift (~5 s, part of the run clock), then sled 12 000 px down the hill. Coins, gems and air time add up;
// a faster descent and a clean run add up to 3 300 more.
export const SLED = { length: 12000, liftLen: 1900, timeLimitMs: 80000, coin: 30, gem: 90, airPts: 80, finishPts: 800, timePts: 2500, parMs: 22000, zeroMs: 70000, crashPenalty: 150, partialPts: 1200 };
export function sledScore({ timeMs, coins = 0, gems = 0, airs = 0, crashes = 0, finished = true, progress = 1 }) {
  const loot = coins * SLED.coin + gems * SLED.gem + airs * SLED.airPts;
  if (!finished) return clampScore('slope_sled', loot + Math.floor(SLED.partialPts * Math.min(1, Math.max(0, progress))));
  const t = Math.min(1, Math.max(0, (SLED.zeroMs - timeMs) / (SLED.zeroMs - SLED.parMs)));
  return clampScore('slope_sled', Math.round(loot + SLED.finishPts + SLED.timePts * t - crashes * SLED.crashPenalty));
}

// Snow Runner: endless. Score = metres run + coins/gems. Speed eases from 14 to 36 m/s; two hits end the run.
export const RUNNER = { startSpeed: 14, maxSpeed: 36, rampSecs: 50, lives: 2, jumpV: 640, gravity: 1900, coinPts: 12, gemPts: 60, cap: 9500 };
export const runnerScore = ({ meters = 0, coins = 0, gems = 0 }) => clampScore('snow_runner', Math.floor(meters) + coins * RUNNER.coinPts + gems * RUNNER.gemPts);
