import { ROOMS } from '../maps/rooms.js';
import { skyTexture, mountainTextures, decorTextures, buildingTexture } from '../utils/worldArt.js';
import { Avatar } from '../entities/Avatar.js';
import { toast } from '../ui/hud.js';
import { RemotePlayers } from '../multiplayer/RemotePlayers.js';
import { HomeRoom } from '../rooms/HomeRoom.js';
import { RoomEditor } from '../rooms/RoomEditor.js';
import { ROOM, rectOf } from '../rooms/roomRules.js';
import { fetchRoom } from '../database/rooms.js';
import { WorldLayer } from '../world/WorldLayer.js';
import { SkiArea } from '../world/SkiArea.js';
import { SKI_ROUTES } from '../world/skiAreas.js';
import { drawSprite, spriteFor, captionOf } from '../utils/sprites.js';
import { GalleryWall } from '../world/GalleryWall.js';
import { wallTotal } from '../database/wallCache.js';
import { GAMES } from '../minigames/registry.js';
import { bestOf } from '../minigames/scoreSystem.js';

const DOOR_W = 70, DOOR_H = 56;

export class RoomScene extends Phaser.Scene {
  constructor() { super('Room'); }

  init(data) {
    this.roomId = ROOMS[data.roomId] ? data.roomId : 'snowy_plaza';
    this.fromRoom = data.from || null;
    // 'home' is a template: the owner decides whose layout loads. Presence channel is per owner so every room is separate.
    const profile = this.registry.get('profile');
    this.ownerId = this.roomId === 'home' ? (data.ownerId || profile.id) : null;
    this.channelId = this.ownerId ? `home:${this.ownerId}` : this.roomId;
    this.editing = false; this.uiLocked = false; this.editor = null; this.home = null; this.loadToken = 0;
    this.world = null; this.secretPortals = new Set();                      // Phase 8: exploration layer + revealed secret doors
    this.leaving = false; this.target = null; this.pendingDoor = null; this.stuck = 0;
  }

  create() {
    const room = ROOMS[this.roomId], profile = this.registry.get('profile');
    this.room = room; this.doors = [];
    this.explore = this.registry.get('exploration') || null;                // Phase 8: collectibles / secrets / achievements
    this.cameras.main.setBackgroundColor(room.sky ?? 0x0e2238).fadeIn(250);
    // Phase 15: a gallery room is as long as its picture count requires (and always has one spare bay).
    if (room.gallery) room.w = GalleryWall.hallWidth(wallTotal());
    this.physics.world.setBounds(0, 0, room.w, room.h);
    this.walls = this.physics.add.staticGroup();

    this.drawFloor(room);
    (room.buildings || []).forEach((b) => this.addBuilding(b));
    (room.props || []).forEach((p) => this.addProp(p));                                            // Phase 8: ice, rocks, crystals, docks
    (room.blocks || []).forEach((b) => this.addBlock(b));
    (room.trees || []).forEach(([x, y]) => this.addTree(x, y));
    // Phase 8: a portal with `secret` is a hidden entrance — it exists only once that secret has been discovered.
    // A portal with `secret` is a hidden entrance. It opens either because the secret unlocks that room outright
    // (Crystal Hollow, Star Chamber) or simply because the secret has been discovered (the Hidden Valley slope,
    // whose secret unlocks no room of its own — it used to be permanently sealed because of that).
    (room.portals || []).forEach((p) => { if (!p.secret) this.addPortal(p); else if (this.secretOpen(p)) this.addSecretPortal(p, true); });
    (room.kiosks || []).forEach((k) => this.addKiosk(k));
    (room.cabinets || []).forEach((c) => this.addCabinet(c));
    (room.activities || []).forEach((a) => this.addActivity(a));
    // Phase 12: ski lift station / sled route, if this room has one. Same pattern as everything above.
    this.ski = (room.lift || room.sled) ? new SkiArea(this, room) : null;
    this.ski?.build();                                 // Phase 10: one minigame per map                                   // Phase 7: arcade machines + leaderboard board
    if (room.indoor) { const wall = this.addWall(0, 0, room.w, 150, room.wallColor ?? 0x7a4f2f); if (room.type === 'home') wall.setAlpha(0); }   // homes draw their own themed wall

    const s = this.spawnPoint(room);
    this.player = new Avatar(this, s.x, s.y, profile.avatar_data, profile.display_name);
    this.physics.add.collider(this.player.hitbox, this.walls);

    const cam = this.cameras.main;
    this.setupView(room);
    cam.startFollow(this.player.hitbox, true, 0.12, 0.12);

    if (room.sign) this.addSign(room);
    this.addAmbience(room);                                 // Phase 9: aurora, weather, cave haze, warm light
    this.setupInput();

    // Phase 15: the picture wall, if this room has one.
    if (room.gallery) { this.gallery = new GalleryWall(this, room); this.gallery.build(); }

    // Phase 8: build THIS room's interactive objects and collectibles (and nothing from any other room).
    if (this.explore && room.type !== 'home') this.world = new WorldLayer(this, this.explore);

    // Phase 6: tell the social layer where I am (friends see it only if my privacy setting allows)
    this.registry.get('social')?.setLocation(this.roomId, this.ownerId);

    // multiplayer (no-op for guests) + live outfit changes from the wardrobe
    this.mp = new RemotePlayers(this, this.registry.get('net'), profile, this.channelId);
    this.onOutfit = (av) => { this.player.setOutfit(av); this.mp.outfit(av); };
    this.game.events.on('outfit-changed', this.onOutfit);
    this.onLock = (v) => { this.uiLocked = v; if (v) { this.target = null; this.pendingDoor = null; this.player.move(0, 0); } };
    this.game.events.on('ui-lock', this.onLock);
    // Phase 6: typing in chat must not walk the avatar (Phaser would also swallow WASD/E keystrokes from the text box)
    this.onTyping = (v) => {
      const kb = this.input.keyboard; if (!kb) return;
      if (v) { kb.enabled = false; kb.disableGlobalCapture(); kb.resetKeys(); } else { kb.enabled = true; kb.enableGlobalCapture(); }
    };
    this.onEmote = (key) => !this.leaving && !this.editing && this.mp.myEmote(key);
    this.onJoinRoom = (req) => this.joinRoom(req);
    this.game.events.on('typing', this.onTyping); this.game.events.on('emote', this.onEmote); this.game.events.on('join-room', this.onJoinRoom);
    this.events.once('shutdown', () => {
      this.game.events.off('outfit-changed', this.onOutfit); this.game.events.off('ui-lock', this.onLock);
      this.game.events.off('typing', this.onTyping); this.game.events.off('emote', this.onEmote); this.game.events.off('join-room', this.onJoinRoom);
      this.input.keyboard && (this.input.keyboard.enabled = true);
      this.editor?.dispose(); this.editor = null; this.home?.destroy(); this.loadToken++;
      this.world?.destroy(); this.world = null;
      this.gallery?.destroy(); this.gallery = null;
      this.mp.destroy();
      this.game.events.emit('home-left');
    });
    this.game.events.emit('room-entered', this.roomId, room.name, this.channelId);
    if (room.type === 'home') this.setupHome(profile);
  }

  // ---------- player rooms ----------
  async setupHome(profile) {
    const isOwner = this.ownerId === profile.id, token = ++this.loadToken;
    this.home = new HomeRoom(this, { ownerId: this.ownerId, isOwner });
    this.home.setTitle(isOwner ? 'My Room' : 'Room');
    this.game.events.emit('home-ready', { isOwner, guest: !!profile.guest });
    if (profile.guest) { this.home.loaded = true; return toast('Guest rooms are empty and not saved. Create an account to decorate!'); }
    try {
      const data = await fetchRoom(this.ownerId);                                   // own room, or (later) a friend's
      if (token !== this.loadToken || this.home.destroyed) return;                  // scene changed while loading
      this.home.load(data);
      const owner = data.room.owner_name || 'Player', title = data.is_owner ? 'My Room' : `${owner}'s Room`;
      this.home.setTitle(title);
      this.game.events.emit('room-title', title);
    } catch (e) {
      toast('Could not load the room: ' + e.message);
      if (!isOwner && token === this.loadToken) this.leaveTo('snowy_plaza');       // not allowed in (private / blocked / visits off): back to the plaza
    }
  }

  startEdit() {
    const profile = this.registry.get('profile');
    if (!this.home || !this.home.isOwner || this.editing || this.leaving || this.uiLocked) return;
    if (profile.guest) return toast('Create an account to decorate your room');
    if (!this.home.loaded) return toast('Your room is still loading…');
    this.editing = true; this.target = null; this.pendingDoor = null; this.player.move(0, 0);
    this.game.events.emit('edit-mode', true);
    this.editor = new RoomEditor(this, this.home, { profile, onClose: () => {
      this.editing = false; this.editor = null; this.rescuePlayer();
      this.game.events.emit('edit-mode', false);
    } });
  }

  // If a freshly placed piece landed on top of the avatar, put the avatar back in the (always clear) doorway strip.
  rescuePlayer() {
    const p = this.player, hb = new Phaser.Geom.Rectangle(p.x - 13, p.y - 7, 26, 14);
    const stuck = this.home.pieces.some((pc) => {
      const it = this.home.itemOf(pc.furniture_id); if (it.walkable) return false;
      const r = rectOf(pc, it);
      return Phaser.Geom.Intersects.RectangleToRectangle(hb, new Phaser.Geom.Rectangle(r.l, r.t, r.r - r.l, r.b - r.t));
    });
    if (stuck) p.hitbox.body.reset(ROOM.w / 2, ROOM.floorBottom + 35);
  }

  // Phase 6: travel to a room by key (Map, or "Join" on a friend). For another player's home the SERVER decides
  // (get_room -> can_view_room: friends/visibility/blocks/"allow visits"), and we check BEFORE leaving so a refusal costs nothing.
  async joinRoom({ room, ownerId = null } = {}) {
    const profile = this.registry.get('profile');
    if (this.leaving || this.editing || this.uiLocked) return;
    if (!ROOMS[room]) return toast('That place is not open yet');
    const own = room === 'home' ? (ownerId || profile.id) : null;
    if (room === this.roomId && own === this.ownerId) return toast("You're already here");
    if (room === 'home' && own !== profile.id) {
      if (profile.guest) return toast('Create an account to visit rooms');
      try { await fetchRoom(own); } catch (e) { return toast(e.message || 'You cannot enter that room'); }
      if (this.leaving || !this.scene.isActive()) return;
    }
    this.leaveTo(room, own);
  }

  leaveTo(room, ownerId = null) {
    if (this.leaving) return;
    this.leaving = true; this.target = null; this.pendingDoor = null; this.player.move(0, 0);
    this.cameras.main.fadeOut(220);
    const next = { roomId: room };                              // no `from`: the player spawns at the room's default spawn point
    if (room === 'home') next.ownerId = ownerId || this.registry.get('profile').id;
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart(next));
  }

  goHome() {
    const profile = this.registry.get('profile');
    if (this.leaving || this.editing || this.uiLocked) return;
    if (this.roomId === 'home' && this.ownerId === profile.id) return toast("You're already home");
    this.leaving = true; this.player.move(0, 0);
    this.cameras.main.fadeOut(220);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ roomId: 'home', from: this.roomId, ownerId: profile.id }));
  }

  // ---------- world building ----------
  // Phase 9: floor + trodden paths + a per-room colour wash, so every place reads differently at a glance.
  // `paths: [[x, y, w, h]]` is optional room data; a snow room with none falls back to the Phase 1 plaza paths.
  // ---------- full-screen view ----------
  // The camera ZOOMS to cover the whole window (never letterboxes), so there is no empty/black area at any window size.
  // Outdoor rooms get an extended border (mountains to the north, snowy margins elsewhere) that the camera may look at
  // but the player cannot walk into (physics bounds stay the room's size).
  setupView(room) {
    const outdoor = !room.indoor && room.type !== 'home' && room.floor !== 'cave' && !room.vignette && room.mountains !== false;
    const T = outdoor ? 380 : 0, M = outdoor ? 170 : 0;
    this.bounds = { x: -M, y: -T, w: room.w + M * 2, h: room.h + T + M }; this.hasBackdrop = outdoor;
    if (outdoor) this.addBackdrop(room, this.bounds, M);
    this.fitView();
    this.cameras.main.setBounds(this.bounds.x, this.bounds.y, this.bounds.w, this.bounds.h);
  }

  fitView() {
    const cam = this.cameras.main, B = this.bounds, W = this.scale.width, H = this.scale.height;
    const z = Math.min(4, Math.max(1, W / B.w, H / B.h));
    cam.setZoom(z);
    // screen-space (scrollFactor 0) objects are scaled about the screen centre by the zoom: this is the rectangle they must cover
    this.view = { x: W / 2 - W / (2 * z), y: H / 2 - H / (2 * z), w: W / z, h: H / z, z };
  }

  addBackdrop(room, B, M) {
    decorTextures(this);
    const sky = skyTexture(this, room.sky ?? 0x14314f), [far, mid, near] = mountainTextures(this);
    this.add.image(B.x, B.y, sky).setOrigin(0).setDisplaySize(B.w, -B.y + 8).setDepth(-1200);
    // snowy margin around the playable area (the map itself is drawn over it)
    this.add.tileSprite(B.x, 0, B.w, B.y + B.h > 0 ? B.h + B.y : B.h, 'snow').setOrigin(0).setDepth(-1002);
    if (room.stars) {                                                                  // stars live in the sky, above the mountains
      const g = this.add.graphics().setDepth(-1195).setScrollFactor(0.1, 1);
      for (let i = 0; i < 70; i++) { g.fillStyle(0xffffff, 0.25 + Math.random() * 0.6); g.fillCircle(B.x + Math.random() * (B.w + 300), B.y + Math.random() * -B.y * 0.75, Math.random() * 1.6 + 0.5); }
    }
    [[far, 0.18, -1190], [mid, 0.34, -1180], [near, 0.5, -1170]].forEach(([k, sx, d]) =>
      this.add.image(B.x * (1 + sx), 8, k).setOrigin(0, 1).setScale(2).setScrollFactor(sx, 1).setDepth(d));
    // low-cost scenery in the margins: fences (with gaps for exits), snowbanks, rocks, a few extra pines
    const r = (() => { let a = room.w + room.h; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
    const gaps = (room.portals || []).map((p) => [p.x - 50, p.x + p.w + 50, p.y - 50, p.y + p.h + 50]);
    const free = (x, y) => !gaps.some(([a, b, c, d]) => x > a && x < b && y > c && y < d);
    const fence = (x, y, len, depth) => { if (free(x + len / 2, y)) this.add.tileSprite(x, y, len, 44, 'deco_fence').setOrigin(0, 1).setDepth(depth); };
    for (let x = 0; x < room.w; x += 256) { fence(x, room.h + 30, 256, room.h + 30); }                          // south fence
    for (let y = 0; y < room.h; y += 256) { fence(-34, y + 256, 64, y + 256 + 1); fence(room.w - 30, y + 256, 64, y + 256 + 1); }
    for (let i = 0; i < 16; i++) {
      const edge = i % 4, x = edge === 0 ? -M * 0.2 - r() * M * 0.7 : edge === 1 ? room.w + M * 0.2 + r() * M * 0.7 : r() * room.w, y = edge < 2 ? r() * room.h : room.h + 60 + r() * (M - 80);
      if (!free(x, y)) continue;
      this.add.image(x, y, i % 3 ? 'deco_bank' : 'deco_rock').setOrigin(0.5, 0.9).setDepth(y).setScale(0.8 + r() * 0.7).setFlipX(r() > 0.5);
    }
    for (let i = 0; i < 14; i++) {
      const left = i % 2, x = left ? -20 - r() * (M - 40) : room.w + 20 + r() * (M - 40), y = 60 + r() * (room.h + M - 90);
      if (!free(x, y)) continue;
      this.add.image(x, y, 'pine').setOrigin(0.5, 0.97).setDepth(y).setScale(0.75 + r() * 0.55).setTint(0xcfe0ea);
    }
  }

  drawFloor(room) {
    if (room.type === 'home') return;                       // HomeRoom draws the themed floor and walls
    this.add.tileSprite(0, 0, room.w, room.h, room.floor).setOrigin(0).setDepth(-1000);

    const paths = room.paths || (room.floor === 'snow' && !room.indoor
      ? [[room.w / 2 - 140, 300, 280, room.h - 300], [150, 430, room.w - 300, 110]]
      : null);
    // Phase 13: a path is trodden snow, not a translucent box. Three softening passes and a scatter of
    // boot prints, with no hard outline, so walkways read as ground rather than as UI.
    if (paths) {
      const g = this.add.graphics().setDepth(-999);
      for (const [x, y, w, h] of paths) {
        const r = Math.min(60, Math.min(w, h) / 2);
        g.fillStyle(0xdceefa, 0.3); g.fillRoundedRect(x - 10, y - 10, w + 20, h + 20, r + 10);
        g.fillStyle(0xcfe6f4, 0.45); g.fillRoundedRect(x, y, w, h, r);
        g.fillStyle(0xc3dcee, 0.4); g.fillRoundedRect(x + 12, y + 12, w - 24, h - 24, Math.max(4, r - 12));
        g.fillStyle(0xaecbe0, 0.35);                                        // boot prints down the middle
        const along = w > h, n = Math.floor((along ? w : h) / 54);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n, px = along ? x + w * t : x + w / 2 + (i % 2 ? 11 : -11);
          const py = along ? y + h / 2 + (i % 2 ? 11 : -11) : y + h * t;
          g.fillEllipse(px, py, 13, 9);
        }
      }
    }
    if (room.wash) this.add.rectangle(0, 0, room.w, room.h, room.wash[0], room.wash[1]).setOrigin(0).setDepth(-995).setBlendMode(Phaser.BlendModes.MULTIPLY);
  }

  // One place to say what a room FEELS like. All of it is optional room data:
  //   sky, wash, fx ('snow' | 'blizzard' | 'embers' | 'sparkle' | 'dust' | 'none'), aurora, vignette, stars
  addAmbience(room) {
    const calm = this.registry.get('reduceMotion');
    if (room.stars && !this.hasBackdrop) {                  // night sky showing through a window or a cave mouth
      const g = this.add.graphics().setDepth(-994).setScrollFactor(0.25);
      for (let i = 0; i < 60; i++) { g.fillStyle(0xffffff, 0.25 + Math.random() * 0.6); g.fillCircle(Math.random() * room.w, Math.random() * room.h * 0.5, Math.random() * 1.8 + 0.5); }
    }
    if (room.aurora) {                                      // northern lights: three soft bands, slow drift
      [[0x8ff0b3, 0.18, 120], [0x66e8ff, 0.14, 190], [0xb48cff, 0.12, 260]].forEach(([c, a, y], i) => {
        const band = this.add.ellipse(room.w / 2, this.hasBackdrop ? y - 400 : y, room.w * 1.5, 150 + i * 30, c, a).setDepth(this.hasBackdrop ? -1185 : -993).setScrollFactor(0.3, this.hasBackdrop ? 1 : 0.3).setBlendMode(Phaser.BlendModes.ADD);
        if (!calm) this.tweens.add({ targets: band, x: room.w / 2 + (i % 2 ? 90 : -90), scaleY: 1.3, alpha: a * 0.45, duration: 7000 + i * 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      });
    }
    if (room.vignette) this.drawVignette();                 // caves and lamp rooms: dark at the edges
    const fx = room.fx ?? (room.indoor ? 'none' : 'snow');
    if (fx !== 'none' && !calm) this.addWeather(fx);

    // Phase 10: weather and the vignette are drawn in SCREEN space, so they have to be rebuilt when the window
    // changes size — rotating a phone, dragging a window, entering or leaving fullscreen. Debounced, so a drag
    // that fires fifty resize events rebuilds once.
    this.onResize = () => {
      this.fitView();                                       // cover the new window immediately (cheap); heavy rebuilds are debounced
      clearTimeout(this.resizeT);
      this.resizeT = setTimeout(() => {
        if (!this.scene.isActive()) return;
        this.weather?.destroy(); this.weather = null;
        this.vignette?.destroy(); this.vignette = null;
        if (room.vignette) this.drawVignette();
        if (fx !== 'none' && !this.registry.get('reduceMotion')) this.addWeather(fx);
      }, 180);
    };
    this.scale.on('resize', this.onResize);
    this.events.once('shutdown', () => { clearTimeout(this.resizeT); this.scale.off('resize', this.onResize); });
  }

  drawVignette() {
    const g = this.add.graphics().setDepth(1.9e6).setScrollFactor(0);
    const { x: vx, y: vy, w, h } = this.view;                  // zoom-aware screen rectangle
    for (let i = 0; i < 10; i++) {
      const b = 26 * (10 - i) / 3, sx = 30 * (10 - i) / 3;
      g.fillStyle(0x000000, 0.055);
      g.fillRect(vx, vy, w, b); g.fillRect(vx, vy + h - b, w, b); g.fillRect(vx, vy, sx, h); g.fillRect(vx + w - sx, vy, sx, h);
    }
    this.vignette = g;
  }

  // Weather and floating motes. One emitter, screen-space, so it costs the same in a big room as a small one.
  addWeather(kind) {
    const { x: vx, y: vy, w, h } = this.view;
    const conf = {
      snow:     { key: 'flake',   lifespan: 7000, speedY: { min: 30, max: 75 },  speedX: { min: -25, max: 25 }, scale: { min: 0.4, max: 1.2 }, alpha: { min: 0.5, max: 0.95 }, frequency: 90 },
      blizzard: { key: 'flake',   lifespan: 3200, speedY: { min: 90, max: 190 }, speedX: { min: -220, max: -70 }, scale: { min: 0.3, max: 1.1 }, alpha: { min: 0.35, max: 0.9 }, frequency: 26 },
      embers:   { key: 'sparkle', lifespan: 2600, speedY: { min: -70, max: -24 }, speedX: { min: -16, max: 16 }, scale: { min: 0.1, max: 0.34 }, alpha: { start: 0.9, end: 0 }, frequency: 130, tint: 0xffa63c, y: vy + h },
      sparkle:  { key: 'sparkle', lifespan: 4200, speedY: { min: -14, max: 14 }, speedX: { min: -14, max: 14 }, scale: { min: 0.08, max: 0.3 }, alpha: { start: 0, end: 0.85 }, frequency: 180, tint: 0xb6e6ff, y: { min: vy, max: vy + h } },
      dust:     { key: 'flake',   lifespan: 6000, speedY: { min: -10, max: 18 }, speedX: { min: -14, max: 14 }, scale: { min: 0.15, max: 0.4 }, alpha: { min: 0.1, max: 0.3 }, frequency: 220, y: { min: vy, max: vy + h } },
    }[kind];
    if (!conf) return;
    const { key, y = vy - 10, ...rest } = conf;
    this.weather = this.add.particles(0, 0, key, { x: { min: vx, max: vx + w }, y, quantity: 1, ...rest })
      .setScrollFactor(0).setDepth(2e6);
  }

  addWall(x, y, w, h, color) {
    const r = this.add.rectangle(x + w / 2, y + h / 2, w, h, color).setDepth(-500);
    this.walls.add(r);
    return r;
  }

  // Phase 13: a block is no longer a coloured rectangle with an emoji on it. The footprint (and therefore the
  // collision body, which every room in Phases 1-12 was built around) is unchanged — only the art is. The sprite
  // is chosen from `b.art`, or inferred from the emoji the room data already uses in its label.
  // Phase 13: a standing spot used to be a bright yellow rectangle, which read as a placeholder. It is now a soft
  // trodden-snow oval with a faint rim — still obvious when you are near it, invisible as clutter from a distance.
  markZone(zone) {
    const e = this.add.ellipse(zone.centerX, zone.centerY + 6, zone.width * 1.15, zone.height * 0.95, 0xffffff, 0.3)
      .setDepth(-930);
    this.add.ellipse(zone.centerX, zone.centerY + 6, zone.width * 1.15, zone.height * 0.95, 0xffc247, 0)
      .setStrokeStyle(2, 0xffc247, 0.35).setDepth(-929);
    return e;
  }

  addBlock(b) {
    const depth = b.y + b.h, cx = b.x + b.w / 2;
    const g = this.add.graphics().setDepth(depth);
    const drew = drawSprite(g, spriteFor(b.art || b.label), b.x, b.y, b.w, b.h, { color: b.color, neat: b.neat });
    if (!drew) {                                                        // never reached with the current rooms, kept as a safety net
      g.fillStyle(b.color || 0xe9d3b0); g.fillRoundedRect(b.x, b.y, b.w, b.h, 8);
      g.lineStyle(4, 0x6b4428); g.strokeRoundedRect(b.x, b.y, b.w, b.h, 8);
    }
    this.walls.add(this.add.rectangle(cx, b.y + b.h / 2, b.w, b.h, 0, 0));

    // The words of the label (if any) become a small caption under the object; the emoji is now the picture itself.
    const caption = captionOf(b.label);
    if (caption) {
      this.add.text(cx, b.y + b.h + 10, caption, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#16304a', backgroundColor: '#f4fbffcc', padding: { x: 7, y: 2 } })
        .setOrigin(0.5, 0).setDepth(depth + 1);
    }
  }

  addBuilding(b) {
    const { x, y, w, h } = b, t = buildingTexture(this, b), cx2 = x + w / 2;
    this.add.image(x - t.ox, y - t.oy, t.key).setOrigin(0).setDepth(y + h);          // one baked image per building: walls, roof, windows, door, lights, shadow
    const lamp = this.add.ellipse(cx2, y + h - 30, 170, 70, 0xffc247, 0.14).setDepth(-992).setBlendMode(Phaser.BlendModes.ADD);
    if (!this.registry.get('reduceMotion')) {
      this.tweens.add({ targets: lamp, alpha: 0.07, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.add.particles(x + w - 42, y - 6, 'flake', {                                                 // chimney smoke
        lifespan: 2600, speedY: { min: -46, max: -22 }, speedX: { min: -16, max: 16 },
        scale: { start: 0.5, end: 2.1 }, alpha: { start: 0.35, end: 0 }, frequency: 240, quantity: 1, tint: 0xdfe8ef,
      }).setDepth(y + h - 1);
    }
    // Phase 13: a hanging sign beside the door, so a cafe reads differently from a clothes shop at a glance.
    // Buildings themselves are baked images (src/utils/worldArt.js), so the sign gets its own small graphics.
    if (b.icon) {
      const sx = x + w - 4, sy = y + h - 104, sg = this.add.graphics().setDepth(y + h + 1);
      sg.fillStyle(0x3a2616); sg.fillRect(sx - 14, sy, 40, 7); sg.fillRect(sx + 20, sy, 5, 14);
      sg.fillStyle(0x7a4f2f); sg.fillRoundedRect(sx + 1, sy + 12, 42, 38, 8);
      sg.fillStyle(0xe4d6b4); sg.fillRoundedRect(sx + 5, sy + 16, 34, 30, 6);
      sg.fillStyle(0xffffff, 0.92); sg.fillRoundedRect(sx - 1, sy + 8, 46, 8, 4);
      this.add.text(sx + 22, sy + 31, b.icon, { fontSize: '21px' }).setOrigin(0.5).setDepth(y + h + 2);
    }

    this.add.text(x + w / 2, y + h + 22, b.label, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#16304a', backgroundColor: '#f4fbffee', padding: { x: 8, y: 3 } })
      .setOrigin(0.5).setDepth(y + h + 2);
    this.walls.add(this.add.rectangle(x + w / 2, y + 40 + (h - 40) / 2, w, h - 40, 0, 0));
    this.doors.push({ label: b.label, to: b.to, spawn: b.spawn, zone: new Phaser.Geom.Rectangle(x + w / 2 - DOOR_W / 2, y + h + 2, DOOR_W, DOOR_H), body: new Phaser.Geom.Rectangle(x, y, w, h), below: true });
  }

  // A shop counter: solid, with a "browse" zone in front. Entering the zone + E (or clicking the counter) opens the storefront.
  // Phase 13: a shop counter is now a real counter — a wooden front, a stone worktop, a till and a little sign —
  // with the shopkeeper penguin standing behind it. The action, the zone and the body are unchanged.
  addKiosk(k) {
    const cx = k.x + k.w / 2, depth = k.y + k.h;
    const g = this.add.graphics().setDepth(depth);
    drawSprite(g, 'counter', k.x, k.y, k.w, k.h, { color: 0x7a4f2f });
    g.fillStyle(0x3a3f4b); g.fillRoundedRect(cx + k.w * 0.22, k.y - 16, 38, 20, 4);                 // till
    g.fillStyle(0x9aa7b8); g.fillRoundedRect(cx + k.w * 0.25, k.y - 12, 32, 9, 3);
    g.fillStyle(0xffc247); g.fillCircle(cx + k.w * 0.41, k.y - 20, 4);
    this.walls.add(this.add.rectangle(cx, k.y + k.h / 2, k.w, k.h, 0, 0));
    this.add.text(cx, k.y + 10, '🐧', { fontSize: '40px' }).setOrigin(0.5, 1).setDepth(depth - 1);   // shopkeeper behind the counter
    // a small propped sign on the counter instead of floating text
    const sg = this.add.graphics().setDepth(depth + 1);
    sg.fillStyle(0x6b4428); sg.fillRoundedRect(cx - 86, k.y + 16, 172, 34, 8);
    sg.fillStyle(0xeee3c8); sg.fillRoundedRect(cx - 82, k.y + 20, 164, 26, 6);
    this.add.text(cx, k.y + 33, k.icon || k.label, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '15px', fontStyle: 'bold', color: '#4a3200' }).setOrigin(0.5).setDepth(depth + 2);
    const zone = new Phaser.Geom.Rectangle(k.x + k.w / 2 - 70, k.y + k.h + 2, 140, DOOR_H);
    this.markZone(zone);
    this.doors.push({ label: k.label, action: k.action, zone, body: new Phaser.Geom.Rectangle(k.x, k.y, k.w, k.h), below: true });
  }

  // Phase 7: an arcade cabinet (or, with `board`, the wide leaderboard screen). Solid, glowing, with a play zone on the floor in front.
  addCabinet(c) {
    const { x, y, w, h } = c, cx = x + w / 2, g = this.add.graphics().setDepth(y + h), calm = this.registry.get('reduceMotion');
    const glow = this.add.rectangle(cx, y + h / 2, w + 36, h + 36, c.color, 0.2).setDepth(y + h - 2);
    if (!calm) this.tweens.add({ targets: glow, alpha: 0.07, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    g.fillStyle(0x16304a, 0.2); g.fillEllipse(cx, y + h + 4, w + 24, 28);
    g.fillStyle(c.color); g.fillRoundedRect(x, y, w, h, 14);
    g.fillStyle(0x000000, 0.18); g.fillRoundedRect(x, y + h - 28, w, 28, { tl: 0, tr: 0, bl: 14, br: 14 });
    g.fillStyle(0xffc247); g.fillRoundedRect(x + 8, y + 6, w - 16, 24, 8);
    g.fillStyle(0x16304a); g.fillRoundedRect(x + 12, y + 36, w - 24, h - 76, 10);
    g.fillStyle(c.board ? 0x1b2a41 : 0x0b1a2a); g.fillRoundedRect(x + 18, y + 42, w - 36, h - 88, 8);
    if (!c.board) {
      g.fillStyle(0xe8483c); g.fillCircle(x + 34, y + h - 15, 6); g.fillStyle(0xffffff); g.fillCircle(x + w - 50, y + h - 15, 5); g.fillStyle(0x6fd08c); g.fillCircle(x + w - 30, y + h - 15, 5);
    }
    const t = (str, size, color, px, py, o = 0.5) => this.add.text(px, py, str, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color }).setOrigin(o).setDepth(y + h + 1);
    t(c.label, 13, '#4a3200', cx, y + 18);
    if (c.board) {
      t('🏆  TOP SCORES', 20, '#ffc247', cx, y + 62);
      t('🏁 Snow Dash   🪙 Coin Catcher   ☃️ Snowball Arena', 11.5, '#cfeaf7', cx, y + 92);
      t('Press E to see who is #1', 12, '#8ff0b3', cx, y + 114);
    } else {
      const icon = t(c.icon, 46, '#fff', cx, y + 38 + (h - 82) / 2);
      if (!calm) this.tweens.add({ targets: icon, scale: 1.14, duration: 760, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      t('PLAY', 11, '#ffc247', cx, y + h - 60);
    }
    this.walls.add(this.add.rectangle(cx, y + h / 2, w, h, 0, 0));
    const zone = new Phaser.Geom.Rectangle(cx - Math.min(80, w / 2), y + h + 2, Math.min(160, w), DOOR_H);
    this.markZone(zone);
    this.doors.push({ label: c.label, action: c.action, verb: c.verb || 'play', zone, body: new Phaser.Geom.Rectangle(x, y, w, h), below: true });
  }

  // Phase 10: an activity stand — the world's version of an arcade cabinet. A board on two posts with the game's
  // emoji, its name and your best score, and a play zone in front. Data lives in `activities` on the room.
  addActivity(a) {
    const def = GAMES[a.id]; if (!def) return;
    const w = a.w || 190, h = a.h || 140, x = a.x, y = a.y, cx = x + w / 2, depth = y + h;
    const tint = Phaser.Display.Color.HexStringToColor(def.colors.a).color;
    const dark = Phaser.Display.Color.HexStringToColor(def.colors.b).color;
    const calm = this.registry.get('reduceMotion');

    const glow = this.add.rectangle(cx, y + h / 2, w + 44, h + 44, tint, 0.18).setDepth(depth - 3);
    if (!calm) this.tweens.add({ targets: glow, alpha: 0.06, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(0x16304a, 0.2); g.fillEllipse(cx, y + h + 6, w + 20, 26);
    g.fillStyle(0x6b4428); g.fillRect(x + 16, y + h - 34, 14, 40); g.fillRect(x + w - 30, y + h - 34, 14, 40);   // posts
    g.fillStyle(dark); g.fillRoundedRect(x - 6, y - 6, w + 12, h - 18, 16);                                      // frame
    g.fillStyle(tint); g.fillRoundedRect(x, y, w, h - 30, 12);                                                   // board
    g.fillStyle(0xffffff, 0.22); g.fillRoundedRect(x + 6, y + 6, w - 12, 22, 8);
    g.fillStyle(0x16304a, 0.25); g.fillRoundedRect(x + 14, y + 40, w - 28, h - 92, 10);
    g.fillStyle(0xffffff); g.fillEllipse(cx, y - 8, w * 0.7, 16);                                                // snow on top
    g.fillStyle(0xffc247); g.fillRoundedRect(x + 22, y + h - 66, w - 44, 22, 8);

    const t = (str, size, color, py, extra = {}) => this.add.text(cx, py, str, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color, ...extra }).setOrigin(0.5).setDepth(depth + 1);
    t(def.name.toUpperCase(), 13.5, '#16304a', y + 17);
    const icon = t(def.emoji, 42, '#ffffff', y + 40 + (h - 92) / 2);
    if (!calm) this.tweens.add({ targets: icon, scale: 1.12, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    const best = bestOf(def.id, !!this.registry.get('profile').guest);
    t(best == null ? '▶ PLAY' : `▶ PLAY · best ${best.toLocaleString()}`, 11.5, '#4a3200', y + h - 55);

    this.walls.add(this.add.rectangle(cx, y + h / 2, w, h - 20, 0, 0));
    const zone = new Phaser.Geom.Rectangle(cx - 85, y + h + 4, 170, DOOR_H);
    this.markZone(zone);
    this.doors.push({ label: def.name, action: `play:${def.id}`, verb: 'play', zone, body: new Phaser.Geom.Rectangle(x, y, w, h), below: true });
  }

  // neon sign on an indoor back wall
  addSign(room) {
    const s = this.add.text(room.w / 2, 70, room.sign, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '46px', fontStyle: 'bold', color: '#ffffff', stroke: '#ff6fae', strokeThickness: 7 })
      .setOrigin(0.5).setDepth(-400).setShadow(0, 0, '#ff6fae', 18, true, true);
    if (!this.registry.get('reduceMotion')) this.tweens.add({ targets: s, alpha: 0.72, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  addPortal(p) {
    this.add.rectangle(p.x + p.w / 2, p.y + p.h / 2, p.w, p.h, 0xffffff, 0.35).setStrokeStyle(3, 0x7fb8d8).setDepth(-900);
    this.add.text(p.x + p.w / 2, p.y + p.h / 2, p.label, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#16304a', backgroundColor: '#f4fbffee', padding: { x: 6, y: 3 } }).setOrigin(0.5).setDepth(-800);
    // Phase 12 polish: a gate that leads to a sled route also shows its difficulty, its par time and your best.
    if (p.route) {
      const r = SKI_ROUTES[p.route];
      if (r) {
        let best = 0;
        try { best = parseFloat(localStorage.getItem(`aw:besttime:${p.route}`) || '0'); } catch { /* storage off */ }
        this.add.text(p.x + p.w / 2, p.y + p.h + 14, `${p.grade || ''} par ${r.par}s${best ? `  ·  best ${best.toFixed(1)}s` : ''}`,
          { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#dff1fb', backgroundColor: '#16304acc', padding: { x: 8, y: 3 } })
          .setOrigin(0.5).setDepth(-800);
      }
    }
    const zone = new Phaser.Geom.Rectangle(p.x, p.y, p.w, p.h);
    this.doors.push({ label: p.label.replace(/[▸◂▾]/g, '').trim(), to: p.to, spawn: p.spawn, zone, body: zone, below: false });
  }

  addPond(p) {
    const g = this.add.graphics().setDepth(-998);
    g.fillStyle(0xffffff); g.fillEllipse(p.x, p.y + 6, p.rx * 2 + 24, p.ry * 2 + 24);
    g.fillStyle(0x8fd3f0); g.fillEllipse(p.x, p.y, p.rx * 2, p.ry * 2);
    g.lineStyle(3, 0xd9f2ff, 0.9); g.lineBetween(p.x - 60, p.y - 10, p.x - 10, p.y - 24); g.lineBetween(p.x + 20, p.y + 20, p.x + 80, p.y + 6);
    const r = this.add.ellipse(p.x, p.y, p.rx * 2, p.ry * 1.6, 0, 0); this.walls.add(r);
  }

  // Phase 8: scenery. One switch, so a new prop type is a few lines and never a new room system.
  addProp(p) {
    // ---- Phase 12 scenery ----
    // Background peaks are deliberately ONE graphics object each and never collide: they are the cheapest
    // way to make a mountain read as huge without adding draw calls or physics bodies.
    if (p.type === 'peak') {
      const g = this.add.graphics().setDepth(-990);
      const { x, y } = p, w = p.w || 700, h = p.h || 400;
      g.fillStyle(0x334b66, 0.72); g.fillTriangle(x, y, x - w / 2, y + h, x + w / 2, y + h);
      g.fillStyle(0x45628a, 0.72); g.fillTriangle(x, y, x - w * 0.12, y + h, x + w / 2, y + h);
      g.lineStyle(3, 0xffffff, 0.14); g.lineBetween(x, y, x - w * 0.5, y + h);                  // ridge line
      g.fillStyle(0xcfe6f4, 0.16); g.fillRect(x - w / 2, y + h - 70, w, 70);                    // haze at the base, so it reads as distance
      g.fillStyle(0xffffff, 0.92);                                    // snow cap
      g.fillTriangle(x, y, x - w * 0.17, y + h * 0.33, x + w * 0.17, y + h * 0.33);
      g.fillStyle(0xdfeefb, 0.9);
      g.fillTriangle(x, y, x - w * 0.05, y + h * 0.33, x + w * 0.17, y + h * 0.33);
      return;
    }
    if (p.type === 'tower') {                                         // lift tower (summit station side)
      const { x, y } = p, g = this.add.graphics().setDepth(y);
      g.fillStyle(0x16304a, 0.2); g.fillEllipse(x, y + 6, 76, 22);
      g.fillStyle(0x59707f); g.fillRect(x - 10, y - 160, 20, 160);
      g.fillStyle(0x6f8a9c); g.fillRect(x - 50, y - 160, 100, 15);
      g.fillStyle(0xffffff, 0.75); g.fillRect(x - 50, y - 163, 100, 5);
      this.walls.add(this.add.rectangle(x, y - 6, 28, 24, 0, 0));
      return;
    }
    if (p.type === 'fence') {                                         // snow fence: slatted, decorative only
      const { x, y } = p, w = p.w || 240, g = this.add.graphics().setDepth(y);
      g.fillStyle(0x6b4428);
      for (let i = 0; i <= w; i += 26) g.fillRect(x - w / 2 + i, y - 44, 7, 46);
      g.fillStyle(0x8c5a3a); g.fillRect(x - w / 2, y - 36, w, 6); g.fillRect(x - w / 2, y - 16, w, 6);
      g.fillStyle(0xffffff, 0.7); g.fillRect(x - w / 2, y - 39, w, 3);
      return;
    }
    if (p.type === 'sign') {
      const { x, y } = p, g = this.add.graphics().setDepth(y);
      g.fillStyle(0x16304a, 0.2); g.fillEllipse(x, y + 6, 60, 16);
      g.fillStyle(0x6b4428); g.fillRect(x - 6, y - 56, 12, 58);
      g.fillStyle(0xd8c9a3); g.fillRoundedRect(x - 78, y - 100, 156, 48, 8);
      g.fillStyle(0xffffff, 0.8); g.fillRoundedRect(x - 78, y - 104, 156, 7, 4);
      this.add.text(x, y - 76, p.label || '', {
        fontFamily: 'system-ui, sans-serif', fontSize: '13px', color: '#3a2a18', align: 'center',
      }).setOrigin(0.5).setDepth(y + 1);
      return;
    }
    if (p.type === 'pond') return this.addPond(p);
    if (p.type === 'ice') {                                    // a sheet of smoother ice: looks different, walks the same
      const g = this.add.graphics().setDepth(-997);
      g.fillStyle(0xbfe4f6, 0.85); g.fillEllipse(p.x, p.y, p.rx * 2, p.ry * 2);
      g.lineStyle(3, 0xffffff, 0.6); g.strokeEllipse(p.x, p.y, p.rx * 2, p.ry * 2);
      g.lineBetween(p.x - p.rx * 0.5, p.y - p.ry * 0.3, p.x + p.rx * 0.2, p.y + p.ry * 0.5);
      return;
    }
    if (p.type === 'rock') {
      const r = p.r || 40, g = this.add.graphics().setDepth(p.y + r);
      g.fillStyle(0x16304a, 0.18); g.fillEllipse(p.x, p.y + r * 0.5, r * 2.2, r * 0.6);
      g.fillStyle(0x7d8c97); g.fillEllipse(p.x, p.y, r * 2, r * 1.5);
      g.fillStyle(0x9aa9b4); g.fillEllipse(p.x - r * 0.2, p.y - r * 0.25, r * 1.2, r * 0.8);
      g.fillStyle(0xffffff, 0.9); g.fillEllipse(p.x, p.y - r * 0.55, r * 1.5, r * 0.5);
      this.walls.add(this.add.rectangle(p.x, p.y + r * 0.25, r * 1.7, r * 0.8, 0, 0));
      return;
    }
    if (p.type === 'crystal') {
      const s = p.s || 1, h = 90 * s, w = 34 * s, g = this.add.graphics().setDepth(p.y);
      g.fillStyle(0x16304a, 0.2); g.fillEllipse(p.x, p.y + 6, w * 2.2, 18 * s);
      g.fillStyle(0x8f6fe0, 0.95); g.fillTriangle(p.x, p.y - h, p.x - w, p.y, p.x + w, p.y);
      g.fillStyle(0xc7aaff, 0.95); g.fillTriangle(p.x, p.y - h, p.x - w * 0.3, p.y, p.x + w * 0.25, p.y);
      g.fillStyle(0xffffff, 0.55); g.fillTriangle(p.x - w * 0.1, p.y - h * 0.85, p.x - w * 0.35, p.y - h * 0.1, p.x, p.y - h * 0.1);
      this.walls.add(this.add.rectangle(p.x, p.y - 6, w * 1.4, 18 * s, 0, 0));
      return;
    }
    if (p.type === 'snowman') {
      const sc = p.s || 1, g = this.add.graphics().setDepth(p.y);
      g.fillStyle(0x16304a, 0.18); g.fillEllipse(p.x, p.y + 4, 56 * sc, 16 * sc);
      g.fillStyle(0xffffff); g.fillCircle(p.x, p.y - 16 * sc, 24 * sc); g.fillCircle(p.x, p.y - 48 * sc, 17 * sc); g.fillCircle(p.x, p.y - 74 * sc, 13 * sc);
      g.fillStyle(0xdfeefb); g.fillEllipse(p.x, p.y - 2 * sc, 44 * sc, 10 * sc);
      g.fillStyle(0x1b2a41); g.fillCircle(p.x - 5 * sc, p.y - 77 * sc, 2 * sc); g.fillCircle(p.x + 5 * sc, p.y - 77 * sc, 2 * sc);
      [0, 1, 2].forEach((i) => g.fillCircle(p.x, p.y - (44 - i * 11) * sc, 2.4 * sc));
      g.fillStyle(0xff9a3c); g.fillTriangle(p.x, p.y - 73 * sc, p.x, p.y - 69 * sc, p.x + 14 * sc, p.y - 71 * sc);
      g.fillStyle(0xe8483c); g.fillRect(p.x - 14 * sc, p.y - 88 * sc, 28 * sc, 7 * sc); g.fillRect(p.x - 9 * sc, p.y - 100 * sc, 18 * sc, 13 * sc);
      g.lineStyle(4 * sc, 0x6b4428); g.lineBetween(p.x - 22 * sc, p.y - 50 * sc, p.x - 42 * sc, p.y - 66 * sc); g.lineBetween(p.x + 22 * sc, p.y - 50 * sc, p.x + 42 * sc, p.y - 66 * sc);
      this.walls.add(this.add.rectangle(p.x, p.y - 8 * sc, 40 * sc, 20 * sc, 0, 0));
      return;
    }
    if (p.type === 'lamp') {                                 // a pole with a warm pool of light on the ground
      const g = this.add.graphics().setDepth(p.y);
      const pool = this.add.ellipse(p.x, p.y + 6, 170, 70, 0xffc247, 0.16).setDepth(-992).setBlendMode(Phaser.BlendModes.ADD);
      if (!this.registry.get('reduceMotion')) this.tweens.add({ targets: pool, alpha: 0.1, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      g.fillStyle(0x16304a, 0.18); g.fillEllipse(p.x, p.y + 4, 34, 12);
      g.fillStyle(0x34506b); g.fillRect(p.x - 4, p.y - 96, 8, 96); g.fillRect(p.x - 10, p.y - 4, 20, 6);
      g.fillStyle(0x1b2a41); g.fillTriangle(p.x, p.y - 128, p.x - 16, p.y - 104, p.x + 16, p.y - 104);
      g.fillStyle(0xfff0b0); g.fillRoundedRect(p.x - 11, p.y - 106, 22, 22, 5);
      g.fillStyle(0xffffff); g.fillEllipse(p.x, p.y - 126, 26, 7);
      this.walls.add(this.add.rectangle(p.x, p.y - 6, 14, 12, 0, 0));
      return;
    }
    if (p.type === 'bush') {
      const g = this.add.graphics().setDepth(p.y);
      g.fillStyle(0x1f6b4f); g.fillEllipse(p.x, p.y - 10, 62, 44); g.fillEllipse(p.x - 20, p.y - 2, 40, 30); g.fillEllipse(p.x + 20, p.y - 2, 40, 30);
      g.fillStyle(0xffffff); g.fillEllipse(p.x, p.y - 24, 48, 18); g.fillEllipse(p.x - 18, p.y - 12, 26, 11);
      this.walls.add(this.add.rectangle(p.x, p.y - 4, 56, 20, 0, 0));
      return;
    }
    if (p.type === 'glow') {                                 // a bare light source (campfire, crystal cluster, brazier)
      const pool = this.add.ellipse(p.x, p.y, (p.r || 90) * 2, (p.r || 90) * 1.1, p.color ?? 0xffa63c, 0.2).setDepth(-991).setBlendMode(Phaser.BlendModes.ADD);
      if (!this.registry.get('reduceMotion')) this.tweens.add({ targets: pool, scale: 1.12, alpha: 0.12, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      return;
    }
    if (p.type === 'dock') {                                   // walkable boardwalk
      const g = this.add.graphics().setDepth(-996);
      g.fillStyle(0x8a6240); g.fillRoundedRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, 8);
      g.lineStyle(3, 0x6b4428, 0.8);
      for (let x = p.x - p.w / 2 + 20; x < p.x + p.w / 2; x += 40) g.lineBetween(x, p.y - p.h / 2 + 4, x, p.y + p.h / 2 - 4);
    }
  }

  // Is this hidden entrance open for me yet?
  secretOpen(p) {
    if (!this.explore) return false;
    return this.explore.isRoomUnlocked(p.to) || this.explore.isSecretFound(p.secret);
  }

  // Phase 8: reveal a hidden entrance. Called while building the room (silent) or the moment its secret is cracked.
  addSecretPortal(p, silent = false) {
    if (this.secretPortals.has(p.to)) return;
    this.secretPortals.add(p.to);
    this.addPortal(p);
    if (!silent) {
      const name = ROOMS[p.to]?.name || p.label;
      toast(`A way into ${name} just opened!`);
      if (!this.registry.get('reduceMotion')) this.cameras.main.flash(260, 255, 240, 180);
    }
  }

  // Phase 13: two baked pine variants, picked deterministically from the tree's position with a little scale
  // jitter, so a forest reads as a forest instead of the same triangle stamped twenty times. Still one image each.
  addTree(x, y) {
    const seed = (Math.abs(Math.round(x * 31 + y * 17)) % 100) / 100;
    const key = this.textures.exists('pine2') && seed > 0.5 ? 'pine2' : 'pine';
    this.add.image(x, y, key).setOrigin(0.5, 0.97).setDepth(y).setScale(0.9 + seed * 0.3);
    this.walls.add(this.add.rectangle(x, y - 8, 22, 14, 0, 0));
  }

  addSnowfall() { this.addWeather('snow'); }                // kept: Phases 1-8 called this directly

  // ---------- input ----------
  setupInput() {
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,E');
    this.input.on('pointerdown', (p) => {
      if (this.leaving || this.editing || this.uiLocked || p.event?.target?.tagName !== 'CANVAS') return;
      const who = this.mp.hit(p.worldX, p.worldY);
      if (who) return this.game.events.emit('open-profile', who);
      const hit = this.doors.find((d) => Phaser.Geom.Rectangle.Contains(d.body, p.worldX, p.worldY));
      if (hit) { this.pendingDoor = hit; this.target = new Phaser.Math.Vector2(hit.zone.centerX, hit.zone.centerY); }
      else { this.pendingDoor = null; this.target = new Phaser.Math.Vector2(p.worldX, p.worldY); }
      this.stuck = 0;
    });
    this.input.keyboard.addKey('SPACE', false).on('down', () => !this.editing && !this.uiLocked && !this.leaving && document.activeElement?.tagName !== 'INPUT' && this.player.hop());
    this.keys.E.on('down', () => {
      if (!this.editing && !this.uiLocked && !this.nearDoor && this.nearPic) {                 // Phase 15
        return this.game.events.emit('open-wall', { pic: this.nearPic.pic });
      }
      if (this.editing || this.uiLocked) return;
      if (this.ski?.nearLift()) return this.ski.boardLift();        // Phase 12: board the gondola
      if (this.nearDoor) this.enter(this.nearDoor);
    });
  }

  update(time, delta) {
    if (this.leaving) return;
    if (this.editing || this.uiLocked) {                    // editing / shopping: avatar stands still, others keep moving
      this.player.move(0, 0);
      this.player.update(time, this.registry.get('reduceMotion'));
      this.mp.update(time, delta, this.registry.get('reduceMotion'));
      this.game.events.emit('door-prompt', '');
      return;
    }
    // Phase 12: while riding a lift or a sled the ski area drives the avatar, but the rest of this
    // loop still runs below it, so multiplayer, outfits and emotes carry on exactly as normal.
    if (this.ski?.update(time, delta)) {
      this.player.update(time, this.registry.get('reduceMotion'));
      this.mp.update(time, delta, this.registry.get('reduceMotion'));
      return;
    }

    const k = this.keys;
    let vx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let vy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (vx || vy) { this.target = null; this.pendingDoor = null; }
    else if (this.target) {
      const dx = this.target.x - this.player.x, dy = this.target.y - this.player.y;
      if (Math.hypot(dx, dy) < 8) this.target = null;
      else { vx = dx; vy = dy; this.stuck = this.player.hitbox.body.speed < 20 ? this.stuck + delta : 0; if (this.stuck > 350) this.target = null; }
    }
    this.player.move(vx, vy);
    this.player.update(time, this.registry.get('reduceMotion'));
    this.mp.update(time, delta, this.registry.get('reduceMotion'));

    this.world?.update();                                   // Phase 8: collectible pickups (a few distance checks)
    this.gallery?.update();                                 // Phase 15: load only the pictures you are standing near

    this.nearDoor = this.doors.find((d) => Phaser.Geom.Rectangle.Contains(d.zone, this.player.x, this.player.y)) || null;
    // Phase 15: standing in front of a hung picture, with no door in range, offers a closer look.
    this.nearPic = !this.nearDoor && this.gallery ? this.gallery.nearest() : null;
    const nd = this.nearDoor;
    this.game.events.emit('door-prompt',
      this.nearPic ? `Press E to look at this picture`
      : nd ? `Press E to ${nd.verb || (nd.action ? 'browse' : 'enter')} ${nd.label}`
         : (this.ski?.hint() || ''));                     // Phase 12: lift / push-off hints
    if (this.nearDoor && this.pendingDoor === this.nearDoor) this.enter(this.nearDoor);
  }

  spawnPoint(room) {
    if (this.fromRoom) {
      const d = this.doors.find((d) => d.to === this.fromRoom);
      if (d) return d.spawn || { x: d.zone.centerX, y: d.zone.bottom + 40 };
    }
    return room.spawn;
  }

  enter(door) {
    if (this.leaving) return;
    if (door.action) {                                        // shop counter: open the storefront, stay in the room
      this.target = null; this.pendingDoor = null; this.player.move(0, 0);
      if (door.action.startsWith('arcade:')) this.game.events.emit('open-arcade', door.action.slice(7));   // Phase 7
      else if (door.action.startsWith('world:')) this.game.events.emit('world-interact', door.world);       // Phase 8
      else if (door.action.startsWith('play:')) this.game.events.emit('minigame-play', door.action.slice(5)); // Phase 10
      else this.game.events.emit('open-shop', door.action);
      return;
    }
    if (!ROOMS[door.to]) { this.target = null; this.pendingDoor = null; toast(`${door.label} is coming soon!`); this.nearDoor = null; this.player.move(0, 0); this.bounce(door); return; }
    this.leaving = true; this.player.move(0, 0);
    this.cameras.main.fadeOut(220);
    const next = { roomId: door.to, from: this.roomId };
    if (door.to === 'home') next.ownerId = door.ownerId || this.registry.get('profile').id;   // friend rooms later: door.ownerId = friend's id
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart(next));
  }

  // move the player just clear of a "coming soon" door so the toast doesn't repeat
  bounce(door) {
    const p = door.spawn || { x: door.zone.centerX, y: door.zone.bottom + 70 };
    this.player.hitbox.setPosition(p.x, p.y);
  }
}
