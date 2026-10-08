// Tiny synthesised sound effects (WebAudio, no files). Muted with the M key; the choice is remembered.
let ctx = null, muted = false;
try { muted = localStorage.getItem('aw_mute') === '1'; } catch { /* storage unavailable */ }
const PRESETS = {
  click: [[660, 0.05, 'triangle']], coin: [[880, 0.06, 'triangle'], [1320, 0.08, 'triangle', 0.05]], gem: [[988, 0.07, 'triangle'], [1319, 0.07, 'triangle', 0.06], [1760, 0.1, 'triangle', 0.12]],
  bad: [[160, 0.18, 'sawtooth']], throw: [[420, 0.06, 'sine']], hit: [[520, 0.07, 'square'], [780, 0.08, 'square', 0.05]], golden: [[880, 0.08, 'triangle'], [1175, 0.08, 'triangle', 0.07], [1568, 0.14, 'triangle', 0.14]],
  tick: [[520, 0.08, 'sine']], go: [[880, 0.25, 'triangle']], win: [[523, 0.12, 'triangle'], [659, 0.12, 'triangle', 0.1], [784, 0.12, 'triangle', 0.2], [1047, 0.25, 'triangle', 0.3]], crash: [[110, 0.22, 'sawtooth']], boost: [[500, 0.1, 'square'], [750, 0.14, 'square', 0.08]],
};
export const sfx = {
  unlock() { try { ctx ||= new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch { ctx = null; } },
  get muted() { return muted; },
  toggle() { muted = !muted; try { localStorage.setItem('aw_mute', muted ? '1' : '0'); } catch { /* ignore */ } return muted; },
  play(name) {
    if (muted || !ctx) return;
    const t0 = ctx.currentTime;
    for (const [f, d, type, at = 0] of PRESETS[name] || []) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + d);
      o.connect(g).connect(ctx.destination); o.start(t0 + at); o.stop(t0 + at + d + 0.02);
    }
  },
};
