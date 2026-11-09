import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const paginas = {
  main: 'index.html',
  login: 'admin/index.html',
  redefinir: 'admin/redefinir-senha.html',
  painel: 'admin/painel.html',
};

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: Object.fromEntries(
        Object.entries(paginas)
          .filter(([, f]) => existsSync(resolve(import.meta.dirname, f)))
          .map(([k, f]) => [k, resolve(import.meta.dirname, f)]),
      ),
    },
  },
  server: { port: 5173 },
});
