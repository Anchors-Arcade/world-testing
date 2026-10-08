import { supabase } from '../config/supabase.js';

// Phase 8 — exploration traffic. Four server functions, all SECURITY DEFINER, all reading the player from auth.uid():
//   get_exploration()              -> the whole picture in ONE request (catalogue + my progress + achievements)
//   collect_collectible(id)        -> the server checks eligibility and pays its OWN reward
//   find_clue(secret, clue)        -> the server checks the clue belongs to the secret and decides when it unlocks
//   visit_room(room)               -> records first visits (map discovery + the "places visited" achievement)
// The browser never sends a player id, a coin amount, a progress value or an "unlocked" flag.
async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export const fetchExploration = () => rpc('get_exploration');
export const collectCollectible = (id) => rpc('collect_collectible', { p_id: id });
export const findClue = (secret, clue) => rpc('find_clue', { p_secret: secret, p_clue: clue });
export const visitRoom = (room) => rpc('visit_room', { p_room: room });

// Phase 8 tables are missing until supabase/phase8.sql has been run: say so instead of showing a Postgres error.
export const niceExplorationError = (e) =>
  /could not find the function|schema cache|does not exist|PGRST202|relation .* does not exist/i.test(e?.message || '')
    ? 'Exploration is not set up yet. Run supabase/phase8.sql in the Supabase SQL editor.'
    : e?.message || 'Something went wrong.';
