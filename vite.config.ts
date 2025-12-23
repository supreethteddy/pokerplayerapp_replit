import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  envDir: path.resolve(import.meta.dirname),
  build: {
    // Use Vercel-compatible default output directory
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
    // Optimize for mobile
    minify: 'esbuild',
    target: 'es2015',
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    // Always use a consistent port for the frontend-only app
    port: 5173,
    strictPort: true,
    hmr: { overlay: false },
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
  // Base path for Capacitor
  base: './',
});
