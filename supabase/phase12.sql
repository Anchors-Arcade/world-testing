-- =====================================================================
-- PHASE 12 — ski slopes & sled routes.
--
-- The sled routes reuse the Phase 7 scoring pipeline exactly as it stands
-- (start_minigame -> submit_minigame_score -> server-side coin payout). Nothing here adds a
-- table, an RPC or a second rewards path: each slope is registered as a scoreable game id, so
-- leaderboards, personal bests and the Anchor Coin payout all work with no client changes.
--
-- Columns, for reference: max_score, max_score_per_sec, min_duration_ms, max_duration_ms, reward_min_ms, rewards.
--
-- Anti-cheat ceilings are derived from the real courses in src/world/skiAreas.js:
--   max_score          ~2x a perfect run (every coin, no hits, comfortably under par)
--   max_score_per_sec  a full run is 30-50s, so a legitimate rate sits around 120-200/s
--   min_duration_ms    the route cannot physically be ridden faster than this at maxSpeed
--   max_duration_ms    generous ceiling for someone stopping to admire the view
--
-- Safe to re-run.
-- =====================================================================

insert into public.minigames (id, name, max_score, max_score_per_sec, min_duration_ms, max_duration_ms, reward_min_ms, rewards) values
  ('slope_beginner', 'Beginner Hill',      7000,  200,  6000, 180000, 5000,
    '[{"min":1,"coins":8},{"min":1200,"coins":20},{"min":2000,"coins":38},{"min":2800,"coins":62},{"min":3600,"coins":90}]'),
  ('slope_forest',   'Forest Slope',       9000,  230,  6500, 180000, 5000,
    '[{"min":1,"coins":10},{"min":1600,"coins":26},{"min":2600,"coins":48},{"min":3600,"coins":80},{"min":4800,"coins":120}]'),
  ('slope_ridge',    'Mountain Ridge',     11000, 250,  7000, 180000, 5000,
    '[{"min":1,"coins":12},{"min":1800,"coins":30},{"min":3000,"coins":58},{"min":4200,"coins":98},{"min":5600,"coins":150}]'),
  ('slope_extreme',  'Extreme Slope',      13000, 300,  6500, 180000, 5000,
    '[{"min":1,"coins":14},{"min":2200,"coins":36},{"min":3600,"coins":70},{"min":5000,"coins":125},{"min":6800,"coins":190}]'),
  ('slope_hidden',   'Hidden Snow Valley', 11000, 260,  6000, 180000, 5000,
    '[{"min":1,"coins":12},{"min":1700,"coins":32},{"min":2900,"coins":62},{"min":4100,"coins":108},{"min":5400,"coins":170}]')
on conflict (id) do update set name = excluded.name, max_score = excluded.max_score, max_score_per_sec = excluded.max_score_per_sec,
  min_duration_ms = excluded.min_duration_ms, max_duration_ms = excluded.max_duration_ms, reward_min_ms = excluded.reward_min_ms,
  rewards = excluded.rewards;
