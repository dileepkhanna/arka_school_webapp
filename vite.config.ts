import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = env.VITE_BACKEND_TARGET || "http://localhost";

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "^/(auth|dashboard|notifications|profile|classes|attendance|subjects|students|promotion|fees|gallery|exams|weekly-exams|messaging|teachers|announcements|complaints|certificates|leave|leads|parents|settings|admin|teacher|parent|holidays|academic-calendar|timetable)": {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
          timeout: 120000, // 120 seconds timeout
          proxyTimeout: 120000,
          bypass: (req) => {
            const acceptHeader = req.headers.accept || "";
            if (typeof acceptHeader === "string" && acceptHeader.includes("text/html")) {
              return req.url;
            }
            return undefined;
          },
        },
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "autoUpdate",
        injectRegister: "auto",
        includeAssets: ["favicon.ico", "ase-logo.jpg", "pwa-192x192.png", "pwa-512x512.png"],
        manifest: {
          name: "SmartEduConnect - School Management",
          short_name: "SmartEduConnect",
          description: "Comprehensive School Management System for Admin, Teachers & Parents",
          theme_color: "#1a5c3a",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "portrait-primary",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,jpg,woff,woff2}"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallbackDenylist: [
            /^\/~oauth/,
            /^\/api/,
            /^\/backend\/public\/uploads\//,
            /^\/backend\/public\/storage\//,
          ],
          importScripts: ["sw-push.js"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: "NetworkFirst",
              options: {
                cacheName: "supabase-api",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 5,
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: "module",
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
