// Player-controlled strings (display names, chat) must never be injected as HTML.
const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);
export const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (iso) => new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short' });
