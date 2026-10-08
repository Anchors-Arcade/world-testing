import { MinigameScene, W, H, clock } from './MinigameScene.js';
import { GAMES } from './registry.js';
import { SLED, sledScore } from './scoring.js';
import { Pool } from './Pool.js';
import { sfx } from './sfx.js';
import { bake, skyTexture, mountainTextures } from '../utils/worldArt.js';

// SLOPE SLED RUN — a side-on mountain hill. Ride the ski lift to the summit, then sled down three depth lanes:
// steer between lanes (↑ ↓), jump (SPACE), tuck / brake (→ ←), hit snow ramps for air, grab coins, dodge rocks and snowmen.
// The hill is ONE height function (terr); everything (sled, objects, trees, pylons) sits on it, so it reads as a real slope.
const L = SLED.length, SX = 300, LANE_GAP = 30, SLED_Y = 44;                  // sled's screen column; lane spacing; sled sits this far below the ridge line
const terr = (x) => { const t = Math.min(x, L - 1100); return t * 0.2 + 40 * Math.sin(t / 640) + 18 * Math.sin(t / 230 + 1) + (x - t) * 0.05; };
const slope = (x) => (terr(x + 6) - terr(x - 6)) / 12;
const liftTerr = (x) => 900 - x * 0.38 + 14 * Math.sin(x / 300);               // the summit lift runs up a steeper face
const CABLE = (x) => 900 - x * 0.38 - 190;                                      // straight cable
const KINDS = {
  rock:    { tex: 'mg_rock',    sc: 0.8,  hw: 26, hh: 26, crash: true },
  snowman: { tex: 'mg_snowman', sc: 0.72, hw: 22, hh: 44, crash: true },
  pine:    { tex: 'pine',       sc: 0.55, hw: 18, hh: 70, crash: true, oy: 0.97 },
  ramp:    { tex: 'sl_ramp',    sc: 1,    hw: 70, hh: 0 },
  boost:   { tex: 'mg_boost',   sc: 0.8,  hw: 30, hh: 0 },
  coin:    { tex: 'mg_coin',    sc: 1,    hw: 24, hh: 0, pick: 'coin' },
  gem:     { tex: 'mg_gem',     sc: 1,    hw: 24, hh: 0, pick: 'gem' },
};

function makeCourse() {                                                          // fixed + hand-balanced: leaderboard runs are fair
  let seed = 31; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647), out = [];
  let x = 900;
  while (x < L - 800) {
    const prog = x / L, r = rnd(), lane = Math.floor(rnd() * 3), other = (lane + 1 + Math.floor(rnd() * 2)) % 3;
    if (r < 0.3) { const k = rnd() < 0.5 ? 'rock' : rnd() < 0.6 ? 'snowman' : 'pine'; out.push({ k, x, lane }); if (prog > 0.35 && rnd() < 0.5) out.push({ k: 'rock', x: x + 20, lane: other }); }
    else if (r < 0.5) for (let i = 0; i < 6; i++) out.push({ k: 'coin', x: x + i * 52, lane, h: 0 });
    else if (r < 0.68) { out.push({ k: 'ramp', x, lane }); for (let i = 0; i < 5; i++) out.push({ k: 'coin', x: x + 190 + i * 56, lane, h: 70 + Math.sin(i / 4 * Math.PI) * 60 }); if (rnd() < 0.3) out.push({ k: 'gem', x: x + 300, lane, h: 150 }); }
    else if (r < 0.8) out.push({ k: 'boost', x, lane });
    else { out.push({ k: 'snowman', x, lane }); for (let i = 0; i < 4; i++) out.push({ k: 'coin', x: x + i * 50, lane: other, h: 0 }); }
    x += 300 - 110 * prog + rnd() * 120;
  }
  return out.sort((a, b) => a.x - b.x);
}
const COURSE = makeCourse();

export class SledRun extends MinigameScene {
  constructor() { super({ ...GAMES.slope_sled, bg: 0x6fa6d4 }); }

  build() {
    const gen = (k, w, h, fn) => bake(this, k, w, h, fn);
    gen('sl_ramp', 150, 50, (g) => { g.fillStyle(0x16304a, 0.18); g.fillEllipse(75, 46, 140, 10); g.fillStyle(0xcfe6f4); g.fillTriangle(4, 46, 146, 46, 146, 8); g.fillStyle(0xffffff); g.fillTriangle(4, 46, 146, 8, 100, 46); g.fillStyle(0x9fc6e0); g.fillRect(146, 8, 4, 38); g.fillStyle(0xe8483c); for (let i = 0; i < 4; i++) g.fillRect(20 + i * 30, 36 - i * 8 + 4, 12, 3); });
    gen('sl_chair', 70, 70, (g) => { g.lineStyle(3, 0x2b3340); g.lineBetween(35, 0, 35, 34); g.fillStyle(0xe8483c); g.fillRoundedRect(8, 34, 54, 10, 4); g.fillRoundedRect(8, 18, 8, 26, 3); g.fillStyle(0x2b3340); g.fillRect(6, 44, 58, 3); g.fillStyle(0xffffff); g.fillRoundedRect(6, 14, 12, 5, 2); });
    gen('sl_pylon', 30, 260, (g) => { g.fillStyle(0x4b5563); g.fillRect(12, 20, 6, 240); g.fillStyle(0x374151); g.fillRect(2, 8, 26, 10); g.fillStyle(0xe8483c); g.fillCircle(6, 13, 3); g.fillCircle(24, 13, 3); g.fillStyle(0xffffff); g.fillRect(0, 4, 30, 5); });
    gen('sl_arch', 60, 160, (g) => { g.fillStyle(0xe8483c); g.fillRect(4, 20, 10, 140); g.fillStyle(0x3b82d9); g.fillRect(46, 20, 10, 140); g.fillStyle(0xffffff); g.fillRect(0, 10, 60, 24); for (let i = 0; i < 6; i++) { g.fillStyle(i % 2 ? 0x16304a : 0xffffff); g.fillRect(i * 10, 10, 10, 12); g.fillRect(i * 10 + (i % 2 ? -10 : 10), 22, 10, 12); } });
    gen('sl_cabin', 120, 90, (g) => { g.fillStyle(0x8c5a3a); g.fillRoundedRect(10, 34, 100, 54, 4); g.fillStyle(0x3d5a80); g.fillTriangle(0, 38, 60, 0, 120, 38); g.fillStyle(0xffffff); g.fillEllipse(60, 10, 58, 18); g.fillStyle(0xfff0b0); g.fillRoundedRect(22, 50, 24, 22, 3); g.fillRoundedRect(76, 50, 24, 22, 3); g.fillStyle(0x5a3b22); g.fillRoundedRect(52, 56, 18, 32, { tl: 9, tr: 9, bl: 0, br: 0 }); });
    const sky = skyTexture(this, 0x2c5f95); this.mtKeys = mountainTextures(this);
    this.add.image(-1200, -400, sky).setOrigin(0).setDisplaySize(4000, 1400).setDepth(-200);
    this.sun = this.add.circle(720, 120, 46, 0xfff1c2, 0.9).setDepth(-199);
    this.mts = this.mtKeys.map((k, i) => this.add.tileSprite(W / 2, 330, 3000, 400, k).setOrigin(0.5, 1).setTileScale(2, 2).setDepth(-190 + i));
    this.haze = this.add.rectangle(W / 2, 0, 3000, 1400, 0xb4cde2).setOrigin(0.5, 0).setDepth(-189.5);   // fills the valley below the mountain base
    this.gTerr = this.add.graphics().setDepth(-100);                              // the slope, redrawn from the height function each frame (~110 triangles)
    this.gCable = this.add.graphics().setDepth(-60);
    this.arch = this.add.image(0, 0, 'sl_arch').setOrigin(0.5, 1).setDepth(8).setVisible(false);
    this.cabin = this.add.image(0, 0, 'sl_cabin').setOrigin(0.5, 1).setDepth(-50).setVisible(false);
    this.chair = this.add.image(0, 0, 'sl_chair').setOrigin(0.5, 0).setDepth(30);
    this.sled = this.add.image(0, 0, 'mg_sled').setDepth(20);
    this.av = this.makeAvatar(0, 0); this.av.gs = 0.8;
    this.spray = this.add.particles(0, 0, 'mg_dot', { lifespan: 380, speedY: { min: -120, max: -40 }, speedX: { min: -190, max: -80 }, scale: { start: 0.8, end: 0 }, alpha: { start: 0.9, end: 0 }, frequency: 40, emitting: false }).setDepth(19);
    this.snow = this.add.particles(0, -10, 'mg_dot', { x: { min: -100, max: W + 100 }, lifespan: 5500, speedY: { min: 40, max: 90 }, speedX: { min: -50, max: -10 }, scale: { min: 0.3, max: 0.8 }, alpha: { min: 0.5, max: 0.9 }, frequency: 140 }).setDepth(800);
    this.pool = new Pool(() => this.add.image(0, 0, 'mg_rock'), 40);              // course objects: only those near the screen exist
    this.trees = new Pool(() => this.add.image(0, 0, 'pine').setOrigin(0.5, 0.97), 22);   // background / foreground forest, recycled
    this.pylons = new Pool(() => this.add.image(0, 0, 'sl_pylon').setOrigin(0.5, 1).setDepth(-55), 8);
    this.active = []; this.forest = [];
    this.keys.UP.on?.('down', () => this.lane(-1)); this.keys.W.on?.('down', () => this.lane(-1));
    this.keys.DOWN.on?.('down', () => this.lane(1)); this.keys.S.on?.('down', () => this.lane(1));
    this.keys.SPACE.on?.('down', () => this.jump());
    this.input.on('pointerdown', (p) => { this.pd = { x: p.x, y: p.y, t: this.time.now }; });
    this.input.on('pointerup', (p) => {                                           // swipe up/down = change lane, tap = jump
      if (!this.pd) return; const dy = p.y - this.pd.y, dx = Math.abs(p.x - this.pd.x);
      if (Math.abs(dy) > 36 && Math.abs(dy) > dx) this.lane(dy < 0 ? -1 : 1); else if (this.time.now - this.pd.t < 300) this.jump();
      this.pd = null;
    });
    this.resetRun();
  }

  resetRun() {
    for (const a of this.active) this.pool.put(a.spr); this.active.length = 0;
    for (const f of this.forest) this.trees.put(f.spr); this.forest.length = 0; this.pylons.clear();
    this.phase = 'lift'; this.lt = 0; this.cx = 0;                                // lift progress (seconds, chair x)
    this.x = 0; this.v = 0; this.h = 0; this.vh = 0; this.laneIdx = 1; this.laneY = 0; this.air = 0; this.tilt = 0;
    this.coins = 0; this.gems = 0; this.airs = 0; this.crashes = 0; this.inv = 0; this.boostT = 0; this.tumble = 0; this.next = 0; this.done = false; this.fadeT = 0;
    this.arch.setVisible(false); this.cabin.setVisible(false); this.spray.stop();
    this.draw(0);
  }
  onStart() { this.banner('🚡 RIDING TO THE SUMMIT'); }
  banner(s) { this.msg?.destroy(); this.msg = this.text(W / 2, 96, s, 26, '#ffffff', { stroke: '#16304a', strokeThickness: 6 }).setDepth(850); this.tweens.add({ targets: this.msg, alpha: 0, delay: 1700, duration: 400 }); }

  lane(d) { if (this.state === 'playing' && this.phase === 'ride') this.laneIdx = Math.max(0, Math.min(2, this.laneIdx + d)); }
  jump() { if (this.state === 'playing' && this.phase === 'ride' && this.h <= 1) { this.vh = 560; this.h = 1; sfx.play('throw'); } }

  tick(dt) {
    if (this.phase === 'lift') return this.tickLift(dt);
    const k = this.keys, brake = k.LEFT.isDown || k.A.isDown, tuck = k.RIGHT.isDown || k.D.isDown, sl = slope(this.x), prog = this.x / L;
    const want = 340 + 1500 * Math.max(0, sl - 0.02) + 160 * prog + (tuck ? 140 : 0) - (brake ? 190 : 0) + (this.boostT > 0 ? 300 : 0);
    this.v += (Math.max(130, want * (this.inv > 0.6 ? 0.5 : 1)) - this.v) * Math.min(1, (want > this.v ? 1.3 : 3.2) * dt);
    this.boostT = Math.max(0, this.boostT - dt); this.inv = Math.max(0, this.inv - dt);
    this.x += this.v * dt;
    this.laneY += ((this.laneIdx - 1) * LANE_GAP - this.laneY) * Math.min(1, 14 * dt);   // smooth lane change
    if (this.h > 0) {                                                             // airborne: simple ballistic arc, tilt eases to the slope on landing
      this.air += dt; this.h += this.vh * dt; this.vh -= 1500 * dt;
      if (this.h <= 0) { this.h = 0; this.vh = 0; if (this.air > 0.55) { this.airs++; this.floatText(SX, 190, 'AIR! +' + SLED.airPts, '#ffc247', 28); sfx.play('gem'); } this.air = 0; this.burst(SX, 330, 10); }
    }
    this.collide(); this.stream(); this.draw(dt);
    if (this.state !== 'playing') return;
    if (this.x >= L) return this.complete(true);
    if (this.runMs >= SLED.timeLimitMs) this.complete(false);
  }

  tickLift(dt) {
    this.lt += dt;
    const sp = Math.min(1, this.lt / 0.8) * 430; this.cx += sp * dt;
    this.draw(dt);
    if (this.cx >= SLED.liftLen && !this.fadeT) {                                 // arrive: fade out, then drop in at the top with the sled
      this.fadeT = 1; this.cameras.main.fadeOut(260, 255, 255, 255);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.phase = 'ride'; this.banner('🛷 HOLD ON! ↑↓ lanes · SPACE jump'); this.cameras.main.fadeIn(300, 255, 255, 255); sfx.play('go');
      });
    }
  }

  collide() {
    for (const a of this.active) {
      const o = a.o, K = a.K; if (a.dead || o.lane !== this.laneIdx || Math.abs(o.x - this.x) > K.hw * 0.7 + 14) continue;
      if (K.crash) {
        if (this.inv > 0 || this.h > K.hh) continue;
        this.crashes++; this.inv = 1.2; this.v *= 0.35; this.tumble = 0.6; this.shake(150, 0.007); this.flash(255, 255, 255); sfx.play('bad');
        this.floatText(SX, 200, 'OUCH!', '#ff9a8a', 28);
      } else if (K.pick) {
        if (Math.abs((o.h || 0) - this.h) > 52) continue;
        a.dead = true; a.spr.setVisible(false); if (K.pick === 'gem') this.gems++; else this.coins++;
        sfx.play(K.pick); this.floatText(SX + 30, 230 - (o.h || 0), K.pick === 'gem' ? '+' + SLED.gem : '+' + SLED.coin, '#ffe066', 22);
      } else if (K.tex === 'sl_ramp' && this.h <= 2 && !a.used && this.x > o.x + 55) {
        a.used = true; this.vh = 380 + this.v * 0.45; this.h = 1; sfx.play('boost'); this.shake(80, 0.004);
      } else if (K.tex === 'mg_boost' && this.boostT < 0.6) { this.boostT = 1.4; sfx.play('boost'); this.floatText(SX, 200, 'BOOST!', '#ffc247', 28); }
    }
  }

  // spawn what is about to scroll in; recycle what left; the forest and pylons follow the same rule
  stream() {
    const cx = this.x - SX;
    while (this.next < COURSE.length && COURSE[this.next].x - cx < W + 160) {
      const o = COURSE[this.next], K = KINDS[o.k], spr = this.pool.get(); if (!spr) break; this.next++;
      spr.setTexture(K.tex).setScale(K.sc).setOrigin(0.5, K.oy ?? 0.85).setAlpha(1).setVisible(true);
      this.active.push({ o, K, spr, dead: false, used: false });
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i];
      if (a.o.x - cx < -160) { this.pool.put(a.spr); this.active[i] = this.active[this.active.length - 1]; this.active.pop(); }
    }
  }

  ridgeY(wx, cy) { return terr(wx) - cy; }

  draw(dt) {
    const g = this.gTerr, lift = this.phase === 'lift';
    const fx = lift ? this.cx : this.x, fy = lift ? liftTerr(this.cx) - 150 : terr(this.x) + SLED_Y + this.laneY - this.h;
    const camX = fx - SX, camY = fy - 320, F = lift ? liftTerr : terr;
    this.mts.forEach((m, i) => { m.tilePositionX = camX * [0.03, 0.06, 0.1][i] / 2; m.y = 380 - camY * [0.05, 0.08, 0.12][i] + (lift ? 0 : 0); });
    this.sun.y = 120 - camY * 0.02; this.haze.y = this.mts[2].y - 2;
    g.clear();
    for (let sx = -30; sx <= W + 50; sx += 20) {                                  // snow slope: lit surface + a shaded lower band for volume
      const y0 = F(camX + sx) - camY, y1 = F(camX + sx + 20) - camY;
      g.fillStyle(0xf4fbff); g.fillTriangle(sx, y0 - 8, sx + 20, y1 - 8, sx, H + 400); g.fillTriangle(sx + 20, y1 - 8, sx + 20, H + 400, sx, H + 400);
      g.fillStyle(0xd3e7f4, 0.8); g.fillTriangle(sx, y0 + 96, sx + 20, y1 + 96, sx, H + 400); g.fillTriangle(sx + 20, y1 + 96, sx + 20, H + 400, sx, H + 400);
      g.fillStyle(0xffffff); g.fillTriangle(sx, y0 - 8, sx + 20, y1 - 8, sx, y0 + 4); g.fillTriangle(sx + 20, y1 - 8, sx + 20, y1 + 4, sx, y0 + 4);
    }
    if (lift) this.drawLift(camX, camY); else this.drawRide(camX, camY, dt);
  }

  drawLift(camX, camY) {
    const c = this.gCable; c.clear(); c.lineStyle(3, 0x2b3340);
    c.lineBetween(-20, CABLE(camX - 20) - camY, W + 20, CABLE(camX + W + 20) - camY);
    this.pylons.clear();
    for (let wx = Math.floor((camX - 40) / 520) * 520; wx < camX + W + 60; wx += 520) {
      const p = this.pylons.get(); if (!p) break; p.setOrigin(0.5, 0).setPosition(wx - camX, CABLE(wx) - camY - 8).setDisplaySize(30, liftTerr(wx) - CABLE(wx) + 14);
    }
    this.chair.setVisible(true).setPosition(SX, CABLE(this.cx) - camY).setRotation(Math.sin(this.lt * 2.2) * 0.04);
    this.sled.setPosition(SX, CABLE(this.cx) - camY + 56).setRotation(-0.2);       // the sled rides on the penguin's lap
    this.placeAvatar(this.av, SX, CABLE(this.cx) - camY + 48, 'right', false); this.av.root.setDepth(31); this.av.fx.rot = -0.12;
    this.cabin.setVisible(this.cx > SLED.liftLen - 900).setPosition(SLED.liftLen + 160 - camX, liftTerr(SLED.liftLen + 160) - camY - 8);
    this.arch.setVisible(false);
  }

  drawRide(camX, camY, dt) {
    this.gCable.clear(); this.chair.setVisible(false); this.cabin.setVisible(false); this.pylons.clear();
    // forest: deterministic positions along the ridge (far = small & high on the screen, near = big & low), pooled
    for (const f of this.forest) this.trees.put(f.spr); this.forest.length = 0;
    for (let wx = Math.floor((camX - 60) / 170) * 170; wx < camX + W + 120; wx += 170) {
      const near = ((wx / 170) | 0) % 3 === 0, jit = (Math.sin(wx * 12.9898) * 43758.5453) % 1, spr = this.trees.get(); if (!spr) break;
      const x = wx + jit * 60, y = near ? terr(x) - camY + 185 : terr(x) - camY - 22, sc = near ? 0.8 : 0.5;
      spr.setPosition(x - camX, y).setScale(sc).setDepth(near ? 2 : -70).setTint(near ? 0xffffff : 0xc3d9e8); this.forest.push({ spr });
    }
    for (const a of this.active) {
      const o = a.o, K = a.K, sx = o.x - camX, sy = terr(o.x) - camY + SLED_Y + (o.lane - 1) * LANE_GAP - (o.h || 0);
      a.spr.setPosition(sx, sy).setDepth(o.lane * 6 + 5); if (K.pick) a.spr.setScale(K.sc * (0.9 + Math.sin(this.time.now / 160 + o.x) * 0.08));
    }
    const fin = L - camX; this.arch.setVisible(fin < W + 80).setPosition(fin, terr(L) - camY + SLED_Y + 30).setDepth(8);
    const sl = Math.atan(slope(this.x)), blink = this.inv > 0 && Math.floor(this.inv * 14) % 2 === 0;
    this.tilt += ((this.h > 0 ? -0.25 + this.vh / 2400 : sl) - this.tilt) * Math.min(1, 12 * (dt || 0.016));
    this.tumble = Math.max(0, this.tumble - (dt || 0.016));
    const sy = terr(this.x) - camY + SLED_Y + this.laneY - this.h, d = 10 + this.laneIdx * 6;
    this.sled.setVisible(true).setPosition(SX, sy + 12).setRotation(this.tilt).setAlpha(blink ? 0.4 : 1).setDepth(d);
    this.av.fx.rot = this.tilt * 0.6 + (this.tumble > 0 ? Math.sin(this.tumble * 40) * 0.5 : 0);
    this.placeAvatar(this.av, SX, sy, 'right', this.v > 40); this.av.root.setAlpha(blink ? 0.45 : 1).setDepth(d + 1);
    this.spray.setPosition(SX - 26, sy + 20).setDepth(d - 1);
    if (this.h > 0) this.spray.stop(); else if (this.state === 'playing' && !this.spray.emitting) this.spray.start();
  }

  complete(finished) {
    this.done = finished; const timeMs = Math.round(this.runMs), progress = Math.min(1, this.x / L);
    const score = sledScore({ timeMs, coins: this.coins, gems: this.gems, airs: this.airs, crashes: this.crashes, finished, progress });
    this.spray.stop();
    this.finish({
      score, banner: finished ? 'FINISH!' : "TIME'S UP!", win: finished, title: finished ? '🛷 SLOPE SLED RUN COMPLETE!' : '⏱ TIME’S UP!',
      stats: { coins: this.coins, gems: this.gems, airs: this.airs, crashes: this.crashes, finished: finished ? 1 : 0 },
      lines: [finished ? `Time ${clock(timeMs)}` : `${Math.round(progress * 100)}% down the hill`, `🪙 ${this.coins}  💎 ${this.gems}  🌬 ${this.airs} jumps  💥 ${this.crashes}`],
    });
  }

  idle(dt) {
    if (this.state === 'finishing' && this.phase === 'ride') { this.v *= Math.max(0, 1 - 2.4 * dt); this.x += this.v * dt; this.draw(dt); }
  }

  hudText() {
    const km = Math.round((this.phase === 'ride' ? this.v : 0) * 0.12);
    return { left: `⏱ ${clock(this.runMs)}`, mid: this.phase === 'lift' ? '🚡 Ski lift…' : `🪙 ${this.coins}  ·  ${Math.min(100, Math.floor(this.x / L * 100))}%`, right: `⚡ ${km} km/h` };
  }
}
