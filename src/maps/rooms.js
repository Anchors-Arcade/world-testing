// Data-driven rooms. To add a room: add an entry here, then link a door/portal to it.
// building: { id,label,x,y,w,h,wall,roof,to }  -> collidable; door zone is auto-placed below it.
// portal:   { label,x,y,w,h,to,spawn }          -> walk-in zone (edges, interior exits).
//           `spawn` is where you land IN THIS ROOM when you arrive from `to`.
//           Phase 8: { secret: '<secret id>' } hides the portal until that secret is discovered.
// blocks:   [{x,y,w,h}]                         -> invisible/visible collision rectangles.
// props:    [{ type: 'pond' | 'ice' | 'rock' | 'crystal' | 'dock', ... }] -> scenery; `rock` collides.
// hidden:   true                                -> secret room: never listed on the world map until it is unlocked.
//
// Phase 8 note: interactive objects and collectibles are NOT listed here. They come from src/world/interactions.js
// and from the server's collectible catalogue, keyed by room id, so one room definition serves every system.
import { SKI_ROUTES } from '../world/skiAreas.js';

// Phase 12 helper: a sled route room is just a tall snow room whose size comes from the route data,
// so the course and the room can never disagree about where the finish line is.
// A slope is a long one-way room: you push off at the top and the run spits you out somewhere else in the world.
// The gate at the top is also a normal portal back to the summit, so changing your mind — or a run that never
// starts because the server is unreachable — can never strand you halfway up a mountain.
const slopeRoom = (key, name, extra = {}) => {
  const r = SKI_ROUTES[key];
  const top = { x: Math.round(r.trailAt(r.startY).cx), y: r.startY - 40 };
  return {
    name, w: r.w, h: r.finishY + 260, floor: 'snow', sled: key, route: key,
    spawn: top,
    sky: 0x0d2033, fx: 'snow', stars: true, wash: [0xdff0fb, 0.95],
    portals: [{ label: '▴ Back to the summit', x: Math.max(10, top.x - 300), y: Math.max(10, r.startY - 150),
      w: 180, h: 70, to: 'ski_summit', spawn: top }],
    ...extra,
  };
};

export const ROOMS = {
  snowy_plaza: {
    name: 'Snowy Plaza', w: 1800, h: 1100, floor: 'snow', spawn: { x: 900, y: 860 },
    sky: 0x14314f, fx: 'snow', stars: true,
    buildings: [
      { label: 'Library', icon: '📚',       x: 90,   y: 130, w: 230, h: 190, wall: 0x8c5a3a, roof: 0x3d5a80, to: 'library' },
      { label: 'School', icon: '🔔',        x: 370,  y: 140, w: 250, h: 180, wall: 0xc9553d, roof: 0x2e4057, to: 'school' },
      { label: 'Town Hall', icon: '🏛️',     x: 720,  y: 70,  w: 360, h: 250, wall: 0xd8c9a3, roof: 0x4a6fa5, to: 'town_hall' },
      { label: 'Arcade', icon: '🕹️',        x: 1180, y: 140, w: 250, h: 180, wall: 0x6a4fb3, roof: 0x2d2a5e, to: 'arcade' },
      { label: 'Café', icon: '☕',          x: 1480, y: 150, w: 220, h: 170, wall: 0xb5703f, roof: 0xe8483c, to: 'cafe' },
      { label: 'Clothing Shop', icon: '🧥', x: 250,  y: 560, w: 220, h: 170, wall: 0x2a9d8f, roof: 0x1d6f66, to: 'clothing_shop' },
      { label: 'Furniture Shop',x: 1330, y: 560, w: 230, h: 170, wall: 0xe9a23b, roof: 0x9c5f12, to: 'furniture_shop' },
      { label: 'My Home', icon: '🏠',       x: 780,  y: 780, w: 240, h: 150, wall: 0x7fa6c9, roof: 0x34506b, to: 'home' },
    ],
    portals: [
      { label: '◂ Deep Forest', x: 0,    y: 440, w: 60, h: 220, to: 'deep_forest',    spawn: { x: 120,  y: 550 } },
      { label: 'Harbour ▸',     x: 1740, y: 440, w: 60, h: 220, to: 'harbor_village', spawn: { x: 1680, y: 550 } },
    ],
    props: [
      { type: 'pond', x: 900, y: 500, rx: 150, ry: 80 },
      { type: 'lamp', x: 700, y: 620 }, { type: 'lamp', x: 1100, y: 620 }, { type: 'lamp', x: 1150, y: 980 },
      { type: 'snowman', x: 1500, y: 880 }, { type: 'snowman', x: 330, y: 980, s: 0.8 },
      { type: 'bush', x: 520, y: 480 }, { type: 'bush', x: 1290, y: 480 }, { type: 'bush', x: 880, y: 1050 },
    ],
    trees: [[60,60],[190,420],[640,430],[1160,430],[1650,430],[130,900],[420,950],[1400,930],[1680,880],[1720,1040],[60,1040],[640,980],[1130,1010],[560,720],[1240,720]],
  },
  cafe: {
    name: 'Café', w: 1000, h: 700, floor: 'wood', indoor: true, spawn: { x: 500, y: 560 },
    sky: 0x2a1d14, fx: 'dust', wash: [0xffe6c2, 0.9],
    props: [{ type: 'glow', x: 500, y: 460, r: 150, color: 0xffa63c }],
    blocks: [
      { x: 60, y: 200, w: 120, h: 70, label: '☕' }, { x: 300, y: 260, w: 120, h: 70, label: '☕' },
      { x: 580, y: 260, w: 120, h: 70, label: '🍰' }, { x: 800, y: 200, w: 120, h: 70, label: '☕' },
      { x: 330, y: 440, w: 340, h: 50, label: 'Counter', color: 0x6b4428 },
    ],
    portals: [{ label: 'Exit ▾', x: 420, y: 650, w: 160, h: 50, to: 'snowy_plaza', spawn: { x: 500, y: 560 } }],
  },
  // Shops: walk to the counter and press E (or click it) to open the storefront.
  clothing_shop: {
    name: 'Snowy Threads', w: 1000, h: 700, floor: 'wood', indoor: true, spawn: { x: 500, y: 580 },
    sky: 0x14312d, fx: 'dust', wash: [0xdaf3ee, 0.95], props: [{ type: 'glow', x: 500, y: 330, r: 170, color: 0x8ff0b3 }],
    blocks: [
      { x: 60, y: 230, w: 150, h: 60, label: '🧥 Coats', color: 0x2a9d8f }, { x: 250, y: 230, w: 150, h: 60, label: '👕 Shirts', color: 0x2a9d8f },
      { x: 600, y: 230, w: 150, h: 60, label: '👖 Pants', color: 0x2a9d8f }, { x: 790, y: 230, w: 150, h: 60, label: '🎩 Hats', color: 0x2a9d8f },
      { x: 80, y: 440, w: 90, h: 120, label: '👟', color: 0x1d6f66 }, { x: 830, y: 440, w: 90, h: 120, label: '🧣', color: 0x1d6f66 },
    ],
    kiosks: [{ label: 'Clothing Shop', x: 400, y: 300, w: 200, h: 60, action: 'clothing', icon: '🛍️ Try things on' }],
    portals: [{ label: 'Exit ▾', x: 420, y: 650, w: 160, h: 50, to: 'snowy_plaza', spawn: { x: 500, y: 580 } }],
  },
  furniture_shop: {
    name: 'Cozy Corner', w: 1000, h: 700, floor: 'wood', indoor: true, spawn: { x: 500, y: 580 },
    sky: 0x33240f, fx: 'dust', wash: [0xffeccd, 0.95], props: [{ type: 'glow', x: 500, y: 330, r: 170, color: 0xffc247 }],
    blocks: [
      { x: 60, y: 230, w: 150, h: 60, label: '🛋️ Sofas', color: 0xe9a23b }, { x: 250, y: 230, w: 150, h: 60, label: '🛏️ Beds', color: 0xe9a23b },
      { x: 600, y: 230, w: 150, h: 60, label: '💡 Lamps', color: 0xe9a23b }, { x: 790, y: 230, w: 150, h: 60, label: '🪴 Plants', color: 0xe9a23b },
      { x: 80, y: 440, w: 90, h: 120, label: '📚', color: 0x9c5f12 }, { x: 830, y: 440, w: 90, h: 120, label: '🧶', color: 0x9c5f12 },
    ],
    kiosks: [{ label: 'Furniture Shop', icon: '🛋️', x: 400, y: 300, w: 200, h: 60, action: 'furniture', icon: '🛋️ Browse furniture' }],
    portals: [{ label: 'Exit ▾', x: 420, y: 650, w: 160, h: 50, to: 'snowy_plaza', spawn: { x: 500, y: 580 } }],
  },
  // The Arcade: walk up to a cabinet and press E (or click it) to pick a game; the board on the right opens the leaderboards.
  // Cabinets are data (`cabinets`): add a game by adding an entry here + in minigames/registry.js.
  arcade: {
    name: 'Arcade', w: 1100, h: 720, floor: 'arcade_floor', indoor: true, wallColor: 0x2d2a5e, spawn: { x: 550, y: 600 }, sign: 'ANCHOR ARCADE',
    sky: 0x191636, fx: 'sparkle', vignette: true,
    props: [{ type: 'glow', x: 550, y: 300, r: 220, color: 0xff6fae }],
    cabinets: [
      { label: 'Snow Dash',      icon: '🏁', x: 40,  y: 160, w: 140, h: 150, color: 0x3f8fc9, action: 'arcade:snow_dash' },
      { label: 'Coin Catcher',   icon: '🪙', x: 200, y: 160, w: 140, h: 150, color: 0xe9a23b, action: 'arcade:coin_catcher' },
      { label: 'Snowball Arena', icon: '☃️', x: 360, y: 160, w: 140, h: 150, color: 0xd9546a, action: 'arcade:snowball_arena' },
      { label: 'Slope Sled Run', icon: '🛷', x: 520, y: 160, w: 140, h: 150, color: 0x4f9fd8, action: 'arcade:slope_sled' },
      { label: 'Snow Runner',    icon: '🏃', x: 680, y: 160, w: 140, h: 150, color: 0x2f9e7b, action: 'arcade:snow_runner' },
      { label: 'Leaderboards',   icon: '🏆', x: 840, y: 160, w: 220, h: 150, color: 0x6a4fb3, action: 'arcade:leaderboard', board: true, verb: 'view' },
    ],
    blocks: [
      { x: 60,  y: 440, w: 130, h: 80, label: '🧸', color: 0x6a4fb3 }, { x: 910, y: 440, w: 130, h: 80, label: '🎈', color: 0x6a4fb3 },
      { x: 60,  y: 560, w: 130, h: 80, label: '🎟️', color: 0x3f8fc9 }, { x: 910, y: 560, w: 130, h: 80, label: '🏀', color: 0x3f8fc9 },
    ],
    portals: [{ label: 'Exit ▾', x: 470, y: 670, w: 160, h: 50, to: 'snowy_plaza', spawn: { x: 550, y: 600 } }],
  },
  // Player room TEMPLATE: one definition, loaded for any owner. The scene builds the floor/walls/furniture from the
  // owner's saved room (see rooms/HomeRoom.js), so every player gets their own layout without separate map code.
  home: {
    name: 'My Room', type: 'home', w: 960, h: 680, floor: 'wood', indoor: true, spawn: { x: 480, y: 560 },
    portals: [{ label: 'Exit ▾', x: 400, y: 630, w: 160, h: 50, to: 'snowy_plaza', spawn: { x: 480, y: 560 } }],
  },

  // ===================================================================
  // PHASE 8 — the wider world. Same room system, same scene, more places.
  // Travel graph:
  //   Deep Forest ⇄ Snowy Plaza ⇄ Harbour Village
  //   Deep Forest ⇄ Snow Camp ⇄ Frozen Lake ⇄ Harbour Village
  //   Frozen Lake ⇄ Mountain Pass → Ice Caves / Old Observatory
  //   Harbour Village → Lighthouse
  //   Ice Caves → Crystal Hollow 🔒   Old Observatory → Star Chamber 🔒  (secret rooms)
  // ===================================================================
  deep_forest: {
    name: 'Deep Forest', w: 1600, h: 1000, floor: 'snow', spawn: { x: 800, y: 700 },
    sky: 0x102a2a, fx: 'snow', wash: [0xcfe0d8, 0.95],
    paths: [[700, 60, 210, 880], [160, 480, 1360, 150]],
    activities: [{ id: 'firefly_catch', x: 560, y: 660 }],
    portals: [
      { label: 'Plaza ▸',     x: 1540, y: 440, w: 60,  h: 220, to: 'snowy_plaza', spawn: { x: 1460, y: 550 } },
      { label: '▴ Snow Camp', x: 690,  y: 0,   w: 220, h: 60,  to: 'snow_camp',   spawn: { x: 800,  y: 150 } },
    ],
    props: [
      { type: 'rock', x: 1420, y: 820, r: 46 }, { type: 'rock', x: 160, y: 180, r: 38 },
      { type: 'bush', x: 300, y: 740 }, { type: 'bush', x: 980, y: 540 }, { type: 'bush', x: 1180, y: 960 },
      { type: 'lamp', x: 1460, y: 560 },
    ],
    trees: [[90, 240], [170, 480], [120, 760], [400, 180], [460, 420], [380, 900], [560, 560], [700, 260],
      [760, 700], [880, 420], [960, 160], [1020, 620], [1120, 460], [1240, 240], [1280, 900], [1360, 620],
      [1500, 340], [1540, 880], [620, 960], [240, 980]],
  },
  snow_camp: {
    name: 'Snow Camp', w: 1400, h: 900, floor: 'snow', spawn: { x: 700, y: 700 },
    sky: 0x1a2b44, fx: 'snow', stars: true,
    paths: [[600, 260, 200, 600], [240, 420, 920, 140]],
    activities: [{ id: 'cocoa_rush', x: 150, y: 640 }],
    portals: [
      { label: 'Deep Forest ▾', x: 590,  y: 840, w: 220, h: 60,  to: 'deep_forest', spawn: { x: 700,  y: 760 } },
      { label: 'Frozen Lake ▸', x: 1340, y: 380, w: 60,  h: 200, to: 'frozen_lake', spawn: { x: 1260, y: 480 } },
    ],
    blocks: [
      { x: 180, y: 180, w: 150, h: 90, label: '⛺', color: 0xc9553d }, { x: 1120, y: 180, w: 150, h: 90, label: '⛺', color: 0x3f8fc9 },
      { x: 640, y: 180, w: 160, h: 90, label: '⛺ Mess Tent', color: 0x2a9d8f },
    ],
    props: [
      { type: 'rock', x: 240, y: 620, r: 40 }, { type: 'rock', x: 1240, y: 720, r: 36 },
      { type: 'glow', x: 700, y: 470, r: 170, color: 0xffa63c },      // the campfire's light
      { type: 'lamp', x: 460, y: 300 }, { type: 'lamp', x: 940, y: 300 },
      { type: 'snowman', x: 1300, y: 460, s: 0.9 }, { type: 'bush', x: 160, y: 760 },
    ],
    trees: [[70, 420], [80, 820], [1340, 120], [1330, 880], [460, 120], [900, 120]],
  },
  frozen_lake: {
    name: 'Frozen Lake', w: 1600, h: 1000, floor: 'ice', spawn: { x: 800, y: 820 },
    sky: 0x0b2033, fx: 'blizzard', aurora: true, stars: true, wash: [0xd8ecff, 0.95],
    activities: [{ id: 'ice_fishing', x: 1150, y: 640 }],
    portals: [
      { label: '◂ Snow Camp',       x: 0,   y: 380, w: 60,  h: 200, to: 'snow_camp',      spawn: { x: 120, y: 480 } },
      { label: '▴ Mountain Pass',   x: 690, y: 0,   w: 220, h: 60,  to: 'mountain_pass',  spawn: { x: 800, y: 150 } },
      { label: 'Harbour Village ▾', x: 690, y: 940, w: 220, h: 60,  to: 'harbor_village', spawn: { x: 800, y: 860 } },
    ],
    props: [
      { type: 'ice', x: 800, y: 540, rx: 300, ry: 170 }, { type: 'ice', x: 320, y: 300, rx: 150, ry: 90 },
      { type: 'ice', x: 1320, y: 820, rx: 170, ry: 100 },
      { type: 'rock', x: 180, y: 900, r: 44 }, { type: 'rock', x: 1480, y: 200, r: 50 },
      { type: 'snowman', x: 1080, y: 900 }, { type: 'snowman', x: 420, y: 300, s: 0.75 },
      { type: 'lamp', x: 300, y: 640 }, { type: 'lamp', x: 1300, y: 640 },
    ],
    trees: [[80, 120], [80, 660], [1520, 480], [1540, 980], [420, 980], [1180, 120]],
  },
  harbor_village: {
    name: 'Harbour Village', w: 1600, h: 1000, floor: 'snow', spawn: { x: 800, y: 820 },
    sky: 0x11263d, fx: 'snow', stars: true,
    paths: [[700, 60, 200, 820], [200, 620, 1200, 140]],
    activities: [{ id: 'crate_stack', x: 230, y: 420 }],
    buildings: [
      { label: 'Lighthouse', icon: '🗼', x: 1140, y: 150, w: 190, h: 270, wall: 0xf0f4f7, roof: 0xe8483c, to: 'lighthouse' },
    ],
    portals: [
      { label: '◂ Snowy Plaza', x: 0,   y: 440, w: 60,  h: 220, to: 'snowy_plaza', spawn: { x: 120, y: 550 } },
      { label: '▴ Frozen Lake', x: 690, y: 0,   w: 220, h: 60,  to: 'frozen_lake', spawn: { x: 800, y: 150 } },
    ],
    blocks: [
      { x: 240, y: 240, w: 170, h: 100, label: '🏘️ Boathouse', color: 0x8c5a3a },
      { x: 480, y: 540, w: 130, h: 60,  label: '📦', color: 0x9c5f12 },
      { x: 1040, y: 560, w: 130, h: 60, label: '📦', color: 0x9c5f12 },
    ],
    props: [
      { type: 'dock', x: 700, y: 900, w: 500, h: 70 }, { type: 'dock', x: 1240, y: 880, w: 260, h: 60 },
      { type: 'rock', x: 1500, y: 880, r: 44 },
      { type: 'glow', x: 1235, y: 300, r: 200, color: 0xfff0b0 },     // the lighthouse beam spilling down
      { type: 'lamp', x: 520, y: 700 }, { type: 'lamp', x: 1000, y: 700 }, { type: 'lamp', x: 760, y: 420 },
      { type: 'snowman', x: 180, y: 620, s: 0.85 }, { type: 'bush', x: 1420, y: 460 },
    ],
    trees: [[90, 180], [80, 880], [1540, 560], [1420, 120]],
  },
  lighthouse: {
    name: 'Lighthouse', w: 900, h: 700, floor: 'stone', indoor: true, wallColor: 0x4a5b6b, spawn: { x: 450, y: 560 },
    sign: 'LAMP ROOM',
    sky: 0x121d2a, fx: 'dust', vignette: true, stars: true,
    props: [{ type: 'glow', x: 450, y: 240, r: 240, color: 0xfff0b0 }],
    blocks: [
      { x: 60, y: 420, w: 110, h: 70, label: '🪣', color: 0x4a5b6b }, { x: 740, y: 420, w: 100, h: 70, label: '🧰', color: 0x4a5b6b },
      { x: 60, y: 560, w: 110, h: 70, label: '🪜', color: 0x5e6f7f },
    ],
    portals: [{ label: 'Exit ▾', x: 370, y: 650, w: 160, h: 50, to: 'harbor_village', spawn: { x: 450, y: 560 } }],
  },
  mountain_pass: {
    name: 'Mountain Pass', w: 1400, h: 1000, floor: 'stone', spawn: { x: 700, y: 860 },
    sky: 0x0d1c2b, fx: 'blizzard', aurora: true, stars: true, wash: [0xcdd8e2, 0.95],
    paths: [[590, 340, 220, 620]],
    activities: [{ id: 'cliff_climb', x: 180, y: 680 }],
    buildings: [
      { label: 'Ice Caves', icon: '🧊',       x: 140, y: 150, w: 240, h: 200, wall: 0x6f8a9c, roof: 0x3a4d5c, to: 'ice_caves' },
      { label: 'Old Observatory', icon: '🔭', x: 940, y: 130, w: 260, h: 230, wall: 0xd8c9a3, roof: 0x6a4fb3, to: 'observatory' },
    ],
    portals: [
      { label: 'Frozen Lake ▾', x: 590, y: 940, w: 220, h: 60, to: 'frozen_lake', spawn: { x: 700, y: 860 } },
      { label: 'Ski Base ▸',    x: 1340, y: 420, w: 60,  h: 220, to: 'ski_base',   spawn: { x: 160, y: 620 } },
    ],
    props: [
      { type: 'rock', x: 180, y: 560, r: 52 }, { type: 'rock', x: 300, y: 860, r: 44 }, { type: 'rock', x: 560, y: 260, r: 48 },
      { type: 'rock', x: 1240, y: 560, r: 50 }, { type: 'rock', x: 1120, y: 900, r: 46 }, { type: 'rock', x: 840, y: 620, r: 40 },
      { type: 'lamp', x: 480, y: 880 }, { type: 'lamp', x: 920, y: 880 },
      { type: 'glow', x: 1070, y: 360, r: 150, color: 0xb48cff },     // light from the observatory dome
    ],
    trees: [[70, 300], [60, 960], [1360, 240], [1340, 960]],
  },
  ice_caves: {
    name: 'Ice Caves', w: 1400, h: 900, floor: 'cave', indoor: true, wallColor: 0x24404f, spawn: { x: 700, y: 780 },
    sky: 0x0a1a24, fx: 'sparkle', vignette: true, wash: [0xbcd8e6, 0.9],
    activities: [{ id: 'crystal_echo', x: 860, y: 560 }],
    sign: 'ICE CAVES',
    props: [
      { type: 'crystal', x: 520, y: 620, s: 1 }, { type: 'crystal', x: 980, y: 420, s: 0.8 }, { type: 'crystal', x: 1260, y: 760, s: 1.2 },
      { type: 'rock', x: 420, y: 820, r: 46 }, { type: 'rock', x: 1120, y: 240, r: 52 },
      { type: 'glow', x: 520, y: 600, r: 130, color: 0x8f6fe0 }, { type: 'glow', x: 980, y: 400, r: 110, color: 0x66e8ff },
      { type: 'glow', x: 1260, y: 740, r: 140, color: 0x8f6fe0 },
    ],
    blocks: [{ x: 620, y: 180, w: 160, h: 70, label: '🧊', color: 0x4d7a8f }],
    portals: [
      { label: 'Exit ▾', x: 620, y: 840, w: 160, h: 50, to: 'mountain_pass', spawn: { x: 700, y: 780 } },
      // Opens only once the three glowing marks have been found (secret `hollow_crack`).
      { label: 'Crystal Hollow ◂', x: 60, y: 480, w: 90, h: 140, to: 'crystal_hollow', spawn: { x: 170, y: 550 }, secret: 'hollow_crack' },
    ],
  },
  crystal_hollow: {
    name: 'Crystal Hollow', w: 1000, h: 700, floor: 'cave', indoor: true, hidden: true, wallColor: 0x3b2f66,
    spawn: { x: 500, y: 560 }, sign: 'CRYSTAL HOLLOW',
    sky: 0x1a1133, fx: 'sparkle', vignette: true, wash: [0xd8c4ff, 0.92],
    props: [
      { type: 'crystal', x: 220, y: 520, s: 1.3 }, { type: 'crystal', x: 680, y: 300, s: 0.9 },
      { type: 'crystal', x: 880, y: 600, s: 1.1 }, { type: 'crystal', x: 360, y: 640, s: 0.7 },
      { type: 'glow', x: 220, y: 500, r: 160, color: 0xb48cff }, { type: 'glow', x: 680, y: 280, r: 150, color: 0x66e8ff },
      { type: 'glow', x: 880, y: 580, r: 150, color: 0xb48cff },
    ],
    portals: [{ label: 'Exit ▾', x: 420, y: 630, w: 160, h: 50, to: 'ice_caves', spawn: { x: 500, y: 560 } }],
  },
  observatory: {
    name: 'Old Observatory', w: 1100, h: 800, floor: 'wood', indoor: true, wallColor: 0x3c3470, spawn: { x: 550, y: 700 },
    sky: 0x161238, fx: 'dust', vignette: true, stars: true, wash: [0xd6cff0, 0.92],
    activities: [{ id: 'star_link', x: 760, y: 560 }],
    props: [{ type: 'glow', x: 550, y: 300, r: 220, color: 0x9aa7ff }],
    sign: 'OLD OBSERVATORY',
    blocks: [
      { x: 60, y: 660, w: 120, h: 70, label: '🪑', color: 0x6b4428 }, { x: 920, y: 660, w: 120, h: 70, label: '🕰️', color: 0x6b4428 },
    ],
    portals: [
      { label: 'Exit ▾', x: 470, y: 740, w: 160, h: 50, to: 'mountain_pass', spawn: { x: 550, y: 680 } },
      // Opens once both dials match the old chart (secret `star_alignment`).
      { label: 'Star Chamber ▸', x: 970, y: 200, w: 90, h: 140, to: 'star_chamber', spawn: { x: 880, y: 280 }, secret: 'star_alignment' },
    ],
  },
  star_chamber: {
    name: 'Star Chamber', w: 1000, h: 700, floor: 'stone', indoor: true, hidden: true, wallColor: 0x241f4d,
    spawn: { x: 500, y: 560 }, sign: 'STAR CHAMBER',
    sky: 0x0d0a26, fx: 'sparkle', vignette: true, stars: true, wash: [0xc9c2f5, 0.9],
    props: [{ type: 'glow', x: 500, y: 240, r: 240, color: 0xb48cff }, { type: 'glow', x: 740, y: 460, r: 120, color: 0x66e8ff }],
    blocks: [{ x: 60, y: 560, w: 120, h: 70, label: '📜', color: 0x4a3f7a }, { x: 820, y: 560, w: 120, h: 70, label: '🔭', color: 0x4a3f7a }],
    portals: [{ label: 'Exit ▾', x: 420, y: 630, w: 160, h: 50, to: 'observatory', spawn: { x: 500, y: 560 } }],
  },

  // ===================================================================
  // PHASE 12 — the ski area. Part of the world, not an arcade.
  //   Mountain Pass ⇄ Ski Base ──(lift)──▸ Summit ──▸ five sled routes
  //   Each route exits somewhere different, so sledding is genuine travel:
  //     Beginner ▸ Ski Base · Forest ▸ Deep Forest · Ridge ▸ Mountain Pass
  //     Extreme ▸ Frozen Lake · Hidden Valley ▸ Snow Camp 🔒
  // ===================================================================
  ski_base: {
    name: 'Anchor Peak Base', w: 1700, h: 1100, floor: 'snow', spawn: { x: 850, y: 900 },
    sky: 0x102840, fx: 'snow', stars: true, wash: [0xdce9f5, 0.95],
    paths: [[760, 240, 200, 820], [200, 700, 1300, 140]],
    // The lift: walk onto the platform, press E, ride the cable to the summit station.
    lift: {
      label: 'Summit Gondola', x: 860, y: 320, to: 'ski_summit', seconds: 8,
      towers: [[860, 330], [860, 150], [860, -40]],
    },
    buildings: [
      { label: 'Warming Hut', icon: '🔥', x: 240, y: 300, w: 240, h: 190, wall: 0xb5703f, roof: 0x7a3f22, to: 'ski_lodge' },
    ],
    portals: [
      { label: '◂ Mountain Pass', x: 0, y: 520, w: 60, h: 220, to: 'mountain_pass', spawn: { x: 1280, y: 520 } },
    ],
    props: [
      { type: 'peak', x: 300,  y: 150, w: 760, h: 440 },
      { type: 'peak', x: 1180, y: 110, w: 900, h: 520 },
      { type: 'rock', x: 1420, y: 760, r: 50 }, { type: 'rock', x: 180, y: 880, r: 42 },
      { type: 'fence', x: 520, y: 640, w: 300 }, { type: 'fence', x: 1120, y: 640, w: 300 },
      { type: 'lamp', x: 700, y: 840 }, { type: 'lamp', x: 1020, y: 840 },
      { type: 'snowman', x: 1320, y: 930 },
      { type: 'bush', x: 420, y: 980 }, { type: 'bush', x: 1200, y: 1020 },
    ],
    trees: [[90,420],[150,620],[1560,420],[1620,660],[80,1020],[1640,980],[420,520],[1300,520]],
  },

  // ===================================================================
  // PHASE 15 — the Town Hall. A long civic hall whose north wall is the players' picture wall: it is built in
  // bays of ten pictures and gains another bay (and real floor space) every time the tenth is hung, so it never
  // runs out of room. `gallery: true` is all the room needs; src/world/GalleryWall.js does the rest.
  // ===================================================================
  town_hall: {
    name: 'Town Hall', w: 1700, h: 820, floor: 'wood', indoor: true, gallery: true,
    wallColor: 0x6b5a46, spawn: { x: 250, y: 680 },
    sky: 0x2a2113, fx: 'dust', wash: [0xffeccd, 0.95],
    props: [{ type: 'glow', x: 260, y: 520, r: 190, color: 0xffc247 }],
    blocks: [
      { x: 60,  y: 620, w: 150, h: 70, label: '🪑', color: 0x6b4428 },
      { x: 300, y: 620, w: 150, h: 70, label: '🪑', color: 0x6b4428 },
      { x: 60,  y: 300, w: 120, h: 80, label: '🪴', color: 0x2a8a63 },
    ],
    portals: [{ label: 'Exit ▾', x: 170, y: 760, w: 160, h: 50, to: 'snowy_plaza', spawn: { x: 250, y: 680 } }],
  },

  ski_lodge: {
    name: 'Warming Hut', w: 900, h: 640, floor: 'wood', indoor: true, spawn: { x: 450, y: 520 },
    sky: 0x2a1d14, fx: 'dust', wash: [0xffe6c2, 0.9],
    props: [{ type: 'glow', x: 450, y: 380, r: 160, color: 0xffa63c }],
    blocks: [
      { x: 60, y: 200, w: 130, h: 70, label: '🔥 Fire', color: 0xb5703f },
      { x: 320, y: 220, w: 260, h: 60, label: '🛷 Sled Rack', color: 0x6b4428 },
      { x: 700, y: 200, w: 130, h: 70, label: '☕', color: 0x8c5a3a },
    ],
    portals: [{ label: 'Exit ▾', x: 370, y: 590, w: 160, h: 50, to: 'ski_base', spawn: { x: 450, y: 520 } }],
  },

  ski_summit: {
    name: 'Anchor Peak Summit', w: 1800, h: 1150, floor: 'snow', spawn: { x: 900, y: 940 },
    sky: 0x0a1d31, fx: 'blizzard', stars: true, aurora: true, wash: [0xd6e7f6, 0.95],
    paths: [[340, 520, 1120, 150]],
    portals: [
      { label: '🟢 Beginner Hill ▾', x: 180,  y: 240, w: 230, h: 80, to: 'slope_beginner', route: 'slope_beginner', grade: '🟢 Easy' },
      { label: '🌲 Forest Slope ▾',  x: 520,  y: 180, w: 230, h: 80, to: 'slope_forest', route: 'slope_forest', grade: '🔵 Medium' },
      { label: '🏔️ Mountain Ridge ▾', x: 860, y: 150, w: 230, h: 80, to: 'slope_ridge', route: 'slope_ridge', grade: '🔴 Hard' },
      { label: '⚫ Extreme Slope ▾', x: 1200, y: 180, w: 230, h: 80, to: 'slope_extreme', route: 'slope_extreme', grade: '⚫ Expert' },
      { label: '❄️ Hidden Valley ▾', x: 1520, y: 260, w: 220, h: 80, to: 'slope_hidden', route: 'slope_hidden', grade: '❄️ Secret', secret: 'buried_cache' },
      { label: 'Gondola Down ▾',    x: 820,  y: 1090, w: 200, h: 60, to: 'ski_base', spawn: { x: 860, y: 420 } },
    ],
    props: [
      { type: 'peak', x: 220,  y: 60,  w: 820,  h: 400 },
      { type: 'peak', x: 1320, y: 20,  w: 980,  h: 480 },
      { type: 'tower', x: 900, y: 1010 },
      { type: 'sign', x: 900, y: 700, label: 'PICK YOUR ROUTE' },
      { type: 'fence', x: 380, y: 420, w: 320 }, { type: 'fence', x: 1260, y: 420, w: 320 },
      { type: 'rock', x: 140, y: 820, r: 54 }, { type: 'rock', x: 1680, y: 860, r: 50 },
      { type: 'lamp', x: 740, y: 900 }, { type: 'lamp', x: 1060, y: 900 },
    ],
    trees: [[60,620],[1740,640],[120,1080],[1700,1080]],
  },

  slope_beginner: slopeRoom('slope_beginner', 'Beginner Hill', { wash: [0xe6f4ff, 0.95] }),
  slope_forest:   slopeRoom('slope_forest',   'Forest Slope',   { sky: 0x0d2622, wash: [0xd3e8dd, 0.95] }),
  slope_ridge:    slopeRoom('slope_ridge',    'Mountain Ridge', { sky: 0x0b1f33, aurora: true, wash: [0xd8e7f6, 0.95] }),
  slope_extreme:  slopeRoom('slope_extreme',  'Extreme Slope',  { sky: 0x07131f, fx: 'blizzard', wash: [0xcddced, 0.95] }),
  slope_hidden:   slopeRoom('slope_hidden',   'Hidden Snow Valley', { sky: 0x101a33, hidden: true, wash: [0xdedcf6, 0.95] }),

};
