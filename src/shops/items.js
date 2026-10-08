// Single source of truth for the cosmetic catalog (client rendering + SQL seed via scripts/gen-seed.mjs).
// Item id === texture key === `asset` column. Slot name === category.
export const SLOTS = ['eyes', 'face', 'hat', 'accessory', 'shirt', 'pants', 'shoes', 'back', 'hand'];
export const BODY_TYPES = { round: [1, 1], tall: [0.9, 1.14], chubby: [1.14, 0.94] };
export const BODY_COLORS = [
  '#4aa8ff', '#ff7a8a', '#ffc247', '#6fd08c', '#b48cff', '#ff9a52', '#59d0c8', '#9aa7b8',
  '#ffffff', '#2f3b52', '#ff5fa2', '#7ce04f', '#ff6b4a', '#00d4ff', '#c9a227', '#d9b8ff',
];
export const RARITY = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', event: 'Event' };

// Where each layer sits relative to the avatar's feet (container origin). Kept for anything still reading it.
export const LAYOUT = {
  back: { x: 0, y: -24 }, pants: { x: 0, y: -9 }, shirt: { x: 0, y: -14 }, accessory: { x: 0, y: -16 },
  eyes: { x: 0, y: -36 }, face: { x: 0, y: -33 }, hat: { x: 0, y: -50 }, hand: { x: 27, y: -14 },
};

// =====================================================================
// PHASE 17 — how clothes are WORN.
//
// Until now every item in a slot was pinned by its CENTRE at one fixed offset, so a tall hat floated above the
// head, a short one sank into it, a long cape hung off the bottom of the body and anything drawn larger than the
// original art simply overlapped the penguin. The fix is to give each slot an anchor:
//
//   ax, ay  the point ON THE ITEM that is pinned (Phaser origin). A hat is pinned by the middle of its BRIM
//           (0.5, 1), so every hat — tall, wide, horned — rests on the head. A shirt is pinned by its collar
//           (0.5, 0), so the neckline is always at the shoulders. Pants are pinned by their hem (0.5, 1).
//   y       where on the BODY that point goes, in body units (scaled with the body type, like everything else).
//   maxW    the widest the item may be across the penguin. Art wider than this is scaled DOWN to fit (never up,
//           so small items such as a bow tie keep their natural size).
//
// An item can nudge its own anchor with  fit: { dx, dy, s }  — used by the handful of pieces that genuinely sit
// differently (a halo floats, a jetpack rides low, a cape hangs wide).
// =====================================================================
export const FIT = {
  back:      { ax: 0.5, ay: 0.5, x: 0,  y: -25, maxW: 42 },
  pants:     { ax: 0.5, ay: 1.0, x: 0,  y: -2,  maxW: 38 },
  shirt:     { ax: 0.5, ay: 0.0, x: 0,  y: -27, maxW: 40 },
  accessory: { ax: 0.5, ay: 0.0, x: 0,  y: -26, maxW: 44 },
  eyes:      { ax: 0.5, ay: 0.5, x: 0,  y: -36, maxW: 32 },
  face:      { ax: 0.5, ay: 0.5, x: 0,  y: -33, maxW: 38 },
  hat:       { ax: 0.5, ay: 1.0, x: 0,  y: -44, maxW: 46 },
  hand:      { ax: 0.5, ay: 0.5, x: 25, y: -14, maxW: 22 },
};

const I = (id, name, category, rarity, price, description, extra = {}) => ({ id, name, category, rarity, price, description, asset: id, kind: 'clothing', ...extra });
export const ITEMS = [
  I('eyes_0', 'Bright Eyes', 'eyes', 'common', 0, 'Wide awake.', { starter: true }),
  I('eyes_1', 'Happy Eyes', 'eyes', 'common', 0, 'Always smiling.', { starter: true }),
  I('eyes_2', 'Sleepy Eyes', 'eyes', 'common', 0, 'Five more minutes…', { starter: true }),
  I('eyes_3', 'Sparkle Eyes', 'eyes', 'uncommon', 100, 'Starry-eyed.'),
  I('face_blush', 'Rosy Cheeks', 'face', 'common', 0, 'Cold-nose blush.', { starter: true }),
  I('face_freckles', 'Freckles', 'face', 'common', 40, 'Sun-kissed, somehow.'),
  I('face_glasses', 'Round Glasses', 'face', 'uncommon', 80, 'Bookish and cozy.'),
  I('face_sunglasses', 'Snow Shades', 'face', 'rare', 150, 'Glare-proof.'),
  I('hat_beanie', 'Red Beanie', 'hat', 'common', 0, 'The classic.', { starter: true }),
  I('hat_beanie_blue', 'Blue Beanie', 'hat', 'common', 80, 'Cool in every way.'),
  I('hat_earmuffs', 'Earmuffs', 'hat', 'uncommon', 100, 'Toasty ears.', { fit: { dy: 6 } }),
  I('hat_party', 'Party Hat', 'hat', 'uncommon', 120, 'Every day is a party.'),
  I('hat_tophat', 'Top Hat', 'hat', 'rare', 250, 'Very distinguished.'),
  I('hat_crown', 'Ice Crown', 'hat', 'epic', 600, 'Rule the plaza.', { fit: { dy: 2 } }),
  I('accessory_scarf', 'Striped Scarf', 'accessory', 'common', 60, 'Wrap up warm.', { fit: { dy: -2 } }),
  I('accessory_bowtie', 'Bow Tie', 'accessory', 'uncommon', 90, 'Dapper.', { fit: { dy: 1 } }),
  I('accessory_bell', 'Jingle Bell', 'accessory', 'uncommon', 70, 'Jingles when you waddle.'),
  I('shirt_stripe', 'Striped Tee', 'shirt', 'common', 0, 'Simple and sailor-y.', { starter: true }),
  I('shirt_hoodie', 'Cozy Hoodie', 'shirt', 'common', 120, 'Pocket included.'),
  I('shirt_sweater', 'Nordic Sweater', 'shirt', 'uncommon', 150, 'Knitted by someone who cares.'),
  I('shirt_tux', 'Tuxedo', 'shirt', 'rare', 300, 'Black-tie ready.'),
  I('pants_jeans', 'Blue Jeans', 'pants', 'common', 70, 'Never out of style.'),
  I('pants_cargo', 'Cargo Pants', 'pants', 'common', 90, 'So many pockets.'),
  I('pants_snow', 'Snow Pants', 'pants', 'uncommon', 140, 'Built for snowball fights.'),
  I('shoes_boots', 'Winter Boots', 'shoes', 'common', 90, 'Stomp-ready.'),
  I('shoes_sneakers', 'White Sneakers', 'shoes', 'common', 80, 'Fresh kicks.'),
  I('shoes_skates', 'Ice Skates', 'shoes', 'rare', 200, 'Glide into style.'),
  I('back_backpack', 'Explorer Pack', 'back', 'common', 150, 'Snacks inside.', { fit: { dy: 2 } }),
  I('back_cape', 'Hero Cape', 'back', 'rare', 300, 'Flutters dramatically.', { fit: { dy: 5, s: 1.0 } }),
  I('back_wings', 'Frost Wings', 'back', 'epic', 450, 'Shimmering and silly.', { fit: { dy: -2 } }),
  I('hand_snowball', 'Snowball', 'hand', 'common', 20, 'Packed fresh.'),
  I('hand_icecream', 'Ice Cream', 'hand', 'common', 40, 'Yes, in the snow.'),
  I('hand_balloon', 'Balloon', 'hand', 'uncommon', 60, 'Floaty.', { fit: { dy: -16 } }),
  I('hand_umbrella', 'Umbrella', 'hand', 'uncommon', 100, 'For snow showers.', { fit: { dy: -4 } }),

  // ---- Phase 9: a much bigger wardrobe (same slots, same rules, nothing replaced) ----
  I('eyes_4', 'Star Eyes', 'eyes', 'rare', 220, 'Seeing stars, in a good way.'),
  I('eyes_5', 'Wink', 'eyes', 'uncommon', 110, 'Permanently in on the joke.'),
  I('eyes_6', 'Visor Eyes', 'eyes', 'epic', 420, 'A soft glow, no explanation.'),
  I('face_mask', 'Snow Mask', 'face', 'uncommon', 120, 'For the really cold days.'),
  I('face_eyepatch', 'Eye Patch', 'face', 'rare', 190, 'Harbour chic.'),
  I('face_warpaint', 'Frost Paint', 'face', 'rare', 210, 'Two blue stripes. Very brave.'),
  I('hat_ushanka', 'Ushanka', 'hat', 'uncommon', 160, 'Ear flaps up or down, your call.', { fit: { dy: 2 } }),
  I('hat_viking', 'Horned Helm', 'hat', 'rare', 320, 'Historically questionable.', { fit: { dy: 2 } }),
  I('hat_santa', 'Winter Hat', 'hat', 'uncommon', 140, 'Red, white and cheerful.'),
  I('hat_pilot', 'Flight Cap', 'hat', 'rare', 280, 'Goggles included.', { fit: { dy: 2 } }),
  I('hat_flower', 'Snow Blossom', 'hat', 'uncommon', 130, 'It survives the frost somehow.'),
  I('hat_halo', 'Aurora Halo', 'hat', 'epic', 650, 'Floats a little above you.', { fit: { dy: -4 } }),
  I('hat_astro', 'Star Helmet', 'hat', 'epic', 700, 'Observatory surplus.', { fit: { dy: 3 } }),
  I('accessory_necklace', 'Ice Pendant', 'accessory', 'uncommon', 150, 'One perfect shard.'),
  I('accessory_medal', 'Explorer Medal', 'accessory', 'rare', 280, 'Worn with great pride.'),
  I('accessory_compass', 'Neck Compass', 'accessory', 'uncommon', 170, 'Always points somewhere.'),
  I('shirt_puffer', 'Puffer Jacket', 'shirt', 'common', 160, 'All the air, all the warmth.'),
  I('shirt_raincoat', 'Yellow Slicker', 'shirt', 'uncommon', 180, 'Harbour weather approved.'),
  I('shirt_sailor', 'Sailor Coat', 'shirt', 'uncommon', 200, 'Brass buttons and all.'),
  I('shirt_knight', 'Frost Plate', 'shirt', 'epic', 560, 'Surprisingly light.'),
  I('shirt_astro', 'Star Suit', 'shirt', 'epic', 620, 'Matches the helmet.'),
  I('pants_shorts', 'Brave Shorts', 'pants', 'common', 60, 'In this weather? Respect.'),
  I('pants_plaid', 'Plaid Trousers', 'pants', 'uncommon', 130, 'Loud, but in a nice way.'),
  I('pants_armor', 'Frost Greaves', 'pants', 'rare', 320, 'Clank, clank, clank.'),
  I('shoes_flippers', 'Flippers', 'shoes', 'uncommon', 110, 'Slap, slap, slap.', { fit: { s: 1.0 } }),
  I('shoes_mukluks', 'Fur Mukluks', 'shoes', 'uncommon', 150, 'Warmest boots in the world.'),
  I('back_jetpack', 'Snow Jet', 'back', 'epic', 700, 'Mostly decorative. Mostly.', { fit: { dy: 2 } }),
  I('back_sled', 'Sled', 'back', 'rare', 260, 'Strapped on and ready.', { fit: { dy: 3, s: 0.92 } }),
  I('back_aurora', 'Aurora Cloak', 'back', 'epic', 760, 'Trails the northern lights.', { fit: { dy: 6, s: 1.0 } }),
  I('hand_lantern', 'Keeper Lantern', 'hand', 'uncommon', 140, 'A small warm circle.', { fit: { dy: -2 } }),
  I('hand_rod', 'Fishing Rod', 'hand', 'common', 90, 'For the hole in the lake.', { fit: { dy: -6 } }),
  I('hand_cocoa', 'Hot Cocoa', 'hand', 'common', 50, 'Still steaming.'),
  I('hand_crystal', 'Cave Crystal', 'hand', 'rare', 300, 'Hums when you waddle.'),

  // ---- Phase 14 ----
  I('accessory_star', 'Blue Star', 'accessory', 'rare', 260, 'A six-pointed blue star on a fine chain.'),
  // The founder's jetpack. `secret: true` keeps it out of both shops, and the server refuses to sell it
  // (purchasable = false in supabase/phase14.sql); the ONLY way it reaches an inventory is claim_founder_item().
  I('back_jetpack_x', 'Aurora Jetpack', 'back', 'event', 0, 'One of a kind. It still smells faintly of ozone.', { secret: true , fit: { dy: 4 } }),
];
export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export function normalizeAvatar(d = {}) {
  const out = { bodyType: BODY_TYPES[d.bodyType] ? d.bodyType : 'round', color: /^#[0-9a-f]{6}$/i.test(d.color) ? d.color : BODY_COLORS[0] };
  for (const slot of SLOTS) {
    let v = d[slot];
    if (v == null || v === false) v = null;
    else if (typeof v === 'number') v = `${slot}_${v}`;
    else if (!String(v).startsWith(slot + '_')) v = `${slot}_${v}`;       // legacy: 'beanie' -> 'hat_beanie'
    out[slot] = v && ITEM_BY_ID[v]?.category === slot ? v : null;
  }
  if (!out.eyes) out.eyes = 'eyes_0';
  return out;
}
