import { supabase } from '../config/supabase.js';

const HISTORY = 40;   // only ever load a small tail of the room; older lines are not needed (and the server prunes them)

// Newest HISTORY lines of ONE room, oldest first. Row Level Security already drops blocked/muted/hidden senders.
export async function fetchRecent(roomId) {
  const { data, error } = await supabase.from('chat_messages')
    .select('id, sender_id, sender_name, message, kind, created_at').eq('room_id', roomId)
    .order('created_at', { ascending: false }).limit(HISTORY);
  if (error) throw new Error(error.message);
  return data.reverse();
}

// Insert goes through send_chat(): the server validates, filters, rate-limits and stamps the sender from the session.
export async function sendChat(roomId, { text = null, preset = null }) {
  const { error } = await supabase.rpc('send_chat', { p_room: roomId, p_text: preset ? null : text, p_preset: preset });
  if (error) throw new Error(error.message);
}
