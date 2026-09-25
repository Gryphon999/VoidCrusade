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
    // The balance simulator runs long matches in the dev build; source edits must not reload them.
    ...((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.VC_STATIC ? { hmr: false, watch: { ignored: ['**/*'] } } : {}),
  },
});
