// Client-side chat rules. These give instant feedback only: the SERVER (send_chat in supabase/phase6.sql) re-checks everything.
// Keep PRESETS keys in sync with preset_text() in the SQL; scripts/test-phase6.mjs verifies it.
export const MAX_LEN = 100;
export const MIN_GAP_MS = 700;            // local throttle (server allows 600 ms, 5 per 10 s, 20 per minute)
export const PRESETS = [
  ['hello', 'Hello!'], ['hey', 'Hey!'], ['come', 'Come here!'], ['play', "Let's play!"],
  ['nice', 'Nice!'], ['thanks', 'Thanks!'], ['help', 'Help!'], ['bye', 'Bye!'],
  ['sorry', 'Sorry!'], ['wow', 'Wow!'], ['gg', 'Good game!'], ['follow', 'Follow me!'],
];
export const PRESET_TEXT = Object.fromEntries(PRESETS);

// Same normalisation as chat_squash() in SQL: look-alike characters undone, letters only, repeats collapsed.
const LOOK = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's' };
export const squash = (t) => String(t).toLowerCase().replace(/[0134578@$]/g, (c) => LOOK[c] || c).replace(/[^a-z]/g, '').replace(/(.)\1+/g, '$1');
// Starter list (mirrors the SQL seed). Extend both together, or move this to a moderation service later.
export const WORDS = [['fuck', 'c'], ['shit', 'w'], ['bitch', 'c'], ['asshole', 'c'], ['bastard', 'w'], ['cunt', 'c'], ['dick', 'w'], ['piss', 'w'],
  ['slut', 'w'], ['whore', 'c'], ['wtf', 'w'], ['stfu', 'w'], ['kys', 'w'], ['idiot', 'w'], ['loser', 'w'], ['die', 'w'], ['kill', 'w'], ['nude', 'w'], ['sex', 'w']];

// Tidy what the player typed: strip control characters, collapse spaces, trim.
export const clean = (t) => String(t ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

// -> null when OK, otherwise a short, child-friendly reason (never says which word matched).
export function problem(raw) {
  const t = clean(raw);
  if (!t) return 'Type a message first';
  if (t.length > MAX_LEN) return `Messages can be up to ${MAX_LEN} characters`;
  if (/(https?:|www\.|[a-z0-9-]+\.(com|net|org|io|gg|tv|me|co|xyz|app)\b)/i.test(t)) return 'Links are not allowed in chat';
  if (t.includes('@') || /\d(\D{0,2}\d){6}/.test(t)) return 'Do not share contact details';
  const all = squash(t), words = t.toLowerCase().split(/[^a-z0-9@$]+/).filter(Boolean).map(squash);
  for (const [w, mode] of WORDS) {
    const s = squash(w);
    if (mode === 'c' ? all.includes(s) : words.includes(s)) return 'That message is not allowed here';
  }
  return null;
}

// Per-client send throttle (keeps honest clients well under the server limits).
export function makeThrottle(gap = MIN_GAP_MS) {
  let last = 0;
  return () => { const now = Date.now(); if (now - last < gap) return false; last = now; return true; };
}
