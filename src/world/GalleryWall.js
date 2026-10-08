import { fetchWall, pictureUrl, niceWallError } from '../database/wall.js';
import { toast } from '../ui/hud.js';

// =====================================================================
// PHASE 15 — the Town Hall's endless picture wall.
//
// The hall is built in BAYS. One bay holds 10 pictures (5 columns, 2 rows) and is a fixed stretch of wall; every
// time the tenth picture of a bay is hung, the hall gains another bay and physically gets longer — the room bounds,
// the camera bounds and the floor all grow with it, so the wall really is endless rather than a scrolling list.
//
// Only the pictures near the player are ever downloaded. Each frame is drawn immediately (so an empty hall still
// looks like a hall), and its texture is fetched when the player walks within LOAD_NEAR and dropped again past
// LOAD_FAR. Walking the length of a thousand-picture hall therefore costs the same as walking past ten.
// =====================================================================
export const PER_BAY = 10, COLS = 5, ROWS = 2;
const PITCH_X = 190, SLOT_W = 150, SLOT_H = 112, ROW_Y = [250, 420];
const ENTRY_W = 520;                       // the doorway end of the hall, before the first bay
const BAY_W = COLS * PITCH_X;              // 950
const LOAD_NEAR = 1200, LOAD_FAR = 1900;

export class GalleryWall {
  constructor(scene, room) {
    this.scene = scene; this.room = room;
    this.slots = [];                        // { i, x, y, frame, art, pic, key, state }
    this.pictures = [];                     // rows from get_wall
    this.total = 0; this.bays = 0;
    this.loading = new Set();
    this.destroyed = false;
  }

  // How wide the hall is for a given number of pictures. Always at least one bay, always one spare bay at the end
  // so there is visibly somewhere for the next picture to go.
  static hallWidth(total) {
    const bays = Math.max(1, Math.floor(Math.max(0, total) / PER_BAY) + 1);
    return ENTRY_W + bays * BAY_W + 220;
  }
  static baysFor(total) { return Math.max(1, Math.floor(Math.max(0, total) / PER_BAY) + 1); }

  // ---------- building ----------
  build() {
    this.drawHall();
    this.refresh().catch(() => {});
  }

  drawHall() {
    const s = this.scene, room = this.room, w = room.w;
    this.bays = GalleryWall.baysFor(this.total);

    this.art?.destroy();
    const g = (this.art = s.add.graphics().setDepth(-600));

    // The long back wall. It has to reach BELOW both rows of frames, or the pictures look like they are lying on
    // the floor: panelling to the picture rail, plaster behind the frames, then skirting and the floor line.
    const WALL_H = 520;
    g.fillStyle(0x7d6a52); g.fillRect(0, 0, w, WALL_H);                       // plaster
    g.fillStyle(0x6b5a46); g.fillRect(0, 0, w, 150);                          // darker above the rail
    for (let x = 40; x < w; x += 120) { g.fillStyle(0x5d4c3a, 0.45); g.fillRect(x, 10, 6, 136); }
    g.fillStyle(0x8d7a60); g.fillRect(0, 150, w, 16);                         // picture rail
    g.fillStyle(0xd8c9a3); g.fillRect(0, 164, w, 7);
    g.fillStyle(0x6f5c48, 0.25);                                              // faint wainscot panels
    for (let x = 24; x < w - 24; x += 150) g.fillRoundedRect(x, WALL_H - 92, 118, 70, 6);
    g.fillStyle(0x8d7a60); g.fillRect(0, WALL_H - 22, w, 22);                 // skirting
    g.fillStyle(0xa58f70); g.fillRect(0, WALL_H - 24, w, 5);
    g.fillStyle(0x16304a, 0.14); g.fillRect(0, WALL_H, w, 16);                // shadow where wall meets floor

    // bay markers: a pilaster and a lamp between each bay, so growth is visible as architecture
    for (let b = 0; b <= this.bays; b++) {
      const bx = ENTRY_W + b * BAY_W - 26;
      if (bx < 10 || bx > w - 10) continue;
      g.fillStyle(0x8d7a60); g.fillRect(bx, 150, 34, 370);
      g.fillStyle(0x6b5a46); g.fillRect(bx + 4, 150, 8, 370);
      g.fillStyle(0xa58f70); g.fillRect(bx - 6, 498, 46, 22);
      g.fillStyle(0xd8c9a3); g.fillRect(bx - 6, 186, 46, 14);
      g.fillStyle(0xfff0b0); g.fillCircle(bx + 17, 214, 13);               // wall lamp
      g.fillStyle(0x3a3f4b); g.fillRoundedRect(bx + 8, 200, 18, 8, 3);
      const pool = s.add.ellipse(bx + 17, 580, 230, 90, 0xffc247, 0.1).setDepth(-595).setBlendMode(Phaser.BlendModes.ADD);
      if (!s.registry.get('reduceMotion')) s.tweens.add({ targets: pool, alpha: 0.05, duration: 2600, yoyo: true, repeat: -1 });
    }

    // a civic banner over the entrance end
    g.fillStyle(0x3d5a80); g.fillRoundedRect(90, 206, 320, 74, 10);
    g.fillStyle(0x4f74a0); g.fillRoundedRect(96, 212, 308, 62, 8);
    s.add.text(250, 243, '⚓ THE PEOPLE OF\nANCHORS WORLD', {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#f4fbff', align: 'center',
    }).setOrigin(0.5).setDepth(-590);

    this.layoutSlots();
  }

  // One empty frame per slot in every bay that exists.
  layoutSlots() {
    this.slots.forEach((sl) => { sl.frame.destroy(); sl.art?.destroy(); sl.cap?.destroy(); });
    this.slots = [];
    const s = this.scene, count = this.bays * PER_BAY;
    for (let i = 0; i < count; i++) {
      const bay = Math.floor(i / PER_BAY), within = i % PER_BAY;
      const col = within % COLS, row = Math.floor(within / COLS);
      const x = ENTRY_W + bay * BAY_W + col * PITCH_X + PITCH_X / 2 - 22;
      const y = ROW_Y[row] ?? ROW_Y[0];
      this.slots.push({ i, x, y, ...this.drawFrame(x, y), state: 'empty', pic: null });
    }
    this.hangKnown();
  }

  drawFrame(x, y) {
    const s = this.scene, g = s.add.graphics().setDepth(-580);
    g.fillStyle(0x16304a, 0.25); g.fillRoundedRect(x - SLOT_W / 2 + 4, y - SLOT_H / 2 + 8, SLOT_W, SLOT_H, 6);
    g.fillStyle(0x7a4f2f); g.fillRoundedRect(x - SLOT_W / 2, y - SLOT_H / 2, SLOT_W, SLOT_H, 6);
    g.fillStyle(0xc9a227); g.fillRoundedRect(x - SLOT_W / 2 + 5, y - SLOT_H / 2 + 5, SLOT_W - 10, SLOT_H - 10, 4);
    g.fillStyle(0xe8e0cf); g.fillRect(x - SLOT_W / 2 + 10, y - SLOT_H / 2 + 10, SLOT_W - 20, SLOT_H - 20);
    g.fillStyle(0xcfc6b2); g.fillRect(x - SLOT_W / 2 + 10, y + SLOT_H / 2 - 30, SLOT_W - 20, 20);
    g.lineStyle(3, 0xb9ae96); g.strokeRect(x - SLOT_W / 2 + 10, y - SLOT_H / 2 + 10, SLOT_W - 20, SLOT_H - 20);
    return { frame: g };
  }

  // ---------- data ----------
  async refresh() {
    if (this.destroyed) return;
    try {
      const d = await fetchWall(0, 120);
      if (this.destroyed) return;
      this.pictures = d.pictures || [];
      this.myCount = d.mine || 0; this.limit = d.limit || 3;
      const grew = GalleryWall.baysFor(d.total) > this.bays;
      this.total = d.total || 0;
      if (grew) this.grow(); else this.hangKnown();
      this.scene.game.events.emit('wall-state', { total: this.total, mine: this.myCount, limit: this.limit });
    } catch (e) {
      this.error = niceWallError(e);
      this.scene.game.events.emit('wall-state', { error: this.error });
    }
  }

  // Another ten pictures: the hall physically gets longer, right where the player is standing.
  grow() {
    const s = this.scene, room = this.room;
    room.w = GalleryWall.hallWidth(this.total);
    s.physics.world.setBounds(0, 0, room.w, room.h);
    s.cameras.main.setBounds(0, 0, room.w, room.h);
    this.floor?.destroy();
    this.floor = s.add.tileSprite(0, 0, room.w, room.h, room.floor).setOrigin(0).setDepth(-1000);
    this.drawHall();
    toast('🏛️ The hall grows — a new bay opens up!');
  }

  hangKnown() {
    for (const sl of this.slots) {
      const pic = this.pictures[sl.i] || null;
      if (pic && sl.pic?.id === pic.id) continue;
      sl.pic = pic;
      sl.cap?.destroy(); sl.cap = null;
      if (sl.art) { sl.art.destroy(); sl.art = null; }
      sl.state = pic ? 'waiting' : 'empty';
      if (pic) this.label(sl, pic);
    }
    this.scene.rebuildWallDoors?.();
  }

  label(sl, pic) {
    const text = (pic.caption || '').trim() || (pic.display_name ? `— ${pic.display_name}` : '');
    if (!text) return;
    sl.cap = this.scene.add.text(sl.x, sl.y + SLOT_H / 2 - 20, text, {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#4a3200',
      wordWrap: { width: SLOT_W - 26 }, align: 'center',
    }).setOrigin(0.5).setDepth(-575);
  }

  // ---------- lazy textures ----------
  update() {
    if (this.destroyed || !this.slots.length) return;
    const px = this.scene.player.x;
    for (const sl of this.slots) {
      if (!sl.pic) continue;
      const d = Math.abs(sl.x - px);
      if (sl.state === 'waiting' && d < LOAD_NEAR) this.loadPicture(sl);
      else if (sl.state === 'shown' && d > LOAD_FAR) this.unload(sl);
    }
  }

  loadPicture(sl) {
    const s = this.scene, pic = sl.pic, key = `wallpic:${pic.id}`;
    sl.state = 'loading';
    if (s.textures.exists(key)) return this.show(sl, key);
    const url = pictureUrl(pic.path);
    if (!url) { sl.state = 'failed'; return; }
    if (this.loading.has(key)) return;
    this.loading.add(key);
    s.load.image(key, url);
    const done = () => { this.loading.delete(key); if (this.destroyed || sl.pic?.id !== pic.id) return;
      if (s.textures.exists(key)) this.show(sl, key); else { sl.state = 'failed'; this.showBroken(sl); } };
    s.load.once('complete', done);
    s.load.once('loaderror', () => { this.loading.delete(key); if (!this.destroyed && sl.pic?.id === pic.id) { sl.state = 'failed'; this.showBroken(sl); } });
    s.load.start();
  }

  show(sl, key) {
    if (sl.art) sl.art.destroy();
    const s = this.scene, iw = SLOT_W - 22, ih = SLOT_H - 22;
    const img = s.add.image(sl.x, sl.y - 6, key).setDepth(-578);
    const t = s.textures.get(key).getSourceImage();
    const k = Math.min(iw / t.width, ih / t.height);
    img.setScale(k);
    sl.art = img; sl.state = 'shown';
    if (!s.registry.get('reduceMotion')) { img.setAlpha(0); s.tweens.add({ targets: img, alpha: 1, duration: 260 }); }
  }

  showBroken(sl) {
    sl.art?.destroy();
    sl.art = this.scene.add.text(sl.x, sl.y - 6, '🖼️', { fontSize: '34px' }).setOrigin(0.5).setDepth(-578).setAlpha(0.5);
  }

  unload(sl) {
    const key = sl.art?.texture?.key;
    sl.art?.destroy(); sl.art = null; sl.state = 'waiting';
    if (key && key.startsWith('wallpic:') && this.scene.textures.exists(key)) this.scene.textures.remove(key);
  }

  // The nearest hung picture to the player, for the "press E to look" prompt.
  nearest(maxDist = 150) {
    const p = this.scene.player; let best = null, bd = maxDist;
    for (const sl of this.slots) {
      if (!sl.pic) continue;
      const d = Math.hypot(sl.x - p.x, sl.y + 120 - p.y);
      if (d < bd) { bd = d; best = sl; }
    }
    return best;
  }

  destroy() {
    this.destroyed = true;
    for (const sl of this.slots) { sl.frame?.destroy(); sl.art?.destroy(); sl.cap?.destroy(); }
    this.slots = []; this.floor?.destroy(); this.art?.destroy();
    for (const key of this.loading) this.scene.textures.exists(key) && this.scene.textures.remove(key);
    this.loading.clear();
  }
}
