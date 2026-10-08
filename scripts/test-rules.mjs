// node scripts/test-rules.mjs  — checks placement rules + catalog consistency (no browser/Supabase needed).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FURNITURE, FURNITURE_BY_ID } from '../src/shops/furniture.js';
import { ITEMS } from '../src/shops/items.js';
import { THEME_KEYS } from '../src/rooms/themes.js';
import { ROOM, snap, rectOf, inRoom, isValid, clampCentre, findFreeSpot, validateLayout, nextRotation } from '../src/rooms/roomRules.js';

const of = (id) => FURNITURE_BY_ID[id];
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('catalog: unique ids, even sizes, fits the floor, valid rarity/price', () => {
  const ids = new Set();
  for (const f of FURNITURE) {
    assert(!ids.has(f.id), 'dup ' + f.id); ids.add(f.id);
    assert(!ITEMS.some((i) => i.id === f.id), 'clashes with clothing ' + f.id);
    assert(f.w % 2 === 0 && f.h % 2 === 0, 'even size ' + f.id);
    assert(f.w <= ROOM.w && f.h <= ROOM.floorBottom - ROOM.wall && f.w <= ROOM.floorBottom - ROOM.wall, 'fits rotated ' + f.id);
    assert(f.price > 0 && ['common', 'uncommon', 'rare', 'epic', 'event'].includes(f.rarity));
  }
  assert.equal(FURNITURE.filter((f) => f.walkable).every((f) => f.category === 'rug'), true);
});
t('every furniture piece has procedural art', () => {
  const src = fs.readFileSync(new URL('../src/utils/furnitureArt.js', import.meta.url), 'utf8');
  for (const f of FURNITURE) assert(new RegExp(`\\b${f.id}:`).test(src), 'no art for ' + f.id);
});
t('SQL seed + theme list match the client', () => {
  const sql = fs.readFileSync(new URL('../supabase/phase5.sql', import.meta.url), 'utf8');
  for (const f of FURNITURE) assert(sql.includes(`('${f.id}','${f.name.replace(/'/g, "''")}','${f.category}','${f.rarity}'`), 'seed row ' + f.id);
  for (const k of THEME_KEYS) assert(sql.split(`'${k}'`).length >= 3, 'theme ' + k);
  for (const c of new Set(FURNITURE.map((f) => f.category))) assert(sql.includes(`'${c}'`), 'category ' + c);
});
t('bounds: wall, sides, doorway strip', () => {
  const chair = of('chair_wood');
  assert(isValid({ x: 480, y: 300, rotation: 0 }, chair, [], of));
  assert(!isValid({ x: 10, y: 300, rotation: 0 }, chair, [], of), 'left edge');
  assert(!isValid({ x: 480, y: 160, rotation: 0 }, chair, [], of), 'into back wall');
  assert(!isValid({ x: 480, y: 580, rotation: 0 }, chair, [], of), 'into doorway strip');
  assert(isValid({ x: 24, y: 174, rotation: 0 }, chair, [], of), 'exact corner');
});
t('rotation swaps the footprint', () => {
  const bed = of('bed_single'); // 80x144
  const p = { x: 480, y: 520, rotation: 0 };
  assert(!inRoom(rectOf(p, bed)), 'tall bed too low');
  assert(isValid({ ...p, y: 500, rotation: 0 }, bed, [], of), 'fits when moved up (bottom edge 572)');
  assert(isValid({ x: 480, y: 400, rotation: 90 }, bed, [], of));
  assert.equal(nextRotation(270), 0);
});
t('solid pieces cannot overlap; rugs can overlap anything', () => {
  const a = { x: 400, y: 300, rotation: 0, furniture_id: 'table_round' }, b = { x: 440, y: 300, rotation: 0, furniture_id: 'chair_wood' };
  assert(!isValid(b, of('chair_wood'), [a, b], of));
  const touching = { x: 400 + 40 + 24, y: 300, rotation: 0, furniture_id: 'chair_wood' };
  assert(isValid(touching, of('chair_wood'), [a, touching], of), 'touching edges is fine');
  const rug = { x: 400, y: 300, rotation: 0, furniture_id: 'rug_round' };
  assert(isValid(rug, of('rug_round'), [a, rug], of));
  assert(isValid(a, of('table_round'), [a, rug], of), 'table on rug');
});
t('clampCentre keeps pieces on the floor', () => {
  const sofa = of('sofa_plaid');
  const c = clampCentre(-500, 9999, sofa, 0);
  assert(inRoom(rectOf({ ...c, rotation: 0 }, sofa)));
  const c2 = clampCentre(5000, -5000, sofa, 90);
  assert(inRoom(rectOf({ ...c2, rotation: 90 }, sofa)));
  assert.equal(snap(13), 16); assert.equal(snap(11), 8);
});
t('findFreeSpot finds a spot, then reports a full room', () => {
  const pieces = [];
  for (let i = 0; i < 6; i++) {
    const it = of('chair_wood'), s = findFreeSpot(it, 0, pieces, of); assert(s, 'spot ' + i);
    const p = { ...s, rotation: 0, furniture_id: 'chair_wood' }; assert(isValid(p, it, [...pieces, p], of)); pieces.push(p);
  }
  const full = [];
  for (let i = 0; i < 200; i++) { const s = findFreeSpot(of('bed_igloo'), 0, full, of); if (!s) break; full.push({ ...s, rotation: 0, furniture_id: 'bed_igloo' }); }
  assert(full.length > 5 && full.length < 200);
  assert.equal(findFreeSpot(of('bed_igloo'), 0, full, of), null);
});
t('validateLayout: ownership counts, bad rotation, off-grid ints, overflow', () => {
  const qty = (id) => ({ chair_wood: 2, rug_round: 1 }[id] || 0);
  const ok = [{ furniture_id: 'chair_wood', x: 100, y: 300, rotation: 0 }, { furniture_id: 'chair_wood', x: 200, y: 300, rotation: 90 }, { furniture_id: 'rug_round', x: 150, y: 300, rotation: 0 }];
  assert.equal(validateLayout(ok, of, qty), null);
  assert(validateLayout([...ok, { furniture_id: 'chair_wood', x: 300, y: 300, rotation: 0 }], of, qty), 'owns only 2');
  assert(validateLayout([{ furniture_id: 'sofa_plaid', x: 100, y: 300, rotation: 0 }], of, qty), 'not owned');
  assert(validateLayout([{ furniture_id: 'chair_wood', x: 100, y: 300, rotation: 45 }], of, qty), 'rotation');
  assert(validateLayout([{ furniture_id: 'chair_wood', x: 100.5, y: 300, rotation: 0 }], of, qty), 'fraction');
  assert(validateLayout(Array(81).fill(ok[0]), of, () => 99), 'too many');
});
console.log(`\n${n} test groups passed`);
