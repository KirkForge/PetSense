import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { resolve } from 'path';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'PetSense — WiFi Pet Tracker',
        short_name: 'PetSense',
        description: 'Track your pets through walls using WiFi CSI sensing. No collar, no camera, no cloud.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0a0a0f',
        theme_color: '#ff8c42',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/health$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-health',
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60,
              },
            },
          },
          {
            urlPattern: /^https?:\/\/.*:3000\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-data',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/lib'),
    },
  },
  server: {
    port: 5174,
  },
});
