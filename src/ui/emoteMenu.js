import { EMOTES } from '../social/emotes.js';

// Radial emote wheel. Open with the 😄 button or Q; tap an emote, or press 1-8 any time (no menu needed).
// The wheel only emits 'emote' on game.events: the scene plays it and broadcasts it (RemotePlayers.myEmote).
export function createEmoteMenu(root, { game }) {
  const el = document.createElement('div');
  el.className = 'emote-wheel'; el.hidden = true; root.appendChild(el);
  const R = 92;
  el.innerHTML = `<div class="ew-ring">${EMOTES.map((e, i) => {
    const a = -Math.PI / 2 + (i / EMOTES.length) * Math.PI * 2;
    return `<button data-e="${e.key}" style="--x:${(Math.cos(a) * R).toFixed(1)}px;--y:${(Math.sin(a) * R).toFixed(1)}px" aria-label="${e.label}" title="${e.label} (${i + 1})">
      <span class="ei">${e.icon}</span><small>${e.label}</small><kbd>${i + 1}</kbd></button>`;
  }).join('')}<button class="ew-mid" data-e="" aria-label="Close emotes">✕</button></div>`;
  let locked = false;

  const open = () => { if (!locked) el.hidden = false; };
  const close = () => { el.hidden = true; };
  const play = (key) => { if (!key || locked) return; game.events.emit('emote', key); };

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-e]');
    if (b) { play(b.dataset.e); close(); } else if (e.target === el) close();      // tap the dim backdrop to dismiss
  });
  const onKey = (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'Escape' && !el.hidden) return close();
    if (e.key === 'q' || e.key === 'Q') return el.hidden ? open() : close();
    const n = /^[1-8]$/.test(e.key) ? Number(e.key) - 1 : -1;
    if (n >= 0 && !locked && !document.body.classList.contains('shop-open')) play(EMOTES[n].key);     // Phase 7: also silent while the Arcade / a minigame has the screen
  };
  addEventListener('keydown', onKey);
  const onLock = (v) => { locked = v; if (v) close(); };
  game.events.on('ui-lock', onLock); game.events.on('edit-mode', onLock);

  return {
    toggle: () => (el.hidden ? open() : close()), close, play,
    destroy() { removeEventListener('keydown', onKey); game.events.off('ui-lock', onLock); game.events.off('edit-mode', onLock); el.remove(); },
  };
}
