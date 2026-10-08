import { Avatar } from '../entities/Avatar.js';
import { makeMinigameTextures } from './art.js';
import { startRun, submitRun, guestResult, fetchOverview, cachedOverview, bestOf } from './scoreSystem.js';
import { tiersFor, maxReward, nextTier } from './rewards.js';
import { clampScore } from './scoring.js';
import { invalidateLeaderboards } from './leaderboard.js';
import { Pool } from './Pool.js';
import { sfx } from './sfx.js';

// Design resolution. The camera zooms to fit any screen; art that must fill the whole window is drawn oversized.
export const W = 960, H = 540;
export const FONT = 'Trebuchet MS, Segoe UI, sans-serif';
export const fmt = (n) => Math.round(n).toLocaleString();
export const clock = (ms) => `${Math.floor(ms / 60000)}:${(Math.floor(ms / 1000) % 60).toString().padStart(2, '0')}.${Math.floor((ms % 1000) / 100)}`;

// Everything every minigame shares: start screen, countdown, pause, finish, saving the result, result screen, exit.
// A game only supplies its own world + rules by overriding:
//   build()         create backgrounds, pools, the player (once per launch)
//   resetRun()      put everything back to the starting state (called before every countdown)
//   onStart()       optional: the moment "GO!" appears
//   tick(dt, time)  one frame of gameplay (only runs while playing). Call this.finish({...}) when the run is over.
//   idle(dt, time)  optional: animation while not playing (menu, finishing slide)
//   hudText()       -> {left, mid, right} strings (only changed strings touch the Text objects)
// States: boot -> menu -> starting -> countdown -> playing <-> paused -> finishing -> submitting -> result -> (menu/starting)
export class MinigameScene extends Phaser.Scene {
  constructor(def) { super(def.scene); this.def = def; }

  init(data) {
    this.manager = data?.manager || null;
    this.state = 'boot'; this.sessionId = null; this.runMs = 0; this.layers = {}; this._hud = {};
  }

  create() {
    makeMinigameTextures(this);
    this.profile = this.registry.get('profile'); this.guest = !!this.profile.guest;
    this.reduce = !!this.registry.get('reduceMotion');
    this.cameras.main.setBackgroundColor(this.def.bg ?? 0x0e2238).fadeIn(200);
    this.fit(); this.scale.on('resize', this.fit, this);
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ENTER,P,ESC,M', false);   // false: do not capture globally (chat/search boxes keep working)
    this.onVis = () => { if (document.hidden && this.state === 'playing') this.pause(); };
    document.addEventListener('visibilitychange', this.onVis);
    this.events.once('shutdown', this.cleanup, this);

    this.build();
    this.floats = new Pool(() => this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#fff', stroke: '#16304a', strokeThickness: 5 }).setOrigin(0.5).setDepth(700), 14);
    this.confetti = this.add.particles(0, 0, 'mg_conf', {
      lifespan: 1600, speed: { min: 140, max: 460 }, angle: { min: -160, max: -20 }, gravityY: 520, scale: { start: 1, end: 0.3 }, rotate: { min: 0, max: 360 },
      tint: [0xffc247, 0xff6b4a, 0x5bb6e8, 0x6fd08c, 0xb48cff, 0xffffff], emitting: false,
    }).setDepth(950);
    this.buildHud();
    this.showStart();
    fetchOverview().then(() => this.refreshMenuStats()).catch(() => {});
  }

  // ---------- subclass hooks ----------
  build() {} resetRun() {} onStart() {} tick() {} idle() {} hudText() { return {}; }

  // ---------- helpers ----------
  // Fit the 960x540 design area inside ANY window: portrait phones, ultrawide monitors, split screens.
  // The zoom is capped so a huge display does not blow the art up past 2x, and the camera is re-centred on resize.
  fit() {
    const cam = this.cameras.main;
    const z = Math.min(this.scale.width / W, this.scale.height / H);
    cam.setZoom(Phaser.Math.Clamp(z, 0.3, 6));      // no upper cap below 6x: a cap leaves empty bars on big/wide monitors
    cam.centerOn(W / 2, H / 2);
  }
  shake(ms = 120, power = 0.006) { if (!this.reduce) this.cameras.main.shake(ms, power); }
  flash(r, g, b) { if (!this.reduce) this.cameras.main.flash(120, r, g, b); }

  makeAvatar(x, y) {
    const av = new Avatar(this, x, y, this.profile.avatar_data, '', { remote: true, direct: true });     // the player's own outfit, no physics needed
    av.label.setVisible(false);
    return av;
  }
  placeAvatar(av, x, y, dir = 'down', moving = false) {
    av.hitbox.setPosition(x, y); av.setRemoteTarget(x, y, dir, moving); av.update(this.time.now, this.reduce, 16);
  }

  text(x, y, str, size = 22, color = '#16304a', extra = {}) {
    return this.add.text(x, y, str, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, ...extra }).setOrigin(0.5);
  }

  panel(cx, cy, w, h, depth = 300) {
    const c = this.add.container(0, 0).setDepth(depth), g = this.add.graphics();
    g.fillStyle(0x000000, 0.45); g.fillRect(-2000, -2000, 5000, 5000);                       // dim everything behind
    g.fillStyle(0x7fb8d8); g.fillRoundedRect(cx - w / 2, cy - h / 2 + 8, w, h, 28);
    g.fillStyle(0xf4fbff); g.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 28);
    c.add(g);
    return c;
  }

  button(x, y, w, h, label, { color = 0xff6b4a, shadow = 0xc4472b, text = '#ffffff', size = 24, onClick } = {}) {
    const c = this.add.container(x, y), g = this.add.graphics();
    g.fillStyle(shadow); g.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, 16);
    g.fillStyle(color); g.fillRoundedRect(-w / 2, -h / 2, w, h, 16);
    c.add([g, this.text(0, 0, label, size, text)]);
    c.setSize(w, h + 5).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => c.setScale(1.05)).on('pointerout', () => { c.setScale(1); c.y = y; })
      .on('pointerdown', () => { c.y = y + 3; }).on('pointerup', () => { c.y = y; sfx.play('click'); onClick(); });
    return c;
  }

  floatText(x, y, str, color = '#ffffff', size = 24) {
    const t = this.floats.get(); if (!t) return;
    t.setText(str).setColor(color).setFontSize(size).setPosition(x, y).setAlpha(1).setScale(0.6);
    this.tweens.add({ targets: t, y: y - 46, scale: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, delay: 420, duration: 380, onComplete: () => this.floats.put(t) });
  }

  burst(x, y, n = 40) { if (!this.reduce) this.confetti.explode(n, x, y); }

  // ---------- HUD (only useful things; hidden on menus) ----------
  buildHud() {
    const st = (size, color) => ({ fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, backgroundColor: '#0e2238cc', padding: { x: 12, y: 6 } });
    this.hud = {
      left: this.add.text(16, 12, '', st(22, '#ffffff')).setDepth(900),
      mid: this.add.text(W / 2, 12, '', st(22, '#ffc247')).setOrigin(0.5, 0).setDepth(900),
      right: this.add.text(W - 74, 12, '', st(20, '#ffffff')).setOrigin(1, 0).setDepth(900),
    };
    this.pauseBtn = this.add.text(W - 16, 12, '⏸', st(22, '#ffffff')).setOrigin(1, 0).setDepth(900).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.pause());
    this.setHud(false);
  }
  setHud(on) { Object.values(this.hud).forEach((t) => t.setVisible(on)); this.pauseBtn.setVisible(on); this._hud = {}; }
  refreshHud() {
    const t = this.hudText();
    for (const k of ['left', 'mid', 'right']) if (t[k] !== undefined && t[k] !== this._hud[k]) { this.hud[k].setText(t[k]); this._hud[k] = t[k]; }
  }

  // ---------- start screen ----------
  menuStats() {
    const best = bestOf(this.def.id, this.guest), top = maxReward(cachedOverview(), this.def.id) || this.def.fallbackReward;
    return `${best == null ? 'No score yet. Set the first one!' : `Your best: ${fmt(best)}`}${this.guest ? '' : `   ·   Top reward: ⚓ ${top}`}`;
  }
  refreshMenuStats() { if (this.state === 'menu' && this.ui?.stats?.active) this.ui.stats.setText(this.menuStats()); }

  showStart(err) {
    this.state = 'menu'; this.setHud(false); this.clearUi();
    const p = this.panel(W / 2, 290, 640, 380);
    const d = this.def, ui = (this.ui = { root: p });
    ui.stats = this.text(W / 2, 372, this.menuStats(), 17, '#2f5875');
    p.add([
      this.text(W / 2, 140, d.emoji, 54), this.text(W / 2, 198, d.name.toUpperCase(), 40, '#16304a'),
      this.text(W / 2, 252, d.description, 17, '#2f5875', { align: 'center', wordWrap: { width: 560 } }),
      this.text(W / 2, 330, `🎮 ${d.controls}`, 15, '#44708f', { align: 'center', wordWrap: { width: 580 } }), ui.stats,
      this.button(W / 2 - 100, 432, 190, 54, '▶ PLAY', { color: 0x2f9e5b, shadow: 0x1f6e3f, size: 26, onClick: () => this.begin() }),
      this.button(W / 2 + 120, 432, 170, 54, this.def.world ? '◂ BACK' : 'ARCADE', { color: 0xffffff, shadow: 0x9cc9e2, text: '#16304a', size: 22, onClick: () => this.toArcade() }),
    ]);
    ui.err = this.text(W / 2, 478, err || (this.guest ? 'Guest mode: scores are not saved and no coins are earned.' : ''), 14, err ? '#c4472b' : '#44708f', { align: 'center', wordWrap: { width: 580 } });
    p.add(ui.err);
  }
  clearUi() { this.ui?.root?.destroy(); this.ui = {}; }

  // ---------- run lifecycle ----------
  async begin() {
    if (this.state !== 'menu' && this.state !== 'result') return;
    sfx.unlock(); this.clearUi(); this.state = 'starting';
    const msg = this.text(W / 2, H / 2, 'Getting ready…', 32, '#ffffff', { stroke: '#16304a', strokeThickness: 6 }).setDepth(500);
    try { this.sessionId = this.guest ? null : await startRun(this.def.id); }       // the server starts its own clock for this run here
    catch (e) { msg.destroy(); if (this.state === 'starting') this.showStart(e.message || 'Could not start the game.'); return; }
    msg.destroy();
    if (this.state === 'starting') this.countdown();
  }

  countdown() {
    this.state = 'countdown'; this.resetRun(); this.setHud(true); this.refreshHud();
    const label = this.text(W / 2, H / 2 - 20, '', 120, '#ffffff', { stroke: '#16304a', strokeThickness: 10 }).setDepth(500);
    let n = 3;
    const pop = (s, snd) => { label.setText(s).setScale(0.4).setAlpha(1); sfx.play(snd); this.tweens.add({ targets: label, scale: 1, duration: 260, ease: 'Back.Out' }); };
    const step = () => {
      if (this.state !== 'countdown') return label.destroy();
      if (n > 0) { pop(String(n--), 'tick'); this.time.delayedCall(750, step); return; }
      pop('GO!', 'go'); this.state = 'playing'; this.runMs = 0; this.onStart();
      this.tweens.add({ targets: label, alpha: 0, delay: 350, duration: 300, onComplete: () => label.destroy() });
    };
    step();
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    const p = (this.ui = { root: this.panel(W / 2, 270, 440, 290, 600) }).root;
    p.add([
      this.text(W / 2, 175, '⏸ PAUSED', 40), this.text(W / 2, 222, `Sound: ${sfx.muted ? 'off' : 'on'}  (press M)`, 15, '#44708f'),
      this.button(W / 2, 285, 280, 56, '▶ RESUME', { color: 0x2f9e5b, shadow: 0x1f6e3f, onClick: () => this.resume() }),
      this.button(W / 2, 360, 280, 50, this.def.world ? 'Leave the game' : 'Quit to Arcade', { color: 0xffffff, shadow: 0x9cc9e2, text: '#16304a', size: 20, onClick: () => this.toArcade() }),
    ]);
  }
  resume() { if (this.state !== 'paused') return; this.clearUi(); this.state = 'playing'; }

  // A game calls this when the run is over. `score` is clamped to the server's maximum; the server validates it again.
  finish({ score, banner = 'FINISH!', title = this.def.name.toUpperCase() + ' COMPLETE!', stats = {}, lines = [], win = true }) {
    if (this.state !== 'playing') return;
    this.state = 'finishing'; this.final = { score: clampScore(this.def.id, score), durationMs: Math.round(this.runMs), stats, lines, title, win };
    sfx.play(win ? 'win' : 'tick');
    const b = this.text(W / 2, H / 2 - 30, banner, 84, '#ffffff', { stroke: '#16304a', strokeThickness: 10 }).setDepth(500).setScale(0.3);
    this.tweens.add({ targets: b, scale: 1, duration: 320, ease: 'Back.Out' });
    this.time.delayedCall(1200, () => { b.destroy(); this.submit(); });
  }

  async submit() {
    if (!this.final || !['finishing', 'submitting', 'result'].includes(this.state)) return;     // 'result' = the "try again" button after a network error
    this.state = 'submitting'; this.setHud(false); this.clearUi();
    const wait = this.text(W / 2, H / 2, 'Saving your score…', 32, '#ffffff', { stroke: '#16304a', strokeThickness: 6 }).setDepth(500);
    const f = this.final; let out;
    try {
      out = this.guest ? guestResult(this.def.id, f.score)
        : await submitRun({ sessionId: this.sessionId, gameId: this.def.id, score: f.score, durationMs: f.durationMs, stats: f.stats });
    } catch (e) { out = { ok: false, retry: true, error: e.message || 'Could not reach the server.' }; }
    wait.destroy();
    if (this.state !== 'submitting') return;                 // the player left while we were saving
    if (out.ok) {
      invalidateLeaderboards();
      if (!out.guest && out.balance != null) this.game.events.emit('coins-changed', out.balance);   // wallet/HUD refresh right away
    }
    this.showResult(out);
  }

  // ---------- result screen ----------
  showResult(out) {
    this.state = 'result'; this.clearUi();
    const f = this.final, p = (this.ui = { root: this.panel(W / 2, 275, 620, 450, 600) }).root, X = W / 2;
    const gold = '#c97f12';
    if (!out.ok) {
      p.add([
        this.text(X, 130, out.retry ? 'COULD NOT SAVE' : 'SCORE NOT SAVED', 34, '#c4472b'),
        this.text(X, 190, `Score: ${fmt(f.score)}`, 34),
        this.text(X, 250, out.error || 'Something went wrong.', 17, '#2f5875', { align: 'center', wordWrap: { width: 520 } }),
        this.text(X, 300, out.retry ? 'Your connection may have dropped. Try saving again.' : 'No coins were awarded for this run.', 15, '#44708f'),
      ]);
      if (out.retry) p.add(this.button(X, 370, 280, 54, '↻ TRY AGAIN', { color: 0x2f9e5b, shadow: 0x1f6e3f, onClick: () => this.submit() }));
      p.add([this.button(X - 125, 435, 220, 48, '▶ PLAY AGAIN', { color: 0xffc247, shadow: 0xc97f12, text: '#4a3200', size: 20, onClick: () => this.begin() }),
        this.button(X + 125, 435, 220, 48, this.def.world ? '◂ BACK' : 'ARCADE', { color: 0xffffff, shadow: 0x9cc9e2, text: '#16304a', size: 20, onClick: () => this.toArcade() })]);
      return;
    }
    p.add(this.text(X, 112, f.title, 30, '#16304a'));
    if (out.new_best || out.first_play) {
      const b = this.text(X, 158, out.first_play ? '⭐ FIRST SCORE SET!' : '🎉 NEW PERSONAL BEST!', 24, '#4a3200', { backgroundColor: '#ffc247', padding: { x: 16, y: 6 } });
      p.add(b); if (!this.reduce) this.tweens.add({ targets: b, scale: 1.08, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.burst(X, 200, 70); sfx.play('win');
    }
    const num = this.text(X, 232, '0', 70, '#16304a'); p.add([this.text(X, 190, 'SCORE', 15, '#44708f'), num]);
    this.tweens.addCounter({ from: 0, to: f.score, duration: this.reduce ? 1 : 900, ease: 'Cubic.Out', onUpdate: (t) => num.setText(fmt(t.getValue())) });
    const best = out.best ?? f.score;
    p.add(this.text(X, 290, `Best: ${fmt(best)}${out.new_best || out.first_play ? ' 🎉' : ''}${out.previous_best != null ? `    ·    Previous: ${fmt(out.previous_best)}` : ''}`, 19, '#2f5875'));
    if (out.guest) p.add(this.text(X, 332, 'Create an account to save scores and earn coins!', 18, '#c4472b'));
    else if (out.coins > 0) p.add(this.text(X, 332, `+${fmt(out.coins)} ⚓ Anchor Coins`, 32, gold));
    else {
      const need = nextTier(tiersFor(cachedOverview(), this.def.id), f.score);
      const why = out.capped ? 'Daily coin limit reached. Come back tomorrow!' : f.durationMs < (this.def.rewardMinMs || 0) ? 'Play a full round to earn coins.' : need ? `Score ${fmt(need.min)}+ to earn ${need.coins} ⚓` : 'No coins this time.';
      p.add(this.text(X, 332, why, 18, '#44708f'));
    }
    if (out.coins > 0 && out.capped) p.add(this.text(X, 362, 'Daily coin limit reached', 14, '#44708f'));
    const bits = [...f.lines]; if (out.rank) bits.push(`Rank #${fmt(out.rank)}`);
    p.add(this.text(X, 386, bits.join('   ·   '), 16, '#2f5875', { align: 'center', wordWrap: { width: 560 } }));
    p.add([
      this.button(X - 190, 446, 190, 50, '▶ PLAY AGAIN', { color: 0x2f9e5b, shadow: 0x1f6e3f, size: 19, onClick: () => this.begin() }),
      this.button(X + 10, 446, 160, 50, '🏆 BOARD', { color: 0xffc247, shadow: 0xc97f12, text: '#4a3200', size: 19, onClick: () => this.toArcade('board') }),
      this.button(X + 180, 446, 150, 50, this.def.world ? '◂ BACK' : 'ARCADE', { color: 0xffffff, shadow: 0x9cc9e2, text: '#16304a', size: 19, onClick: () => this.toArcade() }),
    ]);
  }

  // ---------- leaving ----------
  toArcade(tab = 'games') {
    if (this.state === 'closed') return;
    if (this.manager) this.manager.exit({ tab, game: this.def.id }); else this.scene.stop();
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000, JD = Phaser.Input.Keyboard.JustDown, k = this.keys;
    if (JD(k.M)) sfx.toggle();
    switch (this.state) {
      case 'playing':
        if (JD(k.ESC) || JD(k.P)) { this.pause(); break; }
        this.runMs += dt * 1000; this.tick(dt, time); if (this.state === 'playing') this.refreshHud();
        break;
      case 'paused': if (JD(k.ESC) || JD(k.P)) this.resume(); break;
      case 'menu': case 'result':
        if (JD(k.ESC)) this.toArcade(); else if (JD(k.ENTER) || JD(k.SPACE)) this.begin();
        this.idle(dt, time); break;
      case 'countdown': if (JD(k.ESC)) this.toArcade(); this.idle(dt, time); break;
      case 'closed': break;
      default: this.idle(dt, time);
    }
  }

  cleanup() {
    this.state = 'closed';
    document.removeEventListener('visibilitychange', this.onVis);
    this.scale.off('resize', this.fit, this);
  }
}
