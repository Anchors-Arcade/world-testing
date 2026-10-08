import { FURNITURE, FURNITURE_BY_ID } from '../shops/furniture.js';
import { RARITY } from '../shops/items.js';
import { THEMES, THEME_KEYS, hex } from './themes.js';
import { ROOM, snap, nextRotation, rectOf, isValid, clampCentre, findFreeSpot } from './roomRules.js';
import { qtyOf } from '../database/inventory.js';
import { saveRoom } from '../database/rooms.js';
import { textureIcon } from '../utils/icons.js';
import { toast } from '../ui/hud.js';

const OK = 0x6fd08c, BAD = 0xff6b6b;

// Edit mode for the player's own room. Everything is local until "Save room": dragging never touches the network.
// Gameplay and editing are separated: the scene freezes the avatar (scene.editing), the HUD dock hides (#ui.editing),
// colliders are removed so pieces can be moved freely, and the camera zooms out to show the whole room.
export class RoomEditor {
  constructor(scene, home, { profile, onClose }) {
    this.scene = scene; this.home = home; this.profile = profile; this.onClose = onClose;
    this.snapshot = { theme: home.theme, list: home.serialize() };
    this.tab = 'furniture'; this.sel = null; this.drag = null; this.dirty = false; this.saving = false; this.closed = false;

    home.enableColliders(false);
    this.grid = scene.add.graphics().setDepth(-950);
    this.gfx = scene.add.graphics().setDepth(1e5);
    this.drawGrid();

    this.ui = document.getElementById('ui');
    this.ui.classList.add('editing');
    this.el = document.createElement('div');
    this.el.className = 'ed';
    this.ui.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));

    this.fit = this.fit.bind(this);
    scene.scale.on('resize', this.fit);
    this.fit();

    this.onDown = (p) => this.pointerDown(p); this.onMove = (p) => this.pointerMove(p); this.onUp = () => this.pointerUp();
    scene.input.on('pointerdown', this.onDown); scene.input.on('pointermove', this.onMove); scene.input.on('pointerup', this.onUp);
    this.onKey = (e) => this.keyDown(e);
    addEventListener('keydown', this.onKey);
    this.onInv = () => this.render();
    scene.game.events.on('inventory-changed', this.onInv);

    this.render();
  }

  item = (id) => FURNITURE_BY_ID[id];
  remaining = (id) => qtyOf(this.profile, id) - this.home.count(id);

  // ---------- camera: show the whole room between the top bar and the tray ----------
  fit() {
    if (this.closed) return;
    const cam = this.scene.cameras.main, W = this.scene.scale.width, H = this.scene.scale.height;
    const top = 64, bottom = Math.min(230, H * 0.34), availH = Math.max(H - top - bottom, 120);
    const z = Math.min(1.3, (W - 24) / ROOM.w, availH / ROOM.h);
    cam.stopFollow(); cam.removeBounds(); cam.setZoom(z);
    const wantScreenY = top + availH / 2;
    cam.centerOn(ROOM.w / 2, ROOM.h / 2 + (H / 2 - wantScreenY) / z);
  }

  drawGrid() {
    const g = this.grid; g.clear();
    g.lineStyle(1, 0xffffff, 0.12);
    for (let x = 0; x <= ROOM.w; x += 32) g.lineBetween(x, ROOM.wall, x, ROOM.floorBottom);
    for (let y = ROOM.wall; y <= ROOM.floorBottom; y += 32) g.lineBetween(0, y, ROOM.w, y);
    g.fillStyle(0x16304a, 0.28); g.fillRect(0, ROOM.floorBottom, ROOM.w, ROOM.h - ROOM.floorBottom);   // doorway strip: keep clear
    g.lineStyle(2, 0xffffff, 0.35); g.lineBetween(0, ROOM.floorBottom, ROOM.w, ROOM.floorBottom);
  }

  // ---------- selection + drawing ----------
  select(piece) {
    if (this.sel && this.sel !== piece) this.home.setTint(this.sel, null);
    this.sel = piece; this.drawSel(); this.render();
  }

  drawSel() {
    const g = this.gfx; g.clear();
    const p = this.sel; if (!p) return;
    const r = rectOf(p, this.item(p.furniture_id)), ok = this.drag ? this.drag.valid !== false : true, c = ok ? OK : BAD;
    g.lineStyle(3, c, 1); g.strokeRoundedRect(r.l - 3, r.t - 3, r.r - r.l + 6, r.b - r.t + 6, 6);
    g.fillStyle(c, 1); [[r.l, r.t], [r.r, r.t], [r.l, r.b], [r.r, r.b]].forEach(([x, y]) => g.fillCircle(x, y, 5));
  }

  // ---------- pointer ----------
  pick(x, y) {
    const hits = this.home.pieces.filter((p) => { const r = rectOf(p, this.item(p.furniture_id)); return x >= r.l && x <= r.r && y >= r.t && y <= r.b; });
    hits.sort((a, b) => (this.item(a.furniture_id).walkable - this.item(b.furniture_id).walkable) || (b.sprite.depth - a.sprite.depth));
    return hits.includes(this.sel) && !this.item(this.sel.furniture_id).walkable ? this.sel : hits[0] || null;
  }

  pointerDown(p) {
    if (this.saving || this.blocked() || p.event?.target?.tagName !== 'CANVAS') return;
    const hit = this.pick(p.worldX, p.worldY);
    if (!hit) return this.select(null);
    if (hit !== this.sel) this.select(hit);
    this.drag = { piece: hit, dx: hit.x - p.worldX, dy: hit.y - p.worldY, sx: hit.x, sy: hit.y, moved: false, valid: true };
  }

  pointerMove(p) {
    const d = this.drag; if (!d) return;
    const it = this.item(d.piece.furniture_id);
    const c = clampCentre(snap(p.worldX + d.dx), snap(p.worldY + d.dy), it, d.piece.rotation);
    if (c.x !== d.piece.x || c.y !== d.piece.y) { this.home.place(d.piece, c.x, c.y); d.moved = true; }
    d.valid = isValid(d.piece, it, this.home.pieces, this.home.itemOf);
    this.home.setTint(d.piece, d.valid ? null : 0xff9a9a);
    this.drawSel();
  }

  pointerUp() {
    const d = this.drag; if (!d) return;
    this.drag = null;
    this.home.setTint(d.piece, null);
    if (d.moved) {
      if (d.valid) this.markDirty();
      else { this.home.place(d.piece, d.sx, d.sy); toast("Can't place it there"); }   // invalid drop: snap back
    }
    this.drawSel();
  }

  // ---------- actions ----------
  markDirty() { this.dirty = true; this.render(); }

  addFromTray(id) {
    const it = this.item(id);
    if (this.remaining(id) <= 0) return toast(`You've placed every ${it.name} you own`);
    if (this.home.pieces.length >= ROOM.maxPieces) return toast('This room is full');
    const spot = findFreeSpot(it, 0, this.home.pieces, this.home.itemOf);
    if (!spot) return toast('No free floor space left');
    const piece = this.home.add(id, spot.x, spot.y, 0);
    this.dirty = true; this.select(piece);
  }

  rotate() {
    const s = this.sel; if (!s) return;
    const it = this.item(s.furniture_id), rot = nextRotation(s.rotation), c = clampCentre(s.x, s.y, it, rot);
    const old = { x: s.x, y: s.y, rotation: s.rotation };
    this.home.place(s, c.x, c.y, rot);
    if (!isValid(s, it, this.home.pieces, this.home.itemOf)) { this.home.place(s, old.x, old.y, old.rotation); return toast('No room to rotate here'); }
    this.drawSel(); this.markDirty();
  }

  nudge(dx, dy) {
    const s = this.sel; if (!s) return;
    const it = this.item(s.furniture_id), c = clampCentre(s.x + dx, s.y + dy, it, s.rotation), old = { x: s.x, y: s.y };
    this.home.place(s, c.x, c.y);
    if (!isValid(s, it, this.home.pieces, this.home.itemOf)) this.home.place(s, old.x, old.y); else this.markDirty();
    this.drawSel();
  }

  removeSel() {
    if (!this.sel) return;
    this.home.remove(this.sel); this.sel = null; this.drawSel(); this.markDirty();
  }

  setTheme(key) { if (key === this.home.theme) return; this.home.setTheme(key); this.markDirty(); }

  async save() {
    if (this.saving) return;
    if (!this.dirty) return this.close();
    this.saving = true; this.render();
    try {
      const data = await saveRoom(this.home.theme, this.home.serialize());
      this.home.setTheme(data.room.theme); this.home.replaceAll(data.furniture);          // adopt exactly what the server stored
      this.dirty = false; this.saving = false;
      toast('Room saved!');
      this.close();
    } catch (e) {
      this.saving = false; this.render();
      toast(e.message || 'Could not save the room');
    }
  }

  cancel() {
    if (this.saving) return;
    if (this.dirty && !confirm('Discard your changes to this room?')) return;
    this.home.setTheme(this.snapshot.theme); this.home.replaceAll(this.snapshot.list);
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    const s = this.scene;
    s.input.off('pointerdown', this.onDown); s.input.off('pointermove', this.onMove); s.input.off('pointerup', this.onUp);
    s.scale.off('resize', this.fit); s.game.events.off('inventory-changed', this.onInv);
    removeEventListener('keydown', this.onKey);
    this.grid.destroy(); this.gfx.destroy(); this.el.remove(); this.ui.classList.remove('editing');
    this.home.enableColliders(true);
    const cam = s.cameras.main;
    s.fitView(); cam.setBounds(s.bounds.x, s.bounds.y, s.bounds.w, s.bounds.h); cam.startFollow(s.player.hitbox, true, 0.12, 0.12);
    this.onClose?.();
  }

  // Scene is shutting down (e.g. restart): drop DOM + listeners only; the scene tears down its own objects and camera.
  dispose() {
    if (this.closed) return;
    this.closed = true;
    removeEventListener('keydown', this.onKey);
    this.scene.game.events.off('inventory-changed', this.onInv);
    this.el.remove(); this.ui.classList.remove('editing');
    this.scene.game.events.emit('edit-mode', false);
  }

  // ---------- keyboard ----------
  blocked() { return document.body.classList.contains('shop-open'); }
  keyDown(e) {
    if (this.saving || this.blocked()) return;
    const k = e.key;
    if (k === 'r' || k === 'R') this.rotate();
    else if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); this.removeSel(); }
    else if (k === 'Escape') this.sel ? this.select(null) : this.cancel();
    else if (this.sel && k.startsWith('Arrow')) { e.preventDefault(); this.nudge(k === 'ArrowLeft' ? -ROOM.grid : k === 'ArrowRight' ? ROOM.grid : 0, k === 'ArrowUp' ? -ROOM.grid : k === 'ArrowDown' ? ROOM.grid : 0); }
  }

  // ---------- DOM ----------
  onClick(e) {
    const t = e.target.closest('[data-a]'); if (!t || t.disabled) return;
    const a = t.dataset.a;
    if (a === 'save') this.save();
    else if (a === 'cancel') this.cancel();
    else if (a === 'rotate') this.rotate();
    else if (a === 'remove') this.removeSel();
    else if (a === 'done') this.select(null);
    else if (a === 'tab') { this.tab = t.dataset.v; this.render(); }
    else if (a === 'add') this.addFromTray(t.dataset.v);
    else if (a === 'theme') this.setTheme(t.dataset.v);
    else if (a === 'shop') this.scene.game.events.emit('open-shop', 'furniture');
  }

  cards() {
    if (this.tab === 'theme') {
      return THEME_KEYS.map((k) => {
        const t = THEMES[k];
        return `<button class="ed-card theme ${this.home.theme === k ? 'on' : ''}" data-a="theme" data-v="${k}">
          <span class="sw2" style="background:linear-gradient(${hex(t.wall)} 0 45%,${hex(t.trim)} 45% 52%,${hex(t.floorA)} 52%)"></span><b>${t.name}</b></button>`;
      }).join('');
    }
    const owned = FURNITURE.filter((f) => qtyOf(this.profile, f.id) > 0);
    const list = owned.map((f) => {
      const left = this.remaining(f.id);
      return `<button class="ed-card r-${f.rarity} ${left <= 0 ? 'out' : ''}" data-a="add" data-v="${f.id}" title="${f.name} (${RARITY[f.rarity]})">
        <img src="${textureIcon(this.scene.game, f.asset, 50)}" alt=""><b>${f.name}</b><small>${left > 0 ? `×${left} left` : 'All placed'}</small></button>`;
    }).join('');
    const shop = `<button class="ed-card shopcard" data-a="shop"><span class="big">🛒</span><b>Furniture Shop</b><small>${owned.length ? 'Get more' : 'Buy your first piece'}</small></button>`;
    return (owned.length ? list : `<p class="ed-empty">You don't own any furniture yet. Buy some in the shop, then come back and place it.</p>`) + shop;
  }

  render() {
    if (this.closed) return;
    const keep = this.el.querySelector('.ed-cards')?.scrollLeft || 0;
    const s = this.sel, it = s && this.item(s.furniture_id);
    this.el.innerHTML = `
      <div class="ed-top">
        <div class="ed-title"><b>Decorating your room</b><small>${this.dirty ? 'Unsaved changes' : 'Drag furniture to move it'}</small></div>
        <button class="sbtn ghost" data-a="cancel" ${this.saving ? 'disabled' : ''}>Cancel</button>
        <button class="sbtn go" data-a="save" ${this.saving ? 'disabled' : ''}>${this.saving ? 'Saving…' : 'Save room'}</button>
      </div>
      <div class="ed-tray">
        <div class="ed-bar">
          <nav class="ed-tabs"><button class="${this.tab === 'furniture' ? 'on' : ''}" data-a="tab" data-v="furniture">🛋️ Furniture</button><button class="${this.tab === 'theme' ? 'on' : ''}" data-a="tab" data-v="theme">🎨 Theme</button></nav>
          ${s ? `<div class="ed-sel"><span>${it.name}</span>
            <button class="sbtn mini" data-a="rotate" title="Rotate (R)">⟳ Rotate</button>
            <button class="sbtn mini danger" data-a="remove" title="Remove (Delete)">🗑 Remove</button>
            <button class="sbtn mini ghost" data-a="done">Done</button></div>`
            : `<span class="ed-hint">${this.tab === 'theme' ? 'Pick a look for the walls and floor.' : 'Tap a piece below to add it, then drag it into place.'}</span>`}
        </div>
        <div class="ed-cards">${this.cards()}</div>
      </div>`;
    this.el.querySelector('.ed-cards').scrollLeft = keep;
  }
}
