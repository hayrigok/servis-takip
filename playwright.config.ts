import { defineConfig, devices } from '@playwright/test';

try {
  process.loadEnvFile('.env');
} catch {
  // .env yoksa global-setup anlaşılır hata verir.
}

const PORT = 3100;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'masaustu',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'telefon',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 } },
      testMatch: /erisilebilirlik\.spec\.ts/,
    },
  ],
  webServer: {
    // Üretim derlemesi: geliştirme sunucusundan farklı davranışları da yakalar (secure çerez, önbellek).
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/giris`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? '' },
  },
});
