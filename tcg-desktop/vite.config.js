import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        toast: fileURLToPath(new URL('./toast.html', import.meta.url)),
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ['**/release/**'],
    },
  },
});
