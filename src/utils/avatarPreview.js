import { BODY_TYPES, FIT, ITEM_BY_ID, normalizeAvatar } from '../shops/items.js';
import { THEMES, hex } from '../rooms/themes.js';
import { DEFAULT_THEME } from '../rooms/roomRules.js';

// 2D-canvas twin of entities/Avatar.js (front view) so shop previews need no extra Phaser objects.
// Same layer order and offsets as Avatar: back, feet, body(tinted), pants, belly, shirt, accessory, eyes, beak, face, hat, hand.
const tintCache = new WeakMap();   // source image -> Map(colour -> tinted canvas)
function tinted(im, color) {
  let byColor = tintCache.get(im);
  if (!byColor) tintCache.set(im, (byColor = new Map()));
  if (byColor.has(color)) return byColor.get(color);
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const x = c.getContext('2d');
  x.drawImage(im, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0);
  byColor.set(color, c);
  return c;
}

// Phase 18: this used to place every garment by its CENTRE at a fixed offset (the pre-Phase-17 scheme), so shop
// and friends-list previews showed clothes floating, clipping or oversized even though the in-world avatar (which
// already uses the FIT anchor/maxW system) looked correct. Previews now share the exact same fitting math as
// Avatar.js: each item is measured once, scaled down (never up) to its slot's maxW, and pinned by the point on the
// garment that should touch the body, so a shop thumbnail matches what the player will actually look like wearing it.
export function drawAvatarPreview(game, canvas, data, scale = 2.6) {
  const d = normalizeAvatar(data), ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  const ox = canvas.width / 2, oy = canvas.height - 26;
  const [sx, sy] = BODY_TYPES[d.bodyType];
  const bodyTop = -2 - 48 * sy, hatY = bodyTop + 8;           // same head line Avatar.js hangs hats/faces from
  const hy = -48 * (sy - 1);
  const src = (key) => (game.textures.exists(key) ? game.textures.get(key).getSourceImage() : null);
  // put(): draws an image anchored at (ax, ay) of ITS OWN box (0,0 = top-left, 1,1 = bottom-right) onto body point
  // (x, y), at scale kx/ky. This mirrors spr.setOrigin() + setPosition() + setScale() in Avatar.js exactly.
  const put = (img, x, y, kx = 1, ky = 1, ax = 0.5, ay = 0.5) => {
    if (!img) return;
    const w = img.width * kx * scale, h = img.height * ky * scale;
    ctx.drawImage(img, ox + x * scale - w * ax, oy + y * scale - h * ay, w, h);
  };
  // fitted(slot, id): returns { img, x, y, k } using the same anchor/maxW rules as Avatar.setOutfit(), so a garment
  // wider than its slot allows is scaled down (never up) and pinned by its anchor instead of its centre.
  const fitted = (slot, id) => {
    const base = FIT[slot]; if (!base) return null;
    const img = src(id); if (!img) return null;
    const extra = (id && ITEM_BY_ID[id]?.fit) || {};
    let k = 1;
    if (base.maxW && img.width > 0) k = Math.min(1, base.maxW / img.width);
    k *= extra.s ?? 1;
    return { img, k, ax: base.ax, ay: base.ay, x: (base.x ?? 0) + (extra.dx ?? 0), y: base.y + (extra.dy ?? 0) };
  };
  const placeFitted = (slot, id, yExtra = 0) => {
    const f = fitted(slot, id); if (!f) return;
    put(f.img, f.x, f.y + yExtra, sx * f.k, sy * f.k, f.ax, f.ay);
  };
  // ground shadow
  ctx.fillStyle = 'rgba(27,51,80,.25)'; ctx.beginPath(); ctx.ellipse(ox, oy - 2, 20 * scale, 6 * scale, 0, 0, Math.PI * 2); ctx.fill();
  if (d.back) placeFitted('back', d.back);
  const shoe = src(d.shoes || 'av_foot'); put(shoe, -8 * sx, -4, 1, 1); put(shoe, 8 * sx, -4, 1, 1);
  const body = src('av_body'); if (body) put(tinted(body, d.color), 0, -2 - 24 * sy, sx, sy);
  if (d.pants) placeFitted('pants', d.pants);
  put(src('av_belly'), 0, -20, sx, sy);
  if (d.shirt) placeFitted('shirt', d.shirt);
  if (d.accessory) placeFitted('accessory', d.accessory);
  const eyesF = fitted('eyes', d.eyes);
  if (eyesF) put(eyesF.img, eyesF.x, eyesF.y + hy, sx * eyesF.k, sy * eyesF.k, eyesF.ax, eyesF.ay);
  put(src('av_beak'), 0, -28 + hy);
  if (d.face) placeFitted('face', d.face, hy);
  // the hat is pinned by its brim to the head line, exactly as in Avatar.layout()
  if (d.hat) {
    const f = fitted('hat', d.hat);
    if (f) put(f.img, f.x, hatY + (f.y - FIT.hat.y), sx * f.k, sy * f.k, f.ax, f.ay);
  }
  if (d.hand) placeFitted('hand', d.hand);
}

// Furniture preview: the piece sitting on a swatch of the player's room floor.
export function drawFurniturePreview(game, canvas, item, themeKey = DEFAULT_THEME) {
  const ctx = canvas.getContext('2d'), th = THEMES[themeKey] || THEMES[DEFAULT_THEME], W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = hex(th.floorA); ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = hex(th.floorB);
  for (let y = 0; y < H; y += 36) { ctx.fillRect(0, y, W, 3); for (let x = (y / 36) % 2 ? 40 : 100; x < W; x += 120) ctx.fillRect(x, y, 3, 36); }
  const img = game.textures.exists(item.asset) ? game.textures.get(item.asset).getSourceImage() : null;
  if (!img) return;
  const k = Math.min((W * 0.7) / img.width, (H * 0.7) / img.height, 2.6), w = img.width * k, h = img.height * k;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(W / 2, H / 2 + h / 2 + 2, w / 2.1, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}
