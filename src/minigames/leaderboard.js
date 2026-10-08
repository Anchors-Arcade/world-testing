import { supabase } from '../config/supabase.js';

// Leaderboards come from get_leaderboard(game, scope, limit). The server picks the player from auth.uid() to compute "me".
// New boards need no client change beyond adding the scope here (and one CASE branch in SQL).
export const SCOPES = [['global', 'All-time'], ['daily', 'Today'], ['weekly', 'This week'], ['monthly', 'This month'], ['personal', 'My scores']];

const cache = new Map();   // "game|scope" -> {at, data}; 20 s so flipping between tabs does not hammer the database
export async function fetchLeaderboard(game, scope = 'global', limit = 20, force = false) {
  const key = `${game}|${scope}`, hit = cache.get(key);
  if (!force && hit && Date.now() - hit.at < 20000) return hit.data;
  const { data, error } = await supabase.rpc('get_leaderboard', { p_game: game, p_scope: scope, p_limit: limit });
  if (error) throw new Error(error.message);
  cache.set(key, { at: Date.now(), data });
  return data;
}
export const invalidateLeaderboards = () => cache.clear();
