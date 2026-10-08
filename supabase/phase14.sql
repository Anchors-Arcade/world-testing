-- =====================================================================
-- ANCHORS WORLD · PHASE 14 — the Blue Star, and the founder's jetpack
-- Run AFTER phase9.sql (it extends the same `items` catalogue). Safe to re-run.
--
-- Two items:
--   * accessory_star  — the Blue Star pendant. An ordinary cosmetic: anyone can buy it in Snowy Threads.
--   * back_jetpack_x  — the Aurora Jetpack. Exactly ONE account can ever own this.
--
-- How the jetpack is locked, properly:
--   1. The item row is `purchasable = false`, so purchase_item() refuses it outright ("This item is not for
--      sale") — that check already exists in phase5.sql and needs no change.
--   2. Players have no insert rights on `inventory` (schema.sql revokes them), so nothing can write it directly.
--   3. The only door is claim_founder_item(), which compares the CALLER'S OWN verified e-mail from their auth
--      token against the `founder_accounts` allow-list. The browser never says who it is, so editing the client,
--      replaying the request or calling the RPC from a console gets a plain refusal.
--   4. `founder_accounts` has RLS on with no policy and no grant: nobody can even read the list, let alone add
--      themselves to it. Only the SQL editor / service role can change it.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The items
-- ---------------------------------------------------------------------
insert into public.items (id, name, category, rarity, asset, description, price, starter, purchasable, kind) values
  ('accessory_star', 'Blue Star', 'accessory', 'rare', 'accessory_star',
   'A six-pointed blue star on a fine chain.', 260, false, true, 'clothing'),
  ('back_jetpack_x', 'Aurora Jetpack', 'back', 'event', 'back_jetpack_x',
   'One of a kind. It still smells faintly of ozone.', 0, false, false, 'clothing')
on conflict (id) do update set name = excluded.name, category = excluded.category, rarity = excluded.rarity,
  asset = excluded.asset, description = excluded.description, price = excluded.price,
  starter = excluded.starter, purchasable = excluded.purchasable, kind = excluded.kind;

-- ---------------------------------------------------------------------
-- 2. Who may claim it
--    Change the e-mail below (or insert more rows) to move or share the privilege. Nothing else needs editing.
-- ---------------------------------------------------------------------
create table if not exists public.founder_accounts (
  email      text primary key,
  item_id    text not null references public.items(id) on delete cascade,
  note       text not null default '',
  created_at timestamptz not null default now()
);

insert into public.founder_accounts (email, item_id, note) values
  ('theo.ahlqvist.12@outlook.com', 'back_jetpack_x', 'Built Anchors World.')
on conflict (email) do update set item_id = excluded.item_id, note = excluded.note;

alter table public.founder_accounts enable row level security;
revoke all on public.founder_accounts from anon, authenticated;   -- RLS on, NO policy, NO grant: unreadable by players

-- ---------------------------------------------------------------------
-- 3. claim_founder_item() -> { ok, item, name, already } | { ok:false, error }
--    The e-mail comes from the caller's own verified JWT, never from the request body.
-- ---------------------------------------------------------------------
create or replace function public.claim_founder_item() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  who text;
  f public.founder_accounts;
  it public.items;
  fresh boolean;
begin
  if uid is null then raise exception 'Not signed in'; end if;

  -- the signed-in account's real address: the token first, the auth table as a fallback
  who := lower(coalesce(nullif(auth.jwt() ->> 'email', ''), (select email from auth.users where id = uid)));
  if who is null then return jsonb_build_object('ok', false, 'error', 'locked'); end if;

  select * into f from public.founder_accounts where lower(email) = who;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'locked');       -- returned, not raised: no hint of what is inside
  end if;

  select * into it from public.items where id = f.item_id;
  if not found then return jsonb_build_object('ok', false, 'error', 'locked'); end if;

  insert into public.inventory (user_id, item_id) values (uid, f.item_id) on conflict do nothing;
  fresh := found;

  return jsonb_build_object('ok', true, 'item', it.id, 'name', it.name, 'already', not fresh);
end $$;

revoke all on function public.claim_founder_item() from public, anon;
grant execute on function public.claim_founder_item() to authenticated;
