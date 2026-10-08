-- =====================================================================
-- ANCHORS WORLD · PHASE 15 — The Town Hall and its endless picture wall
-- Run AFTER schema.sql, phase5.sql and phase6.sql (it reuses `profiles` and the Phase 6 `reports` table).
-- Safe to re-run.
--
-- What this adds: one Storage bucket for the pictures themselves, one table of rows describing them, and four
-- functions. The wall grows on its own — every 10 pictures the hall gains another bay — so there is no "wall size"
-- stored anywhere; the client derives it from the count.
--
-- Trust model, same as every other phase:
--   * The browser uploads the FILE to Storage under a path it is only allowed to write inside its own user folder
--     (enforced by the storage policies below), then calls add_wall_picture() to register it.
--   * add_wall_picture() re-checks the path really belongs to the caller, cleans the caption with the Phase 6 chat
--     rules, and applies a per-player limit and a cool-down. A row it did not create cannot exist.
--   * Nobody can insert, update or delete `wall_pictures` directly: RLS is on and the write grants are revoked.
--   * Any player can report a picture; a moderator hides it by setting `hidden = true` from the SQL editor, exactly
--     like hiding a chat line in Phase 6. Hidden rows stop being served to everyone immediately.
--
-- ⚠️ MODERATION: this is the only part of Anchors World where players publish IMAGES. Pictures are visible to
-- everyone who walks into the Town Hall. Read the "Moderating the wall" section of the README before you open it to
-- the public: at minimum keep PICTURE_LIMIT low, watch the reports table, and consider requiring approval
-- (set `approved` to false by default below and flip it yourself).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Storage bucket. Public read, writes confined to each player's own folder.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wall', 'wall', true, 600000, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = 600000,
  allowed_mime_types = array['image/jpeg', 'image/webp', 'image/png'];

drop policy if exists "wall read" on storage.objects;
create policy "wall read" on storage.objects for select
  using (bucket_id = 'wall');

-- A player may only ever write inside   wall/<their own uid>/...
drop policy if exists "wall write own folder" on storage.objects;
create policy "wall write own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'wall' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "wall delete own folder" on storage.objects;
create policy "wall delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'wall' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------
-- 2. The wall itself
-- ---------------------------------------------------------------------
create table if not exists public.wall_pictures (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.profiles(id) on delete cascade,
  path       text not null unique check (char_length(path) between 8 and 300),
  caption    text not null default '' check (char_length(caption) <= 60),
  w          integer not null default 0 check (w >= 0 and w <= 4000),
  h          integer not null default 0 check (h >= 0 and h <= 4000),
  hidden     boolean not null default false,              -- a moderator's off switch
  approved   boolean not null default true,               -- flip the DEFAULT to false to run an approval queue
  created_at timestamptz not null default now()
);
-- the wall is read in order, oldest first, so a picture never moves once it is hung
create index if not exists wall_pictures_order on public.wall_pictures (created_at) where (not hidden and approved);
create index if not exists wall_pictures_player on public.wall_pictures (player_id, created_at desc);

alter table public.wall_pictures enable row level security;
revoke all on public.wall_pictures from anon, authenticated;
grant select on public.wall_pictures to authenticated;

drop policy if exists "read visible pictures" on public.wall_pictures;
create policy "read visible pictures" on public.wall_pictures for select to authenticated
  using ((not hidden and approved) or player_id = auth.uid());
-- no insert / update / delete policy at all: everything goes through the functions below.

-- ---------------------------------------------------------------------
-- 3. Limits (change these two numbers and nothing else)
-- ---------------------------------------------------------------------
create or replace function public.wall_picture_limit() returns integer language sql immutable as $$ select 3 $$;      -- per player
create or replace function public.wall_cooldown() returns interval language sql immutable as $$ select interval '60 seconds' $$;

-- ---------------------------------------------------------------------
-- 4. add_wall_picture(path, caption, w, h) -> {ok, id, index, total} | raises
--    The file must already be uploaded to  wall/<uid>/<something>  by the same account.
-- ---------------------------------------------------------------------
create or replace function public.add_wall_picture(p_path text, p_caption text default '', p_w integer default 0, p_h integer default 0)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cap text := btrim(regexp_replace(coalesce(p_caption, ''), '[[:cntrl:]]', ' ', 'g'));
  mine integer; last_at timestamptz; new_id uuid; total integer; idx integer;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 15));

  -- the path must be this player's own folder in the wall bucket, and the object must really exist
  if p_path is null or p_path !~ ('^' || uid::text || '/[A-Za-z0-9._-]{4,200}$') then
    raise exception 'That picture does not belong to you';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'wall' and name = p_path) then
    raise exception 'The upload did not finish — try again';
  end if;

  -- caption: same spirit as Phase 6 chat. Short, no links, no contact details, run through the word filter.
  if char_length(cap) > 60 then raise exception 'Keep the caption under 60 characters'; end if;
  if cap ~* '(https?://|www\.|@[a-z0-9]|\.(com|net|org|io|gg)\b|[0-9][0-9 .-]{6,})' then
    raise exception 'Captions cannot contain links, e-mails or phone numbers';
  end if;
  if exists (select 1 from public.chat_filter_terms t where cap ilike '%' || t.term || '%') then
    raise exception 'Please choose a different caption';
  end if;

  select count(*), max(created_at) into mine, last_at from public.wall_pictures where player_id = uid;
  if mine >= public.wall_picture_limit() then
    raise exception 'You already have % pictures on the wall. Take one down first.', public.wall_picture_limit();
  end if;
  if last_at is not null and now() - last_at < public.wall_cooldown() then
    raise exception 'One picture a minute, please!';
  end if;

  insert into public.wall_pictures (player_id, path, caption, w, h)
    values (uid, p_path, cap, greatest(0, coalesce(p_w, 0)), greatest(0, coalesce(p_h, 0)))
    returning id into new_id;

  select count(*) into total from public.wall_pictures where not hidden and approved;
  select count(*) into idx from public.wall_pictures where not hidden and approved
    and created_at <= (select created_at from public.wall_pictures where id = new_id);

  return jsonb_build_object('ok', true, 'id', new_id, 'index', idx, 'total', total);
end $$;

-- ---------------------------------------------------------------------
-- 5. get_wall(from, limit) -> {total, mine, limit, pictures:[{id,path,caption,w,h,player_id,display_name,at,own}]}
--    `from` is an index into the wall, so the client can fetch only the bays the player is standing near.
-- ---------------------------------------------------------------------
create or replace function public.get_wall(p_from integer default 0, p_limit integer default 60) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); lim integer := least(greatest(coalesce(p_limit, 60), 1), 120); off integer := greatest(coalesce(p_from, 0), 0);
begin
  if uid is null then raise exception 'Not signed in'; end if;
  return jsonb_build_object(
    'total', (select count(*) from public.wall_pictures where not hidden and approved),
    'mine',  (select count(*) from public.wall_pictures where player_id = uid),
    'limit', public.wall_picture_limit(),
    'from',  off,
    'pictures', (select coalesce(jsonb_agg(to_jsonb(r) order by r.at), '[]'::jsonb) from (
        select p.id, p.path, p.caption, p.w, p.h, p.player_id, pr.display_name, p.created_at as at,
               (p.player_id = uid) as own
          from public.wall_pictures p
          join public.profiles pr on pr.id = p.player_id
         where not p.hidden and p.approved
         order by p.created_at
         offset off limit lim) r));
end $$;

-- ---------------------------------------------------------------------
-- 6. remove_wall_picture(id) -> true   (your own pictures only; the file goes too)
-- ---------------------------------------------------------------------
create or replace function public.remove_wall_picture(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pic public.wall_pictures;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into pic from public.wall_pictures where id = p_id;
  if not found or pic.player_id <> uid then raise exception 'That is not your picture'; end if;
  delete from public.wall_pictures where id = p_id;
  delete from storage.objects where bucket_id = 'wall' and name = pic.path;
  return true;
end $$;

-- ---------------------------------------------------------------------
-- 7. report_wall_picture(id, reason, details) — reuses the Phase 6 reports table and its review queue.
--    The reported player and the picture's path are recorded as evidence; players can never read reports.
-- ---------------------------------------------------------------------
create or replace function public.report_wall_picture(p_id uuid, p_reason text default 'other', p_details text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pic public.wall_pictures;
  det text := nullif(btrim(regexp_replace(coalesce(p_details, ''), '[[:cntrl:]]', ' ', 'g')), '');
begin
  if uid is null then raise exception 'Not signed in'; end if;
  select * into pic from public.wall_pictures where id = p_id;
  if not found then raise exception 'That picture is already gone'; end if;
  if pic.player_id = uid then raise exception 'That is your own picture'; end if;
  if p_reason not in ('bad_language','harassment','spam','inappropriate_name','cheating','other') then p_reason := 'other'; end if;
  if (select count(*) from public.reports where reporter_id = uid and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many reports. Try again later';
  end if;
  if exists (select 1 from public.reports where reporter_id = uid and reported_user_id = pic.player_id
             and context like 'wall:' || pic.id::text || '%' and created_at > now() - interval '1 day') then
    raise exception 'You already reported this picture. Thank you!';
  end if;
  insert into public.reports (reporter_id, reported_user_id, reason, details, room_id, context)
    values (uid, pic.player_id, p_reason, det, 'town_hall',
            'wall:' || pic.id::text || ' path:' || pic.path || ' caption:' || coalesce(pic.caption, ''));
end $$;

-- ---------------------------------------------------------------------
-- 8. Permissions + housekeeping
-- ---------------------------------------------------------------------
revoke all on function public.add_wall_picture(text, text, integer, integer), public.get_wall(integer, integer),
  public.remove_wall_picture(uuid), public.report_wall_picture(uuid, text, text),
  public.wall_picture_limit(), public.wall_cooldown() from public, anon;
grant execute on function public.add_wall_picture(text, text, integer, integer), public.get_wall(integer, integer),
  public.remove_wall_picture(uuid), public.report_wall_picture(uuid, text, text) to authenticated;
revoke all on function public.wall_picture_limit(), public.wall_cooldown() from authenticated;

-- Moderation cheat sheet (run these in the SQL editor / service role):
--   hide one picture:     update public.wall_pictures set hidden = true where id = '<uuid>';
--   see open reports:     select * from public.reports where room_id = 'town_hall' and status = 'open' order by created_at desc;
--   require approval:     alter table public.wall_pictures alter column approved set default false;
--   approve one:          update public.wall_pictures set approved = true where id = '<uuid>';
--   delete a file too:    delete from storage.objects where bucket_id = 'wall' and name = '<path>';
