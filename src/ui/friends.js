import * as db from '../database/social.js';
import { drawAvatarPreview } from '../utils/avatarPreview.js';
import { esc, fmtDate } from './dom.js';
import { toast } from './hud.js';

const REASONS = [['bad_language', 'Bad language'], ['harassment', 'Being mean / bullying'], ['spam', 'Spam'], ['inappropriate_name', 'Inappropriate name'], ['cheating', 'Cheating'], ['other', 'Something else']];
const REL_TEXT = { friend: 'Friends ✓', pending_out: 'Request sent', pending_in: 'Wants to be friends' };

// Friends drawer: Friends | Requests | Find, plus a profile card (add / join / mute / block / report) that also opens
// when you tap a player in the world or a name in chat. All data lives in SocialState; every change is a server function call.
export function createFriends(root, { game, profile, social, closeOthers }) {
  const el = document.createElement('aside');
  el.className = 'drawer fr-drawer'; el.hidden = true; root.appendChild(el);
  let tab = 'friends', view = null, results = null, query = '', busy = false, room = null;
  const avatars = new Map();                                    // player id -> avatar_data, so canvases can be drawn after render

  const guestNote = () => toast('Create an account to use friends');

  // ---------- small renderers ----------
  const face = (p) => { avatars.set(p.id, p.avatar_data); return `<canvas class="fav" width="64" height="88" data-av="${esc(p.id)}"></canvas>`; };
  const status = (id) => {
    const s = social.statusOf(id);
    return `<small class="${s.online ? 'on' : 'off'}" title="${s.online ? 'Online' : 'Offline'}">${s.online ? '🟢' : '🔴'} ${esc(s.text)}</small>`;
  };
  const joinBtn = (id) => (social.statusOf(id).joinable ? `<button class="sbtn mini go" data-act="join" data-id="${esc(id)}">Join</button>` : '');

  function friendsTab() {
    if (!social.friends.length) return `<p class="empty">No friends yet. Use <b>Find</b> to search a username, or tap a player in the world!</p>`;
    const list = [...social.friends].sort((a, b) => (social.online.has(b.id) - social.online.has(a.id)) || a.username.localeCompare(b.username));
    const on = list.filter((f) => social.online.has(f.id)).length;
    return `<h3>${on} online · ${list.length} friend${list.length === 1 ? '' : 's'}</h3>` + list.map((f) => `
      <div class="fr"><button class="fr-main" data-act="profile" data-id="${esc(f.id)}">${face(f)}<span class="nm"><b>${esc(f.display_name)}</b>${status(f.id)}</span></button>
        ${joinBtn(f.id)}<button class="x sm" data-act="remove" data-id="${esc(f.id)}" data-name="${esc(f.display_name)}" title="Remove friend" aria-label="Remove friend">✕</button></div>`).join('');
  }

  function requestsTab() {
    const inc = social.incoming, out = social.outgoing;
    if (!inc.length && !out.length) return `<p class="empty">No pending requests.</p>`;
    return (inc.length ? `<h3>Wants to be your friend</h3>` + inc.map((r) => `
      <div class="fr"><button class="fr-main" data-act="profile" data-id="${esc(r.player.id)}">${face(r.player)}<span class="nm"><b>${esc(r.player.display_name)}</b><small>@${esc(r.player.username)}</small></span></button>
        <button class="sbtn mini go" data-act="accept" data-rid="${esc(r.id)}">Accept Request</button><button class="sbtn mini ghost" data-act="decline" data-rid="${esc(r.id)}">Decline Request</button></div>`).join('') : '')
      + (out.length ? `<h3>Waiting for an answer</h3>` + out.map((r) => `
      <div class="fr"><button class="fr-main" data-act="profile" data-id="${esc(r.player.id)}">${face(r.player)}<span class="nm"><b>${esc(r.player.display_name)}</b><small>@${esc(r.player.username)}</small></span></button>
        <button class="sbtn mini ghost" data-act="cancel" data-rid="${esc(r.id)}">Cancel Request</button></div>`).join('') : '');
  }

  function findTab() {
    const list = results == null ? '' : results.length ? results.map((p) => `
      <div class="fr"><button class="fr-main" data-act="profile" data-id="${esc(p.id)}">${face(p)}<span class="nm"><b>${esc(p.display_name)}</b><small>@${esc(p.username)}${REL_TEXT[p.relation] ? ' · ' + REL_TEXT[p.relation] : ''}</small></span></button>
        ${p.relation === 'none' ? `<button class="sbtn mini go" data-act="add" data-id="${esc(p.id)}">Add</button>` : ''}</div>`).join('') : `<p class="empty">No players found.</p>`;
    return `<form class="fr-search" data-form="search"><input maxlength="16" placeholder="Search a username" value="${esc(query)}" aria-label="Search username" autocomplete="off">
      <button class="sbtn mini go">Search</button></form>${list || `<p class="empty">Type at least 2 letters of a username.</p>`}`;
  }

  function profileView() {
    const v = view, back = `<button class="chip back" data-act="back">‹ Back</button>`;
    if (v.loading) return `${back}<p class="empty">Loading…</p>`;
    if (v.err) return `${back}<p class="empty">${esc(v.err)}</p>`;
    const p = v.data;
    const inc = social.incoming.find((r) => r.player.id === p.id), out = social.outgoing.find((r) => r.player.id === p.id);
    let main = '';
    if (p.is_me) main = `<p class="empty">This is you!</p>`;
    else if (p.relation === 'friend') main = `${joinBtn(p.id)}<button class="sbtn ghost" data-act="remove" data-id="${esc(p.id)}" data-name="${esc(p.display_name)}">Remove friend</button>`;
    else if (p.relation === 'pending_in' && inc) main = `<button class="sbtn go" data-act="accept" data-rid="${esc(inc.id)}">Accept Request</button><button class="sbtn ghost" data-act="decline" data-rid="${esc(inc.id)}">Decline Request</button>`;
    else if (p.relation === 'pending_out' && out) main = `<button class="sbtn ghost" data-act="cancel" data-rid="${esc(out.id)}">Cancel Request</button>`;
    else if (!p.blocked) main = `<button class="sbtn go" data-act="add" data-id="${esc(p.id)}">Add friend</button>`;
    if (v.report) return `${back}<h3>Report ${esc(p.display_name)}</h3><p class="hint">Reports are private and reviewed by the team. Pick what happened:</p>
      <div class="reasons">${REASONS.map(([k, l]) => `<label><input type="radio" name="why" value="${k}" ${v.reason === k ? 'checked' : ''}> ${l}</label>`).join('')}</div>
      <textarea maxlength="200" rows="2" placeholder="Anything else? (optional)" data-note>${esc(v.note || '')}</textarea>
      <button class="sbtn danger" data-act="send-report" ${busy ? 'disabled' : ''}>Send report</button>`;
    return `${back}<div class="card-p"><canvas class="fav big" width="64" height="88" data-av="${esc(p.id)}"></canvas>
      <h2>${esc(p.display_name)}</h2><small>@${esc(p.username)} · joined ${esc(fmtDate(p.created_at))}</small>
      ${p.relation === 'friend' ? `<div>${status(p.id)}</div>` : ''}</div>
      <div class="row center">${main}</div>
      ${p.is_me ? '' : `<h3>Safety</h3><div class="row">
        <button class="sbtn mini" data-act="${p.muted ? 'unmute' : 'mute'}" data-id="${esc(p.id)}">${p.muted ? '🔊 Unmute' : '🔇 Mute'}</button>
        <button class="sbtn mini" data-act="${p.blocked ? 'unblock' : 'block'}" data-id="${esc(p.id)}">${p.blocked ? '✅ Unblock' : '🚫 Block'}</button>
        <button class="sbtn mini" data-act="report">📝 Report</button></div>
        <p class="hint">Mute hides chat/emotes. Block hides everything and removes friendship.</p>`}`;
  }

  function render() {
    if (el.hidden) return;
    const reqN = social.incoming.length;
    let body;
    if (profile.guest) body = `<p class="empty">Friends are for players with an account.<br>Create one to chat, add friends and visit rooms!</p>`;
    else if (view) body = profileView();
    else body = tab === 'friends' ? friendsTab() : tab === 'requests' ? requestsTab() : findTab();
    const keepSearch = tab === 'find' && !view ? el.querySelector('.fr-search input') : null;
    const hadFocus = keepSearch && document.activeElement === keepSearch, val = keepSearch?.value;
    el.innerHTML = `<header><h2>Friends</h2><button class="x" data-act="close" aria-label="Close">✕</button></header>
      ${view ? '' : `<nav class="tabs2">${[['friends', 'Friends'], ['requests', `Requests${reqN ? ` (${reqN})` : ''}`], ['find', 'Find']].map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</nav>`}
      <div class="body">${body}</div>
      <footer>Be kind. Never share personal information.</footer>`;
    if (keepSearch) { const i = el.querySelector('.fr-search input'); if (val != null) i.value = val; if (hadFocus) i.focus(); }
    el.querySelectorAll('canvas[data-av]').forEach((c) => { const a = avatars.get(c.dataset.av); if (a) drawAvatarPreview(game, c, a, 0.9); });
  }

  // ---------- actions ----------
  async function run(fn, okMsg) {
    if (busy) return; busy = true;
    try { const r = await fn(); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg); await social.refresh(); }
    catch (e) { toast(e.message); }
    busy = false;
    if (view?.data) await reloadProfile(); else render();
  }
  async function reloadProfile() {
    if (!view?.id) return;
    try { const d = await db.getPlayer(view.id); if (view) { view.data = d; view.loading = false; avatars.set(d.id, d.avatar_data); } } catch (e) { if (view) view.err = e.message; }
    render();
  }
  async function openProfile(id) {
    if (profile.guest) return guestNote();
    if (id === profile.id) return;
    closeOthers?.(); el.hidden = false;
    view = { id, loading: true }; render();
    await reloadProfile();
  }
  const refreshSearch = async () => { try { results = await db.searchPlayers(query); } catch (e) { toast(e.message); results = null; } render(); };

  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tab],[data-act]'); if (!t) return;
    if (t.dataset.tab) { tab = t.dataset.tab; view = null; if (tab !== 'find') social.refresh().catch(() => {}); return render(); }
    const { act, id, rid, name } = t.dataset;
    if (act === 'close') return close();
    if (act === 'back') { view = null; return render(); }
    if (act === 'profile') return openProfile(id);
    if (act === 'join') { close(); const s = social.statusOf(id); return game.events.emit('join-room', { room: s.room, ownerId: s.ownerId || null }); }
    if (act === 'add') return run(() => db.sendRequest(id), (r) => (r === 'accepted' ? 'You are now friends!' : 'Friend request sent!')).then(() => query && tab === 'find' && !view && refreshSearch());
    if (act === 'accept') return run(() => db.answerRequest(rid, true), 'Friend added!');
    if (act === 'decline') return run(() => db.answerRequest(rid, false), 'Request declined');
    if (act === 'cancel') return run(() => db.cancelRequest(rid), 'Request cancelled');
    if (act === 'remove') { if (confirm(`Remove ${name || 'this player'} from your friends?`)) run(() => db.removeFriend(id), 'Friend removed'); return; }
    if (act === 'mute') return run(() => db.mutePlayer(id), 'Muted: their chat and emotes are hidden');
    if (act === 'unmute') return run(() => db.unmutePlayer(id), 'Unmuted');
    if (act === 'block') { if (confirm('Block this player? You will not see each other, and you will stop being friends.')) run(() => db.blockPlayer(id), 'Player blocked'); return; }
    if (act === 'unblock') return run(() => db.unblockPlayer(id), 'Player unblocked');
    if (act === 'report') { view.report = true; return render(); }
    if (act === 'send-report') {
      const why = el.querySelector('input[name=why]:checked')?.value;
      if (!why) return toast('Choose a reason first');
      const note = el.querySelector('[data-note]').value;
      return run(() => db.reportPlayer(view.id, why, note, room), 'Thanks. Your report was sent privately.').then(() => { if (view) { view.report = false; render(); } });
    }
  });
  el.addEventListener('submit', (e) => {
    if (e.target.dataset.form !== 'search') return;
    e.preventDefault(); query = e.target.querySelector('input').value.trim();
    if (!/^[A-Za-z0-9_]{2,16}$/.test(query)) return toast('Search for 2-16 letters, numbers or _');
    refreshSearch();
  });
  // keep the typed note / chosen reason when the drawer re-renders
  el.addEventListener('input', (e) => { if (view?.report) { if (e.target.matches('[data-note]')) view.note = e.target.value; if (e.target.name === 'why') view.reason = e.target.value; } });
  el.addEventListener('keydown', (e) => { if (e.target.matches('input,textarea')) e.stopPropagation(); });     // typing a username must never trigger game hotkeys
  el.addEventListener('focusin', (e) => { if (e.target.matches('input,textarea')) game.events.emit('typing', true); });
  el.addEventListener('focusout', (e) => { if (e.target.matches('input,textarea')) game.events.emit('typing', false); });

  // ---------- lifecycle ----------
  const onRoom = (_i, _n, channelId) => { room = channelId; };
  // Phase 17: guests are real players in the world but have no database row, so their card is a short local one
  // rather than a lookup that would always fail.
  const onProfile = (id) => {
    if (typeof id === 'string' && id.startsWith('guest_')) {
      const name = game.scene.getScene('Room')?.mp?.nameOf?.(id) || 'A guest';
      return toast(`${name} is playing as a guest — no account to add yet.`);
    }
    openProfile(id);
  };
  game.events.on('room-entered', onRoom); game.events.on('open-profile', onProfile);
  const off = social.on((ev) => {
    if (ev.type === 'changed' || ev.type === 'presence') render();
    if (ev.type === 'notify' && ev.table === 'friend_requests') {
      if (ev.row?.status === 'pending') toast('👋 You got a friend request!');
      else if (ev.row?.status === 'accepted') toast('🎉 A friend request was accepted!');
    }
  });
  const close = () => { el.hidden = true; view = null; if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur(); game.events.emit('typing', false); };
  const onEsc = (e) => { if (e.key === 'Escape' && !el.hidden) close(); };
  addEventListener('keydown', onEsc);

  return {
    open(t) {
      if (profile.guest) return guestNote();
      closeOthers?.(); if (t) tab = t; view = null; el.hidden = false;
      if (tab !== 'find') social.refresh().catch(() => {});        // fresh list on open (covers removals the other side did)
      render();
    },
    toggle() { el.hidden ? this.open() : close(); },
    close, openProfile, isOpen: () => !el.hidden,
    destroy() { off(); removeEventListener('keydown', onEsc); game.events.off('room-entered', onRoom); game.events.off('open-profile', onProfile); el.remove(); },
  };
}
