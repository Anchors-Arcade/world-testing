// Furniture catalog. Same shape as clothing items (id, name, category, price, rarity, asset, description)
// plus a footprint { w, h } in room pixels. Item id === texture key === `asset` column.
// `walkable` pieces (rugs) lie on the floor: avatars walk over them and other furniture may sit on top.
// The SQL seed (supabase/phase5.sql) is generated from this file by scripts/gen-furniture-seed.mjs.
const F = (id, name, category, rarity, price, description, w, h, extra = {}) =>
  ({ id, name, category, rarity, price, description, asset: id, w, h, kind: 'furniture', walkable: false, ...extra });

export const FURNITURE = [
  // chairs
  F('chair_wood', 'Wooden Chair', 'chair', 'common', 40, 'Sturdy. Slightly creaky.', 48, 48),
  F('chair_beanbag', 'Bean Bag', 'chair', 'common', 70, 'Impossible to sit on gracefully.', 64, 64),
  F('chair_armchair', 'Cozy Armchair', 'chair', 'uncommon', 110, 'Made for hot cocoa evenings.', 64, 64),
  F('sofa_plaid', 'Plaid Sofa', 'chair', 'uncommon', 180, 'Seats two penguins and a snack.', 144, 64),
  // tables
  F('table_coffee', 'Coffee Table', 'table', 'common', 50, 'Low and mug-friendly.', 80, 48),
  F('table_round', 'Round Table', 'table', 'common', 60, 'No head of the table.', 80, 80),
  F('table_long', 'Long Table', 'table', 'common', 90, 'Room for the whole flock.', 128, 64),
  // beds
  F('bed_single', 'Single Bed', 'bed', 'common', 150, 'A snug spot to nap.', 80, 144),
  F('bed_double', 'Double Bed', 'bed', 'uncommon', 260, 'Extra pillows included.', 112, 144),
  F('bed_igloo', 'Igloo Nest', 'bed', 'rare', 400, 'A tiny igloo with a warm bed inside.', 112, 112),
  // lamps
  F('lamp_floor', 'Floor Lamp', 'lamp', 'common', 45, 'Soft golden light.', 32, 32),
  F('lamp_lantern', 'Lantern', 'lamp', 'uncommon', 65, 'Flickers like a campfire.', 32, 32),
  F('lamp_star', 'Star Lamp', 'lamp', 'rare', 120, 'A little piece of the night sky.', 40, 40),
  // plants
  F('plant_cactus', 'Little Cactus', 'plant', 'common', 25, 'Needs almost nothing. Unlike you.', 32, 32),
  F('plant_fern', 'Potted Fern', 'plant', 'common', 35, 'Leafy and calm.', 48, 48),
  F('plant_fir', 'Mini Fir Tree', 'plant', 'uncommon', 80, 'A snowy pine, indoors.', 56, 56),
  // shelves
  F('shelf_books', 'Bookshelf', 'shelf', 'common', 110, 'Stuffed with adventures.', 128, 40),
  F('shelf_cabinet', 'Cabinet', 'shelf', 'uncommon', 130, 'Hides a surprising amount of clutter.', 96, 48),
  // decorations
  F('deco_radio', 'Retro Radio', 'decoration', 'common', 55, 'Crackly tunes.', 48, 32),
  F('deco_fishbowl', 'Fish Bowl', 'decoration', 'uncommon', 75, 'Sir Bubbles will watch over you.', 40, 40),
  F('deco_trophy', 'Golden Trophy', 'decoration', 'rare', 160, 'For the best waddler.', 32, 32),
  F('deco_fireplace', 'Fireplace', 'decoration', 'rare', 320, 'The warmest corner of the house.', 112, 56),
  // rugs (walkable)
  F('rug_round', 'Round Rug', 'rug', 'common', 70, 'Ties the room together.', 128, 128, { walkable: true }),
  F('rug_stripe', 'Striped Rug', 'rug', 'common', 85, 'Sailor-approved.', 160, 96, { walkable: true }),
  F('rug_polar', 'Polar Bear Rug', 'rug', 'rare', 220, 'Surprisingly friendly.', 144, 112, { walkable: true }),
  // snow-themed
  F('snow_snowman', 'Snowman', 'snow', 'uncommon', 90, 'Never melts. Mostly.', 56, 56),
  F('snow_iceblock', 'Ice Block Table', 'snow', 'rare', 140, 'Chilly to the touch.', 64, 64),
  F('snow_penguin', 'Ice Penguin Statue', 'snow', 'epic', 350, 'Carved by a very proud penguin.', 48, 48),
  // seasonal
  F('season_pumpkin', 'Pumpkin', 'seasonal', 'uncommon', 60, 'Autumn, all year round.', 40, 40),
  F('season_tree', 'Holiday Tree', 'seasonal', 'event', 200, 'Twinkling and a little tilted.', 80, 80),
];

export const FURNITURE_BY_ID = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));
export const FURNITURE_CATS = [
  ['all', 'All'], ['chair', 'Seats'], ['table', 'Tables'], ['bed', 'Beds'], ['lamp', 'Lamps'], ['plant', 'Plants'],
  ['shelf', 'Shelves'], ['decoration', 'Decor'], ['rug', 'Rugs'], ['snow', 'Snow'], ['seasonal', 'Seasonal'],
];
