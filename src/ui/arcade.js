import { ARCADE_GAMES as GAME_LIST, GAMES } from '../minigames/registry.js';
import { fetchOverview, cachedOverview, bestOf } from '../minigames/scoreSystem.js';
import { fetchLeaderboard, SCOPES } from '../minigames/leaderboard.js';
import { maxReward } from '../minigames/rewards.js';
import { drawAvatarPreview } from '../utils/avatarPreview.js';
import { esc } from './dom.js';

const MEDAL = ['🥇', '🥈', '🥉'];
const fmt = (n) => Math.round(n).toLocaleString();
const when = (iso) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const secs = (ms) => `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s`;
const niceError = (e) => (/could not find the function|schema cache|does not exist|PGRST202/i.test(e.message) ? 'The arcade database is not set up yet. Run supabase/phase7.sql in the Supabase SQL editor.' : e.message || 'Something went wrong.');

// The Arcade screen: pick a game, or browse the leaderboards. It is only a view: scores, bests and rewards all come from
// the server (get_arcade_overview / get_leaderboard) and nothing here can change them. Opened from the cabinets in the Arcade room.
export function createArcade(root, { game, profile, manager }) {
  let el = null, tab = 'games', focus = null, lbGame = GAME_LIST[0].id, scope = 'global', lb = null, lbErr = null, lbLoading = false, ovErr = null, token = 0;

  const guest = !!profile.guest;
  const overview = () => cachedOverview();

  // ---------- games ----------
  function card(g) {
    const best = bestOf(g.id, guest), top = maxReward(overview(), g.id) || g.fallbackReward;
    return `<article class="arc-card ${focus === g.id ? 'focus' : ''}" style="--a:${g.colors.a};--b:${g.colors.b}">
      <div class="arc-screen"><span class="arc-ico">${g.emoji}</span><i class="arc-scan"></i></div>
      <h3>${esc(g.name.toUpperCase())}</h3>
      <p class="arc-tag">${esc(g.tagline)}</p>
      <p class="arc-desc">${esc(g.description)}</p>
      <div class="arc-stats"><div><small>YOUR BEST</small><b>${best == null ? '—' : fmt(best)}</b></div><div><small>HIGHEST REWARD</small><b>⚓ ${fmt(top)}</b></div></div>
      <button class="arc-play" data-play="${g.id}">▶ PLAY</button>
      <button class="arc-link" data-board="${g.id}">🏆 Leaderboard</button>
    </article>`;
  }
  function gamesView() {
    const o = overview(), cap = o?.daily_cap || 0, earned = o?.earned_today || 0;
    const meter = guest ? '<p class="arc-note">You are playing as a guest: scores are not saved and no coins are earned. Create an account to join the leaderboards!</p>'
      : cap ? `<div class="arc-meter" title="Coins you can still earn from minigames today"><span>Coins earned today</span><div class="bar"><i style="width:${Math.min(100, (earned / cap) * 100)}%"></i></div><b>${fmt(earned)} / ${fmt(cap)}</b></div>` : '';
    return `<div class="arc-grid">${GAME_LIST.map(card).join('')}</div>${ovErr ? `<p class="arc-note err">${esc(ovErr)}</p>` : ''}${meter}`;
  }

  // ---------- leaderboards ----------
  const avatars = new Map();
  function rows() {
    if (lbLoading) return '<p class="arc-empty">Loading rankings…</p>';
    if (lbErr) return `<p class="arc-empty err">${esc(lbErr)}</p><div class="row center"><button class="arc-link" data-act="retry">↻ Try again</button></div>`;
    if (!lb) return '';
    avatars.clear();
    if (lb.scope === 'personal') {
      if (!lb.entries.length) return '<p class="arc-empty">No runs yet. Go set a score!</p>';
      return `<ol class="arc-list">${lb.entries.map((e, i) => `<li class="arc-row ${lb.me && e.score === lb.me.score && i === lb.entries.findIndex((x) => x.score === lb.me.score) ? 'me' : ''}">
        <span class="rk">${i + 1}</span><span class="nm"><b>${fmt(e.score)}</b><small>${secs(e.duration_ms)} · ${when(e.played_at)}</small></span><b class="sc">${e.coins ? `+${fmt(e.coins)} ⚓` : ''}</b></li>`).join('')}</ol>`;
    }
    if (!lb.entries.length) return '<p class="arc-empty">Nobody has a score here yet. Be the first!</p>';
    const inList = lb.entries.some((e) => e.player_id === profile.id);
    const line = (e) => {
      avatars.set(e.player_id, e.avatar_data);
      const mine = e.player_id === profile.id;
      return `<li class="arc-row ${mine ? 'me' : ''} ${e.rank <= 3 ? 'top' + e.rank : ''}"><span class="rk">${MEDAL[e.rank - 1] || e.rank}</span>
        <canvas class="arc-av" width="44" height="60" data-av="${esc(e.player_id)}"></canvas><span class="nm"><b>${esc(e.display_name || e.username)}</b>${mine ? '<small>You</small>' : ''}</span><b class="sc">${fmt(e.score)}</b></li>`;
    };
    const pinned = !inList && lb.me ? `<div class="arc-pin">Your position: <b>#${fmt(lb.me.rank)}</b> · <b>${fmt(lb.me.score)}</b></div>` : '';
    return `<ol class="arc-list">${lb.entries.map(line).join('')}</ol>${pinned}`;
  }
  function boardView() {
    const g = GAMES[lbGame];
    if (guest) return '<p class="arc-empty">Create an account to see the global rankings and get on them yourself!</p>';
    return `<div class="arc-pills">${GAME_LIST.map((x) => `<button class="${x.id === lbGame ? 'on' : ''}" data-game="${x.id}">${x.emoji} ${esc(x.name)}</button>`).join('')}</div>
      <div class="arc-pills small">${SCOPES.map(([k, l]) => `<button class="${k === scope ? 'on' : ''}" data-scope="${k}">${l}</button>`).join('')}</div>
      <h3 class="arc-lbtitle">🏆 ${esc(g.name.toUpperCase())}</h3><div class="arc-rows">${rows()}</div>
      ${lb && lb.me && !lbLoading ? `<p class="arc-note">${lb.scope === 'personal' ? 'Your best' : 'You are ranked'}: <b>${lb.scope === 'personal' ? fmt(lb.me.score) : `#${fmt(lb.me.rank)} · ${fmt(lb.me.score)}`}</b></p>` : ''}`;
  }

  async function loadBoard(force = false) {
    if (guest) return;
    const my = ++token; lbLoading = true; lbErr = null; render();
    try { const d = await fetchLeaderboard(lbGame, scope, 20, force); if (my !== token) return; lb = d; }
    catch (e) { if (my !== token) return; lb = null; lbErr = niceError(e); }
    lbLoading = false; render();
  }

  // ---------- frame ----------
  function render() {
    if (!el) return;
    const keep = el.querySelector('.arc-body')?.scrollTop || 0;
    el.innerHTML = `<section class="arc" role="dialog" aria-label="Arcade">
      <header class="arc-top"><div class="arc-marquee"><i></i><i></i><i></i><h2>🕹️ ANCHOR ARCADE</h2><i></i><i></i><i></i></div>
        <div class="pill coins" title="Your Anchor Coins"><span class="coin">⚓</span><span>${(profile.coins || 0).toLocaleString()}</span></div>
        <button class="x" data-act="close" aria-label="Close arcade">✕</button></header>
      <nav class="arc-tabs"><button class="${tab === 'games' ? 'on' : ''}" data-tab="games">🎮 Games</button><button class="${tab === 'board' ? 'on' : ''}" data-tab="board">🏆 Leaderboards</button></nav>
      <div class="arc-body">${tab === 'games' ? gamesView() : boardView()}</div></section>`;
    el.querySelector('.arc-body').scrollTop = keep;
    el.querySelectorAll('canvas[data-av]').forEach((c) => { const a = avatars.get(c.dataset.av); if (a) drawAvatarPreview(game, c, a, 0.62); });
  }

  function onClick(e) {
    if (e.target === el) return close();
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.act === 'close') return close();
    if (d.act === 'retry') return loadBoard(true);
    if (d.tab) { tab = d.tab; render(); return tab === 'board' && !lb && loadBoard(); }
    if (d.game) { lbGame = d.game; lb = null; return loadBoard(); }
    if (d.scope) { scope = d.scope; lb = null; return loadBoard(); }
    if (d.board) { tab = 'board'; lbGame = d.board; lb = null; return loadBoard(); }
    if (d.play) { const id = d.play; close(); manager.start(id); }
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  // open('snow_dash') | open('leaderboard') | open({tab:'board', game:'coin_catcher'})
  function open(arg) {
    const a = typeof arg === 'string' ? (arg === 'leaderboard' ? { tab: 'board' } : { tab: 'games', game: arg }) : arg || {};
    if (manager.isActive) return;
    if (el) close();
    tab = a.tab || 'games'; focus = a.tab === 'board' ? null : a.game || null;
    if (a.game && GAMES[a.game]) lbGame = a.game;
    lb = null; lbErr = null; lbLoading = false; ovErr = null; scope = 'global';
    el = document.createElement('div'); el.className = 'arc-overlay'; el.addEventListener('click', onClick);
    root.appendChild(el); addEventListener('keydown', onKey);
    game.events.emit('ui-lock', true);
    render();
    if (!guest) {
      fetchOverview(true).then(() => el && render()).catch((e) => { ovErr = niceError(e); el && render(); });   // ONE request for every game's best + rewards
      if (tab === 'board') loadBoard();
    }
  }
  function close() {
    if (!el) return;
    token++; removeEventListener('keydown', onKey); el.remove(); el = null;
    game.events.emit('ui-lock', false);
  }

  // coming back from a minigame: reopen the Arcade where the player was (games list, or that game's leaderboard)
  const onEnd = ({ tab: t, game: g, world }) => { if (!world) open({ tab: t, game: g }); };   // Phase 10: world activities drop you back in the world
  game.events.on('minigame-end', onEnd);

  return { open, close, isOpen: () => !!el, destroy() { game.events.off('minigame-end', onEnd); if (el) { removeEventListener('keydown', onKey); el.remove(); el = null; } } };
}
