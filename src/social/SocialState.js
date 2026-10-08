import * as db from '../database/social.js';
import { ROOMS } from '../maps/rooms.js';

const DEFAULTS = { allow_friend_requests: true, allow_friend_joins: true, allow_messages: true, allow_room_visits: true };

// The single in-memory copy of "my social world": friends, requests, blocks, mutes, settings and which friends are online.
// Loaded with ONE request, then kept fresh by Realtime events (a debounced re-fetch), never by polling.
// Guests get an inert instance, so UI and scene code never need to special-case them.
export class SocialState {
  constructor(profile, net) {
    this.profile = profile; this.net = net; this.enabled = !profile.guest && net.account;   // Phase 17: friends/presence need an account, the world does not
    this.settings = { ...DEFAULTS }; this.friends = []; this.incoming = []; this.outgoing = []; this.blocked = []; this.muted = [];
    this.blockedIds = new Set(); this.mutedIds = new Set(); this.friendIds = new Set();
    this.online = new Map(); this.rawPresence = null;               // friendId -> presence meta ({r})
    this.listeners = new Set(); this.timer = null; this.where = null;
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(what) { for (const fn of this.listeners) fn(what); }

  async start() {
    if (!this.enabled) return;
    await this.refresh();
    this.net.joinSocial({
      onPresence: (state) => this.setPresence(state),
      onChange: (table, p) => { this.emit({ type: 'notify', table, row: p.new }); this.refreshSoon(); },
    });
    if (this.where) this.net.setWhere(this.publicWhere());
  }

  async refresh() {
    if (!this.enabled) return;
    const o = await db.fetchOverview();
    this.settings = { ...DEFAULTS, ...o.settings };
    this.friends = o.friends; this.incoming = o.incoming; this.outgoing = o.outgoing; this.blocked = o.blocked; this.muted = o.muted;
    this.friendIds = new Set(o.friends.map((f) => f.id)); this.blockedIds = new Set(o.blocked.map((p) => p.id)); this.mutedIds = new Set(o.muted.map((p) => p.id));
    this.pushWhere();
    if (this.rawPresence) this.setPresence(this.rawPresence);
    this.emit({ type: 'changed' });
  }
  refreshSoon() { clearTimeout(this.timer); this.timer = setTimeout(() => this.refresh().catch(() => {}), 400); }

  // ---------- lookups used by the scene / chat ----------
  isBlocked = (id) => this.blockedIds.has(id);
  isMuted = (id) => this.mutedIds.has(id);
  isHidden = (id) => this.blockedIds.has(id) || this.mutedIds.has(id);      // chat bubbles, emotes
  isFriend = (id) => this.friendIds.has(id);

  // ---------- presence ----------
  // Which of MY friends are online and (if they allow it) where. Only friends are kept; everyone else in the channel is ignored.
  setPresence(state) {
    this.rawPresence = state;                                  // kept so a newly added friend shows as online without waiting for the next sync
    const next = new Map();
    for (const id of Object.keys(state)) if (this.friendIds.has(id) && state[id].length) next.set(id, state[id][state[id].length - 1]);
    this.online = next;
    this.emit({ type: 'presence' });
  }
  statusOf(id) {
    const m = this.online.get(id);
    if (!m) return { online: false, text: 'Offline', joinable: false };
    const r = m.r;
    if (!r) return { online: true, text: 'Online', joinable: false };
    if (r === 'private') return { online: true, text: 'In a private room', joinable: false };
    if (r === 'home') return { online: true, text: 'In their room', joinable: true, room: 'home', ownerId: id };
    const room = ROOMS[r];
    return { online: true, text: room ? `In ${room.name}` : 'Online', joinable: !!room && r !== 'home', room: r };
  }
  friendsIn(roomKey) { return this.friends.filter((f) => this.online.get(f.id)?.r === roomKey).length; }

  // ---------- where am I (published to friends) ----------
  // 'home' = my own home, 'private' = I'm in somebody else's home (the owner is never revealed), null = hidden by my privacy setting.
  setLocation(roomId, ownerId) {
    this.where = { roomId, own: ownerId === this.profile.id };
    this.pushWhere();
  }
  publicWhere() {
    if (!this.settings.allow_friend_joins || !this.where) return { r: null };
    const { roomId, own } = this.where;
    return { r: roomId === 'home' ? (own ? 'home' : 'private') : roomId };
  }
  pushWhere() { if (this.enabled && this.where) this.net.setWhere(this.publicWhere()); }

  async setSetting(patch) {
    const saved = await db.saveSettings(patch);
    this.settings = { ...DEFAULTS, ...saved };
    this.pushWhere();
    this.emit({ type: 'changed' });
  }

  destroy() { clearTimeout(this.timer); this.listeners.clear(); }
}
