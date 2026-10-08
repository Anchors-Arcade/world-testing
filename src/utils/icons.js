// Small cached data-URL thumbnails of Phaser textures, for DOM item cards.
const cache = new Map();
export function textureIcon(game, key, box = 54) {
  const id = `${key}:${box}`;
  if (!cache.has(id) && game.textures.exists(key)) {
    const src = game.textures.get(key).getSourceImage(), c = document.createElement('canvas');
    c.width = c.height = 64;
    const k = Math.min(box / src.width, box / src.height, 1.8), ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, (64 - src.width * k) / 2, (64 - src.height * k) / 2, src.width * k, src.height * k);
    cache.set(id, c.toDataURL());
  }
  return cache.get(id) || '';
}
