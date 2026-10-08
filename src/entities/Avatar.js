import { SPEED } from '../config/game.js';
import { SLOTS, LAYOUT, FIT, BODY_TYPES, ITEM_BY_ID, normalizeAvatar } from '../shops/items.js';
import { EMOTE_BY_KEY, EMOTE_MS } from '../social/emotes.js';

const INTERP_MS = 120;                                   // remote players are drawn this far in the past (>= one 110 ms packet interval)

// Layered avatar. Draw order (back -> front):
// back, feet, body(tinted), pants, belly, shirt, accessory, eyes, beak, face, hat, hand.
// Every cosmetic is a separate sprite, so outfits are just texture keys. `remote` avatars have no physics
// and glide toward network targets instead of being driven by input.
export class Avatar {
  constructor(scene, x, y, data, name, { remote = false, direct = false } = {}) {
    this.scene = scene; this.dir = 'down'; this.moving = false; this.remote = remote;
    this.tx = x; this.ty = y; this.remoteMoving = false; this._dir = null;
    this.direct = !!direct;                              // minigame avatars are positioned by the game itself (no network smoothing)
    this.snaps = []; this.phase = 0; this.blend = 0; this.turn = 0; this.hopT = 0; this.hopped = false;   // animation state
    this.gs = 1; this.animRate = 1; this.sx = 1; this.sy = 1; this.bodyTop = -50; this.hatY = -57;
    this.fx = { dy: 0, rot: 0, sy: 1 };                 // emote body offsets, tweened; update() adds them on top of walking
    this.bubble = null; this.bubbleTimer = null; this.emoteIcon = null; this.emoteTimer = null; this.emoteTweens = [];

    this.hitbox = scene.add.rectangle(x, y, 26, 14, 0x000000, 0);
    if (!remote) { scene.physics.add.existing(this.hitbox); this.hitbox.body.setCollideWorldBounds(true); }

    this.shadow = scene.add.ellipse(x, y, 36, 12, 0x1b3350, 0.25);
    const img = (key) => scene.add.image(0, 0, key);
    this.s = {};
    for (const slot of SLOTS) if (slot !== 'shoes') this.s[slot] = img('av_belly').setVisible(false);
    this.feetL = img('av_foot'); this.feetR = img('av_foot');
    this.body = img('av_body'); this.belly = img('av_belly'); this.beak = img('av_beak');
    const s = this.s;
    this.root = scene.add.container(x, y, [s.back, this.feetL, this.feetR, this.body, s.pants, this.belly, s.shirt, s.accessory, s.eyes, this.beak, s.face, s.hat, s.hand]);
    this.label = scene.add.text(x, y, name, { fontFamily: 'Trebuchet MS, sans-serif', fontSize: '13px', fontStyle: 'bold', color: '#fff', stroke: '#16304a', strokeThickness: 4 })
      .setOrigin(0.5, 1).setDepth(1e6);
    this.setOutfit(data);
    if (remote && !direct) this.snaps.push({ t: performance.now() - 1000, x, y, d: 'down', m: false });
  }

  get x() { return this.hitbox.x; }
  get y() { return this.hitbox.y; }

  // Teleport the avatar. Everything visible (body layers, shadow, name, bubble) is positioned from the hitbox in
  // update(), so moving the hitbox moves the whole penguin. The physics body is moved by hand rather than through
  // body.reset(), because the ski lift and the sled deliberately run with the body DISABLED while they drive the
  // transform themselves — reset() would switch it back on and the player would start colliding mid-ride.
  setPosition(x, y) {
    const h = this.hitbox, b = h.body;
    h.setPosition(x, y);
    if (b) {
      b.stop();
      b.position.set(x - b.halfWidth, y - b.halfHeight);
      b.prev.copy(b.position);
      if (b.prevFrame) b.prevFrame.copy(b.position);
    }
    return this;
  }

  setOutfit(data) {
    const d = (this.data = normalizeAvatar(data));
    const [sx, sy] = BODY_TYPES[d.bodyType];
    this.sx = sx; this.sy = sy;
    this.body.setTint(Phaser.Display.Color.HexStringToColor(d.color).color).setScale(sx, sy).setY(-2 - 24 * sy);
    this.bodyTop = -2 - 48 * sy;                        // top of the head; heads, hats and faces hang from this
    this.headDy = -48 * (sy - 1);
    for (const slot of SLOTS) {
      if (slot === 'shoes') continue;
      const spr = this.s[slot];
      if (d[slot]) spr.setTexture(d[slot]).setVisible(true); else spr.setVisible(false);
    }
    // Phase 17: measure each garment ONCE per outfit change. Anything wider than its slot allows is scaled down
    // to fit the penguin (never scaled up, so small pieces keep their natural size), the sprite is pinned by the
    // part of it that should touch the body (a hat by its brim, a shirt by its collar), and the item's own nudge
    // is applied. This is what makes clothes look worn instead of pasted on.
    this.fit = {};
    for (const slot of SLOTS) {
      if (slot === 'shoes') continue;
      const base = FIT[slot]; if (!base) continue;
      const spr = this.s[slot], id = d[slot];
      const extra = (id && ITEM_BY_ID[id]?.fit) || {};
      let k = 1;
      if (id && spr.width > 0 && base.maxW) k = Math.min(1, base.maxW / spr.width);
      k *= extra.s ?? 1;
      spr.setOrigin(base.ax, base.ay);
      this.fit[slot] = { k, x: (base.x ?? 0) + (extra.dx ?? 0), y: base.y + (extra.dy ?? 0) };
    }
    this.hatY = this.bodyTop + 8;                           // the head line: hats are pinned by their brim to it
    const shoe = d.shoes || 'av_foot';
    this.feetL.setTexture(shoe); this.feetR.setTexture(shoe);
    this._dir = null;                                    // force a layout refresh
  }

  move(vx, vy) {
    const len = Math.hypot(vx, vy);
    if (len > 0) { vx = (vx / len) * SPEED; vy = (vy / len) * SPEED; }
    this.hitbox.body.setVelocity(vx, vy);
    this.moving = len > 0;
    if (this.moving) this.dir = Math.abs(vx) > Math.abs(vy) ? (vx < 0 ? 'left' : 'right') : (vy < 0 ? 'up' : 'down');
  }

  // Network snapshots go into a short buffer and are replayed ~INTERP_MS late, so motion is interpolated between two real
  // positions instead of chasing the latest packet (no teleporting, no rubber-banding, no jitter from uneven arrival).
  setRemoteTarget(x, y, dir, moving, hop = false) {
    if (dir) this.dir = dir;
    this.remoteMoving = !!moving;
    if (hop) this.hop();
    if (this.direct) return;
    const b = this.snaps; b.push({ t: performance.now(), x, y, d: dir || this.dir, m: !!moving });
    if (b.length > 10) b.shift();
  }

  hop() { if (this.hopT <= 0) { this.hopT = 1; this.hopped = true; } }

  stepRemote(dt) {
    const b = this.snaps, h = this.hitbox;
    if (this.direct) { this.moving = this.remoteMoving; return; }
    const now = performance.now() - INTERP_MS;
    let k = 0; while (k < b.length && b[k].t <= now) k++;           // first snapshot still in the future
    let px, py, moving = false;
    if (k === 0) { px = b[0].x; py = b[0].y; }                       // nothing old enough yet: hold the first one
    else if (k === b.length) { const l = b[k - 1]; px = l.x; py = l.y; this.dir = l.d; moving = l.m; }   // caught up: hold the last
    else {
      const p = b[k - 1], n = b[k], a = Math.min(1, Math.max(0, (now - p.t) / Math.max(1, n.t - p.t))), dist = Math.hypot(n.x - p.x, n.y - p.y);
      if (dist > 500) { px = n.x; py = n.y; h.x = px; h.y = py; }    // a real teleport (door, respawn): do not slide across the map
      else { px = p.x + (n.x - p.x) * a; py = p.y + (n.y - p.y) * a; }
      this.dir = n.d; moving = dist > 1.5 || n.m;
      if (k > 1) b.splice(0, k - 1);
    }
    const e = 1 - Math.exp(-14 * dt);                                  // reduced extra smoothing for more responsiveness
    const dx = px - h.x, dy = py - h.y; h.x += dx * e; h.y += dy * e;
    this.moving = moving || Math.hypot(dx, dy) > 1.2;
  }

  update(time, reduceMotion = false, delta = 16) {
    const dt = Math.min(delta, 60) / 1000;
    if (this.remote) this.stepRemote(dt);
    const calm = reduceMotion, d = this.dir;
    // blend 0..1 ramps in/out so starting and stopping ease instead of snapping between idle and walk
    this.blend += ((this.moving ? 1 : 0) - this.blend) * (1 - Math.exp(-(this.moving ? 16 : 10) * dt));
    this.phase += dt * 14 * this.animRate * this.blend;
    const walk = calm ? 0 : this.blend, sn = Math.sin(this.phase);
    const idle = calm ? 0 : Math.sin(time * 0.0028) * (1 - this.blend);               // slow breathing
    const side = d === 'left' ? -1 : d === 'right' ? 1 : 0;
    this.turn = Math.max(0, this.turn - dt * 6);                                        // quick squash when turning round
    let hopY = 0, hopSq = 1;
    if (this.hopT > 0) {
      this.hopT = Math.max(0, this.hopT - dt / 0.46);
      const u = 1 - this.hopT; hopY = -Math.sin(Math.PI * u) * 26; hopSq = 1 + Math.sin(Math.PI * u) * 0.1 - (u < 0.12 || u > 0.88 ? 0.1 : 0);
    }
    const { x, y } = this.hitbox;
    const bob = -Math.abs(sn) * 4 * walk;
    const stretch = 1 + idle * 0.022 + Math.cos(this.phase * 2) * 0.03 * walk;
    this.root.setPosition(x, y + bob + this.fx.dy + hopY)
      .setRotation(sn * 0.08 * walk + side * 0.05 * walk + this.fx.rot)
      .setScale(this.gs * (1 - 0.16 * this.turn) / Math.sqrt(stretch), this.gs * this.fx.sy * stretch * hopSq).setDepth(y);
    this.shadow.setPosition(x, y - 2).setDepth(y - 1).setScale(1 + (bob + hopY) * 0.012);
    this.label.setPosition(x, y - 78 + (this.headDy || 0));
    if (this.emoteIcon) this.emoteIcon.setPosition(x, this.label.y - 20);
    if (this.bubble) this.bubble.setPosition(x, this.label.y - 20 - (this.emoteIcon ? 44 : 0));
    const sx = this.sx, lift = 4 * walk;                                                  // feet: alternate lift + fore/aft swing
    this.feetL.setPosition(-8 * sx + side * sn * 3 * walk, -4 - Math.max(0, sn) * lift);
    this.feetR.setPosition(8 * sx - side * sn * 3 * walk, -4 - Math.max(0, -sn) * lift);

    if (d === this._dir) return;                          // layout only changes when facing changes
    if (this._dir !== null && !calm) this.turn = 1;
    this._dir = d;
    this.layout(d);
  }

  // Every layer is placed relative to the BODY (and scaled by the body type), so clothes follow tall and chubby
  // penguins instead of floating. Phase 17: each layer also uses its own anchor and fitted scale from setOutfit(),
  // so the SAME code hangs a tiny bow tie and a huge aurora cloak correctly.
  layout(d) {
    const back = d === 'up', side = d === 'left' ? -1 : d === 'right' ? 1 : 0, hy = this.headDy || 0;
    const s = this.s, { sx, sy } = this;
    const by = (y) => -2 + (y + 2) * sy;                   // body-relative y
    const narrow = side ? 0.9 : 1;                          // side-on view: the body reads narrower
    const f = this.fit || {};
    // place(slot, extraX, squash) — hangs a body layer from its own anchor at its own fitted scale
    const place = (slot, ex = 0, squash = narrow) => {
      const cfg = f[slot]; if (!cfg) return;
      s[slot].setPosition(ex + cfg.x * sx, by(cfg.y)).setScale(sx * cfg.k * squash, sy * cfg.k);
    };

    place('back', -side * 7, 1);
    place('pants', side * 3);
    place('shirt', side * 3);
    this.belly.setOrigin(0.5, 0.5).setPosition(side * 3, by(-20)).setScale(sx, sy).setVisible(!back);
    place('accessory', side * 2);
    // head layers: eyes, beak and face track the head, which moves with the body type
    s.eyes.setPosition(side * 8 * sx, (f.eyes?.y ?? -36) + hy).setScale(sx * (f.eyes?.k ?? 1), sy * (f.eyes?.k ?? 1)).setVisible(!back);
    this.beak.setOrigin(0.5, 0.5).setPosition(side * 8 * sx, -28 + hy).setVisible(!back);
    s.face.setPosition(side * 8 * sx, (f.face?.y ?? -33) + hy).setScale(sx * (f.face?.k ?? 1), sy * (f.face?.k ?? 1))
      .setVisible(!back && !!this.data.face);
    // the hat is pinned by its brim to the head line, so its height no longer matters
    if (f.hat) s.hat.setPosition(side * 3, this.hatY + (f.hat.y - FIT.hat.y)).setScale(sx * f.hat.k, sy * f.hat.k);
    // the held item sits at the end of the flipper on whichever side the penguin faces
    if (f.hand) {
      s.hand.setPosition((side === -1 ? -1 : 1) * (f.hand.x * sx + 5), by(f.hand.y)).setScale(sx * f.hand.k, sy * f.hand.k);
      s.hand.setVisible(!back && !!this.data.hand);          // holding nothing must not show the empty sprite
    }
    if (back) this.root.bringToTop(s.back); else this.root.sendToBack(s.back);
  }

  // ---------- Phase 6: speech bubble + emotes (visual only; nothing here touches the network) ----------
  say(text, ms) {
    if (this.bubble) { this.bubble.destroy(); clearTimeout(this.bubbleTimer); }
    this.bubble = this.scene.add.text(this.x, this.y, text, {
      fontFamily: 'Trebuchet MS, sans-serif', fontSize: '14px', fontStyle: 'bold', color: '#16304a', backgroundColor: '#f4fbff',
      padding: { x: 9, y: 5 }, align: 'center', wordWrap: { width: 190 },
    }).setOrigin(0.5, 1).setDepth(1e6 + 2).setAlpha(0.97);
    this.bubbleTimer = setTimeout(() => { this.bubble?.destroy(); this.bubble = null; }, ms || Math.min(7000, 2600 + text.length * 55));
  }

  playEmote(key, reduceMotion = false) {
    const def = EMOTE_BY_KEY[key]; if (!def) return;
    const sc = this.scene;
    this.clearEmote();
    this.emoteIcon = sc.add.text(this.x, this.y, def.icon, { fontSize: '34px' }).setOrigin(0.5, 1).setDepth(1e6 + 1).setScale(0.2);
    this.emoteTweens.push(sc.tweens.add({ targets: this.emoteIcon, scale: 1, duration: 260, ease: 'Back.Out' }));
    this.emoteTimer = setTimeout(() => this.clearEmote(), EMOTE_MS);
    if (reduceMotion) return;                                            // icon only for people who prefer less motion
    const b = def.body;
    if (b) {
      const to = { dy: b.dy ?? 0, rot: b.rot ?? 0, sy: b.sy ?? 1 };
      this.emoteTweens.push(sc.tweens.add({
        targets: this.fx, ...to, duration: b.ms, yoyo: true, repeat: b.repeat, ease: 'Sine.InOut',
        onComplete: () => { this.fx.dy = 0; this.fx.rot = 0; this.fx.sy = 1; },
      }));
    }
    const f = def.fx;
    if (f) for (let i = 0; i < f.n; i++) {
      const ch = f.chars[i % f.chars.length], a = (i / f.n) * Math.PI * 2, r = Phaser.Math.Between(20, 60);
      const sx = this.x + (f.mode === 'burst' ? 0 : Phaser.Math.Between(-34, 34)), sy = this.y - (f.mode === 'fall' ? 120 : 40);
      const t = sc.add.text(sx, sy, ch, { fontSize: `${Phaser.Math.Between(14, 22)}px` }).setOrigin(0.5).setDepth(1e6).setAlpha(0);
      const tw = f.mode === 'burst' ? { x: sx + Math.cos(a) * r * 1.6, y: sy - 30 + Math.sin(a) * r }
        : f.mode === 'fall' ? { x: sx + Phaser.Math.Between(-20, 20), y: this.y - 10 } : { x: sx + Phaser.Math.Between(-18, 18), y: sy - 70 };
      sc.tweens.add({
        targets: t, ...tw, alpha: { from: 1, to: 0 }, duration: f.slow ? 2200 : 1400, delay: i * (f.slow ? 450 : 90), ease: 'Sine.Out',
        onStart: () => t.setAlpha(1), onComplete: () => t.destroy(),
      });
    }
  }

  clearEmote() {
    clearTimeout(this.emoteTimer);
    this.emoteTweens.forEach((t) => t.remove()); this.emoteTweens = [];
    this.fx.dy = 0; this.fx.rot = 0; this.fx.sy = 1;
    this.emoteIcon?.destroy(); this.emoteIcon = null;
  }

  destroy() {
    clearTimeout(this.bubbleTimer); this.bubble?.destroy(); this.clearEmote();
    [this.hitbox, this.shadow, this.root, this.label].forEach((o) => o.destroy());
  }
}
