import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const dbOnlyMessage =
  'Veritabanına yalnızca src/server/db üzerinden erişilir; servisler Db/TenantTx parametresi alır.';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { 'no-console': 'error' } },
  {
    files: [
      'scripts/**',
      'tests/**',
      'src/server/logger.ts',
      '*.config.ts',
      '*.config.mts',
      '*.config.mjs',
    ],
    rules: { 'no-console': 'off' },
  },
  {
    files: ['src/server/**'],
    ignores: ['src/server/db/**', 'src/server/auth/current-user.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'pg', message: dbOnlyMessage },
            { name: 'drizzle-orm/node-postgres', message: dbOnlyMessage },
            { name: '@/server/db/client', message: dbOnlyMessage, allowTypeImports: true },
            { name: '@/server/db/pool', message: dbOnlyMessage, allowTypeImports: true },
          ],
        },
      ],
    },
  },
  {
    files: ['src/app/**', 'src/proxy.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'pg', message: dbOnlyMessage },
            { name: 'drizzle-orm/node-postgres', message: dbOnlyMessage },
            { name: '@/server/db/pool', message: dbOnlyMessage, allowTypeImports: true },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/**', 'src/lib/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/server/*'],
              message:
                'Bileşenler ve src/lib tarayıcıya da gider; sunucu koduna yalnızca tür olarak bağlanabilir.',
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
  prettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'drizzle/**',
    'playwright-report/**',
    'test-results/**',
  ]),
]);
