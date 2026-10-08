import { supabase } from '../config/supabase.js';

// Friends, blocks, mutes, reports and privacy settings. Every write is a SECURITY DEFINER function in supabase/phase6.sql
// that reads the caller from auth.uid(): the client never says "who I am", only "who I mean".
async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}
export const fetchOverview   = () => rpc('get_social_overview');                       // {settings, friends, incoming, outgoing, blocked, muted}
export const searchPlayers   = (q) => rpc('search_players', { p_query: q });
export const getPlayer       = (id) => rpc('get_player_profile', { p_id: id });
export const sendRequest     = (id) => rpc('send_friend_request', { p_receiver: id });  // 'sent' | 'accepted'
export const answerRequest   = (id, accept) => rpc('respond_friend_request', { p_request: id, p_accept: accept });
export const cancelRequest   = (id) => rpc('cancel_friend_request', { p_request: id });
export const removeFriend    = (id) => rpc('remove_friend', { p_friend: id });
export const blockPlayer     = (id) => rpc('block_player', { p_id: id });
export const unblockPlayer   = (id) => rpc('unblock_player', { p_id: id });
export const mutePlayer      = (id) => rpc('mute_player', { p_id: id });
export const unmutePlayer    = (id) => rpc('unmute_player', { p_id: id });
export const reportPlayer    = (id, reason, details, room) => rpc('report_player', { p_id: id, p_reason: reason, p_details: details || null, p_room: room || null });
export const saveSettings    = (patch) => rpc('update_my_settings', { p: patch });
