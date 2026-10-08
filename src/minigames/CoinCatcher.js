import { MinigameScene, W, H, fmt } from './MinigameScene.js';
import { GAMES } from './registry.js';
import { CATCH, catchMultiplier } from './scoring.js';
import { Pool } from './Pool.js';
import { sfx } from './sfx.js';

const GROUND = 484, BASKET_DY = -86, HALF = 40;              // basket sits above the penguin's head; HALF = half catch width
const TYPES = {                                               // good items add (value x multiplier); hazards subtract and break the combo
  flake:  { tex: 'mg_flakec', good: true, value: CATCH.values.flake },
  coin:   { tex: 'mg_coin',   good: true, value: CATCH.values.coin },
  gem:    { tex: 'mg_gem',    good: true, value: CATCH.values.gem },
  bomb:   { tex: 'mg_bomb',   good: false, value: CATCH.penalty.bomb },
  icicle: { tex: 'mg_icicle', good: false, value: CATCH.penalty.icicle },
};

export class CoinCatcher extends MinigameScene {
  constructor() { super({ ...GAMES.coin_catcher, bg: 0x10213f }); }

  build() {
    this.add.image(W / 2, H / 2, 'mg_sky_night').setDisplaySize(2600, 1700).setDepth(-100);
    for (let i = 0; i < 40; i++) this.add.image(Math.random() * 1500 - 270, Math.random() * 300 - 100, 'mg_dot').setScale(0.2 + Math.random() * 0.3).setAlpha(0.4 + Math.random() * 0.6).setDepth(-99);
    this.add.rectangle(W / 2, GROUND + 700, 2600, 1500, 0xeaf5fc).setDepth(-60);                       // snowy ground, oversized
    for (const [x, y, s] of [[40, GROUND + 6, 0.75], [210, GROUND - 4, 0.55], [790, GROUND - 2, 0.6], [930, GROUND + 6, 0.8], [-110, GROUND, 0.7], [1070, GROUND, 0.7]]) this.add.image(x, y, 'pine').setOrigin(0.5, 0.97).setScale(s).setDepth(-70);
    this.aurora = this.add.rectangle(W / 2, 90, 2600, 120, 0x6fd08c, 0.07).setDepth(-98);
    this.av = this.makeAvatar(W / 2, GROUND);
    this.basket = this.add.image(W / 2, GROUND + BASKET_DY, 'mg_basket').setDepth(GROUND + 1);
    this.items = new Pool(() => this.add.image(0, 0, 'mg_coin').setDepth(GROUND - 2), 40);   // behind the basket rim, so catches look like they drop in
    this.sparks = this.add.particles(0, 0, 'mg_dot', { lifespan: 500, speed: { min: 60, max: 220 }, scale: { start: 1, end: 0 }, tint: [0xffc247, 0xffffff, 0x9fe0ff], emitting: false }).setDepth(600);
    this.resetRun();
  }

  resetRun() {
    this.items.clear();
    this.score = 0; this.streak = 0; this.maxStreak = 0; this.caught = 0; this.hazards = 0; this.timeLeft = CATCH.timeMs / 1000;
    this.spawnIn = 0.6; this.comboT = 0; this.stun = 0; this.px = W / 2; this.lastPtrX = -1; this.mode = 'keys'; this.lastMult = 1;
    this.syncPlayer(0);
  }

  tick(dt) {
    this.timeLeft = Math.max(0, CATCH.timeMs / 1000 - this.runMs / 1000);
    const t = 1 - this.timeLeft / (CATCH.timeMs / 1000);               // 0 -> 1 across the round: everything ramps up with it
    this.stun = Math.max(0, this.stun - dt);

    // movement: keys, or follow the mouse / finger
    const k = this.keys, p = this.input.activePointer, axis = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const slow = this.stun > 0 ? 0.3 : 1;
    if (axis) { this.mode = 'keys'; this.px += axis * 620 * slow * dt; }
    else {
      if (Math.abs(p.worldX - this.lastPtrX) > 1 || p.isDown) this.mode = 'pointer';
      if (this.mode === 'pointer') { const d = p.worldX - this.px, step = 900 * slow * dt; this.px += Math.abs(d) < step ? d : Math.sign(d) * step; }
    }
    this.lastPtrX = p.worldX;
    this.px = Math.max(40, Math.min(W - 40, this.px));
    this.syncPlayer(axis || (this.mode === 'pointer' && Math.abs(this.input.activePointer.worldX - this.px) > 4) ? 1 : 0);

    // spawning
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) { this.spawnIn = 0.62 - 0.38 * t + Math.random() * 0.16; this.spawn(t); }

    // falling + catching
    const by = GROUND + BASKET_DY;
    for (const it of this.items.items) {
      if (!it.active) continue;
      it.y += it.fall * dt; it.rotation += it.spin * dt;
      if (it.y > by - 14 && it.y < by + 22 && Math.abs(it.x - this.px) < HALF + 10) this.catch(it);
      else if (it.y > GROUND + 40) this.items.put(it);                  // fell on the ground
    }

    if (this.streak && (this.comboT -= dt) <= 0) { this.streak = 0; }   // combo fades if you stop catching
    if (this.timeLeft <= 0) this.finishRound();
  }

  spawn(t) {
    const it = this.items.get(); if (!it) return;
    const r = Math.random(), hz = 0.12 + 0.17 * t, early = this.runMs < 2500;      // no hazards in the first 2.5 s
    let kind;
    if (!early && r < hz) kind = Math.random() < 0.6 ? 'bomb' : 'icicle';
    else { const q = Math.random(); kind = q < 0.58 ? 'flake' : q < 0.9 ? 'coin' : 'gem'; }
    const T = TYPES[kind];
    it.kind = kind; it.setTexture(T.tex).setPosition(50 + Math.random() * (W - 100), -30).setRotation(0).setScale(1).setAlpha(1);
    it.fall = (200 + 220 * t) * (0.85 + Math.random() * 0.35) * (kind === 'icicle' ? 1.35 : 1);
    it.spin = kind === 'bomb' ? 2.2 : kind === 'icicle' ? 0 : (Math.random() - 0.5) * 3;
  }

  catch(it) {
    const T = TYPES[it.kind], x = it.x, y = it.y;
    this.items.put(it);
    if (T.good) {
      this.streak++; this.maxStreak = Math.max(this.maxStreak, this.streak); this.caught++; this.comboT = 2.6;
      const m = catchMultiplier(this.streak), gain = T.value * m;
      this.score += gain;
      this.floatText(x, y - 20, `+${gain}`, it.kind === 'gem' ? '#ff9ac9' : m > 1 ? '#ffc247' : '#ffffff', it.kind === 'gem' ? 30 : 24);
      this.sparks.explode(it.kind === 'gem' ? 14 : 6, x, y);
      sfx.play(it.kind === 'gem' ? 'gem' : 'coin');
      if (m > this.lastMult) { this.floatText(this.px, this.basket.y - 70, `COMBO x${m}!`, '#8ff0b3', 30); }
      this.lastMult = m;
      this.tweens.add({ targets: this.basket, scaleY: 1.18, scaleX: 0.94, duration: 70, yoyo: true });
    } else {
      this.hazards++; this.streak = 0; this.lastMult = 1; this.stun = 0.7;
      const loss = Math.min(this.score, T.value); this.score -= loss;
      this.floatText(x, y - 20, `-${T.value}`, '#ff8a7a', 30); this.shake(160, 0.009); this.flash(255, 80, 80); sfx.play('bad');
    }
  }

  finishRound() {
    this.items.clear();
    this.finish({
      score: this.score, banner: "TIME'S UP!", title: '🪙 COIN CATCHER — TIME’S UP!',
      stats: { caught: this.caught, hazards: this.hazards, maxStreak: this.maxStreak },
      lines: [`${this.caught} caught`, `Best streak ${this.maxStreak}`, `${this.hazards} hit`],
    });
  }

  syncPlayer(moving) {
    this.placeAvatar(this.av, this.px, GROUND, 'down', !!moving);
    this.basket.setPosition(this.px, GROUND + BASKET_DY + (this.stun > 0 ? Math.sin(this.runMs * 0.05) * 3 : 0));
    this.av.root.setAlpha(this.stun > 0 ? 0.6 : 1);
  }

  idle() { this.aurora.alpha = 0.06 + 0.03 * Math.sin(this.time.now / 900); }

  hudText() {
    const m = catchMultiplier(this.streak), s = Math.ceil(this.timeLeft);
    return { left: `⭐ ${fmt(this.score)}`, mid: `⏱ ${s}`, right: this.streak > 1 ? `🔥 x${m}  (${this.streak})` : '🔥 x1' };
  }
}
