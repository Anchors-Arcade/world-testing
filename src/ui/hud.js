// [icon, label, key]. Every dock button is live as of Phase 8.
const BUTTONS = [
  ['🗺️', 'Map', 'map'], ['📒', 'Journal', 'journal'], ['🎒', 'Wardrobe', 'wardrobe'], ['🧥', 'Look', 'avatar'], ['🏠', 'My Room', 'home'], ['👥', 'Friends', 'friends'],
  ['💬', 'Chat', 'chat'], ['😄', 'Emotes', 'emotes'], ['🛍️', 'Shop', 'shop'], ['⚙️', 'Settings', 'settings'], ['⛶', 'Full', 'fullscreen'], ['🚪', 'Log out', 'logout'],
];

// ---------------------------------------------------------------------
// Phase 10 — fullscreen that works on every screen.
// Desktop and Android use the Fullscreen API on the whole document. iPhone Safari does not allow it on a normal
// element, so there the button tells the player how to get the same result (Add to Home Screen), and the layout
// already fills the visible area by itself: the CSS uses dvh units and safe-area insets, so the HUD never ends up
// under the notch, the home bar or the browser's own toolbars.
export const fsSupported = () => !!(document.fullscreenEnabled || document.webkitFullscreenEnabled ||
  document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

export async function toggleFullscreen() {
  const el = document.documentElement;
  try {
    if (isFullscreen()) {
      await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
      return true;
    }
    const req = el.requestFullscreen?.bind(el) ?? el.webkitRequestFullscreen?.bind(el);
    if (!req) return false;
    await req({ navigationUI: 'hide' });
    // lock to landscape where the browser allows it (phones); harmless everywhere else
    try { await screen.orientation?.lock?.('landscape'); } catch { /* not allowed on this device */ }
    return true;
  } catch { return false; }
}

// Phase 17: picking something up used to use the full-size toast, which covered a chunk of the screen for a
// snowflake worth 15 coins. Pickups now get their own small chip that stacks in the corner and fades quickly.
export function pickup(text, coins = 0) {
  const ui = document.getElementById('ui');
  let rack = ui.querySelector('.pickups');
  if (!rack) { rack = document.createElement('div'); rack.className = 'pickups'; ui.appendChild(rack); }
  const p = document.createElement('div');
  p.className = 'pickup';
  p.innerHTML = `<b></b>${coins ? `<i>+${coins} ⚓</i>` : ''}`;
  p.querySelector('b').textContent = text;
  rack.appendChild(p);
  while (rack.children.length > 4) rack.firstChild.remove();
  setTimeout(() => p.classList.add('go'), 1700);
  setTimeout(() => p.remove(), 2200);
}

export function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.getElementById('ui').appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

export function mountHUD(root, profile, { onAction }) {
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="hud-top">
      <div class="pill who"><span class="pav">🐧</span><span class="pwho"><b id="hn"></b><small id="hl">Snowy Plaza</small></span></div>
      <div class="pill coins" title="Anchor Coins"><span class="coin">⚓</span><span id="hc">0</span></div>
      <button class="pill gift" id="hd" title="Daily reward">🎁 Daily</button>
      <button class="pill gift deco" id="hb" title="Decorate your room" hidden>🛠️ Decorate</button>
      <div class="pill"><small id="hp2">👥 1 here</small></div>
    </div>
    <div class="prompt" id="hp"></div>
    <nav class="dock">${BUTTONS.map(([i, l, k]) => `<button data-key="${k}"><span>${i}</span>${l}</button>`).join('')}</nav>`;
  root.appendChild(el);
  const q = (s) => el.querySelector(s);
  q('#hn').textContent = profile.display_name;
  const setCoins = (n) => (q('#hc').textContent = n.toLocaleString());
  setCoins(profile.coins);

  q('#hd').onclick = () => onAction('daily');
  q('#hb').onclick = () => onAction('decorate');
  el.querySelectorAll('.dock button').forEach((b, i) => (b.onclick = () => {
    const key = BUTTONS[i][2];
    if (key === 'logout') { if (confirm(profile.guest ? 'Leave the guest session?' : 'Log out?')) onAction('logout'); }
    else onAction(key);
  }));

  // keep the dock button in step with the real fullscreen state (Esc, F11, the system gesture…)
  const fsBtn = el.querySelector('.dock button[data-key="fullscreen"]');
  const syncFs = () => { if (fsBtn) { fsBtn.classList.toggle('on', isFullscreen()); fsBtn.querySelector('span').textContent = isFullscreen() ? '⛷' : '⛶'; } };
  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('webkitfullscreenchange', syncFs);
  syncFs();

  return {
    setCoins,
    // highlight the dock button whose panel is open
    setOn: (key, on) => el.querySelector(`.dock button[data-key="${key}"]`)?.classList.toggle('on', !!on),
    // small red counter on a dock button (friend requests, unread chat); 0 hides it
    setBadge: (key, n) => {
      const b = el.querySelector(`.dock button[data-key="${key}"]`); if (!b) return;
      let i = b.querySelector('.badge');
      if (!n) return i?.remove();
      if (!i) { i = document.createElement('i'); i.className = 'badge'; b.appendChild(i); }
      i.textContent = n > 9 ? '9+' : n;
    },
    setLocation: (t) => (q('#hl').textContent = t),
    setDecorate: (on) => { q('#hb').hidden = !on; },
    setPlayers: (n) => (q('#hp2').textContent = `👥 ${n} here`),
    setPrompt: (t) => { const p = q('#hp'); p.textContent = t || ''; p.classList.toggle('on', !!t); },
    syncFs,
    destroy: () => { document.removeEventListener('fullscreenchange', syncFs); document.removeEventListener('webkitfullscreenchange', syncFs); el.remove(); },
  };
}
