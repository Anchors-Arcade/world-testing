// Room themes (wall + floor palettes). Keys must match the allow-list inside save_room() in supabase/phase5.sql.
export const THEMES = {
  cozy_wood:  { name: 'Cozy Wood',  wall: 0x7a4f2f, trim: 0x5a3820, floorA: 0xb9814f, floorB: 0x9c693c, glow: 0xffe9a8 },
  snow_cabin: { name: 'Snow Cabin', wall: 0xdfeaf2, trim: 0xa9c4d6, floorA: 0xe6d3b3, floorB: 0xcdb592, glow: 0xfff5cf },
  ice_blue:   { name: 'Ice Blue',   wall: 0x5fa8d3, trim: 0x3b7ba3, floorA: 0xd6eefa, floorB: 0xb7dcef, glow: 0xe6f7ff },
  sunset:     { name: 'Sunset',     wall: 0xd9694a, trim: 0x9a3f2a, floorA: 0xf0c48a, floorB: 0xdcab6f, glow: 0xffd9a0 },
  midnight:   { name: 'Midnight',   wall: 0x2a3358, trim: 0x1b2140, floorA: 0x46507a, floorB: 0x3b446a, glow: 0xb8c4ff },
  mint:       { name: 'Mint Lodge', wall: 0x6fbf9f, trim: 0x3f8f72, floorA: 0xe8e2c8, floorB: 0xd3cbab, glow: 0xf3ffe0 },
};
export const THEME_KEYS = Object.keys(THEMES);
export const hex = (n) => '#' + n.toString(16).padStart(6, '0');
