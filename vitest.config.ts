import path from 'node:path';
import { defineConfig } from 'vitest/config';

try {
  process.loadEnvFile('.env');
} catch {
  // .env yoksa birim testleri yine çalışır; entegrasyon testleri kendi hatasını verir.
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      'server-only': path.resolve(import.meta.dirname, 'tests/helpers/server-only-stub.ts'),
    },
  },
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
        },
      },
    ],
  },
});
