-- Anchors World — schema (Phase 1: profiles). Run in Supabase SQL editor.
-- Later phases add: items, inventory, rooms, room_furniture, friendships,
-- friend_requests, chat_messages, minigame_scores, daily_rewards, reports.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  display_name text not null check (char_length(display_name) between 1 and 24),
  avatar_data  jsonb not null default '{"bodyType":"round","color":"#4aa8ff","eyes":"eyes_0","hat":"hat_beanie","shirt":"shirt_stripe"}',
  coins        integer not null default 500 check (coins >= 0),
  current_room text not null default 'snowy_plaza',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));

alter table public.profiles enable row level security;

-- Anyone signed in can read profiles (needed for names/friend search).
drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users"
  on public.profiles for select to authenticated using (true);

-- Users may update only their own row...
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- ...and only these columns. Coins/username/id/avatar can NOT be changed directly by the client
-- (avatar goes through save_avatar(), which checks ownership).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, current_room) on public.profiles to authenticated;

-- Profile is created server-side when a user registers.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare uname text := coalesce(new.raw_user_meta_data->>'username', 'player_' || substr(new.id::text, 1, 6));
begin
  if uname !~ '^[A-Za-z0-9_]{3,16}$' then uname := 'player_' || substr(new.id::text, 1, 6); end if;
  begin
    insert into public.profiles (id, username, display_name) values (new.id, uname, uname);
  exception when unique_violation then
    uname := left(uname, 10) || '_' || substr(new.id::text, 1, 5);
    insert into public.profiles (id, username, display_name) values (new.id, uname, uname);
  end;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- =====================================================================
-- PHASE 4: items, inventory, coins, avatar saving, daily reward
-- =====================================================================
create table if not exists public.items (
  id          text primary key,
  name        text not null,
  category    text not null check (category in ('eyes','face','hat','accessory','shirt','pants','shoes','back','hand')),
  rarity      text not null default 'common' check (rarity in ('common','uncommon','rare','epic','event')),
  asset       text not null,
  description text not null default '',
  price       integer not null default 0 check (price >= 0),
  starter     boolean not null default false,      -- free for everyone, no inventory row needed
  purchasable boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.items enable row level security;
drop policy if exists "items readable" on public.items;
create policy "items readable" on public.items for select to authenticated using (true);
revoke insert, update, delete on public.items from anon, authenticated;

create table if not exists public.inventory (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  item_id     text not null references public.items(id),
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index if not exists inventory_user on public.inventory(user_id);
alter table public.inventory enable row level security;
drop policy if exists "read own inventory" on public.inventory;
create policy "read own inventory" on public.inventory for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.inventory from anon, authenticated;   -- only purchase_item()/rewards write here

create table if not exists public.daily_rewards (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  last_claim date not null,
  streak     integer not null default 1 check (streak between 1 and 5)
);
alter table public.daily_rewards enable row level security;
drop policy if exists "read own daily" on public.daily_rewards;
create policy "read own daily" on public.daily_rewards for select to authenticated using (auth.uid() = user_id);
revoke insert, update, delete on public.daily_rewards from anon, authenticated;

-- Atomic purchase: price comes from the items table, never from the client.
create or replace function public.purchase_item(p_item_id text) returns integer
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); it public.items; bal integer;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into it from public.items where id = p_item_id;
  if not found then raise exception 'Unknown item'; end if;
  if it.starter or not it.purchasable then raise exception 'This item is not for sale'; end if;
  select coins into bal from public.profiles where id = uid for update;     -- row lock: no double-spend
  if exists (select 1 from public.inventory where user_id = uid and item_id = p_item_id) then raise exception 'You already own this'; end if;
  if bal < it.price then raise exception 'Not enough Anchor Coins'; end if;
  update public.profiles set coins = coins - it.price where id = uid;
  insert into public.inventory (user_id, item_id) values (uid, p_item_id);
  return bal - it.price;
end $$;

-- Validated avatar save: every equipped item must exist, fit its slot, and be starter or owned.
create or replace function public.save_avatar(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); slot text; v text; it public.items; clean jsonb;
  slots text[] := array['eyes','face','hat','accessory','shirt','pants','shoes','back','hand'];
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if coalesce(p->>'color','') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Invalid colour'; end if;
  if coalesce(p->>'bodyType','') not in ('round','tall','chubby') then raise exception 'Invalid body type'; end if;
  clean := jsonb_build_object('color', p->>'color', 'bodyType', p->>'bodyType');
  foreach slot in array slots loop
    v := p->>slot;
    if v is null then
      if slot = 'eyes' then raise exception 'Eyes are required'; end if;
      continue;
    end if;
    select * into it from public.items where id = v;
    if not found or it.category <> slot then raise exception 'Invalid % item', slot; end if;
    if not it.starter and not exists (select 1 from public.inventory where user_id = uid and item_id = v) then
      raise exception 'You do not own %', it.name;
    end if;
    clean := clean || jsonb_build_object(slot, v);
  end loop;
  update public.profiles set avatar_data = clean where id = uid;
  return clean;
end $$;

-- Daily reward: day1 100c, day2 150c, day3 Earmuffs, day4 200c, day5 Bow Tie (cosmetic only). Streak resets if a day is missed.
create or replace function public.claim_daily_reward() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); rec public.daily_rewards; today date := (now() at time zone 'utc')::date;
  new_streak int; award int := 0; item text := null;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into rec from public.daily_rewards where user_id = uid for update;
  if found and rec.last_claim = today then raise exception 'Already claimed today. Come back tomorrow!'; end if;
  new_streak := case when found and rec.last_claim = today - 1 then (rec.streak % 5) + 1 else 1 end;
  if new_streak = 1 then award := 100; elsif new_streak = 2 then award := 150; elsif new_streak = 4 then award := 200;
  elsif new_streak = 3 then item := 'hat_earmuffs'; else item := 'accessory_bowtie'; end if;
  if item is not null then
    if exists (select 1 from public.inventory where user_id = uid and item_id = item) then award := 100; item := null;  -- already owned: coins instead
    else insert into public.inventory (user_id, item_id) values (uid, item); end if;
  end if;
  if award > 0 then update public.profiles set coins = coins + award where id = uid; end if;
  insert into public.daily_rewards (user_id, last_claim, streak) values (uid, today, new_streak)
    on conflict (user_id) do update set last_claim = excluded.last_claim, streak = excluded.streak;
  return jsonb_build_object('day', new_streak, 'coins', award, 'item', item, 'balance', (select coins from public.profiles where id = uid));
end $$;

revoke all on function public.purchase_item(text), public.save_avatar(jsonb), public.claim_daily_reward() from public, anon;
grant execute on function public.purchase_item(text), public.save_avatar(jsonb), public.claim_daily_reward() to authenticated;

-- Item catalog seed (generated by scripts/gen-seed.mjs from src/shops/items.js)
insert into public.items (id,name,category,rarity,asset,description,price,starter,purchasable) values
  ('eyes_0','Bright Eyes','eyes','common','eyes_0','Wide awake.',0,true,false),
  ('eyes_1','Happy Eyes','eyes','common','eyes_1','Always smiling.',0,true,false),
  ('eyes_2','Sleepy Eyes','eyes','common','eyes_2','Five more minutes…',0,true,false),
  ('eyes_3','Sparkle Eyes','eyes','uncommon','eyes_3','Starry-eyed.',100,false,true),
  ('face_blush','Rosy Cheeks','face','common','face_blush','Cold-nose blush.',0,true,false),
  ('face_freckles','Freckles','face','common','face_freckles','Sun-kissed, somehow.',40,false,true),
  ('face_glasses','Round Glasses','face','uncommon','face_glasses','Bookish and cozy.',80,false,true),
  ('face_sunglasses','Snow Shades','face','rare','face_sunglasses','Glare-proof.',150,false,true),
  ('hat_beanie','Red Beanie','hat','common','hat_beanie','The classic.',0,true,false),
  ('hat_beanie_blue','Blue Beanie','hat','common','hat_beanie_blue','Cool in every way.',80,false,true),
  ('hat_earmuffs','Earmuffs','hat','uncommon','hat_earmuffs','Toasty ears.',100,false,true),
  ('hat_party','Party Hat','hat','uncommon','hat_party','Every day is a party.',120,false,true),
  ('hat_tophat','Top Hat','hat','rare','hat_tophat','Very distinguished.',250,false,true),
  ('hat_crown','Ice Crown','hat','epic','hat_crown','Rule the plaza.',600,false,true),
  ('accessory_scarf','Striped Scarf','accessory','common','accessory_scarf','Wrap up warm.',60,false,true),
  ('accessory_bowtie','Bow Tie','accessory','uncommon','accessory_bowtie','Dapper.',90,false,true),
  ('accessory_bell','Jingle Bell','accessory','uncommon','accessory_bell','Jingles when you waddle.',70,false,true),
  ('shirt_stripe','Striped Tee','shirt','common','shirt_stripe','Simple and sailor-y.',0,true,false),
  ('shirt_hoodie','Cozy Hoodie','shirt','common','shirt_hoodie','Pocket included.',120,false,true),
  ('shirt_sweater','Nordic Sweater','shirt','uncommon','shirt_sweater','Knitted by someone who cares.',150,false,true),
  ('shirt_tux','Tuxedo','shirt','rare','shirt_tux','Black-tie ready.',300,false,true),
  ('pants_jeans','Blue Jeans','pants','common','pants_jeans','Never out of style.',70,false,true),
  ('pants_cargo','Cargo Pants','pants','common','pants_cargo','So many pockets.',90,false,true),
  ('pants_snow','Snow Pants','pants','uncommon','pants_snow','Built for snowball fights.',140,false,true),
  ('shoes_boots','Winter Boots','shoes','common','shoes_boots','Stomp-ready.',90,false,true),
  ('shoes_sneakers','White Sneakers','shoes','common','shoes_sneakers','Fresh kicks.',80,false,true),
  ('shoes_skates','Ice Skates','shoes','rare','shoes_skates','Glide into style.',200,false,true),
  ('back_backpack','Explorer Pack','back','common','back_backpack','Snacks inside.',150,false,true),
  ('back_cape','Hero Cape','back','rare','back_cape','Flutters dramatically.',300,false,true),
  ('back_wings','Frost Wings','back','epic','back_wings','Shimmering and silly.',450,false,true),
  ('hand_snowball','Snowball','hand','common','hand_snowball','Packed fresh.',20,false,true),
  ('hand_icecream','Ice Cream','hand','common','hand_icecream','Yes, in the snow.',40,false,true),
  ('hand_balloon','Balloon','hand','uncommon','hand_balloon','Floaty.',60,false,true),
  ('hand_umbrella','Umbrella','hand','uncommon','hand_umbrella','For snow showers.',100,false,true)
on conflict (id) do update set name=excluded.name, category=excluded.category, rarity=excluded.rarity, asset=excluded.asset,
  description=excluded.description, price=excluded.price, starter=excluded.starter, purchasable=excluded.purchasable;
