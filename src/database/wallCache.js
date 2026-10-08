// Phase 15 — the last known picture count, kept in memory only.
// The Town Hall has to decide how long it is the instant you walk in, before any request comes back, so it uses
// this remembered total; GalleryWall then fetches the real list and extends the hall if more pictures have been
// hung since. Nothing here is authoritative — the server owns the wall.
let total = 0, mine = 0, limit = 3;
export const wallTotal = () => total;
export const wallMine = () => mine;
export const wallLimit = () => limit;
export function setWallState(s = {}) {
  if (typeof s.total === 'number') total = s.total;
  if (typeof s.mine === 'number') mine = s.mine;
  if (typeof s.limit === 'number') limit = s.limit;
}
