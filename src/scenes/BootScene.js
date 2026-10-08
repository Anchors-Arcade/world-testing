import { makeTextures } from '../utils/textures.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    makeTextures(this);
    const profile = this.registry.get('profile');
    // Always enter the room. The new-player flow (wardrobe "look" screen + tutorial choice dialog)
    // is handled in main.js once 'room-entered' fires — there is no separate 'NewPlayerExperience'
    // scene registered with Phaser, so starting it here just silently failed ("Scene not found for
    // key: NewPlayerExperience") and the game never left the loading screen.
    this.scene.start('Room', { roomId: profile.current_room });
  }
}
