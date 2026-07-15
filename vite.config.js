import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
  },
  plugins: [
    remix({
      ignoredRouteFiles: ["**/*.css"],
    }),
  ],
  server: {
    port: 3000,
    host: "0.0.0.0",
    hmr: {
      host: "7acfcbe62.na119.preview.abacusai.app",
      protocol: "wss",
    },
  },
});
