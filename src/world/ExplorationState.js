import { COLLECTIBLES, TOTAL_COLLECTIBLES } from './collectibles.js';
import { SECRETS, TOTAL_SECRETS } from './secrets.js';
import { ACHIEVEMENTS } from './achievements.js';
import * as db from '../database/exploration.js';

// Phase 8 — the single in-memory copy of "what I have explored": collectibles, secret clues, unlocked rooms,
// visited places and achievement progress. Loaded with ONE request (get_exploration) and then kept up to date from
// the return values of collect / find_clue / visit_room — never by polling and with no extra realtime subscription.
//
// Guests get a fully working local instance (nothing is saved, no coins), so scenes and UI never special-case them.
// Shape of every entry mirrors what the server sends, so the UI code is identical either way.
export class ExplorationState {
  constructor(profile) {
    this.profile = profile;
    this.enabled = !profile.guest;
    this.loaded = false; this.error = null; this.listeners = new Set(); this.inflight = null;
    this.reset();
  }

  reset() {
    // local fallback = the client mirrors, with nothing collected and nothing discovered
    this.collectibles = COLLECTIBLES.map((c) => ({ ...c, collected: false }));
    this.secrets = SECRETS.map((s) => ({ ...s, clues_found: 0, clues_total: s.clues.length, found: [], discovered: false }));
    this.achievements = ACHIEVEMENTS.map((a) => ({ ...a, progress: 0, completed_at: null }));
    this.visited = new Set();
    this.unlockedRooms = new Set();
    this.totals = { collectibles: TOTAL_COLLECTIBLES, collected: 0, secrets: TOTAL_SECRETS, found: 0 };
    this.byId = new Map(this.collectibles.map((c) => [c.id, c]));
    this.secretById = new Map(this.secrets.map((s) => [s.id, s]));
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(ev) { for (const fn of this.listeners) fn(ev); }

  // ---------- loading ----------
  async start() {
    this.reset();
    if (!this.enabled) { this.loaded = true; this.emit({ type: 'loaded' }); return; }
    return this.refresh();
  }

  async refresh(force = false) {
    if (!this.enabled) return;
    if (this.inflight && !force) return this.inflight;
    this.inflight = (async () => {
      try {
        this.apply(await db.fetchExploration());
        this.error = null;
      } catch (e) {
        this.error = db.niceExplorationError(e);        // the world still works; the journal shows why nothing is saved
        this.emit({ type: 'error', error: this.error });
      } finally { this.inflight = null; this.loaded = true; }
    })();
    return this.inflight;
  }

  // Replace local state with the server's picture. Collectibles hidden behind undiscovered secrets are simply absent
  // from the payload, so anything the server did not send stays unknown to the client.
  apply(d) {
    if (!d) return;
    this.collectibles = (d.collectibles || []).map((c) => ({ ...c, collected: !!c.collected }));
    this.byId = new Map(this.collectibles.map((c) => [c.id, c]));
    this.secrets = (d.secrets || []).map((s) => ({
      ...s, found: s.clues || [], clues: this.secretById.get(s.id)?.clues || [],
      hint: this.secretById.get(s.id)?.hint || s.description || '',
    }));
    this.secretById = new Map(this.secrets.map((s) => [s.id, s]));
    this.achievements = (d.achievements || []).map((a) => ({ ...a, progress: a.progress || 0 }));
    this.visited = new Set(d.rooms || []);
    this.unlockedRooms = new Set((d.unlocked_rooms || []).filter(Boolean));
    this.totals = { ...this.totals, ...(d.totals || {}) };
    this.emit({ type: 'loaded' });
    this.announce(d.unlocked);
  }

  // ---------- lookups used by the scene and the UI ----------
  collectiblesIn(roomId) { return this.collectibles.filter((c) => c.room_id === roomId); }
  pendingIn(roomId) { return this.collectiblesIn(roomId).filter((c) => !c.collected); }
  isCollected(id) { return !!this.byId.get(id)?.collected; }
  secretsIn(roomId) { return this.secrets.filter((s) => s.room_id === roomId); }
  secretOf(id) { return this.secretById.get(id) || null; }
  isSecretFound(id) { return !!this.secretById.get(id)?.discovered; }
  hasClue(secretId, clue) { return (this.secretById.get(secretId)?.found || []).includes(clue); }
  // A secret room (or a hidden portal) is open only once its secret is discovered.
  isRoomUnlocked(roomId) { return this.unlockedRooms.has(roomId); }
  isVisited(roomId) { return this.visited.has(roomId); }
  // Per-room exploration progress for the world map.
  progressIn(roomId) {
    const items = this.collectiblesIn(roomId), secrets = this.secretsIn(roomId);
    return {
      items: items.length, itemsDone: items.filter((c) => c.collected).length,
      secrets: secrets.length, secretsDone: secrets.filter((s) => s.discovered).length,
    };
  }
  counts() {
    return {
      collected: this.collectibles.filter((c) => c.collected).length,
      collectibles: this.totals.collectibles || this.collectibles.length,
      found: this.secrets.filter((s) => s.discovered).length,
      secrets: this.totals.secrets || this.secrets.length,
      badges: this.achievements.filter((a) => a.completed_at).length,
      badgeTotal: this.achievements.length,
    };
  }

  // ---------- actions (the server decides; we only mirror the answer) ----------
  async collect(id) {
    const local = this.byId.get(id);
    if (!local || local.collected) return null;
    if (!this.enabled) {                                       // guest: local only, no coins, nothing saved
      local.collected = true;
      const r = { ok: true, guest: true, id, name: local.name, rarity: local.rarity, coins: 0 };
      this.emit({ type: 'collected', ...r });
      return r;
    }
    local.collected = true;                                    // optimistic: the sparkle disappears immediately
    try {
      const r = await db.collectCollectible(id);
      if (!r?.ok) { if (r?.error !== 'already') local.collected = false; this.emit({ type: 'changed' }); return r; }
      this.totals.collected = r.collected; this.totals.collectibles = r.total;
      this.emit({ type: 'collected', ...r, name: r.name || local.name, rarity: r.rarity || local.rarity });
      this.announce(r.unlocked);
      return r;
    } catch (e) {
      local.collected = false;                                 // put it back so the player can try again
      this.emit({ type: 'error', error: db.niceExplorationError(e) });
      return { ok: false, error: db.niceExplorationError(e) };
    }
  }

  // Report a clue found in the world. Returns {discovered, clues_found, clues_total, coins, unlocks_room, already}.
  async findClue(secretId, clue) {
    const s = this.secretById.get(secretId);
    if (!s) return null;
    if (!this.enabled) {                                       // guest: solve it locally so the world still opens up
      const fresh = !s.found.includes(clue);
      if (fresh) s.found = [...s.found, clue];
      s.clues_found = s.found.length;
      const done = !s.discovered && s.clues_found >= s.clues_total;
      if (done) { s.discovered = true; if (s.unlocks_room) this.unlockedRooms.add(s.unlocks_room); }
      const r = { ok: true, guest: true, secret: s.id, name: s.name, new: fresh, already: !fresh && !done,
        clues_found: s.clues_found, clues_total: s.clues_total, discovered: s.discovered, just_discovered: done,
        coins: 0, unlocks_room: done ? s.unlocks_room : null };
      this.emit({ type: 'clue', ...r });
      return r;
    }
    try {
      const r = await db.findClue(secretId, clue);
      if (r?.ok) {
        s.clues_found = r.clues_found; s.clues_total = r.clues_total; s.discovered = r.discovered;
        if (r.new && !s.found.includes(clue)) s.found = [...s.found, clue];
        if (r.unlocks_room) this.unlockedRooms.add(r.unlocks_room);
        if (r.just_discovered) this.totals.found = (this.totals.found || 0) + 1;
        this.emit({ type: 'clue', ...r, already: !r.new && !r.just_discovered });
        this.announce(r.unlocked);
      }
      return r;
    } catch (e) {
      this.emit({ type: 'error', error: db.niceExplorationError(e) });
      return { ok: false, error: db.niceExplorationError(e) };
    }
  }

  // Called once per room entry. Cheap: a single RPC, and only the first visit changes anything.
  async visit(roomId) {
    if (!roomId || roomId === 'home') return;
    if (!this.enabled) { this.visited.add(roomId); this.emit({ type: 'changed' }); return; }
    const known = this.visited.has(roomId);
    this.visited.add(roomId);
    if (known) return;                                          // already discovered: no request at all
    try {
      const r = await db.visitRoom(roomId);
      if (r?.first) this.emit({ type: 'discovered', room: roomId });
      this.announce(r?.unlocked);
    } catch { this.visited.delete(roomId); }                    // offline: try again next time we walk in
  }

  // Achievements the server just completed (it pays the reward itself; we only tell the player).
  announce(list) {
    if (!Array.isArray(list) || !list.length) return;
    for (const a of list) {
      const mine = this.achievements.find((x) => x.id === a.id);
      if (mine && !mine.completed_at) { mine.completed_at = new Date().toISOString(); mine.progress = mine.goal; }
      this.emit({ type: 'achievement', ...a });
    }
    this.emit({ type: 'changed' });
  }

  destroy() { this.listeners.clear(); this.inflight = null; }
}
