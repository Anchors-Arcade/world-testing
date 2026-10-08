import { supabase } from '../config/supabase.js';
import { DEFAULT_AVATAR, AVATAR_COLORS } from '../config/game.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Where the e-mail confirmation link sends the player back to: the page the game is served from RIGHT NOW
// (e.g. http://localhost:5173/ while developing, https://you.github.io/repo/ when deployed).
// Without this Supabase falls back to its dashboard "Site URL", which defaults to http://localhost:3000 -> "site can't be reached".
// This URL must ALSO be listed under Supabase -> Authentication -> URL Configuration -> Redirect URLs (see README).
export const redirectUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');

// Returns a session, or null when the project requires e-mail confirmation first (the player must click the link in the e-mail).
export async function register(email, password, username) {
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw new Error('Username: 3–16 letters, numbers or _');
  if (!email || !/.+@.+\..+/.test(email.trim())) throw new Error('That does not look like an e-mail address.');
  if (!password || password.length < 6) throw new Error('Use a password of at least 6 characters.');
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(), password, options: { data: { username }, emailRedirectTo: redirectUrl() },
  });
  if (error) {
    const m = error.message || '';
    if (/already registered|already exists/i.test(m)) throw new Error('That e-mail already has an account — log in instead.');
    if (/duplicate key|username/i.test(m)) throw new Error('That username is taken, try another.');
    throw error;
  }
  return data.session || null;
}

export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: redirectUrl() } });
  if (error) throw error;
}

// After clicking the e-mail link the browser lands back here with the result in the URL (#access_token=... or #error=...).
// supabase-js turns a good link into a session by itself; this just reads the outcome so we can say something friendly,
// and tidies the address bar.
export function readAuthRedirect() {
  const raw = (location.hash.startsWith('#') ? location.hash.slice(1) : '') || location.search.slice(1);
  const q = new URLSearchParams(raw);
  const out = { confirmed: q.get('type') === 'signup' && !!q.get('access_token'), error: null };
  if (q.get('error') || q.get('error_code')) {
    out.error = q.get('error_code') === 'otp_expired'
      ? 'That confirmation link has expired or was already used. Log in, or request a new e-mail below.'
      : (q.get('error_description') || 'The confirmation link did not work.').replace(/\+/g, ' ');
  }
  if (out.confirmed || out.error || q.get('code')) history.replaceState(null, '', location.pathname);
  return out;
}

export async function login(email, password) {
  if (!email || !password) throw new Error('Type your e-mail and password.');
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    // Supabase's wording is terse; say what actually went wrong.
    const m = error.message || '';
    if (/invalid login credentials/i.test(m)) throw new Error('Wrong e-mail or password.');
    if (/email not confirmed/i.test(m)) throw new Error('That e-mail is not confirmed yet — click the link we sent, then log in.');
    if (/rate|too many/i.test(m)) throw new Error('Too many attempts. Wait a minute and try again.');
    if (/failed to fetch|networkerror/i.test(m)) throw new Error('Could not reach the server. Check your connection.');
    throw error;
  }
  return data.session;
}

// Phase 17: sign out everywhere this browser knows about, and never throw — a failed network call must still
// leave the player logged out locally, or they get stuck on a screen they cannot escape.
export async function logout() {
  if (!supabase) return;
  try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* already gone */ }
  try { await supabase.auth.signOut(); } catch { /* offline: the local session is cleared either way */ }
}

export const getSession = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session || null;
};

// Phase 17: the session is restored from storage asynchronously, and a token can expire while the tab was asleep.
// This waits for supabase-js to settle and refreshes an expired token once, so a reload while logged in lands the
// player back in the world instead of on the login screen.
export async function restoreSession() {
  if (!supabase) return null;
  let session = await getSession();
  if (!session) {
    session = await new Promise((resolve) => {
      let done = false;
      const { data } = supabase.auth.onAuthStateChange((_e, s) => { if (!done && s) { done = true; data.subscription.unsubscribe(); resolve(s); } });
      setTimeout(() => { if (!done) { done = true; data.subscription.unsubscribe(); resolve(null); } }, 1200);
    });
  }
  const expires = (session?.expires_at || 0) * 1000;
  if (session && expires && expires - Date.now() < 60000) {
    const { data } = await supabase.auth.refreshSession();
    session = data?.session || session;
  }
  return session;
}

// Tells the app when the account signs out or the token is revoked in another tab.
export function onAuthChange(fn) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => fn(event, session));
  return () => data.subscription.unsubscribe();
}

// Phase 17: a banned account is refused by get_my_profile(), which raises 'BANNED:<until>:<reason>'.
// This turns that into something a player can read.
export function banMessage(err) {
  const m = /BANNED:([^:]*):?(.*)$/.exec(err?.message || '');
  if (!m) return null;
  const when = m[1] === 'permanent' ? 'permanently' : `until ${m[1]}`;
  return `This account is banned ${when}.${m[2] ? ` Reason: ${m[2]}` : ''}`;
}

// The profile row is created by a database trigger when the account is created; that can lag a moment behind the
// session, so this retries. Phase 17: a ban is reported as a ban, and a profile that never appears is repaired by
// asking the server to create one rather than dead-ending on "Profile not found".
export async function fetchProfile(userId) {
  let lastError = null;
  for (let i = 0; i < 6; i++) {
    const { data, error } = await supabase.rpc('get_my_profile');
    if (error) {
      const ban = banMessage(error);
      if (ban) throw Object.assign(new Error(ban), { banned: true });
      lastError = error;
      if (/does not exist|schema cache|PGRST202/i.test(error.message)) {
        throw new Error('The database is not set up yet. Run supabase/schema.sql (and the later phase files).');
      }
    } else if (data && data.id === userId) {
      return data;
    }
    await sleep(300 + i * 200);
  }
  throw new Error(lastError?.message || 'Could not load your profile. Check that every supabase/*.sql file has been run.');
}

export function savePlayerLocation(userId, room) {
  return supabase.from('profiles').update({ current_room: room }).eq('id', userId);
}

// Phase 17: guests get their OWN id so they can appear in multiplayer alongside everyone else. It is a
// 'guest_...' string, never a uuid, which is exactly why it can never be mistaken for an account: every table and
// every RPC keys off auth.uid(), so a guest id matches no row anywhere and unlocks nothing. Guest data lives in
// this object for the length of the tab and is never written to the database.
export function guestProfile(name) {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const n = (name || `Guest${Math.floor(Math.random() * 900 + 100)}`).trim().slice(0, 16) || 'Guest';
  const color = AVATAR_COLORS[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  return {
    id: `guest_${Date.now().toString(36)}${rand}`,
    username: n, display_name: n, coins: 0, current_room: 'snowy_plaza', role: 'user',
    avatar_data: { ...DEFAULT_AVATAR, color }, guest: true,
  };
}
