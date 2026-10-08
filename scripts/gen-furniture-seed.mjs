// Prints the furniture INSERT for supabase/phase5.sql from src/shops/furniture.js.
//   node scripts/gen-furniture-seed.mjs
import { FURNITURE } from '../src/shops/furniture.js';
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const rows = FURNITURE.map((f) =>
  `  (${q(f.id)},${q(f.name)},${q(f.category)},${q(f.rarity)},${q(f.asset)},${q(f.description)},${f.price},false,true,'furniture',${f.w},${f.h},${f.walkable})`);
console.log(`insert into public.items (id,name,category,rarity,asset,description,price,starter,purchasable,kind,fw,fh,walkable) values\n${rows.join(',\n')}\non conflict (id) do update set name=excluded.name, category=excluded.category, rarity=excluded.rarity, asset=excluded.asset,\n  description=excluded.description, price=excluded.price, starter=false, purchasable=true, kind='furniture', fw=excluded.fw, fh=excluded.fh, walkable=excluded.walkable;`);
