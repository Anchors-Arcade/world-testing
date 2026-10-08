import { makeItemTextures } from './itemArt.js';
import { makeFurnitureTextures } from './furnitureArt.js';

// All art is generated procedurally so the game runs with zero external assets.
// To use real artwork later, load images in BootScene.preload() under the same keys.
export function makeTextures(scene) {
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const gen = (key, w, h, draw) => { g.clear(); draw(g); g.generateTexture(key, w, h); };
  const INK = 0x1b2a41;

  // --- avatar layers (body is white so it can be tinted with the player's colour) ---
  gen('av_body', 44, 48, (g) => { g.fillStyle(INK); g.fillEllipse(22, 26, 44, 48); g.fillStyle(0xffffff); g.fillEllipse(22, 26, 39, 43); });
  gen('av_belly', 26, 28, (g) => { g.fillStyle(0xf4fbff); g.fillEllipse(13, 14, 26, 28); });
  gen('av_foot', 16, 8, (g) => { g.fillStyle(INK); g.fillEllipse(8, 4, 16, 8); g.fillStyle(0xff9a3c); g.fillEllipse(8, 4, 13, 6); });
  // --- world ---
  gen('snow', 64, 64, (g) => {
    g.fillStyle(0xe9f4fb); g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 26; i++) { g.fillStyle(i % 3 ? 0xffffff : 0xcfe4f2); g.fillCircle(Math.random() * 64, Math.random() * 64, 1 + Math.random() * 2); }
  });
  gen('wood', 64, 64, (g) => {
    g.fillStyle(0xb9814f); g.fillRect(0, 0, 64, 64);
    g.fillStyle(0x9c693c); for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 2);
    g.fillRect(20, 0, 2, 16); g.fillRect(44, 16, 2, 16); g.fillRect(12, 32, 2, 16); g.fillRect(36, 48, 2, 16);
  });
  gen('arcade_floor', 64, 64, (g) => {
    g.fillStyle(0x2b2757); g.fillRect(0, 0, 64, 64);
    g.fillStyle(0x34306a); g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
    g.fillStyle(0x5bb6e8, 0.55); g.fillCircle(16, 48, 2); g.fillCircle(48, 16, 2);
    g.fillStyle(0xff6fae, 0.45); g.fillCircle(48, 48, 1.6); g.fillCircle(16, 16, 1.6);
  });
  // --- Phase 8 floors: one tile each, generated the same way as the Phase 1-7 floors ---
  gen('ice', 64, 64, (g) => {
    g.fillStyle(0xd6ecf8); g.fillRect(0, 0, 64, 64);
    g.fillStyle(0xc2e0f2); g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32);
    g.lineStyle(2, 0xffffff, 0.75); g.lineBetween(4, 18, 30, 6); g.lineBetween(34, 58, 60, 40); g.lineBetween(10, 44, 26, 62);
  });
  gen('stone', 64, 64, (g) => {
    g.fillStyle(0x9aa7b0); g.fillRect(0, 0, 64, 64);
    g.fillStyle(0x8793a0); g.fillRoundedRect(3, 3, 28, 26, 5); g.fillRoundedRect(35, 8, 26, 22, 5);
    g.fillRoundedRect(6, 34, 24, 24, 5); g.fillRoundedRect(34, 36, 27, 24, 5);
    g.fillStyle(0xffffff, 0.3); g.fillRect(0, 0, 64, 2);
  });
  gen('cave', 64, 64, (g) => {
    g.fillStyle(0x2c4a5c); g.fillRect(0, 0, 64, 64);
    g.fillStyle(0x35576b); g.fillEllipse(18, 22, 30, 22); g.fillEllipse(48, 46, 26, 20);
    g.fillStyle(0x7fd4f0, 0.35); g.fillCircle(52, 14, 2.4); g.fillCircle(12, 52, 2); g.fillCircle(32, 34, 1.6);
  });
  // collectible sparkle (tinted per rarity by WorldLayer)
  gen('sparkle', 34, 34, (g) => {
    g.fillStyle(0xffffff);
    g.fillTriangle(17, 0, 12, 17, 22, 17); g.fillTriangle(17, 34, 12, 17, 22, 17);
    g.fillTriangle(0, 17, 17, 12, 17, 22); g.fillTriangle(34, 17, 17, 12, 17, 22);
    g.fillCircle(17, 17, 6);
  });
  // Phase 13: proper cartoon pines — a trunk, layered tiers with a lit side, and a load of snow on every tier.
  // Baked twice (a broad one and a tall one) so a forest has variety while still costing one image per tree.
  const pine = (tall) => (g) => {
    const W = tall ? 84 : 96, H = tall ? 160 : 140, cx = W / 2;
    g.fillStyle(0x5a3b22); g.fillRect(cx - 7, H - 34, 14, 34);
    g.fillStyle(0x6b4428); g.fillRect(cx - 7, H - 34, 6, 34);
    const tiers = tall ? 4 : 3;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers, cy = H - 26 - (H - 50) * t * 0.82, hw = (W / 2 - 4) * (1 - t * 0.5), th = (H - 40) * 0.44;
      g.fillStyle(i % 2 ? 0x1b5f46 : 0x1f6b4f); g.fillTriangle(cx, cy - th, cx - hw, cy, cx + hw, cy);
      g.fillStyle(0x2a8a63, 0.6); g.fillTriangle(cx, cy - th, cx - hw * 0.34, cy, cx + hw * 0.12, cy);
      g.fillStyle(0xffffff, 0.95); g.fillTriangle(cx, cy - th, cx - hw * 0.52, cy - th * 0.34, cx + hw * 0.52, cy - th * 0.34);
      g.fillStyle(0xdfeefb, 0.9); g.fillTriangle(cx, cy - th, cx - hw * 0.2, cy - th * 0.3, cx + hw * 0.52, cy - th * 0.34);
    }
    g.fillStyle(0xffc247); g.fillCircle(cx, 6, 3);
  };
  gen('pine', 96, 140, pine(false));
  gen('pine2', 84, 160, pine(true));
  gen('flake', 6, 6, (g) => { g.fillStyle(0xffffff); g.fillCircle(3, 3, 3); });
  g.destroy();
  makeItemTextures(scene);
  makeFurnitureTextures(scene);
}
