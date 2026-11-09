// Testes de ponta a ponta contra o ambiente LOCAL (Supabase CLI + wrangler pages dev).
// Pré-requisitos: `npm run db:local` e `.dev.vars` / `.env.local` (veja README).
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8788',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'off',
    // Permite usar um Chromium já instalado (ex.: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium)
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'celular', use: { ...devices['Pixel 7'] }, testMatch: /publico\.spec/ },
    { name: 'api', testMatch: /seguranca\.spec/ },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } }, testMatch: /painel\.spec/ },
  ],
  webServer: {
    command: 'npm run build && npx wrangler pages dev dist --port 8788 --ip 127.0.0.1',
    url: 'http://127.0.0.1:8788/api/form-config',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
