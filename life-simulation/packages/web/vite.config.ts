import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Dev: `npm run web:dev` (port 5173) proxies the API and WebSocket to the game server on :3000.
// Prod: `npm run web:build` → dist/, served by the game server itself.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": { target: "http://localhost:3000", ws: true },
    },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
