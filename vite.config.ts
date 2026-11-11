import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Rutas relativas obligatorias para portales (CrazyGames, Itch.io)
  build: {
    rollupOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
