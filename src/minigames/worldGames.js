import { MinigameScene, W, H, fmt } from './MinigameScene.js';
import { GAMES } from './registry.js';
import { sfx } from './sfx.js';
import {
  FIREFLY, COCOA, FISHING, CRATES, CLIMB, ECHO,
  fireflyScore, cocoaScore, fishingScore, crateScore, climbScore, echoScore,
} from './scoring.js';

// =====================================================================
// PHASE 10 — one activity per world map. Every game here extends the SAME MinigameScene as the three arcade games
// (start screen, countdown, pause, server-timed session, result screen, leaderboards), so none of that is rebuilt.
// The only differences: they are launched from an object in the world instead of an arcade cabinet, and on exit they
// return you to the spot you were standing in (`def.world = true`) instead of opening the Arcade.
//
// All art is drawn with graphics primitives — no new textures, nothing to download.
// =====================================================================

const rnd = Phaser.Math.Between, rndF = Phaser.Math.FloatBetween;

// A soft vertical backdrop + ground line, shared by all seven.
function backdrop(scene, top, bottom, ground = null) {
  const g = scene.add.graphics().setDepth(-100);
  g.fillGradientStyle(top, top, bottom, bottom, 1); g.fillRect(-200, -200, W + 400, H + 400);
  if (ground !== null) { g.fillStyle(ground); g.fillRect(-200, H - 90, W + 400, 200); g.fillStyle(0xffffff, 0.18); g.fillRect(-200, H - 90, W + 400, 6); }
  return g;
}

// ---------------------------------------------------------------------
// 1. FIREFLY CATCH — Deep Forest. Tap the drifting snow-sprites, leave the angry ones alone.
// ---------------------------------------------------------------------
export class FireflyCatch extends MinigameScene {
  constructor() { super(GAMES.firefly_catch); }

  build() {
    backdrop(this, 0x0d2b2b, 0x1b4a3f, 0x12382f);
    const g = this.add.graphics().setDepth(-90);                       // pine silhouettes
    for (let i = 0; i < 9; i++) {
      const x = 40 + i * 110 + rnd(-20, 20), h = rnd(170, 280);
      g.fillStyle(i % 2 ? 0x0e2a24 : 0x0b241f);
      g.fillTriangle(x, H - 90 - h, x - 60, H - 70, x + 60, H - 70);
    }
    this.motes = [];
    this.hint = this.text(W / 2, H - 40, 'Tap the glowing sprites — leave the red ones alone!', 17, '#cfe8f5').setDepth(200);
    this.input.on('pointerdown', (p) => this.state === 'playing' && this.grab(p.worldX, p.worldY));
  }

  resetRun() {
    this.motes.forEach((m) => m.obj.destroy());
    this.motes = []; this.score = 0; this.streak = 0; this.best = 0; this.caught = 0; this.spawnAt = 0;
  }

  spawn() {
    const bad = Math.random() < FIREFLY.badChance;
    const kind = bad ? 'wasp' : Math.random() < 0.18 ? 'bright' : 'spark';
    const x = rnd(70, W - 70), y = rnd(90, H - 150);
    const color = kind === 'wasp' ? 0xe8483c : kind === 'bright' ? 0xffc247 : 0x8ff0b3;
    const obj = this.add.container(x, y).setDepth(100);
    const halo = this.add.circle(0, 0, 26, color, 0.22);
    const core = this.add.circle(0, 0, kind === 'bright' ? 13 : 10, color, 0.95);
    obj.add([halo, core]);
    if (!this.reduce) this.tweens.add({ targets: halo, scale: 1.5, alpha: 0.08, duration: 700, yoyo: true, repeat: -1 });
    const m = { obj, kind, color, life: FIREFLY.lifeMs, vx: rndF(-40, 40), vy: rndF(-30, 30) };
    this.motes.push(m);
  }

  grab(x, y) {
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      if (Math.hypot(m.obj.x - x, m.obj.y - y) > 34) continue;
      if (m.kind === 'wasp') {
        this.score = Math.max(0, this.score - FIREFLY.penalty); this.streak = 0;
        this.floatText(m.obj.x, m.obj.y, `-${FIREFLY.penalty}`, '#ff8a7a', 26); this.shake(); sfx.play('hit');
      } else {
        this.streak++; this.best = Math.max(this.best, this.streak); this.caught++;
        const mult = Math.min(FIREFLY.maxMult, 1 + Math.floor(this.streak / FIREFLY.perStep));
        const pts = (m.kind === 'bright' ? FIREFLY.bright : FIREFLY.spark) * mult;
        this.score += pts;
        this.floatText(m.obj.x, m.obj.y, `+${pts}${mult > 1 ? ` ×${mult}` : ''}`, '#8ff0b3', 24);
        this.burst(m.obj.x, m.obj.y, 10); sfx.play('coin');
      }
      m.obj.destroy(); this.motes.splice(i, 1);
      return;
    }
    this.streak = 0;                                                    // a wild tap breaks the streak
  }

  tick(dt) {
    this.spawnAt -= dt * 1000;
    if (this.spawnAt <= 0 && this.motes.length < FIREFLY.maxLive) { this.spawn(); this.spawnAt = rnd(FIREFLY.spawnMinMs, FIREFLY.spawnMaxMs); }
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.obj.x = Phaser.Math.Clamp(m.obj.x + m.vx * dt, 50, W - 50);
      m.obj.y = Phaser.Math.Clamp(m.obj.y + m.vy * dt, 80, H - 130);
      m.life -= dt * 1000;
      if (m.life < 400) m.obj.setAlpha(Math.max(0, m.life / 400));
      if (m.life <= 0) { m.obj.destroy(); this.motes.splice(i, 1); }
    }
    if (this.runMs >= FIREFLY.timeMs) this.finish({
      score: fireflyScore({ points: this.score }), banner: 'TIME!',
      lines: [`${this.caught} sprites`, `Best streak ${this.best}`], stats: { caught: this.caught, streak: this.best },
    });
  }

  hudText() {
    return { left: `⭐ ${fmt(this.score)}`, mid: `${Math.ceil((FIREFLY.timeMs - this.runMs) / 1000)}s`, right: this.streak > 1 ? `🔥 ${this.streak}` : '' };
  }
}

// ---------------------------------------------------------------------
// 2. COCOA RUSH — Snow Camp. Read the order, press the ingredients in the right order, don't burn the clock.
// ---------------------------------------------------------------------
const INGREDIENTS = [['🍫', 'Cocoa', 0x6b4428], ['🥛', 'Milk', 0xf4fbff], ['🍬', 'Sugar', 0xff9fc1], ['🫚', 'Spice', 0xe9a23b]];

export class CocoaRush extends MinigameScene {
  constructor() { super(GAMES.cocoa_rush); }

  build() {
    backdrop(this, 0x1a2b44, 0x33506e, 0x2a3f5c);
    this.text(W / 2, 86, 'ORDER', 16, '#cfe8f5').setDepth(200);
    this.orderText = this.text(W / 2, 134, '', 44, '#ffffff').setDepth(200);
    this.progText = this.text(W / 2, 184, '', 22, '#8ff0b3').setDepth(200);
    this.pads = INGREDIENTS.map(([icon, name, color], i) => {
      const x = 170 + i * 207, y = 360, c = this.add.container(x, y).setDepth(100);
      const box = this.add.rectangle(0, 0, 160, 150, color, 0.9).setStrokeStyle(5, 0x16304a);
      c.add([box, this.add.text(0, -16, icon, { fontSize: '56px' }).setOrigin(0.5),
        this.text(0, 48, `${name}  [${i + 1}]`, 16, '#16304a')]);
      c.setSize(160, 150).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.state === 'playing' && this.press(i));
      return { c, box, color };
    });
    this.text(W / 2, H - 36, 'Press 1–4 or tap the ingredients in the order shown', 16, '#cfe8f5').setDepth(200);
    this.input.keyboard.on('keydown', (e) => {
      if (this.state !== 'playing') return;
      const n = '1234'.indexOf(e.key);
      if (n >= 0) this.press(n);
    });
  }

  resetRun() { this.score = 0; this.served = 0; this.perfect = 0; this.order = []; this.at = 0; this.mistakes = 0; this.newOrder(); }

  newOrder() {
    const len = Math.min(COCOA.maxLen, COCOA.startLen + Math.floor(this.served / COCOA.growEvery));
    this.order = Array.from({ length: len }, () => rnd(0, 3));
    this.at = 0; this.clean = true;
    this.draw();
  }

  draw() {
    this.orderText.setText(this.order.map((i) => INGREDIENTS[i][0]).join(' '));
    this.progText.setText('▲ '.repeat(this.at) + '·'.repeat(Math.max(0, this.order.length - this.at)));
  }

  press(i) {
    const pad = this.pads[i];
    this.tweens.add({ targets: pad.c, scale: 0.92, duration: 70, yoyo: true });
    if (this.order[this.at] === i) {
      this.at++; sfx.play('tick'); this.draw();
      if (this.at >= this.order.length) {
        this.served++;
        const pts = COCOA.base + (this.clean ? COCOA.cleanBonus : 0);
        if (this.clean) this.perfect++;
        this.score += pts;
        this.floatText(W / 2, 240, `☕ +${pts}${this.clean ? ' PERFECT' : ''}`, '#ffc247', 30);
        this.burst(W / 2, 250, 20); sfx.play('win');
        this.newOrder();
      }
    } else {
      this.clean = false; this.mistakes++; this.at = 0;
      this.score = Math.max(0, this.score - COCOA.penalty);
      this.floatText(pad.c.x, pad.c.y - 90, 'Oops!', '#ff8a7a', 24); this.shake(); sfx.play('hit'); this.draw();
    }
  }

  tick() {
    if (this.runMs >= COCOA.timeMs) this.finish({
      score: cocoaScore({ points: this.score }), banner: 'CLOSING TIME!',
      lines: [`${this.served} cups served`, `${this.perfect} perfect`], stats: { served: this.served, perfect: this.perfect },
    });
  }

  hudText() {
    return { left: `⭐ ${fmt(this.score)}`, mid: `${Math.ceil((COCOA.timeMs - this.runMs) / 1000)}s`, right: `☕ ${this.served}` };
  }
}

// ---------------------------------------------------------------------
// 3. ICE FISHING — Frozen Lake. Stop the marker inside the shrinking green zone.
// ---------------------------------------------------------------------
export class IceFishing extends MinigameScene {
  constructor() { super(GAMES.ice_fishing); }

  build() {
    backdrop(this, 0x0b2033, 0x1d4e73, 0xd6ecf8);
    this.add.ellipse(W / 2, H - 56, 300, 70, 0x0c2a44).setDepth(-80);           // the hole in the ice
    this.add.ellipse(W / 2, H - 56, 300, 70, 0x0c2a44, 1).setStrokeStyle(6, 0xffffff, 0.8).setDepth(-79);
    this.barX = 150; this.barW = W - 300;
    const g = this.add.graphics().setDepth(90);
    g.fillStyle(0x16304a, 0.85); g.fillRoundedRect(this.barX - 10, 300, this.barW + 20, 54, 16);
    this.zone = this.add.rectangle(0, 327, 120, 40, 0x6fd08c, 0.95).setDepth(95);
    this.marker = this.add.rectangle(0, 327, 10, 54, 0xffc247).setDepth(96).setStrokeStyle(3, 0x16304a);
    this.fishText = this.text(W / 2, 200, '🐟', 72).setDepth(100).setAlpha(0);
    this.text(W / 2, 400, 'SPACE, click or tap when the marker is in the green', 17, '#cfe8f5').setDepth(200);
    this.input.on('pointerdown', () => this.state === 'playing' && this.cast());
  }

  resetRun() {
    this.score = 0; this.casts = 0; this.hits = 0; this.streak = 0; this.bestStreak = 0;
    this.pos = 0; this.dir = 1; this.speed = FISHING.speed; this.zoneW = FISHING.zoneW;
    this.placeZone();
  }

  placeZone() {
    this.zoneX = rndF(0.12, 0.88);
    this.zone.setSize(this.zoneW, 40).setPosition(this.barX + this.zoneX * this.barW, 327);
  }

  cast() {
    this.casts++;
    const mx = this.barX + this.pos * this.barW, half = this.zoneW / 2;
    const d = Math.abs(mx - this.zone.x);
    if (d <= half) {
      const perfect = d <= half * 0.3;
      const kind = perfect ? 'golden' : this.zoneW < 90 ? 'big' : 'small';
      this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak); this.hits++;
      const mult = Math.min(FISHING.maxMult, 1 + Math.floor(this.streak / FISHING.perStep));
      const pts = FISHING.values[kind] * mult;
      this.score += pts;
      this.fishText.setText(perfect ? '🏆' : kind === 'big' ? '🐠' : '🐟').setPosition(mx, 240).setAlpha(1).setScale(0.5);
      this.tweens.add({ targets: this.fishText, y: 160, scale: 1.2, alpha: 0, duration: 650 });
      this.floatText(mx, 280, `+${pts}${mult > 1 ? ` ×${mult}` : ''}`, perfect ? '#ffc247' : '#8ff0b3', 26);
      this.burst(mx, 300, perfect ? 30 : 12); sfx.play(perfect ? 'win' : 'coin');
      this.zoneW = Math.max(FISHING.minZone, this.zoneW - FISHING.shrink);
      this.speed = Math.min(FISHING.maxSpeed, this.speed + FISHING.speedUp);
    } else {
      this.streak = 0; this.zoneW = Math.min(FISHING.zoneW, this.zoneW + FISHING.shrink * 2);
      this.floatText(mx, 280, 'It got away…', '#ff8a7a', 20); this.shake(90); sfx.play('hit');
    }
    this.placeZone();
  }

  tick(dt) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.cast();
    this.pos += this.dir * this.speed * dt;
    if (this.pos >= 1) { this.pos = 1; this.dir = -1; } else if (this.pos <= 0) { this.pos = 0; this.dir = 1; }
    this.marker.x = this.barX + this.pos * this.barW;
    if (this.runMs >= FISHING.timeMs) this.finish({
      score: fishingScore({ points: this.score }), banner: 'LINES IN!',
      lines: [`${this.hits}/${this.casts} casts`, `Best streak ${this.bestStreak}`], stats: { hits: this.hits, casts: this.casts },
    });
  }

  hudText() {
    return { left: `⭐ ${fmt(this.score)}`, mid: `${Math.ceil((FISHING.timeMs - this.runMs) / 1000)}s`, right: `🐟 ${this.hits}` };
  }
}

// ---------------------------------------------------------------------
// 4. CRATE STACK — Harbour Village. Drop the swinging crate on the stack; the overhang is lost.
// ---------------------------------------------------------------------
export class CrateStack extends MinigameScene {
  constructor() { super(GAMES.crate_stack); }

  build() {
    backdrop(this, 0x11263d, 0x2a5578, 0x8a6240);
    this.stackG = this.add.graphics().setDepth(50);
    this.crate = this.add.rectangle(0, 110, 180, 44, 0xb5703f).setStrokeStyle(4, 0x6b4428).setDepth(60);
    this.text(W / 2, H - 34, 'SPACE, click or tap to drop the crate', 17, '#cfe8f5').setDepth(200);
    this.input.on('pointerdown', () => this.state === 'playing' && this.drop());
  }

  resetRun() {
    this.stack = []; this.width = CRATES.startW; this.x = W / 2; this.dir = 1; this.speed = CRATES.speed;
    this.score = 0; this.height = 0; this.perfects = 0; this.lives = CRATES.lives; this.dropping = null;
    this.crate.setSize(this.width, 44).setPosition(this.x, 110);
    this.redraw();
  }

  redraw() {
    const g = this.stackG; g.clear();
    this.stack.forEach((s, i) => {
      const y = H - 110 - i * CRATES.h;
      g.fillStyle(i % 2 ? 0xb5703f : 0xc47f4a); g.fillRoundedRect(s.x - s.w / 2, y, s.w, CRATES.h - 4, 5);
      g.lineStyle(3, 0x6b4428); g.strokeRoundedRect(s.x - s.w / 2, y, s.w, CRATES.h - 4, 5);
    });
  }

  drop() {
    if (this.dropping) return;
    const top = this.stack[this.stack.length - 1];
    this.dropping = { x: this.x, w: this.width, y: 110, target: H - 110 - this.stack.length * CRATES.h };
    const prevX = top ? top.x : W / 2, prevW = top ? top.w : CRATES.startW;
    const overlap = Math.min(this.x + this.width / 2, prevX + prevW / 2) - Math.max(this.x - this.width / 2, prevX - prevW / 2);
    this.pending = { overlap, prevX, prevW };
  }

  land() {
    const { overlap, prevX, prevW } = this.pending;
    if (overlap <= 4) {                                         // missed the stack entirely
      this.lives--; this.floatText(this.x, 260, 'SPLASH!', '#ff8a7a', 32); this.shake(220, 0.012); sfx.play('hit');
      this.dropping = null;
      if (this.lives <= 0) return this.over();
      this.width = Math.min(CRATES.startW, this.width + 20);
      return;
    }
    const perfect = Math.abs(this.x - prevX) <= CRATES.perfectPx && this.stack.length > 0;
    const newW = perfect ? this.width : overlap;
    const newX = perfect ? prevX : (Math.min(this.x + this.width / 2, prevX + prevW / 2) + Math.max(this.x - this.width / 2, prevX - prevW / 2)) / 2;
    this.stack.push({ x: newX, w: newW });
    this.height++;
    const pts = CRATES.base + (perfect ? CRATES.perfectBonus : 0) + Math.floor(this.height * CRATES.heightBonus);
    if (perfect) { this.perfects++; this.burst(newX, H - 140 - this.height * CRATES.h, 24); sfx.play('win'); }
    else sfx.play('coin');
    this.score += pts;
    this.floatText(newX, H - 150 - this.height * CRATES.h, `+${pts}${perfect ? ' PERFECT' : ''}`, perfect ? '#ffc247' : '#8ff0b3', 24);
    this.width = newW; this.speed = Math.min(CRATES.maxSpeed, this.speed + CRATES.speedUp);
    this.dropping = null;
    this.redraw();
    if (this.width < CRATES.minW) this.over();
  }

  over() {
    this.finish({
      score: crateScore({ points: this.score }), banner: this.height >= 10 ? 'GREAT STACK!' : 'TIMBER!', win: this.height >= 5,
      lines: [`${this.height} crates high`, `${this.perfects} perfect`], stats: { height: this.height, perfects: this.perfects },
    });
  }

  tick(dt) {
    if (Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) this.drop();
    if (this.dropping) {
      this.dropping.y += CRATES.fall * dt;
      this.crate.setPosition(this.dropping.x, this.dropping.y).setSize(this.dropping.w, 44);
      if (this.dropping.y >= this.dropping.target) { this.land(); if (this.state === 'playing') this.crate.setSize(this.width, 44).setPosition(this.x, 110); }
      return;
    }
    this.x += this.dir * this.speed * dt;
    const pad = this.width / 2 + 20;
    if (this.x > W - pad) { this.x = W - pad; this.dir = -1; } else if (this.x < pad) { this.x = pad; this.dir = 1; }
    this.crate.setPosition(this.x, 110).setSize(this.width, 44);
    if (this.runMs >= CRATES.timeMs) this.over();
  }

  hudText() {
    return { left: `⭐ ${fmt(this.score)}`, mid: `${Math.ceil((CRATES.timeMs - this.runMs) / 1000)}s`, right: `📦 ${this.height}  ❤ ${this.lives}` };
  }
}

// ---------------------------------------------------------------------
// 5. CLIFF CLIMB — Mountain Pass. Climb; dodge the falling rocks.
// ---------------------------------------------------------------------
export class CliffClimb extends MinigameScene {
  constructor() { super(GAMES.cliff_climb); }

  build() {
    backdrop(this, 0x0d1c2b, 0x3a5a78);
    this.wall = this.add.tileSprite(W / 2, H / 2, W, H, '__WHITE').setTint(0x5c6b78).setAlpha(0.25).setDepth(-95);
    this.lines = this.add.graphics().setDepth(-90);
    this.player = this.makeAvatar(W / 2, H - 120);
    this.rocks = []; this.sparkY = 0;
    this.text(W / 2, H - 28, '← → / A D (or drag) to dodge — you climb automatically', 17, '#cfe8f5').setDepth(200);
    this.input.on('pointermove', (p) => { if (this.state === 'playing' && p.isDown) this.px = Phaser.Math.Clamp(p.worldX, 80, W - 80); });
    this.input.on('pointerdown', (p) => { if (this.state === 'playing') this.px = Phaser.Math.Clamp(p.worldX, 80, W - 80); });
  }

  resetRun() {
    this.rocks.forEach((r) => r.obj.destroy()); this.rocks = [];
    this.px = W / 2; this.climb = 0; this.lives = CLIMB.lives; this.spawnAt = 600; this.speed = CLIMB.speed; this.dodged = 0;
    this.placeAvatar(this.player, this.px, H - 120, 'up', true);
  }

  tick(dt) {
    const k = this.keys;
    const dx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    if (dx) this.px = Phaser.Math.Clamp(this.px + dx * CLIMB.moveSpeed * dt, 80, W - 80);
    this.placeAvatar(this.player, this.px, H - 120, dx > 0 ? 'right' : dx < 0 ? 'left' : 'up', true);

    this.speed = Math.min(CLIMB.maxSpeed, this.speed + CLIMB.accel * dt);
    this.climb += this.speed * dt;
    this.wall.tilePositionY -= this.speed * dt * 0.4;
    this.lines.clear().lineStyle(4, 0x7d8c97, 0.35);                      // ledges rushing past
    for (let i = 0; i < 6; i++) {
      const y = ((i * 110 + (this.climb * 0.6) % 110) % (H + 110)) - 55;
      this.lines.lineBetween(0, y, W, y + rnd(-6, 6));
    }

    this.spawnAt -= dt * 1000;
    if (this.spawnAt <= 0) {
      const x = rnd(80, W - 80), big = Math.random() < 0.25;
      const obj = this.add.circle(x, -40, big ? 30 : 19, 0x7d8c97).setStrokeStyle(4, 0x4e5b66).setDepth(100);
      this.rocks.push({ obj, r: big ? 30 : 19, big });
      this.spawnAt = Math.max(CLIMB.spawnMinMs, CLIMB.spawnMaxMs - this.climb * 0.08);
    }
    for (let i = this.rocks.length - 1; i >= 0; i--) {
      const r = this.rocks[i];
      r.obj.y += (this.speed * (r.big ? 1.15 : 1.4)) * dt;
      r.obj.rotation += dt * 2;
      if (Math.hypot(r.obj.x - this.px, r.obj.y - (H - 130)) < r.r + 22) {
        r.obj.destroy(); this.rocks.splice(i, 1);
        this.lives--; this.shake(220, 0.014); this.flash(255, 120, 100); sfx.play('hit');
        this.floatText(this.px, H - 180, '💥', '#ff8a7a', 34);
        this.speed = Math.max(CLIMB.speed, this.speed - 60);
        if (this.lives <= 0) return this.over(false);
        continue;
      }
      if (r.obj.y > H + 60) { r.obj.destroy(); this.rocks.splice(i, 1); this.dodged++; }
    }
    if (this.runMs >= CLIMB.timeMs) this.over(true);
  }

  over(survived) {
    this.finish({
      score: climbScore({ metres: this.climb / CLIMB.pxPerMetre, dodged: this.dodged, survived }),
      banner: survived ? 'SUMMIT!' : 'OOF!', win: survived,
      lines: [`${Math.floor(this.climb / CLIMB.pxPerMetre)} m climbed`, `${this.dodged} rocks dodged`],
      stats: { metres: Math.floor(this.climb / CLIMB.pxPerMetre), dodged: this.dodged },
    });
  }

  hudText() {
    return { left: `⛰️ ${Math.floor(this.climb / CLIMB.pxPerMetre)} m`, mid: `${Math.ceil((CLIMB.timeMs - this.runMs) / 1000)}s`, right: '❤'.repeat(Math.max(0, this.lives)) };
  }
}

// ---------------------------------------------------------------------
// 6 + 7. ECHO games — repeat the pattern. One base class, two very different rooms.
//   Crystal Echo (Ice Caves, 4 crystals)   ·   Star Link (Observatory, 6 stars)
// ---------------------------------------------------------------------
class EchoBase extends MinigameScene {
  build() {
    const s = this.def.echo;
    backdrop(this, s.top, s.bottom);
    this.title = this.text(W / 2, 80, '', 30, '#ffffff').setDepth(200);
    this.sub = this.text(W / 2, 124, '', 18, '#cfe8f5').setDepth(200);
    this.pads = s.spots.map(([x, y, color], i) => {
      const c = this.add.container(x, y).setDepth(100);
      const halo = this.add.circle(0, 0, s.radius + 16, color, 0.12);
      const core = this.add.circle(0, 0, s.radius, color, 0.4).setStrokeStyle(5, 0xffffff, 0.5);
      const icon = this.add.text(0, 0, s.icon, { fontSize: `${s.radius}px` }).setOrigin(0.5).setAlpha(0.65);
      c.add([halo, core, icon]);
      c.setSize(s.radius * 2.2, s.radius * 2.2).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.hit(i));
      return { c, core, halo, icon, color };
    });
    this.text(W / 2, H - 34, s.hint, 17, '#cfe8f5').setDepth(200);
  }

  resetRun() {
    this.seq = []; this.at = 0; this.round = 0; this.score = 0; this.lives = ECHO.lives; this.showing = false; this.timer = 0; this.showIdx = 0;
    this.pads.forEach((p) => p.core.setFillStyle(p.color, 0.4));
    this.nextRound();
  }

  onStart() { this.timer = 400; }

  nextRound() {
    this.round++; this.at = 0;
    this.seq.push(rnd(0, this.pads.length - 1));
    this.showing = true; this.showIdx = 0; this.timer = 420;
    this.title.setText(`ROUND ${this.round}`);
    this.sub.setText('Watch…');
  }

  lightUp(i, strong = true) {
    const p = this.pads[i];
    p.core.setFillStyle(p.color, strong ? 1 : 0.75);
    p.icon.setAlpha(1);
    this.tweens.add({ targets: p.c, scale: 1.12, duration: 110, yoyo: true });
    sfx.play('tick');
    this.time.delayedCall(220, () => { p.core.setFillStyle(p.color, 0.4); p.icon.setAlpha(0.65); });
  }

  hit(i) {
    if (this.state !== 'playing' || this.showing) return;
    this.lightUp(i, false);
    if (this.seq[this.at] === i) {
      this.at++;
      if (this.at >= this.seq.length) {
        const pts = ECHO.base + this.round * ECHO.perRound;
        this.score += pts;
        this.floatText(W / 2, 200, `+${pts}`, '#8ff0b3', 30); this.burst(W / 2, 210, 18); sfx.play('win');
        this.sub.setText('Nice!');
        this.showing = true; this.timer = 700; this.showIdx = -1;      // -1 = pause, then next round
      } else this.sub.setText(`${this.at} / ${this.seq.length}`);
    } else {
      this.lives--; this.shake(); this.flash(255, 120, 100); sfx.play('hit');
      this.floatText(W / 2, 200, 'Wrong one!', '#ff8a7a', 26);
      if (this.lives <= 0) return this.over();
      this.at = 0; this.showing = true; this.showIdx = 0; this.timer = 600;
      this.sub.setText('Watch again…');
    }
  }

  tick(dt) {
    if (!this.showing) {
      if (this.runMs >= ECHO.timeMs) this.over();
      return;
    }
    this.timer -= dt * 1000;
    if (this.timer > 0) return;
    if (this.showIdx === -1) { this.nextRound(); return; }
    if (this.showIdx < this.seq.length) {
      this.lightUp(this.seq[this.showIdx]);
      this.showIdx++;
      this.timer = Math.max(ECHO.minStepMs, ECHO.stepMs - this.round * 22);
      return;
    }
    this.showing = false; this.sub.setText('Your turn!');
  }

  over() {
    this.finish({
      score: echoScore({ points: this.score }), banner: `ROUND ${this.round}`, win: this.round > 4,
      lines: [`Reached round ${this.round}`, `${this.seq.length} long`], stats: { round: this.round },
    });
  }

  hudText() {
    return { left: `⭐ ${fmt(this.score)}`, mid: `${Math.ceil((ECHO.timeMs - this.runMs) / 1000)}s`, right: `R${this.round}  ${'❤'.repeat(Math.max(0, this.lives))}` };
  }
}

export class CrystalEcho extends EchoBase { constructor() { super(GAMES.crystal_echo); } }
export class StarLink extends EchoBase { constructor() { super(GAMES.star_link); } }

export const WORLD_GAME_SCENES = [FireflyCatch, CocoaRush, IceFishing, CrateStack, CliffClimb, CrystalEcho, StarLink];
