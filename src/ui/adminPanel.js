import { esc, fmtDate } from './dom.js';
import { toast } from './hud.js';
import * as api from '../database/admin.js';
import { ITEMS } from '../shops/items.js';
import { FURNITURE } from '../shops/furniture.js';

// =====================================================================
// PHASE 17 — the admin panel, opened with P.
//
// This is a VIEW, nothing more. It is drawn only when the server says the signed-in account's role is admin or
// moderator, and every button calls an RPC that checks the role again on the server. Hiding the panel is a
// convenience; the database is what actually stops anyone else.
//
//   admin      everything
//   moderator  search, inspect, ban, kick, timeout, announce  (no coins, items or roles)
// =====================================================================
const DURATIONS = [['5 min', 5], ['30 min', 30], ['2 hours', 120], ['1 day', 1440], ['7 days', 10080], ['Permanent', null]];
const MUTES = [['5 min', 5], ['15 min', 15], ['1 hour', 60], ['8 hours', 480], ['1 day', 1440], ['Clear', 0]];
const ALL_ITEMS = [...ITEMS.filter((i) => !i.secret), ...FURNITURE];

export function createAdminPanel(root, { game, profile }) {
  let el = null, role = 'user', tab = 'players', rows = [], sel = null, q = '', busy = false, note = '', noteErr = false;

  const can = (what) => (what === 'admin' ? role === 'admin' : role === 'admin' || role === 'moderator');

  // ---------- rendering ----------
  const until = (t) => (!t ? null : new Date(t).getFullYear() > 9000 ? 'permanent' : new Date(t).toLocaleString());

  function playerRow(p) {
    const banned = p.banned_until && (new Date(p.banned_until) > new Date() || new Date(p.banned_until).getFullYear() > 9000);
    const muted = p.muted_until && new Date(p.muted_until) > new Date();
    return `<button class="ad-row ${sel?.id === p.id ? 'on' : ''}" data-pick="${esc(p.id)}">
      <span class="ad-name"><b>${esc(p.display_name || p.username)}</b><small>@${esc(p.username)}</small></span>
      <span class="ad-tags">
        ${p.role !== 'user' ? `<i class="r-${esc(p.role)}">${esc(p.role)}</i>` : ''}
        ${banned ? '<i class="r-ban">banned</i>' : ''}${muted ? '<i class="r-mute">muted</i>' : ''}
        <i class="r-coin">⚓ ${(p.coins ?? 0).toLocaleString()}</i>
      </span></button>`;
  }

  function detail() {
    if (!sel) return '<p class="ad-empty">Pick a player to manage them.</p>';
    const banned = until(sel.banned_until), muted = until(sel.muted_until);
    return `<div class="ad-detail">
      <h3>${esc(sel.display_name || sel.username)} <small>@${esc(sel.username)}</small></h3>
      <div class="ad-stats">
        <span>⚓ <b>${(sel.coins ?? 0).toLocaleString()}</b></span>
        <span>🎒 <b>${sel.items ?? 0}</b></span>
        <span>👥 <b>${sel.friends ?? 0}</b></span>
        <span>🕹️ <b>${(sel.arcade ?? 0).toLocaleString()}</b></span>
        <span>📍 <b>${esc(sel.current_room || '—')}</b></span>
        <span>📅 <b>${sel.created_at ? fmtDate(sel.created_at) : '—'}</b></span>
      </div>
      ${banned ? `<p class="ad-flag ban">Banned ${banned}${sel.ban_reason ? ` — ${esc(sel.ban_reason)}` : ''}</p>` : ''}
      ${muted ? `<p class="ad-flag mute">Timed out until ${muted}${sel.mute_reason ? ` — ${esc(sel.mute_reason)}` : ''}</p>` : ''}

      <h4>Moderation</h4>
      <div class="ad-grid">
        <button class="ad-btn warn" data-act="kick">👢 Kick from the world</button>
        ${banned ? '<button class="ad-btn ok" data-act="unban">✅ Unban</button>'
                 : `<select data-sel="bandur">${DURATIONS.map(([l, m]) => `<option value="${m === null ? '' : m}">Ban: ${l}</option>`).join('')}</select>
                    <button class="ad-btn danger" data-act="ban">🔨 Ban</button>`}
        <select data-sel="mutedur">${MUTES.map(([l, m]) => `<option value="${m}">Timeout: ${l}</option>`).join('')}</select>
        <button class="ad-btn warn" data-act="timeout">🤐 Apply timeout</button>
      </div>
      <input class="ad-input" data-in="reason" placeholder="Reason (optional, shown in the log)" maxlength="200">

      ${can('admin') ? `
      <h4>Give</h4>
      <div class="ad-grid">
        <input class="ad-input" data-in="coins" type="number" placeholder="Coins (+/-)" value="100">
        <button class="ad-btn" data-act="coins-add">⚓ Add</button>
        <button class="ad-btn" data-act="coins-set">⚓ Set to</button>
      </div>
      <div class="ad-grid">
        <select data-sel="item">
          <optgroup label="Clothing">${ALL_ITEMS.filter((i) => i.kind !== 'furniture').map((i) => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</optgroup>
          <optgroup label="Furniture">${ALL_ITEMS.filter((i) => i.kind === 'furniture').map((i) => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('')}</optgroup>
        </select>
        <button class="ad-btn" data-act="item">🎁 Give item</button>
      </div>

      <h4>Role</h4>
      <div class="ad-grid">
        <select data-sel="role">${['user', 'moderator', 'admin'].map((r) => `<option value="${r}" ${sel.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        <button class="ad-btn" data-act="role">🛡️ Set role</button>
      </div>` : ''}

      ${sel.history?.length ? `<h4>Recent actions</h4><ul class="ad-log">${sel.history.map((h) =>
        `<li><b>${esc(h.kind)}</b> ${esc(h.detail || '')} <small>${new Date(h.at).toLocaleString()}</small></li>`).join('')}</ul>` : ''}
    </div>`;
  }

  function render() {
    if (!el) return;
    const body = tab === 'players'
      ? `<div class="ad-split">
           <div class="ad-list">
             <div class="ad-search"><input data-in="q" placeholder="Search players…" value="${esc(q)}"><button class="ad-btn" data-act="search">🔎</button><button class="ad-btn" data-act="refresh" title="Refresh">↻</button></div>
             ${rows.length ? rows.map(playerRow).join('') : '<p class="ad-empty">No players found.</p>'}
           </div>
           <div class="ad-pane">${detail()}</div>
         </div>`
      : `<div class="ad-pane">
           <h4>Announcement</h4>
           <p class="ad-hint">Every signed-in player sees this straight away. It is written to the database by the
             server, so nobody can fake one from their browser.</p>
           <textarea class="ad-input" data-in="msg" maxlength="240" rows="3" placeholder="Something for the whole world…"></textarea>
           <div class="ad-grid"><select data-sel="annmin"><option value="2">Show 2 min</option><option value="5">5 min</option><option value="15">15 min</option></select>
             <button class="ad-btn ok" data-act="announce">📢 Send</button></div>
         </div>`;
    el.innerHTML = `<section class="ad-card" role="dialog" aria-label="Admin panel">
      <header><h2>🛡️ Admin Panel <small>${esc(role)}</small></h2><button class="x" data-act="close" aria-label="Close">✕</button></header>
      <nav class="ad-tabs">
        <button class="${tab === 'players' ? 'on' : ''}" data-tab="players">Players</button>
        <button class="${tab === 'announce' ? 'on' : ''}" data-tab="announce">Announce</button>
      </nav>
      ${body}
      <p class="ad-note ${noteErr ? 'err' : ''}">${esc(note)}</p></section>`;
  }

  const val = (name) => el?.querySelector(`[data-in="${name}"]`)?.value ?? '';
  const pick = (name) => el?.querySelector(`[data-sel="${name}"]`)?.value ?? '';
  const say = (t, err = false) => { note = t; noteErr = err; render(); };

  async function run(fn, okMsg) {
    if (busy) return;
    busy = true; say('Working…');
    try { const r = await fn(); busy = false; say(typeof okMsg === 'function' ? okMsg(r) : okMsg); await reloadSelected(); }
    catch (e) { busy = false; say(api.niceAdminError(e), true); }
  }

  async function search() {
    try { rows = await api.searchPlayers(q, 25); note = `${rows.length} player${rows.length === 1 ? '' : 's'}`; noteErr = false; }
    catch (e) { rows = []; note = api.niceAdminError(e); noteErr = true; }
    render();
  }

  async function reloadSelected() {
    if (!sel) return;
    try { sel = await api.getPlayer(sel.id); } catch { /* keep what we have */ }
    await search();
  }

  function onClick(e) {
    if (e.target === el) return close();
    const t = e.target.closest('[data-tab],[data-pick],[data-act]'); if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; return render(); }
    if (t.dataset.pick) { const p = rows.find((r) => r.id === t.dataset.pick); if (p) { sel = p; render(); reloadSelected(); } return; }
    const a = t.dataset.act, id = sel?.id;
    const reason = val('reason');
    if (a === 'close') return close();
    if (a === 'search' || a === 'refresh') { q = val('q'); return search(); }
    if (a === 'announce') {
      const msg = val('msg').trim();
      if (!msg) return say('Type something first.', true);
      return run(() => api.announce(msg, Number(pick('annmin')) || 2), '📢 Sent.');
    }
    if (!id) return;
    const who = sel.display_name || sel.username;
    if (a === 'kick' && confirm(`Kick ${who} out of the world now?`)) return run(() => api.kickPlayer(id, reason), `👢 ${who} was kicked.`);
    if (a === 'ban') {
      const d = pick('bandur'), mins = d === '' ? null : Number(d);
      if (confirm(`Ban ${who} ${mins === null ? 'permanently' : `for ${mins} minutes`}? They will be signed out and unable to log in.`)) {
        return run(() => api.banPlayer(id, mins, reason), `🔨 ${who} is banned.`);
      }
      return;
    }
    if (a === 'unban' && confirm(`Lift the ban on ${who}?`)) return run(() => api.unbanPlayer(id), `✅ ${who} can play again.`);
    if (a === 'timeout') {
      const mins = Number(pick('mutedur'));
      return run(() => api.timeoutPlayer(id, mins, reason), mins ? `🤐 ${who} is timed out for ${mins} min.` : `${who}'s timeout was cleared.`);
    }
    if (a === 'coins-add') return run(() => api.setCoins(id, Number(val('coins')) || 0, 'add'), (r) => `⚓ Balance is now ${r.coins.toLocaleString()}.`);
    if (a === 'coins-set') return run(() => api.setCoins(id, Number(val('coins')) || 0, 'set'), (r) => `⚓ Balance set to ${r.coins.toLocaleString()}.`);
    if (a === 'item') return run(() => api.giveItem(id, pick('item'), 1), (r) => `🎁 Gave ${r.name}.`);
    if (a === 'role') {
      const r = pick('role');
      if (confirm(`Make ${who} a ${r}?`)) return run(() => api.setRole(id, r), `🛡️ ${who} is now ${r}.`);
    }
  }

  const onKey = (e) => { if (e.key === 'Escape') close(); };

  async function open() {
    if (el) return close();
    role = await api.myRole();                                 // the SERVER decides; a guest or a player gets 'user'
    if (!can('moderator')) return;                             // silently nothing — non-staff must not learn it exists
    el = document.createElement('div'); el.className = 'ad-overlay';
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', (e) => e.stopPropagation());
    root.appendChild(el);
    addEventListener('keydown', onKey);
    game.events.emit('ui-lock', true);
    note = ''; noteErr = false;
    render();
    search();
  }

  function close() {
    if (!el) return;
    removeEventListener('keydown', onKey);
    el.remove(); el = null;
    game.events.emit('ui-lock', false);
  }

  // P opens it — but only ever for an account the server calls staff.
  const onKeyDown = (e) => {
    if (e.key !== 'p' && e.key !== 'P') return;
    const t = e.target;
    if (t && (t.matches?.('input,textarea,select') || t.isContentEditable)) return;    // typing a "p" must not open it
    if (profile.guest) return;
    e.preventDefault();
    open();
  };
  addEventListener('keydown', onKeyDown);

  return {
    open, close, isOpen: () => !!el,
    destroy() { removeEventListener('keydown', onKeyDown); close(); },
  };
}
