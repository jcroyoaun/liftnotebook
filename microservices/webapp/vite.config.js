import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      // woff2 must be in the precache or the display font dies offline
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'LiftNotebook',
        short_name: 'LiftNotebook',
        description: 'Your training, written down',
        theme_color: '#f4f6f9',
        background_color: '#f4f6f9',
        display: 'standalone',
        start_url: '/',
        icons: [
          // ?v=3 busts the pre-redesign Cloudflare cache entries
          { src: 'pwa-192.png?v=3', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png?v=3', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png?v=3', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/v1': {
        target: 'http://localhost:4001',
        changeOrigin: true,
      },
    },
  },
})
