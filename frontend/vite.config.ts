/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development the API runs separately (uvicorn on :8000); Vite proxies /api to it so the
// browser sees one origin, exactly as in production.
const apiTarget = process.env.VITE_API_PROXY ?? 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  build: {
    sourcemap: true,
    // ECharts is tree-shaken to the chart types in use; its chunk is cached separately.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          mantine: ['@mantine/core', '@mantine/dates', '@mantine/hooks', 'dayjs'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/api/schema.d.ts', 'src/test/**', 'src/main.tsx'],
      thresholds: { lines: 80, statements: 80, branches: 75, functions: 70 },
    },
  },
});
