import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Treat frontend/ as the Vite project root so index.html, src/, .env, etc.
  // are all resolved from there. Build output goes to frontend/dist/ which
  // is what firebase.json expects.
  root: 'frontend',
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  // Required for PDF.js worker
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
});
