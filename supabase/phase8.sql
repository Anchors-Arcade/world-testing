-- =====================================================================
-- ANCHORS WORLD · PHASE 8 — World expansion, exploration, collectibles,
--                            secrets, achievements
-- Run AFTER schema.sql, phase5.sql, phase6.sql and phase7.sql. Safe to re-run.
--
-- Trust model (same shape as Phase 7)
--   * The browser never sends a player id, a coin amount or "unlocked = true".
--   * collect_collectible(id)      -> the server checks the item exists, is enabled, is not gated behind an
--                                     undiscovered secret and was not already collected, then pays its OWN reward.
--   * find_clue(secret, clue)      -> the server checks the clue belongs to that secret, stores it, and only when
--                                     every required clue is in does it mark the secret discovered and pay its reward.
--   * visit_room(room)             -> records first visits (world-map discovery + the "rooms visited" achievement).
--   * Achievement progress is RECOMPUTED from real rows (collectibles, secrets, friendships, furniture, arcade bests,
--     visited rooms) inside _sync_achievements(); the client cannot set progress or claim a reward.
--   * Players have NO insert/update/delete rights on any Phase 8 table. Catalogue tables are read-only; the
--     player_* tables are own-row select only.
--
-- Note on ids: the catalogue tables (collectibles, secrets, achievements) use short stable TEXT ids, exactly like
-- `minigames` and `items` in the earlier phases, so the client catalogue and the SQL seed can be diffed by a test.
-- Every per-player row uses a uuid primary key, foreign keys, indexes, timestamps and RLS as required.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catalogues (the server's own copy of the world: positions + rewards)
-- ---------------------------------------------------------------------
create table if not exists public.secrets (
  id           text primary key check (id ~ '^[a-z][a-z0-9_]{2,39}$'),
  name         text not null,
  description  text not null default '',
  room_id      text not null,                                -- where the secret lives (client map key)
  clues        text[] not null default '{}',                  -- every clue that must be found; one clue = a one-step secret
  reward       integer not null default 0 check (reward >= 0 and reward <= 2000),
  unlocks_room text,                                          -- hidden room this secret opens (client map key), if any
  enabled      boolean not null default true,
  created_at   timestamptz not null default now(),
  check (cardinality(clues) between 1 and 8)
);

create table if not exists public.collectibles (
  id              text primary key check (id ~ '^[a-z][a-z0-9_]{2,39}$'),
  name            text not null,
  description     text not null default '',
  room_id         text not null,
  x               integer not null check (x between 0 and 4000),
  y               integer not null check (y between 0 and 4000),
  rarity          text not null default 'common' check (rarity in ('common','uncommon','rare','epic','legendary')),
  reward          integer not null default 0 check (reward >= 0 and reward <= 1000),
  requires_secret text references public.secrets(id) on delete set null,   -- hidden until that secret is discovered
  enabled         boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists collectibles_room on public.collectibles (room_id) where enabled;

create table if not exists public.achievements (
  id           text primary key check (id ~ '^[a-z][a-z0-9_]{2,39}$'),
  name         text not null,
  description  text not null default '',
  icon         text not null default '🏅',
  metric       text not null check (metric in ('collectibles','secrets','friends','furniture','arcade','rooms')),
  goal         integer not null check (goal > 0),
  reward       integer not null default 0 check (reward >= 0 and reward <= 5000),   -- Anchor Coins
  reward_item  text references public.items(id) on delete set null,                 -- optional cosmetic
  sort         integer not null default 100,
  enabled      boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Per-player progress
-- ---------------------------------------------------------------------
create table if not exists public.player_collectibles (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references public.profiles(id) on delete cascade,
  collectible_id  text not null references public.collectibles(id) on delete cascade,
  coins_awarded   integer not null default 0 check (coins_awarded >= 0),
  collected_at    timestamptz not null default now(),
  unique (player_id, collectible_id)                              -- the duplicate-reward guard, enforced by the database
);
create index if not exists player_collectibles_player on public.player_collectibles (player_id, collected_at desc);

create table if not exists public.player_secret_clues (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.profiles(id) on delete cascade,
  secret_id  text not null references public.secrets(id) on delete cascade,
  clue_id    text not null,
  found_at   timestamptz not null default now(),
  unique (player_id, secret_id, clue_id)
);
create index if not exists player_secret_clues_player on public.player_secret_clues (player_id, secret_id);

create table if not exists public.player_secrets (
  id            uuid primary key default gen_random_uuid(),
  player_id     uuid not null references public.profiles(id) on delete cascade,
  secret_id     text not null references public.secrets(id) on delete cascade,
  coins_awarded integer not null default 0 check (coins_awarded >= 0),
  discovered_at timestamptz not null default now(),
  unique (player_id, secret_id)
);
create index if not exists player_secrets_player on public.player_secrets (player_id, discovered_at desc);

create table if not exists public.player_achievements (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.profiles(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  progress       integer not null default 0 check (progress >= 0),
  coins_awarded  integer not null default 0 check (coins_awarded >= 0),
  completed_at   timestamptz,
  updated_at     timestamptz not null default now(),
  unique (player_id, achievement_id)
);
create index if not exists player_achievements_player on public.player_achievements (player_id, completed_at desc nulls last);

create table if not exists public.player_world_rooms (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.profiles(id) on delete cascade,
  room_id     text not null,
  visits      integer not null default 1 check (visits >= 1),
  first_at    timestamptz not null default now(),
  last_at     timestamptz not null default now(),
  unique (player_id, room_id)
);
create index if not exists player_world_rooms_player on public.player_world_rooms (player_id, first_at);

-- ---------------------------------------------------------------------
-- 3. Row Level Security: catalogues are read-only, progress is own-row, nobody writes directly
-- ---------------------------------------------------------------------
alter table public.secrets              enable row level security;
alter table public.collectibles         enable row level security;
alter table public.achievements         enable row level security;
alter table public.player_collectibles  enable row level security;
alter table public.player_secret_clues  enable row level security;
alter table public.player_secrets       enable row level security;
alter table public.player_achievements  enable row level security;
alter table public.player_world_rooms   enable row level security;

revoke all on public.secrets, public.collectibles, public.achievements, public.player_collectibles,
  public.player_secret_clues, public.player_secrets, public.player_achievements, public.player_world_rooms
  from anon, authenticated;

-- Reads only. Every write below happens inside a SECURITY DEFINER function.
grant select on public.achievements, public.player_collectibles, public.player_secret_clues,
  public.player_secrets, public.player_achievements, public.player_world_rooms to authenticated;

drop policy if exists "read achievements" on public.achievements;
create policy "read achievements" on public.achievements for select to authenticated using (enabled);

drop policy if exists "own collectibles" on public.player_collectibles;
create policy "own collectibles" on public.player_collectibles for select to authenticated using (player_id = auth.uid());
drop policy if exists "own clues" on public.player_secret_clues;
create policy "own clues" on public.player_secret_clues for select to authenticated using (player_id = auth.uid());
drop policy if exists "own secrets" on public.player_secrets;
create policy "own secrets" on public.player_secrets for select to authenticated using (player_id = auth.uid());
drop policy if exists "own achievements" on public.player_achievements;
create policy "own achievements" on public.player_achievements for select to authenticated using (player_id = auth.uid());
drop policy if exists "own visits" on public.player_world_rooms;
create policy "own visits" on public.player_world_rooms for select to authenticated using (player_id = auth.uid());

-- `secrets` and `collectibles` keep RLS on with NO policy and NO grant: the catalogue of where things are hidden is
-- only ever served through get_exploration(), which filters out anything gated behind a secret you have not found.

-- ---------------------------------------------------------------------
-- 4. Seed: the world's secrets, collectibles and achievements
--    Mirrored in src/world/collectibles.js, src/world/secrets.js and src/world/achievements.js
--    (scripts/test-phase8.mjs fails if the two drift apart).
-- ---------------------------------------------------------------------
insert into public.secrets (id, name, description, room_id, clues, reward, unlocks_room) values
  ('hollow_crack',    'The Cracked Wall',      'Three glowing marks in the Ice Caves point at a wall that is not a wall.', 'ice_caves',     array['mark_a','mark_b','mark_c'], 250, 'crystal_hollow'),
  ('star_alignment',  'The Star Alignment',    'Line up the Observatory dials the way the old chart shows.',               'observatory',   array['dial_north','dial_west','old_chart'], 250, 'star_chamber'),
  ('lantern_signal',  'The Lantern Signal',    'Somebody still lights the lamp at the top of the lighthouse.',             'lighthouse',    array['lamp_switch'],            120, null),
  ('buried_cache',    'The Buried Cache',      'One of the snow piles at the camp is suspiciously neat.',                  'snow_camp',     array['neat_pile'],              120, null),
  ('whistling_pines', 'The Whistling Pines',   'Four pines in the Deep Forest hum when the wind turns.',                   'deep_forest',   array['pine_1','pine_2','pine_3','pine_4'], 200, null),
  ('frozen_message',  'The Message in the Ice','Something is frozen into the middle of the lake.',                         'frozen_lake',   array['ice_bubble'],             120, null),
  ('cairn_road',      'The Cairn Road',        'Stack the three fallen cairns and the old pass road reappears.',           'mountain_pass', array['cairn_1','cairn_2','cairn_3'], 200, null)
on conflict (id) do update set name = excluded.name, description = excluded.description, room_id = excluded.room_id,
  clues = excluded.clues, reward = excluded.reward, unlocks_room = excluded.unlocks_room, enabled = true;

insert into public.collectibles (id, name, description, room_id, x, y, rarity, reward, requires_secret) values
  -- Snowy Plaza (the starter area: easy finds that teach the mechanic)
  ('flake_plaza_1',  'Plaza Snowflake',    'Caught on the lamp post by the main path.',            'snowy_plaza',   1120, 880,  'common',    15, null),
  ('flake_plaza_2',  'Rooftop Snowflake',  'Blew off the Town Hall roof and never melted.',        'snowy_plaza',   300,  430,  'common',    15, null),
  -- Deep Forest
  ('flake_forest_1', 'Pinewood Flake',     'Resting on a low branch.',                             'deep_forest',   260,  300,  'common',    15, null),
  ('flake_forest_2', 'Hollow Log Flake',   'Tucked inside a hollow log.',                           'deep_forest',   1320, 760,  'uncommon',  25, null),
  ('lost_compass',   'Lost Compass',       'Someone walked out of these woods without it.',         'deep_forest',   820,  200,  'rare',      60, null),
  ('pine_badge',     'Whistling Pine Badge','Left by whoever tuned the four pines.',                'deep_forest',   900,  900,  'epic',     120, 'whistling_pines'),
  -- Snow Camp
  ('flake_camp_1',   'Campfire Flake',     'It refuses to melt, right next to the fire.',           'snow_camp',     640,  520,  'uncommon',  25, null),
  ('old_kettle',     'Dented Kettle',      'Still smells faintly of cocoa.',                        'snow_camp',     300,  300,  'uncommon',  30, null),
  ('camp_journal',   'Torn Journal Page',  'Half a map and a very bad drawing of a penguin.',       'snow_camp',     1180, 640,  'rare',      60, null),
  ('cache_medal',    'Explorer Medal',     'The reward in the buried cache.',                        'snow_camp',     1020, 300,  'epic',     120, 'buried_cache'),
  -- Frozen Lake
  ('flake_lake_1',   'Lakeside Flake',     'On the reeds at the shore.',                            'frozen_lake',   220,  760,  'common',    15, null),
  ('flake_lake_2',   'Black Ice Flake',    'Frozen flat into the darkest patch of ice.',            'frozen_lake',   1260, 420,  'uncommon',  25, null),
  ('skate_key',      'Old Skate Key',      'For skates nobody makes any more.',                     'frozen_lake',   780,  880,  'rare',      60, null),
  ('ice_locket',     'Locket in the Ice',  'What was frozen into the middle of the lake.',          'frozen_lake',   800,  500,  'epic',     120, 'frozen_message'),
  -- Harbor Village
  ('flake_harbor_1', 'Dockside Flake',     'Stuck to a mooring post.',                              'harbor_village',380,  820,  'common',    15, null),
  ('fish_crate_coin','Crate Coin',         'Wedged between two crates on the pier.',                'harbor_village',1340, 700,  'uncommon',  25, null),
  ('rope_charm',     'Sailor''s Charm',    'A knot nobody can untie.',                              'harbor_village',940,  280,  'rare',      60, null),
  -- Lighthouse
  ('lamp_flake',     'Lamp Room Flake',    'Came in through the broken pane.',                      'lighthouse',    300,  300,  'uncommon',  25, null),
  ('keeper_log',     'Keeper''s Logbook',  'The last entry is just a drawing of a star.',           'lighthouse',    700,  260,  'epic',     120, 'lantern_signal'),
  -- Mountain Pass
  ('flake_pass_1',   'Windswept Flake',    'Pinned against a boulder.',                             'mountain_pass', 260,  620,  'common',    15, null),
  ('flake_pass_2',   'Summit Flake',       'The highest flake in Anchors World.',                    'mountain_pass', 1180, 220,  'rare',      50, null),
  ('rusted_piton',   'Rusted Piton',       'Someone climbed here a very long time ago.',            'mountain_pass', 700,  820,  'uncommon',  30, null),
  ('cairn_stone',    'Marker Stone',       'The top stone of the rebuilt cairn road.',              'mountain_pass', 1000, 480,  'epic',     120, 'cairn_road'),
  -- Ice Caves
  ('crystal_blue',   'Blue Crystal',       'Grown in the cold dark.',                               'ice_caves',     300,  420,  'uncommon',  30, null),
  ('crystal_green',  'Green Crystal',      'Warm to the touch, somehow.',                           'ice_caves',     1180, 540,  'rare',      60, null),
  ('cave_flake',     'Cave Flake',         'Drifted deeper than any flake should.',                 'ice_caves',     740,  700,  'common',    20, null),
  -- Crystal Hollow (secret room)
  ('crystal_heart',  'Crystal Heart',      'The thing the cracked wall was hiding.',                'crystal_hollow',500,  360,  'legendary',250, 'hollow_crack'),
  ('crystal_shard',  'Hollow Shard',       'A piece that broke off long ago.',                      'crystal_hollow',800,  520,  'epic',     120, 'hollow_crack'),
  -- Old Observatory
  ('brass_lens',     'Brass Lens',         'Dropped behind the big telescope.',                      'observatory',   220,  420,  'uncommon',  30, null),
  ('star_chart',     'Faded Star Chart',   'Three constellations are circled in ink.',              'observatory',   800,  300,  'rare',      60, null),
  -- Star Chamber (secret room)
  ('comet_fragment', 'Comet Fragment',     'Still faintly warm after all this time.',               'star_chamber',   480, 340,  'legendary',250, 'star_alignment'),
  ('orrery_gear',    'Orrery Gear',        'One tooth missing; the sky still turns.',               'star_chamber',   740, 480,  'epic',     120, 'star_alignment')
on conflict (id) do update set name = excluded.name, description = excluded.description, room_id = excluded.room_id,
  x = excluded.x, y = excluded.y, rarity = excluded.rarity, reward = excluded.reward,
  requires_secret = excluded.requires_secret, enabled = true;

insert into public.achievements (id, name, description, icon, metric, goal, reward, sort) values
  ('first_find',     'First Find',      'Collect your first hidden item.',                 '⭐', 'collectibles', 1,     25, 10),
  ('snow_hunter',    'Snow Hunter',     'Collect 25 hidden collectibles.',                 '❄️', 'collectibles', 25,   400, 20),
  ('curator',        'Curator',         'Collect 10 hidden collectibles.',                 '🧊', 'collectibles', 10,   150, 15),
  ('completionist',  'Completionist',   'Collect every hidden item in the world.',         '👑', 'collectibles', 32,  1000, 30),
  ('explorer',       'Explorer',        'Discover 5 of the world''s secrets.',             '🔎', 'secrets',      5,    400, 40),
  ('first_secret',   'Curious Penguin', 'Discover your first secret.',                     '🕯️', 'secrets',      1,     50, 35),
  ('wanderer',       'Wanderer',        'Set foot in 12 different places.',                '🗺️', 'rooms',        12,   250, 50),
  ('arcade_master',  'Arcade Master',   'Reach 9,000 points across the arcade games.',     '🕹️', 'arcade',     9000,   350, 60),
  ('social_anchor',  'Social Anchor',   'Have 10 friends.',                                '🤝', 'friends',      10,   300, 70),
  ('room_designer',  'Room Designer',   'Place 20 pieces of furniture in your room.',      '🛋️', 'furniture',    20,   300, 80)
on conflict (id) do update set name = excluded.name, description = excluded.description, icon = excluded.icon,
  metric = excluded.metric, goal = excluded.goal, reward = excluded.reward, sort = excluded.sort, enabled = true;

-- ---------------------------------------------------------------------
-- 5. _sync_achievements(uid) -> jsonb array of achievements completed by THIS call
--    Progress is recomputed from the real rows every time; it is never sent by the client.
--    Rewards are paid here, exactly once (completed_at is the guard).
-- ---------------------------------------------------------------------
create or replace function public._sync_achievements(uid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a public.achievements; val integer; pa public.player_achievements; newly jsonb := '[]'::jsonb; pay integer;
begin
  if uid is null then return newly; end if;
  for a in select * from public.achievements where enabled order by sort, id loop
    val := case a.metric
      when 'collectibles' then (select count(*) from public.player_collectibles where player_id = uid)
      when 'secrets'      then (select count(*) from public.player_secrets      where player_id = uid)
      when 'rooms'        then (select count(*) from public.player_world_rooms  where player_id = uid)
      when 'friends'      then (select count(*) from public.friendships         where uid in (user_id, friend_id))
      when 'furniture'    then (select count(*) from public.room_furniture f join public.rooms r on r.id = f.room_id where r.owner_id = uid)
      when 'arcade'       then (select coalesce(sum(best_score), 0) from public.minigame_bests where player_id = uid)
      else 0 end;
    val := least(val, a.goal);                                  -- progress is clamped to the goal

    select * into pa from public.player_achievements where player_id = uid and achievement_id = a.id for update;
    if not found then
      insert into public.player_achievements (player_id, achievement_id, progress, completed_at)
        values (uid, a.id, val, case when val >= a.goal then now() else null end)
        returning * into pa;
    elsif pa.completed_at is null or pa.progress < val then
      update public.player_achievements set progress = greatest(progress, val), updated_at = now(),
        completed_at = case when pa.completed_at is not null then pa.completed_at when val >= a.goal then now() else null end
        where id = pa.id returning * into pa;
    end if;

    -- newly finished and not yet paid -> pay the reward once
    if pa.completed_at is not null and pa.coins_awarded = 0 and (a.reward > 0 or a.reward_item is not null) then
      pay := a.reward;
      if pay > 0 then update public.profiles set coins = coins + pay where id = uid; end if;
      if a.reward_item is not null then
        insert into public.inventory (user_id, item_id) values (uid, a.reward_item) on conflict do nothing;
      end if;
      update public.player_achievements set coins_awarded = greatest(pay, 1) where id = pa.id;   -- >=1 so the payment flag sticks
      newly := newly || jsonb_build_array(jsonb_build_object('id', a.id, 'name', a.name, 'icon', a.icon,
                'coins', pay, 'item', a.reward_item));
    elsif pa.completed_at is not null and pa.coins_awarded = 0 then
      update public.player_achievements set coins_awarded = 1 where id = pa.id;                   -- no reward: still mark as settled
      newly := newly || jsonb_build_array(jsonb_build_object('id', a.id, 'name', a.name, 'icon', a.icon, 'coins', 0, 'item', null));
    end if;
  end loop;
  return newly;
end $$;

-- ---------------------------------------------------------------------
-- 6. get_exploration() -> everything the exploration UI needs in ONE request
--    {collectibles:[{id,name,description,room_id,x,y,rarity,reward,collected}], secrets:[{id,name,description,room_id,
--     clues_found,clues_total,discovered,unlocks_room,reward}], achievements:[{id,name,description,icon,goal,progress,
--     reward,completed_at}], rooms:[room_id], unlocked_rooms:[room_id], totals:{collectibles,collected,secrets,found}}
--    Collectibles gated behind a secret you have NOT discovered are left out entirely: the client cannot even learn
--    where they are, let alone claim them.
-- ---------------------------------------------------------------------
create or replace function public.get_exploration() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); newly jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  newly := public._sync_achievements(uid);     -- friends / furniture / arcade goals can complete while you are elsewhere
  return jsonb_build_object(
    'collectibles', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'description', c.description,
                        'room_id', c.room_id, 'x', c.x, 'y', c.y, 'rarity', c.rarity, 'reward', c.reward,
                        'collected', pc.id is not null, 'collected_at', pc.collected_at) order by c.room_id, c.id), '[]'::jsonb)
                      from public.collectibles c
                      left join public.player_collectibles pc on pc.collectible_id = c.id and pc.player_id = uid
                      where c.enabled and (c.requires_secret is null
                        or exists (select 1 from public.player_secrets ps where ps.player_id = uid and ps.secret_id = c.requires_secret))),
    'secrets', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'description', s.description,
                    'room_id', s.room_id, 'clues_total', cardinality(s.clues), 'reward', s.reward,
                    'clues_found', (select count(*) from public.player_secret_clues pc where pc.player_id = uid and pc.secret_id = s.id),
                    'clues', (select coalesce(array_agg(pc.clue_id), '{}') from public.player_secret_clues pc where pc.player_id = uid and pc.secret_id = s.id),
                    'discovered', ps.id is not null,
                    'unlocks_room', case when ps.id is not null then s.unlocks_room else null end) order by s.id), '[]'::jsonb)
                  from public.secrets s
                  left join public.player_secrets ps on ps.secret_id = s.id and ps.player_id = uid
                  where s.enabled),
    'achievements', (select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'description', a.description,
                        'icon', a.icon, 'goal', a.goal, 'reward', a.reward, 'reward_item', a.reward_item,
                        'progress', coalesce(pa.progress, 0), 'completed_at', pa.completed_at) order by a.sort, a.id), '[]'::jsonb)
                      from public.achievements a
                      left join public.player_achievements pa on pa.achievement_id = a.id and pa.player_id = uid
                      where a.enabled),
    'rooms', (select coalesce(jsonb_agg(room_id order by first_at), '[]'::jsonb) from public.player_world_rooms where player_id = uid),
    'unlocked_rooms', (select coalesce(jsonb_agg(distinct s.unlocks_room), '[]'::jsonb) from public.player_secrets ps
                         join public.secrets s on s.id = ps.secret_id where ps.player_id = uid and s.unlocks_room is not null),
    'totals', jsonb_build_object(
      'collectibles', (select count(*) from public.collectibles where enabled),
      'collected',    (select count(*) from public.player_collectibles where player_id = uid),
      'secrets',      (select count(*) from public.secrets where enabled),
      'found',        (select count(*) from public.player_secrets where player_id = uid)),
    'unlocked', newly);
end $$;

-- ---------------------------------------------------------------------
-- 7. collect_collectible(id) -> {ok, id, coins, balance, collected, total, unlocked:[...]}
--    The only way a collectible is ever credited. Reward comes from the server's own row.
-- ---------------------------------------------------------------------
create or replace function public.collect_collectible(p_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.collectibles; bal integer; newly jsonb; got integer;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 8));           -- serialise this player's exploration writes
  select * into c from public.collectibles where id = p_id and enabled;
  if not found then raise exception 'Unknown collectible'; end if;
  if c.requires_secret is not null
     and not exists (select 1 from public.player_secrets where player_id = uid and secret_id = c.requires_secret)
  then raise exception 'You have not found that place yet'; end if;
  if exists (select 1 from public.player_collectibles where player_id = uid and collectible_id = c.id) then
    return jsonb_build_object('ok', false, 'error', 'already', 'id', c.id);   -- duplicate: no coins, not an error the player sees
  end if;

  insert into public.player_collectibles (player_id, collectible_id, coins_awarded) values (uid, c.id, c.reward);
  if c.reward > 0 then update public.profiles set coins = coins + c.reward where id = uid; end if;
  newly := public._sync_achievements(uid);
  select coins into bal from public.profiles where id = uid;
  select count(*) into got from public.player_collectibles where player_id = uid;

  return jsonb_build_object('ok', true, 'id', c.id, 'name', c.name, 'rarity', c.rarity, 'coins', c.reward,
    'balance', bal, 'collected', got, 'total', (select count(*) from public.collectibles where enabled), 'unlocked', newly);
end $$;

-- ---------------------------------------------------------------------
-- 8. find_clue(secret, clue) -> {ok, secret, clue, new, clues_found, clues_total, discovered, coins, balance,
--                                unlocks_room, unlocked:[...]}
--    A one-clue secret (a hidden switch) is discovered by the first call; a multi-clue secret only when every clue is in.
--    The clue must be one of the clues the SERVER lists for that secret, so an invented clue id changes nothing.
-- ---------------------------------------------------------------------
create or replace function public.find_clue(p_secret text, p_clue text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); s public.secrets; fresh boolean := false; n_found integer; done boolean; just_done boolean := false;
  award integer := 0; bal integer; newly jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 8));
  select * into s from public.secrets where id = p_secret and enabled;
  if not found then raise exception 'Unknown secret'; end if;
  if p_clue is null or not (p_clue = any (s.clues)) then raise exception 'That is not a clue to this secret'; end if;

  insert into public.player_secret_clues (player_id, secret_id, clue_id) values (uid, s.id, p_clue)
    on conflict (player_id, secret_id, clue_id) do nothing;
  fresh := found;                                                           -- FOUND: true only when the insert added a row
  select count(*) into n_found from public.player_secret_clues where player_id = uid and secret_id = s.id;
  done := exists (select 1 from public.player_secrets where player_id = uid and secret_id = s.id);

  if not done and n_found >= cardinality(s.clues) then
    insert into public.player_secrets (player_id, secret_id, coins_awarded) values (uid, s.id, s.reward)
      on conflict (player_id, secret_id) do nothing;
    just_done := found;                                                     -- the row really was inserted: pay exactly once
    if just_done and s.reward > 0 then
      award := s.reward;
      update public.profiles set coins = coins + award where id = uid;
    end if;
    done := true;
  end if;

  if fresh or just_done then newly := public._sync_achievements(uid); end if;
  select coins into bal from public.profiles where id = uid;

  return jsonb_build_object('ok', true, 'secret', s.id, 'name', s.name, 'clue', p_clue, 'new', fresh,
    'clues_found', least(n_found, cardinality(s.clues)), 'clues_total', cardinality(s.clues),
    'discovered', done, 'just_discovered', just_done, 'coins', award, 'balance', bal,
    'unlocks_room', case when done then s.unlocks_room else null end, 'unlocked', newly);
end $$;

-- ---------------------------------------------------------------------
-- 9. visit_room(room) -> {ok, first, rooms, unlocked:[...]}
--    Called once per room entry. Records first visits (world-map discovery) and bumps the visit counter.
--    Player rooms ('home') are not world locations and are ignored.
-- ---------------------------------------------------------------------
create or replace function public.visit_room(p_room text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); firstv boolean := false; n integer; newly jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_room is null or p_room = 'home' or p_room !~ '^[a-z][a-z0-9_]{2,39}$' then
    return jsonb_build_object('ok', true, 'first', false);
  end if;
  insert into public.player_world_rooms (player_id, room_id) values (uid, p_room)
    on conflict (player_id, room_id) do update set visits = player_world_rooms.visits + 1, last_at = now();
  select (visits = 1) into firstv from public.player_world_rooms where player_id = uid and room_id = p_room;
  if firstv then newly := public._sync_achievements(uid); end if;
  select count(*) into n from public.player_world_rooms where player_id = uid;
  return jsonb_build_object('ok', true, 'first', firstv, 'rooms', n, 'unlocked', newly);
end $$;

-- ---------------------------------------------------------------------
-- 10. Permissions: four callable functions, nothing else
-- ---------------------------------------------------------------------
revoke all on function public.get_exploration(), public.collect_collectible(text), public.find_clue(text, text),
  public.visit_room(text), public._sync_achievements(uuid) from public, anon;
grant execute on function public.get_exploration(), public.collect_collectible(text), public.find_clue(text, text),
  public.visit_room(text) to authenticated;
revoke all on function public._sync_achievements(uuid) from authenticated;   -- internal only
