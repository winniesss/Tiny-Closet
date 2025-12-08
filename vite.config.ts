
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // The third argument '' means load all env vars, regardless of prefix.
  const env = loadEnv(mode, '.', '');

  // Safety check for local development
  if (!env.API_KEY && mode !== 'production') {
    console.warn("\n\x1b[33m%s\x1b[0m\n", "⚠️  WARNING: API_KEY is missing. Please create a .env file in the root directory with API_KEY=your_key");
  }

  return {
    base: '/',
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: true
    },
    define: {
      // Prevents "process is not defined" error in browser
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});
