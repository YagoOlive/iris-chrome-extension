import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        offscreen:   resolve(__dirname, 'src/offscreen/index.html'),
        calibration: resolve(__dirname, 'src/calibration/index.html'),
      },
    },
  },
});
