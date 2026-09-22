import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En dev, /api se proxea a la API de Tune; en producción lo hace nginx (web/nginx.conf).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": process.env.TUNE_API_URL ?? "http://localhost:8000" },
  },
  build: { sourcemap: false },
});
