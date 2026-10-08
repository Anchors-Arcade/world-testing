import { FURNITURE_BY_ID } from '../shops/furniture.js';
import { ROOM, DEFAULT_THEME, rectOf } from './roomRules.js';
import { THEMES } from './themes.js';

let uidSeq = 0;

// Everything that makes a RoomScene a *home*: themed floor/walls, furniture sprites, solid colliders.
// It belongs to one scene instance and knows nothing about Supabase: the scene feeds it data from get_room(),
// and RoomEditor mutates it through place()/add()/remove() and reads it back with serialize().
// `owner` identifies whose room this is, so visiting a friend's room later is just a different get_room() call.
export class HomeRoom {
  constructor(scene, { ownerId, isOwner }) {
    this.scene = scene; this.ownerId = ownerId; this.isOwner = isOwner;
    this.ownerName = ''; this.theme = DEFAULT_THEME; this.pieces = []; this.loaded = false; this.destroyed = false;
    this.colliders = [];
    this.shell = scene.add.graphics().setDepth(-1000);
    this.title = scene.add.text(ROOM.w / 2, 38, '', { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#ffffff', stroke: '#16304a', strokeThickness: 5 })
      .setOrigin(0.5).setDepth(-990);
    this.drawShell();
  }

  itemOf = (id) => FURNITURE_BY_ID[id];

  // ---------- room shell ----------
  setTheme(key) { this.theme = THEMES[key] ? key : DEFAULT_THEME; this.drawShell(); }

  drawShell() {
    const t = THEMES[this.theme], g = this.shell, { w, h, wall } = ROOM;
    g.clear();
    g.fillStyle(t.floorA); g.fillRect(0, wall, w, h - wall);
    g.fillStyle(t.floorB);
    for (let y = wall, row = 0; y < h; y += 40, row++) {                              // plank rows, staggered joints
      g.fillRect(0, y, w, 3);
      for (let x = row % 2 ? 90 : 20; x < w; x += 160) g.fillRect(x, y, 3, 40);
    }
    g.fillStyle(t.wall); g.fillRect(0, 0, w, wall);
    g.fillStyle(0x000000, 0.1); g.fillRect(0, wall - 46, w, 46);                          // wainscot
    g.fillStyle(t.trim); g.fillRect(0, wall - 10, w, 10); g.fillRect(0, 0, w, 8);        // skirting + crown
    g.fillStyle(0x000000, 0.14); g.fillRect(0, wall, w, 10);                              // shadow where wall meets floor
    [[170, 'a'], [w - 250, 'b']].forEach(([x]) => {                                       // two windows with a snowy night outside
      g.fillStyle(t.trim); g.fillRoundedRect(x - 6, 52, 92, 70, 8);
      g.fillStyle(0x16304a); g.fillRoundedRect(x, 58, 80, 58, 5);
      g.fillStyle(0xffffff, 0.9); [[12, 14], [40, 30], [62, 18], [26, 44], [58, 46]].forEach(([dx, dy]) => g.fillCircle(x + dx, 58 + dy, 2));
      g.fillStyle(t.trim); g.fillRect(x + 38, 58, 4, 58); g.fillRect(x, 85, 80, 4);
    });
    g.fillStyle(t.glow, 0.08); g.fillEllipse(w / 2, wall + 160, w * 0.8, 260);              // warm light pool
    // doormat in the doorway strip
    g.fillStyle(0x000000, 0.18); g.fillRoundedRect(w / 2 - 90, ROOM.floorBottom + 14, 180, 70, 14);
    g.fillStyle(t.trim); g.fillRoundedRect(w / 2 - 82, ROOM.floorBottom + 20, 164, 58, 10);
  }

  setTitle(text) { this.title.setText(text); }

  // ---------- furniture ----------
  load(data) {
    this.loaded = true;
    this.ownerName = data.room?.owner_name || '';
    this.setTheme(data.room?.theme);
    this.replaceAll(data.furniture || []);
    this.enableColliders(true);
  }

  replaceAll(list) {
    this.pieces.forEach((p) => p.sprite.destroy());
    this.pieces = [];
    for (const f of list) if (this.itemOf(f.furniture_id)) this.add(f.furniture_id, f.x, f.y, f.rotation);
  }

  add(furniture_id, x, y, rotation = 0) {
    const item = this.itemOf(furniture_id);
    const piece = { uid: ++uidSeq, furniture_id, x, y, rotation, sprite: this.scene.add.image(x, y, item.asset) };
    this.pieces.push(piece);
    this.place(piece, x, y, rotation);
    return piece;
  }

  // Visual update only. Colliders are rebuilt in one go when editing ends.
  place(piece, x, y, rotation = piece.rotation) {
    piece.x = x; piece.y = y; piece.rotation = rotation;
    const item = this.itemOf(piece.furniture_id), r = rectOf(piece, item);
    piece.sprite.setPosition(x, y).setAngle(rotation).setDepth(item.walkable ? -400 : r.b);
  }

  remove(piece) {
    piece.sprite.destroy();
    this.pieces = this.pieces.filter((p) => p !== piece);
  }

  setTint(piece, color) { color == null ? piece.sprite.clearTint() : piece.sprite.setTint(color); }

  serialize() { return this.pieces.map(({ furniture_id, x, y, rotation }) => ({ furniture_id, x, y, rotation })); }

  count(furniture_id) { return this.pieces.reduce((n, p) => n + (p.furniture_id === furniture_id), 0); }

  // ---------- collisions (solid pieces only; rugs are walk-over) ----------
  enableColliders(on) {
    for (const c of this.colliders) this.scene.walls.remove(c, true, true);
    this.colliders = [];
    if (!on) return;
    for (const p of this.pieces) {
      const item = this.itemOf(p.furniture_id);
      if (item.walkable) continue;
      const r = rectOf(p, item), c = this.scene.add.rectangle((r.l + r.r) / 2, (r.t + r.b) / 2, r.r - r.l, r.b - r.t, 0, 0);
      this.scene.walls.add(c);
      this.colliders.push(c);
    }
  }

  destroy() {
    this.destroyed = true;
    this.colliders = [];           // the scene tears down its own physics group; destroying game objects twice is a no-op
    this.pieces.forEach((p) => p.sprite.destroy());
    this.pieces = [];
    this.shell.destroy(); this.title.destroy();
  }
}
