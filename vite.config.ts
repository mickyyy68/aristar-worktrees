import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/modules/core'),
      '@worktrees': path.resolve(__dirname, './src/modules/worktrees'),
      '@agent-manager': path.resolve(__dirname, './src/modules/agent-manager'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
