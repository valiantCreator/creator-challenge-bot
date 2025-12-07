// client/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000", // Changed from localhost to 127.0.0.1
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
