// Throwaway browser-only preview of the renderer (no Electron), for UI iteration.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Serve resources/ (bundled box art, fonts) at the web root so the preview's
// dev-mock can point <img> at /boxart/<code>/front.png like the real app does.
const resourcesDir = fileURLToPath(new URL('./resources', import.meta.url));

export default defineConfig({
  root: 'src/renderer',
  publicDir: resourcesDir,
  plugins: [react()],
  define: { 'import.meta.env.DEV': 'true' },
  server: {
    port: Number(process.env.PORT) || 5199,
    strictPort: false,
    fs: { allow: [fileURLToPath(new URL('.', import.meta.url))] },
  },
});
