import { defineConfig } from 'vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import { resolve } from 'path'

// Multi-page entry build for SkyCLAWk
// Each page is a standalone app with its own index.html + js/
// Shared modules live in shared/ and are compiled per-page by Vite
export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  appType: 'mpa',
  build: {
    rollupOptions: {
      input: {
        generational: resolve(__dirname, 'generational/index.html'),
        personal: resolve(__dirname, 'personal/index.html'),
        skyclock: resolve(__dirname, 'skyclock/index.html'),
        planting: resolve(__dirname, 'planting/index.html'),
        auspicious: resolve(__dirname, 'auspicious/index.html'),
        cymatics: resolve(__dirname, 'cymatics/index.html'),
        gematria: resolve(__dirname, 'gematria/index.html'),
        wheel: resolve(__dirname, 'wheel/index.html'),
      },
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
  // WASM support (needed for Swiss Ephemeris via @fusionstrings/swiss-eph)
  optimizeDeps: {
    exclude: ['@fusionstrings/swiss-eph'],
  },
  server: {
    port: 5173,
  },
})
