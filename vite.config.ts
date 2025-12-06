import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: '/BANDOSOVN_FINAL/',   // 👈 BẮT BUỘC khi deploy GitHub Pages

    server: {
        port: 3000,
        host: '0.0.0.0',
    },

    plugins: [react()],

    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        }
    }
});
