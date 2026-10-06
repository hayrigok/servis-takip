# Servis Takip — Proje Kuralları

@docs/YOL-HARITASI.md

## 1. Proje özeti
Servis firmaları için çok firmalı (multi-tenant) web tabanlı servis takip sistemi; abonelikle satılacak. Ofis müşteri kaydeder ve iş atar, teknisyen işini telefondan (PWA) görür ve kapatır, patron stok/kasa/rapor görür. Fark: akıllı rota sıralaması, telefon öncelikli teknisyen ekranı, verilerin Türkiye'de tutulması (hedef).

Durum (2026-10-06): 1. aşamanın **Temel** parçası bitti: çok firma altyapısı (çift kilit), giriş ve oturum, roller, personel yönetimi, işlem geçmişi kaydı, Saha tasarım sistemi (tasarım: `docs/superpowers/specs/2026-10-06-temel-design.md`, plan: `docs/superpowers/plans/2026-10-06-temel.md`). Sırada **Müşteriler** parçası: tasarım yazıldı (2026-10-07, `docs/superpowers/specs/2026-10-07-musteriler-design.md`), sahibin incelemesinde → plan → kod.

## 2. Çalışma standardı
Bilgisayar düzeyindeki kişisel standart (`~/.claude/CLAUDE.md`) geçerli. Projeye özel ekler:
- **Firma izolasyonu pazarlık konusu değildir.** Her yeni tablo ve uç nokta için "başka firmanın kullanıcısı buna erişemez" testi yazılır.
- Yetki kontrolü her zaman sunucuda yapılır; arayüzde düğme gizlemek yalnızca kolaylıktır.
- Arayüz Türkçe ve **"siz"** diliyle, telefon öncelikli (teknisyen ekranları 360 px genişlikte ve büyük yazıda denenir).
- Ekran kodundan önce tasarım süreci: `ui-ux-pro-max` + `frontend-design` ile 2-3 görsel yön, sahip seçer; renkler yalnızca `globals.css` token'larında (ayrıntı: tasarım belgesi §12).

## 3. Git
- Commit serbest, push yalnızca sahibin açık onayıyla (her push ayrı onay).
- `.claude/settings.local.json`, `.env*` git dışında.

## 4. Doğrulama kapısı
"Bitti" demeden önce hepsi temiz geçer; sonuçlar sayılarıyla raporlanır.

| Ne zaman | Komut | Neyi yakalar |
|---|---|---|
| Her değişiklik | `npm run typecheck` | Tür hataları (TS strict) |
| Her değişiklik | `npm run lint` | Veritabanına `src/server/db` dışından erişim (`pg`, havuz, istemci içe aktarımı yasak; servisler `TenantTx` alır), `console` kullanımı (yalnızca `logger.ts` ve betikler), React kuralları |
| Her değişiklik | `npm run format:check` | Prettier biçimi (`npm run format` düzeltir) |
| Her değişiklik | `npm test` | Birim + entegrasyon: firma izolasyonu (iki kilit ayrı ayrı), roller, giriş ve kilit, oturum, personel, şifre değiştirme, şema denetimi, renk kontrastı, renk kodu yasağı |
| Ekran ya da yapılandırma değişince | `npm run build` | Üretim derlemesi, rota hataları; sunucu/istemci sınırı (`server-only` içeren modül istemci bileşenine girerse derleme düşer) |
| Ekran değişince (görünmez Chromium; ilk kurulum sahibe sorulur) | `npm run test:e2e` | Akışlar, yetki ve firma ayrımı ekranda, WCAG 2.2 AA (açık/koyu, telefon/masaüstü), 360 px'de %200 yazı (yatay kayma, taşan öğe, alt menü etiketleri), ekran görüntüleri (`tests/e2e/ekran-goruntuleri/`, git dışında) |

⚠️ Entegrasyon testleri ve E2E aynı test veritabanını sıfırlar: **aynı anda çalıştırılmaz.** E2E kendi üretim derlemesini 3100 portunda açar.
`.next/types` bayat kalırsa (sayfa silinince tsc eski sayfayı arar): `rm -rf .next/types`.

## 5. Ürün kuralları
### Roller ve yetkiler
| İşlem | Patron | Operatör | Teknisyen |
|---|---|---|---|
| Müşteri görme | Tümü | Tümü | Yalnızca kendisine atanmış işlerin müşterisi; iş kapandıktan N gün sonra gizlenir |
| Müşteri ekleme/düzenleme | ✅ | ✅ | ❌ (yalnızca "bilgi yanlış" notu) |
| İş açma, atama | ✅ | ✅ | ❌ |
| İş durumu güncelleme | ✅ | ✅ | Yalnızca kendi işleri |
| İşte kullanılan parçayı girme | ✅ | ✅ | Yalnızca kendi işleri |
| Stok adetlerini görme | ✅ | ✅ | ❌ |
| Mal girişi, stok düzenleme | ✅ | ❌ | ❌ |
| Tahsilat girme | ✅ | ✅ | Yalnızca kendi işleri; kasa toplamını görmez |
| Kasa, faturalar, raporlar | ✅ | ❌ | ❌ |
| Silme (her tür kayıt) | ✅ (çöp kutusu, 30 gün) | ❌ | ❌ |
| Personel yönetimi | ✅ | ❌ | ❌ |

Ayrıca platform düzeyinde **sistem sahibi** rolü: firma açar/dondurur, kullanım görür; firmaların müşteri verisini göremez (destek erişimi yalnızca firma izniyle ve kayıtlı).

### İş durumları
Yeni → Atandı → Tamamlandı | Ertelendi (yeni tarih + neden zorunlu) | Parça bekleniyor | Müşteri evde yok | İptal. Her geçiş kim/ne zaman ile kaydedilir.

### Randevu
Varsayılan zaman aralığı (09-12 / 12-15 / 15-18), isteğe bağlı kesin saat. Rota sıralaması aralığı pencere olarak kullanır.

### Tahsilat
Nakit, kredi kartı (firmanın POS'u, sistem yalnızca kaydeder), IBAN (onaylanana kadar "bekleyen"). Veresiye/"Ödenmedi" yok (sahibin kararı, 2026-10-05). Fatura yalnızca kayıt; resmi e-Fatura kesilmez.

### Sahibin eski programı (bu projeyle ilgisiz)
`D:\Projelerim\MÜŞTERİ TAKİP`: sahibin yalnızca kendi işi için kullandığı masaüstü programı (Python + SQLite).
- **Bu ürünün öncülü değildir.** Kayıtları taşınmaz; özelliklerini buraya taşımayı önerme (sahip 2026-10-05'te düzeltti: hedef kullanıcı farklı).
- ⚠️ Programa ve `musteriler.db`'ye dokunulmaz. Gerçek müşteri verisi içerir.

### KVKK
- Firmalar veri sorumlusu, platform veri işleyendir.
- Loglara ve hata kayıtlarına telefon, adres, ad, token yazılmaz.
- Şifreler argon2 (ya da bcrypt) ile; giriş denemesi sınırı; yedekler şifreli.
- Fatura kayıtları yasal süre (doğrulanacak, genelde 10 yıl) saklanır; silme isteğinde geri kalan veri anonimleştirilir.
- Teknisyenin "Yol tarifi" düğmesi adresi telefonundaki harita uygulamasına (Google/Yandex) gönderir; aydınlatma metninde belirtilecek (avukatla doğrulanacak).

## 6. Kod standartları (kodlamada güncel belgeden doğrulanır)
- Next.js 16.3 (App Router, Turbopack) + React 19.2 + TypeScript 6.0 (strict). Tek kod tabanı: arayüz + sunucu. **Sürüme uygun Next belgesi `node_modules/next/dist/docs`'ta**; ezberden değil oradan çalış.
- PostgreSQL 18 + Drizzle 0.45 (`pg` sürücüsü). Doğrulama Zod 4 (`tr` dili), şifre argon2id (`@node-rs/argon2`). Arayüz Tailwind 4 (token'lar `globals.css`), radix-ui (onay penceresi), lucide-react. Yalnızca kararlı sürümler.
- PostgreSQL. Her firma verisi tablosunda `tenant_id`; uygulama katmanı filtresine ek olarak PostgreSQL Row-Level Security ikinci kilit.
- Para tutarları kuruş cinsinden tam sayı (integer); ondalıklı sayı kullanılmaz.
- Saat dilimi `Europe/Istanbul`; tarihler veritabanında UTC.
- Telefon numaraları `+905XXXXXXXXX` biçiminde normalize edilir.
- PWA + Web Push (VAPID); ücretsiz, SMS yok.
- Harita: MapLibre + OpenStreetMap verisi. Adres→koordinat ve rota için açık kaynak, kendi sunucuda (OSRM + VROOM aday; boyut ve RAM ihtiyacı 3. aşamada doğrulanacak). Geliştirmede herkese açık OSM servislerinin kullanım kurallarına uyulur (istek sınırı).
- Barındırmaya bağımlı olmayan yapı (Docker ile taşınabilir); sunucu kararı açık.

## 7. Kritik kırılma noktaları
- Türkçe büyük/küçük harf ve arama: `İ/i`, `I/ı` (`toLocaleUpperCase('tr-TR')`, veritabanında Türkçe karşılaştırma). Veritabanları ICU `tr-TR` ile açılır (`db:kur`); küme varsayılanı `C`.
- **Kimlik sadeleştirme:** firma kodu ve kullanıcı adı `foldIdentifier` (`src/lib/identifier.ts`) ile tek biçime iner ("İsmail", "Ismail", "ısmail" → "ismail"); hem kayıtta hem girişte. **Şifre asla sadeleştirilmez, kırpılmaz, büyük/küçük harfi değiştirilmez.**
- **Next 16:** `middleware` yerine `src/proxy.ts` (`export function proxy`). Sunucu bileşenleri çerez yazamaz: kayan oturumun çerez tarafı proxy'de yenilenir. Yönlendirmede `Location` göreli gelir (`/giris`). `next.config.ts`'te `agentRules: false` kalmalı (yoksa `next dev` CLAUDE.md'ye İngilizce blok ekler).
- Next.js telemetrisi bu bilgisayarda kapalı (`next telemetry status` → Disabled).
- iOS'ta Web Push yalnızca ana ekrana eklenmiş PWA'da çalışır.
- Türkiye adreslerinde otomatik konum bulma sık yanılır; iğne operatör/teknisyen onayıyla kaydedilir.
- **Büyük yazıda dar ekran:** sütun sayısı verilmemiş `grid` en geniş içeriğe (giriş kutusunun 20 karakterlik varsayılan genişliği, bölünmeyen kullanıcı adı) göre genişler ve sayfayı yana kaydırır → tek sütunlu ızgarada `grid-cols-1`, kullanıcı adı ve başlıkta `break-words`. Yazıyla birlikte ölçeklenmesi gereken eşikler `rem` kapsayıcı sorgusuyla (`@container` + `@3xs:`/`@max-3xs:`) yazılır. Sabit başlıklarda uzun kelimeye yumuşak tire (`­`).
- **Ekran okuyucu uyarısı:** `role="alert"` öğesi aynı metinle yerinde kalırsa ikinci hata okunmaz → bildirimler gönderim sürerken (`useActionState`/`useTransition` pending) kaldırılır, yanıtla yeniden eklenir.
- **Akışla gelen sayfa:** `loading.tsx` iskeleti varken `page.goto` gerçek içerikten önce dönebilir; E2E ölçüm ve taramaları `gotoReady` (iskelet `aria-busy` kalkana kadar bekler) ile yapılır.
- **Gerçek istemci IP'si:** `x-forwarded-for`'un **en sağındaki** değer (önümüzdeki ters vekilin yazdığı). Soldaki değerleri istemci yazar; onlara ve `x-real-ip`'e güvenilmez (`src/server/request-ip.ts`).

## 8. Proje yapısı
```
drizzle/                 Göçler (0000 tablolar, 0001 RLS + servis_app izinleri)
scripts/                 db-kur (roller, veritabanları, .env), db-migrate, firma (aç/dondur/etkinleştir), tohum (deneme firmaları)
src/proxy.ts             İyimser yönlendirme (çerez var mı) + kayan çerez yenileme
src/app/(genel)/         Giriş, şifre belirleme (oturumsuz/ilk giriş)
src/app/(uygulama)/      Uygulama kabuğu: ana sayfa, hesabım, personel (liste, yeni, [id]); loading/not-found
src/components/          Kabuk, menü, yetkisiz/bulunamadı görünümleri, şifre formu
src/components/ui/       Tasarım sistemi bileşenleri (düğme, alanlar, rozet, kart, bildirim, onay penceresi…)
src/lib/                 İstemci+sunucu ortak saf kod (kimlik sadeleştirme, tarih biçimi, proxy kararı)
src/server/db/           Havuz, şema, withTenant/TenantTx, veritabanı hata çevirisi
src/server/auth/         Şifre, oturum, giriş, kilit ve deneme sınırı, şifre değiştirme, çerez ayarları, oturumdaki kullanıcı
src/server/staff/        Personel servisi
src/server/platform/     Sistem sahibi işlemleri (firma açma/dondurma; servis_owner bağlantısı)
src/server/audit/        İşlem geçmişi kaydı
src/server/              permissions (yetki tablosu), roles, errors, action-result, logger, navigation, request-ip, validation, clock
tests/unit|integration|e2e/  Vitest birim ve entegrasyon, Playwright E2E; tests/helpers/ ortak yardımcılar
```

## 9. Mimari
### Çift kilit (firma izolasyonu)
- **1. kilit, uygulama:** her sorgu `tenant_id` ile ayrıca filtrelenir. Servisler ham `Db` değil **`TenantTx`** alır; `TenantTx` yalnızca `withTenant(db, tenantId, fn)` / `enterTenant(tx, tenantId)` ile üretilir. Bunlar işlem içinde `set_config('app.tenant_id', …, true)` yapar (işlem bitince düşer, havuzda kalmaz).
- **2. kilit, veritabanı:** firma tablolarında RLS `ENABLE` + `FORCE`, `tenant_isolation` politikası `tenant_id = current_setting('app.tenant_id')`. Uygulama `servis_app` rolüyle bağlanır (NOBYPASSRLS, yalnızca gereken izinler); tablo sahibi `servis_owner` yalnızca göç ve komut satırı işlerinde.
- Bileşik yabancı anahtar: `sessions`/`audit_log` → `users (tenant_id, id)`; bir satır başka firmanın kullanıcısına bağlanamaz.
- **Şema denetimi testi** (`sema-denetimi.test.ts`): `tenant_id` sütunlu her tabloda RLS açık/zorunlu ve politika var mı; yoksa test düşer.
- Oturum araması da firma bağlamında yapılır: çerezdeki firma kimliğiyle `withTenant` (SECURITY DEFINER işlev yok).

**Yeni firma tablosu ekleme kontrol listesi:** `tenant_id` sütunu + `(tenant_id, …)` bileşik yabancı anahtar → göçte RLS `ENABLE`/`FORCE` + `tenant_isolation` politikası → `servis_app`'e yalnızca gereken `GRANT` → servis fonksiyonları `TenantTx` alır ve sorgularda `tenant_id` filtresi → "başka firmanın kullanıcısı erişemez" testi hem uygulama hem RLS düzeyinde (`firma-izolasyonu-*.test.ts` kalıbı).

### Giriş ve oturum
- Giriş: firma kodu + kullanıcı adı + şifre. Kullanıcı satırı `SELECT … FOR UPDATE` ile kilitlenir (eşzamanlı yanlış denemeler sayacı atlatamaz). 5 yanlışta hesap 15 dk kilit; ayrıca IP başına 15 dk'da 20 başarısız deneme (bellekte; deneme baştan sayılır, başarı/pasif/dondurulmuş/sunucu hatasında `forgive`).
- Oturum çerezi `oturum` = `<tenantId>.<43 karakter belirteç>`; veritabanında belirtecin SHA-256 özeti tutulur. httpOnly, SameSite=Lax, üretimde Secure. 30 gün, kalan süre 15 günün altına inince uzar. `firma_kodu` çerezi firma kodunu hatırlar (1 yıl).
- **`proxy.ts` yalnızca iyimserdir** (çerez var mı); asıl doğrulama her korumalı sayfa ve sunucu eyleminde **`requireSession()`** ile veritabanından yapılır (istek başına `cache`). Bayat çerezde döngü olmaz: `/giris` çerezli de açılır.
- Geçici şifreli kullanıcı (`mustChangePassword`) yalnızca `/sifre-belirle`'ye girebilir. Şifre değişince/sıfırlanınca kişinin diğer oturumları kapanır; pasifleştirme tüm oturumlarını siler. Mevcut şifre denemesi kullanıcı başına 15 dk'da 5 (bellekte).

### Servis ve eylem ayrımı
- `src/server/<alan>/service.ts`: iş kuralları, `requirePermission`, Zod doğrulama, işlem geçmişi kaydı. `TenantTx` + `Actor` + `Clock` alır; Next'ten bağımsızdır, entegrasyon testleri doğrudan bunu çağırır.
- `src/app/**/actions.ts` (sunucu eylemi): `requireSession` → `actorFromSession` → `withTenant` → servis; sonucu `runAction` ile `ActionResult`'a çevirir. `AppError` Türkçe mesajı kullanıcıya gider, beklenmeyen hata genel mesaja döner ve kişisel veri içermeden loglanır.
- İstemci bileşenleri `@/server/*`'dan yalnızca **tür** alır (`import type`).

### Yetki tablosu
`src/server/permissions.ts` sunucudaki tek yetki tablosudur ve §5 "Roller ve yetkiler" tablosuyla birebir aynı olmalı. Şu an: `staff.view`, `staff.manage` (patron). Yeni parçada: tabloya `'alan.eylem': [roller]` satırı eklenir → servis başında `requirePermission(actor, '…')` → sayfada `can(role, '…')` ile `ForbiddenView` → menü `navigation.ts` → `permissions.test.ts`'e her rol için beklenti.

### İşlem geçmişi
`audit_log` (firma başına, RLS'li, `servis_app` için yalnızca ekleme ve okuma): `auth.login`, `auth.locked`, `user.created|updated|deactivated|reactivated|password_reset|password_changed`. `details` değişen alanların eski/yeni değerini taşır (ör. ad soyad); **şifre, özet, belirteç asla.** Bu, firmanın iş kaydıdır; uygulama logu (`logger`) değildir. Logger'a kişisel veri yazılmaz. Ekranı 1. aşamanın 5. parçasında.

### Tasarım sistemi
Seçilen yön **Saha** (`docs/TASARIM-SISTEMI.md`): koyu bant + sarı sinyal, Archivo (genişlik ekseni; başlıkta dar kesim `type-display`), 48 px düğme, 56 px alan. Renkler yalnızca `globals.css` token'larında (açık/koyu); kontrast ve renk kodu yasağı testli.

## 10. Test altyapısı
- **Vitest** (`vitest.config.mts`): `unit` (`tests/unit`, veritabanısız) ve `integration` (`tests/integration`, sırayla). `global-setup` test veritabanını sıfırlar ve göçleri uygular.
- `useTestDbs()` (`tests/helpers/db.ts`): `app` (servis_app, RLS'e tabi), `owner` (servis_owner), `bypass` (yalnızca test için RLS'i aşan rol; ikinci kilidi tek başına sınamaya yarar). `createFakeClock()` zamanı elle ilerletir. `fabrika.ts` deneme firma/kullanıcı üretir.
- **Playwright** (`playwright.config.ts`): `masaustu` (1280) ve `telefon` (360, yalnızca erişilebilirlik); `tests/e2e/global-setup.ts` test veritabanında `e2e-a` (Akın Servis) ve `e2e-b` (Bora Teknik) firmalarını kurar, hesaplar `tests/e2e/.hesaplar.json`'a (git dışında) yazılır.

| Dosya | Doğruladığı |
|---|---|
| `unit/identifier`, `validation`, `password-policy`, `password`, `temp-password` | Kimlik sadeleştirme, Zod Türkçe mesajları, şifre kuralları, argon2id, geçici şifre biçimi |
| `unit/oturum-cerezi`, `proxy-decision`, `navigation`, `permissions`, `rate-limit`, `request-ip` | Çerez biçimi, yönlendirme kararı, menü, yetki tablosu, deneme sınırı, istemci IP'si |
| `unit/action-result`, `audit`, `logger`, `format`, `env-dosyasi` | Hata çevirisi, geçmiş kaydı biçimi, logda kişisel veri yok, tarih biçimi, `.env` izinleri (yalnızca Linux/macOS) |
| `unit/tasarim-kontrast`, `renk-kodu-yasagi` | Tüm token çiftlerinde WCAG kontrastı, kodda doğrudan renk kodu yok |
| `integration/firma-izolasyonu-uygulama`, `firma-izolasyonu-rls`, `sema-denetimi` | İki kilit ayrı ayrı: başka firmanın satırı okunamaz/yazılamaz; yeni tablo RLS'siz eklenemez |
| `integration/giris`, `oturum`, `sifre-degistirme` | Giriş, kilit, eşzamanlı denemeler, oturum süresi/uzaması/kapanması, şifre değiştirme ve sınırı |
| `integration/personel`, `firma-yonetimi` | Personel ekleme/düzenleme/pasifleştirme/sıfırlama, son patron korunur, eşzamanlı aynı kullanıcı adı; firma açma/dondurma |
| `integration/db-ortami`, `sema` | Roller, izinler, Türkçe sıralama, şema |
| `e2e/giris`, `oturum`, `personel`, `yetki` | Akışlar (şifre belirlemeden çıkış dahil), hatanın ekran okuyucuda yeniden duyurulması, bayat çerez, pasifleştirilen kişinin düşmesi, rol ve firma ayrımı ekranda |
| `e2e/erisilebilirlik`, `ekran-goruntuleri` | WCAG 2.2 AA (açık/koyu × masaüstü/telefon), klavyeyle giriş, %200 yazıda taşma, ekran görüntüleri |

Toplam (2026-10-06): birim 131 (130 geçti, 1 yalnızca Linux/macOS'ta), entegrasyon 82/82, E2E 72/72.
Zorunlu test grupları (sonraki parçalar): firma izolasyonu, rol yetkileri, iş durumu geçişleri, para hesapları.

## 11. Bilinen sorunlar ve teknik borç
1. 🟡 **Deneme sınırları bellekte** (IP ve mevcut şifre): tek sunucuda doğru; birden çok sunucu ya da yeniden başlatmada sayaç paylaşılmaz/sıfırlanır. Çok sunucuya geçerken ortak depo (veritabanı ya da Redis).
2. 🟡 **IP varsayımı:** önümüzde tam bir ters vekil olduğu varsayılır (HTTPS için zorunlu). Araya CDN girerse herkes CDN'in IP'sini paylaşır (20 hata herkesi kilitler); vekilsiz doğrudan yayında en sağdaki değer de taklit edilebilir. Sunucu kararıyla `request-ip.ts` ayarlanır.
3. 🟡 **Tam CSP yok:** güvenlik başlıkları var (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`), Content-Security-Policy yok (Next betikleri için nonce gerekir).
4. 🟡 **Süresi dolmuş oturumlar** yalnızca o kullanıcı yeniden girerken silinir; periyodik temizlik yok.
5. 🟡 **İşlem geçmişi saklama süresi** belirlenmedi (5. parçada, KVKK ile).
6. 🟡 **Kullanıcı adı sonradan değiştirilemez** (ad, rol, sahaya çıkar değişir).
7. 🟡 **Giriş mesajları hesap hakkında bilgi verir:** kilit mesajı hesabın varlığını (tasarım §7.2 istiyor), pasif hesapta doğru şifreyle gelen "kullanıma kapalı" mesajı şifrenin doğruluğunu belli eder. Sahibin kararı bekleniyor (YAPILACAKLAR karar 4). Eşitlenirse kilitli yolun argon2 süresi de eşitlenmeli.
8. 🟡 **Argon2 işlem içinde:** girişte satır kilidi ve havuz bağlantısı (en çok 10) argon2 süresince tutulur; aynı anda çok giriş diğer istekleri kısa süre bekletebilir. Şifre değiştirme ve personel eklemede de özet işlem içinde hesaplanır. Çözüm: doğrulamayı işlem dışına almak, `lock_timeout`.
9. 🟡 **Oturum süresi:** veritabanındaki bitiş yalnızca 15 günden az kalınca uzatılıyor, çerez her istekte 30 güne çekiliyor; hiç girmeyen kullanıcı 30 değil 15-30 gün sonra düşebilir.
10. 🟡 **Şifre değiştirince mevcut oturum yenilenmiyor:** kopyalanmış bir çerez aynı oturum satırını taşıdığı için açık kalır. Çözüm: mevcut oturumu silip yenisini açmak.
11. 🟡 **IPv6 ve deneme sınırı:** IPv6 adresleri tek tek sayılıyor (/64 bloğu değil); 10 bin anahtardan sonra en eski anahtar atılıyor.
12. 🟡 **Küçük doğrulama boşlukları:** kontrol karakterli giriş bilgisi genel hataya düşer; ad uzunluğu UTF-16 birimiyle sayılır, yalnızca görünmez karakterli ad kabul edilir; yalnızca boşluktan ya da tek harf tekrarından oluşan şifre kabul edilir; aşırı uzun girdide zod'un genel sınır mesajı görünür; düzenleme formu sunucu hatasında yazılan adı unutur.
13. 🟡 **Komut satırı hataları:** `scripts/*` hata mesajını olduğu gibi yazar (Drizzle sorgu hatası ad ve şifre özeti içerebilir); logger gibi yalnızca kod ve tür yazmalı.
14. 🟡 **Üretim ortamı:** Next `.env`'i sunucu sürecine yükler; üretimde uygulamanın ortamında yalnızca `DATABASE_URL` olmalı (süper kullanıcı ve sahip şifreleri olmamalı). `__Host-` önekli çerez, `servis_app` için sütun düzeyinde UPDATE izni ve `NEXT_TELEMETRY_DISABLED=1` 5. aşamada.
15. 🟡 **Test boşlukları:** çıkışın oturum satırını silmesi test edilmiyor; iki patronun aynı anda birbirini pasifleştirmesi testi işlemleri zorla iç içe geçirmiyor; `oturum.spec` `personel.spec`'ten önce çalışmaya bağımlı.

## 12. Hesaplar ve ortam
Sırlar yalnızca `.env` dosyasında (git dışında, `db:kur` 0600 izniyle yazar); buraya yazılmaz.
- **Yerel PostgreSQL 18** (Windows hizmeti, `localhost:5432`, küme `--locale C`). Veritabanları: `servis_takip` (geliştirme), `servis_takip_test` (test). Roller: `servis_owner` (tablo sahibi), `servis_app` (uygulama, RLS'e tabi), `servis_test_bypass` (yalnızca test).
- `.env` anahtarları (değerler değil): `PG_SUPERUSER_URL`, `SERVIS_OWNER_PASSWORD`, `SERVIS_APP_PASSWORD`, `SERVIS_TEST_BYPASS_PASSWORD`, `DATABASE_URL`, `DATABASE_ADMIN_URL`, `TEST_DATABASE_URL`, `TEST_DATABASE_ADMIN_URL`, `TEST_DATABASE_BYPASS_URL`. Örnek: `.env.example`.
- Komutlar: `npm run db:kur` (roller, veritabanları, `.env`; tekrar çalıştırılabilir) · `npm run db:migrate` (geliştirme veritabanı; test veritabanını testler kendisi sıfırlayıp göç eder) · `npm run db:tohum` (deneme firmaları `deneme-a`, `deneme-b`; geçici şifreleri bir kez ekrana yazar) · `npm run firma:ac -- --kod <kod> --ad "<firma adı>" --patron-ad "<ad soyad>" --patron-kullanici <kullanıcı adı>` · `firma:dondur` / `firma:etkinlestir -- --kod …`.
- Geliştirme veritabanındaki firmalar: `komut-deneme`, `deneme-a`, `deneme-b`.
- GitHub: `https://github.com/hayrigok/servis-takip` (push sahibin onayıyla).

## 13. Öğrenilen dersler (bu proje)
- PostgreSQL EDB kurulumu Windows'ta Türkçe sistem diliyle `initdb`'de düşer ("Turkish_Türkiye.1254" ASCII değil) → küme `--locale C` ile kurulur, Türkçe davranış veritabanı düzeyinde ICU `tr-TR` ile verilir (2026-10-06).
- winget `--override` ile verilen şifre winget günlüğüne açık yazılır → kurulumdan sonra şifre `ALTER ROLE` ile yenilenir (2026-10-06).
- `vitest.config.ts` ESM uyarısı verir → `vitest.config.mts` (2026-10-06).
- Sayfa silinince `.next/types/validator.ts` eski sayfayı arar ve tsc düşer → `rm -rf .next/types` (2026-10-06).
- Planın doğrulama komutundaki örnek değerler de doğrulamadan geçmeli (2 harfli kullanıcı adı çakışma yoluna ulaşmadı) (2026-10-06).
- Giriş deneme sınırları eşzamanlı isteklerle atlatılabiliyordu (sonradan sayım, kilitsiz okuma) → sayaç baştan artar, satır `FOR UPDATE` ile kilitlenir; bu tür sınırlara eşzamanlılık testi yazılır (2026-10-06).
- Yalnızca belgenin "yatay kayma yok" testi yetmez: büyük yazıda öğeler kutusundan taşıp komşusunun üstüne binebilir → E2E'de taşan öğe ve alt menü etiketi denetimi var (2026-10-06).
