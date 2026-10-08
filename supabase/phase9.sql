-- =====================================================================
-- ANCHORS WORLD · PHASE 9 — Bigger wardrobe, richer world, title screen
-- Run AFTER schema.sql, phase5.sql, phase6.sql, phase7.sql and phase8.sql. Safe to re-run.
--
-- The only thing Phase 9 needs from the database is the new cosmetics: everything else (the nicer maps, the
-- ambience, the title screen) is client art. Prices and ownership stay server-side exactly as before — the browser
-- still calls purchase_item(), which reads the price from THIS table, so a client that invents an item or a price
-- simply fails the lookup.
--
-- Regenerate this list after editing src/shops/items.js:   node scripts/gen-item-seed.mjs
-- =====================================================================

insert into public.items (id, name, category, rarity, asset, description, price, starter, kind) values
  ('eyes_0', 'Bright Eyes', 'eyes', 'common', 'eyes_0', 'Wide awake.', 0, true, 'clothing'),
  ('eyes_1', 'Happy Eyes', 'eyes', 'common', 'eyes_1', 'Always smiling.', 0, true, 'clothing'),
  ('eyes_2', 'Sleepy Eyes', 'eyes', 'common', 'eyes_2', 'Five more minutes…', 0, true, 'clothing'),
  ('eyes_3', 'Sparkle Eyes', 'eyes', 'uncommon', 'eyes_3', 'Starry-eyed.', 100, false, 'clothing'),
  ('face_blush', 'Rosy Cheeks', 'face', 'common', 'face_blush', 'Cold-nose blush.', 0, true, 'clothing'),
  ('face_freckles', 'Freckles', 'face', 'common', 'face_freckles', 'Sun-kissed, somehow.', 40, false, 'clothing'),
  ('face_glasses', 'Round Glasses', 'face', 'uncommon', 'face_glasses', 'Bookish and cozy.', 80, false, 'clothing'),
  ('face_sunglasses', 'Snow Shades', 'face', 'rare', 'face_sunglasses', 'Glare-proof.', 150, false, 'clothing'),
  ('hat_beanie', 'Red Beanie', 'hat', 'common', 'hat_beanie', 'The classic.', 0, true, 'clothing'),
  ('hat_beanie_blue', 'Blue Beanie', 'hat', 'common', 'hat_beanie_blue', 'Cool in every way.', 80, false, 'clothing'),
  ('hat_earmuffs', 'Earmuffs', 'hat', 'uncommon', 'hat_earmuffs', 'Toasty ears.', 100, false, 'clothing'),
  ('hat_party', 'Party Hat', 'hat', 'uncommon', 'hat_party', 'Every day is a party.', 120, false, 'clothing'),
  ('hat_tophat', 'Top Hat', 'hat', 'rare', 'hat_tophat', 'Very distinguished.', 250, false, 'clothing'),
  ('hat_crown', 'Ice Crown', 'hat', 'epic', 'hat_crown', 'Rule the plaza.', 600, false, 'clothing'),
  ('accessory_scarf', 'Striped Scarf', 'accessory', 'common', 'accessory_scarf', 'Wrap up warm.', 60, false, 'clothing'),
  ('accessory_bowtie', 'Bow Tie', 'accessory', 'uncommon', 'accessory_bowtie', 'Dapper.', 90, false, 'clothing'),
  ('accessory_bell', 'Jingle Bell', 'accessory', 'uncommon', 'accessory_bell', 'Jingles when you waddle.', 70, false, 'clothing'),
  ('shirt_stripe', 'Striped Tee', 'shirt', 'common', 'shirt_stripe', 'Simple and sailor-y.', 0, true, 'clothing'),
  ('shirt_hoodie', 'Cozy Hoodie', 'shirt', 'common', 'shirt_hoodie', 'Pocket included.', 120, false, 'clothing'),
  ('shirt_sweater', 'Nordic Sweater', 'shirt', 'uncommon', 'shirt_sweater', 'Knitted by someone who cares.', 150, false, 'clothing'),
  ('shirt_tux', 'Tuxedo', 'shirt', 'rare', 'shirt_tux', 'Black-tie ready.', 300, false, 'clothing'),
  ('pants_jeans', 'Blue Jeans', 'pants', 'common', 'pants_jeans', 'Never out of style.', 70, false, 'clothing'),
  ('pants_cargo', 'Cargo Pants', 'pants', 'common', 'pants_cargo', 'So many pockets.', 90, false, 'clothing'),
  ('pants_snow', 'Snow Pants', 'pants', 'uncommon', 'pants_snow', 'Built for snowball fights.', 140, false, 'clothing'),
  ('shoes_boots', 'Winter Boots', 'shoes', 'common', 'shoes_boots', 'Stomp-ready.', 90, false, 'clothing'),
  ('shoes_sneakers', 'White Sneakers', 'shoes', 'common', 'shoes_sneakers', 'Fresh kicks.', 80, false, 'clothing'),
  ('shoes_skates', 'Ice Skates', 'shoes', 'rare', 'shoes_skates', 'Glide into style.', 200, false, 'clothing'),
  ('back_backpack', 'Explorer Pack', 'back', 'common', 'back_backpack', 'Snacks inside.', 150, false, 'clothing'),
  ('back_cape', 'Hero Cape', 'back', 'rare', 'back_cape', 'Flutters dramatically.', 300, false, 'clothing'),
  ('back_wings', 'Frost Wings', 'back', 'epic', 'back_wings', 'Shimmering and silly.', 450, false, 'clothing'),
  ('hand_snowball', 'Snowball', 'hand', 'common', 'hand_snowball', 'Packed fresh.', 20, false, 'clothing'),
  ('hand_icecream', 'Ice Cream', 'hand', 'common', 'hand_icecream', 'Yes, in the snow.', 40, false, 'clothing'),
  ('hand_balloon', 'Balloon', 'hand', 'uncommon', 'hand_balloon', 'Floaty.', 60, false, 'clothing'),
  ('hand_umbrella', 'Umbrella', 'hand', 'uncommon', 'hand_umbrella', 'For snow showers.', 100, false, 'clothing'),
  ('eyes_4', 'Star Eyes', 'eyes', 'rare', 'eyes_4', 'Seeing stars, in a good way.', 220, false, 'clothing'),
  ('eyes_5', 'Wink', 'eyes', 'uncommon', 'eyes_5', 'Permanently in on the joke.', 110, false, 'clothing'),
  ('eyes_6', 'Visor Eyes', 'eyes', 'epic', 'eyes_6', 'A soft glow, no explanation.', 420, false, 'clothing'),
  ('face_mask', 'Snow Mask', 'face', 'uncommon', 'face_mask', 'For the really cold days.', 120, false, 'clothing'),
  ('face_eyepatch', 'Eye Patch', 'face', 'rare', 'face_eyepatch', 'Harbour chic.', 190, false, 'clothing'),
  ('face_warpaint', 'Frost Paint', 'face', 'rare', 'face_warpaint', 'Two blue stripes. Very brave.', 210, false, 'clothing'),
  ('hat_ushanka', 'Ushanka', 'hat', 'uncommon', 'hat_ushanka', 'Ear flaps up or down, your call.', 160, false, 'clothing'),
  ('hat_viking', 'Horned Helm', 'hat', 'rare', 'hat_viking', 'Historically questionable.', 320, false, 'clothing'),
  ('hat_santa', 'Winter Hat', 'hat', 'uncommon', 'hat_santa', 'Red, white and cheerful.', 140, false, 'clothing'),
  ('hat_pilot', 'Flight Cap', 'hat', 'rare', 'hat_pilot', 'Goggles included.', 280, false, 'clothing'),
  ('hat_flower', 'Snow Blossom', 'hat', 'uncommon', 'hat_flower', 'It survives the frost somehow.', 130, false, 'clothing'),
  ('hat_halo', 'Aurora Halo', 'hat', 'epic', 'hat_halo', 'Floats a little above you.', 650, false, 'clothing'),
  ('hat_astro', 'Star Helmet', 'hat', 'epic', 'hat_astro', 'Observatory surplus.', 700, false, 'clothing'),
  ('accessory_necklace', 'Ice Pendant', 'accessory', 'uncommon', 'accessory_necklace', 'One perfect shard.', 150, false, 'clothing'),
  ('accessory_medal', 'Explorer Medal', 'accessory', 'rare', 'accessory_medal', 'Worn with great pride.', 280, false, 'clothing'),
  ('accessory_compass', 'Neck Compass', 'accessory', 'uncommon', 'accessory_compass', 'Always points somewhere.', 170, false, 'clothing'),
  ('shirt_puffer', 'Puffer Jacket', 'shirt', 'common', 'shirt_puffer', 'All the air, all the warmth.', 160, false, 'clothing'),
  ('shirt_raincoat', 'Yellow Slicker', 'shirt', 'uncommon', 'shirt_raincoat', 'Harbour weather approved.', 180, false, 'clothing'),
  ('shirt_sailor', 'Sailor Coat', 'shirt', 'uncommon', 'shirt_sailor', 'Brass buttons and all.', 200, false, 'clothing'),
  ('shirt_knight', 'Frost Plate', 'shirt', 'epic', 'shirt_knight', 'Surprisingly light.', 560, false, 'clothing'),
  ('shirt_astro', 'Star Suit', 'shirt', 'epic', 'shirt_astro', 'Matches the helmet.', 620, false, 'clothing'),
  ('pants_shorts', 'Brave Shorts', 'pants', 'common', 'pants_shorts', 'In this weather? Respect.', 60, false, 'clothing'),
  ('pants_plaid', 'Plaid Trousers', 'pants', 'uncommon', 'pants_plaid', 'Loud, but in a nice way.', 130, false, 'clothing'),
  ('pants_armor', 'Frost Greaves', 'pants', 'rare', 'pants_armor', 'Clank, clank, clank.', 320, false, 'clothing'),
  ('shoes_flippers', 'Flippers', 'shoes', 'uncommon', 'shoes_flippers', 'Slap, slap, slap.', 110, false, 'clothing'),
  ('shoes_mukluks', 'Fur Mukluks', 'shoes', 'uncommon', 'shoes_mukluks', 'Warmest boots in the world.', 150, false, 'clothing'),
  ('back_jetpack', 'Snow Jet', 'back', 'epic', 'back_jetpack', 'Mostly decorative. Mostly.', 700, false, 'clothing'),
  ('back_sled', 'Sled', 'back', 'rare', 'back_sled', 'Strapped on and ready.', 260, false, 'clothing'),
  ('back_aurora', 'Aurora Cloak', 'back', 'epic', 'back_aurora', 'Trails the northern lights.', 760, false, 'clothing'),
  ('hand_lantern', 'Keeper Lantern', 'hand', 'uncommon', 'hand_lantern', 'A small warm circle.', 140, false, 'clothing'),
  ('hand_rod', 'Fishing Rod', 'hand', 'common', 'hand_rod', 'For the hole in the lake.', 90, false, 'clothing'),
  ('hand_cocoa', 'Hot Cocoa', 'hand', 'common', 'hand_cocoa', 'Still steaming.', 50, false, 'clothing'),
  ('hand_crystal', 'Cave Crystal', 'hand', 'rare', 'hand_crystal', 'Hums when you waddle.', 300, false, 'clothing')
on conflict (id) do update set name = excluded.name, category = excluded.category, rarity = excluded.rarity,
  asset = excluded.asset, description = excluded.description, price = excluded.price, starter = excluded.starter,
  kind = excluded.kind, purchasable = true;

-- Starter items are free for everyone and need no inventory row (see purchase_item() in phase5.sql).
-- Nothing else changes: inventory, coins, avatar saving, rooms, chat, the arcade and Phase 8 exploration are untouched.
