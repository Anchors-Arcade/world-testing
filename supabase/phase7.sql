-- =====================================================================
-- ANCHORS WORLD · PHASE 7 — Minigames, scores, rewards, leaderboards
-- Run AFTER schema.sql, phase5.sql and phase6.sql. Safe to re-run.
--
-- Trust model
--   * The browser never says WHO it is and never says how many coins it earned.
--   * start_minigame()         opens a one-use, server-timed session for auth.uid().
--   * submit_minigame_score()  validates the result against that session (score range, score-per-second ceiling,
--                              duration vs. the server clock), computes the reward from a server-side tier table,
--                              applies hourly/daily limits, updates the personal best and pays the coins.
--   * Players have NO insert/update/delete rights on any of these tables; reads go through RPCs (or own-row RLS).
-- Stronger anti-cheat later: the `stats` column already stores per-run counters (hits, catches, ...) you can check
-- in submit_minigame_score(), and rejected sessions are kept (status = 'rejected') so abusers are easy to find.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Minigame catalogue (limits + reward tiers live HERE, on the server)
-- ---------------------------------------------------------------------
create table if not exists public.minigames (
  id                text primary key check (id ~ '^[a-z][a-z0-9_]{2,31}$'),
  name              text not null,
  enabled           boolean not null default true,
  min_score         integer not null default 0 check (min_score >= 0),
  max_score         integer not null check (max_score > 0),
  max_score_per_sec numeric not null check (max_score_per_sec > 0),      -- impossible-score ceiling: score <= rate * seconds played
  min_duration_ms   integer not null check (min_duration_ms > 0),        -- faster than this cannot be a real run
  max_duration_ms   integer not null,
  reward_min_ms     integer not null default 0,                          -- shorter runs are saved but earn no coins
  rewards           jsonb not null,                                      -- [{"min":<score>,"coins":<n>}, ...] highest matching tier wins
  check (max_score >= min_score and max_duration_ms > min_duration_ms),
  check (jsonb_typeof(rewards) = 'array')
);

insert into public.minigames (id, name, max_score, max_score_per_sec, min_duration_ms, max_duration_ms, reward_min_ms, rewards) values
  ('snow_dash',      'Snow Dash',      10000, 800, 12000, 180000, 12000,
    '[{"min":1,"coins":10},{"min":3000,"coins":25},{"min":5500,"coins":50},{"min":7500,"coins":80},{"min":9000,"coins":125}]'),
  ('coin_catcher',   'Coin Catcher',    9000, 250,  5000,  60000, 20000,
    '[{"min":1,"coins":8},{"min":800,"coins":20},{"min":1800,"coins":40},{"min":3000,"coins":70},{"min":4500,"coins":110}]'),
  ('snowball_arena', 'Snowball Arena',  9000, 250,  5000,  60000, 20000,
    '[{"min":1,"coins":8},{"min":500,"coins":20},{"min":1200,"coins":40},{"min":2200,"coins":70},{"min":3500,"coins":110}]')
on conflict (id) do update set name = excluded.name, max_score = excluded.max_score, max_score_per_sec = excluded.max_score_per_sec,
  min_duration_ms = excluded.min_duration_ms, max_duration_ms = excluded.max_duration_ms, reward_min_ms = excluded.reward_min_ms,
  rewards = excluded.rewards;

-- ---------------------------------------------------------------------
-- 2. Sessions (one per run; single use) , scores (history) , bests (one row per player+game)
-- ---------------------------------------------------------------------
create table if not exists public.minigame_sessions (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.profiles(id) on delete cascade,
  minigame_id text not null references public.minigames(id),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      text not null default 'active' check (status in ('active', 'completed', 'rejected', 'expired')),
  reject_reason text
);
create index if not exists minigame_sessions_player on public.minigame_sessions (player_id, started_at desc);

create table if not exists public.minigame_scores (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.profiles(id) on delete cascade,
  minigame_id   text not null references public.minigames(id),
  session_id    uuid unique references public.minigame_sessions(id) on delete set null,
  score         integer not null check (score >= 0),
  duration_ms   integer not null check (duration_ms > 0),
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  stats         jsonb not null default '{}'::jsonb check (pg_column_size(stats) <= 2000),
  created_at    timestamptz not null default now()
);
-- player history ("my scores") and the daily coin cap
create index if not exists minigame_scores_player on public.minigame_scores (player_id, minigame_id, created_at desc);
create index if not exists minigame_scores_player_time on public.minigame_scores (player_id, created_at desc);
-- daily / weekly / monthly leaderboards (window on created_at, aggregate score per player)
create index if not exists minigame_scores_game_time on public.minigame_scores (minigame_id, created_at desc) include (score, player_id);
-- "top N of a game": served straight from this index, no sort
create index if not exists minigame_scores_game_score on public.minigame_scores (minigame_id, score desc, created_at);

create table if not exists public.minigame_bests (
  player_id        uuid not null references public.profiles(id) on delete cascade,
  minigame_id      text not null references public.minigames(id),
  best_score       integer not null check (best_score >= 0),
  best_duration_ms integer not null check (best_duration_ms > 0),
  best_at          timestamptz not null default now(),
  plays            integer not null default 1 check (plays >= 1),
  primary key (player_id, minigame_id)
);
-- the all-time leaderboard: ordered exactly like the query (score desc, earliest achiever wins ties)
create index if not exists minigame_bests_rank on public.minigame_bests (minigame_id, best_score desc, best_at asc);

-- ---------------------------------------------------------------------
-- 3. Row Level Security: nobody writes directly; players may read only their own rows
-- ---------------------------------------------------------------------
alter table public.minigames         enable row level security;
alter table public.minigame_sessions enable row level security;
alter table public.minigame_scores   enable row level security;
alter table public.minigame_bests    enable row level security;

revoke all on public.minigames, public.minigame_sessions, public.minigame_scores, public.minigame_bests from anon, authenticated;
grant select on public.minigame_scores, public.minigame_bests to authenticated;

drop policy if exists "own scores" on public.minigame_scores;
create policy "own scores" on public.minigame_scores for select to authenticated using (player_id = auth.uid());
drop policy if exists "own bests" on public.minigame_bests;
create policy "own bests" on public.minigame_bests for select to authenticated using (player_id = auth.uid());
-- minigames and minigame_sessions: RLS on, no policy, no grant = reachable only through the functions below.

-- ---------------------------------------------------------------------
-- 4. Limits
-- ---------------------------------------------------------------------
create or replace function public.minigame_daily_cap() returns integer language sql immutable as $$ select 1500 $$;   -- max coins per UTC day from all minigames
create or replace function public._utc_day_start() returns timestamptz language sql stable as $$
  select date_trunc('day', now() at time zone 'utc') at time zone 'utc' $$;

-- ---------------------------------------------------------------------
-- 5. start_minigame(game) -> session id
--    One live run per player, >= 2 s between starts, <= 120 runs per hour. The server clock starts here.
-- ---------------------------------------------------------------------
create or replace function public.start_minigame(p_game text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); last_start timestamptz; recent integer; sid uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.minigames where id = p_game and enabled) then raise exception 'Unknown minigame'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 7));          -- serialise per player: parallel calls cannot dodge the limits
  select max(started_at) into last_start from public.minigame_sessions where player_id = uid;
  if last_start is not null and now() - last_start < interval '2 seconds' then raise exception 'Slow down a little!'; end if;
  select count(*) into recent from public.minigame_sessions where player_id = uid and started_at > now() - interval '1 hour';
  if recent >= 120 then raise exception 'That is a lot of games! Take a short break.'; end if;
  update public.minigame_sessions set status = 'expired', finished_at = now() where player_id = uid and status = 'active';
  insert into public.minigame_sessions (player_id, minigame_id) values (uid, p_game) returning id into sid;
  return sid;
end $$;

-- ---------------------------------------------------------------------
-- 6. submit_minigame_score(session, score, duration_ms, stats) -> result json
--    {ok, score, previous_best, best, new_best, first_play, coins, capped, balance, rank, plays, daily_earned, daily_cap}
--    or {ok:false, error}. A rejected run burns its session.
-- ---------------------------------------------------------------------
create or replace function public.submit_minigame_score(p_session uuid, p_score integer, p_duration_ms integer, p_stats jsonb default '{}'::jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); s public.minigame_sessions; g public.minigames;
  elapsed_ms bigint; reason text; v_stats jsonb := coalesce(p_stats, '{}'::jsonb);
  award integer := 0; raw_award integer := 0; earned_today integer; cap integer := public.minigame_daily_cap();
  prev integer; prev_plays integer; new_best integer; my_at timestamptz; bal integer; rk integer; plays_now integer; is_best boolean;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 7));

  select * into s from public.minigame_sessions where id = p_session for update;
  if not found or s.player_id <> uid then raise exception 'Unknown game session'; end if;      -- someone else's session id looks the same as a missing one
  if s.status <> 'active' then raise exception 'This game was already submitted'; end if;
  select * into g from public.minigames where id = s.minigame_id;

  elapsed_ms := (extract(epoch from (now() - s.started_at)) * 1000)::bigint;
  reason := case
    when p_score is null or p_duration_ms is null                                   then 'Missing result'
    when elapsed_ms > 30 * 60 * 1000                                                then 'Game session expired'
    when p_duration_ms < g.min_duration_ms or p_duration_ms > g.max_duration_ms     then 'Impossible game length'
    when p_duration_ms > elapsed_ms + 2000                                          then 'Game length does not match the clock'
    when p_score < g.min_score or p_score > g.max_score                             then 'Score out of range'
    when p_score > ceil(g.max_score_per_sec * (p_duration_ms / 1000.0)) + 50        then 'Score too high for the time played'
    else null end;
  if reason is not null then
    update public.minigame_sessions set status = 'rejected', reject_reason = reason, finished_at = now() where id = s.id;
    return jsonb_build_object('ok', false, 'error', 'Score could not be verified (' || lower(reason) || ')');   -- returned, not raised, so the rejection is committed
  end if;
  if jsonb_typeof(v_stats) <> 'object' or length(v_stats::text) > 1000 then v_stats := '{}'::jsonb; end if;

  -- reward: tier table is server-side; short runs earn nothing; hard daily cap
  if p_duration_ms >= g.reward_min_ms then
    select coalesce(max((e ->> 'coins')::integer), 0) into raw_award
      from jsonb_array_elements(g.rewards) e where (e ->> 'min')::integer <= p_score;
  end if;
  select coalesce(sum(coins_awarded), 0) into earned_today from public.minigame_scores where player_id = uid and created_at >= public._utc_day_start();
  award := least(raw_award, greatest(cap - earned_today, 0));

  insert into public.minigame_scores (player_id, minigame_id, session_id, score, duration_ms, coins_awarded, stats)
    values (uid, g.id, s.id, p_score, p_duration_ms, award, v_stats);
  update public.minigame_sessions set status = 'completed', finished_at = now() where id = s.id;

  select best_score into prev from public.minigame_bests where player_id = uid and minigame_id = g.id for update;
  is_best := prev is null or p_score > prev;
  insert into public.minigame_bests as b (player_id, minigame_id, best_score, best_duration_ms, best_at, plays)
    values (uid, g.id, p_score, p_duration_ms, now(), 1)
  on conflict (player_id, minigame_id) do update set
    plays            = b.plays + 1,
    best_score       = greatest(b.best_score, excluded.best_score),
    best_duration_ms = case when excluded.best_score > b.best_score then excluded.best_duration_ms else b.best_duration_ms end,
    best_at          = case when excluded.best_score > b.best_score then now() else b.best_at end;
  select best_score, best_at, plays into new_best, my_at, plays_now from public.minigame_bests where player_id = uid and minigame_id = g.id;

  if award > 0 then update public.profiles set coins = coins + award where id = uid; end if;
  select coins into bal from public.profiles where id = uid;
  select 1 + count(*) into rk from public.minigame_bests
    where minigame_id = g.id and (best_score > new_best or (best_score = new_best and best_at < my_at));

  return jsonb_build_object('ok', true, 'score', p_score, 'previous_best', prev, 'best', new_best,
    'new_best', is_best and prev is not null, 'first_play', prev is null,
    'coins', award, 'capped', raw_award > award, 'balance', bal, 'rank', rk, 'plays', plays_now,
    'daily_earned', earned_today + award, 'daily_cap', cap);
end $$;

-- ---------------------------------------------------------------------
-- 7. get_leaderboard(game, scope, limit)
--    scope: 'global' (all-time, one row per player from minigame_bests) | 'daily' | 'weekly' | 'monthly' (UTC windows, best run
--           in the window) | 'personal' (the caller's own recent runs).  New windows = one more CASE branch.
--    -> {game, scope, entries:[{rank,player_id,username,display_name,avatar_data,score}], me:{rank,score}|null}
--       personal: entries:[{score,duration_ms,coins,played_at}], me:{score} = personal best
-- ---------------------------------------------------------------------
create or replace function public.get_leaderboard(p_game text, p_scope text default 'global', p_limit integer default 20)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); lim integer := least(greatest(coalesce(p_limit, 20), 1), 50);
  since timestamptz; entries jsonb; mine integer; mine_at timestamptz; my_rank integer;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if not exists (select 1 from public.minigames where id = p_game) then raise exception 'Unknown minigame'; end if;

  if p_scope = 'personal' then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.played_at desc), '[]'::jsonb) into entries from (
      select score, duration_ms, coins_awarded as coins, created_at as played_at
        from public.minigame_scores where player_id = uid and minigame_id = p_game order by created_at desc limit lim) r;
    select best_score into mine from public.minigame_bests where player_id = uid and minigame_id = p_game;
    return jsonb_build_object('game', p_game, 'scope', 'personal', 'entries', entries,
      'me', case when mine is null then null else jsonb_build_object('score', mine) end);
  end if;

  since := case p_scope
    when 'global'  then null
    when 'daily'   then public._utc_day_start()
    when 'weekly'  then date_trunc('week', now() at time zone 'utc') at time zone 'utc'
    when 'monthly' then date_trunc('month', now() at time zone 'utc') at time zone 'utc'
    else null end;
  if p_scope not in ('global', 'daily', 'weekly', 'monthly') then raise exception 'Unknown leaderboard'; end if;

  if since is null then
    select coalesce(jsonb_agg(to_jsonb(r) order by r.rank), '[]'::jsonb) into entries from (
      select t.rk as rank, t.player_id, p.username, p.display_name, p.avatar_data, t.score
        from (select row_number() over (order by x.best_score desc, x.best_at asc) as rk, x.player_id, x.best_score as score
                from (select player_id, best_score, best_at from public.minigame_bests where minigame_id = p_game
                      order by best_score desc, best_at asc limit lim) x) t
        join public.profiles p on p.id = t.player_id) r;
    select best_score, best_at into mine, mine_at from public.minigame_bests where player_id = uid and minigame_id = p_game;
    if mine is not null then
      select 1 + count(*) into my_rank from public.minigame_bests
        where minigame_id = p_game and (best_score > mine or (best_score = mine and best_at < mine_at));
    end if;
  else
    select coalesce(jsonb_agg(to_jsonb(r) order by r.rank), '[]'::jsonb) into entries from (
      select t.rk as rank, t.player_id, p.username, p.display_name, p.avatar_data, t.score
        from (select row_number() over (order by x.score desc, x.ts asc) as rk, x.player_id, x.score
                from (select s.player_id, max(s.score) as score, (array_agg(s.created_at order by s.score desc, s.created_at asc))[1] as ts
                        from public.minigame_scores s where s.minigame_id = p_game and s.created_at >= since
                        group by s.player_id order by max(s.score) desc, 3 asc limit lim) x) t
        join public.profiles p on p.id = t.player_id) r;
    select max(score) into mine from public.minigame_scores where player_id = uid and minigame_id = p_game and created_at >= since;
    if mine is not null then
      select 1 + count(*) into my_rank from (
        select 1 from public.minigame_scores where minigame_id = p_game and created_at >= since
        group by player_id having max(score) > mine) q;
    end if;
  end if;

  return jsonb_build_object('game', p_game, 'scope', p_scope, 'entries', entries,
    'me', case when mine is null then null else jsonb_build_object('rank', my_rank, 'score', mine) end);
end $$;

-- ---------------------------------------------------------------------
-- 8. get_arcade_overview() -> everything the Arcade screen needs in ONE request
--    {games:[{id,name,max_reward,reward_min_ms,max_duration_ms,rewards}], bests:{<id>:{best_score,plays}}, earned_today, daily_cap}
-- ---------------------------------------------------------------------
create or replace function public.get_arcade_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  return jsonb_build_object(
    'games', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'rewards', g.rewards, 'reward_min_ms', g.reward_min_ms,
                'max_duration_ms', g.max_duration_ms,
                'max_reward', (select coalesce(max((e ->> 'coins')::integer), 0) from jsonb_array_elements(g.rewards) e)) order by g.id), '[]'::jsonb)
                from public.minigames g where g.enabled),
    'bests', (select coalesce(jsonb_object_agg(b.minigame_id, jsonb_build_object('best_score', b.best_score, 'plays', b.plays)), '{}'::jsonb)
                from public.minigame_bests b where b.player_id = uid),
    'earned_today', (select coalesce(sum(coins_awarded), 0) from public.minigame_scores where player_id = uid and created_at >= public._utc_day_start()),
    'daily_cap', public.minigame_daily_cap());
end $$;

-- ---------------------------------------------------------------------
-- 9. Housekeeping + permissions
-- ---------------------------------------------------------------------
-- Schedule with pg_cron (see the end of phase6.sql for the pattern):  select cron.schedule('prune-minigames', '15 4 * * *', 'select public.prune_minigame_data()');
create or replace function public.prune_minigame_data() returns void
language sql security definer set search_path = public as $$
  delete from public.minigame_sessions where started_at < now() - interval '2 days' and status <> 'completed';
  delete from public.minigame_scores   where created_at < now() - interval '120 days';   -- bests are kept forever; monthly boards need < 31 days
$$;

revoke all on function public.start_minigame(text), public.submit_minigame_score(uuid, integer, integer, jsonb),
  public.get_leaderboard(text, text, integer), public.get_arcade_overview(), public.minigame_daily_cap(), public._utc_day_start(),
  public.prune_minigame_data() from public, anon;
grant execute on function public.start_minigame(text), public.submit_minigame_score(uuid, integer, integer, jsonb),
  public.get_leaderboard(text, text, integer), public.get_arcade_overview() to authenticated;
-- internal helpers and housekeeping are not callable through the API at all
revoke all on function public.minigame_daily_cap(), public._utc_day_start(), public.prune_minigame_data() from authenticated;
