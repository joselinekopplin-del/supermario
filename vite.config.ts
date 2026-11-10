import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  server: {
    watch: {
      ignored: [
        "**/artifacts/**",
        "**/test-results/**",
        "**/playwright-report/**",
      ],
    },
  },
  build: {
    rollupOptions: { output: { manualChunks: { phaser: ["phaser"] } } },
    chunkSizeWarningLimit: 1600,
  },
});
