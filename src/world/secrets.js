// Phase 8 — the world's secrets.
// A secret is a set of CLUES. Finding every clue discovers it: the server pays the reward and, for some, opens a
// hidden room (`unlocksRoom`). One clue = a one-step secret (a hidden switch); several clues = a hunt.
// The real list lives in the `secrets` table (supabase/phase8.sql) and find_clue() refuses any clue that is not in it,
// so this mirror is only for rendering, hints and guest play. scripts/test-phase8.mjs keeps them in sync.
const S = (id, name, room_id, clues, reward, unlocks_room = null, hint = '') =>
  ({ id, name, room_id, clues, reward, unlocks_room, hint });

export const SECRETS = [
  S('hollow_crack', 'The Cracked Wall', 'ice_caves', ['mark_a', 'mark_b', 'mark_c'], 250, 'crystal_hollow',
    'Three glowing marks in the Ice Caves point at a wall that is not a wall.'),
  S('star_alignment', 'The Star Alignment', 'observatory', ['dial_north', 'dial_west', 'old_chart'], 250, 'star_chamber',
    'Line up the Observatory dials the way the old chart shows.'),
  S('lantern_signal', 'The Lantern Signal', 'lighthouse', ['lamp_switch'], 120, null,
    'Somebody still lights the lamp at the top of the lighthouse.'),
  S('buried_cache', 'The Buried Cache', 'snow_camp', ['neat_pile'], 120, null,
    'One of the snow piles at the camp is suspiciously neat.'),
  S('whistling_pines', 'The Whistling Pines', 'deep_forest', ['pine_1', 'pine_2', 'pine_3', 'pine_4'], 200, null,
    'Four pines in the Deep Forest hum when the wind turns.'),
  S('frozen_message', 'The Message in the Ice', 'frozen_lake', ['ice_bubble'], 120, null,
    'Something is frozen into the middle of the lake.'),
  S('cairn_road', 'The Cairn Road', 'mountain_pass', ['cairn_1', 'cairn_2', 'cairn_3'], 200, null,
    'Stack the three fallen cairns and the old pass road reappears.'),
];

export const SECRET_BY_ID = Object.fromEntries(SECRETS.map((s) => [s.id, s]));
export const TOTAL_SECRETS = SECRETS.length;
// Rooms that only exist once their secret is discovered — the world map must never list these up front.
export const HIDDEN_ROOMS = SECRETS.filter((s) => s.unlocks_room).map((s) => s.unlocks_room);
