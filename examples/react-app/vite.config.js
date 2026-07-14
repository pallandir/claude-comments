import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["@react-dev-inspector/babel-plugin"],
      },
    }),
  ],
  server: {
    port: 3001,
  },
});
