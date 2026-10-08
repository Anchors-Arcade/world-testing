import * as auth from '../database/auth.js';
import { isConfigured } from '../config/supabase.js';

// Phase 9 — the title screen.
// A single full-screen layer: a painted night sky with aurora, stars, parallax ridges, a sweeping lighthouse beam,
// drifting snow and a foreground snowbank, all of it CSS (no canvas, no assets, nothing to download). Over the top
// sits the menu: a big logo, three ways in, and a strip showing what is out there to find.
// The auth behaviour is exactly the same as Phases 1-8 — log in, create an account (with the resend-confirmation
// button), or look around as a guest.
const HIGHLIGHTS = [
  ['🗺️', '11 places'], ['🔎', '7 secrets'], ['⭐', '32 collectibles'], ['🏅', '10 badges'],
  ['🕹️', '3 arcade games'], ['👕', '67 cosmetics'],
];

export function mountAuth(root, onEnter, { notice = null, noticeOk = false } = {}) {
  let mode = 'menu';                                   // 'menu' | 'login' | 'register'
  const el = document.createElement('div');
  el.className = 'title';
  root.appendChild(el);

  // The scenery is built once and never re-rendered, so switching panels never restarts an animation.
  el.innerHTML = `
    <div class="t-sky" aria-hidden="true">
      <i class="t-stars"></i>
      <i class="t-aurora a1"></i><i class="t-aurora a2"></i><i class="t-aurora a3"></i>
      <i class="t-moon"></i>
      <i class="t-ridge r3"></i><i class="t-ridge r2"></i><i class="t-ridge r1"></i>
      <i class="t-beacon"><b></b></i>
      <i class="t-sea"></i>
      <i class="t-snow s1"></i><i class="t-snow s2"></i><i class="t-snow s3"></i>
      <i class="t-bank"></i>
    </div>
    <main class="t-ui"></main>
    <footer class="t-foot"><span>Anchors World</span><span class="t-ver">Phase 9</span></footer>`;

  const ui = el.querySelector('.t-ui');
  const msgFor = () => el.querySelector('#m');

  const panels = {
    menu: () => `
      <div class="t-brand">
        <h1 class="t-logo"><span class="t-anchor">⚓</span><b>ANCHORS</b><em>WORLD</em></h1>
        <p class="t-tag">A snowy town, a frozen lake, and a mountain full of secrets.</p>
      </div>
      ${isConfigured ? '' : `<div class="t-notice"><b>Supabase isn't set up yet.</b> Add your keys in <code>src/config/keys.js</code> — you can still look around as a guest.</div>`}
      <div class="t-menu">
        <button class="t-btn primary" data-go="login" ${isConfigured ? '' : 'disabled'}><span>⚓</span>Enter the world</button>
        <button class="t-btn" data-go="register" ${isConfigured ? '' : 'disabled'}><span>✨</span>Create an account</button>
        <button class="t-btn ghost" id="g"><span>👀</span><i>Look around as a guest</i><small>Nothing is saved</small></button>
      </div>
      <ul class="t-high">${HIGHLIGHTS.map(([i, t]) => `<li><b>${i}</b>${t}</li>`).join('')}</ul>
      <div class="msg" id="m"></div>`,

    login: () => `
      <div class="t-card">
        <button class="t-back" data-go="menu">◂ Back</button>
        <h2>Welcome back</h2>
        <form id="f" novalidate>
          <label for="e">Email</label><input id="e" type="email" autocomplete="email" required>
          <label for="p">Password</label><input id="p" type="password" minlength="6" autocomplete="current-password" required>
          <button class="t-btn primary wide">Enter the world</button>
        </form>
        <div class="msg" id="m"></div>
      </div>`,

    register: () => `
      <div class="t-card">
        <button class="t-back" data-go="menu">◂ Back</button>
        <h2>Make a penguin</h2>
        <form id="f" novalidate>
          <label for="u">Username</label><input id="u" maxlength="16" autocomplete="username" placeholder="SnowyFox_7" required>
          <label for="e">Email</label><input id="e" type="email" autocomplete="email" required>
          <label for="p">Password</label><input id="p" type="password" minlength="6" autocomplete="new-password" required>
          <button class="t-btn primary wide">Create my account</button>
        </form>
        <p class="t-fine">You start with free clothes, 500 Anchor Coins and a room of your own.</p>
        <div class="msg" id="m"></div>
      </div>`,
  };

  function msg(t, ok, resend = false) {
    const m = msgFor(); if (!m) return;
    m.textContent = t; m.className = 'msg' + (ok ? ' ok' : '');
    if (!resend) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'linkbtn'; b.textContent = 'Resend confirmation email';
    b.onclick = async () => {
      const email = el.querySelector('#e')?.value.trim();
      if (!email) return msg('Type your email above first.');
      b.disabled = true;
      try { await auth.resendConfirmation(email); msg('Sent! Check your inbox (and spam). The link brings you straight back here.', true); }
      catch (e) { msg(e.message || 'Could not send the email.'); }
    };
    m.appendChild(document.createElement('br'));
    m.appendChild(b);
  }

  function render(keepMsg) {
    ui.innerHTML = panels[mode]();
    ui.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => { mode = b.dataset.go; render(); }));

    const guest = ui.querySelector('#g');
    if (guest) guest.onclick = () => {
      el.remove();
      onEnter(auth.guestProfile('Guest' + Math.floor(Math.random() * 900 + 100)));
    };

    const form = ui.querySelector('#f');
    if (form) form.onsubmit = async (ev) => {
      ev.preventDefault();
      if (!isConfigured) return;
      const email = ui.querySelector('#e').value.trim(), pw = ui.querySelector('#p').value;
      try {
        msg('One moment…', true);
        const session = mode === 'login'
          ? await auth.login(email, pw)
          : await auth.register(email, pw, ui.querySelector('#u').value.trim());
        if (!session) return msg('Account created! Click the link we emailed you to confirm it — it brings you straight back here. Then log in.', true, true);
        const profile = await auth.fetchProfile(session.user.id);
        profile.email = session.user.email || null;
        el.remove();
        onEnter(profile);
      } catch (e) {
        const t = e.message || 'Something went wrong.';
        msg(t, false, /not confirmed|confirm/i.test(t));
      }
    };
    if (keepMsg) msg(keepMsg.text, keepMsg.ok);
    ui.querySelector('input')?.focus({ preventScroll: true });
  }

  render(notice ? { text: notice, ok: noticeOk } : null);
  return el;
}
