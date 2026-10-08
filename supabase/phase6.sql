-- Anchors World — PHASE 6: chat, friends, emotes support, block/mute/report, privacy settings.
-- Run AFTER schema.sql and phase5.sql. Safe to re-run.
--
-- Security model (same as Phases 4-5): clients may only SELECT their own/visible rows. Every write goes through a
-- SECURITY DEFINER function that takes identity from auth.uid() (never from the client) and validates the input.

create extension if not exists pgcrypto;

-- =====================================================================
-- 1. Privacy: hide private profile columns from other players
--    Before: any signed-in user could read everybody's coins + current_room straight from the table.
--    After : other players can only read public columns; you read your own full row via get_my_profile().
-- =====================================================================
revoke select on public.profiles from anon, authenticated;
grant  select (id, username, display_name, avatar_data, created_at) on public.profiles to authenticated;

create or replace function public.get_my_profile() returns public.profiles
language sql stable security definer set search_path = public as $$
  select * from public.profiles where id = auth.uid()
$$;

create index if not exists profiles_username_prefix on public.profiles (lower(username) text_pattern_ops);

-- =====================================================================
-- 2. Tables
-- =====================================================================
-- Privacy foundation. A missing row means "all defaults" (everything allowed).
create table if not exists public.player_settings (
  user_id               uuid primary key references public.profiles(id) on delete cascade,
  allow_friend_requests boolean not null default true,
  allow_friend_joins    boolean not null default true,     -- friends may see my room and join me
  allow_messages        boolean not null default true,     -- typed chat (false = quick-chat presets only, both ways)
  allow_room_visits     boolean not null default true,     -- others may enter my home (still limited by its visibility)
  updated_at            timestamptz not null default now()
);

create table if not exists public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  receiver_id  uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_not_self check (sender_id <> receiver_id)
);
-- one open request per pair, in either direction (also closes the race between two simultaneous requests)
create unique index if not exists friend_requests_one_pending
  on public.friend_requests (least(sender_id, receiver_id), greatest(sender_id, receiver_id)) where status = 'pending';
create index if not exists friend_requests_receiver on public.friend_requests (receiver_id, status);
create index if not exists friend_requests_sender   on public.friend_requests (sender_id, status, created_at desc);

-- One row per friendship, stored once with user_id < friend_id (so duplicates and mirrored duplicates are impossible).
create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  friend_id  uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint friendships_ordered check (user_id < friend_id),
  constraint friendships_unique unique (user_id, friend_id)
);
create index if not exists friendships_friend on public.friendships (friend_id);

create table if not exists public.player_blocks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  constraint player_blocks_not_self check (user_id <> blocked_user_id),
  constraint player_blocks_unique unique (user_id, blocked_user_id)
);
create index if not exists player_blocks_blocked on public.player_blocks (blocked_user_id);

create table if not exists public.player_mutes (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  muted_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),
  constraint player_mutes_not_self check (user_id <> muted_user_id),
  constraint player_mutes_unique unique (user_id, muted_user_id)
);

-- room_id is the realtime channel id: a public room key ('snowy_plaza') or 'home:<owner uuid>'.
-- sender_name is a snapshot of display_name so history needs no join and survives renames/leaves.
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     text not null check (room_id ~ '^([a-z][a-z0-9_]{1,31}|home:[0-9a-f-]{36})$'),
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null,
  message     text not null check (char_length(message) between 1 and 100),
  kind        text not null default 'text' check (kind in ('text','preset')),
  hidden      boolean not null default false,          -- moderation hook: hidden rows are invisible to players
  created_at  timestamptz not null default now()
);
create index if not exists chat_room_time   on public.chat_messages (room_id, created_at desc);
create index if not exists chat_sender_time on public.chat_messages (sender_id, created_at desc);

create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason           text not null check (reason in ('bad_language','harassment','spam','inappropriate_name','cheating','other')),
  details          text check (details is null or char_length(details) <= 200),
  room_id          text,
  context          text,                               -- the reported player's last messages, captured server-side as evidence
  status           text not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at       timestamptz not null default now(),
  constraint reports_not_self check (reporter_id <> reported_user_id)
);
create index if not exists reports_status_time on public.reports (status, created_at desc);
create index if not exists reports_reported    on public.reports (reported_user_id);
create index if not exists reports_reporter    on public.reports (reporter_id, created_at desc);

-- Word list for the server-side chat filter. Nobody but the service role can read it. mode 'word' = whole word only
-- (avoids false positives inside innocent words), 'contains' = anywhere in the squashed text (for longer terms).
create table if not exists public.chat_filter_terms (
  term text primary key check (term = lower(term) and term ~ '^[a-z0-9]+$'),
  mode text not null default 'word' check (mode in ('word','contains'))
);

-- =====================================================================
-- 3. RLS: read what concerns you, write nothing directly
-- =====================================================================
alter table public.player_settings   enable row level security;
alter table public.friend_requests   enable row level security;
alter table public.friendships       enable row level security;
alter table public.player_blocks     enable row level security;
alter table public.player_mutes      enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.reports           enable row level security;
alter table public.chat_filter_terms enable row level security;

revoke all on public.player_settings, public.friend_requests, public.friendships, public.player_blocks, public.player_mutes,
              public.chat_messages, public.reports, public.chat_filter_terms from anon, authenticated;
grant select on public.player_settings, public.friend_requests, public.friendships, public.player_blocks, public.player_mutes,
              public.chat_messages to authenticated;
-- reports + chat_filter_terms: no grants at all (and no policies) => invisible and untouchable for players.

drop policy if exists "read own settings"   on public.player_settings;
create policy "read own settings" on public.player_settings for select to authenticated using (user_id = auth.uid());

drop policy if exists "read my requests"    on public.friend_requests;
create policy "read my requests" on public.friend_requests for select to authenticated
  using (auth.uid() in (sender_id, receiver_id));

drop policy if exists "read my friendships" on public.friendships;
create policy "read my friendships" on public.friendships for select to authenticated
  using (auth.uid() in (user_id, friend_id));

drop policy if exists "read my blocks" on public.player_blocks;
create policy "read my blocks" on public.player_blocks for select to authenticated using (user_id = auth.uid());

drop policy if exists "read my mutes" on public.player_mutes;
create policy "read my mutes" on public.player_mutes for select to authenticated using (user_id = auth.uid());

-- =====================================================================
-- 4. Helpers (SECURITY DEFINER so they can look at tables the caller cannot read)
-- =====================================================================
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where user_id = least(a, b) and friend_id = greatest(a, b))
$$;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.player_blocks where (user_id = a and blocked_user_id = b) or (user_id = b and blocked_user_id = a))
$$;

create or replace function public.setting_of(p_user uuid, p_key text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select case p_key
      when 'allow_friend_requests' then allow_friend_requests when 'allow_friend_joins' then allow_friend_joins
      when 'allow_messages' then allow_messages when 'allow_room_visits' then allow_room_visits end
    from public.player_settings where user_id = p_user), true)
$$;

-- Who may enter / look at a player's home. Replaces the Phase 5 stub of the same name (policies and get_room keep working).
-- Owner: always. Everyone else: not blocked either way, owner allows visits, and visibility public / (friends + friends).
create or replace function public.can_view_room(p_owner uuid, p_visibility text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return false; end if;
  if uid = p_owner then return true; end if;
  if public.is_blocked_between(uid, p_owner) then return false; end if;
  if not public.setting_of(p_owner, 'allow_room_visits') then return false; end if;
  if p_visibility = 'public' then return true; end if;
  if p_visibility = 'friends' then return public.are_friends(uid, p_owner); end if;
  return false;
end $$;

-- Chat channel -> may this player be in it? Public rooms: yes. 'home:<uuid>': only if they may view that home.
create or replace function public.can_enter_chat_room(p_room text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare own uuid; vis text;
begin
  if p_room not like 'home:%' then return true; end if;
  begin own := substr(p_room, 6)::uuid; exception when others then return false; end;
  select visibility into vis from public.rooms where owner_id = own;
  if not found then return auth.uid() = own; end if;
  return public.can_view_room(own, vis);
end $$;

-- The one rule that decides whether the CALLER may see a chat row. Used by the RLS policy, so it also gates Realtime.
create or replace function public.chat_visible(p_room text, p_sender uuid, p_kind text, p_hidden boolean) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_hidden then return false; end if;
  if p_sender = uid then return true;                                          -- always see your own
  end if;
  if public.is_blocked_between(uid, p_sender) then return false; end if;
  if exists (select 1 from public.player_mutes where user_id = uid and muted_user_id = p_sender) then return false; end if;
  if p_kind <> 'preset' and not public.setting_of(uid, 'allow_messages') then return false; end if;
  return public.can_enter_chat_room(p_room);
end $$;

drop policy if exists "read visible chat" on public.chat_messages;
create policy "read visible chat" on public.chat_messages for select to authenticated
  using (public.chat_visible(room_id, sender_id, kind, hidden));

-- =====================================================================
-- 5. Chat filter + send_chat()
-- =====================================================================
-- Squash for matching: lowercase, undo common look-alike characters, drop everything else, collapse repeated letters.
create or replace function public.chat_squash(t text) returns text
language sql immutable as $$
  select regexp_replace(regexp_replace(translate(lower(t), '0134578@$', 'oieastbas'), '[^a-z]', '', 'g'), '(.)\1+', '\1', 'g')
$$;

create or replace function public.chat_is_clean(t text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare squashed text := public.chat_squash(t); words text[];
begin
  -- personal information / links: web addresses, e-mail, long digit runs (phone numbers)
  if t ~* '(https?:|www\.|[a-z0-9-]+\.(com|net|org|io|gg|tv|me|co|xyz|app)\b)' then return false; end if;
  if t ~ '@' or t ~ '[0-9][^0-9]{0,2}[0-9][^0-9]{0,2}[0-9][^0-9]{0,2}[0-9][^0-9]{0,2}[0-9][^0-9]{0,2}[0-9][^0-9]{0,2}[0-9]' then return false; end if;
  if exists (select 1 from public.chat_filter_terms where mode = 'contains' and position(public.chat_squash(term) in squashed) > 0) then return false; end if;
  words := regexp_split_to_array(lower(t), '[^a-z0-9@$]+');                 -- punctuation separates words; look-alikes handled by chat_squash
  if exists (select 1 from public.chat_filter_terms f where f.mode = 'word'
             and public.chat_squash(f.term) = any (select public.chat_squash(w) from unnest(words) w where w <> '')) then return false; end if;
  return true;
end $$;

-- Quick-chat: the server owns the wording (clients only send a key).
create or replace function public.preset_text(p_key text) returns text
language sql immutable as $$
  select case p_key
    when 'hello' then 'Hello!' when 'hey' then 'Hey!' when 'come' then 'Come here!' when 'play' then 'Let''s play!'
    when 'nice' then 'Nice!' when 'thanks' then 'Thanks!' when 'help' then 'Help!' when 'bye' then 'Bye!'
    when 'sorry' then 'Sorry!' when 'wow' then 'Wow!' when 'gg' then 'Good game!' when 'follow' then 'Follow me!' end
$$;

-- Insert one chat line. Validation: signed in, room allowed, length 1-100 after cleaning, filter, rate limits.
-- Limits: >= 600 ms between messages, 5 per 10 s, 20 per minute, no identical text twice within 20 s.
create or replace function public.send_chat(p_room text, p_text text default null, p_preset text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); msg text; k text := 'text'; nm text; last_at timestamptz; n10 int; n60 int; rec public.chat_messages;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_room is null or p_room !~ '^([a-z][a-z0-9_]{1,31}|home:[0-9a-f-]{36})$' then raise exception 'Invalid room'; end if;
  if not public.can_enter_chat_room(p_room) then raise exception 'You cannot chat in this room'; end if;
  select display_name into nm from public.profiles where id = uid;
  if nm is null then raise exception 'Profile not found'; end if;

  if p_preset is not null then
    msg := public.preset_text(p_preset);
    if msg is null then raise exception 'Unknown quick chat'; end if;
    k := 'preset';
  else
    msg := btrim(regexp_replace(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
    if msg = '' then raise exception 'Type a message first'; end if;
    if char_length(msg) > 100 then raise exception 'Messages can be up to 100 characters'; end if;
    if not public.setting_of(uid, 'allow_messages') then raise exception 'Typed chat is turned off in your settings. Use quick chat!'; end if;
    if not public.chat_is_clean(msg) then raise exception 'That message is not allowed here'; end if;
  end if;

  select max(created_at), count(*) filter (where created_at > now() - interval '10 seconds'), count(*)
    into last_at, n10, n60 from public.chat_messages where sender_id = uid and created_at > now() - interval '60 seconds';
  if last_at is not null and last_at > now() - interval '600 milliseconds' then raise exception 'Slow down!'; end if;
  if n10 >= 5 or n60 >= 20 then raise exception 'You are chatting too fast. Wait a moment.'; end if;
  if k = 'text' and exists (select 1 from public.chat_messages where sender_id = uid and message = msg and created_at > now() - interval '20 seconds') then
    raise exception 'You already said that';
  end if;

  insert into public.chat_messages (room_id, sender_id, sender_name, message, kind) values (p_room, uid, nm, msg, k) returning * into rec;
  return jsonb_build_object('id', rec.id, 'created_at', rec.created_at);
end $$;

-- Housekeeping: call from pg_cron (see bottom). Keeps the table small; reports keep their own evidence snapshot.
create or replace function public.prune_social_data() returns void
language sql security definer set search_path = public as $$
  delete from public.chat_messages where created_at < now() - interval '24 hours';
  delete from public.friend_requests where status <> 'pending' and coalesce(responded_at, created_at) < now() - interval '30 days';
$$;

-- =====================================================================
-- 6. Friends
-- =====================================================================
create or replace function public._pub(p uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'username', username, 'display_name', display_name, 'avatar_data', avatar_data) from public.profiles where id = p
$$;

-- Full social snapshot for the caller (one request instead of five).
create or replace function public.get_social_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); s public.player_settings;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into s from public.player_settings where user_id = uid;
  return jsonb_build_object(
    'settings', jsonb_build_object(
      'allow_friend_requests', coalesce(s.allow_friend_requests, true), 'allow_friend_joins', coalesce(s.allow_friend_joins, true),
      'allow_messages', coalesce(s.allow_messages, true), 'allow_room_visits', coalesce(s.allow_room_visits, true)),
    'friends', coalesce((select jsonb_agg(public._pub(case when f.user_id = uid then f.friend_id else f.user_id end) || jsonb_build_object('since', f.created_at)
                                          order by f.created_at desc) from public.friendships f where uid in (f.user_id, f.friend_id)), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'created_at', r.created_at, 'player', public._pub(r.sender_id)) order by r.created_at desc)
                          from public.friend_requests r where r.receiver_id = uid and r.status = 'pending'), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'created_at', r.created_at, 'player', public._pub(r.receiver_id)) order by r.created_at desc)
                          from public.friend_requests r where r.sender_id = uid and r.status = 'pending'), '[]'::jsonb),
    'blocked', coalesce((select jsonb_agg(public._pub(b.blocked_user_id) order by b.created_at desc) from public.player_blocks b where b.user_id = uid), '[]'::jsonb),
    'muted',   coalesce((select jsonb_agg(public._pub(m.muted_user_id) order by m.created_at desc) from public.player_mutes m where m.user_id = uid), '[]'::jsonb));
end $$;

create or replace function public.update_my_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); k text; cur jsonb;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if jsonb_typeof(p) <> 'object' then raise exception 'Invalid settings'; end if;
  for k in select jsonb_object_keys(p) loop
    if k not in ('allow_friend_requests','allow_friend_joins','allow_messages','allow_room_visits') or jsonb_typeof(p->k) <> 'boolean' then
      raise exception 'Invalid setting: %', k;
    end if;
  end loop;
  insert into public.player_settings (user_id) values (uid) on conflict (user_id) do nothing;
  update public.player_settings set
    allow_friend_requests = coalesce((p->>'allow_friend_requests')::boolean, allow_friend_requests),
    allow_friend_joins    = coalesce((p->>'allow_friend_joins')::boolean, allow_friend_joins),
    allow_messages        = coalesce((p->>'allow_messages')::boolean, allow_messages),
    allow_room_visits     = coalesce((p->>'allow_room_visits')::boolean, allow_room_visits),
    updated_at = now()
  where user_id = uid;
  select to_jsonb(s) - 'user_id' - 'updated_at' into cur from public.player_settings s where user_id = uid;
  return cur;
end $$;

-- Username search: 2-16 chars, prefix match, max 10, never returns yourself or anyone blocked either way.
create or replace function public.search_players(p_query text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); q text := lower(btrim(coalesce(p_query, '')));
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if q !~ '^[a-z0-9_]{2,16}$' then raise exception 'Search for 2-16 letters, numbers or _'; end if;
  return coalesce((select jsonb_agg(x.j order by x.u) from (
    select lower(p.username) u, public._pub(p.id) || jsonb_build_object('relation',
        case when public.are_friends(uid, p.id) then 'friend'
             when exists (select 1 from public.friend_requests r where r.sender_id = uid and r.receiver_id = p.id and r.status = 'pending') then 'pending_out'
             when exists (select 1 from public.friend_requests r where r.sender_id = p.id and r.receiver_id = uid and r.status = 'pending') then 'pending_in'
             else 'none' end) j
    from public.profiles p
    where lower(p.username) like replace(q, '_', '\_') || '%' and p.id <> uid and not public.is_blocked_between(uid, p.id)
    order by lower(p.username) limit 10) x), '[]'::jsonb);
end $$;

-- Public profile card. Returns the same "not found" for missing and blocked-you players.
create or replace function public.get_player_profile(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.profiles;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into p from public.profiles where id = p_id;
  if not found or (p_id <> uid and public.is_blocked_between(uid, p_id) and not exists (select 1 from public.player_blocks where user_id = uid and blocked_user_id = p_id)) then
    raise exception 'Player not found';
  end if;
  return public._pub(p_id) || jsonb_build_object('created_at', p.created_at, 'is_me', p_id = uid,
    'relation', case when p_id = uid then 'me' when public.are_friends(uid, p_id) then 'friend'
      when exists (select 1 from public.friend_requests r where r.sender_id = uid and r.receiver_id = p_id and r.status = 'pending') then 'pending_out'
      when exists (select 1 from public.friend_requests r where r.sender_id = p_id and r.receiver_id = uid and r.status = 'pending') then 'pending_in'
      else 'none' end,
    'blocked', exists (select 1 from public.player_blocks where user_id = uid and blocked_user_id = p_id),
    'muted',   exists (select 1 from public.player_mutes where user_id = uid and muted_user_id = p_id));
end $$;

create or replace function public._make_friends(a uuid, b uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.friendships where a in (user_id, friend_id)) >= 100 then raise exception 'Your friend list is full'; end if;
  if (select count(*) from public.friendships where b in (user_id, friend_id)) >= 100 then raise exception 'That player''s friend list is full'; end if;
  insert into public.friendships (user_id, friend_id) values (least(a, b), greatest(a, b)) on conflict do nothing;
end $$;

-- Send a request. Returns 'sent', or 'accepted' when they had already asked you (mutual => instant friends).
create or replace function public.send_friend_request(p_receiver uuid) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); rev public.friend_requests;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_receiver is null then raise exception 'Invalid player'; end if;
  if p_receiver = uid then raise exception 'You cannot add yourself'; end if;
  if not exists (select 1 from public.profiles where id = p_receiver) or public.is_blocked_between(uid, p_receiver) then raise exception 'Player not found'; end if;
  if public.are_friends(uid, p_receiver) then raise exception 'You are already friends'; end if;
  if not public.setting_of(p_receiver, 'allow_friend_requests') then raise exception 'This player is not accepting friend requests'; end if;

  select * into rev from public.friend_requests where sender_id = p_receiver and receiver_id = uid and status = 'pending' for update;
  if found then
    perform public._make_friends(uid, p_receiver);
    update public.friend_requests set status = 'accepted', responded_at = now() where id = rev.id;
    return 'accepted';
  end if;
  if exists (select 1 from public.friend_requests where sender_id = uid and receiver_id = p_receiver and status = 'pending') then raise exception 'Request already sent'; end if;
  if exists (select 1 from public.friend_requests where sender_id = uid and receiver_id = p_receiver and status = 'declined' and responded_at > now() - interval '1 day') then
    raise exception 'Please wait a while before asking this player again';
  end if;
  if (select count(*) from public.friend_requests where sender_id = uid and status = 'pending') >= 30 then raise exception 'You have too many pending requests'; end if;
  if (select count(*) from public.friend_requests where sender_id = uid and created_at > now() - interval '1 hour') >= 20 then raise exception 'Slow down! Try again later'; end if;
  if (select count(*) from public.friendships where uid in (user_id, friend_id)) >= 100 then raise exception 'Your friend list is full'; end if;
  begin
    insert into public.friend_requests (sender_id, receiver_id) values (uid, p_receiver);
  exception when unique_violation then raise exception 'A request is already pending';
  end;
  return 'sent';
end $$;

create or replace function public.respond_friend_request(p_request uuid, p_accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r public.friend_requests;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into r from public.friend_requests where id = p_request for update;
  if not found or r.receiver_id <> uid or r.status <> 'pending' then raise exception 'Request not found'; end if;   -- only the receiver, only while pending
  if p_accept then
    if public.is_blocked_between(uid, r.sender_id) then raise exception 'Request not found'; end if;
    perform public._make_friends(uid, r.sender_id);
    update public.friend_requests set status = 'accepted', responded_at = now() where id = r.id;
    return 'accepted';
  end if;
  update public.friend_requests set status = 'declined', responded_at = now() where id = r.id;
  return 'declined';
end $$;

create or replace function public.cancel_friend_request(p_request uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  update public.friend_requests set status = 'cancelled', responded_at = now() where id = p_request and sender_id = uid and status = 'pending';
  if not found then raise exception 'Request not found'; end if;
end $$;

create or replace function public.remove_friend(p_friend uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  delete from public.friendships where user_id = least(uid, p_friend) and friend_id = greatest(uid, p_friend);
  if not found then raise exception 'You are not friends'; end if;
end $$;

-- =====================================================================
-- 7. Block / mute / report
-- =====================================================================
create or replace function public.block_player(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_id is null or p_id = uid or not exists (select 1 from public.profiles where id = p_id) then raise exception 'Invalid player'; end if;
  if (select count(*) from public.player_blocks where user_id = uid) >= 200 then raise exception 'Your block list is full'; end if;
  insert into public.player_blocks (user_id, blocked_user_id) values (uid, p_id) on conflict do nothing;
  delete from public.friendships where user_id = least(uid, p_id) and friend_id = greatest(uid, p_id);
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where status = 'pending' and ((sender_id = uid and receiver_id = p_id) or (sender_id = p_id and receiver_id = uid));
end $$;

create or replace function public.unblock_player(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from public.player_blocks where user_id = auth.uid() and blocked_user_id = p_id;
end $$;

create or replace function public.mute_player(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_id is null or p_id = uid or not exists (select 1 from public.profiles where id = p_id) then raise exception 'Invalid player'; end if;
  if (select count(*) from public.player_mutes where user_id = uid) >= 200 then raise exception 'Your mute list is full'; end if;
  insert into public.player_mutes (user_id, muted_user_id) values (uid, p_id) on conflict do nothing;
end $$;

create or replace function public.unmute_player(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from public.player_mutes where user_id = auth.uid() and muted_user_id = p_id;
end $$;

-- Reports are write-only for players. Evidence (the target's recent chat) is copied server-side, not trusted from the client.
create or replace function public.report_player(p_id uuid, p_reason text, p_details text default null, p_room text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ctx text; det text := nullif(btrim(regexp_replace(coalesce(p_details, ''), '[[:cntrl:]]', ' ', 'g')), '');
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if p_id is null or p_id = uid or not exists (select 1 from public.profiles where id = p_id) then raise exception 'Invalid player'; end if;
  if p_reason not in ('bad_language','harassment','spam','inappropriate_name','cheating','other') then raise exception 'Choose a reason'; end if;
  if det is not null and char_length(det) > 200 then raise exception 'Keep the note under 200 characters'; end if;
  if p_room is not null and p_room !~ '^([a-z][a-z0-9_]{1,31}|home:[0-9a-f-]{36})$' then p_room := null; end if;
  if exists (select 1 from public.reports where reporter_id = uid and reported_user_id = p_id and created_at > now() - interval '10 minutes') then
    raise exception 'You already reported this player. Thank you!';
  end if;
  if (select count(*) from public.reports where reporter_id = uid and created_at > now() - interval '1 hour') >= 10 then raise exception 'Too many reports. Try again later'; end if;
  select string_agg(to_char(created_at, 'HH24:MI:SS') || ' [' || room_id || '] ' || message, E'\n' order by created_at)
    into ctx from (select * from public.chat_messages where sender_id = p_id and created_at > now() - interval '15 minutes' order by created_at desc limit 8) m;
  insert into public.reports (reporter_id, reported_user_id, reason, details, room_id, context) values (uid, p_id, p_reason, det, p_room, ctx);
end $$;

-- =====================================================================
-- 8. Function permissions: callable by signed-in players only
-- =====================================================================
revoke all on function
  public.get_my_profile(), public.can_view_room(uuid, text), public.can_enter_chat_room(text), public.chat_visible(text, uuid, text, boolean),
  public.send_chat(text, text, text), public.get_social_overview(), public.update_my_settings(jsonb), public.search_players(text),
  public.get_player_profile(uuid), public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean),
  public.cancel_friend_request(uuid), public.remove_friend(uuid), public.block_player(uuid), public.unblock_player(uuid),
  public.mute_player(uuid), public.unmute_player(uuid), public.report_player(uuid, text, text, text)
  from public, anon;
grant execute on function
  public.get_my_profile(), public.can_view_room(uuid, text), public.can_enter_chat_room(text), public.chat_visible(text, uuid, text, boolean),
  public.send_chat(text, text, text), public.get_social_overview(), public.update_my_settings(jsonb), public.search_players(text),
  public.get_player_profile(uuid), public.send_friend_request(uuid), public.respond_friend_request(uuid, boolean),
  public.cancel_friend_request(uuid), public.remove_friend(uuid), public.block_player(uuid), public.unblock_player(uuid),
  public.mute_player(uuid), public.unmute_player(uuid), public.report_player(uuid, text, text, text)
  to authenticated;
-- internal helpers: not callable through the API at all
revoke all on function public.are_friends(uuid, uuid), public.is_blocked_between(uuid, uuid), public.setting_of(uuid, text), public._pub(uuid),
  public._make_friends(uuid, uuid), public.chat_squash(text), public.chat_is_clean(text), public.preset_text(text), public.prune_social_data()
  from public, anon, authenticated;

-- =====================================================================
-- 9. Realtime: only the tables clients subscribe to (RLS above decides which rows each player receives)
-- =====================================================================
do $$ declare t text; begin
  foreach t in array array['chat_messages', 'friend_requests', 'friendships'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =====================================================================
-- 10. Starter word list (deliberately small: EXTEND IT, or put a moderation service in front of send_chat later)
-- =====================================================================
insert into public.chat_filter_terms (term, mode) values
  ('fuck','contains'), ('shit','word'), ('bitch','contains'), ('asshole','contains'), ('bastard','word'), ('cunt','contains'),
  ('dick','word'), ('piss','word'), ('slut','word'), ('whore','contains'), ('wtf','word'), ('stfu','word'), ('kys','word'),
  ('idiot','word'), ('loser','word'), ('die','word'), ('kill','word'), ('nude','word'), ('sex','word')
on conflict (term) do nothing;

-- Optional (Database -> Extensions -> pg_cron), then:
--   select cron.schedule('anchors-prune', '*/30 * * * *', $$select public.prune_social_data()$$);
