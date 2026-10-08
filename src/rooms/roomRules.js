// Room geometry and placement rules.
// The client uses these for instant feedback while dragging; save_room() in supabase/phase5.sql enforces the
// SAME rules on the server (bounds, ownership counts, overlaps), so a modified client can't save a bad layout.
// Furniture position (x, y) is the CENTRE of its footprint. Rotation is 0 / 90 / 180 / 270 clockwise.
export const ROOM = {
  w: 960, h: 680,
  wall: 150,          // back wall: furniture can't go above this
  floorBottom: 590,   // below this is the doorway strip, kept clear so you can always walk out
  grid: 8, maxPieces: 80, maxOwn: 10,
};
export const ROTATIONS = [0, 90, 180, 270];
export const DEFAULT_THEME = 'cozy_wood';

export const snap = (v, g = ROOM.grid) => Math.round(v / g) * g;
export const nextRotation = (r) => (r + 90) % 360;

export function sizeOf(item, rotation) {
  return rotation % 180 ? { w: item.h, h: item.w } : { w: item.w, h: item.h };
}
export function rectOf(p, item) {
  const { w, h } = sizeOf(item, p.rotation);
  return { l: p.x - w / 2, r: p.x + w / 2, t: p.y - h / 2, b: p.y + h / 2 };
}
export const inRoom = (r) => r.l >= 0 && r.r <= ROOM.w && r.t >= ROOM.wall && r.b <= ROOM.floorBottom;
const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

// Two solid pieces may not overlap. Walkable pieces (rugs) overlap with anything.
export function collides(p, item, all, itemOf) {
  if (item.walkable) return false;
  const a = rectOf(p, item);
  return all.some((o) => {
    if (o === p) return false;
    const oi = itemOf(o.furniture_id);
    return oi && !oi.walkable && hit(a, rectOf(o, oi));
  });
}
export const isValid = (p, item, all, itemOf) => inRoom(rectOf(p, item)) && !collides(p, item, all, itemOf);

// Pull a (possibly out-of-bounds) centre point back inside the floor area.
export function clampCentre(x, y, item, rotation) {
  const { w, h } = sizeOf(item, rotation);
  return {
    x: Math.min(Math.max(x, w / 2), ROOM.w - w / 2),
    y: Math.min(Math.max(y, ROOM.wall + h / 2), ROOM.floorBottom - h / 2),
  };
}

// Nearest valid spot to (tx, ty), searched on a coarse grid. Returns null when the room is full.
export function findFreeSpot(item, rotation, all, itemOf, tx = ROOM.w / 2, ty = (ROOM.wall + ROOM.floorBottom) / 2) {
  const c = clampCentre(tx, ty, item, rotation), cands = [];
  for (let y = ROOM.wall; y <= ROOM.floorBottom; y += 16) for (let x = 0; x <= ROOM.w; x += 16) {
    const q = clampCentre(snap(x), snap(y), item, rotation);
    cands.push({ x: q.x, y: q.y, d: Math.hypot(q.x - c.x, q.y - c.y) });
  }
  cands.sort((a, b) => a.d - b.d);
  for (const q of cands) if (isValid({ x: q.x, y: q.y, rotation }, item, all, itemOf)) return { x: q.x, y: q.y };
  return null;
}

// Whole-layout check (used by tests / defensive checks before saving).
export function validateLayout(pieces, itemOf, qtyOf) {
  if (pieces.length > ROOM.maxPieces) return 'Too much furniture in one room';
  const used = {};
  for (const p of pieces) {
    const it = itemOf(p.furniture_id);
    if (!it) return `Unknown furniture ${p.furniture_id}`;
    if (!ROTATIONS.includes(p.rotation)) return 'Bad rotation';
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return 'Bad position';
    if (!isValid(p, it, pieces, itemOf)) return `${it.name} is not in a valid spot`;
    used[p.furniture_id] = (used[p.furniture_id] || 0) + 1;
    if (used[p.furniture_id] > qtyOf(p.furniture_id)) return `You don't own enough ${it.name}`;
  }
  return null;
}
