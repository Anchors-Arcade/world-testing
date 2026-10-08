-- =====================================================================
-- ANCHORS WORLD · PHASE 11 — Slope Sled Run + Snow Runner (the missing catalogue rows)
-- Run AFTER phase7.sql (it extends the same `minigames` table). Safe to re-run.
--
-- These two arcade cabinets shipped in the client (src/minigames/SledRun.js and SnowRunner.js,
-- registered in src/minigames/registry.js) but their rows were never added to the database, so
-- start_minigame() rejected them with "Unknown minigame" and neither game could be played at all.
-- This file is that missing half: the same catalogue, the same checks, the same payout path as every
-- other game — the browser still never sends a player id or a coin amount.
--
-- Columns, for reference: max_score, max_score_per_sec, min_duration_ms, max_duration_ms, reward_min_ms, rewards.
-- The ceilings mirror src/minigames/scoring.js (MAX_SCORE) and src/minigames/rewards.js (FALLBACK_TIERS);
-- scripts/test-phase7.mjs fails if the two ever drift apart again.
-- =====================================================================

insert into public.minigames (id, name, max_score, max_score_per_sec, min_duration_ms, max_duration_ms, reward_min_ms, rewards) values
  ('slope_sled',   'Slope Sled Run', 10000, 260, 8000, 180000, 15000,
    '[{"min":1,"coins":8},{"min":1000,"coins":20},{"min":2500,"coins":40},{"min":4000,"coins":70},{"min":5500,"coins":110}]'),
  ('snow_runner',  'Snow Runner',    10000, 240, 5000, 240000, 15000,
    '[{"min":1,"coins":8},{"min":800,"coins":20},{"min":1800,"coins":40},{"min":3200,"coins":70},{"min":5000,"coins":110}]')
on conflict (id) do update set name = excluded.name, max_score = excluded.max_score, max_score_per_sec = excluded.max_score_per_sec,
  min_duration_ms = excluded.min_duration_ms, max_duration_ms = excluded.max_duration_ms, reward_min_ms = excluded.reward_min_ms,
  rewards = excluded.rewards, enabled = true;
