import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const paginas = {
  main: 'index.html',
  login: 'admin/index.html',
  redefinir: 'admin/redefinir-senha.html',
  painel: 'admin/painel.html',
};

// `npm run build:demo` gera a prévia estática (GitHub Pages) com dados fictícios.
// Em produção __DEMO__ é false e todo o código de demonstração é removido.
export default defineConfig(({ mode }) => ({
  define: { __DEMO__: JSON.stringify(mode === 'demo') },
  build: {
    outDir: mode === 'demo' ? 'dist-demo' : 'dist',
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
}));
