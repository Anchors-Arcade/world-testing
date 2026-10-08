// Phase 8 — the collectible catalogue.
// The SERVER is the authority (table `collectibles` in supabase/phase8.sql): get_exploration() sends the real list,
// with anything hidden behind an undiscovered secret stripped out, and collect_collectible() decides the reward.
// This mirror exists so the world still renders before the first response arrives and so GUESTS (who have no
// server session) can explore and collect locally. scripts/test-phase8.mjs fails if the two drift apart.
//
// C(id, name, roomId, x, y, rarity, reward, requiresSecret) — x/y are world pixels in that room.
const C = (id, name, room_id, x, y, rarity, reward, requires_secret = null) =>
  ({ id, name, room_id, x, y, rarity, reward, requires_secret });

export const RARITY = {
  common:    { label: 'Common',    color: '#cfe8f5', glow: 0xcfe8f5 },
  uncommon:  { label: 'Uncommon',  color: '#6fd08c', glow: 0x6fd08c },
  rare:      { label: 'Rare',      color: '#5bb6e8', glow: 0x5bb6e8 },
  epic:      { label: 'Epic',      color: '#b48cff', glow: 0xb48cff },
  legendary: { label: 'Legendary', color: '#ffc247', glow: 0xffc247 },
};

export const COLLECTIBLES = [
  C('flake_plaza_1',   'Plaza Snowflake',       'snowy_plaza',    1120, 880, 'common',    15),
  C('flake_plaza_2',   'Rooftop Snowflake',     'snowy_plaza',     300, 430, 'common',    15),
  C('flake_forest_1',  'Pinewood Flake',        'deep_forest',     260, 300, 'common',    15),
  C('flake_forest_2',  'Hollow Log Flake',      'deep_forest',    1320, 760, 'uncommon',  25),
  C('lost_compass',    'Lost Compass',          'deep_forest',     820, 200, 'rare',      60),
  C('pine_badge',      'Whistling Pine Badge',  'deep_forest',     900, 900, 'epic',     120, 'whistling_pines'),
  C('flake_camp_1',    'Campfire Flake',        'snow_camp',       640, 520, 'uncommon',  25),
  C('old_kettle',      'Dented Kettle',         'snow_camp',       300, 300, 'uncommon',  30),
  C('camp_journal',    'Torn Journal Page',     'snow_camp',      1180, 640, 'rare',      60),
  C('cache_medal',     'Explorer Medal',        'snow_camp',      1020, 300, 'epic',     120, 'buried_cache'),
  C('flake_lake_1',    'Lakeside Flake',        'frozen_lake',     220, 760, 'common',    15),
  C('flake_lake_2',    'Black Ice Flake',       'frozen_lake',    1260, 420, 'uncommon',  25),
  C('skate_key',       'Old Skate Key',         'frozen_lake',     780, 880, 'rare',      60),
  C('ice_locket',      'Locket in the Ice',     'frozen_lake',     800, 500, 'epic',     120, 'frozen_message'),
  C('flake_harbor_1',  'Dockside Flake',        'harbor_village',  380, 820, 'common',    15),
  C('fish_crate_coin', 'Crate Coin',            'harbor_village', 1340, 700, 'uncommon',  25),
  C('rope_charm',      "Sailor's Charm",        'harbor_village',  940, 280, 'rare',      60),
  C('lamp_flake',      'Lamp Room Flake',       'lighthouse',      300, 300, 'uncommon',  25),
  C('keeper_log',      "Keeper's Logbook",      'lighthouse',      700, 260, 'epic',     120, 'lantern_signal'),
  C('flake_pass_1',    'Windswept Flake',       'mountain_pass',   260, 620, 'common',    15),
  C('flake_pass_2',    'Summit Flake',          'mountain_pass',  1180, 220, 'rare',      50),
  C('rusted_piton',    'Rusted Piton',          'mountain_pass',   700, 820, 'uncommon',  30),
  C('cairn_stone',     'Marker Stone',          'mountain_pass',  1000, 480, 'epic',     120, 'cairn_road'),
  C('crystal_blue',    'Blue Crystal',          'ice_caves',       300, 420, 'uncommon',  30),
  C('crystal_green',   'Green Crystal',         'ice_caves',      1180, 540, 'rare',      60),
  C('cave_flake',      'Cave Flake',            'ice_caves',       740, 700, 'common',    20),
  C('crystal_heart',   'Crystal Heart',         'crystal_hollow',  500, 360, 'legendary',250, 'hollow_crack'),
  C('crystal_shard',   'Hollow Shard',          'crystal_hollow',  800, 520, 'epic',     120, 'hollow_crack'),
  C('brass_lens',      'Brass Lens',            'observatory',     220, 420, 'uncommon',  30),
  C('star_chart',      'Faded Star Chart',      'observatory',     800, 300, 'rare',      60),
  C('comet_fragment',  'Comet Fragment',        'star_chamber',    480, 340, 'legendary',250, 'star_alignment'),
  C('orrery_gear',     'Orrery Gear',           'star_chamber',    740, 480, 'epic',     120, 'star_alignment'),
];

export const COLLECTIBLE_BY_ID = Object.fromEntries(COLLECTIBLES.map((c) => [c.id, c]));
export const collectiblesIn = (roomId, list = COLLECTIBLES) => list.filter((c) => c.room_id === roomId);
export const TOTAL_COLLECTIBLES = COLLECTIBLES.length;
