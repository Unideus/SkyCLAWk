import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [wasm(), topLevelAwait()],
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    // prevent Vite from prebundling swiss-eph into node_modules/.vite/deps
    // which can break new URL(..., import.meta.url) wasm asset paths
    exclude: ["@fusionstrings/swiss-eph"],
  },
});
