import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: 'index.html',
        admin: 'admin.html',
      }
    }
  },
  server: {
    open: false
  }
});

