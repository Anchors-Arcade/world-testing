import { Avatar } from '../entities/Avatar.js';
import { normalizeAvatar } from '../shops/items.js';
import { EMOTE_BY_KEY, EMOTE_GAP_MS, REMOTE_GAP_MS } from '../social/emotes.js';

const SEND_MS = 110, MAX_REMOTES = 40;

// Owns the remote avatars for one room and throttles our own position packets.
export class RemotePlayers {
  constructor(scene, net, profile, roomId) {
    this.scene = scene; this.net = net; this.profile = profile; this.map = new Map();
    this.social = scene.registry.get('social') || null;       // blocked / muted lookups (inert for guests)
    this.lastEmoteAt = 0; this.unsub = null;
    this.acc = 0; this.last = { x: -1, y: -1, m: -1, d: '' };
    const p = scene.player;
    net.join(roomId, { id: profile.id, name: profile.display_name, avatar: normalizeAvatar(profile.avatar_data), x: Math.round(p.x), y: Math.round(p.y) }, {
      onSync: (state) => this.sync(state),
      onPos: (m) => this.pos(m),
      onJoin: () => { this.last.x = -1; },                 // a newcomer needs our current position: resend next tick
      onEmote: (m) => this.emote(m),
      onChat: (row) => this.chat(row),
    });
    // blocking someone mid-session removes their avatar straight away; unblocking brings them back on the next presence sync
    this.unsub = this.social?.on((e) => { if (e.type === 'changed') this.sync(this.lastState || {}); });
    this.emitCount();
  }

  sync(state) {
    this.lastState = state;
    // Handle removals and blocks
    for (const [id, r] of this.map) {
      if (!state[id] || this.social?.isBlocked(id)) {
        // Fade out avatar
        const { av } = r;
        if (av) {
          // Cancel any existing fade tween
          if (r.fadeTween) {
            r.fadeTween.remove();
          }
          // Fade out over 200ms
          const fadeOut = this.scene.tweens.add({
            targets: av.root,
            alpha: 0,
            duration: 200,
            ease: 'Linear',
            onComplete: () => {
              av.destroy();
              this.map.delete(id);
            }
          });
          r.fadeTween = fadeOut;
        } else {
          this.map.delete(id);
        }
      }
    }
    // Handle additions and updates
    for (const [id, m] of Object.entries(state)) {
      const json = JSON.stringify(m.avatar), r = this.map.get(id);
      if (r) {
        // Update existing avatar
        if (r.json !== json) {
          r.av.setOutfit(m.avatar);
          r.json = json;
        }
        // If we were fading out, cancel the fade and fade back in
        if (r.fadeTween) {
          r.fadeTween.remove();
          r.fadeTween = null;
          // Ensure avatar is visible
          av.root.alpha = 1;
        }
        continue;
      }
      // Check limits and blocks
      if (this.map.size >= MAX_REMOTES || this.social?.isBlocked(id)) continue;
      // Create new avatar with initial alpha 0
      const av = new Avatar(this.scene, Number(m.x) || 0, Number(m.y) || 0, m.avatar, String(m.name || 'Player').slice(0, 24), { remote: true });
      av.root.alpha = 0;
      // Fade in over 200ms
      const fadeIn = this.scene.tweens.add({
        targets: av.root,
        alpha: 1,
        duration: 200,
        ease: 'Linear'
      });
      this.map.set(id, { av, json, fadeTween: fadeIn });
    }
    this.emitCount();
  }

  pos(m) {
    const r = m && this.map.get(m.id);
    if (!r || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return;
    const room = this.scene.room;
    r.av.setRemoteTarget(Math.min(Math.max(m.x, 0), room.w), Math.min(Math.max(m.y, 0), room.h), m.d, m.m === 1, m.j === 1);
  }

  // ---------- Phase 6: emotes + chat bubbles ----------
  // Emotes are Broadcast-only. We trust nothing: the key must be a known emote, the sender must be someone we can see,
  // and a sender flooding faster than REMOTE_GAP_MS is ignored.
  emote(m) {
    const r = m && typeof m.id === 'string' ? this.map.get(m.id) : null;
    if (!r || !EMOTE_BY_KEY[m.e] || this.social?.isHidden(m.id)) return;
    const now = performance.now();
    if (now - (r.lastEmote || 0) < REMOTE_GAP_MS) return;
    r.lastEmote = now;
    r.av.playEmote(m.e, this.scene.registry.get('reduceMotion'));
  }

  // I do an emote: play it here, tell the room.
  myEmote(key) {
    if (!EMOTE_BY_KEY[key]) return false;
    const now = performance.now();
    if (now - this.lastEmoteAt < EMOTE_GAP_MS) return false;
    this.lastEmoteAt = now;
    this.scene.player.playEmote(key, this.scene.registry.get('reduceMotion'));
    this.net.sendEmote(key);
    return true;
  }

  // A chat row arrived (already filtered by RLS). Show a bubble over the sender and hand the row to the chat window.
  chat(row) {
    if (!row || this.social?.isHidden(row.sender_id)) return;
    const mine = row.sender_id === this.profile.id, av = mine ? this.scene.player : this.map.get(row.sender_id)?.av;
    av?.say(String(row.message).slice(0, 100));
    this.scene.game.events.emit('chat-message', row);
  }

  // Which remote avatar is under this world point? (click a player -> open their card)
  hit(x, y) {
    for (const [id, r] of this.map) if (Math.abs(x - r.av.x) < 30 && y > r.av.y - 80 && y < r.av.y + 12) return id;
    return null;
  }

  outfit(avatar) { this.net.updateMe({ avatar: normalizeAvatar(avatar) }); }

  update(time, delta, reduceMotion) {
    for (const { av } of this.map.values()) av.update(time, reduceMotion, delta);
    this.acc += delta;
    if (this.acc < SEND_MS) return;
    const p = this.scene.player, x = Math.round(p.x), y = Math.round(p.y), m = p.moving ? 1 : 0, l = this.last;
    const hop = p.hopped;
    if (x !== l.x || y !== l.y || m !== l.m || p.dir !== l.d || hop) {   // only send on change; last packet always has m=0
      p.hopped = false;
      this.net.sendPos(hop ? { id: this.profile.id, x, y, d: p.dir, m, j: 1 } : { id: this.profile.id, x, y, d: p.dir, m });
      this.last = { x, y, m, d: p.dir }; this.acc = 0;
    }
  }

  emitCount() { this.scene.game.events.emit('room-players', this.map.size + 1); }

  // Phase 17: the name a player is showing right now (presence meta), guests included.
  nameOf(id) { return this.map.get(id)?.av?.label?.text || null; }

  destroy() {
    this.unsub?.();
    this.net.leave();
    // Remove any active fade tweens
    for (const { av, fadeTween } of this.map.values()) {
      if (fadeTween) fadeTween.remove();
      av.destroy();
    }
    this.map.clear();
  }
}
