import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: the browser calls /api/... on the Vite server (5173), which
// forwards to Express (5000). Avoids CORS entirely during development and
// mirrors production, where nginx does the same job.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
