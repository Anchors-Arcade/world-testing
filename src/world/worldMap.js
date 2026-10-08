// Phase 8 — world map metadata.
// One entry per place the World Map offers to travel to, in walking order. Interiors that are only ever reached from
// the room they sit in (shop floors, the arcade, your home) are not listed: you walk into those.
// `hidden: true` places are secret rooms — they appear on the map only after their secret has been discovered.
import { ROOMS } from '../maps/rooms.js';

const P = (key, icon, blurb, activities = [], extra = {}) => ({ key, icon, blurb, activities, ...extra });

export const WORLD_MAP = [
  P('snowy_plaza',    '❄️', 'The heart of Anchors World.',          ['Shops', 'Arcade', 'Café', 'Your room']),
  P('deep_forest',    '🌲', 'Old pines, deep snow, no footprints.', ['Collectibles', 'A secret']),
  P('snow_camp',      '⛺', 'Someone banked the fire and left.',    ['Collectibles', 'A secret']),
  P('frozen_lake',    '🧊', 'Solid at the edges. Mostly.',          ['Collectibles', 'A secret']),
  P('harbor_village', '🏘️', 'Boats in for the winter.',             ['Lighthouse', 'Collectibles']),
  P('lighthouse',     '🗼', 'The keeper is away.',                  ['Collectibles', 'A secret']),
  P('mountain_pass',  '🏔️', 'Wind, stone and old cairns.',          ['Ice Caves', 'Observatory', 'A secret']),
  P('ice_caves',      '🕳️', 'Cold, dark and marked.',               ['Collectibles', 'A secret']),
  P('observatory',    '🏛️', 'They watched the sky from here.',      ['Collectibles', 'A secret']),
  // Phase 12 — the ski area. You walk to the base, ride the lift, and sled back down into the world.
  P('ski_base',       '🎿', 'Lift queue, warm hut, cold nose.',     ['Gondola', 'Warming hut']),
  P('ski_summit',     '🚡', 'Five routes down. Pick one.',          ['Sled routes', 'The view']),
  P('slope_beginner', '🟢', 'Wide, gentle, forgiving.',             ['Sledding', 'Coins']),
  P('slope_forest',   '🌲', 'Tight lines between old pines.',       ['Sledding', 'Coins']),
  P('slope_ridge',    '🏔️', 'Long sweeping bends, big drop.',       ['Sledding', 'Coins']),
  P('slope_extreme',  '⚫', 'Steep. Narrow. Unapologetic.',         ['Sledding', 'Coins']),
  P('slope_hidden',   '❄️', 'Behind the cornice, if you found it.', ['Sledding', 'Rare coins'], { hidden: true }),
  P('crystal_hollow', '💎', 'Behind the wall that was not a wall.', ['Rare collectibles'], { hidden: true }),
  P('star_chamber',   '🪐', 'Sealed until the dials agreed.',       ['Rare collectibles'], { hidden: true }),
];

export const WORLD_BY_KEY = Object.fromEntries(WORLD_MAP.map((p) => [p.key, p]));
export const nameOf = (key) => ROOMS[key]?.name || key;
// Secret rooms, straight from the map data — the panel uses this to keep them off the list until they are unlocked.
export const HIDDEN_MAP_ROOMS = WORLD_MAP.filter((p) => p.hidden).map((p) => p.key);
