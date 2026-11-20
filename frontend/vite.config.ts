import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api へのリクエストは FastAPI（ポート 8000）へ転送する
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:8000" },
  },
});
