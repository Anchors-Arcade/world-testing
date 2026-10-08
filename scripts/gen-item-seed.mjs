// node scripts/gen-item-seed.mjs > /dev/null  — prints the `items` rows for supabase/phase9.sql.
// src/shops/items.js is the single source of truth for the cosmetic catalogue; this keeps the SQL seed in step with it.
import { ITEMS } from '../src/shops/items.js';

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
console.log('insert into public.items (id, name, category, rarity, asset, description, price, starter, kind) values');
console.log(ITEMS.filter((i) => !i.secret).map((i) =>   // secret items are seeded by their own phase file, not here
  
  `  (${q(i.id)}, ${q(i.name)}, ${q(i.category)}, ${q(i.rarity)}, ${q(i.id)}, ${q(i.description)}, ${i.price}, ${!!i.starter}, 'clothing')`
).join(',\n'));
console.log(`on conflict (id) do update set name = excluded.name, category = excluded.category, rarity = excluded.rarity,
  asset = excluded.asset, description = excluded.description, price = excluded.price, starter = excluded.starter,
  kind = excluded.kind, purchasable = true;`);
