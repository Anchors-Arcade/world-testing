// Tiny object pool: create sprites once, show/hide them. No allocations in the game loop.
export class Pool {
  constructor(make, size) {
    this.items = []; this.free = [];
    for (let i = 0; i < size; i++) { const o = make(i); o.setActive(false).setVisible(false); this.items.push(o); this.free.push(o); }
  }
  get() { const o = this.free.pop(); if (!o) return null; o.setActive(true).setVisible(true); return o; }
  put(o) { if (!o.active) return; o.setActive(false).setVisible(false); this.free.push(o); }
  clear() { for (const o of this.items) this.put(o); }
  forEach(fn) { for (const o of this.items) if (o.active) fn(o); }
}
