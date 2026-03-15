import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { claudeProxyPlugin } from './server/claude-proxy';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    claudeProxyPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Vesperant',
        short_name: 'Vesperant',
        description: 'Your personal bar assistant',
        theme_color: '#1a1a1a',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*supabase\.co\/rest\/v1\/recipes/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'recipes-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 86400 * 7 },
            },
          },
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'weather-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 1800 },
            },
          },
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
