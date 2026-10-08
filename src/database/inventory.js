import { supabase } from '../config/supabase.js';

// All writes go through SECURITY DEFINER functions: the server decides prices, ownership and balances.
// Phase 5: inventory rows carry a quantity (furniture stacks; clothing is always 1).
export async function fetchInventory() {
  const { data, error } = await supabase.from('inventory').select('item_id, quantity');
  if (error) throw error;
  return new Map(data.map((r) => [r.item_id, r.quantity ?? 1]));
}
export async function fetchOwned() { return new Set((await fetchInventory()).keys()); }   // Phase 4 API, kept

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
export const purchaseItem = (id) => rpc('purchase_item', { p_item_id: id });   // -> new coin balance
export const saveAvatar = (avatar) => rpc('save_avatar', { p: avatar });
export const claimDaily = () => rpc('claim_daily_reward');                     // -> {day,coins,item,balance}
// Phase 14: the founder's cache. The server reads the caller's own verified e-mail from their auth token and
// compares it with the founder_accounts allow-list; the browser sends nothing and cannot influence the answer.
// Phase 16: the crate has a keypad. The browser posts the digits somebody typed and nothing else — the real code
// lives in a table no player can read (supabase/phase16.sql), so it never reaches the client bundle.
export const claimFounderItem = (code) => rpc('claim_founder_item', { p_code: String(code || '') });

// ---- local mirror of the server's inventory (UI convenience only; the server stays the authority) ----
export function setInventory(profile, map) {
  profile.inv = map;
  profile.owned = new Set(map.keys());
}
export const qtyOf = (profile, id) => profile.inv?.get(id) || 0;
export function recordPurchase(profile, id) {
  profile.inv = profile.inv || new Map();
  profile.inv.set(id, qtyOf(profile, id) + 1);
  profile.owned.add(id);
}
