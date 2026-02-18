/**
 * Vite configuration for PhantomChat frontend.
 *
 * Includes SRI (Subresource Integrity) hash generation for all JS bundles.
 * SRI ensures that if the server is compromised and serves modified JS,
 * the browser will refuse to execute it because the hash won't match.
 *
 * The generated HTML will contain:
 *   <script integrity="sha384-..." crossorigin="anonymous" src="...">
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import sri from 'vite-plugin-sri';

export default defineConfig({
  plugins: [
    react(),
    /**
     * SRI plugin generates sha384 hashes for all script and link tags.
     * This is a defence against "Evil Server" attacks: even if an attacker
     * controls the server, they cannot serve modified JS because the
     * integrity hash in the HTML must match.
     */
    sri(),
  ],
  build: {
    target: 'es2022',
    sourcemap: false, // No sourcemaps in production — reduces attack surface
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate crypto libraries into their own chunk for cache efficiency
          crypto: ['libsodium-wrappers'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
