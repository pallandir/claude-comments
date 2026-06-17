import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import Inspector from "vite-plugin-vue-inspector";

export default defineConfig({
  plugins: [vue(), Inspector({ cleanHtml: false })],
  server: {
    port: 3002,
    strictPort: true,
  },
});
