import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Don't precache large chunks — load them on demand
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/identitytoolkit\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firebase-auth-cache' },
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 5,
            },
          },
        ],
      },
      manifest: false,
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    // Raise warning threshold slightly — Firebase SDK is unavoidably large
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Firebase — split into auth + firestore to allow parallel loading
          'firebase-app':       ['firebase/app'],
          'firebase-auth':      ['firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          'firebase-storage':   ['firebase/storage'],
          'firebase-functions': ['firebase/functions'],
          // PDF generation — only loaded when user generates a statement
          'pdf':    ['jspdf', 'jspdf-autotable'],
          // Excel export — only loaded when user exports
          'excel':  ['xlsx'],
          // React + router — core, always needed
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
