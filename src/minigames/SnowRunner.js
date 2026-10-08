import { MinigameScene, W, H } from './MinigameScene.js';
import { GAMES } from './registry.js';
import { RUNNER, runnerScore } from './scoring.js';
import { Pool } from './Pool.js';
import { sfx } from './sfx.js';
import { bake, skyTexture, mountainTextures } from '../utils/worldArt.js';

// SNOW RUNNER — an original endless runner. The penguin runs away from the camera down an icy causeway between snowy
// peaks: three lanes, jump, accelerating speed, rows that get denser but stay fair (the gap between rows is always ~0.8 s
// of running, so higher speed never means less reaction time). Two hits end the run.
// Perspective is a single formula, s(z) = F / (F + z); every sprite, stripe and tree uses it, so the world has real depth.
const HY = 186, GY = 470, LW = 150, F = 14, ZFAR = 100;                           // horizon y, player's feet y, lane width at the player, focal length (m), draw distance (m)
const sOf = (z) => F / (F + Math.max(z, -F * 0.6));
const yOf = (s) => HY + (GY - HY) * s;
const laneX = (lane, s) => W / 2 + lane * LW * s;
const KINDS = {
  barrier: { tex: 'sr_barrier', sc: 1.25, oy: 1,   block: false },                // low: jump it
  crate:   { tex: 'sr_crate',   sc: 1.25, oy: 1,   block: true },                 // tall: change lane
  snowman: { tex: 'mg_snowman', sc: 1.5,  oy: 0.96, block: true },
  coin:    { tex: 'mg_coin',    sc: 1.3,  oy: 1.4, pick: 'coin' },
  gem:     { tex: 'mg_gem',     sc: 1.3,  oy: 1.4, pick: 'gem' },
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class SnowRunner extends MinigameScene {
  constructor() { super({ ...GAMES.snow_runner, bg: 0x24457a }); }

  build() {
    const gen = (k, w, h, fn) => bake(this, k, w, h, fn);
    gen('sr_barrier', 100, 44, (g) => { g.fillStyle(0x16304a, 0.2); g.fillEllipse(50, 40, 96, 8); g.fillStyle(0x5bb6e8); g.fillRoundedRect(2, 10, 96, 28, 6); g.fillStyle(0xe8483c); for (let i = 0; i < 6; i++) g.fillTriangle(8 + i * 16, 38, 18 + i * 16, 38, 18 + i * 16, 10); g.fillStyle(0xffffff); g.fillRoundedRect(0, 4, 100, 10, 5); g.fillStyle(0x2b3340); g.fillRect(8, 36, 6, 8); g.fillRect(86, 36, 6, 8); });
    gen('sr_crate', 96, 112, (g) => { g.fillStyle(0x16304a, 0.2); g.fillEllipse(48, 108, 92, 8); [[4, 58], [12, 8]].forEach(([y, x], i) => { g.fillStyle(0x7a5330); g.fillRoundedRect(i ? 14 : 4, y + 4, 78, 50, 4); g.fillStyle(0xa57444); g.fillRect(i ? 20 : 10, y + 10, 66, 38); g.lineStyle(3, 0x5e4129); g.lineBetween(i ? 20 : 10, y + 10, i ? 86 : 76, y + 48); g.lineBetween(i ? 86 : 76, y + 10, i ? 20 : 10, y + 48); }); g.fillStyle(0xffffff); g.fillRoundedRect(8, 0, 80, 14, 7); });
    gen('sr_lamp', 30, 120, (g) => { g.fillStyle(0x3a3f4b); g.fillRect(13, 14, 4, 106); g.fillStyle(0xffc247, 0.25); g.fillCircle(15, 10, 14); g.fillStyle(0xfff0b0); g.fillRoundedRect(8, 2, 14, 16, 4); g.fillStyle(0xffffff); g.fillRoundedRect(6, -2, 18, 6, 3); });
    const sky = skyTexture(this, 0x1c3a68); this.mtKeys = mountainTextures(this);
    this.add.image(-1200, -600, sky).setOrigin(0).setDisplaySize(4000, HY + 640).setDepth(-300);
    this.auroras = [[0x8ff0b3, 0.2, 70], [0x66e8ff, 0.16, 110], [0xb48cff, 0.14, 40]].map(([c, a, y], i) => {
      const e = this.add.ellipse(W / 2 + (i - 1) * 140, y, 900, 90 + i * 20, c, a).setDepth(-290).setBlendMode(Phaser.BlendModes.ADD);
      if (!this.reduce) this.tweens.add({ targets: e, x: e.x + (i % 2 ? 90 : -90), alpha: a * 0.4, duration: 5000 + i * 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      return e;
    });
    this.mts = this.mtKeys.map((k, i) => this.add.tileSprite(W / 2, HY + 6, 3000, 400, k).setOrigin(0.5, 1).setTileScale(2, 2).setDepth(-280 + i));
    this.add.rectangle(W / 2, HY, 3000, 1000, 0xe6f2fa).setOrigin(0.5, 0).setDepth(-250);          // snowy plain either side of the road
    this.add.rectangle(W / 2, HY - 2, 3000, 26, 0xc9def0, 0.8).setOrigin(0.5, 1).setDepth(-240);   // horizon haze
    this.gRoad = this.add.graphics().setDepth(-200);
    this.av = this.makeAvatar(W / 2, GY); this.av.gs = 1.55; this.av.animRate = 1.8;
    this.snow = this.add.particles(0, -10, 'mg_dot', { x: { min: -100, max: W + 100 }, lifespan: 4500, speedY: { min: 60, max: 130 }, speedX: { min: -30, max: 10 }, scale: { min: 0.3, max: 0.9 }, alpha: { min: 0.5, max: 0.9 }, frequency: 120 }).setDepth(800);
    this.pool = new Pool(() => this.add.image(0, 0, 'sr_barrier'), 70);                                // obstacles + collectibles
    this.scenery = new Pool(() => this.add.image(0, 0, 'pine').setOrigin(0.5, 0.97), 30);              // roadside trees + lamps
    this.keys.LEFT.on('down', () => this.move(-1)); this.keys.A.on('down', () => this.move(-1));
    this.keys.RIGHT.on('down', () => this.move(1)); this.keys.D.on('down', () => this.move(1));
    this.keys.UP.on('down', () => this.jump()); this.keys.W.on('down', () => this.jump()); this.keys.SPACE.on('down', () => this.jump());
    this.input.on('pointerdown', (p) => { this.pd = { x: p.x, y: p.y, t: this.time.now }; });
    this.input.on('pointerup', (p) => {                                                             // swipe = lane / jump, tap = jump
      if (!this.pd) return; const dx = p.x - this.pd.x, dy = p.y - this.pd.y;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy)) this.move(dx < 0 ? -1 : 1); else if (dy < -36) this.jump(); else if (this.time.now - this.pd.t < 300) this.jump();
      this.pd = null;
    });
    this.resetRun();
  }

  resetRun() {
    for (const o of this.objs || []) this.pool.put(o.spr); this.objs = [];
    for (const o of this.trees || []) this.scenery.put(o.spr); this.trees = [];
    this.dist = 0; this.v = RUNNER.startSpeed; this.lane = 0; this.px = 0; this.jy = 0; this.vy = 0;
    this.coins = 0; this.gems = 0; this.lives = RUNNER.lives; this.inv = 0; this.slow = 0; this.nextRow = 40; this.nextTree = 0; this.over = false;
    this.av.fx.dy = 0; this.av.fx.rot = 0; this.draw(0);
  }

  move(d) { if (this.state === 'playing' && !this.over) { const n = Math.max(-1, Math.min(1, this.lane + d)); if (n !== this.lane) { this.lane = n; sfx.play('click'); } } }
  jump() { if (this.state === 'playing' && !this.over && this.jy <= 1) { this.vy = RUNNER.jumpV; this.jy = 1; sfx.play('throw'); } }
  get score() { return runnerScore({ meters: this.dist, coins: this.coins, gems: this.gems }); }

  tick(dt) {
    const t = this.runMs / 1000, diff = Math.min(1, t / 90);
    const target = RUNNER.startSpeed + (RUNNER.maxSpeed - RUNNER.startSpeed) * (1 - Math.exp(-t / RUNNER.rampSecs));
    this.slow = Math.max(0, this.slow - dt); this.inv = Math.max(0, this.inv - dt);
    this.v += ((this.slow > 0 ? target * 0.55 : target) - this.v) * Math.min(1, 3 * dt);
    this.dist += this.v * dt;
    this.px += (this.lane - this.px) * Math.min(1, 15 * dt);
    if (this.jy > 0) { this.jy += this.vy * dt; this.vy -= RUNNER.gravity * dt; if (this.jy <= 0) { this.jy = 0; this.vy = 0; } }
    this.spawn(diff);
    for (let i = this.objs.length - 1; i >= 0; i--) {
      const o = this.objs[i], z = o.wz - this.dist;
      if (z < -F * 0.55) { this.pool.put(o.spr); this.objs[i] = this.objs[this.objs.length - 1]; this.objs.pop(); continue; }
      if (!o.dead && Math.abs(z) < 1.2 && Math.abs(o.lane - this.px) < 0.6) this.touch(o);
    }
    this.draw(dt);
    if (this.over || this.state !== 'playing') return;
    if (this.score >= RUNNER.cap) this.end(true);
  }

  touch(o) {
    const K = KINDS[o.k];
    if (K.pick) {
      o.dead = true; o.spr.setVisible(false); if (K.pick === 'gem') this.gems++; else this.coins++;
      sfx.play(K.pick); this.floatText(W / 2 + this.px * LW, GY - 130, '+' + (K.pick === 'gem' ? RUNNER.gemPts : RUNNER.coinPts), '#ffe066', 22); return;
    }
    if (this.inv > 0 || (!K.block && this.jy > 40)) return;                    // jumped the barrier / still protected
    o.dead = true; this.lives--; this.inv = 1.5; this.slow = 0.8; this.shake(160, 0.008); this.flash(255, 255, 255); sfx.play('bad');
    this.floatText(W / 2 + this.px * LW, GY - 150, this.lives > 0 ? 'OUCH!' : 'CRASH!', '#ff9a8a', 30);
    if (this.lives <= 0) this.end(false);
  }

  end(legend) {
    this.over = true; this.av.fx.rot = 0.5;
    const meters = Math.floor(this.dist), score = this.score;
    this.finish({
      score, banner: legend ? 'LEGEND!' : 'GAME OVER', win: legend, title: legend ? '🏔️ YOU RAN FOREVER!' : '💥 GAME OVER',
      stats: { meters, coins: this.coins, gems: this.gems },
      lines: [`${meters.toLocaleString()} m run`, `🪙 ${this.coins}   💎 ${this.gems}`],
    });
  }

  // Rows are placed by WORLD distance; the gap between rows tracks speed (~0.8 s) so the game gets denser in difficulty but never unfair.
  spawn(diff) {
    while (this.nextRow - this.dist < ZFAR) {
      const wz = this.nextRow, lanes = [-1, 0, 1].sort(() => Math.random() - 0.5), r = Math.random();
      const add = (k, lane, dz = 0) => { const spr = this.pool.get(); if (!spr) return; const K = KINDS[k]; spr.setTexture(K.tex).setScale(K.sc).setOrigin(0.5, K.oy).setVisible(true); this.objs.push({ k, lane, wz: wz + dz, spr, dead: false }); };
      if (r < 0.28) for (let i = 0; i < 6; i++) add(i === 5 && Math.random() < 0.3 ? 'gem' : 'coin', lanes[0], i * 2.6);
      else if (r < 0.5) { add('barrier', lanes[0]); if (diff > 0.25 && Math.random() < 0.6) add('barrier', lanes[1]); for (let i = 0; i < 3; i++) add('coin', lanes[2], i * 2.4); }
      else if (r < 0.72) { add(Math.random() < 0.6 ? 'crate' : 'snowman', lanes[0]); if (diff > 0.2 && Math.random() < 0.55) add('crate', lanes[1]); for (let i = 0; i < 4; i++) add('coin', lanes[2], i * 2.4); }
      else if (r < 0.85 && diff > 0.3) { add('barrier', -1); add('barrier', 0); add('barrier', 1); for (let i = 0; i < 3; i++) add('coin', 0, 2.5 + i * 2); }   // wall of barriers: jump!
      else { add('crate', lanes[0]); add('barrier', lanes[1]); add('coin', lanes[2], 0); add('coin', lanes[2], 3); }
      this.nextRow += Math.max(12, this.v * 0.8 * (1 - 0.15 * diff) + 4);
    }
    while (this.nextTree - this.dist < ZFAR) {                                  // roadside trees + a lamp every few
      const side = (this.treeN = (this.treeN || 0) + 1) % 2 ? 1 : -1, spr = this.scenery.get(); if (!spr) break;
      const lamp = ((this.nextTree / 16) | 0) % 3 === 0;
      spr.setTexture(lamp ? 'sr_lamp' : 'pine').setOrigin(0.5, lamp ? 1 : 0.97).setTint(lamp ? 0xffffff : 0xdce9f2);
      this.trees.push({ wz: this.nextTree, side, spr, lamp }); this.nextTree += 8;
    }
  }

  draw(dt) {
    const g = this.gRoad; g.clear();
    const gap = 10, m = this.dist % gap, par = Math.floor(this.dist / gap), E = 1.85 * LW, B = 2.35 * LW;
    for (let i = -1; i < 13; i++) {                                           // road + snowbanks in alternating bands = a sense of speed
      const z0 = Math.max(-4, i * gap - m), z1 = (i + 1) * gap - m, s0 = sOf(z0), s1 = sOf(z1), y0 = yOf(s0), y1 = yOf(s1), odd = (i + par) % 2;
      const quad = (xa0, xa1, xb0, xb1) => { g.fillTriangle(xa0, y0, xa1, y0, xb0, y1); g.fillTriangle(xa1, y0, xb1, y1, xb0, y1); };
      g.fillStyle(odd ? 0x9fc3df : 0x93b8d6); quad(W / 2 - E * s0, W / 2 + E * s0, W / 2 - E * s1, W / 2 + E * s1);
      g.fillStyle(odd ? 0xffffff : 0xdceaf5);
      quad(W / 2 - B * s0, W / 2 - E * s0, W / 2 - B * s1, W / 2 - E * s1); quad(W / 2 + E * s0, W / 2 + B * s0, W / 2 + E * s1, W / 2 + B * s1);
      if (odd) { g.fillStyle(0xffffff, 0.8); for (const l of [-0.5, 0.5]) quad(W / 2 + (l * LW - 3) * s0, W / 2 + (l * LW + 3) * s0, W / 2 + (l * LW - 3) * s1, W / 2 + (l * LW + 3) * s1); }
    }
    this.mts.forEach((mt, i) => { mt.tilePositionX = (this.px * 14 + this.dist * 0.3) * [0.1, 0.2, 0.35][i]; });
    for (let i = this.trees.length - 1; i >= 0; i--) {                         // roadside scenery
      const t = this.trees[i], z = t.wz - this.dist;
      if (z < -F * 0.5) { this.scenery.put(t.spr); this.trees.splice(i, 1); continue; }
      const s = sOf(z); t.spr.setPosition(W / 2 + t.side * (t.lamp ? 2.1 : 2.9) * LW * s, yOf(s)).setScale(s * (t.lamp ? 1.5 : 1.25)).setDepth(400 - z);
    }
    for (const o of this.objs) {
      const z = o.wz - this.dist, s = sOf(z), K = KINDS[o.k];
      const bob = K.pick ? Math.sin(this.time.now / 170 + o.wz) * 5 * s : 0;
      o.spr.setPosition(laneX(o.lane, s), yOf(s) - (K.pick ? 26 * s : 0) + bob).setScale(K.sc * s).setDepth(500 - z - 0.5);
      o.spr.setAlpha(Math.min(1, (ZFAR - z) / 25));                           // objects fade in at the horizon instead of popping
    }
    const blink = this.inv > 0 && Math.floor(this.inv * 14) % 2 === 0;
    this.av.fx.dy = -this.jy; this.av.fx.rot = this.over ? 0.5 : (this.lane - this.px) * 0.18;
    this.placeAvatar(this.av, W / 2 + this.px * LW, GY, 'up', !this.over); this.av.root.setAlpha(blink ? 0.45 : 1).setDepth(500);
    this.av.shadow.setScale(1.5 * (1 - Math.min(0.5, this.jy / 220))).setAlpha(0.25);
  }

  idle(dt) { if (this.state === 'finishing') { this.av.fx.rot = 0.5; this.placeAvatar(this.av, W / 2 + this.px * LW, GY, 'up', false); } }

  hudText() {
    return { left: `🏃 ${Math.floor(this.dist).toLocaleString()} m`, mid: `🪙 ${this.coins}  ${'❤️'.repeat(Math.max(0, this.lives))}${'🖤'.repeat(Math.max(0, RUNNER.lives - this.lives))}`, right: `⚡ ${Math.round(this.v * 3.6)} km/h` };
  }
}
