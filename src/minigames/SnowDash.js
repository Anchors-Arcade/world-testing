import { MinigameScene, W, H, clock } from './MinigameScene.js';
import { GAMES } from './registry.js';
import { DASH, snowDashScore } from './scoring.js';
import { Pool } from './Pool.js';
import { sfx } from './sfx.js';

const TRACK_L = 220, TRACK_R = 740, PY = 150, STEER = 400;       // track edges, penguin's fixed screen row, sideways speed
const LANES = 6, LANE_W = (TRACK_R - TRACK_L) / LANES;
const KINDS = {   // hit box (w,h) in world pixels, art scale, crash = hurts
  tree:    { tex: 'pine',       w: 30, h: 26, scale: 0.62, oy: 0.95, crash: true },
  rock:    { tex: 'mg_rock',    w: 46, h: 28, scale: 1,    oy: 0.7,  crash: true },
  snowman: { tex: 'mg_snowman', w: 34, h: 40, scale: 1,    oy: 0.9,  crash: true },
  ice:     { tex: 'mg_ice',     w: 86, h: 36, scale: 1,    oy: 0.5 },
  boost:   { tex: 'mg_boost',   w: 50, h: 50, scale: 0.9,  oy: 0.5 },
};

// A fixed, hand-balanced course (same every run, so leaderboard times are fair). Rows get denser towards the finish and
// always leave a safe lane within reach of the previous one.
function makeCourse() {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out = []; let y = 700, safe = 2;
  while (y < DASH.length - 500) {
    const prog = y / DASH.length;
    safe = Math.max(0, Math.min(LANES - 1, safe + Math.round((rnd() - 0.5) * 4)));
    const p = 0.28 + 0.5 * prog;
    for (let lane = 0; lane < LANES; lane++) {
      const x = TRACK_L + LANE_W * (lane + 0.5) + (rnd() - 0.5) * 26;
      if (lane === safe) { if (rnd() < 0.1) out.push({ k: 'boost', x, y }); else if (rnd() < 0.1) out.push({ k: 'ice', x, y }); continue; }
      if (rnd() < p) { const r = rnd(); out.push({ k: r < 0.45 ? 'tree' : r < 0.78 ? 'rock' : 'snowman', x, y: y + (rnd() - 0.5) * 30 }); }
      else if (rnd() < 0.05) out.push({ k: 'ice', x, y });
    }
    y += 240 - 120 * prog;                                   // rows get closer together
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}
const COURSE = makeCourse();

export class SnowDash extends MinigameScene {
  constructor() { super({ ...GAMES.snow_dash, bg: 0xcfe6f4 }); }

  build() {
    this.add.rectangle(W / 2, H / 2, 2400, 1600, 0xcfe6f4).setDepth(-100);
    this.lane = this.add.tileSprite(W / 2, H / 2, 520, 1600, 'mg_lane').setDepth(-90);
    this.edgeL = this.add.tileSprite(TRACK_L - 120, H / 2, 240, 1600, 'mg_edge_l').setDepth(-80);     // snowbanks + pines hugging the track
    this.edgeR = this.add.tileSprite(TRACK_R + 120, H / 2, 240, 1600, 'mg_edge_r').setDepth(-80);
    this.finishLine = this.add.tileSprite(W / 2, 0, 520, 32, 'mg_checker').setVisible(false).setDepth(-50);
    this.sled = this.add.image(W / 2, PY + 14, 'mg_sled').setDepth(PY - 1);
    this.av = this.makeAvatar(W / 2, PY);
    this.spray = this.add.particles(0, 0, 'mg_dot', { lifespan: 420, speedY: { min: -150, max: -60 }, speedX: { min: -50, max: 50 }, scale: { start: 0.9, end: 0 }, alpha: { start: 0.9, end: 0 }, frequency: 45, emitting: false }).setDepth(PY - 2);
    this.ambient = this.add.particles(0, -10, 'mg_dot', { x: { min: -200, max: W + 200 }, lifespan: 6500, speedY: { min: 40, max: 90 }, speedX: { min: -20, max: 20 }, scale: { min: 0.3, max: 0.8 }, alpha: { min: 0.5, max: 0.9 }, frequency: 120 }).setDepth(800);
    // sprites are pooled: only obstacles near the screen exist as objects
    this.pool = new Pool(() => this.add.image(0, 0, 'mg_rock'), 36);
    this.active = [];
    this.resetRun();                                                      // lay out the start line so the menu has a backdrop
  }

  resetRun() {
    for (const a of this.active) this.pool.put(a.spr); this.active.length = 0;
    this.next = 0; this.dist = 0; this.speed = 0; this.px = W / 2; this.vx = 0; this.crashes = 0; this.invuln = 0; this.boost = 0; this.ice = 0;
    this.finished = false; this.slide = 0; this.tumble = 0;
    this.finishLine.setVisible(false); this.spray.stop(); this.syncVisuals(0);
  }
  onStart() { this.spray.start(); }

  // ---------- one frame ----------
  tick(dt) {
    const progress = this.dist / DASH.length;
    const cruise = 270 + 180 * Math.min(1, progress * 1.1);                 // the hill gets steeper
    const target = (this.boost > 0 ? cruise + 170 : cruise) * (this.invuln > 0.55 ? 0.55 : 1);
    this.speed += (target - this.speed) * Math.min(1, (target > this.speed ? 1.6 : 4) * dt);
    this.boost = Math.max(0, this.boost - dt); this.invuln = Math.max(0, this.invuln - dt); this.ice = Math.max(0, this.ice - dt);
    this.dist += this.speed * dt;

    // steering: keys, or hold & drag (the penguin slides toward your finger/mouse)
    const k = this.keys, p = this.input.activePointer;
    const axis = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let want = axis * STEER;
    if (!axis && p.isDown) want = Math.max(-STEER, Math.min(STEER, (p.worldX - this.px) * 7));
    this.vx += (want - this.vx) * Math.min(1, (this.ice > 0 ? 1.8 : 13) * dt);   // ice = floaty steering
    this.px = Math.max(TRACK_L + 22, Math.min(TRACK_R - 22, this.px + this.vx * dt));

    this.stream();
    this.collide();
    if (this.state !== 'playing') return;
    this.syncVisuals(dt);

    if (this.dist + PY >= DASH.length) return this.complete(true);                // the penguin itself crosses the line
    if (this.runMs >= DASH.timeLimitMs) return this.complete(false);
  }

  // spawn obstacles that are about to scroll in; recycle the ones that left the top
  stream() {
    const sy = this.dist;
    while (this.next < COURSE.length && COURSE[this.next].y - sy < H + 90) {
      const o = COURSE[this.next], K = KINDS[o.k], spr = this.pool.get();
      if (!spr) break;                                                    // pool exhausted: try again next frame
      this.next++;
      spr.setTexture(K.tex).setScale(K.scale).setOrigin(0.5, K.oy).setAlpha(1).setX(o.x);
      this.active.push({ o, K, spr, hit: false });
    }
    if (!this.finishLine.visible && DASH.length - sy < H + 60) this.finishLine.setVisible(true);
    for (let i = this.active.length - 1; i >= 0; i--) {
      const a = this.active[i], y = a.o.y - sy;
      if (y < -110) { this.pool.put(a.spr); this.active[i] = this.active[this.active.length - 1]; this.active.pop(); continue; }
      a.spr.setY(y).setDepth(y);
    }
  }

  collide() {
    const wy = this.dist + PY;
    for (const a of this.active) {
      const { o, K } = a;
      if (Math.abs(o.y - wy) > K.h / 2 + 10 || Math.abs(o.x - this.px) > K.w / 2 + 14) continue;
      if (K.crash) {
        if (this.invuln > 0) continue;
        this.crashes++; this.invuln = 1.1; this.speed = 90; this.vx = (this.px < o.x ? -1 : 1) * 160; this.tumble = 0.6;
        this.shake(140, 0.007); this.flash(255, 255, 255); sfx.play('crash');
        this.floatText(this.px, PY - 60, 'OUCH!', '#ff9a8a', 26);
      } else if (K.tex === 'mg_boost') {
        if (this.boost < 0.6) { sfx.play('boost'); this.floatText(this.px, PY - 60, 'BOOST!', '#ffc247', 26); }
        this.boost = 1.5;
      } else this.ice = 0.35;
    }
  }

  syncVisuals(dt) {
    this.lane.tilePositionY = this.dist; this.edgeL.tilePositionY = this.dist; this.edgeR.tilePositionY = this.dist;
    this.finishLine.setY(DASH.length - this.dist);
    const blink = this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0;
    this.sled.setPosition(this.px, PY + 14).setAlpha(blink ? 0.4 : 1).setRotation(this.vx / STEER * 0.18);
    this.av.fx.rot = this.vx / STEER * 0.22 + (this.tumble > 0 ? Math.sin(this.tumble * 40) * 0.5 : 0);
    this.tumble = Math.max(0, this.tumble - dt);
    this.placeAvatar(this.av, this.px, PY, 'down', this.speed > 30);
    this.av.root.setAlpha(blink ? 0.45 : 1).setDepth(PY);
    this.spray.setPosition(this.px, PY + 18);
  }

  complete(finished) {
    this.finished = finished; this.slide = 0.9;
    const timeMs = Math.round(this.runMs), progress = Math.min(1, (this.dist + PY) / DASH.length);
    const score = snowDashScore({ timeMs, crashes: this.crashes, finished, progress });
    this.spray.stop();
    this.finish({
      score, banner: finished ? 'FINISH!' : "TIME'S UP!", win: finished, title: finished ? '🏁 SNOW DASH COMPLETE!' : '⏱ TIME’S UP!',
      stats: { crashes: this.crashes, progress: Math.round(progress * 100), finished: finished ? 1 : 0 },
      lines: [finished ? `Time ${clock(timeMs)}` : `${Math.round(progress * 100)}% of the course`, `${this.crashes} crash${this.crashes === 1 ? '' : 'es'}`],
    });
  }

  idle(dt) {
    if (this.state === 'finishing' && this.finished && this.speed > 5) {            // coast across the line
      this.speed *= Math.max(0, 1 - 2.2 * dt); this.dist += this.speed * dt;
      for (const a of this.active) a.spr.setY(a.o.y - this.dist);
      this.finishLine.setY(DASH.length - this.dist); this.lane.tilePositionY = this.dist; this.edgeL.tilePositionY = this.dist; this.edgeR.tilePositionY = this.dist;
    }
  }

  hudText() {
    return { left: `⏱ ${clock(this.runMs)}`, mid: `🏁 ${Math.min(100, Math.floor((this.dist + PY) / DASH.length * 100))}%`, right: `💥 ${this.crashes}` };
  }
}
