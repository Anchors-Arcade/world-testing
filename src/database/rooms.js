import { supabase } from '../config/supabase.js';

// Rooms are read and written ONLY through these two server functions (see supabase/phase5.sql).
//   get_room(owner?)  -> { room:{id,owner_id,owner_name,theme,visibility}, is_owner, furniture:[{furniture_id,x,y,rotation}] }
//                        owner omitted = your own room (created on first visit). Passing another id is the hook for friend visits.
//   save_room(theme, furniture) -> same shape; validates ownership, bounds and overlaps, replaces the layout atomically.
async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
export const fetchRoom = (ownerId = null) => rpc('get_room', { p_owner: ownerId });
export const saveRoom = (theme, furniture) => rpc('save_room', { p_theme: theme, p_furniture: furniture });
