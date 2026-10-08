import { esc } from './dom.js';
import { toast } from './hud.js';

// Phase 8 — the little card you get when you press E on something in the world.
// It shows the object's text and, when the object is a clue, the server's answer: how many clues are in, whether the
// secret just cracked open, and what it unlocked. All it ever sends is "I interacted with this clue"; the server
// decides whether that counts and what it is worth.
export function createWorldDialog(root, { game, explore }) {
  let el = null, pending = false;

  function card({ title, body, note, progress, reward }) {
    return `<section class="wd-card" role="dialog" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button class="x" data-act="close" aria-label="Close">✕</button></header>
      <p class="wd-text">${esc(body).replace(/\n/g, '<br>')}</p>
      ${progress ? `<div class="wd-prog"><span>${esc(progress.label)}</span><div class="bar"><i style="width:${progress.pct}%"></i></div><b>${progress.found}/${progress.total}</b></div>` : ''}
      ${note ? `<p class="wd-note ${note.kind || ''}">${esc(note.text)}</p>` : ''}
      ${reward ? `<p class="wd-reward">⚓ +${reward.toLocaleString()} Anchor Coins</p>` : ''}
      <button class="wd-ok" data-act="close">Close</button>
    </section>`;
  }

  function show(data) {
    if (!el) {
      el = document.createElement('div'); el.className = 'wd-overlay';
      el.addEventListener('click', (e) => {
        if (e.target === el || e.target.closest('[data-act="close"]')) close();
      });
      root.appendChild(el);
      addEventListener('keydown', onKey);
      game.events.emit('ui-lock', true);
    }
    el.innerHTML = card(data);
  }

  const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'e' || e.key === 'E') close(); };

  function close() {
    if (!el) return;
    removeEventListener('keydown', onKey);
    el.remove(); el = null; pending = false;
    game.events.emit('ui-lock', false);
  }

  // o = an entry from src/world/interactions.js
  async function open(o) {
    if (!o || pending) return;
    const secret = o.secret ? explore.secretOf(o.secret) : null;
    const already = o.secret ? explore.hasClue(o.secret, o.clue) : false;
    const base = { title: o.title || o.label, body: o.text || '' };

    // Phase 15: an object that opens a panel of its own (the Town Hall picture desk).
    if (o.opens) { close(); game.events.emit(`open-${o.opens}`, {}); return; }

    // Phase 14 + 16: the sealed crate. Reading it shows what it is; the keypad does the rest, and the server
    // decides both the code and who the crate belongs to.
    if (o.claim === 'founder') {
      close();
      game.events.emit('open-keypad', { object: o.id });
      return;
    }

    if (!o.secret) return show(base);

    // already solved: just re-read the object, no request
    if (already || secret?.discovered) {
      return show({ ...base, progress: secret && !secret.discovered ? bar(secret) : null,
        note: { text: secret?.discovered ? `Secret found: ${secret.name}. Nothing left to do here.` : 'You have already noted this one down.', kind: 'ok' } });
    }

    pending = true;
    show({ ...base, note: { text: 'Taking a closer look…' } });
    const r = await explore.findClue(o.secret, o.clue);
    pending = false;
    if (!el) return;                                       // closed while waiting
    if (!r || r.ok === false) {
      return show({ ...base, note: { text: r?.error || 'That did not work. Try again in a moment.', kind: 'err' } });
    }
    const s = explore.secretOf(o.secret);
    if (r.just_discovered || (r.discovered && r.new)) {
      const where = r.unlocks_room;
      show({ ...base, reward: r.coins || 0,
        note: { text: `🔎 Secret discovered: ${r.name || s?.name}!${where ? ' A new way has opened — look for it in this room.' : ''}${r.guest ? ' (Guest progress is not saved.)' : ''}`, kind: 'ok' } });
      toast(`🔎 Secret discovered: ${r.name || s?.name}`);
      return;
    }
    show({ ...base, progress: bar({ clues_found: r.clues_found, clues_total: r.clues_total }),
      note: { text: r.new ? 'Noted in your journal. There is more to this one.' : 'You had already found this clue.', kind: r.new ? 'ok' : '' } });
  }

  const bar = (s) => ({ label: 'Clues found', found: s.clues_found, total: s.clues_total,
    pct: Math.round((s.clues_found / Math.max(1, s.clues_total)) * 100) });

  const onInteract = (o) => open(o);
  game.events.on('world-interact', onInteract);

  return {
    open, close, isOpen: () => !!el,
    destroy() { game.events.off('world-interact', onInteract); close(); },
  };
}
