import * as db from '../database/social.js';
import { esc } from './dom.js';
import { toast } from './hud.js';

const TOGGLES = [
  ['allow_friend_requests', 'Friend requests', 'Let other players send me friend requests'],
  ['allow_friend_joins', 'Friends can join me', 'Friends see which room I am in and can join me there'],
  ['allow_room_visits', 'Room visits', 'Let others visit my room (my room\'s visibility still applies)'],
  ['allow_messages', 'Typed chat', 'Off = quick-chat buttons only, both ways'],
];

// Settings drawer: the privacy foundation (4 switches, enforced server-side where the server can) + blocked / muted lists.
export function createSettings(root, { game, profile, social, closeOthers }) {
  const el = document.createElement('aside');
  el.className = 'drawer'; el.hidden = true; root.appendChild(el);
  let busy = false;

  function render() {
    if (el.hidden) return;
    const s = social.settings;
    const list = (arr, act, label) => arr.length ? arr.map((p) => `<div class="fr slim"><span class="nm"><b>${esc(p.display_name)}</b><small>@${esc(p.username)}</small></span>
      <button class="sbtn mini ghost" data-act="${act}" data-id="${esc(p.id)}">${label}</button></div>`).join('') : `<p class="empty sm">Nobody.</p>`;
    el.innerHTML = `<header><h2>Settings</h2><button class="x" data-act="close" aria-label="Close">✕</button></header>
      <div class="body">${profile.guest ? `<p class="empty">Guests have no saved settings. Create an account to manage privacy, friends and blocks.</p>` : `
        <h3>Privacy</h3>
        ${TOGGLES.map(([k, t, d]) => `<label class="sw-row"><span><b>${t}</b><small>${esc(d)}</small></span><input type="checkbox" role="switch" data-key="${k}" ${s[k] ? 'checked' : ''}></label>`).join('')}
        <h3>Blocked players</h3>${list(social.blocked, 'unblock', 'Unblock')}
        <h3>Muted players</h3>${list(social.muted, 'unmute', 'Unmute')}`}</div>
      <footer>Tip: tap a player in the world to mute, block or report them.</footer>`;
  }

  el.addEventListener('change', async (e) => {
    const k = e.target.dataset.key; if (!k || busy) return;
    busy = true;
    try { await social.setSetting({ [k]: e.target.checked }); }
    catch (err) { toast(err.message); e.target.checked = !e.target.checked; }
    busy = false;
  });
  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    if (t.dataset.act === 'close') return close();
    if (busy) return; busy = true;
    try { await (t.dataset.act === 'unblock' ? db.unblockPlayer : db.unmutePlayer)(t.dataset.id); await social.refresh(); }
    catch (err) { toast(err.message); }
    busy = false;
  });
  const off = social.on((ev) => ev.type === 'changed' && render());
  const close = () => { el.hidden = true; };
  const onEsc = (e) => e.key === 'Escape' && close();
  addEventListener('keydown', onEsc);

  return {
    open() { closeOthers?.(); el.hidden = false; if (!profile.guest) social.refresh().catch(() => {}); render(); },
    toggle() { el.hidden ? this.open() : close(); }, close, isOpen: () => !el.hidden,
    destroy() { off(); removeEventListener('keydown', onEsc); el.remove(); },
  };
}
