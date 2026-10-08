// Phase 8 — achievement catalogue (display mirror).
// Progress and completion are computed server-side from real rows in _sync_achievements() (supabase/phase8.sql):
// collectibles collected, secrets discovered, friendships, furniture placed, arcade bests, rooms visited.
// Nothing here can unlock anything; the client only renders what the server reports.
// scripts/test-phase8.mjs keeps this list and the SQL seed identical.
const A = (id, name, icon, metric, goal, reward, description) => ({ id, name, icon, metric, goal, reward, description });

export const METRICS = {
  collectibles: 'Collectibles found',
  secrets: 'Secrets discovered',
  friends: 'Friends',
  furniture: 'Furniture placed',
  arcade: 'Arcade points',
  rooms: 'Places visited',
};

export const ACHIEVEMENTS = [
  A('first_find',    'First Find',      '⭐',  'collectibles',    1,   25, 'Collect your first hidden item.'),
  A('curator',       'Curator',         '🧊', 'collectibles',   10,  150, 'Collect 10 hidden collectibles.'),
  A('snow_hunter',   'Snow Hunter',     '❄️', 'collectibles',   25,  400, 'Collect 25 hidden collectibles.'),
  A('completionist', 'Completionist',   '👑', 'collectibles',   32, 1000, 'Collect every hidden item in the world.'),
  A('first_secret',  'Curious Penguin', '🕯️', 'secrets',         1,   50, 'Discover your first secret.'),
  A('explorer',      'Explorer',        '🔎', 'secrets',         5,  400, "Discover 5 of the world's secrets."),
  A('wanderer',      'Wanderer',        '🗺️', 'rooms',          12,  250, 'Set foot in 12 different places.'),
  A('arcade_master', 'Arcade Master',   '🕹️', 'arcade',       9000,  350, 'Reach 9,000 points across the arcade games.'),
  A('social_anchor', 'Social Anchor',   '🤝', 'friends',        10,  300, 'Have 10 friends.'),
  A('room_designer', 'Room Designer',   '🛋️', 'furniture',      20,  300, 'Place 20 pieces of furniture in your room.'),
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
