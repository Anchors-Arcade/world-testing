import { defineConfig } from 'vite';

// Relative asset URLs are required for GitHub Pages project sites, which live at
// https://<user>.github.io/<repository>/ rather than at the domain root.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
