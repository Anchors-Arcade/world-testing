-- =====================================================================
-- Anchors World — PHASE 5: furniture, player rooms, stackable purchases
-- Run ONCE in the Supabase SQL editor, AFTER the existing schema.sql (Phases 1-4). Safe to re-run.
-- Nothing from earlier phases is dropped: profiles, items, inventory, daily rewards and avatar saving are kept.
--
-- Security model: clients can only SELECT. Every write (buying, saving a room) goes through a
-- SECURITY DEFINER function that reads prices/ownership from the database and validates the input.
-- =====================================================================

-- ---------- 1. items: now holds clothing AND furniture ----------
alter table public.items add column if not exists kind     text    not null default 'clothing';
alter table public.items add column if not exists fw       integer;                    -- furniture footprint width  (px)
alter table public.items add column if not exists fh       integer;                    -- furniture footprint height (px)
alter table public.items add column if not exists walkable boolean not null default false;  -- rugs: avatars walk over them

do $$ declare c record; begin
  for c in select conname from pg_constraint
           where conrelid = 'public.items'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%category%'
  loop execute format('alter table public.items drop constraint %I', c.conname); end loop;
end $$;
alter table public.items add constraint items_category_check check (category in (
  'eyes','face','hat','accessory','shirt','pants','shoes','back','hand',
  'chair','table','bed','lamp','plant','shelf','decoration','rug','snow','seasonal'));
alter table public.items drop constraint if exists items_kind_check;
alter table public.items add constraint items_kind_check check (kind in ('clothing','furniture'));
alter table public.items drop constraint if exists items_furniture_size;
alter table public.items add constraint items_furniture_size check (kind <> 'furniture' or (fw between 8 and 400 and fh between 8 and 400));
create index if not exists items_kind_category on public.items (kind, category);

-- ---------- 2. inventory: furniture can be owned several times ----------
alter table public.inventory add column if not exists quantity integer not null default 1;
alter table public.inventory drop constraint if exists inventory_quantity_check;
alter table public.inventory add constraint inventory_quantity_check check (quantity between 1 and 10);

-- ---------- 3. rooms (one per player) + room_furniture ----------
create table if not exists public.rooms (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null unique references public.profiles(id) on delete cascade,
  theme      text not null default 'cozy_wood' check (theme in ('cozy_wood','snow_cabin','ice_blue','sunset','midnight','mint')),
  visibility text not null default 'friends'  check (visibility in ('private','friends','public')),   -- friend visits arrive in Phase 6
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch before update on public.rooms for each row execute function public.touch_updated_at();

create table if not exists public.room_furniture (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id) on delete cascade,
  item_id    text not null references public.items(id),
  x          integer  not null check (x between 0 and 960),
  y          integer  not null check (y between 0 and 680),
  rotation   smallint not null default 0 check (rotation in (0,90,180,270)),
  created_at timestamptz not null default now()
);
create index if not exists room_furniture_room on public.room_furniture (room_id);
create index if not exists room_furniture_item on public.room_furniture (item_id);

-- Who may LOOK at a room. Owners always; others only when the room is public.
-- Phase 6 (friends): extend this one function with a friendships lookup for visibility = 'friends'.
create or replace function public.can_view_room(p_owner uuid, p_visibility text) returns boolean
language sql stable as $$ select auth.uid() = p_owner or p_visibility = 'public' $$;

alter table public.rooms enable row level security;
drop policy if exists "view allowed rooms" on public.rooms;
create policy "view allowed rooms" on public.rooms for select to authenticated using (public.can_view_room(owner_id, visibility));
revoke insert, update, delete on public.rooms from anon, authenticated;            -- writes: save_room() only

alter table public.room_furniture enable row level security;
drop policy if exists "view furniture of viewable rooms" on public.room_furniture;
create policy "view furniture of viewable rooms" on public.room_furniture for select to authenticated
  using (exists (select 1 from public.rooms r where r.id = room_id and public.can_view_room(r.owner_id, r.visibility)));
revoke insert, update, delete on public.room_furniture from anon, authenticated;   -- writes: save_room() only

-- ---------- 4. furniture catalog seed (generated by scripts/gen-furniture-seed.mjs) ----------
insert into public.items (id,name,category,rarity,asset,description,price,starter,purchasable,kind,fw,fh,walkable) values
  ('chair_wood','Wooden Chair','chair','common','chair_wood','Sturdy. Slightly creaky.',40,false,true,'furniture',48,48,false),
  ('chair_beanbag','Bean Bag','chair','common','chair_beanbag','Impossible to sit on gracefully.',70,false,true,'furniture',64,64,false),
  ('chair_armchair','Cozy Armchair','chair','uncommon','chair_armchair','Made for hot cocoa evenings.',110,false,true,'furniture',64,64,false),
  ('sofa_plaid','Plaid Sofa','chair','uncommon','sofa_plaid','Seats two penguins and a snack.',180,false,true,'furniture',144,64,false),
  ('table_coffee','Coffee Table','table','common','table_coffee','Low and mug-friendly.',50,false,true,'furniture',80,48,false),
  ('table_round','Round Table','table','common','table_round','No head of the table.',60,false,true,'furniture',80,80,false),
  ('table_long','Long Table','table','common','table_long','Room for the whole flock.',90,false,true,'furniture',128,64,false),
  ('bed_single','Single Bed','bed','common','bed_single','A snug spot to nap.',150,false,true,'furniture',80,144,false),
  ('bed_double','Double Bed','bed','uncommon','bed_double','Extra pillows included.',260,false,true,'furniture',112,144,false),
  ('bed_igloo','Igloo Nest','bed','rare','bed_igloo','A tiny igloo with a warm bed inside.',400,false,true,'furniture',112,112,false),
  ('lamp_floor','Floor Lamp','lamp','common','lamp_floor','Soft golden light.',45,false,true,'furniture',32,32,false),
  ('lamp_lantern','Lantern','lamp','uncommon','lamp_lantern','Flickers like a campfire.',65,false,true,'furniture',32,32,false),
  ('lamp_star','Star Lamp','lamp','rare','lamp_star','A little piece of the night sky.',120,false,true,'furniture',40,40,false),
  ('plant_cactus','Little Cactus','plant','common','plant_cactus','Needs almost nothing. Unlike you.',25,false,true,'furniture',32,32,false),
  ('plant_fern','Potted Fern','plant','common','plant_fern','Leafy and calm.',35,false,true,'furniture',48,48,false),
  ('plant_fir','Mini Fir Tree','plant','uncommon','plant_fir','A snowy pine, indoors.',80,false,true,'furniture',56,56,false),
  ('shelf_books','Bookshelf','shelf','common','shelf_books','Stuffed with adventures.',110,false,true,'furniture',128,40,false),
  ('shelf_cabinet','Cabinet','shelf','uncommon','shelf_cabinet','Hides a surprising amount of clutter.',130,false,true,'furniture',96,48,false),
  ('deco_radio','Retro Radio','decoration','common','deco_radio','Crackly tunes.',55,false,true,'furniture',48,32,false),
  ('deco_fishbowl','Fish Bowl','decoration','uncommon','deco_fishbowl','Sir Bubbles will watch over you.',75,false,true,'furniture',40,40,false),
  ('deco_trophy','Golden Trophy','decoration','rare','deco_trophy','For the best waddler.',160,false,true,'furniture',32,32,false),
  ('deco_fireplace','Fireplace','decoration','rare','deco_fireplace','The warmest corner of the house.',320,false,true,'furniture',112,56,false),
  ('rug_round','Round Rug','rug','common','rug_round','Ties the room together.',70,false,true,'furniture',128,128,true),
  ('rug_stripe','Striped Rug','rug','common','rug_stripe','Sailor-approved.',85,false,true,'furniture',160,96,true),
  ('rug_polar','Polar Bear Rug','rug','rare','rug_polar','Surprisingly friendly.',220,false,true,'furniture',144,112,true),
  ('snow_snowman','Snowman','snow','uncommon','snow_snowman','Never melts. Mostly.',90,false,true,'furniture',56,56,false),
  ('snow_iceblock','Ice Block Table','snow','rare','snow_iceblock','Chilly to the touch.',140,false,true,'furniture',64,64,false),
  ('snow_penguin','Ice Penguin Statue','snow','epic','snow_penguin','Carved by a very proud penguin.',350,false,true,'furniture',48,48,false),
  ('season_pumpkin','Pumpkin','seasonal','uncommon','season_pumpkin','Autumn, all year round.',60,false,true,'furniture',40,40,false),
  ('season_tree','Holiday Tree','seasonal','event','season_tree','Twinkling and a little tilted.',200,false,true,'furniture',80,80,false)
on conflict (id) do update set name=excluded.name, category=excluded.category, rarity=excluded.rarity, asset=excluded.asset,
  description=excluded.description, price=excluded.price, starter=false, purchasable=true, kind='furniture', fw=excluded.fw, fh=excluded.fh, walkable=excluded.walkable;

-- ---------- 5. purchase_item: clothing is one-per-player, furniture stacks up to 10 ----------
create or replace function public.purchase_item(p_item_id text) returns integer
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); it public.items; bal integer; qty integer; have boolean;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into it from public.items where id = p_item_id;
  if not found then raise exception 'Unknown item'; end if;
  if it.starter or not it.purchasable then raise exception 'This item is not for sale'; end if;
  select coins into bal from public.profiles where id = uid for update;            -- row lock: no double-spend
  select quantity into qty from public.inventory where user_id = uid and item_id = p_item_id;
  have := found;
  if it.kind = 'clothing' then
    if have then raise exception 'You already own this'; end if;
  elsif have and qty >= 10 then
    raise exception 'You can own up to 10 of these';
  end if;
  if bal < it.price then raise exception 'Not enough Anchor Coins'; end if;
  update public.profiles set coins = coins - it.price where id = uid;
  if have then update public.inventory set quantity = quantity + 1 where user_id = uid and item_id = p_item_id;
  else insert into public.inventory (user_id, item_id) values (uid, p_item_id); end if;
  return bal - it.price;
end $$;

-- ---------- 6. get_room: load a room (own room is created on first visit) ----------
create or replace function public.get_room(p_owner uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); target uuid; r public.rooms; oname text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  target := coalesce(p_owner, uid);
  if target = uid then insert into public.rooms (owner_id) values (uid) on conflict (owner_id) do nothing; end if;
  select * into r from public.rooms where owner_id = target;
  if not found then raise exception 'Room not found'; end if;
  if not public.can_view_room(r.owner_id, r.visibility) then raise exception 'This room is private'; end if;
  select display_name into oname from public.profiles where id = target;
  return jsonb_build_object(
    'room', jsonb_build_object('id', r.id, 'owner_id', r.owner_id, 'owner_name', oname, 'theme', r.theme,
                               'visibility', r.visibility, 'updated_at', r.updated_at),
    'is_owner', target = uid,
    'furniture', coalesce((select jsonb_agg(jsonb_build_object('furniture_id', f.item_id, 'x', f.x, 'y', f.y, 'rotation', f.rotation)
                                            order by f.created_at, f.id)
                           from public.room_furniture f where f.room_id = r.id), '[]'::jsonb));
end $$;

-- ---------- 7. save_room: validate the WHOLE layout, then replace it atomically ----------
-- Same rules as src/rooms/roomRules.js. Room is 960x680; furniture must sit on the floor (y 150..590).
create or replace function public.save_room(p_theme text, p_furniture jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); rid uuid; n int; i int; j int; el jsonb; it public.items; rot int; px int; py int; hw int; hh int;
  xs int[] := '{}'; ys int[] := '{}'; ws int[] := '{}'; hs int[] := '{}'; wk boolean[] := '{}'; bad text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_theme is null or p_theme not in ('cozy_wood','snow_cabin','ice_blue','sunset','midnight','mint') then raise exception 'Unknown room theme'; end if;
  if p_furniture is null or jsonb_typeof(p_furniture) <> 'array' then raise exception 'Invalid layout'; end if;
  n := jsonb_array_length(p_furniture);
  if n > 80 then raise exception 'Too much furniture in one room (max 80)'; end if;

  insert into public.rooms (owner_id) values (uid) on conflict (owner_id) do nothing;
  select id into rid from public.rooms where owner_id = uid for update;               -- serialise concurrent saves

  for i in 0 .. n - 1 loop
    el := p_furniture -> i;
    if jsonb_typeof(el) <> 'object' then raise exception 'Invalid furniture entry'; end if;
    if coalesce(jsonb_typeof(el->'x'),'') <> 'number' or coalesce(jsonb_typeof(el->'y'),'') <> 'number'
       or coalesce(jsonb_typeof(el->'rotation'),'') <> 'number' then raise exception 'Invalid furniture entry'; end if;
    if (el->>'x')::numeric <> trunc((el->>'x')::numeric) or (el->>'y')::numeric <> trunc((el->>'y')::numeric)
       or (el->>'rotation')::numeric <> trunc((el->>'rotation')::numeric) then raise exception 'Positions must be whole numbers'; end if;
    if abs((el->>'x')::numeric) > 5000 or abs((el->>'y')::numeric) > 5000 then raise exception 'Furniture is outside the room'; end if;
    px := (el->>'x')::numeric::int; py := (el->>'y')::numeric::int; rot := (el->>'rotation')::numeric::int;
    if rot not in (0,90,180,270) then raise exception 'Invalid rotation'; end if;

    select * into it from public.items where id = el->>'furniture_id';
    if not found or it.kind <> 'furniture' then raise exception 'Unknown furniture'; end if;
    if rot % 180 = 0 then hw := it.fw; hh := it.fh; else hw := it.fh; hh := it.fw; end if;

    -- bounds (doubled coordinates so odd sizes stay exact)
    if 2*px - hw < 0 or 2*px + hw > 2*960 or 2*py - hh < 2*150 or 2*py + hh > 2*590 then
      raise exception '% does not fit inside the room', it.name;
    end if;
    -- solid pieces may not overlap each other (rugs may overlap anything)
    if not it.walkable then
      for j in 1 .. coalesce(array_length(xs, 1), 0) loop
        if not wk[j] and 2*abs(px - xs[j]) < hw + ws[j] and 2*abs(py - ys[j]) < hh + hs[j] then
          raise exception '% overlaps another piece of furniture', it.name;
        end if;
      end loop;
    end if;
    xs := array_append(xs, px); ys := array_append(ys, py); ws := array_append(ws, hw); hs := array_append(hs, hh); wk := array_append(wk, it.walkable);
  end loop;

  -- you can only place as many copies as you own
  with c as (select e->>'furniture_id' as fid, count(*) as cnt from jsonb_array_elements(p_furniture) e group by 1)
  select c.fid into bad from c left join public.inventory iv on iv.user_id = uid and iv.item_id = c.fid
   where coalesce(iv.quantity, 0) < c.cnt limit 1;
  if bad is not null then raise exception 'You do not own enough of %', (select name from public.items where id = bad); end if;

  delete from public.room_furniture where room_id = rid;
  insert into public.room_furniture (room_id, item_id, x, y, rotation)
    select rid, e->>'furniture_id', (e->>'x')::numeric::int, (e->>'y')::numeric::int, (e->>'rotation')::numeric::int
    from jsonb_array_elements(p_furniture) with ordinality as t(e, ord) order by ord;
  update public.rooms set theme = p_theme where id = rid;
  return public.get_room(uid);
end $$;

revoke all on function public.purchase_item(text), public.get_room(uuid), public.save_room(text, jsonb) from public, anon;
grant execute on function public.purchase_item(text), public.get_room(uuid), public.save_room(text, jsonb) to authenticated;
