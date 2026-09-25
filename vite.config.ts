import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Keep the engine in its own long-cacheable chunk.
        manualChunks: { phaser: ['phaser'] },
      },
    },
  },
  server: {
    port: 5173,
  },
});
