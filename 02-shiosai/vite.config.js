import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        window: fileURLToPath(new URL("./index.html", import.meta.url)),
        station: fileURLToPath(new URL("./station.html", import.meta.url)),
      },
      output: { manualChunks: { three: ["three"] } },
    },
  },
});
