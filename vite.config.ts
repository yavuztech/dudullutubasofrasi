import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    sourcemap: false,          // kaynak haritası üretme
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,    // console.log temizle
        drop_debugger: true,
        passes: 2,
      },
      mangle: {
        toplevel: true,        // üst düzey isimler de karıştırılsın
        properties: false,
      },
      format: {
        comments: false,       // tüm yorumları kaldır
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Dudullu Tuba Sofrası',
        short_name: 'TubaSofrası',
        description: 'Restoran Sipariş Yönetim Sistemi',
        theme_color: '#ea580c',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
          { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      devOptions: { enabled: true },
    }),
  ],
})
