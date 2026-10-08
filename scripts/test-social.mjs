// node scripts/test-social.mjs — exercises SocialState (friends/presence/privacy/join rules) with a fake Supabase client.
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(s, c, next) { if (s === '@supabase/supabase-js' || s.startsWith('https://cdn.jsdelivr.net')) return { url: 'data:text/javascript,export const createClient = () => globalThis.__sb;', shortCircuit: true }; return next(s, c); }
`));
import assert from 'node:assert/strict';

const calls = []; let overview;
globalThis.__sb = { rpc: async (fn, args) => { calls.push([fn, args]); return { data: fn === 'get_social_overview' ? overview : fn === 'update_my_settings' ? { ...overview.settings, ...args.p } : null, error: null }; } };
const { SocialState } = await import('../src/social/SocialState.js');

const F = (id, name) => ({ id, username: name, display_name: name, avatar_data: {}, since: '2026-01-01' });
// Phase 17: Network now distinguishes `enabled` (the room channel — guests included) from `account` (features
// that need a real account). The friends/presence layer is gated on `account`.
const mkNet = () => ({ enabled: true, account: true, where: null, setWhere(w) { this.where = w; }, joinSocial(cb) { this.cb = cb; } });
let n = 0; const t = async (name, fn) => { await fn(); n++; console.log('ok -', name); };

overview = { settings: { allow_friend_requests: true, allow_friend_joins: true, allow_messages: true, allow_room_visits: true },
  friends: [F('a', 'Anna'), F('b', 'Ben'), F('c', 'Cleo')], incoming: [{ id: 'r1', player: F('d', 'Dan') }], outgoing: [], blocked: [F('x', 'Mean')], muted: [F('m', 'Loud')] };
const me = { id: 'me', guest: false };
const net = mkNet(), s = new SocialState(me, net);
await s.start();

await t('loads once and builds lookup sets', () => {
  assert.equal(calls.filter(([f]) => f === 'get_social_overview').length, 1);
  assert(s.isFriend('a') && !s.isFriend('d') && s.isBlocked('x') && s.isMuted('m') && s.isHidden('x') && s.isHidden('m') && !s.isHidden('a'));
});
await t('only FRIENDS are tracked from the global presence list; strangers are ignored', () => {
  net.cb.onPresence({ a: [{ r: 'snowy_plaza' }], b: [{ r: 'home' }], z: [{ r: 'cafe' }], me: [{ r: 'cafe' }] });
  assert.deepEqual([...s.online.keys()].sort(), ['a', 'b']);
});
await t('status text + join rules', () => {
  assert.deepEqual([s.statusOf('a').text, s.statusOf('a').joinable, s.statusOf('a').room], ['In Snowy Plaza', true, 'snowy_plaza']);
  const b = s.statusOf('b'); assert.equal(b.text, 'In their room'); assert.equal(b.joinable, true); assert.equal(b.room, 'home'); assert.equal(b.ownerId, 'b');   // joins THEIR home, not mine
  assert.deepEqual([s.statusOf('c').online, s.statusOf('c').text, s.statusOf('c').joinable], [false, 'Offline', false]);
});
await t('private rooms and hidden locations are not joinable and reveal nothing', () => {
  net.cb.onPresence({ a: [{ r: 'private' }], b: [{ r: null }], c: [{ r: 'unknown_room' }] });
  assert.deepEqual([s.statusOf('a').text, s.statusOf('a').joinable], ['In a private room', false]);
  assert.deepEqual([s.statusOf('b').text, s.statusOf('b').joinable], ['Online', false]);
  assert.equal(s.statusOf('c').joinable, false);
});
await t('last presence meta wins (multi-tab) and friendsIn() counts per room', () => {
  net.cb.onPresence({ a: [{ r: 'cafe' }, { r: 'snowy_plaza' }], b: [{ r: 'snowy_plaza' }] });
  assert.equal(s.statusOf('a').room, 'snowy_plaza'); assert.equal(s.friendsIn('snowy_plaza'), 2); assert.equal(s.friendsIn('cafe'), 0);
});
await t('what I publish: room key, "home" for my own home, "private" for others\' homes (owner never revealed)', () => {
  s.setLocation('snowy_plaza', null); assert.deepEqual(net.where, { r: 'snowy_plaza' });
  s.setLocation('home', 'me'); assert.deepEqual(net.where, { r: 'home' });
  s.setLocation('home', 'someone-else'); assert.deepEqual(net.where, { r: 'private' });
  assert(!JSON.stringify(net.where).includes('someone-else'));
});
await t('turning off "friends can join me" hides my location immediately', async () => {
  s.setLocation('cafe', null);
  await s.setSetting({ allow_friend_joins: false });
  assert.deepEqual(net.where, { r: null });
  await s.setSetting({ allow_friend_joins: true });
  assert.deepEqual(net.where, { r: 'cafe' });
});
await t('realtime friend events trigger ONE debounced refresh, not a storm', async () => {
  calls.length = 0;
  for (let i = 0; i < 5; i++) net.cb.onChange('friend_requests', { new: { status: 'pending' } });
  await new Promise((r) => setTimeout(r, 600));
  assert.equal(calls.filter(([f]) => f === 'get_social_overview').length, 1);
});
await t('a newly added friend is shown online without waiting for the next presence sync', async () => {
  net.cb.onPresence({ a: [{ r: 'cafe' }], d: [{ r: 'cafe' }] });
  assert(!s.online.has('d'));
  overview = { ...overview, friends: [...overview.friends, F('d', 'Dan')], incoming: [] };
  await s.refresh();
  assert(s.online.has('d'));
});
await t('guests get an inert instance (no requests, nothing online, nothing blocked)', async () => {
  calls.length = 0;
  const g = new SocialState({ id: 'guest', guest: true }, { enabled: false });
  await g.start(); g.setLocation('snowy_plaza', null);
  assert.equal(calls.length, 0); assert.equal(g.isHidden('x'), false); assert.equal(g.statusOf('a').online, false);
});
s.destroy();


// Phase 17: a guest gets an inert social layer even though the world itself is open to them.
await t('guests join the world but not the friends system', async () => {
  const gNet = mkNet(); gNet.account = false;
  const g = new SocialState({ id: 'guest_abc', guest: true }, gNet);
  await g.start();
  assert.equal(g.enabled, false);
  assert.equal(gNet.cb, undefined, 'a guest must not subscribe to the social channel');
  assert.equal(g.friends.length, 0);
});

console.log(`\n${n} checks passed`);
