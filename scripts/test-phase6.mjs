// node scripts/test-phase6.mjs — Phase 6 checks that need no browser and no Supabase:
// client chat rules, emote catalogue, and static consistency/security checks of supabase/phase6.sql against the client code.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { problem, clean, squash, PRESETS, WORDS, MAX_LEN, makeThrottle } from '../src/social/chatRules.js';
import { EMOTES, EMOTE_BY_KEY } from '../src/social/emotes.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const sql = read('../supabase/phase6.sql');
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('chat: empty / whitespace / control-only messages are rejected', () => {
  for (const m of ['', '   ', '\n\t', '\u0000\u0007', null, undefined]) assert(problem(m), JSON.stringify(m));
});
t('chat: length limit', () => {
  assert.equal(problem('a'.repeat(MAX_LEN)), null);
  assert(problem('a'.repeat(MAX_LEN + 1)));
});
t('chat: normal game talk passes', () => {
  for (const m of ['Hello!', "Let's play!", 'Nice hat :)', 'meet me at the cafe', 'I have 3 cats', 'Classic assassin dickens', 'see you at 5', 'Good game, well played!']) assert.equal(problem(m), null, m);
});
t('chat: blocked words, look-alikes and stretched letters are caught', () => {
  for (const m of ['shit', 'SHIT', 'sh1t', 'sh!!!!t'.replace(/!/g, 'i'), 'shiiiit', 'you idiot', 'f u c k'.replace(/ /g, ''), 'fuuuuck', '$h1t', 'what a b1tch']) assert(problem(m), m);
});
t('chat: links, e-mail and phone numbers are rejected', () => {
  for (const m of ['go to http://x.y', 'www.site.org', 'play on roblox.com', 'mail me a@b', 'call 555 123 4567', '5-5-5-1-2-3-4', 'my number is 5551234']) assert(problem(m), m);
});
t('chat: clean() strips control characters and collapses spaces', () => {
  assert.equal(clean('  hi\n\n there\u0000  '), 'hi there');
});
t('chat: local throttle blocks bursts', () => {
  const ok = makeThrottle(10_000); assert.equal(ok(), true); assert.equal(ok(), false);
});
t('chat: presets are unique, short and clean, and match preset_text() in SQL', () => {
  const keys = new Set();
  for (const [k, text] of PRESETS) {
    assert(!keys.has(k)); keys.add(k);
    assert.equal(problem(text), null, text);
    assert(sql.includes(`when '${k}' then '${text.replace(/'/g, "''")}'`), 'SQL preset ' + k);
  }
  assert.equal((sql.match(/when '[a-z]+' then '/g) || []).length, PRESETS.length, 'SQL has extra presets');
});
t('chat: client word list matches the SQL seed (term + mode)', () => {
  const seed = [...sql.slice(sql.indexOf('insert into public.chat_filter_terms')).matchAll(/\('([a-z0-9]+)','(word|contains)'\)/g)].map((m) => `${m[1]}:${m[2]}`).sort();
  const mine = WORDS.map(([w, m]) => `${w}:${m === 'c' ? 'contains' : 'word'}`).sort();
  assert.deepEqual(mine, seed);
});
t('chat: squash() matches the SQL chat_squash mapping', () => {
  assert(sql.includes("translate(lower(t), '0134578@$', 'oieastbas')"));
  assert.equal(squash('Sh1T!!'), 'shit');
});
t('emotes: the eight required emotes exist, unique keys, every one has an icon + body motion', () => {
  const keys = EMOTES.map((e) => e.key);
  for (const k of ['wave', 'laugh', 'surprise', 'happy', 'snow', 'celebrate', 'like', 'sleep']) assert(keys.includes(k), k);
  assert.equal(new Set(keys).size, keys.length);
  for (const e of EMOTES) { assert(e.icon && e.label && e.body && e.body.ms > 0, e.key); assert.equal(EMOTE_BY_KEY[e.key], e); }
  assert(EMOTES.length <= 9, 'hotkeys 1-9');
});

// ---------------- SQL: static security review ----------------
const TABLES = ['player_settings', 'friend_requests', 'friendships', 'player_blocks', 'player_mutes', 'chat_messages', 'reports', 'chat_filter_terms'];
t('sql: every Phase 6 table has RLS enabled', () => {
  for (const tb of TABLES) assert(new RegExp(`alter table public\\.${tb}\\s+enable row level security`).test(sql), tb);
});
t('sql: clients are never granted insert/update/delete on Phase 6 tables, and reports/filter terms have no select either', () => {
  assert(!/grant\s+(insert|update|delete|all)[^;]*public\.(player_|friend|chat_|reports)/i.test(sql));
  const grants = [...sql.matchAll(/grant select on ([^;]+?) to authenticated;/g)].map((m) => m[1]).join(' ');
  assert(!grants.includes('reports') && !grants.includes('chat_filter_terms'));
  assert(/revoke all on public\.player_settings[^;]*public\.reports[^;]*from anon, authenticated;/s.test(sql));
});
t('sql: no policy exists for reports or the word list (so nothing is readable)', () => {
  assert(!/create policy[^;]*on public\.(reports|chat_filter_terms)/i.test(sql));
});
t('sql: every callable function is SECURITY DEFINER with a pinned search_path', () => {
  const fns = [...sql.matchAll(/create or replace function public\.(\w+)\(([^)]*)\)\s+returns[^$]*?(?=\$\$)/gs)];
  assert(fns.length >= 20);
  for (const m of fns) {
    const head = m[0];
    if (['chat_squash', 'preset_text'].includes(m[1])) continue;               // pure string helpers
    assert(/security definer/.test(head) && /set search_path = public/.test(head), m[1]);
  }
});
t('sql: every client-facing function is revoked from public/anon and granted to authenticated only', () => {
  const client = ['get_my_profile', 'can_view_room', 'can_enter_chat_room', 'chat_visible', 'send_chat', 'get_social_overview', 'update_my_settings', 'search_players',
    'get_player_profile', 'send_friend_request', 'respond_friend_request', 'cancel_friend_request', 'remove_friend', 'block_player', 'unblock_player', 'mute_player', 'unmute_player', 'report_player'];
  const rev = sql.match(/revoke all on function\s+([^;]+?)\s+from public, anon;/s)[1], gr = sql.match(/grant execute on function\s+([^;]+?)\s+to authenticated;/s)[1];
  for (const f of client) { assert(rev.includes(`public.${f}(`), 'revoke ' + f); assert(gr.includes(`public.${f}(`), 'grant ' + f); }
  const internal = sql.match(/revoke all on function public\.are_friends[^;]+;/s)[0];
  for (const f of ['are_friends', 'is_blocked_between', 'setting_of', '_pub', '_make_friends', 'chat_squash', 'chat_is_clean', 'preset_text', 'prune_social_data']) assert(internal.includes(`public.${f}(`), 'internal ' + f);
});
t('sql: identity always comes from auth.uid(): no client-callable function accepts a sender / reporter / user id argument', () => {
  const writers = ['send_chat', 'update_my_settings', 'send_friend_request', 'respond_friend_request', 'cancel_friend_request', 'remove_friend',
    'block_player', 'unblock_player', 'mute_player', 'unmute_player', 'report_player'];
  for (const f of writers) {
    const m = sql.match(new RegExp(`function public\\.${f}\\(([^)]*)\\)`)); assert(m, f);
    assert(!/sender|reporter|user_id|p_from|p_me/.test(m[1]), `${f}(${m[1]})`);
    assert(sql.match(new RegExp(`function public\\.${f}\\([\\s\\S]*?end \\$\\$;`))[0].includes('auth.uid()'), f + ' must use auth.uid()');
  }
});
t('sql: friend rules (self, duplicate, ordering, receiver-only answers) are enforced', () => {
  assert(sql.includes('constraint friend_requests_not_self check (sender_id <> receiver_id)'));
  assert(sql.includes('constraint friendships_ordered check (user_id < friend_id)'));
  assert(sql.includes('friend_requests_one_pending'));
  assert(sql.includes("r.receiver_id <> uid or r.status <> 'pending'"));
  assert(sql.includes("raise exception 'You cannot add yourself'"));
});
t('sql: chat rate limits, length and filter are applied server-side', () => {
  for (const s of ['between 1 and 100', 'chat_is_clean(msg)', "interval '600 milliseconds'", 'n10 >= 5 or n60 >= 20', "interval '20 seconds'", 'can_enter_chat_room(p_room)']) assert(sql.includes(s), s);
});
t('sql: chat rows are filtered by blocks, mutes, hidden flag and room access through RLS (so Realtime obeys them too)', () => {
  const body = sql.match(/function public\.chat_visible[\s\S]*?end \$\$;/)[0];
  for (const s of ['p_hidden', 'is_blocked_between', 'player_mutes', 'can_enter_chat_room']) assert(body.includes(s), s);
  assert(/create policy "read visible chat"[\s\S]*chat_visible\(room_id, sender_id, kind, hidden\)/.test(sql));
});
t('sql: Realtime publication covers exactly the tables the client subscribes to', () => {
  assert(sql.includes("array['chat_messages', 'friend_requests', 'friendships']"));
  const net = read('../src/multiplayer/Network.js');
  for (const tb of ['chat_messages', 'friend_requests', 'friendships']) assert(net.includes(`'${tb}'`), tb);
});
t('sql: other players cannot read coins/current_room from profiles any more', () => {
  assert(sql.includes('revoke select on public.profiles from anon, authenticated;'));
  assert(sql.includes('grant  select (id, username, display_name, avatar_data, created_at) on public.profiles to authenticated;'));
});
t('client: every RPC the client calls exists in the SQL', () => {
  const src = ['../src/database/social.js', '../src/database/chat.js', '../src/database/auth.js'].map(read).join('\n');
  const called = new Set([...src.matchAll(/(?:rpc\(|supabase\.rpc\()\s*'(\w+)'/g)].map((m) => m[1]));
  assert(called.size >= 15, 'found ' + called.size);
  for (const f of called) assert(new RegExp(`function public\\.${f}\\(`).test(sql), 'missing in SQL: ' + f);
});
t('client: no Phase 6 UI injects player text as HTML without esc()', () => {
  for (const f of ['chat', 'friends', 'settings', 'mapPanel']) {
    const src = read(`../src/ui/${f}.js`);
    for (const m of src.matchAll(/\$\{([^}]*\.(display_name|username|sender_name|message)\b[^}]*)\}/g)) assert(/esc\(|\.textContent|fmtDate|\.length/.test(m[1]) || m[0].includes('esc('), `${f}: ${m[0]}`);
  }
});

console.log(`\n${n} checks passed`);
