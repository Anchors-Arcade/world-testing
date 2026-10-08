// node scripts/test-phase8.mjs : Phase 8 world/exploration checks (no browser, no Supabase).
// Keeps the client mirrors and supabase/phase8.sql honest, and the world walkable.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROOMS } from '../src/maps/rooms.js';
import { COLLECTIBLES } from '../src/world/collectibles.js';
import { SECRETS } from '../src/world/secrets.js';
import { ACHIEVEMENTS } from '../src/world/achievements.js';
import { INTERACTIONS, CLUE_SOURCES } from '../src/world/interactions.js';
import { WORLD_MAP } from '../src/world/worldMap.js';

let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const sql = fs.readFileSync(new URL('../supabase/phase8.sql', import.meta.url), 'utf8');

// Doors that were already "coming soon" before Phase 8 (RoomScene toasts and bounces the player back).
const COMING_SOON = new Set(['library', 'school']);          // the Town Hall opened in Phase 15

t('every room id used by a door, portal or secret actually exists', () => {
  for (const [key, r] of Object.entries(ROOMS)) {
    for (const b of r.buildings || []) assert(ROOMS[b.to] || COMING_SOON.has(b.to), `${key} -> ${b.to}`);
    for (const p of r.portals || []) assert(ROOMS[p.to], `${key} -> ${p.to}`);   // portals must never dead-end
  }
  for (const s of SECRETS) if (s.unlocks_room) assert(ROOMS[s.unlocks_room], s.id);
});

t('every new place can be walked back out of, and hidden rooms are gated', () => {
  for (const [key, r] of Object.entries(ROOMS)) {
    if (key === 'home') continue;
    assert((r.portals || []).length + (r.buildings || []).length > 0, `${key} has no exit`);
    assert(r.spawn && r.spawn.x > 0 && r.spawn.y > 0, `${key} spawn`);
  }
  // A secret room is only reachable through a portal that names its secret.
  for (const s of SECRETS.filter((x) => x.unlocks_room)) {
    const from = ROOMS[s.room_id].portals.find((p) => p.to === s.unlocks_room);
    assert(from && from.secret === s.id, `${s.unlocks_room} must be gated by ${s.id}`);
    assert(ROOMS[s.unlocks_room].hidden === true, `${s.unlocks_room} must be hidden`);
  }
});

t('collectibles sit inside their room and are mirrored in SQL', () => {
  for (const c of COLLECTIBLES) {
    const r = ROOMS[c.room_id];
    assert(r, c.id);
    assert(c.x > 0 && c.x < r.w && c.y > 0 && c.y < r.h, `${c.id} outside ${c.room_id}`);
    const row = new RegExp(`\\('${c.id}',[^\\n]*'${c.room_id}',\\s*${c.x},\\s*${c.y},\\s*'${c.rarity}',\\s*${c.reward},`);
    assert(row.test(sql), `sql row ${c.id}`);
    if (c.requires_secret) assert(SECRETS.some((s) => s.id === c.requires_secret), c.id);
  }
  assert.equal(new Set(COLLECTIBLES.map((c) => c.id)).size, COLLECTIBLES.length, 'duplicate ids');
});

t('every secret is reachable: each clue has an object in the world', () => {
  for (const s of SECRETS) {
    assert(new RegExp(`\\('${s.id}',`).test(sql), `sql row ${s.id}`);
    for (const clue of s.clues) {
      assert(CLUE_SOURCES.some((c) => c.secret === s.id && c.clue === clue), `${s.id}/${clue} has no object`);
      assert(sql.includes(`'${clue}'`), `sql clue ${clue}`);
    }
    const objects = (INTERACTIONS[s.room_id] || []).filter((o) => o.secret === s.id);
    assert.equal(objects.length, s.clues.length, `${s.id} clue objects live in ${s.room_id}`);
  }
});

t('interactive objects are inside their room and none of them is an NPC', () => {
  for (const [room, list] of Object.entries(INTERACTIONS)) {
    const r = ROOMS[room];
    assert(r, room);
    for (const o of list) {
      assert(o.x >= 0 && o.x + o.w <= r.w && o.y >= 0 && o.y + o.h <= r.h, `${o.id} outside ${room}`);
      assert(o.title && o.text, `${o.id} needs something to say`);
      // Phase 17: one deliberate exception, asked for by name — a hidden character in a secret room, with no
      // shop, no quest and no wandering. Everything else must still not be an NPC.
      if (o.id === 'jonas_mc_fort') { assert.equal(room, 'crystal_hollow', 'the hidden character stays hidden'); continue; }
      assert(!/npc|villager|shopkeeper|penguin keeper/i.test(o.id + o.label), `${o.id} looks like an NPC`);
    }
  }
  // Shopkeepers are drawn by the kiosks of Phase 5 and nowhere else.
  const kioskRooms = Object.entries(ROOMS).filter(([, r]) => r.kiosks).map(([k]) => k);
  assert.deepEqual(kioskRooms.sort(), ['clothing_shop', 'furniture_shop']);
});

t('achievements match the SQL seed and only use server-computed metrics', () => {
  const metrics = new Set(['collectibles', 'secrets', 'friends', 'furniture', 'arcade', 'rooms']);
  for (const a of ACHIEVEMENTS) {
    assert(metrics.has(a.metric), a.id);
    assert(new RegExp(`\\('${a.id}',[^\\n]*'${a.metric}',\\s*${a.goal},\\s*${a.reward},`).test(sql), `sql row ${a.id}`);
  }
  const completionist = ACHIEVEMENTS.find((a) => a.id === 'completionist');
  assert.equal(completionist.goal, COLLECTIBLES.length, 'Completionist must need every collectible');
});

t('the world map lists every travel destination and keeps secrets off it', () => {
  for (const p of WORLD_MAP) assert(ROOMS[p.key], p.key);
  for (const s of SECRETS.filter((x) => x.unlocks_room)) {
    const entry = WORLD_MAP.find((p) => p.key === s.unlocks_room);
    assert(entry?.hidden === true, `${s.unlocks_room} must be marked hidden on the map`);
  }
  // Every room that holds collectibles is somewhere a player can get to from the map or on foot.
  for (const room of new Set(COLLECTIBLES.map((c) => c.room_id))) {
    const onMap = WORLD_MAP.some((p) => p.key === room);
    const walkable = Object.values(ROOMS).some((r) => [...(r.portals || []), ...(r.buildings || [])].some((d) => d.to === room));
    assert(onMap || walkable, `${room} is unreachable`);
  }
});

t('SQL: players cannot write, rewards and progress are server-side', () => {
  assert(/revoke all on public\.secrets, public\.collectibles, public\.achievements/.test(sql));
  assert(!/grant (insert|update|delete)[^;]*(collectible|secret|achievement|world_room)/i.test(sql));
  assert(/grant select on public\.achievements, public\.player_collectibles/.test(sql));
  for (const fn of ['get_exploration', 'collect_collectible', 'find_clue', 'visit_room', '_sync_achievements']) {
    assert(new RegExp(`function public\\.${fn}\\(`).test(sql), fn);
  }
  assert(/security definer/.test(sql) && /auth\.uid\(\)/.test(sql));
  assert(/revoke all on function public\._sync_achievements\(uuid\) from authenticated/.test(sql), 'internal helper stays internal');
  assert(/unique \(player_id, collectible_id\)/.test(sql), 'duplicate rewards blocked by the database');
  assert(/not \(p_clue = any \(s\.clues\)\)/.test(sql), 'invented clues must be rejected');
});

console.log(`\n${n} checks passed`);
