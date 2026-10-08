-- =====================================================================
-- ANCHORS WORLD · PHASE 16 — the Sealed Crate gets a keypad
-- Run AFTER phase14.sql. Safe to re-run.
--
-- The crate in the Star Chamber now needs a CODE as well as the right account. Two independent locks:
--   * the code is stored in `founder_accounts`, a table with RLS on, no policy and no grant — no player can read
--     it, and it is never sent to the browser. The client only ever posts the digits someone typed.
--   * the account still has to be on the allow-list, so even a leaked code opens nothing for anyone else.
-- Wrong attempts are counted and limited, so the keypad cannot be brute-forced (an 11-digit code at 12 guesses an
-- hour would take longer than the universe has been around, but the limit also keeps the table quiet).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The code lives with the account that may use it
-- ---------------------------------------------------------------------
alter table public.founder_accounts add column if not exists code text;
alter table public.founder_accounts drop constraint if exists founder_accounts_code_check;
alter table public.founder_accounts add constraint founder_accounts_code_check
  check (code is null or code ~ '^[0-9]{4,24}$');

-- Digits only; any spaces a player types are ignored on both sides.
update public.founder_accounts
   set code = '12396586798'
 where lower(email) = 'theo.ahlqvist.12@outlook.com';

-- ---------------------------------------------------------------------
-- 2. Attempt log, so the keypad can be rate-limited
-- ---------------------------------------------------------------------
create table if not exists public.founder_attempts (
  id        uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.profiles(id) on delete cascade,
  ok        boolean not null default false,
  at        timestamptz not null default now()
);
create index if not exists founder_attempts_player on public.founder_attempts (player_id, at desc);
alter table public.founder_attempts enable row level security;
revoke all on public.founder_attempts from anon, authenticated;     -- RLS on, no policy: invisible to players

-- ---------------------------------------------------------------------
-- 3. claim_founder_item(code) -> {ok, item, name, already} | {ok:false, error:'code'|'locked'|'slow_down'}
--    The old no-argument version is replaced.
-- ---------------------------------------------------------------------
drop function if exists public.claim_founder_item();

create or replace function public.claim_founder_item(p_code text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  who text;
  typed text := regexp_replace(coalesce(p_code, ''), '[^0-9]', '', 'g');   -- spaces and dashes do not matter
  f public.founder_accounts;
  it public.items;
  tries integer;
  fresh boolean;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 16));

  -- no more than 12 guesses an hour, whoever you are
  select count(*) into tries from public.founder_attempts
   where player_id = uid and not ok and at > now() - interval '1 hour';
  if tries >= 12 then
    return jsonb_build_object('ok', false, 'error', 'slow_down');
  end if;

  who := lower(coalesce(nullif(auth.jwt() ->> 'email', ''), (select email from auth.users where id = uid)));
  select * into f from public.founder_accounts where lower(email) = who;

  -- A wrong code and a wrong account give the SAME answer, so the keypad never reveals which of the two was wrong.
  if not found or f.code is null or typed = '' or typed <> f.code then
    insert into public.founder_attempts (player_id, ok) values (uid, false);
    return jsonb_build_object('ok', false, 'error', 'code');
  end if;

  select * into it from public.items where id = f.item_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'locked'); end if;

  insert into public.inventory (user_id, item_id) values (uid, f.item_id) on conflict do nothing;
  fresh := found;
  insert into public.founder_attempts (player_id, ok) values (uid, true);

  return jsonb_build_object('ok', true, 'item', it.id, 'name', it.name, 'already', not fresh);
end $$;

revoke all on function public.claim_founder_item(text) from public, anon;
grant execute on function public.claim_founder_item(text) to authenticated;

-- Change the code later:  update public.founder_accounts set code = '<digits>' where email = '<address>';
-- Clear someone's lockout: delete from public.founder_attempts where player_id = '<uuid>';
