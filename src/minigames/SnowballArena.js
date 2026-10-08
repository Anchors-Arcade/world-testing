import { MinigameScene, W, H, fmt } from './MinigameScene.js';
import { GAMES } from './registry.js';
import { ARENA, arenaMultiplier } from './scoring.js';
import { Pool } from './Pool.js';
import { sfx } from './sfx.js';

const PY = 478, ROWS = [138, 222, 306], BALL_SPEED = 820, COOLDOWN = 0.22, MAX_BALLS = 14;
const KINDS = {
  snowman:  { tex: 'mg_snowman', r: 25, value: ARENA.values.snowman, vx: [70, 120],  life: 99, oy: 0.9 },
  bullseye: { tex: 'mg_bull',    r: 20, value: ARENA.values.bullseye, vx: [130, 200], life: 3.4, oy: 0.5 },
  golden:   { tex: 'mg_golden',  r: 24, value: ARENA.values.golden, vx: [220, 300],  life: 99, oy: 0.9 },
  friend:   { tex: 'mg_friend',  r: 21, value: -ARENA.friendPenalty, vx: [90, 140],  life: 99, oy: 0.8 },
};

export class SnowballArena extends MinigameScene {
  constructor() { super({ ...GAMES.snowball_arena, bg: 0x7fc8ee }); }

  build() {
    this.add.image(W / 2, H / 2, 'mg_sky_day').setDisplaySize(2600, 1700).setDepth(-100);
    this.add.rectangle(W / 2, 372 + 700, 2600, 1400, 0xeaf5fc).setDepth(-90);                          // snowy yard
    for (const x of [-150, -20, 90, 880, 990, 1120]) this.add.image(x, 360, 'pine').setOrigin(0.5, 0.97).setScale(0.7 + (Math.abs(x) % 3) * 0.1).setDepth(-80);
    const fence = this.add.graphics().setDepth(-70);                                                     // low fence behind the lanes
    fence.fillStyle(0xb9814f); fence.fillRect(-600, 352, 2200, 8); fence.fillRect(-600, 370, 2200, 8);
    for (let x = -600; x < 1600; x += 44) fence.fillRect(x, 340, 9, 48);
    for (const y of ROWS) { this.add.rectangle(W / 2, y + 8, 2600, 4, 0xcfe6f4, 0.9).setDepth(-60); }  // faint lane lines
    this.av = this.makeAvatar(W / 2, PY);
    this.cross = this.add.image(W / 2, 200, 'mg_cross').setDepth(800).setVisible(false);
    this.targets = new Pool(() => this.add.image(0, 0, 'mg_snowman'), 14);
    this.balls = new Pool(() => this.add.image(0, 0, 'mg_ball').setDepth(400), MAX_BALLS);
    this.puff = this.add.particles(0, 0, 'mg_dot', { lifespan: 480, speed: { min: 70, max: 260 }, scale: { start: 1.1, end: 0 }, emitting: false }).setDepth(650);
    this.input.on('pointerdown', (p) => { if (this.state === 'playing') this.throwAt(p.worldX, p.worldY); });   // click/tap = throw
    this.resetRun();
  }

  resetRun() {
    this.targets.clear(); this.balls.clear();
    this.score = 0; this.streak = 0; this.maxStreak = 0; this.thrown = 0; this.hits = 0; this.timeLeft = ARENA.timeMs / 1000;
    this.spawnIn = 0.5; this.cool = 0; this.px = W / 2; this.aimX = W / 2; this.aimY = 220; this.recoil = 0; this.dir = 'up';
    this.cross.setVisible(false); this.syncPlayer(0);
  }
  onStart() { this.cross.setVisible(true); }

  tick(dt) {
    this.timeLeft = Math.max(0, ARENA.timeMs / 1000 - this.runMs / 1000);
    const t = 1 - this.timeLeft / (ARENA.timeMs / 1000);
    const p = this.input.activePointer, k = this.keys;
    this.aimX = p.worldX; this.aimY = p.worldY; this.cross.setPosition(this.aimX, this.aimY).setRotation(this.runMs * 0.002);

    // the penguin slides under your pointer; A/D also work. Holding the button / SPACE keeps throwing.
    const axis = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    if (axis) this.px += axis * 520 * dt; else this.px += (this.aimX - this.px) * Math.min(1, 12 * dt);
    this.px = Math.max(40, Math.min(W - 40, this.px));
    this.cool = Math.max(0, this.cool - dt); this.recoil = Math.max(0, this.recoil - dt * 6);
    if ((p.isDown || k.SPACE.isDown) && this.cool <= 0) this.throwAt(k.SPACE.isDown && !p.isDown ? this.aimX : p.worldX, p.isDown ? p.worldY : this.aimY);
    this.syncPlayer(axis || Math.abs(this.aimX - this.px) > 6 ? 1 : 0);

    // targets: spawn faster over time, move sideways, expire
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) { this.spawnIn = 0.95 - 0.5 * t + Math.random() * 0.25; this.spawn(t); }
    for (const tg of this.targets.items) {
      if (!tg.active || tg.dying) continue;
      tg.x += tg.vx * dt; tg.y = tg.baseY + Math.sin((tg.x + tg.phase) * 0.012) * 4; tg.age += dt;
      if ((tg.vx > 0 && tg.x > W + 70) || (tg.vx < 0 && tg.x < -70) || tg.age > tg.K.life) this.targets.put(tg);
    }

    // snowballs: fly, hit-test against every live target (circle vs circle), count a miss when they leave the screen
    for (const b of this.balls.items) {
      if (!b.active) continue;
      b.x += b.vx * dt; b.y += b.vy * dt; b.rotation += 9 * dt;
      const tg = this.targetAt(b.x, b.y);
      if (tg) { this.balls.put(b); this.hit(tg, b.x, b.y); continue; }
      if (b.x < -30 || b.x > W + 30 || b.y < -30 || b.y > H + 30) { this.balls.put(b); this.miss(); }
    }

    if (this.timeLeft <= 0) this.finishRound();
  }

  spawn(t) {
    const tg = this.targets.get(); if (!tg) return;
    const q = Math.random(); let kind;
    if (q < 0.15) kind = 'friend'; else if (q < 0.15 + 0.05 + 0.05 * t) kind = 'golden'; else if (q < 0.3 + 0.18 + 0.12 * t) kind = 'bullseye'; else kind = 'snowman';
    const K = KINDS[kind], dirRight = Math.random() < 0.5, row = ROWS[(Math.random() * ROWS.length) | 0];
    const v = (K.vx[0] + Math.random() * (K.vx[1] - K.vx[0])) * (1 + 0.5 * t);
    tg.K = K; tg.kind = kind; tg.setTexture(K.tex).setOrigin(0.5, K.oy).setAlpha(1).setScale(1 - 0.18 * t);
    tg.vx = dirRight ? v : -v; tg.baseY = row; tg.phase = Math.random() * 300; tg.age = 0; tg.dying = false;
    tg.setPosition(dirRight ? -50 : W + 50, row).setDepth(row);
  }

  // first live target whose body circle overlaps this point (the sprite's centre is offset from its origin)
  targetAt(x, y) {
    for (const tg of this.targets.items) {
      if (!tg.active || tg.dying) continue;
      const cy = tg.y - (tg.K.oy - 0.5) * tg.displayHeight;
      if (Math.hypot(tg.x - x, cy - y) < tg.K.r * tg.scale + 8) return tg;
    }
    return null;
  }

  throwAt(tx, ty) {
    if (this.cool > 0) return;
    const b = this.balls.get(); if (!b) return;
    const sx = this.px + 8, sy = PY - 44;
    let ang = Math.atan2(ty - sy, tx - sx);
    if (ang > -0.12 && ang <= Math.PI / 2) ang = -0.12; else if (ang > Math.PI / 2 || ang < -Math.PI + 0.12) ang = -Math.PI + 0.12;     // always throws upward-ish, never into the ground
    b.setPosition(sx, sy).setScale(1); b.vx = Math.cos(ang) * BALL_SPEED; b.vy = Math.sin(ang) * BALL_SPEED;
    this.cool = COOLDOWN; this.thrown++; this.recoil = 1; sfx.play('throw');
    this.dir = Math.abs(Math.cos(ang)) > 0.8 ? (Math.cos(ang) < 0 ? 'left' : 'right') : 'up';
  }

  hit(tg, x, y) {
    const K = tg.K;
    if (K.value < 0) {                                                                // a friendly penguin: -points, streak reset
      this.streak = 0; this.score = Math.max(0, this.score + K.value);
      this.floatText(tg.x, tg.y - 60, `${K.value}`, '#ff8a7a', 30); this.shake(130, 0.008); this.flash(255, 90, 90); sfx.play('bad');
    } else {
      this.streak++; this.hits++; this.maxStreak = Math.max(this.maxStreak, this.streak);
      const m = arenaMultiplier(this.streak), gain = K.value * m; this.score += gain;
      this.floatText(tg.x, tg.y - 60, `+${gain}`, tg.kind === 'golden' ? '#ffd45e' : m > 1 ? '#ffc247' : '#ffffff', tg.kind === 'golden' ? 32 : 26);
      sfx.play(tg.kind === 'golden' ? 'golden' : 'hit');
    }
    this.puff.explode(10, x, y);
    tg.dying = true;
    this.tweens.add({ targets: tg, scale: tg.scale * 1.35, alpha: 0, duration: 170, onComplete: () => this.targets.put(tg) });
  }

  miss() { if (this.streak) this.floatText(this.px, PY - 110, 'miss', '#cfe4f2', 18); this.streak = 0; }

  finishRound() {
    this.targets.clear(); this.balls.clear(); this.cross.setVisible(false);
    const acc = this.thrown ? Math.round((this.hits / this.thrown) * 100) : 0;
    this.finish({
      score: this.score, banner: "TIME'S UP!", title: '☃️ SNOWBALL ARENA — TIME’S UP!',
      stats: { thrown: this.thrown, hits: this.hits, maxStreak: this.maxStreak },
      lines: [`${this.hits} hits`, `Accuracy ${acc}%`, `Best streak ${this.maxStreak}`],
    });
  }

  syncPlayer(moving) {
    this.av.fx.dy = -6 * this.recoil;
    this.placeAvatar(this.av, this.px, PY, this.dir, !!moving);
  }

  idle() { this.cross.setVisible(false); }

  hudText() {
    const m = arenaMultiplier(this.streak), s = Math.ceil(this.timeLeft);
    return { left: `⭐ ${fmt(this.score)}`, mid: `⏱ ${s}`, right: this.streak > 1 ? `🔥 x${m}  (${this.streak})` : '🔥 x1' };
  }
}
