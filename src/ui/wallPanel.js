import { esc } from './dom.js';
import { toast } from './hud.js';
import { prepareImage, hangPicture, removePicture, reportPicture, pictureUrl, niceWallError, MAX_EDGE } from '../database/wall.js';

// =====================================================================
// PHASE 15 — the Town Hall picture panel.
//   * "Add a picture": pick a file, see exactly what will be hung (it is resized and re-encoded in the browser
//     first, which also strips EXIF), add a short caption, hang it.
//   * Tapping a hung picture: a closer look, who hung it, and take-down / report.
// Both are plain DOM, like every other panel since Phase 4, and both lock the world while open.
// =====================================================================
export function createWallPanel(root, { game, profile }) {
  let el = null, mode = 'add', prepared = null, busy = false, current = null, state = { total: 0, mine: 0, limit: 3 };

  const onState = (s) => { if (!s.error) state = { ...state, ...s }; };
  game.events.on('wall-state', onState);

  function frame(inner, title) {
    return `<section class="wall-card" role="dialog" aria-label="${esc(title)}">
      <header><h2>${esc(title)}</h2><button class="x" data-act="close" aria-label="Close">✕</button></header>
      ${inner}</section>`;
  }

  // ---------- add ----------
  function addView() {
    const full = state.mine >= state.limit;
    return frame(`
      <p class="wall-hint">Your picture goes on the Town Hall wall for everyone to see. Keep it friendly — anyone can
        report a picture, and moderators can take it down.</p>
      ${full ? `<p class="wall-note err">You already have ${state.mine} of ${state.limit} pictures up. Take one down to add another.</p>` : ''}
      <label class="wall-drop" for="wf">
        ${prepared ? `<img src="${prepared.url}" alt="Your picture">` : '<span>📷<br>Choose a picture</span>'}
        <input id="wf" type="file" accept="image/*" ${full ? 'disabled' : ''} hidden>
      </label>
      <p class="wall-meta">${prepared ? `${prepared.w}×${prepared.h} · ${Math.round(prepared.blob.size / 1024)} KB — resized to ${MAX_EDGE}px and stripped of location data` : 'JPG, PNG or WebP. It is resized in your browser before it is sent.'}</p>
      <label class="wall-lab" for="wc">Caption <small>(optional, 60 characters)</small></label>
      <input id="wc" maxlength="60" placeholder="Say something about it" ${full ? 'disabled' : ''}>
      <button class="wall-go" data-act="hang" ${!prepared || full || busy ? 'disabled' : ''}>${busy ? 'Hanging…' : '🖼️ Hang it on the wall'}</button>
      <p class="wall-note" id="wm">${state.total} picture${state.total === 1 ? '' : 's'} on the wall · the hall grows every 10</p>`,
      'Add a picture');
  }

  // ---------- view one ----------
  function viewOne(pic) {
    const url = pictureUrl(pic.path);
    return frame(`
      <div class="wall-view"><img src="${esc(url)}" alt="${esc(pic.caption || 'A picture on the wall')}"></div>
      ${pic.caption ? `<p class="wall-cap">${esc(pic.caption)}</p>` : ''}
      <p class="wall-meta">Hung by <b>${esc(pic.display_name || 'someone')}</b></p>
      <div class="wall-row">
        ${pic.own ? '<button class="wall-link danger" data-act="remove">🗑 Take it down</button>'
                  : '<button class="wall-link" data-act="report">⚑ Report this picture</button>'}
        <button class="wall-link" data-act="close">Close</button>
      </div>
      <p class="wall-note" id="wm"></p>`, 'On the wall');
  }

  function render() {
    if (!el) return;
    el.innerHTML = mode === 'add' ? addView() : viewOne(current);
    const f = el.querySelector('#wf');
    if (f) f.onchange = () => pick(f.files?.[0]);
  }

  const msg = (t, err) => { const m = el?.querySelector('#wm'); if (m) { m.textContent = t; m.className = 'wall-note' + (err ? ' err' : ''); } };

  async function pick(file) {
    if (!file) return;
    try {
      msg('Preparing…');
      const p = await prepareImage(file);
      prepared?.url && URL.revokeObjectURL(prepared.url);
      prepared = { ...p, url: URL.createObjectURL(p.blob) };
      render();
    } catch (e) { msg(e.message, true); }
  }

  async function hang() {
    if (!prepared || busy) return;
    busy = true; render(); msg('Hanging it up…');
    try {
      const caption = el.querySelector('#wc')?.value?.trim() || '';
      const r = await hangPicture(prepared, caption);
      toast(`🖼️ Picture ${r.index} of ${r.total} is up!`);
      prepared?.url && URL.revokeObjectURL(prepared.url); prepared = null;
      busy = false;
      game.events.emit('wall-changed');
      close();
    } catch (e) { busy = false; render(); msg(niceWallError(e), true); }
  }

  async function takeDown() {
    if (!current || busy) return;
    busy = true; msg('Taking it down…');
    try { await removePicture(current.id); toast('Picture taken down.'); game.events.emit('wall-changed'); busy = false; close(); }
    catch (e) { busy = false; msg(niceWallError(e), true); }
  }

  async function report() {
    if (!current || busy) return;
    busy = true; msg('Sending the report…');
    try { await reportPicture(current.id, 'other', null); busy = false; msg('Reported. Thank you — a moderator will look at it.'); }
    catch (e) { busy = false; msg(niceWallError(e), true); }
  }

  function open(what) {
    if (profile.guest) return toast('Create an account to use the picture wall');
    close();
    mode = what?.pic ? 'view' : 'add'; current = what?.pic || null;
    el = document.createElement('div'); el.className = 'wall-overlay';
    el.addEventListener('click', (e) => {
      if (e.target === el) return close();
      const b = e.target.closest('button'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'close') close();
      else if (a === 'hang') hang();
      else if (a === 'remove') takeDown();
      else if (a === 'report') report();
    });
    root.appendChild(el);
    addEventListener('keydown', onKey);
    game.events.emit('ui-lock', true);
    render();
  }

  const onKey = (e) => { if (e.key === 'Escape') close(); };

  function close() {
    if (!el) return;
    removeEventListener('keydown', onKey);
    el.remove(); el = null;
    game.events.emit('ui-lock', false);
  }

  return {
    open, close, isOpen: () => !!el,
    destroy() {
      game.events.off('wall-state', onState);
      prepared?.url && URL.revokeObjectURL(prepared.url);
      close();
    },
  };
}
