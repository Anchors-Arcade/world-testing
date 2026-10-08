import { ROOMS } from '../maps/rooms.js';
import { WORLD_MAP } from '../world/worldMap.js';
import { esc } from './dom.js';

// World map drawer: pick a place and walk there. Shows how many of your friends are in each room (from the shared
// presence data, no extra subscriptions).
// Phase 8: it lists every world location from src/world/worldMap.js with its activities, whether you have been there
// and how much of its exploration is done. Secret rooms are NOT listed until their secret has been discovered —
// the panel only ever shows what ExplorationState has been told, and the server never sends an unfound secret.
export function createMapPanel(root, { game, profile, social, explore, closeOthers }) {
  const el = document.createElement('aside');
  el.className = 'drawer'; el.hidden = true; root.appendChild(el);
  let here = 'snowy_plaza';

  function row(p) {
    const r = ROOMS[p.key];
    if (!r) return '';
    const isHere = p.key === here, friends = social.friendsIn(p.key);
    const seen = explore ? explore.isVisited(p.key) : true;
    const g = explore ? explore.progressIn(p.key) : { items: 0, itemsDone: 0, secrets: 0, secretsDone: 0 };
    const complete = g.items && g.itemsDone === g.items && g.secretsDone === g.secrets;
    const bits = [];
    if (isHere) bits.push('You are here');
    else if (!seen) bits.push('Not visited yet');
    if (g.items) bits.push(`⭐ ${g.itemsDone}/${g.items}`);
    if (g.secrets) bits.push(`🔎 ${g.secretsDone}/${g.secrets}`);
    if (friends) bits.push(`🟢 ${friends} friend${friends > 1 ? 's' : ''}`);
    return `<button class="place ${isHere ? 'here' : ''} ${seen ? '' : 'fresh'} ${complete ? 'done' : ''}" data-go="${p.key}" ${isHere ? 'disabled' : ''}>
      <span class="pi">${p.icon}</span>
      <span class="nm"><b>${esc(r.name)}${complete ? ' ✓' : ''}${p.hidden ? ' 🔒' : ''}</b>
        <small>${esc(p.blurb)}</small>
        <small class="mp-meta">${bits.map(esc).join(' · ')}</small>
        ${p.activities?.length ? `<span class="mp-tags">${p.activities.map((a) => `<i>${esc(a)}</i>`).join('')}</span>` : ''}
      </span></button>`;
  }

  function render() {
    if (el.hidden) return;
    // A hidden place is listed only once its secret has opened it (guests included: their unlocks are local).
    const places = WORLD_MAP.filter((p) => ROOMS[p.key] && (!p.hidden || explore?.isRoomUnlocked(p.key)));
    const c = explore?.counts();
    el.innerHTML = `<header><h2>World Map</h2><button class="x" data-go="" aria-label="Close">✕</button></header>
      <div class="body">
        ${c ? `<div class="jr-sum small"><b>${c.collected}/${c.collectibles} ⭐ · ${c.found}/${c.secrets} 🔎 · ${c.badges}/${c.badgeTotal} 🏅</b>
          <small>${explore.visited.size} place${explore.visited.size === 1 ? '' : 's'} visited</small></div>` : ''}
        ${places.map(row).join('')}
        <button class="place" data-go="home"><span class="pi">🏠</span><span class="nm"><b>My Room</b><small>Your own space</small></span></button>
      </div>
      <footer>Walk the paths and doors to find places that are not on this list yet.</footer>`;
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]'); if (!b || b.disabled) return;
    const k = b.dataset.go; close();
    if (k) game.events.emit('join-room', k === 'home' ? { room: 'home', ownerId: profile.id } : { room: k });
  });
  const onRoom = (id) => { here = id; render(); };
  game.events.on('room-entered', onRoom);
  const off = social.on((ev) => ev.type === 'presence' && render());
  const offEx = explore ? explore.on(() => render()) : () => {};
  const close = () => { el.hidden = true; };
  const onEsc = (e) => e.key === 'Escape' && close();
  addEventListener('keydown', onEsc);

  return {
    open() { closeOthers?.(); el.hidden = false; render(); },
    toggle() { el.hidden ? this.open() : close(); }, close, isOpen: () => !el.hidden,
    destroy() { off(); offEx(); removeEventListener('keydown', onEsc); game.events.off('room-entered', onRoom); el.remove(); },
  };
}
