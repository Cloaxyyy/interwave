import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deployed at https://interwave.cc/app/ via GitHub Pages.
// During `pnpm dev` Vite still serves at /app/ — open http://localhost:5173/app/.
export default defineConfig({
  plugins: [react()],
  base: '/app/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
  },
});
