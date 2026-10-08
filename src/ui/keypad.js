import { esc } from './dom.js';
import { toast } from './hud.js';
import { claimFounderItem } from '../database/inventory.js';

// =====================================================================
// PHASE 16 — the keypad on the Sealed Crate.
//
// This panel is only a numeric keyboard: it collects digits and posts them. The real code is stored in a table no
// player can read (`founder_accounts` in supabase/phase14/16.sql) and is never sent to the browser, so reading the
// game's source, the network tab or localStorage reveals nothing. The server also decides WHO may open the crate,
// so even the right code opens nothing for the wrong account — and a wrong code and a wrong account give the same
// answer, so the keypad never tells you which half you got wrong.
// =====================================================================
const MAX = 24;

export function createKeypad(root, { game }) {
  let el = null, code = '', busy = false, note = '', noteKind = '';

  const dots = () => code.length
    ? code.split('').map(() => '●').join(' ')
    : '— — — — —';

  function render() {
    if (!el) return;
    el.innerHTML = `<section class="kp-card" role="dialog" aria-label="Keypad">
      <header><h2>🔒 Sealed Crate</h2><button class="x" data-k="close" aria-label="Close">✕</button></header>
      <p class="kp-sub">A keypad, worn smooth. No label, no hint.</p>
      <div class="kp-screen" aria-live="polite"><span>${dots()}</span><i>${code.length}</i></div>
      <div class="kp-grid">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('')}
        <button class="kp-alt" data-k="clear">CLR</button>
        <button data-k="0">0</button>
        <button class="kp-ok" data-k="enter" ${busy || !code ? 'disabled' : ''}>${busy ? '…' : '↵'}</button>
      </div>
      <p class="kp-note ${esc(noteKind)}">${esc(note)}</p>
    </section>`;
  }

  async function submit() {
    if (busy || !code) return;
    busy = true; note = 'The keypad clicks…'; noteKind = ''; render();
    let r = null;
    try { r = await claimFounderItem(code); } catch { r = { ok: false, error: 'offline' }; }
    busy = false;
    if (!el) return;
    if (r?.ok) {
      note = r.already
        ? `Already yours — the ${r.name} is in your wardrobe.`
        : `The bolts slide back. Inside, folded in oilcloth: the ${r.name}.`;
      noteKind = 'ok'; code = ''; render();
      if (!r.already) { toast(`🚀 ${r.name} unlocked!`); game.events.emit('founder-claimed', r); }
      setTimeout(() => close(), 2600);
      return;
    }
    code = '';
    note = r?.error === 'slow_down' ? 'The keypad goes dead for a while. Try again later.'
      : r?.error === 'offline' ? 'No answer from the lock. Check your connection.'
      : 'The keypad buzzes and resets.';
    noteKind = 'err'; render();
  }

  function press(k) {
    if (k === 'close') return close();
    if (k === 'clear') { code = ''; note = ''; noteKind = ''; return render(); }
    if (k === 'enter') return submit();
    if (/^[0-9]$/.test(k) && code.length < MAX) { code += k; note = ''; noteKind = ''; render(); }
  }

  const onKey = (e) => {
    if (e.key === 'Escape') return close();
    if (e.key === 'Enter') return press('enter');
    if (e.key === 'Backspace') { code = code.slice(0, -1); return render(); }
    if (/^[0-9]$/.test(e.key)) press(e.key);
  };

  function open() {
    close();
    code = ''; note = ''; noteKind = ''; busy = false;
    el = document.createElement('div'); el.className = 'kp-overlay';
    el.addEventListener('click', (e) => {
      if (e.target === el) return close();
      const b = e.target.closest('button[data-k]');
      if (b && !b.disabled) press(b.dataset.k);
    });
    root.appendChild(el);
    addEventListener('keydown', onKey);
    game.events.emit('ui-lock', true);
    render();
  }

  function close() {
    if (!el) return;
    removeEventListener('keydown', onKey);
    el.remove(); el = null; code = '';
    game.events.emit('ui-lock', false);
  }

  const onOpen = () => open();
  game.events.on('open-keypad', onOpen);

  return { open, close, isOpen: () => !!el, destroy() { game.events.off('open-keypad', onOpen); close(); } };
}
