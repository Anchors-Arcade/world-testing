// Reward PREVIEWS. The real payout is computed by submit_minigame_score() on the server from its own tier table; the client
// never sends a coin amount. These helpers only turn the server's tier list into labels ("Top reward", "next reward at ...").
export const FALLBACK_TIERS = {   // used only when the overview RPC is unavailable (guests / offline); mirrors phase7.sql
  snow_dash:      [{ min: 1, coins: 10 }, { min: 3000, coins: 25 }, { min: 5500, coins: 50 }, { min: 7500, coins: 80 }, { min: 9000, coins: 125 }],
  coin_catcher:   [{ min: 1, coins: 8 }, { min: 800, coins: 20 }, { min: 1800, coins: 40 }, { min: 3000, coins: 70 }, { min: 4500, coins: 110 }],
  snowball_arena: [{ min: 1, coins: 8 }, { min: 500, coins: 20 }, { min: 1200, coins: 40 }, { min: 2200, coins: 70 }, { min: 3500, coins: 110 }],
  // Phase 11 (mirrors phase11.sql)
  slope_sled:     [{ min: 1, coins: 8 }, { min: 1000, coins: 20 }, { min: 2500, coins: 40 }, { min: 4000, coins: 70 }, { min: 5500, coins: 110 }],
  snow_runner:    [{ min: 1, coins: 8 }, { min: 800, coins: 20 }, { min: 1800, coins: 40 }, { min: 3200, coins: 70 }, { min: 5000, coins: 110 }],
  // Phase 10 world activities (mirrors phase10.sql)
  firefly_catch:  [{ min: 1, coins: 8 }, { min: 600, coins: 20 }, { min: 1400, coins: 40 }, { min: 2400, coins: 70 }, { min: 3600, coins: 110 }],
  cocoa_rush:     [{ min: 1, coins: 8 }, { min: 600, coins: 20 }, { min: 1400, coins: 40 }, { min: 2400, coins: 70 }, { min: 3600, coins: 110 }],
  ice_fishing:    [{ min: 1, coins: 8 }, { min: 700, coins: 20 }, { min: 1600, coins: 40 }, { min: 2800, coins: 70 }, { min: 4200, coins: 110 }],
  crate_stack:    [{ min: 1, coins: 8 }, { min: 500, coins: 20 }, { min: 1200, coins: 40 }, { min: 2200, coins: 70 }, { min: 3400, coins: 110 }],
  cliff_climb:    [{ min: 1, coins: 8 }, { min: 800, coins: 20 }, { min: 1800, coins: 40 }, { min: 3000, coins: 70 }, { min: 4500, coins: 110 }],
  crystal_echo:   [{ min: 1, coins: 8 }, { min: 400, coins: 20 }, { min: 900, coins: 40 }, { min: 1600, coins: 70 }, { min: 2600, coins: 110 }],
  star_link:      [{ min: 1, coins: 8 }, { min: 400, coins: 20 }, { min: 900, coins: 40 }, { min: 1600, coins: 70 }, { min: 2600, coins: 110 }],
};
export const tiersFor = (overview, id) => overview?.games?.find((g) => g.id === id)?.rewards || FALLBACK_TIERS[id] || [];
export const maxReward = (overview, id) => { const g = overview?.games?.find((x) => x.id === id); return g?.max_reward ?? Math.max(0, ...tiersFor(overview, id).map((t) => t.coins)); };
export const rewardFor = (tiers, score) => tiers.reduce((best, t) => (t.min <= score && t.coins > best ? t.coins : best), 0);
// The first tier the player has NOT reached yet, for "N more points for +X coins" hints.
export function nextTier(tiers, score) {
  const t = tiers.filter((x) => x.min > score).sort((a, b) => a.min - b.min)[0];
  return t || null;
}
