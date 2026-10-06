import { parseArgs } from 'node:util';
import { systemClock } from '../src/server/clock';
import { createDb } from '../src/server/db/pool';
import { AppError } from '../src/server/errors';
import { createTenantWithOwner, setTenantStatus } from '../src/server/platform/admin';
import { loadEnv, requireEnv } from './lib/env';

const USAGE = `Kullanım:
  npm run firma:ac -- --kod <kod> --ad "<firma adı>" --patron-ad "<ad soyad>" --patron-kullanici <kullanıcı adı>
  npm run firma:dondur -- --kod <kod>
  npm run firma:etkinlestir -- --kod <kod>`;

async function main(): Promise<void> {
  loadEnv();
  const [command, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({
    args: rest,
    strict: true,
    options: {
      kod: { type: 'string' },
      ad: { type: 'string' },
      'patron-ad': { type: 'string' },
      'patron-kullanici': { type: 'string' },
    },
  });
  const db = createDb(requireEnv('DATABASE_ADMIN_URL'), { max: 2 });
  try {
    switch (command) {
      case 'ac': {
        const created = await createTenantWithOwner(
          db,
          {
            code: values.kod ?? '',
            name: values.ad ?? '',
            ownerFullName: values['patron-ad'] ?? '',
            ownerUsername: values['patron-kullanici'] ?? '',
          },
          systemClock,
        );
        console.log(`Firma açıldı. Firma kodu: ${created.code}`);
        console.log(`Patron kullanıcı adı: ${created.ownerUsername}`);
        console.log(`Geçici şifre: ${created.tempPassword}`);
        console.log(
          'Geçici şifre bir daha gösterilmeyecek. Patron ilk girişte kendi şifresini belirleyecek.',
        );
        break;
      }
      case 'dondur': {
        const result = await setTenantStatus(db, values.kod ?? '', 'suspended');
        console.log(`Firma donduruldu. Kapatılan oturum sayısı: ${result.sessionsRemoved}`);
        break;
      }
      case 'etkinlestir': {
        await setTenantStatus(db, values.kod ?? '', 'active');
        console.log('Firma yeniden etkinleştirildi.');
        break;
      }
      default:
        console.log(USAGE);
        process.exitCode = 1;
    }
  } finally {
    await db.$client.end();
  }
}

main().catch((err: unknown) => {
  if (err instanceof AppError) {
    console.error(err.userMessage);
    for (const [field, message] of Object.entries(err.fieldErrors ?? {})) {
      console.error(`  ${field}: ${message}`);
    }
  } else {
    console.error('Komut başarısız:', err instanceof Error ? err.message : err);
  }
  process.exit(1);
});
