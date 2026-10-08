// Display metadata for every minigame. The SERVER owns the real rules (score limits, reward tiers, daily cap): see the
// `minigames` table in supabase/phase7.sql. Numbers here are only used for offline / guest fallbacks and for labels.
// To add a game: 1) add a row to `minigames` in SQL, 2) add an entry here, 3) write a scene that extends MinigameScene,
// 4) register the scene class in minigames/index.js. Nothing else changes.
export const GAMES = {
  snow_dash: {
    id: 'snow_dash', scene: 'SnowDash', name: 'Snow Dash', emoji: '🏁', icon: '❄️',
    tagline: 'Race through a snowy obstacle course.',
    description: 'Slide downhill on your sled and dodge trees, rocks and snowmen. Hit the boost pads and reach the finish line as fast as you can!',
    controls: '← → / A D to steer · or hold & drag',
    colors: { a: '#5bb6e8', b: '#2a6fa0' }, scoreLabel: 'Score', fallbackReward: 125, rewardMinMs: 12000,
  },
  coin_catcher: {
    id: 'coin_catcher', scene: 'CoinCatcher', name: 'Coin Catcher', emoji: '🪙', icon: '🪙',
    tagline: 'Catch falling treasure and avoid hazards.',
    description: 'Catch coins and gems in your basket to build a combo. Dodge the spiky ice bombs and icicles. 45 seconds on the clock!',
    controls: '← → / A D to move · or move your mouse / finger',
    colors: { a: '#ffc247', b: '#b8750f' }, scoreLabel: 'Score', fallbackReward: 110, rewardMinMs: 20000,
  },
  snowball_arena: {
    id: 'snowball_arena', scene: 'SnowballArena', name: 'Snowball Arena', emoji: '☃️', icon: '☃️',
    tagline: 'Hit the targets with snowballs.',
    description: 'Aim, throw and keep your streak alive. Snowmen, bullseyes and golden snowmen score big. Careful: don’t hit the friendly penguins!',
    controls: 'Aim with the mouse / finger · click or tap to throw · A D to move',
    colors: { a: '#ff7a8a', b: '#b8334a' }, scoreLabel: 'Score', fallbackReward: 110, rewardMinMs: 20000,
  },

  slope_sled: {
    id: 'slope_sled', scene: 'SledRun', name: 'Slope Sled Run', emoji: '🛷', icon: '🏔️',
    tagline: 'Ski lift up, sled down the mountain.',
    description: 'Ride the ski lift to the summit, then race down the hill on your sled. Steer between lanes, launch off snow ramps, grab coins and gems, and dodge rocks, pines and snowmen!',
    controls: '↑ ↓ change lane · SPACE jump · → tuck (faster) · ← brake · or swipe up/down & tap',
    colors: { a: '#7cc4f2', b: '#2a5c8f' }, scoreLabel: 'Score', fallbackReward: 110, rewardMinMs: 20000,
  },
  snow_runner: {
    id: 'snow_runner', scene: 'SnowRunner', name: 'Snow Runner', emoji: '🏃', icon: '❄️',
    tagline: 'Run forever. Faster every second.',
    description: 'Sprint down the icy causeway between the peaks. Switch lanes, jump the ice barriers, dodge crates and snowmen and collect coins. You get two hits — then the run is over. How far can you go?',
    controls: '← → change lane · ↑ / SPACE jump · or swipe & tap',
    colors: { a: '#8ff0b3', b: '#1d4f7a' }, scoreLabel: 'Score', fallbackReward: 110, rewardMinMs: 20000,
  },

  // ---- Phase 10: world activities. `world: true` means it is launched from an object out in the world and
  // returns you there afterwards instead of opening the Arcade. `room` is where its object stands.
  firefly_catch: {
    id: 'firefly_catch', scene: 'FireflyCatch', name: 'Firefly Catch', emoji: '✨', icon: '✨', world: true, room: 'deep_forest',
    tagline: 'Catch the snow sprites between the pines.',
    description: 'Glowing sprites drift through the Deep Forest. Tap them to catch them and build a streak — but the angry red ones cost you points.',
    controls: 'Click or tap the sprites',
    colors: { a: '#8ff0b3', b: '#1f6b4f' }, scoreLabel: 'Score', fallbackReward: 110, rewardMinMs: 20000,
  },
  cocoa_rush: {
    id: 'cocoa_rush', scene: 'CocoaRush', name: 'Cocoa Rush', emoji: '☕', icon: '☕', world: true, room: 'snow_camp',
    tagline: 'Serve the camp before the kettle runs dry.',
    description: 'Orders come in as a row of ingredients. Add them in the right order — a cup with no mistakes is worth extra.',
    controls: '1–4 keys · or tap the ingredients',
    colors: { a: '#e9a23b', b: '#6b4428' }, scoreLabel: 'Score', fallbackReward: 110, rewardMinMs: 20000,
  },
  ice_fishing: {
    id: 'ice_fishing', scene: 'IceFishing', name: 'Ice Fishing', emoji: '🎣', icon: '🎣', world: true, room: 'frozen_lake',
    tagline: 'Time the bite through a hole in the ice.',
    description: 'A marker sweeps across the bar. Strike while it is inside the green and the fish is yours. Every catch shrinks the green and speeds the marker up.',
    controls: 'SPACE · or click / tap',
    colors: { a: '#5bb6e8', b: '#0c2a44' }, scoreLabel: 'Score', fallbackReward: 110, rewardMinMs: 20000,
  },
  crate_stack: {
    id: 'crate_stack', scene: 'CrateStack', name: 'Crate Stack', emoji: '📦', icon: '📦', world: true, room: 'harbor_village',
    tagline: 'Stack the harbour cargo as high as you dare.',
    description: 'A crate swings above the stack. Drop it as squarely as you can — whatever hangs over the edge falls in the water, and the next crate is that much narrower.',
    controls: 'SPACE · or click / tap to drop',
    colors: { a: '#e9a23b', b: '#8a6240' }, scoreLabel: 'Score', fallbackReward: 110, rewardMinMs: 20000,
  },
  cliff_climb: {
    id: 'cliff_climb', scene: 'CliffClimb', name: 'Cliff Climb', emoji: '⛰️', icon: '⛰️', world: true, room: 'mountain_pass',
    tagline: 'Up the pass wall, with the mountain throwing rocks.',
    description: 'You climb on your own; the rocks come down on their own. Dodge them for as long as you can — the higher you get, the faster everything falls.',
    controls: '← → / A D · or drag',
    colors: { a: '#9aa7b8', b: '#3a4d5c' }, scoreLabel: 'Metres', fallbackReward: 110, rewardMinMs: 20000,
  },
  crystal_echo: {
    id: 'crystal_echo', scene: 'CrystalEcho', name: 'Crystal Echo', emoji: '💎', icon: '💎', world: true, room: 'ice_caves',
    tagline: 'The cave sings. Sing it back.',
    description: 'Four crystals light up in a pattern that grows by one every round. Repeat it. Three mistakes and the cave goes quiet.',
    controls: 'Click or tap the crystals',
    colors: { a: '#b48cff', b: '#2c4a5c' }, scoreLabel: 'Score', fallbackReward: 110, rewardMinMs: 20000,
    echo: { top: 0x0a1a24, bottom: 0x1d4457, radius: 52, icon: '💎', hint: 'Watch the pattern, then repeat it',
      spots: [[230, 300, 0x66e8ff], [400, 380, 0x8ff0b3], [570, 380, 0xffc247], [740, 300, 0xb48cff]] },
  },
  star_link: {
    id: 'star_link', scene: 'StarLink', name: 'Star Link', emoji: '🌟', icon: '🌟', world: true, room: 'observatory',
    tagline: 'Trace the constellation the sky shows you.',
    description: 'Six stars flash in order — the older the chart, the longer the line. Trace it back exactly. Three mistakes and the dome closes.',
    controls: 'Click or tap the stars',
    colors: { a: '#ffd977', b: '#241f4d' }, scoreLabel: 'Score', fallbackReward: 110, rewardMinMs: 20000,
    echo: { top: 0x0d0a26, bottom: 0x2c2560, radius: 42, icon: '⭐', hint: 'Watch the constellation, then trace it back',
      spots: [[200, 250, 0xffd977], [360, 170, 0x9fe3ff], [520, 250, 0xffd977], [660, 170, 0xb48cff], [760, 330, 0x9fe3ff], [330, 360, 0xffc247]] },
  },
};
export const GAME_LIST = Object.values(GAMES);
// The Arcade screen only lists the arcade cabinets; world activities live out in the world.
export const ARCADE_GAMES = GAME_LIST.filter((g) => !g.world);
export const WORLD_GAMES = GAME_LIST.filter((g) => g.world);
export const gamesInRoom = (roomId) => WORLD_GAMES.filter((g) => g.room === roomId);
export const DEFAULT_GAME = 'snow_dash';
