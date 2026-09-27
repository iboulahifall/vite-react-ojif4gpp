/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Développement : l'API du serveur FastAPI (port 8000) est accessible sous /api.
  server: { proxy: { '/api': { target: process.env.API_TARGET ?? 'http://localhost:8000', changeOrigin: true } } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
