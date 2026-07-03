import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const isVercelPreview = process.env.VERCEL_ENV === "preview";
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const pwaManifest = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "public/manifest.webmanifest"), "utf8")
);

// https://vite.dev/config/
export default defineConfig({
  define: {
    "import.meta.env.VITE_VERCEL_PREVIEW": JSON.stringify(isVercelPreview ? "true" : "false"),
  },
  plugins: [
    react(),
    VitePWA({
      disable: isVercelPreview,
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "pwa-icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: pwaManifest,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,svg,png,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              expiration: { maxEntries: 50, maxAgeSeconds: 3600 },
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    environment: "jsdom",
    setupFiles: "./tests/ui/setupTests.js",
    globals: true,
    include: ["tests/ui/**/*.test.{js,jsx,ts,tsx}"],
  },
});
