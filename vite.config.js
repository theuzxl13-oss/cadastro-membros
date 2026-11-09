import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnv } from 'vite';

// Restringe a CSP (connect-src) ao endereço EXATO do Supabase configurado
// no build, em vez de qualquer *.supabase.co.
function cspSupabase(mode, outDir) {
  return {
    name: 'csp-supabase',
    apply: 'build',
    closeBundle() {
      const arquivo = resolve(import.meta.dirname, outDir, '_headers');
      if (!existsSync(arquivo)) return;
      const env = loadEnv(mode, import.meta.dirname, 'VITE_');
      let origem = '';
      try { origem = env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).origin : ''; } catch { origem = ''; }
      writeFileSync(arquivo, readFileSync(arquivo, 'utf8').replace('__SUPABASE_ORIGEM__', origem));
    },
  };
}

const paginas = {
  main: 'index.html',
  privacidade: 'privacidade.html',
  login: 'admin/index.html',
  redefinir: 'admin/redefinir-senha.html',
  painel: 'admin/painel.html',
};

// `npm run build:demo` gera a prévia estática (GitHub Pages) com dados fictícios.
// Em produção __DEMO__ é false e todo o código de demonstração é removido.
export default defineConfig(({ mode }) => ({
  define: { __DEMO__: JSON.stringify(mode === 'demo') },
  plugins: [cspSupabase(mode, mode === 'demo' ? 'dist-demo' : 'dist')],
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
