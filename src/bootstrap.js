// Most gameplay modules use Phaser's global namespace. Set it before importing
// them so Phaser itself can be bundled locally instead of fetched from a CDN.
import Phaser from 'phaser';

globalThis.Phaser = Phaser;

import('./main.js').catch((error) => {
  console.error('Anchors World failed to start:', error);
  const ui = document.getElementById('ui');
  if (ui) {
    const message = document.createElement('pre');
    message.className = 'startup-error';
    message.textContent = `The game could not start. Reload the page or check the browser console.\n${error?.message || error}`;
    ui.appendChild(message);
  }
});
