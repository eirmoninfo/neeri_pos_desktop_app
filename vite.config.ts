import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Required for Electron file:// loading in packaged builds.
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("pusher-js") || id.includes("laravel-echo")) return "realtime";
          if (id.includes("react-router")) return "router";
          if (id.includes("react-dom") || id.includes("/react/")) return "react";
          if (id.includes("axios")) return "axios";
        }
      }
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "axios", "zustand", "react-hot-toast"]
  },
  server: {
    port: 5173,
    strictPort: true,
    host: "127.0.0.1",
    watch: {
      ignored: ["**/node_modules/**", "**/dist/**", "**/dist-electron/**", "**/release/**", "**/.git/**"]
    },
    hmr: {
      overlay: true
    }
  }
});
