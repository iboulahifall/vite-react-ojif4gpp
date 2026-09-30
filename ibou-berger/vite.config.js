import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './', // chemins relatifs : le site fonctionne aussi dans un sous-dossier
  build: {
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), styleTile: resolve(__dirname, 'style-tile.html') },
    },
  },
});
