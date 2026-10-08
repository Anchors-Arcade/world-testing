import { supabase } from '../config/supabase.js';

// =====================================================================
// PHASE 17 — the admin API.
//
// Every call here is a SECURITY DEFINER function that starts with require_staff(): the database looks the CALLER
// up by auth.uid() and reads their role out of `profiles`. Nothing in this file grants anything — it only asks.
// A player who edits the bundle, flips a flag or calls these from the console gets an exception, because the
// permission check never happens in the browser.
// =====================================================================
async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

// The role of the signed-in account, asked of the server. Used only to decide whether to DRAW the panel —
// pressing P without the role opens nothing, and every action re-checks server-side anyway.
export async function myRole() {
  if (!supabase) return 'user';
  try { return (await rpc('my_role')) || 'user'; } catch { return 'user'; }
}

export const searchPlayers = (q = '', limit = 25) => rpc('admin_search_players', { p_q: q, p_limit: limit });
export const getPlayer = (id) => rpc('admin_player', { p_id: id });
export const setCoins = (id, amount, mode = 'add') => rpc('admin_set_coins', { p_id: id, p_amount: amount, p_mode: mode });
export const giveItem = (id, item, qty = 1) => rpc('admin_give_item', { p_id: id, p_item: item, p_qty: qty });
export const setRole = (id, role) => rpc('admin_set_role', { p_id: id, p_role: role });
export const banPlayer = (id, minutes, reason) => rpc('admin_ban', { p_id: id, p_minutes: minutes, p_reason: reason || '' });
export const unbanPlayer = (id) => rpc('admin_unban', { p_id: id });
export const timeoutPlayer = (id, minutes, reason) => rpc('admin_timeout', { p_id: id, p_minutes: minutes, p_reason: reason || '' });
export const kickPlayer = (id, reason) => rpc('admin_kick', { p_id: id, p_reason: reason || '' });
export const announce = (body, minutes = 2) => rpc('admin_announce', { p_body: body, p_minutes: minutes });

export const niceAdminError = (e) =>
  /could not find the function|schema cache|PGRST202/i.test(e?.message || '')
    ? 'The admin tables are not set up yet. Run supabase/phase17.sql.'
    : (e?.message || 'Something went wrong.');
