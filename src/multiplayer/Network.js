import { supabase } from '../config/supabase.js';

// Thin wrapper over TWO Supabase Realtime channels per player (kept to a minimum on purpose):
//  1. room:<id>  - the room you are standing in. Presence = who is here + outfit. Broadcast = positions + emotes (never stored).
//                  Phase 6 adds a postgres_changes binding for chat_messages of THIS room only, on the same channel.
//  2. social     - one global channel for the whole session. Presence = "I am online, in room X" (what friends read),
//                  plus postgres_changes for friend requests / friendships addressed to you.
// Nothing here polls the database.
export class Network {
  constructor(profile) { this.profile = profile; this.channel = null; this.active = false; this.me = null; this.social = null; this.socialActive = false; this.where = { r: null }; this.inbox = null; this.lastRoomJoin = null; this.lastSocialJoin = null; this.lastInboxJoin = null; this.reconnectTimer = null; }

  // Phase 17: GUESTS ARE IN THE WORLD. Presence and broadcast (who is here, where they are, emotes) need no
  // database rows at all, so a guest joins the same room channel as everyone else with the anon key and is seen
  // by, and sees, every other player.
  //   `enabled`        — may I use the room channel at all?           guests: yes
  //   `account`        — may I use features that need a real account?  guests: no
  // Everything that reads or writes the database (chat history, friends, the social channel, the moderation
  // inbox) is gated on `account`, so a guest can never pick up a registered player's permissions: their id
  // matches no row, and every RPC keys off auth.uid(), which a guest does not have.
  get enabled() { return !!supabase; }
  get account() { return !!supabase && !this.profile.guest; }

  // ---------- room channel ----------
  join(roomId, me, cb) {
    this.leave();
    if (!this.enabled) return;
    const id = this.profile.id;
    const ch = supabase.channel(`room:${roomId}`, { config: { presence: { key: id }, broadcast: { self: false } } });
    ch.on('presence', { event: 'sync' }, () => {
      const out = {};
      for (const [key, metas] of Object.entries(ch.presenceState())) if (key !== id && metas.length) out[key] = metas[metas.length - 1];
      cb.onSync(out);
    });
    ch.on('presence', { event: 'join' }, ({ key }) => { if (key !== id) cb.onJoin?.(key); });
    ch.on('broadcast', { event: 'pos' }, ({ payload }) => cb.onPos(payload));
    ch.on('broadcast', { event: 'emote' }, ({ payload }) => cb.onEmote?.(payload));
    // Chat: Realtime pushes only rows of this room, and only rows Row Level Security lets us see (not blocked/muted/
    // hidden). Guests have no database identity, so they do not subscribe to it at all.
    if (cb.onChat && this.account) ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, ({ new: row }) => cb.onChat(row));
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.active = true;
        ch.track(this.me);
      } else {
        // Connection lost, attempt to reconnect after a short delay
        this.active = false;
        this.scheduleReconnect();
      }
    });
    this.channel = ch;
    this.me = me;
    this.lastRoomJoin = { roomId, me, cb };
  }

  updateMe(patch) { this.me = { ...this.me, ...patch }; if (this.active) this.channel.track(this.me); }
  sendPos(p) { if (this.active) this.channel.send({ type: 'broadcast', event: 'pos', payload: p }); }
  sendEmote(e) { if (this.active) this.channel.send({ type: 'broadcast', event: 'emote', payload: { id: this.profile.id, e } }); }

  leave() {
    if (this.channel) supabase.removeChannel(this.channel);
    this.channel = null; this.active = false;
    this.lastRoomJoin = null;
  }

  // ---------- social channel (online status + friend notifications) ----------
  // Presence payload is deliberately tiny and public-safe: {r: room key | 'home' (own home) | 'private' (someone else's home) | null (location hidden)}.
  joinSocial(cb) {
    if (!this.account || this.social) return;                 // friends and online status need a real account
    const id = this.profile.id;
    const ch = supabase.channel('social', { config: { presence: { key: id } } });
    ch.on('presence', { event: 'sync' }, () => cb.onPresence(ch.presenceState()));
    const pg = (table, filter, event) => ch.on('postgres_changes', { event, schema: 'public', table, filter }, (p) => cb.onChange(table, p));
    pg('friend_requests', `receiver_id=eq.${id}`, 'INSERT');            // someone asked me
    pg('friend_requests', `sender_id=eq.${id}`, 'UPDATE');              // they answered my request
    pg('friendships', `user_id=eq.${id}`, 'INSERT');                    // a friendship involving me was created (either column)
    pg('friendships', `friend_id=eq.${id}`, 'INSERT');
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.socialActive = true;
        ch.track(this.where);
      } else {
        // Connection lost, attempt to reconnect after a short delay
        this.socialActive = false;
        this.scheduleReconnect();
      }
    });
    this.social = ch;
    this.lastSocialJoin = cb;
  }
  // where: {r: ...}. Re-tracked on every room change or privacy change; Supabase de-duplicates identical payloads cheaply.
  setWhere(where) { this.where = where; if (this.socialActive) this.social.track(where); }

  leaveSocial() { if (this.social) supabase.removeChannel(this.social); this.social = null; this.socialActive = false; this.lastSocialJoin = null; }

  // ---------- Phase 17: the moderation inbox ----------
  // A kick, a ban or a timeout is a ROW the server wrote (public.mod_actions), delivered over Realtime and
  // filtered to this player. That matters: a player cannot fake one by broadcasting on a channel, because the
  // row has to exist, and only the admin functions can create one. Announcements arrive the same way.
  joinInbox({ onAction, onAnnounce }) {
    if (!this.account || this.inbox) return;
    const id = this.profile.id;
    const ch = supabase.channel(`inbox:${id}`);
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mod_actions', filter: `target_id=eq.${id}` },
      ({ new: row }) => onAction?.(row));
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' },
      ({ new: row }) => onAnnounce?.(row));
    ch.subscribe((status) => {
      if (status !== 'SUBSCRIBED') {
        // Connection lost, attempt to reconnect after a short delay
        this.scheduleReconnect();
      }
    });
    this.inbox = ch;
    this.lastInboxJoin = { onAction, onAnnounce };
  }
  leaveInbox() { if (this.inbox) supabase.removeChannel(this.inbox); this.inbox = null; this.lastInboxJoin = null; }

  // Reconnection handling
  scheduleReconnect() {
    // Clear any existing timers
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socialReconnectTimer) clearTimeout(this.socialReconnectTimer);
    if (this.inboxReconnectTimer) clearTimeout(this.inboxReconnectTimer);
    // Attempt to reconnect after a short delay
    this.reconnectTimer = setTimeout(() => this.attemptReconnect(), 1000);
  }

  attemptReconnect() {
    // Try to reconnect room channel
    if (this.lastRoomJoin) {
      const { roomId, me, cb } = this.lastRoomJoin;
      this.join(roomId, me, cb);
    }
    // Try to reconnect social channel
    if (this.lastSocialJoin) {
      const cb = this.lastSocialJoin;
      this.joinSocial(cb);
    }
    // Try to reconnect inbox channel
    if (this.lastInboxJoin) {
      const cb = this.lastInboxJoin;
      this.joinInbox(cb);
    }
  }

  destroy() {
    this.leave(); this.leaveSocial(); this.leaveInbox();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socialReconnectTimer) clearTimeout(this.socialReconnectTimer);
    if (this.inboxReconnectTimer) clearTimeout(this.inboxReconnectTimer);
  }
}
