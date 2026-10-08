import { supabase } from '../config/supabase.js';

// All score + session traffic. Every call goes through a SECURITY DEFINER function that reads the player from auth.uid():
// the browser never sends a player id or a coin amount. Gameplay never calls this; only "start" and "finish" do.
async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

// Arcade overview (all games' reward tiers + my bests + coins earned today) = ONE request, cached briefly.
let overview = null, at = 0, inflight = null;
const guestBests = new Map();            // guests can play for fun; scores live in memory only

export function cachedOverview() { return overview; }
export function invalidateOverview() { at = 0; }
export async function fetchOverview(force = false) {
  if (!supabase) return null;
  if (!force && overview && Date.now() - at < 30000) return overview;
  inflight ||= rpc('get_arcade_overview').then((o) => { overview = o; at = Date.now(); return o; }).finally(() => { inflight = null; });
  return inflight;
}
export const bestOf = (id, guest) => (guest ? guestBests.get(id) ?? null : overview?.bests?.[id]?.best_score ?? null);

// Open a server-timed run. Returns the session id; the clock that judges the finished run starts here.
export const startRun = (gameId) => rpc('start_minigame', { p_game: gameId });

// Submit the finished run. Returns the server's verdict:
//   {ok:true, score, previous_best, best, new_best, first_play, coins, capped, balance, rank, plays, daily_earned, daily_cap}
//   {ok:false, error}  (rejected: score failed validation; no coins, no best)
// Network/server errors THROW so the UI can offer a retry (the session stays open until it is submitted or expires).
export async function submitRun({ sessionId, gameId, score, durationMs, stats }) {
  const out = await rpc('submit_minigame_score', { p_session: sessionId, p_score: Math.round(score), p_duration_ms: Math.round(durationMs), p_stats: stats || {} });
  if (out?.ok && overview) {                      // keep the cached overview honest without another request
    overview.bests = { ...overview.bests, [gameId]: { best_score: out.best, plays: out.plays } };
    overview.earned_today = out.daily_earned;
  } else if (!out?.ok) invalidateOverview();
  return out;
}

// Guests: same result shape, computed locally, no coins.
export function guestResult(gameId, score) {
  const prev = guestBests.get(gameId) ?? null, best = Math.max(prev ?? 0, score);
  guestBests.set(gameId, best);
  return { ok: true, guest: true, score, previous_best: prev, best, new_best: prev !== null && score > prev, first_play: prev === null, coins: 0, balance: null, rank: null };
}
