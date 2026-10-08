import { GAMES } from './registry.js';
import { fetchOverview } from './scoreSystem.js';

// The bridge between the social world and a minigame. It does NOT touch the network layer:
//  * the Room scene is PAUSED and hidden (not stopped), so its Realtime presence channel, the social channel and chat stay
//    exactly as they were: no resubscribing, no duplicate channels, no "left the room / joined the room" flicker;
//  * ui-lock stops walking, door prompts and clicks in the world while the game runs;
//  * on exit the Room scene simply resumes, with the player standing exactly where they left.
// Events (on game.events): 'minigame-start' (id), 'minigame-end' ({id, tab, game}) -> main.js hides/restores the DOM HUD and reopens the Arcade.
export class MinigameManager {
  constructor(game) { this.game = game; this.active = null; this.room = null; }

  get isActive() { return !!this.active; }

  start(id) {
    const def = GAMES[id], room = this.game.scene.getScene('Room');
    if (!def || this.active || !room || !room.scene.isActive() || room.leaving || room.editing) return false;
    this.active = id; this.room = room;
    this.game.events.emit('ui-lock', true);                   // no walking / door prompts / world clicks
    this.game.events.emit('door-prompt', '');
    this.game.events.emit('minigame-start', id);
    room.scene.pause().setVisible(false);                     // freeze + stop drawing the world (networking keeps running)
    this.game.scene.run(def.scene, { manager: this });
    fetchOverview().catch(() => {});                          // warm the best-score cache (one request, outside the game loop)
    return true;
  }

  exit({ tab = 'games', game = null } = {}) {
    const id = this.active; if (!id) return;
    this.active = null;
    this.game.scene.stop(GAMES[id].scene);
    this.room = null;
    const room = this.game.scene.getScene('Room');             // look it up again: it is null if the game was torn down meanwhile
    if (room) { room.scene.setVisible(true); if (room.scene.isPaused()) room.scene.resume(); }
    this.game.events.emit('ui-lock', false);
    this.game.events.emit('minigame-end', { id, tab, game, world: !!GAMES[id]?.world });
  }

  destroy() {                                                 // logout while a game is open
    if (this.active) { try { this.game.scene.stop(GAMES[this.active].scene); } catch { /* scene already gone */ } }
    this.active = null; this.room = null;
  }
}
