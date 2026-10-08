-- =====================================================================
-- ANCHORS WORLD · PHASE 10 — World activities (one minigame per map)
-- Run AFTER phase7.sql (it extends the same `minigames` catalogue) and phase9.sql. Safe to re-run.
--
-- Nothing new is invented here: these rows go in the Phase 7 `minigames` table, so the seven world activities use the
-- exact same trust model as the arcade cabinets — start_minigame() opens a server-timed session, and
-- submit_minigame_score() checks the score range, the score-per-second ceiling and the run length against the
-- server's own clock before paying a reward from THIS table. The browser still never sends a player id or a coin
-- amount, and the daily coin cap is shared across every game.
--
-- Columns, for reference: max_score, max_score_per_sec, min_duration_ms, max_duration_ms, reward_min_ms, rewards.
-- =====================================================================

insert into public.minigames (id, name, max_score, max_score_per_sec, min_duration_ms, max_duration_ms, reward_min_ms, rewards) values
  ('firefly_catch',  'Firefly Catch',  9000, 260,  5000,  60000, 20000,
    '[{"min":1,"coins":8},{"min":600,"coins":20},{"min":1400,"coins":40},{"min":2400,"coins":70},{"min":3600,"coins":110}]'),
  ('cocoa_rush',     'Cocoa Rush',     9000, 260,  5000,  60000, 20000,
    '[{"min":1,"coins":8},{"min":600,"coins":20},{"min":1400,"coins":40},{"min":2400,"coins":70},{"min":3600,"coins":110}]'),
  ('ice_fishing',    'Ice Fishing',    9000, 300,  5000,  60000, 20000,
    '[{"min":1,"coins":8},{"min":700,"coins":20},{"min":1600,"coins":40},{"min":2800,"coins":70},{"min":4200,"coins":110}]'),
  ('crate_stack',    'Crate Stack',    9000, 220,  4000, 120000, 20000,
    '[{"min":1,"coins":8},{"min":500,"coins":20},{"min":1200,"coins":40},{"min":2200,"coins":70},{"min":3400,"coins":110}]'),
  ('cliff_climb',    'Cliff Climb',    9000, 220,  4000, 100000, 20000,
    '[{"min":1,"coins":8},{"min":800,"coins":20},{"min":1800,"coins":40},{"min":3000,"coins":70},{"min":4500,"coins":110}]'),
  ('crystal_echo',   'Crystal Echo',   9000, 140,  4000, 120000, 20000,
    '[{"min":1,"coins":8},{"min":400,"coins":20},{"min":900,"coins":40},{"min":1600,"coins":70},{"min":2600,"coins":110}]'),
  ('star_link',      'Star Link',      9000, 140,  4000, 120000, 20000,
    '[{"min":1,"coins":8},{"min":400,"coins":20},{"min":900,"coins":40},{"min":1600,"coins":70},{"min":2600,"coins":110}]')
on conflict (id) do update set name = excluded.name, max_score = excluded.max_score, max_score_per_sec = excluded.max_score_per_sec,
  min_duration_ms = excluded.min_duration_ms, max_duration_ms = excluded.max_duration_ms, reward_min_ms = excluded.reward_min_ms,
  rewards = excluded.rewards, enabled = true;

-- The "Arcade Master" badge from Phase 8 sums every best score, so the new activities count towards it automatically.
