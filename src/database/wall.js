import { supabase } from '../config/supabase.js';

// =====================================================================
// PHASE 15 — the Town Hall picture wall.
//
// Pictures live in the Supabase Storage bucket `wall`, one folder per player, and `wall_pictures` holds a row per
// hung picture. The browser does two things: it uploads the FILE into its own folder (the storage policy in
// phase15.sql allows nothing else), then calls add_wall_picture() to register it — which re-checks the path, cleans
// the caption, applies the per-player limit and the cool-down. Everything else (ordering, totals, hiding, removing)
// is decided server-side.
//
// Before uploading, the picture is re-drawn on a canvas at a sane size and re-encoded as JPEG. That does three
// useful things at once: it keeps every file well under the bucket's size limit, it makes the wall cheap to load,
// and it strips the EXIF block — so a photo's GPS location and camera serial never leave the player's device.
// =====================================================================
const BUCKET = 'wall';
export const MAX_EDGE = 768;             // longest side of the stored picture
export const TARGET_BYTES = 380 * 1024;  // aim well under the bucket's 600 KB ceiling

async function rpc(fn, args) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export const fetchWall = (from = 0, limit = 60) => rpc('get_wall', { p_from: from, p_limit: limit });
export const removePicture = (id) => rpc('remove_wall_picture', { p_id: id });
export const reportPicture = (id, reason = 'other', details = null) =>
  rpc('report_wall_picture', { p_id: id, p_reason: reason, p_details: details });

// The public URL Phaser loads the texture from.
export function pictureUrl(path) {
  if (!supabase) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------------
// Re-draw a chosen file at MAX_EDGE and re-encode it, dropping quality until it fits. Returns {blob, w, h}.
// Runs entirely in the browser; nothing is sent anywhere until the player presses "Hang it".
// ---------------------------------------------------------------------
export async function prepareImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Pick an image file (JPG, PNG or WebP).');
  if (file.size > 25 * 1024 * 1024) throw new Error('That image is enormous — pick one under 25 MB.');

  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("That file isn't an image Anchors World can read."); });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale)), h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);          // flatten transparency so PNGs do not go black
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  let blob = null;
  for (const q of [0.82, 0.72, 0.62, 0.5, 0.4]) {
    blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', q));
    if (blob && blob.size <= TARGET_BYTES) break;
  }
  if (!blob) throw new Error('Could not prepare that image.');
  if (blob.size > 600000) throw new Error('That image will not compress small enough — try a simpler picture.');
  return { blob, w, h };
}

// Upload + register. `prepared` is what prepareImage() returned.
export async function hangPicture({ blob, w, h }, caption = '') {
  const { data: u, error: ue } = await supabase.auth.getUser();
  if (ue || !u?.user) throw new Error('Sign in to add a picture.');
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${u.user.id}/${name}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(error.message.includes('row-level security') ? 'The wall is not set up yet (run supabase/phase15.sql).' : error.message);

  try {
    return await rpc('add_wall_picture', { p_path: path, p_caption: caption, p_w: w, p_h: h });
  } catch (e) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});   // rejected: do not leave an orphan file
    throw e;
  }
}

export const niceWallError = (e) =>
  /could not find the function|schema cache|does not exist|PGRST202|bucket/i.test(e?.message || '')
    ? 'The picture wall is not set up yet. Run supabase/phase15.sql in the Supabase SQL editor.'
    : e?.message || 'Something went wrong.';
