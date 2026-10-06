import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { verifyPassword } from '@/server/auth/password';
import { createSession, encodeSessionCookie, validateSession } from '@/server/auth/session';
import { TEMP_PASSWORD_PATTERN } from '@/server/auth/temp-password';
import { auditLog, users, type UserRow } from '@/server/db/schema';
import { withTenant, type TenantTx } from '@/server/db/tenant';
import type { AppError } from '@/server/errors';
import {
  createStaff,
  getStaff,
  listStaff,
  resetStaffPassword,
  setStaffActive,
  updateStaff,
} from '@/server/staff/service';
import { MINUTE, createFakeClock } from '../helpers/clock';
import { useTestDbs } from '../helpers/db';
import { actorFor, seedTenant, seedUser, type SeededTenant } from '../helpers/fabrika';

const clock = createFakeClock();

describe('personel yönetimi', () => {
  const { app, owner } = useTestDbs();
  let tenant: SeededTenant;
  let boss: UserRow;

  beforeEach(async () => {
    tenant = await seedTenant(owner);
    boss = await seedUser(owner, tenant.id, {
      username: 'patron',
      fullName: 'Ali Kaya',
      role: 'owner',
    });
  });

  const asBoss = <T>(fn: (tx: TenantTx) => Promise<T>) => withTenant(app, tenant.id, fn);
  const bossActor = () => actorFor(boss, tenant.code);
  const errorOf = (promise: Promise<unknown>) =>
    promise.then(
      () => undefined,
      (e: unknown) => e as AppError,
    );
  const row = async (id: string) =>
    (
      await withTenant(owner, tenant.id, async (tx) =>
        tx.select().from(users).where(eq(users.id, id)),
      )
    )[0]!;

  describe('ekleme', () => {
    it('kullanıcı adını sadeleştirir, geçici şifre üretir, ilk girişte değiştirmeyi zorunlu kılar', async () => {
      const created = await asBoss(async (tx) =>
        createStaff(
          tx,
          bossActor(),
          { fullName: 'İsmail Çelik', username: 'İsmail', role: 'technician', fieldWork: false },
          clock,
        ),
      );
      expect(created).toMatchObject({ username: 'ismail', fullName: 'İsmail Çelik' });
      expect(created.tempPassword).toMatch(TEMP_PASSWORD_PATTERN);
      const saved = await row(created.id);
      expect(saved).toMatchObject({
        role: 'technician',
        fieldWork: true,
        mustChangePassword: true,
        isActive: true,
      });
      expect(await verifyPassword(saved.passwordHash, created.tempPassword)).toBe(true);
      const audit = await withTenant(owner, tenant.id, async (tx) => tx.select().from(auditLog));
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        action: 'user.created',
        actorUserId: boss.id,
        targetId: created.id,
      });
      expect(JSON.stringify(audit[0]!.details)).not.toContain(created.tempPassword);
    });

    it('aynı kullanıcı adını reddeder', async () => {
      await seedUser(owner, tenant.id, { username: 'ayse' });
      const err = await errorOf(
        asBoss(async (tx) =>
          createStaff(
            tx,
            bossActor(),
            { fullName: 'Ayşe Demir', username: 'AYŞE', role: 'operator', fieldWork: false },
            clock,
          ),
        ),
      );
      expect(err).toMatchObject({
        kind: 'conflict',
        fieldErrors: { username: 'Bu kullanıcı adı firmanızda zaten kullanılıyor.' },
      });
    });

    it('eşzamanlı aynı kullanıcı adı: biri eklenir, diğeri anlaşılır hata alır', async () => {
      const input = { fullName: 'Can Yıldız', username: 'can', role: 'operator', fieldWork: false };
      const results = await Promise.allSettled([
        asBoss(async (tx) => createStaff(tx, bossActor(), input, clock)),
        asBoss(async (tx) => createStaff(tx, bossActor(), input, clock)),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ kind: 'conflict' });
    });

    it('ad soyad sınırları: boşluk, 80 karakter, Türkçe harf', async () => {
      const make = (fullName: string, username: string) =>
        errorOf(
          asBoss(async (tx) =>
            createStaff(
              tx,
              bossActor(),
              { fullName, username, role: 'operator', fieldWork: false },
              clock,
            ),
          ),
        );
      expect(await make('   ', 'bos')).toMatchObject({
        fieldErrors: { fullName: 'Ad ve soyadı yazın.' },
      });
      expect(await make('Ş'.repeat(81), 'uzun')).toMatchObject({
        fieldErrors: { fullName: 'Ad soyad en fazla 80 karakter olabilir.' },
      });
      expect(await make('Ş'.repeat(80), 'tam80')).toBeUndefined();
      expect(await make('  Gülşen Öztürk 👷  ', 'gulsen')).toBeUndefined();
      const [saved] = await withTenant(owner, tenant.id, async (tx) =>
        tx.select().from(users).where(eq(users.username, 'gulsen')),
      );
      expect(saved?.fullName).toBe('Gülşen Öztürk 👷');
    });

    it('rol ve kullanıcı adı hatalarını birlikte verir', async () => {
      const err = await errorOf(
        asBoss(async (tx) =>
          createStaff(
            tx,
            bossActor(),
            { fullName: 'X', username: 'a b', role: 'admin', fieldWork: false },
            clock,
          ),
        ),
      );
      expect(Object.keys(err?.fieldErrors ?? {}).sort()).toEqual(['role', 'username']);
      expect(err?.fieldErrors?.role).toBe('Bir rol seçin.');
    });
  });

  describe('düzenleme ve son patron kuralı', () => {
    it('değişen alanları işlem geçmişine yazar, değişiklik yoksa yazmaz', async () => {
      const op = await seedUser(owner, tenant.id, { fullName: 'Ayşe Demir', role: 'operator' });
      await asBoss(async (tx) =>
        updateStaff(
          tx,
          bossActor(),
          op.id,
          { fullName: 'Ayşe Demir', role: 'operator', fieldWork: true },
          clock,
        ),
      );
      await asBoss(async (tx) =>
        updateStaff(
          tx,
          bossActor(),
          op.id,
          { fullName: 'Ayşe Demir', role: 'operator', fieldWork: true },
          clock,
        ),
      );
      const audit = await withTenant(owner, tenant.id, async (tx) => tx.select().from(auditLog));
      expect(audit).toHaveLength(1);
      expect(audit[0]!.details).toEqual({ changes: { fieldWork: { from: false, to: true } } });
    });

    it('patron kendi rolünü değiştiremez', async () => {
      const err = await errorOf(
        asBoss(async (tx) =>
          updateStaff(
            tx,
            bossActor(),
            boss.id,
            { fullName: 'Ali Kaya', role: 'operator', fieldWork: false },
            clock,
          ),
        ),
      );
      expect(err).toMatchObject({ fieldErrors: { role: 'Kendi rolünüzü değiştiremezsiniz.' } });
    });

    it('teknisyende "sahaya çıkar" her zaman açıktır', async () => {
      const op = await seedUser(owner, tenant.id, { role: 'operator' });
      await asBoss(async (tx) =>
        updateStaff(
          tx,
          bossActor(),
          op.id,
          { fullName: 'Mehmet Şahin', role: 'technician', fieldWork: false },
          clock,
        ),
      );
      expect(await row(op.id)).toMatchObject({ role: 'technician', fieldWork: true });
    });

    it('son etkin patron pasifleştirilemez ve rolü düşürülemez', async () => {
      const second = await seedUser(owner, tenant.id, { role: 'owner' });
      // boss ikinci patronu pasifleştirir; boss tek etkin patron kalır.
      await asBoss(async (tx) => setStaffActive(tx, bossActor(), second.id, false, clock));
      // Kendi kendine işlem kuralları ayrı denetlendiği için burada başka bir patron adına denenir.
      // (Gerçekte pasif patronun oturumu kapanır; buradaki amaç yalnızca son patron kuralını sınamak.)
      const secondActor = actorFor(second, tenant.code);
      expect(
        await errorOf(
          withTenant(app, tenant.id, async (tx) =>
            setStaffActive(tx, secondActor, boss.id, false, clock),
          ),
        ),
      ).toMatchObject({ userMessage: 'Firmada en az bir etkin patron kalmalı.' });
      expect(
        await errorOf(
          withTenant(app, tenant.id, async (tx) =>
            updateStaff(
              tx,
              secondActor,
              boss.id,
              { fullName: 'Ali Kaya', role: 'operator', fieldWork: false },
              clock,
            ),
          ),
        ),
      ).toMatchObject({ userMessage: 'Firmada en az bir etkin patron kalmalı.' });
    });

    it('iki patron aynı anda birbirini pasifleştiremez', async () => {
      const second = await seedUser(owner, tenant.id, { role: 'owner' });
      const results = await Promise.allSettled([
        withTenant(app, tenant.id, async (tx) =>
          setStaffActive(tx, bossActor(), second.id, false, clock),
        ),
        withTenant(app, tenant.id, async (tx) =>
          setStaffActive(tx, actorFor(second, tenant.code), boss.id, false, clock),
        ),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({
        userMessage: 'Firmada en az bir etkin patron kalmalı.',
      });
    });
  });

  describe('pasifleştirme ve şifre sıfırlama', () => {
    it('pasifleştirme oturumları kapatır, geçmişi silmez; yeniden etkinleştirme şifreyi değiştirmez', async () => {
      const tech = await seedUser(owner, tenant.id, {
        role: 'technician',
        password: 'Kombi Tamir 42',
      });
      const { token } = await withTenant(app, tenant.id, async (tx) =>
        createSession(tx, { id: tech.id, tenantId: tenant.id }, clock),
      );
      await asBoss(async (tx) => setStaffActive(tx, bossActor(), tech.id, false, clock));
      expect(await validateSession(app, encodeSessionCookie(tenant.id, token), clock)).toBeNull();
      expect((await row(tech.id)).isActive).toBe(false);

      await asBoss(async (tx) => setStaffActive(tx, bossActor(), tech.id, true, clock));
      const back = await row(tech.id);
      expect(back.isActive).toBe(true);
      expect(await verifyPassword(back.passwordHash, 'Kombi Tamir 42')).toBe(true);
      const actions = (
        await withTenant(owner, tenant.id, async (tx) => tx.select().from(auditLog))
      ).map((a) => a.action);
      expect(actions).toEqual(['user.deactivated', 'user.reactivated']);
    });

    it('patron kendini pasifleştiremez ve kendi şifresini buradan sıfırlayamaz', async () => {
      expect(
        await errorOf(asBoss(async (tx) => setStaffActive(tx, bossActor(), boss.id, false, clock))),
      ).toMatchObject({
        userMessage: 'Kendi hesabınızı pasifleştiremezsiniz.',
      });
      expect(
        await errorOf(asBoss(async (tx) => resetStaffPassword(tx, bossActor(), boss.id, clock))),
      ).toMatchObject({
        userMessage: 'Kendi şifrenizi Hesabım sayfasından değiştirebilirsiniz.',
      });
    });

    it('şifre sıfırlama kilidi açar, oturumları kapatır, ilk girişte değiştirmeyi zorunlu kılar', async () => {
      const tech = await seedUser(owner, tenant.id, {
        role: 'technician',
        failedAttempts: 3,
        lockedUntil: new Date(clock.now().getTime() + 10 * MINUTE),
      });
      const { token } = await withTenant(app, tenant.id, async (tx) =>
        createSession(tx, { id: tech.id, tenantId: tenant.id }, clock),
      );
      const { tempPassword } = await asBoss(async (tx) =>
        resetStaffPassword(tx, bossActor(), tech.id, clock),
      );
      const saved = await row(tech.id);
      expect(saved).toMatchObject({
        mustChangePassword: true,
        failedAttempts: 0,
        lockedUntil: null,
      });
      expect(await verifyPassword(saved.passwordHash, tempPassword)).toBe(true);
      expect(await validateSession(app, encodeSessionCookie(tenant.id, token), clock)).toBeNull();
    });
  });

  describe('liste ve ayrıntı', () => {
    it('etkin/pasif süzer, Türkçe ada göre sıralar, kilitli hesabı işaretler', async () => {
      await seedUser(owner, tenant.id, { fullName: 'Şule Ak' });
      await seedUser(owner, tenant.id, {
        fullName: 'Çağlar Er',
        lockedUntil: new Date(clock.now().getTime() + MINUTE),
      });
      await seedUser(owner, tenant.id, { fullName: 'Can Ok' });
      await seedUser(owner, tenant.id, { fullName: 'Pasif Kişi', isActive: false });

      const active = await asBoss(async (tx) =>
        listStaff(tx, bossActor(), { status: 'active' }, clock),
      );
      expect(active.map((s) => s.fullName)).toEqual(['Ali Kaya', 'Can Ok', 'Çağlar Er', 'Şule Ak']);
      expect(active.find((s) => s.fullName === 'Çağlar Er')?.isLocked).toBe(true);
      const inactive = await asBoss(async (tx) =>
        listStaff(tx, bossActor(), { status: 'inactive' }, clock),
      );
      expect(inactive.map((s) => s.fullName)).toEqual(['Pasif Kişi']);
    });

    it('ayrıntıda kendisi olduğunu bildirir; geçersiz kimlik "bulunamadı" verir', async () => {
      expect(await asBoss(async (tx) => getStaff(tx, bossActor(), boss.id, clock))).toMatchObject({
        isSelf: true,
      });
      expect(
        await errorOf(asBoss(async (tx) => getStaff(tx, bossActor(), 'gecersiz', clock))),
      ).toMatchObject({ kind: 'not_found' });
    });
  });

  describe('roller', () => {
    for (const role of ['operator', 'technician'] as const) {
      it(`${role} hiçbir personel işlemini yapamaz`, async () => {
        const actor = actorFor(await seedUser(owner, tenant.id, { role }), tenant.code);
        const calls: Array<(tx: TenantTx) => Promise<unknown>> = [
          (tx) => listStaff(tx, actor, { status: 'active' }, clock),
          (tx) => getStaff(tx, actor, boss.id, clock),
          (tx) =>
            createStaff(
              tx,
              actor,
              { fullName: 'X', username: 'xyz', role: 'operator', fieldWork: false },
              clock,
            ),
          (tx) =>
            updateStaff(
              tx,
              actor,
              boss.id,
              { fullName: 'X', role: 'owner', fieldWork: false },
              clock,
            ),
          (tx) => setStaffActive(tx, actor, boss.id, false, clock),
          (tx) => resetStaffPassword(tx, actor, boss.id, clock),
        ];
        for (const call of calls) {
          expect(await errorOf(withTenant(app, tenant.id, call))).toMatchObject({
            kind: 'forbidden',
          });
        }
      });
    }
  });
});
