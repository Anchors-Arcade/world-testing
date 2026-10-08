import { PRESETS, MAX_LEN, problem, clean, makeThrottle } from '../social/chatRules.js';
import { fetchRecent, sendChat } from '../database/chat.js';
import { esc, fmtTime } from './dom.js';
import { toast } from './hud.js';

const KEEP = 60;   // lines kept in the DOM

// Compact game chat: history of the CURRENT room, quick-chat buttons, a text box. Realtime lines arrive through the room's
// existing channel (RemotePlayers -> 'chat-message'); history is one small query per room change. No polling anywhere.
export function createChat(root, { game, profile, social, onUnread }) {
  const el = document.createElement('section');
  el.className = 'chat'; el.hidden = true; root.appendChild(el);
  const canChat = social.enabled;
  let room = null, lines = [], unread = 0, token = 0, quick = false;
  const throttle = makeThrottle();

  el.innerHTML = `
    <header><b>💬 Chat</b><small class="ch-room"></small><button class="x" data-a="min" aria-label="Minimize chat">–</button></header>
    <div class="ch-log" role="log" aria-live="polite"></div>
    <div class="ch-quick" hidden></div>
    <form class="ch-form" autocomplete="off">
      <button type="button" class="ch-q" data-a="quick" title="Quick chat" aria-label="Quick chat">⚡</button>
      <input maxlength="${MAX_LEN}" placeholder="${canChat ? 'Say something nice…' : 'Create an account to chat'}" ${canChat ? '' : 'disabled'} aria-label="Chat message">
      <button class="sbtn mini go" ${canChat ? '' : 'disabled'}>Send</button>
    </form>`;
  const $ = (s) => el.querySelector(s), log = $('.ch-log'), input = $('input'), quickBox = $('.ch-quick');
  quickBox.innerHTML = PRESETS.map(([k, t]) => `<button type="button" data-p="${k}">${esc(t)}</button>`).join('');

  const isHidden = (id) => social.isHidden(id);

  function lineEl(r) {
    const d = document.createElement('div');
    d.className = 'ln' + (r.sender_id === profile.id ? ' me' : '') + (r.kind === 'preset' ? ' pre' : '');
    const time = document.createElement('time'); time.textContent = fmtTime(r.created_at);
    const who = document.createElement(r.sender_id === profile.id ? 'span' : 'button');
    who.className = 'who'; who.textContent = r.sender_name;
    if (r.sender_id !== profile.id) { who.type = 'button'; who.title = 'View player'; who.onclick = () => game.events.emit('open-profile', r.sender_id); }
    const msg = document.createElement('span'); msg.className = 'tx'; msg.textContent = r.message;      // textContent: never HTML
    d.append(time, who, msg);
    return d;
  }
  function paint() {
    log.replaceChildren(...lines.filter((r) => !isHidden(r.sender_id)).map(lineEl));
    log.scrollTop = log.scrollHeight;
  }
  function add(r) {
    if (lines.some((x) => x.id === r.id)) return;                // history fetch and realtime can overlap
    lines.push(r); if (lines.length > KEEP) lines.shift();
    if (isHidden(r.sender_id)) return;
    const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
    log.appendChild(lineEl(r)); while (log.children.length > KEEP) log.firstChild.remove();
    if (stick) log.scrollTop = log.scrollHeight;
    if (el.hidden && r.sender_id !== profile.id) onUnread(++unread);
  }

  // new room: fetch its recent lines (token guards against a slow response from the room we already left)
  async function enterRoom(_id, name, channelId) {
    room = channelId; lines = []; log.replaceChildren(); $('.ch-room').textContent = name ? `· ${name}` : '';
    if (!canChat) return;
    const my = ++token;
    try { const rows = await fetchRecent(room); if (my === token) { lines = rows; paint(); } } catch { /* chat still works live */ }
    if (document.activeElement === input) game.events.emit('typing', true);      // the scene restarted while I was typing
  }

  async function send(payload) {
    if (!canChat || !room) return;
    if (!throttle()) return toast('Slow down a little!');
    try { await sendChat(room, payload); } catch (e) { toast(e.message); throw e; }
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.a === 'min') return close();
    if (b.dataset.a === 'quick') { quick = !quick; quickBox.hidden = !quick; return; }
    if (b.dataset.p) { send({ preset: b.dataset.p }).catch(() => {}); quick = false; quickBox.hidden = true; }
  });
  $('.ch-form').onsubmit = async (e) => {
    e.preventDefault();
    const text = clean(input.value), why = problem(text);
    if (why) return toast(why);
    input.value = '';
    try { await send({ text }); } catch { input.value = text; }       // keep the text so it can be fixed
  };
  input.addEventListener('focus', () => game.events.emit('typing', true));
  input.addEventListener('blur', () => game.events.emit('typing', false));
  input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { input.blur(); } });

  function open(focus = true) {
    el.hidden = false; unread = 0; onUnread(0); log.scrollTop = log.scrollHeight;
    if (focus && canChat && matchMedia('(pointer:fine)').matches) input.focus();
  }
  function close() { if (document.activeElement === input) input.blur(); el.hidden = true; }

  // Enter opens chat and focuses the box (like most games) unless you are already typing somewhere
  const onKey = (e) => {
    if (e.key !== 'Enter' || e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.body.classList.contains('shop-open')) return;
    if (document.getElementById('ui').classList.contains('editing') || document.getElementById('ui').classList.contains('in-minigame') || document.querySelector('.arc-overlay')) return;   // not while editing a room / playing / browsing the Arcade
    e.preventDefault(); open(true);
  };
  addEventListener('keydown', onKey);

  game.events.on('room-entered', enterRoom);
  game.events.on('chat-message', add);
  const off = social.on((ev) => { if (ev.type === 'changed') paint(); });      // blocking / muting removes their lines at once

  return {
    open, close, toggle: () => (el.hidden ? open() : close()), isOpen: () => !el.hidden,
    destroy() { removeEventListener('keydown', onKey); game.events.off('room-entered', enterRoom); game.events.off('chat-message', add); off(); el.remove(); },
  };
}
