import { SnowDash } from './SnowDash.js';
import { CoinCatcher } from './CoinCatcher.js';
import { SnowballArena } from './SnowballArena.js';
import { SledRun } from './SledRun.js';
import { SnowRunner } from './SnowRunner.js';
import { WORLD_GAME_SCENES } from './worldGames.js';
export { GAMES, GAME_LIST, ARCADE_GAMES, WORLD_GAMES, gamesInRoom, DEFAULT_GAME } from './registry.js';
export { MinigameManager } from './MinigameManager.js';

// Register a new game's scene class here (and in registry.js + the `minigames` SQL table).
export const MINIGAME_SCENES = [SnowDash, CoinCatcher, SnowballArena, SledRun, SnowRunner, ...WORLD_GAME_SCENES];
