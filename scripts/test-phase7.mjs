// node scripts/test-phase7.mjs : scoring, reward tiers and client/SQL consistency (no browser or Supabase needed).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { snowDashScore, catchMultiplier, arenaMultiplier, clampScore, MAX_SCORE, DASH } from '../src/minigames/scoring.js';
import { FALLBACK_TIERS, rewardFor, nextTier } from '../src/minigames/rewards.js';
import { GAMES } from '../src/minigames/registry.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
// Phase 10 adds the seven world activities to the same `minigames` table, so both catalogues count as "the SQL".
const sql = ['phase7', 'phase10', 'phase11', 'phase12']            // every file that seeds the `minigames` table
  .map((f) => fs.readFileSync(new URL(`../supabase/${f}.sql`, import.meta.url), 'utf8')).join('\n');

t('snow dash: faster is better, crashes cost points, partial credit when time runs out', () => {
  const fast = snowDashScore({ timeMs: 24000, crashes: 0 }), slow = snowDashScore({ timeMs: 50000, crashes: 0 });
  assert.equal(fast, 10000); assert(fast > slow && slow > 0);
  assert(snowDashScore({ timeMs: 30000, crashes: 3 }) < snowDashScore({ timeMs: 30000, crashes: 0 }));
  assert(snowDashScore({ timeMs: 90000, finished: false, progress: 0.5 }) <= 1500);
  assert.equal(snowDashScore({ timeMs: 1, crashes: 0 }), 10000);
});
t('multipliers cap at x5', () => {
  assert.equal(catchMultiplier(0), 1); assert.equal(catchMultiplier(6), 2); assert.equal(catchMultiplier(999), 5);
  assert.equal(arenaMultiplier(2), 1); assert.equal(arenaMultiplier(3), 2); assert.equal(arenaMultiplier(999), 5);
});
t('clampScore never exceeds the server max and survives garbage', () => {
  assert.equal(clampScore('snow_dash', 1e9), 10000); assert.equal(clampScore('coin_catcher', -5), 0); assert.equal(clampScore('coin_catcher', NaN), 0);
});
t('every game is in the registry, MAX_SCORE and the SQL catalogue', () => {
  for (const id of Object.keys(GAMES)) {
    assert(MAX_SCORE[id] > 0, id); assert(FALLBACK_TIERS[id]?.length, id);
    assert(new RegExp(`\\('${id}',`).test(sql), 'sql row ' + id);
  }
});
t('client MAX_SCORE matches minigames.max_score in SQL', () => {
  for (const [id, max] of Object.entries(MAX_SCORE)) assert(new RegExp(`\\('${id}',\\s+'[^']+',\\s+${max},`).test(sql), id);
});
t('fallback reward tiers match the SQL tier tables', () => {
  for (const [id, tiers] of Object.entries(FALLBACK_TIERS)) {
    const row = sql.split('\n').find((l) => l.includes(`('${id}',`)); assert(row, id);
    const body = sql.slice(sql.indexOf(row), sql.indexOf(row) + 600);
    const json = body.match(/'(\[\{.*?\}\])'/)[1];
    assert.deepEqual(JSON.parse(json.replace(/\\"/g, '"')), tiers, id);
  }
});
t('the best possible runs are reachable but not free', () => {
  assert.equal(rewardFor(FALLBACK_TIERS.snow_dash, 0), 0); assert.equal(rewardFor(FALLBACK_TIERS.snow_dash, 10000), 125);
  assert.deepEqual(nextTier(FALLBACK_TIERS.coin_catcher, 900), { min: 1800, coins: 40 });
  assert.equal(nextTier(FALLBACK_TIERS.coin_catcher, 99999), null);
  assert(DASH.parMs > 12000, 'par time must be above the server minimum duration');
});
t('SQL: players cannot write, rewards are server-side', () => {
  assert(/revoke all on public\.minigames, public\.minigame_sessions, public\.minigame_scores, public\.minigame_bests from anon, authenticated/.test(sql));
  assert(!/grant (insert|update|delete)[^;]*minigame/i.test(sql));
  assert(/grant select on public\.minigame_scores, public\.minigame_bests to authenticated/.test(sql));
  assert(/security definer/.test(sql) && /auth\.uid\(\)/.test(sql));
});
console.log(`\n${n} checks passed`);
