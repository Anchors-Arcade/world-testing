// Emotes are temporary realtime state: they travel as Broadcast packets {id, e} and are never written to the database.
// body: how the avatar moves (applied by Avatar.playEmote) - dy = hop, rot = tilt, sy = squash/stretch, all yoyo tweens.
// fx:   little emoji particles - 'rise' floats up, 'burst' flies outward, 'fall' drifts down (snow).
export const EMOTES = [
  { key: 'wave',      icon: '👋', label: 'Wave',      body: { rot: 0.3, ms: 170, repeat: 7 },            fx: null },
  { key: 'laugh',     icon: '😂', label: 'Laugh',     body: { dy: -9, ms: 110, repeat: 9 },              fx: null },
  { key: 'surprise',  icon: '😮', label: 'Surprise',  body: { dy: -26, sy: 1.12, ms: 190, repeat: 1 },   fx: null },
  { key: 'happy',     icon: '❤️', label: 'Happy',     body: { dy: -12, ms: 200, repeat: 3 },             fx: { chars: ['❤️', '💕'], n: 5, mode: 'rise' } },
  { key: 'snow',      icon: '❄️', label: 'Snow',      body: { rot: 0.07, ms: 70, repeat: 11 },           fx: { chars: ['❄️', '❅'], n: 9, mode: 'fall' } },
  { key: 'celebrate', icon: '🎉', label: 'Celebrate', body: { dy: -24, ms: 230, repeat: 3 },             fx: { chars: ['🎉', '🎊', '✨'], n: 10, mode: 'burst' } },
  { key: 'like',      icon: '👍', label: 'Like',      body: { dy: -14, sy: 0.92, ms: 170, repeat: 1 },   fx: null },
  { key: 'sleep',     icon: '😴', label: 'Sleep',     body: { rot: -0.32, sy: 0.9, ms: 600, repeat: 0 }, fx: { chars: ['💤'], n: 3, mode: 'rise', slow: true } },
];
export const EMOTE_BY_KEY = Object.fromEntries(EMOTES.map((e) => [e.key, e]));
export const EMOTE_MS = 2600;               // how long the icon stays above the avatar
export const EMOTE_GAP_MS = 1200;           // local cooldown between emotes
export const REMOTE_GAP_MS = 500;           // ignore a sender who emotes faster than this (anti-flood)
