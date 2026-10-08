-- =====================================================================
-- ANCHORS WORLD · PHASE 17 — roles, moderation, the admin panel, announcements
-- (this is the "Phase 16 — auth + admin panel + guest multiplayer" request; the repo already had a phase16.sql)
-- Run AFTER schema.sql, phase5.sql, phase6.sql. Safe to re-run.
--
-- Principle: THE CLIENT NEVER DECIDES ANYTHING. There is no "isAdmin" flag the browser can set. Every privileged
-- action is a SECURITY DEFINER function that looks the CALLER up by auth.uid() and reads their role out of the
-- database. A modified client calling admin_ban() as an ordinary player gets an exception, not a ban.
--
-- Enforcement is in the database, not in the UI:
--   * banned  -> get_my_profile() refuses, so the player cannot even finish logging in; a trigger also blocks chat.
--   * muted   -> a BEFORE INSERT trigger on chat_messages rejects the row, whatever client sent it.
--   * kicked  -> a row in `mod_actions` addressed to that player; their own session sees it over Realtime
--                (postgres_changes, filtered to them) and drops out of the world.
--   * announcements are rows written only by admin_announce(); clients read them over Realtime, so a player
--     cannot fake one by broadcasting on a channel.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Roles and moderation state live on the profile
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists role         text not null default 'user';
alter table public.profiles add column if not exists banned_until timestamptz;      -- null = not banned; 'infinity' = permanent
alter table public.profiles add column if not exists ban_reason   text;
alter table public.profiles add column if not exists muted_until  timestamptz;
alter table public.profiles add column if not exists mute_reason  text;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('user', 'moderator', 'admin'));
create index if not exists profiles_role_idx on public.profiles (role) where role <> 'user';

-- Make yourself an admin (run once, in the SQL editor):
--   update public.profiles set role = 'admin' where username = 'YOUR_USERNAME';
-- or by e-mail:
--   update public.profiles set role = 'admin'
--    where id = (select id from auth.users where lower(email) = lower('you@example.com'));

-- ---------------------------------------------------------------------
-- 2. Who is staff? One helper, used by every admin function.
-- ---------------------------------------------------------------------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'user')
$$;

create or replace function public.require_staff(p_min text default 'moderator') returns text
language plpgsql stable security definer set search_path = public as $$
declare r text := public.my_role();
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_min = 'admin' and r <> 'admin' then raise exception 'Admins only'; end if;
  if p_min = 'moderator' and r not in ('admin', 'moderator') then raise exception 'Moderators only'; end if;
  return r;
end $$;

create or replace function public.is_banned(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select banned_until > now() from public.profiles where id = p_id), false)
$$;

create or replace function public.is_muted(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select muted_until > now() from public.profiles where id = p_id), false)
$$;

-- ---------------------------------------------------------------------
-- 3. get_my_profile(): now carries the role, refuses a banned account
--    (replaces the Phase 6 version; same shape plus role / mute fields)
-- ---------------------------------------------------------------------
create or replace function public.get_my_profile() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.profiles;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into p from public.profiles where id = uid;
  if not found then return null; end if;
  if p.banned_until is not null and p.banned_until > now() then
    raise exception 'BANNED:%:%', (case when p.banned_until = 'infinity'::timestamptz then 'permanent'
      else to_char(p.banned_until at time zone 'utc', 'YYYY-MM-DD HH24:MI') || ' UTC' end), coalesce(p.ban_reason, '');
  end if;
  return jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name, 'coins', p.coins,
    'avatar_data', p.avatar_data, 'current_room', p.current_room, 'created_at', p.created_at,
    'role', p.role,
    'muted_until', case when p.muted_until > now() then p.muted_until else null end,
    'mute_reason', case when p.muted_until > now() then p.mute_reason else null end);
end $$;

-- ---------------------------------------------------------------------
-- 4. Chat is blocked for muted and banned players AT THE DATABASE, whatever client is used
-- ---------------------------------------------------------------------
create or replace function public.chat_moderation_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = new.player_id;
  if p.banned_until is not null and p.banned_until > now() then raise exception 'You are banned.'; end if;
  if p.muted_until is not null and p.muted_until > now() then
    raise exception 'You are timed out until % UTC.', to_char(p.muted_until at time zone 'utc', 'HH24:MI');
  end if;
  return new;
end $$;

drop trigger if exists chat_moderation on public.chat_messages;
create trigger chat_moderation before insert on public.chat_messages
  for each row execute function public.chat_moderation_guard();

-- ---------------------------------------------------------------------
-- 5. Kicks and announcements: rows, so Realtime delivers something the server actually wrote
-- ---------------------------------------------------------------------
create table if not exists public.mod_actions (
  id         uuid primary key default gen_random_uuid(),
  target_id  uuid not null references public.profiles(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  kind       text not null check (kind in ('kick', 'ban', 'unban', 'timeout', 'untimeout', 'role', 'coins', 'item')),
  detail     text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists mod_actions_target on public.mod_actions (target_id, created_at desc);
alter table public.mod_actions enable row level security;
revoke all on public.mod_actions from anon, authenticated;
grant select on public.mod_actions to authenticated;
drop policy if exists "see actions about me" on public.mod_actions;
create policy "see actions about me" on public.mod_actions for select to authenticated
  using (target_id = auth.uid() or public.my_role() in ('admin', 'moderator'));

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  body       text not null check (char_length(body) between 1 and 240),
  actor_id   uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null default now() + interval '2 minutes',
  created_at timestamptz not null default now()
);
create index if not exists announcements_time on public.announcements (created_at desc);
alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;
grant select on public.announcements to authenticated;
drop policy if exists "read announcements" on public.announcements;
create policy "read announcements" on public.announcements for select to authenticated using (true);

-- Realtime has to be told to publish these two tables.
do $$ begin
  begin execute 'alter publication supabase_realtime add table public.mod_actions'; exception when others then null; end;
  begin execute 'alter publication supabase_realtime add table public.announcements'; exception when others then null; end;
end $$;

-- ---------------------------------------------------------------------
-- 6. The admin API. Every one of these starts with require_staff().
-- ---------------------------------------------------------------------

-- search ------------------------------------------------------------------
create or replace function public.admin_search_players(p_q text default '', p_limit integer default 25) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q text := btrim(coalesce(p_q, '')); lim integer := least(greatest(coalesce(p_limit, 25), 1), 50);
begin
  perform public.require_staff('moderator');
  return (select coalesce(jsonb_agg(to_jsonb(r) order by r.username), '[]'::jsonb) from (
    select p.id, p.username, p.display_name, p.coins, p.role, p.current_room, p.created_at,
           p.banned_until, p.ban_reason, p.muted_until, p.mute_reason,
           (select count(*) from public.inventory i where i.user_id = p.id) as items
      from public.profiles p
     where q = '' or p.username ilike '%' || q || '%' or p.display_name ilike '%' || q || '%'
     order by p.username limit lim) r);
end $$;

create or replace function public.admin_player(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_staff('moderator');
  return (select to_jsonb(r) from (
    select p.id, p.username, p.display_name, p.coins, p.role, p.current_room, p.created_at,
           p.banned_until, p.ban_reason, p.muted_until, p.mute_reason, p.avatar_data,
           (select count(*) from public.inventory i where i.user_id = p.id) as items,
           (select count(*) from public.friendships f where p.id in (f.user_id, f.friend_id)) as friends,
           (select coalesce(sum(best_score), 0) from public.minigame_bests b where b.player_id = p.id) as arcade,
           (select jsonb_agg(jsonb_build_object('kind', m.kind, 'detail', m.detail, 'at', m.created_at) order by m.created_at desc)
              from (select * from public.mod_actions where target_id = p.id order by created_at desc limit 8) m) as history
      from public.profiles p where p.id = p_id) r);
end $$;

-- coins -------------------------------------------------------------------
-- mode 'set' or 'add'. Never trusts a balance from the client: it writes the number the admin typed and returns
-- the real new balance from the row.
create or replace function public.admin_set_coins(p_id uuid, p_amount integer, p_mode text default 'add') returns jsonb
language plpgsql security definer set search_path = public as $$
declare bal integer;
begin
  perform public.require_staff('admin');
  if p_amount is null or abs(p_amount) > 10000000 then raise exception 'Amount out of range'; end if;
  if p_mode = 'set' then update public.profiles set coins = greatest(0, p_amount) where id = p_id returning coins into bal;
  else update public.profiles set coins = greatest(0, coins + p_amount) where id = p_id returning coins into bal; end if;
  if bal is null then raise exception 'No such player'; end if;
  insert into public.mod_actions (target_id, actor_id, kind, detail) values (p_id, auth.uid(), 'coins', p_mode || ' ' || p_amount);
  return jsonb_build_object('ok', true, 'coins', bal);
end $$;

-- items (clothing AND furniture — both live in `items`) --------------------
create or replace function public.admin_give_item(p_id uuid, p_item text, p_qty integer default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it public.items; q integer := least(greatest(coalesce(p_qty, 1), 1), 10); have integer;
begin
  perform public.require_staff('admin');
  select * into it from public.items where id = p_item;
  if not found then raise exception 'No such item'; end if;
  if not exists (select 1 from public.profiles where id = p_id) then raise exception 'No such player'; end if;
  if it.kind = 'furniture' then
    select quantity into have from public.inventory where user_id = p_id and item_id = it.id;
    if have is null then insert into public.inventory (user_id, item_id, quantity) values (p_id, it.id, q);
    else update public.inventory set quantity = least(10, have + q) where user_id = p_id and item_id = it.id; end if;
  else
    insert into public.inventory (user_id, item_id) values (p_id, it.id) on conflict do nothing;
  end if;
  insert into public.mod_actions (target_id, actor_id, kind, detail) values (p_id, auth.uid(), 'item', it.id || ' x' || q);
  return jsonb_build_object('ok', true, 'item', it.id, 'name', it.name, 'kind', it.kind);
end $$;

-- roles -------------------------------------------------------------------
create or replace function public.admin_set_role(p_id uuid, p_role text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff('admin');
  if p_role not in ('user', 'moderator', 'admin') then raise exception 'Unknown role'; end if;
  if p_id = auth.uid() then raise exception 'You cannot change your own role'; end if;   -- no accidental self-demotion
  update public.profiles set role = p_role where id = p_id;
  if not found then raise exception 'No such player'; end if;
  insert into public.mod_actions (target_id, actor_id, kind, detail) values (p_id, auth.uid(), 'role', p_role);
  return jsonb_build_object('ok', true, 'role', p_role);
end $$;

-- ban / unban -------------------------------------------------------------
-- p_minutes null  = permanent. Banning writes a mod_action too, so the player's own session drops immediately.
create or replace function public.admin_ban(p_id uuid, p_minutes integer default null, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare until timestamptz; r text;
begin
  r := public.require_staff('moderator');
  if p_id = auth.uid() then raise exception 'You cannot ban yourself'; end if;
  if (select role from public.profiles where id = p_id) in ('admin', 'moderator') and r <> 'admin' then
    raise exception 'Only an admin can act on staff';
  end if;
  until := case when p_minutes is null then 'infinity'::timestamptz else now() + make_interval(mins => greatest(1, p_minutes)) end;
  update public.profiles set banned_until = until, ban_reason = left(coalesce(p_reason, ''), 200) where id = p_id;
  if not found then raise exception 'No such player'; end if;
  insert into public.mod_actions (target_id, actor_id, kind, detail)
    values (p_id, auth.uid(), 'ban', coalesce(p_reason, '') || case when p_minutes is null then ' (permanent)' else ' (' || p_minutes || ' min)' end);
  return jsonb_build_object('ok', true, 'until', until);
end $$;

create or replace function public.admin_unban(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff('moderator');
  update public.profiles set banned_until = null, ban_reason = null where id = p_id;
  insert into public.mod_actions (target_id, actor_id, kind, detail) values (p_id, auth.uid(), 'unban', '');
  return jsonb_build_object('ok', true);
end $$;

-- timeout (mute) ----------------------------------------------------------
create or replace function public.admin_timeout(p_id uuid, p_minutes integer default 10, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare until timestamptz; r text;
begin
  r := public.require_staff('moderator');
  if p_id = auth.uid() then raise exception 'You cannot time yourself out'; end if;
  if (select role from public.profiles where id = p_id) in ('admin', 'moderator') and r <> 'admin' then
    raise exception 'Only an admin can act on staff';
  end if;
  if p_minutes is null or p_minutes <= 0 then
    update public.profiles set muted_until = null, mute_reason = null where id = p_id;
    insert into public.mod_actions (target_id, actor_id, kind, detail) values (p_id, auth.uid(), 'untimeout', '');
    return jsonb_build_object('ok', true, 'until', null);
  end if;
  until := now() + make_interval(mins => least(greatest(p_minutes, 1), 60 * 24 * 14));
  update public.profiles set muted_until = until, mute_reason = left(coalesce(p_reason, ''), 200) where id = p_id;
  if not found then raise exception 'No such player'; end if;
  insert into public.mod_actions (target_id, actor_id, kind, detail)
    values (p_id, auth.uid(), 'timeout', coalesce(p_reason, '') || ' (' || p_minutes || ' min)');
  return jsonb_build_object('ok', true, 'until', until);
end $$;

-- kick --------------------------------------------------------------------
create or replace function public.admin_kick(p_id uuid, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_staff('moderator');
  if p_id = auth.uid() then raise exception 'You cannot kick yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_id) then raise exception 'No such player'; end if;
  insert into public.mod_actions (target_id, actor_id, kind, detail) values (p_id, auth.uid(), 'kick', left(coalesce(p_reason, ''), 200));
  return jsonb_build_object('ok', true);
end $$;

-- announcements -----------------------------------------------------------
create or replace function public.admin_announce(p_body text, p_minutes integer default 2) returns jsonb
language plpgsql security definer set search_path = public as $$
declare body text := btrim(regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g')); id uuid;
begin
  perform public.require_staff('moderator');
  if char_length(body) < 1 or char_length(body) > 240 then raise exception 'Announcements are 1-240 characters'; end if;
  insert into public.announcements (body, actor_id, expires_at)
    values (body, auth.uid(), now() + make_interval(mins => least(greatest(coalesce(p_minutes, 2), 1), 60)))
    returning announcements.id into id;
  return jsonb_build_object('ok', true, 'id', id);
end $$;

-- ---------------------------------------------------------------------
-- 7. Permissions
-- ---------------------------------------------------------------------
revoke all on function public.admin_search_players(text, integer), public.admin_player(uuid),
  public.admin_set_coins(uuid, integer, text), public.admin_give_item(uuid, text, integer),
  public.admin_set_role(uuid, text), public.admin_ban(uuid, integer, text), public.admin_unban(uuid),
  public.admin_timeout(uuid, integer, text), public.admin_kick(uuid, text), public.admin_announce(text, integer),
  public.my_role(), public.require_staff(text), public.is_banned(uuid), public.is_muted(uuid) from public, anon;

grant execute on function public.admin_search_players(text, integer), public.admin_player(uuid),
  public.admin_set_coins(uuid, integer, text), public.admin_give_item(uuid, text, integer),
  public.admin_set_role(uuid, text), public.admin_ban(uuid, integer, text), public.admin_unban(uuid),
  public.admin_timeout(uuid, integer, text), public.admin_kick(uuid, text), public.admin_announce(text, integer),
  public.my_role() to authenticated;
-- require_staff / is_banned / is_muted are internal helpers; nothing outside these functions calls them.
revoke all on function public.require_staff(text), public.is_banned(uuid), public.is_muted(uuid) from authenticated;
