import { esc } from './dom.js';
import { RARITY } from '../world/collectibles.js';
import { METRICS } from '../world/achievements.js';
import { nameOf } from '../world/worldMap.js';

// Phase 8 — the Explorer's Journal: one drawer with three tabs (Collectibles · Secrets · Achievements).
// It is a pure view of ExplorationState, which is a pure mirror of the server. Nothing here claims a reward:
// collectibles are credited by walking into them and achievements are completed by _sync_achievements() in SQL.
const pct = (a, b) => Math.min(100, Math.round((a / Math.max(1, b)) * 100));

export function createJournal(root, { game, profile, explore, closeOthers }) {
  const el = document.createElement('aside');
  el.className = 'drawer journal'; el.hidden = true; root.appendChild(el);
  let tab = 'items';

  // ---------- tabs ----------
  function itemsView() {
    const all = explore.collectibles, byRoom = new Map();
    for (const c of all) (byRoom.get(c.room_id) || byRoom.set(c.room_id, []).get(c.room_id)).push(c);
    const c = explore.counts();
    return `<div class="jr-sum"><b>${c.collected} / ${c.collectibles}</b><div class="bar"><i style="width:${pct(c.collected, c.collectibles)}%"></i></div>
        <small>Collectibles found${c.collected < c.collectibles ? ' — keep looking' : ' — every single one!'}</small></div>
      ${[...byRoom.entries()].map(([room, list]) => {
        const done = list.filter((x) => x.collected).length;
        return `<section class="jr-group"><h3>${esc(nameOf(room))} <small>${done}/${list.length}</small></h3>
          <ul class="jr-items">${list.map((x) => x.collected
            ? `<li class="got" style="--r:${RARITY[x.rarity]?.color || '#fff'}"><span class="jr-ic">⭐</span><span class="nm"><b>${esc(x.name)}</b><small>${esc(RARITY[x.rarity]?.label || x.rarity)}${x.reward ? ` · +${x.reward} ⚓` : ''}</small></span></li>`
            : `<li style="--r:${RARITY[x.rarity]?.color || '#fff'}"><span class="jr-ic">❔</span><span class="nm"><b>Not found yet</b><small>${esc(RARITY[x.rarity]?.label || x.rarity)} · somewhere in ${esc(nameOf(room))}</small></span></li>`).join('')}
          </ul></section>`;
      }).join('')}
      ${all.length < (explore.totals.collectibles || all.length)
        ? `<p class="jr-note">🔒 ${(explore.totals.collectibles || 0) - all.length} more are hidden in places you have not opened yet.</p>` : ''}`;
  }

  function secretsView() {
    const c = explore.counts();
    return `<div class="jr-sum"><b>${c.found} / ${c.secrets}</b><div class="bar"><i style="width:${pct(c.found, c.secrets)}%"></i></div>
        <small>Secrets discovered</small></div>
      <ul class="jr-secrets">${explore.secrets.map((s) => {
        const found = s.clues_found || 0, total = s.clues_total || 1;
        if (s.discovered) return `<li class="got"><span class="jr-ic">🔎</span><span class="nm"><b>${esc(s.name)}</b>
          <small>${esc(nameOf(s.room_id))}${s.unlocks_room ? ` · opened ${esc(nameOf(s.unlocks_room))}` : ''}${s.reward ? ` · +${s.reward} ⚓` : ''}</small></span></li>`;
        if (!found) return `<li><span class="jr-ic">❔</span><span class="nm"><b>Undiscovered secret</b><small>Somewhere in ${esc(nameOf(s.room_id))}</small></span></li>`;
        return `<li class="part"><span class="jr-ic">🕯️</span><span class="nm"><b>${esc(s.name)}</b>
          <small>${esc(s.hint || '')}</small><span class="jr-bar"><i style="width:${pct(found, total)}%"></i></span><small>${found}/${total} clues</small></span></li>`;
      }).join('')}</ul>
      <p class="jr-note">Secrets stay hidden until you find them. Look for anything that glows, and press <b>E</b>.</p>`;
  }

  function badgesView() {
    const done = explore.achievements.filter((a) => a.completed_at).length;
    return `<div class="jr-sum"><b>${done} / ${explore.achievements.length}</b><div class="bar"><i style="width:${pct(done, explore.achievements.length)}%"></i></div>
        <small>Badges earned</small></div>
      <ul class="jr-badges">${explore.achievements.map((a) => {
        const p = Math.min(a.progress || 0, a.goal);
        return `<li class="${a.completed_at ? 'got' : ''}"><span class="jr-ic big">${a.icon || '🏅'}</span>
          <span class="nm"><b>${esc(a.name)}</b><small>${esc(a.description)}</small>
            <span class="jr-bar"><i style="width:${pct(p, a.goal)}%"></i></span>
            <small>${esc(METRICS[a.metric] || 'Progress')}: ${p.toLocaleString()} / ${a.goal.toLocaleString()}${a.reward ? ` · reward ${a.reward.toLocaleString()} ⚓` : ''}</small></span>
          ${a.completed_at ? '<b class="jr-done">✓</b>' : ''}</li>`;
      }).join('')}</ul>`;
  }

  function render() {
    if (el.hidden) return;
    const keep = el.querySelector('.body')?.scrollTop || 0;
    const body = explore.error ? `<p class="jr-note err">${esc(explore.error)}</p>`
      : !explore.loaded ? '<p class="jr-note">Opening your journal…</p>'
      : tab === 'items' ? itemsView() : tab === 'secrets' ? secretsView() : badgesView();
    el.innerHTML = `<header><h2>📒 Explorer's Journal</h2><button class="x" data-act="close" aria-label="Close">✕</button></header>
      <nav class="jr-tabs">
        <button class="${tab === 'items' ? 'on' : ''}" data-tab="items">⭐ Items</button>
        <button class="${tab === 'secrets' ? 'on' : ''}" data-tab="secrets">🔎 Secrets</button>
        <button class="${tab === 'badges' ? 'on' : ''}" data-tab="badges">🏅 Badges</button>
      </nav>
      <div class="body">${body}</div>
      <footer>${profile.guest ? 'Guest progress is not saved — create an account to keep it.' : 'Rewards are paid by the server when you find something.'}</footer>`;
    const b = el.querySelector('.body'); if (b) b.scrollTop = keep;
  }

  el.addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    if (btn.dataset.act === 'close') return close();
    if (btn.dataset.tab) { tab = btn.dataset.tab; render(); }
  });

  const off = explore.on(() => render());
  const close = () => { el.hidden = true; };
  const onEsc = (e) => e.key === 'Escape' && close();
  addEventListener('keydown', onEsc);

  return {
    open(which) {
      closeOthers?.(); if (which) tab = which;
      el.hidden = false; render();
      // ONE request, and only when the journal is actually opened. It also lets the friends / furniture / arcade
      // achievements catch up, since those are earned outside the exploration system.
      explore.refresh(true);
    },
    toggle(which) { el.hidden ? this.open(which) : close(); },
    close, isOpen: () => !el.hidden,
    destroy() { off(); removeEventListener('keydown', onEsc); el.remove(); },
  };
}
