import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  logLevel: 'error',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // We already have public/manifest.json — don't let the plugin overwrite it
      manifest: false,
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB
        importScripts: ['/push-handler.js'],
        // Precache all built assets (JS/CSS chunks, HTML, icons, fonts)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],

        // SPA fallback — every navigation gets the app shell from cache
        navigateFallback: '/index.html',
        // Exclude real server routes (Cloudflare Workers live on separate origins anyway)
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          // ── Firestore reads/writes ──────────────────────────────────────────
          // NetworkFirst: attempt live data, fall back to IndexedDB cache offline
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Firebase Auth & token refresh ────────────────────────────────────
          {
            urlPattern: /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firebase-auth-cache',
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Firebase Storage ─────────────────────────────────────────────────
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'firebase-storage-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 86400 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Weather (Open-Meteo) — stale for 30 min ──────────────────────────
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'weather-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 1800 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Geocoding (Nominatim) — cache for 7 days ─────────────────────────
          {
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'geocoding-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 86400 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // ── Gemini / AI APIs — NetworkOnly (no point caching AI responses) ────
          {
            urlPattern: /^https:\/\/generativelanguage\.googleapis\.com\//,
            handler: 'NetworkOnly',
          },
          // No handlers for fonts.googleapis.com, fonts.gstatic.com,
          // static.cloudflareinsights.com, or apis.google.com.
          // Unmatched external routes fall through to the browser without SW
          // interception, which avoids CSP connect-src violations from SW fetch().
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
