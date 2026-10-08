import { ITEMS, RARITY } from '../shops/items.js';
import { FURNITURE, FURNITURE_CATS } from '../shops/furniture.js';
import { purchaseItem, recordPurchase, qtyOf } from '../database/inventory.js';
import { textureIcon } from '../utils/icons.js';
import { drawAvatarPreview, drawFurniturePreview } from '../utils/avatarPreview.js';
import { toast } from './hud.js';

const MAX_OWN = 10;
const CLOTHING_TABS = [
  ['hat', 'Hats', ['hat']], ['shirt', 'Shirts', ['shirt']], ['pants', 'Pants', ['pants']],
  ['shoes', 'Shoes', ['shoes']], ['accessory', 'Accessories', ['accessory']], ['special', 'Special', ['eyes', 'face', 'back', 'hand']],
];
const SHOPS = {
  clothing: {
    tone: 'teal', name: 'Snowy Threads', sub: 'Clothing Shop', blurb: 'Try anything on. Pay only for what you love.',
    tabs: CLOTHING_TABS, items: ITEMS.filter((i) => !i.starter && !i.secret),      // Phase 14: secret items are never on a shelf
    inTab: (it, tab) => CLOTHING_TABS.find((t) => t[0] === tab)[2].includes(it.category),
  },
  furniture: {
    tone: 'amber', name: 'Cozy Corner', sub: 'Furniture Shop', blurb: 'Everything a penguin needs to feel at home.',
    tabs: FURNITURE_CATS.map(([k, l]) => [k, l]), items: FURNITURE,
    inTab: (it, tab) => tab === 'all' || it.category === tab,
  },
};

// One storefront component, two shops. All purchasing goes through the purchase_item() RPC: the price is read from the
// database server-side, so the numbers on screen are only for display. Previews are local; nothing is saved until you buy/equip.
export function createShop(root, { game, profile, wardrobe, onCoins }) {
  let el = null, kind = 'clothing', tab = 'hat', selId = null, busy = false, note = null, noteTimer = null;

  const shop = () => SHOPS[kind];
  const owned = (it) => (it.kind === 'furniture' ? qtyOf(profile, it.id) > 0 : profile.owned.has(it.id));
  const selected = () => shop().items.find((i) => i.id === selId) || null;
  const equipped = (it) => it.kind === 'clothing' && profile.avatar_data[it.category] === it.id;

  function say(text, type = 'ok') {
    note = { text, type }; clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note = null; el && render(); }, 4500);
  }

  function price(it) { return `<span class="coin sm">⚓</span> ${it.price.toLocaleString()}`; }

  function card(it) {
    const have = owned(it), n = it.kind === 'furniture' ? qtyOf(profile, it.id) : 0;
    let foot = price(it);
    if (equipped(it)) foot = '✓ Wearing';
    else if (have) foot = it.kind === 'furniture' ? `✓ Owned ×${n}` : '✓ Owned';
    return `<button class="good r-${it.rarity} ${have ? 'owned' : ''} ${it.id === selId ? 'sel' : ''}" data-id="${it.id}">
      <img src="${textureIcon(game, it.asset, 54)}" alt=""><b>${it.name}</b><small>${foot}</small></button>`;
  }

  function detail(it) {
    if (!it) return `<div class="empty-detail"><div class="big">${kind === 'clothing' ? '🧥' : '🛋️'}</div><p>${shop().blurb}</p><small>Pick something from the shelves to see it up close.</small></div>`;
    const have = owned(it), n = qtyOf(profile, it.id), afford = profile.coins >= it.price;
    let action;
    if (profile.guest) action = `<button class="buy" disabled>Create an account to buy</button>`;
    else if (it.kind === 'clothing') {
      if (have) action = equipped(it)
        ? `<button class="buy alt" data-act="unequip">Take off</button>`
        : `<button class="buy go" data-act="equip">Wear it</button>`;
      else action = `<button class="buy" data-act="buy" ${afford && !busy ? '' : 'disabled'}>${busy ? 'Buying…' : afford ? `Buy for ${price(it)}` : `Need ${(it.price - profile.coins).toLocaleString()} more ${'⚓'}`}</button>`;
    } else {
      const maxed = n >= MAX_OWN;
      action = `<button class="buy" data-act="buy" ${afford && !busy && !maxed ? '' : 'disabled'}>${busy ? 'Buying…' : maxed ? `Max ${MAX_OWN} owned` : afford ? `${have ? 'Buy another' : 'Buy'} for ${price(it)}` : `Need ${(it.price - profile.coins).toLocaleString()} more ${'⚓'}`}</button>`;
    }
    const status = it.kind === 'furniture'
      ? (have ? `You own ${n}. Place ${n === 1 ? 'it' : 'them'} from <b>Decorate</b> in your room.` : 'Preview on a sample floor.')
      : (equipped(it) ? 'Currently on your penguin.' : have ? 'In your inventory.' : 'Previewing on your penguin.');
    return `<canvas id="pv" class="pv ${kind}" width="${it.kind === 'furniture' ? 300 : 240}" height="${it.kind === 'furniture' ? 220 : 260}"></canvas>
      <div class="d-name"><h3>${it.name}</h3><span class="rar r-${it.rarity}">${RARITY[it.rarity]}</span></div>
      <p class="d-desc">${it.description}</p><p class="d-status">${status}</p>${action}`;
  }

  function render() {
    if (!el) return;
    const s = shop(), items = s.items.filter((i) => s.inTab(i, tab));
    const keep = el.querySelector('.goods')?.scrollTop || 0, it = selected();
    el.className = `shop-overlay tone-${s.tone}`;
    el.innerHTML = `
      <section class="shop" role="dialog" aria-label="${s.sub}">
        <header class="awning">
          <div class="shop-name"><h2>${s.name}</h2><small>${s.sub}</small></div>
          <div class="pill coins" title="Your Anchor Coins"><span class="coin">⚓</span><span id="shopc">${profile.coins.toLocaleString()}</span></div>
          <button class="x" data-act="close" aria-label="Close shop">✕</button>
        </header>
        <div class="shop-main">
          <nav class="shelves">${s.tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</nav>
          <div class="goods"><div class="goods-grid">${items.map(card).join('') || '<p class="none">Nothing on this shelf yet.</p>'}</div></div>
          <aside class="detail">${detail(it)}</aside>
        </div>
        <div class="shop-note ${note ? 'on ' + note.type : ''}" role="status">${note ? note.text : ''}</div>
      </section>`;
    el.querySelector('.goods').scrollTop = keep;
    const cv = el.querySelector('#pv');
    if (cv && it) {
      if (it.kind === 'furniture') drawFurniturePreview(game, cv, it);
      else drawAvatarPreview(game, cv, { ...profile.avatar_data, [it.category]: it.id });
    }
  }

  async function buy(it) {
    if (busy || profile.guest) return;
    busy = true; render();
    try {
      const bal = await purchaseItem(it.id);           // server checks price, balance, duplicates; returns the new balance
      profile.coins = bal; recordPurchase(profile, it.id); onCoins(bal);
      game.events.emit('inventory-changed');
      say(it.kind === 'clothing' ? `You bought ${it.name}! Tap “Wear it” to put it on.` : `You bought ${it.name}! Place it from Decorate in your room.`);
      toast(`Bought ${it.name}!`);
    } catch (e) { say(e.message, 'err'); }
    busy = false; render();
  }

  function onClick(e) {
    if (e.target === el) return close();
    const t = e.target.closest('button'); if (!t || t.disabled) return;
    if (t.dataset.tab) { tab = t.dataset.tab; selId = null; return render(); }
    if (t.dataset.id) { selId = t.dataset.id; return render(); }
    const it = selected(), act = t.dataset.act;
    if (act === 'close') return close();
    if (act === 'buy' && it) return buy(it);
    if (act === 'equip' && it) { wardrobe.equip(it); say(`Now wearing ${it.name}.`); return render(); }
    if (act === 'unequip' && it) { wardrobe.unequip(it.category); say(`Took off ${it.name}.`); return render(); }
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  function open(k = 'clothing', startTab) {
    if (el) close();
    kind = k; tab = startTab || shop().tabs[0][0]; selId = null; note = null; busy = false;
    el = document.createElement('div');
    el.addEventListener('click', onClick);
    root.appendChild(el);
    document.body.classList.add('shop-open');
    game.events.emit('ui-lock', true);
    addEventListener('keydown', onKey);
    render();
  }
  function close() {
    if (!el) return;
    removeEventListener('keydown', onKey);
    clearTimeout(noteTimer);
    el.remove(); el = null;
    document.body.classList.remove('shop-open');
    game.events.emit('ui-lock', false);
  }

  return { open, close, isOpen: () => !!el, destroy: close };
}
