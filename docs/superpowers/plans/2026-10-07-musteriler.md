# 1. aşama, 2. parça: Müşteriler — Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Operatörün müşteriyi saniyeler içinde bulması ya da kaydetmesi: müşteri, telefonlar, adresler (il/ilçe listesi, konum iğnesi), cihazlar, not; Türkçe arama ve "konumu eksik" süzgeci; çift numara uyarısı; eşzamanlı düzenleme koruması; kendi sunucumuzdan Türkiye haritasıyla konum seçici, adres bulma ve konum bağlantısı okuma.

**Architecture:** Temel parçanın kalıbı aynen sürer: iş kuralları `src/server/customers/*` altında `TenantTx` + `Actor` + `Clock` alan saf servislerdir, sunucu eylemleri ve sayfalar ince sarmalayıcıdır, her firma tablosu çift kilitlidir (uygulama filtresi + RLS). Arama `customers.search_text` sütununda (Türkçe sadeleştirilmiş metin, `pg_trgm` GIN dizini) yapılır ve her değişiklikte aynı işlemde yeniden yazılır. Harita iki yarıda gelir: önce haritasız kayıt ve arama biter, sonra Protomaps Türkiye kesiti (`.pmtiles`) bizim rota işleyicimizden parça parça sunulur, tarayıcıda MapLibre ile çizilir; tarayıcı hiçbir dış servise bağlanmaz.

**Tech Stack:** Next.js 16.3 (App Router), React 19.2, TypeScript 6.0 strict, PostgreSQL 18.6 + Drizzle 0.45 (`pg`), `pg_trgm`, Zod 4, Tailwind 4, radix-ui, lucide-react, Vitest 5, Playwright + axe. Yeni: `maplibre-gl` 6.13 (BSD-3, yalnızca ESM, WebGL2 ister), `pmtiles` 4.5 (BSD-3), `@protomaps/basemaps` 5.7 (BSD-3), go-pmtiles 1.31.2 komut satırı aracı (BSD-3, yalnızca indirme betiğinde, git dışında).

**Spec:** [docs/superpowers/specs/2026-10-07-musteriler-design.md](../specs/2026-10-07-musteriler-design.md) (sahip onayladı, 2026-10-07)

## Görevler (özet)

🧭 senin onayını bekleyen durak · 👤 senin denemen. Birinci yarı (1-14) haritasız müşteri kaydı ve aramadır, tek başına kullanılabilir; ikinci yarı (15-22) harita ve konumdur.

1. Saf yardımcılar — telefon, arama sadeleştirme, cihaz türleri
2. İl ve ilçe listesi
3. Şema, göçler ve ikinci kilit
4. Yetki, menü ve işlem geçmişinin genelleştirilmesi
5. Müşteri servisi (ad, not, telefonlar, çift numara, sürüm)
6. Adres ve cihaz servisi
7. Arama ve liste servisi
8. Firma izolasyonu (1. kilit) ve teknisyen engeli
9. Ekran önizlemesi (sahibin onayı) 🧭
10. Müşteri listesi ve arama ekranı
11. Yeni müşteri ekranı (telefon listesi, çift numara uyarısı, isteğe bağlı ilk adres)
12. Müşteri sayfası ve düzenleme (sürüm çakışmasında güncel kayıt)
13. Adres ve cihaz ekranları
14. Deneme verisi, birinci yarının E2E testleri ve sahibin denemesi 👤
15. Harita parçası sunumu (PMTiles dosyası → `/harita/parca/...`)
16. Konum bağlantısı ve koordinat okuma
17. Adres bulma (Nominatim) ve konum eylemleri
18. Harita renkleri ve stili
19. Türkiye haritasını indirme 🧭
20. Konum seçici ekranı
21. İkinci yarının E2E testleri (konum seçici, harita parçası)
22. Kapanış — doğrulama, inceleme, belgeler

## Global Constraints

- **Çift kilit:** Dört yeni tablonun (`customers`, `customer_phones`, `customer_addresses`, `customer_devices`) hepsinde `tenant_id`, `ENABLE` + `FORCE ROW LEVEL SECURITY`, `tenant_isolation` politikası birebir `"tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid` (USING ve WITH CHECK). Her servis sorgusunda `eq(<tablo>.tenantId, actor.tenantId)`.
- **`servis_app` izinleri:** `customers` → `SELECT, INSERT, UPDATE` (DELETE yok, silme 5. parçada); diğer üçü → `SELECT, INSERT, UPDATE, DELETE`.
- **Bileşik anahtarlar:** alt tablolar `(tenant_id, customer_id)` → `customers (tenant_id, id)` `ON DELETE CASCADE`; cihaz `(tenant_id, customer_id, address_id)` → `customer_addresses (tenant_id, customer_id, id)` `ON DELETE SET NULL ("address_id")`; `created_by`, `updated_by`, `location_set_by` → `users (tenant_id, id)`.
- **Sınırlar ve uzunluklar:** ad 1-120; not ≤ 2000; telefon etiketi ≤ 40; adres etiketi ≤ 40; mahalle ≤ 80; açık adres 1-250; tarif ≤ 250; marka/model/seri no ≤ 60; "Diğer" tür adı ≤ 40; cihaz notu ≤ 500. Müşteri başına en çok 10 telefon, 50 adres, 200 cihaz.
- **Telefon:** E.164, CHECK `^\+[1-9][0-9]{7,14}$`. Türkiye numarası `+90` + 10 hane, ilk hane 2, 3, 4, 5 ya da 8. Gösterim `0532 123 45 67`; yabancı numara olduğu gibi (`+49…`).
- **Arama:** 2-100 karakter, sayfa başına 50, yazarken ~300 ms gecikme, metin adres çubuğunda `?q=`, süzgeç `?konum=eksik`.
- **Eşzamanlı düzenleme mesajı:** "Bu kayıt siz düzenlerken değişti. Güncel hâlini gösterdik; değişikliğinizi yeniden yapın."
- **İşlem geçmişi:** müşteri eylemlerinde `details` yalnızca `fields`, `addressId`, `deviceId`, `locationChanged`, `locationSource` anahtarlarını taşır; **değer yazılmaz** (ad, telefon, adres, not, seri no, koordinat).
- **Harita parçası:** `GET /harita/parca/<sürüm>/<z>/<x>/<y>`; oturum denetimi 60 sn bellek önbelleğiyle; oturumsuz 401, geçersiz `z/x/y` 400, olmayan parça 204; `Cache-Control: private, max-age=604800`; parça istekleri loga yazılmaz.
- **Adres bulma (Nominatim):** sunucu eylemi, yalnızca düğmeyle; tüm sunucu için saniyede en çok 1 istek, 24 saat önbellek (en çok 1000 kayıt), kişi başına dakikada 10, zaman aşımı 5 sn, `countrycodes=tr`, `accept-language=tr`, en çok 5 sonuç; giden yalnızca adres metni; `GEOCODER_URL` boşsa özellik kapalı.
- **Kısa bağlantı:** yalnızca `https://maps.app.goo.gl/…` ve `https://goo.gl/maps/…`; tek istek, `redirect: 'manual'`, yalnızca `Location` başlığı okunur; zaman aşımı 5 sn; kişi başına dakikada 10.
- **Tarayıcı dış servise bağlanmaz:** harita parçası, yazı tipi, simge ve MapLibre çizim işçisi (`worker`) bizim sunucumuzdan.
- **KVKK:** loga ad, telefon, adres, koordinat, arama metni, bağlantı, parça adresi yazılmaz. Not alanı ipucu: "Sağlık, din gibi hassas kişisel bilgiler yazmayın."
- **Arayüz:** Türkçe, "siz" dili (`turkce-arayuz-metni` skill'i). Renkler yalnızca `src/app/globals.css` token'larında (`--map-*` dahil); dokunma hedefi ≥ 44 px (projede 48 px düğme, 56 px alan); metin kontrastı ≥ 4,5:1, arayüz parçası ≥ 3:1; bilgi yalnızca renkle verilmez.
- **Ekran kodu, Görev 9'daki önizlemeyi sahip onaylamadan yazılmaz.** Onaylanan düzen bu plandaki JSX'ten farklıysa JSX ona göre uyarlanır; davranış, metinler ve testler değişmez.
- `drizzle-kit push` kullanılmaz. Şema değişikliği yalnızca göç dosyasıyla; `sql.raw` firma bağlamında kullanılmaz.
- `console.*` yalnızca `src/server/logger.ts`, `scripts/**`, `tests/**` içinde.
- Görünmez tarayıcı (Playwright) her çalıştırmadan önce sahibe sorulur. Program/araç kurmadan önce sahibe sorulur. Push yalnızca sahibin açık onayıyla.
- Komutlar Windows'ta Git Bash'te çalışır (proje kökü `D:\Projelerim\Servis-Takip`).

## Review Focus

1. **WhatsApp'tan ya da rehberden kopyalanan numara:** Başında/sonunda görünmez yön işaretleri (U+202A/U+202C), bölünmez boşluk (U+00A0) ya da sıfır genişlikli karakter olan "‪+90 532 123 45 67‬" → doğru numara olarak kaydedilmeli, "geçersiz" denmemeli. Test: Görev 1 `phone.test.ts` "görünmez işaretleri yok sayar".
2. **Kaydet'e çift dokunma:** Yavaş telefonda aynı numarayla eşzamanlı iki "Müşteriyi kaydet" isteği → yalnızca bir müşteri açılmalı, ikincisi çift numara uyarısı almalı. Test: Görev 5 "eşzamanlı iki kayıt".
3. **WhatsApp konum mesajı ve ters koordinat:** "Konumum: https://maps.app.goo.gl/AbC 📍" gibi metnin içindeki bağlantı bulunmalı; "28.9784, 41.0082" gibi ters yazılmış koordinatta "Türkiye dışında" uyarısıyla birlikte "yer değiştirmiş olabilir" ipucu çıkmalı. Test: Görev 16 `location-link.test.ts`.
4. **Açık cihaz formu, kaldırılmış adres:** Bir operatör cihaz formunu açıkken diğeri o adresi kaldırır; cihaz kaydı Türkçe alan hatası vermeli ("Seçilen adres artık yok…"), 500 hatası olmamalı. Test: Görev 6 "kaldırılmış adresle cihaz".
5. **Arama kutusunda özel karakter:** `%`, `_`, kesme işareti ve Türkçe büyük harf ("AYŞE'NİN", "%") joker gibi davranmamalı, hata vermemeli; `%` tek başına "en az 2 harf ya da rakam" uyarısı almalı. Test: Görev 7 "özel karakterler joker değildir".

---

## Dosya haritası

| Dosya | Sorumluluk |
|---|---|
| `src/lib/phone.ts` | Telefon ayrıştırma (E.164), gösterim, ulusal rakamlar |
| `src/lib/search.ts` | `foldSearch`, telefon araması rakamları, arama girdisi çözümlemesi, `search_text` üretimi |
| `src/lib/identifier.ts` | (değişir) Türkçe harf sadeleştirme `foldTurkish` olarak ayrılır |
| `src/lib/device-types.ts` | Cihaz türü listesi ve etiketleri |
| `src/lib/geo.ts` | Türkiye sınır kutusu, merkez, konum kaynağı türleri, `PickedLocation` |
| `src/lib/tr-il-ilce.ts`, `src/lib/tr-il-ilce-veri.ts` | İl/ilçe türleri ve aramaları; üretilmiş veri (OSM, ODbL) |
| `src/lib/address-format.ts` | "Caferağa, Kadıköy / İstanbul" gösterimi |
| `src/lib/format.ts` | (değişir) `formatDate` (yalnızca tarih) |
| `src/lib/location-link.ts` | Konum bağlantısı ve koordinat ayrıştırıcı (tarayıcı + sunucu) |
| `src/lib/map-assets.ts` | Yazı tipi yığınları, harita dosya yolları |
| `src/server/db/schema.ts` | (değişir) Dört müşteri tablosu |
| `drizzle/0002_musteriler.sql` | Üretilmiş: tablolar, kısıtlar, dizinler |
| `drizzle/0003_musteriler_rls.sql` | Elle: `pg_trgm`, arama dizini, cihaz → adres bağı, RLS, izinler |
| `src/server/errors.ts` | (değişir) `stale` hata türü |
| `src/server/validation.ts` | (değişir) iç içe alan hatası anahtarı (`phones.0.number`) |
| `src/server/audit/audit.ts` | (değişir) Genel hedef `{ type, id }`, müşteri ayrıntısı denetimi |
| `src/server/permissions.ts`, `navigation.ts` | (değişir) `customer.view`, `customer.manage`, menü |
| `src/server/customers/common.ts` | Sınırlar, metin alanları, müşteri kilidi, arama metni yenileme |
| `src/server/customers/address-input.ts` | Adres doğrulaması (il/ilçe listesi), konum sütunları, adres ekleme |
| `src/server/customers/service.ts` | Müşteri ekleme/okuma/düzenleme, telefonlar, çift numara |
| `src/server/customers/addresses.ts` | Adres ekleme/düzenleme/kaldırma, son kullanılan il |
| `src/server/customers/devices.ts` | Cihaz ekleme/düzenleme/kaldırma |
| `src/server/customers/search.ts` | Liste (sayfalı) ve arama |
| `src/server/geo/tile-source.ts` | PMTiles dosya kaynağı (diskten bayt okuma) |
| `src/server/geo/tiles.ts` | Harita dosyası, oturum önbelleği, parça yanıtı |
| `src/server/geo/short-link.ts` | Kısa Google bağlantısı açma |
| `src/server/geo/geocoder.ts` | Adres bulma: sıra, önbellek, ayar |
| `src/server/geo/limits.ts` | Kişi başına dakikalık sınırlar |
| `src/app/harita/parca/[surum]/[z]/[x]/[y]/route.ts` | Harita parçası rota işleyicisi |
| `src/app/(uygulama)/musteriler/**` | Ekranlar, sunucu eylemleri, form bileşenleri |
| `src/components/ui/text-area-field.tsx` | Çok satırlı alan |
| `src/components/map/map-style.ts` | MapLibre stili (basemaps + `--map-*` token'ları) |
| `src/components/map/map-canvas.tsx` | MapLibre'yi dinamik yükleyen harita |
| `src/components/map/location-picker.tsx` | Konum seçici penceresi |
| `src/components/nav-links.tsx`, `src/lib/proxy-decision.ts` | (değişir) Menü simgesi; harita yollarında çerez yenilenmez |
| `scripts/il-ilce-uret.ts` | İl/ilçe veri dosyasını OSM'den üretir (bir kez) |
| `scripts/harita-indir.ts` | Türkiye kesiti, yazı tipi ve simgeler |
| `scripts/maplibre-worker.ts` | MapLibre işçi dosyalarını `public/maplibre/`'ye kopyalar |
| `scripts/tohum.ts` | (değişir) Deneme müşterileri |
| `tests/helpers/fabrika.ts` | (değişir) `seedCustomer` |
| `tests/helpers/pmtiles.ts` | Testler için küçük PMTiles dosyası yazar |
| `tests/unit/*`, `tests/integration/*`, `tests/e2e/*` | Görevlerde ayrı ayrı |

Git dışı yeni klasörler: `/araclar/` (pmtiles aracı), `/harita/` (Türkiye dosyası), `/public/harita/` (yazı tipi, simge), `/public/maplibre/` (işçi dosyaları), `/tests/e2e/.harita/` (E2E deneme haritası).

**Uygulama sırası:** Birinci yarı (Görev 1-14) haritasız müşteri kaydı ve aramadır; Görev 14'ün sonunda sahip ekranları dener. İkinci yarı (Görev 15-22) haritadır. Görev 15-19 sahibin denemesini beklemeden yürüyebilir; Görev 20 (konum seçici ekranı) sahibin birinci yarı geri bildiriminden sonra başlar.

---

## BİRİNCİ YARI: Müşteri kaydı ve arama (haritasız)

### Görev 1: Saf yardımcılar — telefon, arama sadeleştirme, cihaz türleri

**Files:**
- Modify: `src/lib/identifier.ts`
- Create: `src/lib/phone.ts`, `src/lib/search.ts`, `src/lib/device-types.ts`
- Test: `tests/unit/phone.test.ts`, `tests/unit/search.test.ts`, `tests/unit/device-types.test.ts`

**Interfaces:**
- Consumes: `TURKISH_FOLD` eşlemesi (`src/lib/identifier.ts`)
- Produces:
  - `foldTurkish(input: string): string` — Türkçe harfleri ASCII'ye indirip küçük harf yapar (kırpmaz). `foldIdentifier(input) === foldTurkish(input.trim())`.
  - `E164_PATTERN: RegExp`, `PHONE_MESSAGES: { empty; needsAreaCode; invalid }`, `type PhoneParseResult = { ok: true; e164: string } | { ok: false; message: string }`, `cleanPhoneInput(raw: string): string`, `parsePhone(raw: string): PhoneParseResult`, `formatPhone(e164: string): string`, `nationalDigits(e164: string): string | null`
  - `SEARCH_MIN_LENGTH = 2`, `SEARCH_MAX_LENGTH = 100`, `foldSearch(input: string): string`, `phoneQueryDigits(input: string): string | null`, `type SearchQuery`, `analyzeSearch(input: string): SearchQuery`, `interface SearchableAddress`, `buildSearchText(name, numbers, addresses): string`
  - `DEVICE_TYPES`, `type DeviceType`, `DEVICE_TYPE_VALUES: [DeviceType, ...DeviceType[]]`, `deviceTypeLabel(type: DeviceType, typeOther: string | null): string`

- [ ] **Adım 1: Telefon testini yaz**

`tests/unit/phone.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PHONE_MESSAGES, formatPhone, nationalDigits, parsePhone } from '@/lib/phone';

describe('parsePhone: Türkiye numaraları', () => {
  it.each([
    ['0532 123 45 67', '+905321234567'],
    ['05321234567', '+905321234567'],
    ['532-123-4567', '+905321234567'],
    ['(0532) 123 45 67', '+905321234567'],
    ['+90 532 123 45 67', '+905321234567'],
    ['+90 (532) 123-45-67', '+905321234567'],
    ['0090 532 123 45 67', '+905321234567'],
    ['905321234567', '+905321234567'],
    ['+90 0532 123 45 67', '+905321234567'],
    ['0212 123 45 67', '+902121234567'],
    ['0850 123 45 67', '+908501234567'],
    ['0 (312) 444 55 66', '+903124445566'],
  ])('%s → %s', (input, e164) => {
    expect(parsePhone(input)).toEqual({ ok: true, e164 });
  });

  it('WhatsApp ve rehberden kopyalanan görünmez işaretleri ve bölünmez boşluğu yok sayar', () => {
    expect(parsePhone('\u202a+90 532 123 45 67\u202c')).toEqual({ ok: true, e164: '+905321234567' });
    expect(parsePhone('0532\u00a0123\u00a045\u00a067')).toEqual({ ok: true, e164: '+905321234567' });
    expect(parsePhone('\u200e0532 123 45 67\ufeff')).toEqual({ ok: true, e164: '+905321234567' });
  });

  it('7 haneli numarada alan kodu ister', () => {
    expect(parsePhone('123 45 67')).toEqual({ ok: false, message: PHONE_MESSAGES.needsAreaCode });
    expect(parsePhone('1234567')).toEqual({ ok: false, message: PHONE_MESSAGES.needsAreaCode });
  });

  it.each(['', '   ', '\u202a\u202c'])('boş girdide numara ister: %j', (input) => {
    expect(parsePhone(input)).toEqual({ ok: false, message: PHONE_MESSAGES.empty });
  });

  it.each([
    '0632 123 45 67',
    '0132 123 45 67',
    '0532 123 45',
    '0532 123 45 678',
    'abc',
    '0532 ABC 45 67',
    '+',
    '12',
    '+90 532 123',
  ])('geçersiz: %s', (input) => {
    expect(parsePhone(input)).toEqual({ ok: false, message: PHONE_MESSAGES.invalid });
  });
});

describe('parsePhone: yabancı numaralar', () => {
  it.each([
    ['+49 30 1234567', '+49301234567'],
    ['0049 30 1234567', '+49301234567'],
    ['+1 (202) 555-0143', '+12025550143'],
  ])('%s → %s', (input, e164) => {
    expect(parsePhone(input)).toEqual({ ok: true, e164 });
  });

  it.each(['+0 123 456 789', '+49 123', '+1234567890123456'])('geçersiz: %s', (input) => {
    expect(parsePhone(input)).toEqual({ ok: false, message: PHONE_MESSAGES.invalid });
  });
});

describe('formatPhone ve nationalDigits', () => {
  it('Türkiye numarasını 0532 123 45 67 biçiminde gösterir', () => {
    expect(formatPhone('+905321234567')).toBe('0532 123 45 67');
    expect(formatPhone('+908501234567')).toBe('0850 123 45 67');
  });
  it('yabancı numarayı olduğu gibi gösterir', () => {
    expect(formatPhone('+49301234567')).toBe('+49301234567');
  });
  it('ulusal rakamlar yalnızca Türkiye numarasında', () => {
    expect(nationalDigits('+905321234567')).toBe('05321234567');
    expect(nationalDigits('+49301234567')).toBeNull();
  });
});
```

> Kaçış dizileri (`\u202a` vb.) dosyaya yazılırken gerçek karaktere dönüşebilir (kişisel standart, 2026-10-06 dersi). Dönüşse de test aynı şeyi sınar; yazdıktan sonra `grep -c 'u202a' tests/unit/phone.test.ts` ile kaçışın durduğunu görmek yeterli.

- [ ] **Adım 2: Kırmızıyı gör**

Run: `npx vitest run --project unit tests/unit/phone.test.ts`
Expected: FAIL, `Failed to resolve import "@/lib/phone"`.

- [ ] **Adım 3: `src/lib/phone.ts`**

```ts
/** Veritabanındaki CHECK ile aynı: "+" ve 8-15 rakam, ilk rakam 0 olamaz. */
export const E164_PATTERN = /^\+[1-9][0-9]{7,14}$/;

export const PHONE_MESSAGES = {
  empty: 'Telefon numarasını yazın.',
  needsAreaCode: 'Alan koduyla yazın, örneğin 0212 123 45 67.',
  invalid: 'Geçerli bir telefon numarası yazın, örneğin 0532 123 45 67.',
} as const;

export type PhoneParseResult = { ok: true; e164: string } | { ok: false; message: string };

// Yön işaretleri (WhatsApp'tan kopyalanan numaralarda U+202A/U+202C), sıfır genişlikli karakterler, BOM.
const INVISIBLE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/g;
const ALLOWED = /^\+?[0-9\s().\/-]+$/;

/** Görünmez işaretleri atar, bölünmez boşluğu boşluğa çevirir, kırpar. */
export function cleanPhoneInput(raw: string): string {
  return raw.replace(INVISIBLE, '').replace(/\u00A0/g, ' ').trim();
}

function turkish(rest: string): PhoneParseResult {
  // "+90 0532 …": ulusal öndeki 0 da yazılmış olabilir.
  const digits = rest.length === 11 && rest.startsWith('0') ? rest.slice(1) : rest;
  return /^[23458][0-9]{9}$/.test(digits)
    ? { ok: true, e164: `+90${digits}` }
    : { ok: false, message: PHONE_MESSAGES.invalid };
}

/**
 * Kullanıcının yazdığı numarayı E.164'e çevirir. Türkiye numarası "+90" + 10 hane (ilk hane 2, 3, 4, 5 ya da 8);
 * "+" ya da "00" ile başlayan yabancı numara 8-15 hane.
 */
export function parsePhone(raw: string): PhoneParseResult {
  const cleaned = cleanPhoneInput(raw);
  if (cleaned === '') return { ok: false, message: PHONE_MESSAGES.empty };
  if (!ALLOWED.test(cleaned)) return { ok: false, message: PHONE_MESSAGES.invalid };
  let digits = cleaned.replace(/\D/g, '');
  let international = cleaned.startsWith('+');
  if (!international && digits.startsWith('00')) {
    international = true;
    digits = digits.slice(2);
  }
  if (international) {
    if (digits.startsWith('90')) return turkish(digits.slice(2));
    return /^[1-9][0-9]{7,14}$/.test(digits)
      ? { ok: true, e164: `+${digits}` }
      : { ok: false, message: PHONE_MESSAGES.invalid };
  }
  if (digits.length === 12 && digits.startsWith('90')) return turkish(digits.slice(2));
  const local = digits.startsWith('0') ? digits.slice(1) : digits;
  if (local.length === 7) return { ok: false, message: PHONE_MESSAGES.needsAreaCode };
  return turkish(local);
}

/** Türkiye numarası "0532 123 45 67"; yabancı numara olduğu gibi. */
export function formatPhone(e164: string): string {
  const m = /^\+90([0-9]{3})([0-9]{3})([0-9]{2})([0-9]{2})$/.exec(e164);
  return m ? `0${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}

/** Türkiye numarasının ulusal yazımı ("05321234567"); yabancı numarada null. Arama metninde kullanılır. */
export function nationalDigits(e164: string): string | null {
  return /^\+90[0-9]{10}$/.test(e164) ? `0${e164.slice(3)}` : null;
}
```

- [ ] **Adım 4: Yeşili gör**

Run: `npx vitest run --project unit tests/unit/phone.test.ts`
Expected: PASS (bütün satırlar).

- [ ] **Adım 5: Arama ve cihaz türü testlerini yaz**

`tests/unit/search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { analyzeSearch, buildSearchText, foldSearch, phoneQueryDigits } from '@/lib/search';

describe('foldSearch', () => {
  it.each([
    ['Şükrü', 'sukru'],
    ['sukru', 'sukru'],
    ['Işık', 'isik'],
    ['ISIK', 'isik'],
    ['İsmail', 'ismail'],
    ['Kâmil Ağaoğlu', 'kamil agaoglu'],
    ["AYŞE'NİN", 'ayse nin'],
    ['Dr. Ali  Veli', 'dr ali veli'],
    ['%_\\', ''],
    ['Çağrı-Öz', 'cagri oz'],
  ])('%s → %s', (input, output) => {
    expect(foldSearch(input)).toBe(output);
  });
});

describe('phoneQueryDigits', () => {
  it.each([
    ['0532 123', '532123'],
    ['+90 532', '90532'],
    ['0090 532 123 45 67', '5321234567'],
    ['905321234567', '5321234567'],
    ['(0532) 123-45', '53212345'],
    ['532', '532'],
  ])('%s → %s', (input, digits) => {
    expect(phoneQueryDigits(input)).toBe(digits);
  });

  it.each(['Ali', '0532 Ali', '0', '05', ''])('telefon araması değil: %j', (input) => {
    expect(phoneQueryDigits(input)).toBeNull();
  });
});

describe('analyzeSearch', () => {
  it('boş, kısa ve uzun girdiyi ayırır', () => {
    expect(analyzeSearch('   ')).toEqual({ kind: 'empty' });
    expect(analyzeSearch('a')).toEqual({ kind: 'too_short' });
    expect(analyzeSearch('%')).toEqual({ kind: 'too_short' });
    expect(analyzeSearch('a'.repeat(101))).toEqual({ kind: 'too_long' });
  });
  it('telefona benzeyen girdi rakamlarla aranır', () => {
    expect(analyzeSearch('0532 123')).toEqual({ kind: 'phone', digits: '532123', folded: '0532 123' });
  });
  it('metin kelimelere bölünür', () => {
    expect(analyzeSearch("  Ayşe'nin Evi ")).toEqual({
      kind: 'text',
      folded: 'ayse nin evi',
      tokens: ['ayse', 'nin', 'evi'],
    });
  });
});

describe('buildSearchText', () => {
  it('ad başta, telefonun ulusal ve uluslararası rakamları, sadeleştirilmiş adres', () => {
    expect(
      buildSearchText(
        'Şükrü Işık',
        ['+905321234567', '+49301234567'],
        [
          {
            province: 'İstanbul',
            district: 'Kadıköy',
            neighborhood: 'Caferağa Mah.',
            addressLine: 'Moda Cad. No: 5/3',
          },
        ],
      ),
    ).toBe(
      'sukru isik 05321234567 905321234567 49301234567 istanbul kadikoy caferaga mah moda cad no 5 3',
    );
  });
});
```

`tests/unit/device-types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEVICE_TYPES, DEVICE_TYPE_VALUES, deviceTypeLabel } from '@/lib/device-types';

describe('cihaz türleri', () => {
  it('13 tür, anahtarlar benzersiz, "Diğer" en sonda', () => {
    expect(DEVICE_TYPES).toHaveLength(13);
    expect(new Set(DEVICE_TYPE_VALUES).size).toBe(13);
    expect(DEVICE_TYPE_VALUES.at(-1)).toBe('other');
  });
  it('etiket: listedeki tür ve "Diğer" için yazılan ad', () => {
    expect(deviceTypeLabel('combi_boiler', null)).toBe('Kombi');
    expect(deviceTypeLabel('other', 'Şömine')).toBe('Şömine');
    expect(deviceTypeLabel('other', null)).toBe('Diğer');
  });
});
```

- [ ] **Adım 6: Kırmızıyı gör**

Run: `npx vitest run --project unit tests/unit/search.test.ts tests/unit/device-types.test.ts`
Expected: FAIL, modüller yok.

- [ ] **Adım 7: `foldTurkish`'i ayır**

`src/lib/identifier.ts` içinde `foldIdentifier`'ı şununla değiştir (davranış aynı; mevcut `identifier.test.ts` bunu sınar):

```ts
/** Türkçe harfleri ASCII karşılığına indirir ve küçük harfe çevirir: "İsmail", "Ismail", "ısmail" → "ismail". Kırpmaz. */
export function foldTurkish(input: string): string {
  return input
    .normalize('NFC')
    .replace(/[İIıŞşĞğÜüÖöÇç]/g, (ch) => TURKISH_FOLD[ch] ?? ch)
    .toLowerCase()
    .replace(/\u0307/g, '');
}

/**
 * Firma kodunu ve kullanıcı adını tek biçime getirir: "İsmail", "Ismail", "ısmail" → "ismail".
 * Telefon klavyesinin büyük harfle başlatması ya da Türkçe/İngilizce klavye farkı girişi bozmasın diye.
 */
export function foldIdentifier(input: string): string {
  return foldTurkish(input.trim());
}
```

- [ ] **Adım 8: `src/lib/search.ts`**

```ts
import { foldTurkish } from './identifier';
import { cleanPhoneInput, nationalDigits } from './phone';

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 100;

/**
 * Arama için tek biçim: Türkçe harfler ASCII'ye, aksanlar atılır (â → a), harf ve rakam dışındaki her şey boşluk olur.
 * "Şükrü'nün" → "sukru nun". % ve _ da boşluğa döner: LIKE kalıbında joker olamazlar.
 */
export function foldSearch(input: string): string {
  return foldTurkish(input)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const PHONE_QUERY = /^\+?[0-9\s().\/-]+$/;

/** Girdi telefona benziyorsa (rakam, boşluk, + - ( ) . /) aranacak rakamlar; baştaki 00/90/0 farkı atılır. Değilse null. */
export function phoneQueryDigits(input: string): string | null {
  const cleaned = cleanPhoneInput(input);
  if (!PHONE_QUERY.test(cleaned)) return null;
  let digits = cleaned.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('90') && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.length >= SEARCH_MIN_LENGTH ? digits : null;
}

export type SearchQuery =
  | { kind: 'empty' }
  | { kind: 'too_short' }
  | { kind: 'too_long' }
  | { kind: 'phone'; digits: string; folded: string }
  | { kind: 'text'; folded: string; tokens: string[] };

/** Arama kutusundaki metni sınıflandırır; sayfa ve servis aynı kararı verir. */
export function analyzeSearch(input: string): SearchQuery {
  const trimmed = input.trim();
  if (trimmed === '') return { kind: 'empty' };
  if (trimmed.length > SEARCH_MAX_LENGTH) return { kind: 'too_long' };
  const folded = foldSearch(trimmed);
  const digits = phoneQueryDigits(trimmed);
  if (digits) return { kind: 'phone', digits, folded };
  if (folded.length < SEARCH_MIN_LENGTH) return { kind: 'too_short' };
  return { kind: 'text', folded, tokens: folded.split(' ') };
}

export interface SearchableAddress {
  province: string;
  district: string;
  neighborhood: string | null;
  addressLine: string;
}

/** customers.search_text: ad başta (ad başı eşleşmesi sıralamada öne çıkar), sonra telefonlar ve adresler. */
export function buildSearchText(
  name: string,
  numbers: readonly string[],
  addresses: readonly SearchableAddress[],
): string {
  const parts = [foldSearch(name)];
  for (const number of numbers) {
    const national = nationalDigits(number);
    if (national) parts.push(national);
    parts.push(number.slice(1));
  }
  for (const a of addresses) {
    parts.push(foldSearch(`${a.province} ${a.district} ${a.neighborhood ?? ''} ${a.addressLine}`));
  }
  return parts.filter(Boolean).join(' ');
}
```

- [ ] **Adım 9: `src/lib/device-types.ts`**

```ts
/** Cihaz türleri (anahtar → etiket). Anahtar veritabanında saklanır; yeni tür yalnızca göçle eklenir (CHECK kısıtı). */
export const DEVICE_TYPES = [
  { value: 'combi_boiler', label: 'Kombi' },
  { value: 'air_conditioner', label: 'Klima' },
  { value: 'instant_water_heater', label: 'Şofben' },
  { value: 'storage_water_heater', label: 'Termosifon' },
  { value: 'refrigerator', label: 'Buzdolabı' },
  { value: 'washing_machine', label: 'Çamaşır makinesi' },
  { value: 'dryer', label: 'Kurutma makinesi' },
  { value: 'dishwasher', label: 'Bulaşık makinesi' },
  { value: 'oven_stove', label: 'Fırın / ocak' },
  { value: 'range_hood', label: 'Aspiratör / davlumbaz' },
  { value: 'water_purifier', label: 'Su arıtma' },
  { value: 'television', label: 'Televizyon' },
  { value: 'other', label: 'Diğer (yazın)' },
] as const;

export type DeviceType = (typeof DEVICE_TYPES)[number]['value'];

export const DEVICE_TYPE_VALUES = DEVICE_TYPES.map((t) => t.value) as [DeviceType, ...DeviceType[]];

/** Ekranda gösterilecek tür adı: "Diğer" seçildiyse yazılan ad. */
export function deviceTypeLabel(type: DeviceType, typeOther: string | null): string {
  if (type === 'other') return typeOther ?? 'Diğer';
  return DEVICE_TYPES.find((t) => t.value === type)?.label ?? type;
}
```

- [ ] **Adım 10: Yeşili gör**

Run: `npx vitest run --project unit tests/unit/phone.test.ts tests/unit/search.test.ts tests/unit/device-types.test.ts tests/unit/identifier.test.ts`
Expected: PASS. `identifier.test.ts` de geçmeli (`foldIdentifier` davranışı değişmedi).

- [ ] **Adım 11: Commit**

```bash
npm run format && npm run lint && npm run typecheck
git add src/lib/identifier.ts src/lib/phone.ts src/lib/search.ts src/lib/device-types.ts tests/unit/phone.test.ts tests/unit/search.test.ts tests/unit/device-types.test.ts
git commit -m "Müşteriler: telefon, arama sadeleştirme ve cihaz türü yardımcıları"
```

---

### Görev 2: İl ve ilçe listesi

**Files:**
- Create: `src/lib/geo.ts`, `src/lib/tr-il-ilce.ts`, `scripts/il-ilce-uret.ts`
- Create (üretilir): `src/lib/tr-il-ilce-veri.ts`
- Test: `tests/unit/tr-il-ilce.test.ts`, `tests/unit/geo.test.ts`

**Interfaces:**
- Produces:
  - `src/lib/geo.ts`: `interface GeoPoint { lat: number; lng: number }`, `TURKEY_BBOX = { minLng: 25.5, minLat: 35.7, maxLng: 45.0, maxLat: 42.2 }`, `TURKEY_CENTER: GeoPoint`, `isInTurkey(p: GeoPoint): boolean`, `LOCATION_SOURCES = ['geocode', 'manual', 'link'] as const`, `type LocationSource`, `interface PickedLocation { latitude: number; longitude: number; source: LocationSource }`
  - `src/lib/tr-il-ilce.ts`: `interface District extends GeoPoint { name: string }`, `interface Province extends GeoPoint { name: string; districts: readonly District[] }`, `PROVINCES: readonly Province[]`, `findProvince(name: string): Province | undefined`, `findDistrict(province: string, district: string): District | undefined`

> Kaynak kararı (spec §8.7, §18): **OpenStreetMap** (ODbL). Harita da OSM verisi olduğu için atıf zaten var; veri dosyası ODbL ile lisanslıdır ve dosya başında yazar. Wikidata (CC0) 2026-10-07'de denendi: 1052 "ilçe" kaydı (kapanmış ilçeler, yinelenen koordinatlar) çıktı, ayıklaması daha zor. Overpass o gün meşguldü (504); betik iki sunucuyu dener.

- [ ] **Adım 1: Testleri yaz**

`tests/unit/geo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isInTurkey } from '@/lib/geo';

describe('Türkiye sınır kutusu', () => {
  it.each([
    [41.0082, 28.9784],
    [36.2, 36.16],
    [39.92, 44.04],
    [40.17, 25.84],
  ])('içeride: %f, %f', (lat, lng) => expect(isInTurkey({ lat, lng })).toBe(true));
  it.each([
    [48.8584, 2.2945],
    [28.9784, 41.0082],
    [35.0, 33.0],
  ])('dışarıda: %f, %f', (lat, lng) => expect(isInTurkey({ lat, lng })).toBe(false));
});
```

> `35.0, 33.0` (Kıbrıs'ın güneyi) kutunun altında kalır (minLat 35.7). Kuzey Kıbrıs kutunun dışındadır; orada müşteri olursa "Türkiye dışında" uyarısı çıkar ve "Yine de kullan" ile kaydedilir. Bu bilinçli bir sınırdır.

`tests/unit/tr-il-ilce.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isInTurkey } from '@/lib/geo';
import { PROVINCES, findDistrict, findProvince } from '@/lib/tr-il-ilce';

const trSorted = (names: string[]) => [...names].sort((a, b) => a.localeCompare(b, 'tr'));

describe('il ve ilçe listesi', () => {
  it('81 il, adlar benzersiz ve Türkçe sıralı', () => {
    const names = PROVINCES.map((p) => p.name);
    expect(names).toHaveLength(81);
    expect(new Set(names).size).toBe(81);
    expect(names).toEqual(trSorted(names));
  });

  it('toplam 973 ilçe (İçişleri Bakanlığı, 2024)', () => {
    expect(PROVINCES.reduce((sum, p) => sum + p.districts.length, 0)).toBe(973);
  });

  it.each(PROVINCES.map((p) => [p.name, p] as const))(
    '%s: en az bir ilçe, il içinde benzersiz ve Türkçe sıralı',
    (_name, province) => {
      const names = province.districts.map((d) => d.name);
      expect(names.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
      expect(names).toEqual(trSorted(names));
    },
  );

  it('bütün il ve ilçe merkezleri Türkiye sınır kutusunda', () => {
    const outside = PROVINCES.flatMap((p) => [p, ...p.districts])
      .filter((point) => !isInTurkey(point))
      .map((point) => point.name);
    expect(outside).toEqual([]);
  });

  it('bilinen örnekler; tam ad gerekir', () => {
    expect(findDistrict('İstanbul', 'Kadıköy')).toBeDefined();
    expect(findDistrict('Ankara', 'Çankaya')).toBeDefined();
    expect(findDistrict('İzmir', 'Kadıköy')).toBeUndefined();
    expect(findProvince('Istanbul')).toBeUndefined();
    expect(findProvince('Bayburt')?.districts).toHaveLength(3);
  });
});
```

- [ ] **Adım 2: Kırmızıyı gör**

Run: `npx vitest run --project unit tests/unit/geo.test.ts tests/unit/tr-il-ilce.test.ts`
Expected: FAIL, modüller yok.

- [ ] **Adım 3: `src/lib/geo.ts`**

```ts
export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Türkiye'yi (Gökçeada, Hatay, Iğdır dahil) kapsayan kutu: harita kesiti ve "Türkiye dışında" uyarısı. */
export const TURKEY_BBOX = { minLng: 25.5, minLat: 35.7, maxLng: 45.0, maxLat: 42.2 } as const;

/** Haritanın hiçbir ipucu olmadığında açıldığı yer. */
export const TURKEY_CENTER: GeoPoint = { lat: 39.0, lng: 35.2 };

export function isInTurkey(p: GeoPoint): boolean {
  return (
    p.lat >= TURKEY_BBOX.minLat &&
    p.lat <= TURKEY_BBOX.maxLat &&
    p.lng >= TURKEY_BBOX.minLng &&
    p.lng <= TURKEY_BBOX.maxLng
  );
}

/** Konumun nasıl konduğu: adres bulma, haritada elle, bağlantı/koordinat. (3. aşamada "gps" eklenir.) */
export const LOCATION_SOURCES = ['geocode', 'manual', 'link'] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

/** Formda tutulan, henüz kaydedilmemiş konum. */
export interface PickedLocation {
  latitude: number;
  longitude: number;
  source: LocationSource;
}
```

- [ ] **Adım 4: `src/lib/tr-il-ilce.ts`**

```ts
import type { GeoPoint } from './geo';
import { PROVINCE_DATA } from './tr-il-ilce-veri';

export interface District extends GeoPoint {
  name: string;
}

export interface Province extends GeoPoint {
  name: string;
  districts: readonly District[];
}

/** 81 il ve ilçeleri, Türkçe sıralı. Seçim kutuları (tarayıcı) ve doğrulama (sunucu) aynı listeyi kullanır. */
export const PROVINCES: readonly Province[] = PROVINCE_DATA;

const byName = new Map(PROVINCES.map((p) => [p.name, p]));

export function findProvince(name: string): Province | undefined {
  return byName.get(name);
}

export function findDistrict(province: string, district: string): District | undefined {
  return byName.get(province)?.districts.find((d) => d.name === district);
}
```

- [ ] **Adım 5: Üretim betiği `scripts/il-ilce-uret.ts`**

```ts
/**
 * src/lib/tr-il-ilce-veri.ts dosyasını OpenStreetMap'ten üretir (bir kez; ilçe değişikliği olursa yeniden).
 * Veri: © OpenStreetMap katkıcıları, ODbL 1.0. Sorgu herkese açık Overpass sunucusuna gider; bizden kişisel veri gitmez.
 * Kullanım: npx tsx scripts/il-ilce-uret.ts
 */
import { writeFileSync } from 'node:fs';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
// İller (admin_level 4) ve her ilin "subarea" üyesi ilçeleri (admin_level 6), sırayla: il, ilçeleri, sonraki il…
const QUERY = `[out:json][timeout:600];
area["ISO3166-1"="TR"][admin_level=2]->.tr;
rel(area.tr)["boundary"="administrative"]["admin_level"="4"];
foreach(
  out tags center;
  rel(r:"subarea")["boundary"="administrative"]["admin_level"="6"];
  out tags center;
);`;

interface Element {
  id: number;
  tags: Record<string, string>;
  center?: { lat: number; lon: number };
}
interface Place {
  name: string;
  lat: number;
  lng: number;
}
interface ProvinceOut extends Place {
  districts: Place[];
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;
const trCompare = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'tr');

function provinceName(raw: string): string {
  return raw.replace(/\s+[İi]li$/u, '').trim();
}

function districtName(raw: string, province: string): string {
  const name = raw
    .replace(/\s*\([İi]lçe\)$/u, '')
    .replace(/\s+[İi]lçesi$/u, '')
    .trim();
  // Büyükşehir olmayan illerde merkez ilçenin resmî adı "Merkez".
  return name === province || name === `${province} Merkez` ? 'Merkez' : name;
}

async function fetchElements(): Promise<Element[]> {
  for (const endpoint of ENDPOINTS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'User-Agent': 'ServisTakip/0.1 (il-ilce listesi uretimi)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(QUERY)}`,
      }).catch(() => null);
      if (res?.ok) return ((await res.json()) as { elements: Element[] }).elements;
      console.log(`${endpoint} deneme ${attempt}: ${res ? `HTTP ${res.status}` : 'bağlanılamadı'}`);
      await new Promise((r) => setTimeout(r, 15_000 * attempt));
    }
  }
  throw new Error('Overpass sunucularına ulaşılamadı. Biraz sonra yeniden deneyin.');
}

async function main(): Promise<void> {
  const elements = await fetchElements();
  const provinces: ProvinceOut[] = [];
  let current: ProvinceOut | null = null;
  for (const el of elements) {
    const raw = el.tags['name:tr'] ?? el.tags.name;
    if (!raw || !el.center) throw new Error(`Adı ya da merkezi olmayan kayıt: ${el.id}`);
    const point = { lat: round(el.center.lat), lng: round(el.center.lon) };
    if (el.tags.admin_level === '4') {
      current = { name: provinceName(raw), ...point, districts: [] };
      provinces.push(current);
      continue;
    }
    if (!current) throw new Error('İlçe, ilinden önce geldi.');
    const name = districtName(raw, current.name);
    if (!current.districts.some((d) => d.name === name)) current.districts.push({ name, ...point });
  }
  provinces.sort(trCompare);
  for (const p of provinces) p.districts.sort(trCompare);

  const total = provinces.reduce((sum, p) => sum + p.districts.length, 0);
  console.log(`İl: ${provinces.length}, ilçe: ${total} (beklenen 81 / 973)`);
  for (const p of provinces) console.log(`  ${p.name}: ${p.districts.length}`);

  const today = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify(provinces, null, 2);
  writeFileSync(
    'src/lib/tr-il-ilce-veri.ts',
    `// Üretildi: scripts/il-ilce-uret.ts, ${today}. Elle yapılan düzeltmeler aşağıda "Düzeltmeler" notunda.\n` +
      `// Veri: © OpenStreetMap katkıcıları, ODbL 1.0 (https://www.openstreetmap.org/copyright).\n` +
      `// Merkezler yaklaşıktır (sınır kutusunun ortası); yalnızca haritanın açılış noktası için kullanılır.\n` +
      `// Düzeltmeler: yok.\n` +
      `import type { Province } from './tr-il-ilce';\n\n` +
      `export const PROVINCE_DATA: readonly Province[] = ${body};\n`,
  );
  console.log('src/lib/tr-il-ilce-veri.ts yazıldı. Şimdi: npm run format');
}

main().catch((err: unknown) => {
  console.error('il-ilce-uret başarısız:', err instanceof Error ? err.message : err);
  process.exit(1);
});
```

- [ ] **Adım 6: Veriyi üret ve denetle**

Run: `npx tsx scripts/il-ilce-uret.ts && npm run format`
Expected: "İl: 81, ilçe: 973". İl başına sayılar yazılır.

Sayılar tutmazsa (ör. 972 ya da 975):
1. Farkı bul: betiğin il listesini resmî listeyle (İçişleri Bakanlığı il/ilçe listesi ya da Vikipedi "Türkiye'nin ilçeleri" sayfasındaki il başına sayılar) karşılaştır.
2. Eksik/fazla ilçeyi `src/lib/tr-il-ilce-veri.ts` içinde elle düzelt (eksik ilçenin merkezi için ilin merkezini kullan) ve dosya başındaki "Düzeltmeler:" satırına yaz (ör. "Düzeltmeler: Bayburt/Demirözü eklendi (OSM'de subarea üyesi değil), merkez il merkezi.").
3. Testteki 973 sayısını **değiştirme**; resmî sayı değiştiyse önce kaynağı doğrula ve hem testi hem dosya başını güncelle.

- [ ] **Adım 7: Yeşili gör**

Run: `npx vitest run --project unit tests/unit/geo.test.ts tests/unit/tr-il-ilce.test.ts`
Expected: PASS (81 il satırı dahil).

- [ ] **Adım 8: Commit**

```bash
npm run lint && npm run typecheck
git add src/lib/geo.ts src/lib/tr-il-ilce.ts src/lib/tr-il-ilce-veri.ts scripts/il-ilce-uret.ts tests/unit/geo.test.ts tests/unit/tr-il-ilce.test.ts
git commit -m "Müşteriler: il ve ilçe listesi (OpenStreetMap, ODbL) ve Türkiye sınır kutusu"
```

---

### Görev 3: Şema, göçler ve ikinci kilit

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `drizzle/0002_musteriler.sql` (üretilir), `drizzle/0003_musteriler_rls.sql` (elle), `drizzle/meta/0002_snapshot.json`, `drizzle/meta/0003_snapshot.json`, `drizzle/meta/_journal.json` (drizzle-kit günceller)
- Modify: `tests/helpers/fabrika.ts`, `tests/integration/sema-denetimi.test.ts`
- Test: `tests/integration/firma-izolasyonu-musteri-rls.test.ts`

**Interfaces:**
- Consumes: `DEVICE_TYPE_VALUES` (`src/lib/device-types.ts`), `LOCATION_SOURCES` (`src/lib/geo.ts`)
- Produces (Drizzle tabloları, alan adları sonraki görevlerde aynen kullanılır):
  - `customers`: `id, tenantId, name, note, searchText, version, createdBy, updatedBy, createdAt, updatedAt`
  - `customerPhones`: `id, tenantId, customerId, number, label, position`
  - `customerAddresses`: `id, tenantId, customerId, label, province, district, neighborhood, addressLine, directions, latitude, longitude, locationSource, locationSetBy, locationSetAt, position, version, createdAt, updatedAt`
  - `customerDevices`: `id, tenantId, customerId, addressId, type, typeOther, brand, model, serialNo, installedOn ('YYYY-MM-DD' | null), warrantyUntil, note, version, createdAt, updatedAt`
  - Kısıt adları: `customers_tenant_id_key`, `customer_addresses_tenant_customer_id_key`, `customer_devices_address_fk`, `customers_search_trgm_idx`
  - `tests/helpers/fabrika.ts`: `interface SeededCustomer { id; phoneId; addressId; deviceId }`, `seedCustomer(db: Db, tenantId: string, userId: string, overrides?: { name?: string; number?: string }): Promise<SeededCustomer>`

- [ ] **Adım 1: `pg_trgm`'in kurulumda olduğunu doğrula**

2026-10-07'de denetlendi: `pg_available_extensions` içinde `pg_trgm 1.6` var, kurulu değil. `servis_owner` veritabanı sahibi olduğu için güvenilir (trusted) eklentiyi göçte açabilir. Yeniden denetlemek için:

```bash
node -e "process.loadEnvFile('.env');const {Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_ADMIN_URL});c.connect().then(()=>c.query(\"select name, default_version, trusted from pg_available_extensions join pg_available_extension_versions using (name) where name='pg_trgm'\")).then(r=>{console.log(r.rows);return c.end()})"
```

Expected: `[ { name: 'pg_trgm', default_version: '1.6', trusted: true } ]` (birden çok sürüm satırı olabilir; birinde `trusted: true` yeterli).

- [ ] **Adım 2: Test yardımcısı ve ikinci kilit testini yaz**

`tests/helpers/fabrika.ts` dosyasının sonuna ekle (içe aktarmaları dosyanın başındaki listeye kat):

```ts
import { customerAddresses, customerDevices, customerPhones, customers } from '@/server/db/schema';

export interface SeededCustomer {
  id: string;
  phoneId: string;
  addressId: string;
  deviceId: string;
}

/** Servisi atlayıp doğrudan satır yazar (yalnızca kilit ve şema testleri için); search_text boş kalır. */
export async function seedCustomer(
  db: Db,
  tenantId: string,
  userId: string,
  overrides: { name?: string; number?: string } = {},
): Promise<SeededCustomer> {
  return withTenant(db, tenantId, async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({
        tenantId,
        name: overrides.name ?? 'Deneme Müşteri',
        createdBy: userId,
        updatedBy: userId,
      })
      .returning({ id: customers.id });
    const id = customer!.id;
    const [phone] = await tx
      .insert(customerPhones)
      .values({ tenantId, customerId: id, number: overrides.number ?? '+905320000000', position: 0 })
      .returning({ id: customerPhones.id });
    const [address] = await tx
      .insert(customerAddresses)
      .values({
        tenantId,
        customerId: id,
        province: 'İstanbul',
        district: 'Kadıköy',
        addressLine: 'Deneme Sok. No: 1',
        position: 0,
      })
      .returning({ id: customerAddresses.id });
    const [device] = await tx
      .insert(customerDevices)
      .values({ tenantId, customerId: id, addressId: address!.id, type: 'combi_boiler' })
      .returning({ id: customerDevices.id });
    return { id, phoneId: phone!.id, addressId: address!.id, deviceId: device!.id };
  });
}
```

`tests/integration/firma-izolasyonu-musteri-rls.test.ts`:

```ts
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { PG_FOREIGN_KEY_VIOLATION, PG_INSUFFICIENT_PRIVILEGE } from '@/server/db/errors';
import {
  customerAddresses,
  customerDevices,
  customerPhones,
  customers,
  type UserRow,
} from '@/server/db/schema';
import { withTenant, type TenantTx } from '@/server/db/tenant';
import { useTestDbs } from '../helpers/db';
import {
  seedCustomer,
  seedTenant,
  seedUser,
  type SeededCustomer,
  type SeededTenant,
} from '../helpers/fabrika';
import { expectPgError } from '../helpers/pg';

describe('2. kilit: müşteri tabloları veritabanında firmaya ayrılır (uygulama filtresi olmadan)', () => {
  const { app, owner } = useTestDbs();
  let a: SeededTenant;
  let b: SeededTenant;
  let aUser: UserRow;
  let bUser: UserRow;
  let aCustomer: SeededCustomer;
  let bCustomer: SeededCustomer;

  beforeAll(async () => {
    a = await seedTenant(owner);
    b = await seedTenant(owner);
    aUser = await seedUser(owner, a.id);
    bUser = await seedUser(owner, b.id);
    aCustomer = await seedCustomer(owner, a.id, aUser.id);
    bCustomer = await seedCustomer(owner, b.id, bUser.id, { name: 'B Müşterisi' });
  });

  const asA = <T>(fn: (tx: TenantTx) => Promise<T>) => withTenant(app, a.id, fn);

  it('A bağlamında filtresiz sorgular yalnızca A satırlarını döndürür', async () => {
    const seen = await asA(async (tx) => ({
      customers: (await tx.select({ id: customers.id }).from(customers)).map((r) => r.id),
      phones: (await tx.select({ id: customerPhones.id }).from(customerPhones)).map((r) => r.id),
      addresses: (await tx.select({ id: customerAddresses.id }).from(customerAddresses)).map(
        (r) => r.id,
      ),
      devices: (await tx.select({ id: customerDevices.id }).from(customerDevices)).map((r) => r.id),
    }));
    expect(seen).toEqual({
      customers: [aCustomer.id],
      phones: [aCustomer.phoneId],
      addresses: [aCustomer.addressId],
      devices: [aCustomer.deviceId],
    });
  });

  it('firma bağlamı yokken hiçbir müşteri satırı görünmez', async () => {
    expect(await app.select({ id: customers.id }).from(customers)).toEqual([]);
    expect(await app.select({ id: customerPhones.id }).from(customerPhones)).toEqual([]);
  });

  it('başka firmanın kimliğiyle müşteri eklenemez', async () => {
    await expectPgError(
      asA(async (tx) => {
        await tx
          .insert(customers)
          .values({ tenantId: b.id, name: 'Sızıntı', createdBy: bUser.id, updatedBy: bUser.id });
      }),
      PG_INSUFFICIENT_PRIVILEGE,
    );
  });

  it('başka firmanın müşterisine telefon eklenemez (RLS ve bileşik anahtar)', async () => {
    await expectPgError(
      asA(async (tx) => {
        await tx
          .insert(customerPhones)
          .values({ tenantId: b.id, customerId: bCustomer.id, number: '+905551112233', position: 1 });
      }),
      PG_INSUFFICIENT_PRIVILEGE,
    );
    await expectPgError(
      asA(async (tx) => {
        await tx
          .insert(customerPhones)
          .values({ tenantId: a.id, customerId: bCustomer.id, number: '+905551112233', position: 1 });
      }),
      PG_FOREIGN_KEY_VIOLATION,
    );
  });

  it('başka firmanın müşteri, telefon, adres ve cihazı güncellenemez ve silinemez', async () => {
    const touched = await asA(async (tx) => ({
      customer: await tx
        .update(customers)
        .set({ name: 'Ele geçirildi' })
        .where(eq(customers.id, bCustomer.id))
        .returning({ id: customers.id }),
      phone: await tx
        .delete(customerPhones)
        .where(eq(customerPhones.id, bCustomer.phoneId))
        .returning({ id: customerPhones.id }),
      address: await tx
        .update(customerAddresses)
        .set({ addressLine: 'Ele geçirildi' })
        .where(eq(customerAddresses.id, bCustomer.addressId))
        .returning({ id: customerAddresses.id }),
      device: await tx
        .delete(customerDevices)
        .where(eq(customerDevices.id, bCustomer.deviceId))
        .returning({ id: customerDevices.id }),
    }));
    expect(touched).toEqual({ customer: [], phone: [], address: [], device: [] });
    const [still] = await withTenant(owner, b.id, async (tx) =>
      tx.select({ name: customers.name }).from(customers).where(eq(customers.id, bCustomer.id)),
    );
    expect(still?.name).toBe('B Müşterisi');
  });

  it('uygulama kullanıcısı müşteri silemez (silme 5. parçada çöp kutusuyla)', async () => {
    await expectPgError(
      asA(async (tx) => {
        await tx.delete(customers).where(eq(customers.id, aCustomer.id));
      }),
      PG_INSUFFICIENT_PRIVILEGE,
    );
  });

  it('cihaz başka müşterinin adresine bağlanamaz (aynı firmada bile)', async () => {
    const other = await seedCustomer(owner, a.id, aUser.id, { name: 'A İkinci' });
    await expectPgError(
      asA(async (tx) => {
        await tx.insert(customerDevices).values({
          tenantId: a.id,
          customerId: other.id,
          addressId: aCustomer.addressId,
          type: 'air_conditioner',
        });
      }),
      PG_FOREIGN_KEY_VIOLATION,
    );
  });

  it('adres kaldırılınca cihaz müşteride kalır, yalnızca adres bağı boşalır', async () => {
    const c = await seedCustomer(owner, a.id, aUser.id, { name: 'A Üçüncü' });
    await asA(async (tx) => {
      await tx.delete(customerAddresses).where(eq(customerAddresses.id, c.addressId));
    });
    const [device] = await asA(async (tx) =>
      tx
        .select({ customerId: customerDevices.customerId, addressId: customerDevices.addressId })
        .from(customerDevices)
        .where(eq(customerDevices.id, c.deviceId)),
    );
    expect(device).toEqual({ customerId: c.id, addressId: null });
  });
});
```

`tests/integration/sema-denetimi.test.ts` içinde:
1. İlk testteki `expect.arrayContaining([...])` listesini şu olsun: `['audit_log', 'customer_addresses', 'customer_devices', 'customer_phones', 'customers', 'sessions', 'users']`.
2. İzin testindeki beklenen listeyi şununla değiştir:

```ts
    expect(rows).toEqual([
      { table_name: 'audit_log', privs: 'INSERT,SELECT' },
      { table_name: 'customer_addresses', privs: 'DELETE,INSERT,SELECT,UPDATE' },
      { table_name: 'customer_devices', privs: 'DELETE,INSERT,SELECT,UPDATE' },
      { table_name: 'customer_phones', privs: 'DELETE,INSERT,SELECT,UPDATE' },
      { table_name: 'customers', privs: 'INSERT,SELECT,UPDATE' },
      { table_name: 'sessions', privs: 'DELETE,INSERT,SELECT,UPDATE' },
      { table_name: 'tenants', privs: 'SELECT' },
      { table_name: 'users', privs: 'INSERT,SELECT,UPDATE' },
    ]);
```

3. `describe` bloğunun sonuna ekle:

```ts
  it('cihaz → adres bağı yalnızca address_id sütununu boşaltır (tenant_id ve customer_id kalır)', async () => {
    const { rows } = await owner.execute<{ deltype: string; set_cols: string[] }>(sql`
      select c.confdeltype as deltype,
             array(select a.attname::text from pg_attribute a
                   where a.attrelid = c.conrelid and a.attnum = any(c.confdelsetcols)
                   order by a.attnum) as set_cols
      from pg_constraint c where c.conname = 'customer_devices_address_fk'`);
    expect(rows).toEqual([{ deltype: 'n', set_cols: ['address_id'] }]);
  });

  it('müşteri araması trigram dizinini kullanır', async () => {
    const { rows } = await owner.execute<{ indexdef: string }>(
      sql`select indexdef from pg_indexes where indexname = 'customers_search_trgm_idx'`,
    );
    expect(rows[0]?.indexdef).toContain('gin_trgm_ops');
  });
```

> `table_name` sıralaması `name` türünün C karşılaştırmasıyla yapılır: `customer_phones` ("_" 0x5F) `customers`'tan ("s" 0x73) önce gelir. Test farklı sıra gösterirse yalnızca sırayı düzelt; içerik aynı olmalı.

- [ ] **Adım 3: Kırmızıyı gör**

Run: `npx vitest run --project integration tests/integration/sema-denetimi.test.ts tests/integration/firma-izolasyonu-musteri-rls.test.ts`
Expected: FAIL (tsc/vitest: `customers` şemada yok).

- [ ] **Adım 4: Şemayı yaz**

`src/server/db/schema.ts`: içe aktarma listesine `date`, `doublePrecision`, `smallint` ekle; dosyanın başına:

```ts
import { DEVICE_TYPE_VALUES } from '../../lib/device-types';
import { LOCATION_SOURCES } from '../../lib/geo';
```

(drizzle-kit şemayı kendi yükleyicisiyle okur; `@/` takma adı yerine göreli yol kullanılır, `../roles` gibi.)

`auditLog` tanımından sonra, `export type UserRow` satırından önce ekle:

```ts
/** Müşteri: ad yazıldığı gibi saklanır. search_text servis tarafından her değişiklikte aynı işlemde yeniden yazılır. */
export const customers = pgTable(
  'customers',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: text('name').notNull(),
    note: text('note'),
    searchText: text('search_text').notNull().default(''),
    /** Eşzamanlı düzenleme koruması: ad, not ya da telefonlar değişince artar. */
    version: integer('version').notNull().default(1),
    createdBy: uuid('created_by').notNull(),
    updatedBy: uuid('updated_by').notNull(),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Bileşik anahtar hedefi: alt tablolar (tenant_id, customer_id) ile bağlanır.
    unique('customers_tenant_id_key').on(t.tenantId, t.id),
    foreignKey({
      name: 'customers_created_by_fk',
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }),
    foreignKey({
      name: 'customers_updated_by_fk',
      columns: [t.tenantId, t.updatedBy],
      foreignColumns: [users.tenantId, users.id],
    }),
    // Arama yokken liste: en son güncellenen önce, anahtar tabanlı sayfalama.
    index('customers_tenant_updated_idx').on(t.tenantId, t.updatedAt.desc(), t.id.desc()),
    // search_text trigram dizini 0003 göçünde (gin_trgm_ops, pg_trgm eklentisi önce açılmalı).
    check('customers_name_length', sql`char_length(${t.name}) between 1 and 120`),
    check(
      'customers_note_length',
      sql`${t.note} is null or char_length(${t.note}) between 1 and 2000`,
    ),
    check('customers_version_positive', sql`${t.version} >= 1`),
  ],
);

export const customerPhones = pgTable(
  'customer_phones',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    /** E.164 ("+905321234567"). */
    number: text('number').notNull(),
    label: text('label'),
    /** 0 = ana numara. */
    position: smallint('position').notNull(),
  },
  (t) => [
    foreignKey({
      name: 'customer_phones_customer_fk',
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }).onDelete('cascade'),
    unique('customer_phones_customer_number_key').on(t.customerId, t.number),
    // Çift numara denetimi: firmada bu numara başka müşteride var mı?
    index('customer_phones_tenant_number_idx').on(t.tenantId, t.number),
    index('customer_phones_customer_idx').on(t.tenantId, t.customerId),
    check('customer_phones_number_format', sql`${t.number} ~ '^\\+[1-9][0-9]{7,14}$'`),
    check(
      'customer_phones_label_length',
      sql`${t.label} is null or char_length(${t.label}) between 1 and 40`,
    ),
    check('customer_phones_position_nonnegative', sql`${t.position} >= 0`),
  ],
);

export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    label: text('label'),
    province: text('province').notNull(),
    district: text('district').notNull(),
    neighborhood: text('neighborhood'),
    addressLine: text('address_line').notNull(),
    directions: text('directions'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    locationSource: text('location_source', { enum: LOCATION_SOURCES }),
    locationSetBy: uuid('location_set_by'),
    locationSetAt: timestamptz('location_set_at'),
    position: smallint('position').notNull(),
    version: integer('version').notNull().default(1),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Cihazın bileşik anahtar hedefi: cihaz yalnızca kendi müşterisinin adresine bağlanır.
    unique('customer_addresses_tenant_customer_id_key').on(t.tenantId, t.customerId, t.id),
    foreignKey({
      name: 'customer_addresses_customer_fk',
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'customer_addresses_location_set_by_fk',
      columns: [t.tenantId, t.locationSetBy],
      foreignColumns: [users.tenantId, users.id],
    }),
    index('customer_addresses_customer_idx').on(t.tenantId, t.customerId),
    index('customer_addresses_tenant_created_idx').on(t.tenantId, t.createdAt),
    check(
      'customer_addresses_label_length',
      sql`${t.label} is null or char_length(${t.label}) between 1 and 40`,
    ),
    check(
      'customer_addresses_province_length',
      sql`char_length(${t.province}) between 1 and 80`,
    ),
    check(
      'customer_addresses_district_length',
      sql`char_length(${t.district}) between 1 and 80`,
    ),
    check(
      'customer_addresses_neighborhood_length',
      sql`${t.neighborhood} is null or char_length(${t.neighborhood}) between 1 and 80`,
    ),
    check(
      'customer_addresses_address_line_length',
      sql`char_length(${t.addressLine}) between 1 and 250`,
    ),
    check(
      'customer_addresses_directions_length',
      sql`${t.directions} is null or char_length(${t.directions}) between 1 and 250`,
    ),
    check(
      'customer_addresses_location_pair',
      sql`(${t.latitude} is null) = (${t.longitude} is null)`,
    ),
    check(
      'customer_addresses_location_meta',
      sql`(${t.latitude} is null) = (${t.locationSource} is null) and (${t.latitude} is null) = (${t.locationSetAt} is null)`,
    ),
    check(
      'customer_addresses_latitude_range',
      sql`${t.latitude} is null or ${t.latitude} between -90 and 90`,
    ),
    check(
      'customer_addresses_longitude_range',
      sql`${t.longitude} is null or ${t.longitude} between -180 and 180`,
    ),
    check(
      'customer_addresses_location_source_values',
      sql`${t.locationSource} is null or ${t.locationSource} in ('geocode', 'manual', 'link')`,
    ),
    check('customer_addresses_position_nonnegative', sql`${t.position} >= 0`),
    check('customer_addresses_version_positive', sql`${t.version} >= 1`),
  ],
);

export const customerDevices = pgTable(
  'customer_devices',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`uuidv7()`),
    tenantId: uuid('tenant_id').notNull(),
    customerId: uuid('customer_id').notNull(),
    /** (tenant_id, customer_id, address_id) → customer_addresses bağı 0003 göçünde: ON DELETE SET NULL ("address_id"). */
    addressId: uuid('address_id'),
    type: text('type', { enum: DEVICE_TYPE_VALUES }).notNull(),
    typeOther: text('type_other'),
    brand: text('brand'),
    model: text('model'),
    serialNo: text('serial_no'),
    installedOn: date('installed_on', { mode: 'string' }),
    warrantyUntil: date('warranty_until', { mode: 'string' }),
    note: text('note'),
    version: integer('version').notNull().default(1),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: 'customer_devices_customer_fk',
      columns: [t.tenantId, t.customerId],
      foreignColumns: [customers.tenantId, customers.id],
    }).onDelete('cascade'),
    index('customer_devices_customer_idx').on(t.tenantId, t.customerId),
    index('customer_devices_address_idx').on(t.tenantId, t.customerId, t.addressId),
    // Liste src/lib/device-types.ts ile aynı olmalı; Görev 6'daki "her tür kaydedilir" testi denetler.
    check(
      'customer_devices_type_values',
      sql`${t.type} in ('combi_boiler', 'air_conditioner', 'instant_water_heater', 'storage_water_heater', 'refrigerator', 'washing_machine', 'dryer', 'dishwasher', 'oven_stove', 'range_hood', 'water_purifier', 'television', 'other')`,
    ),
    check(
      'customer_devices_type_other',
      sql`(${t.type} = 'other') = (${t.typeOther} is not null)`,
    ),
    check(
      'customer_devices_type_other_length',
      sql`${t.typeOther} is null or char_length(${t.typeOther}) between 1 and 40`,
    ),
    check(
      'customer_devices_brand_length',
      sql`${t.brand} is null or char_length(${t.brand}) between 1 and 60`,
    ),
    check(
      'customer_devices_model_length',
      sql`${t.model} is null or char_length(${t.model}) between 1 and 60`,
    ),
    check(
      'customer_devices_serial_no_length',
      sql`${t.serialNo} is null or char_length(${t.serialNo}) between 1 and 60`,
    ),
    check(
      'customer_devices_note_length',
      sql`${t.note} is null or char_length(${t.note}) between 1 and 500`,
    ),
    check(
      'customer_devices_warranty_after_install',
      sql`${t.installedOn} is null or ${t.warrantyUntil} is null or ${t.warrantyUntil} >= ${t.installedOn}`,
    ),
    check('customer_devices_version_positive', sql`${t.version} >= 1`),
  ],
);
```

- [ ] **Adım 5: Tablo göçünü üret**

Run: `npm run db:generate -- --name musteriler`
Expected: `drizzle/0002_musteriler.sql` oluşur; dört `CREATE TABLE`, kısıtlar, dizinler. Soru sormaz (yeni tablo, yeniden adlandırma yok).

Denetle:

```bash
grep -n "1-9" drizzle/0002_musteriler.sql
grep -c "CREATE TABLE" drizzle/0002_musteriler.sql
```

Expected: `'^\+[1-9][0-9]{7,14}$'` (tek ters eğik çizgi) ve `4`. Çift ters eğik çizgi görürsen şemadaki `\\+` yazımını düzelt ve göçü sil-yeniden üret (`drizzle/0002_*`, `drizzle/meta/0002_snapshot.json` ve `_journal.json`'daki son kayıt).

- [ ] **Adım 6: Elle göçü oluştur**

Run: `npx drizzle-kit generate --custom --name musteriler_rls`
Expected: boş `drizzle/0003_musteriler_rls.sql`. İçeriğini yaz:

```sql
-- Müşteriler parçası: arama dizini, cihaz → adres bağı ve ikinci kilit. Ayrıntı: docs/superpowers/specs/2026-10-07-musteriler-design.md §5
-- pg_trgm güvenilir (trusted) eklentidir; veritabanı sahibi servis_owner açabilir.
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "customers_search_trgm_idx" ON "customers" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
-- Cihaz yalnızca kendi müşterisinin adresine bağlanır; adres kaldırılınca yalnızca address_id boşalır
-- (PostgreSQL 15+ sözdizimi; Drizzle şemasında yazılamıyor, şema denetimi testi varlığını sınar).
ALTER TABLE "customer_devices" ADD CONSTRAINT "customer_devices_address_fk"
  FOREIGN KEY ("tenant_id", "customer_id", "address_id")
  REFERENCES "customer_addresses" ("tenant_id", "customer_id", "id")
  ON DELETE SET NULL ("address_id");--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "customers"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "customer_phones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_phones" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "customer_phones"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "customer_addresses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_addresses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "customer_addresses"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "customer_devices" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_devices" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "customer_devices"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);--> statement-breakpoint
-- Uygulama kullanıcısının izinleri. Müşterinin tamamını silmek 5. parçada çöp kutusuyla: customers'ta DELETE yok.
GRANT SELECT, INSERT, UPDATE ON "customers" TO servis_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "customer_phones" TO servis_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "customer_addresses" TO servis_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "customer_devices" TO servis_app;
```

- [ ] **Adım 7: Yeşili gör**

Run: `npx vitest run --project integration tests/integration/sema-denetimi.test.ts tests/integration/firma-izolasyonu-musteri-rls.test.ts tests/integration/sema.test.ts`
Expected: PASS. (Test kurulumu `drop schema public cascade` ile eklentiyi de siler; 0003 yeniden açar.)

- [ ] **Adım 8: Geliştirme veritabanına uygula ve bütün testleri koş**

```bash
npm run db:migrate
npm test
```

Expected: "Göçler uygulandı."; bütün birim ve entegrasyon testleri geçer.

- [ ] **Adım 9: Commit**

```bash
npm run format && npm run lint && npm run typecheck
git add src/server/db/schema.ts drizzle tests/helpers/fabrika.ts tests/integration/sema-denetimi.test.ts tests/integration/firma-izolasyonu-musteri-rls.test.ts
git commit -m "Müşteriler: dört firma tablosu, arama dizini ve ikinci kilit (RLS, izinler)"
```

---

### Görev 4: Yetki, menü ve işlem geçmişinin genelleştirilmesi

**Files:**
- Modify: `src/server/permissions.ts`, `src/server/navigation.ts`, `src/components/nav-links.tsx`, `src/server/audit/audit.ts`, `src/server/errors.ts`, `src/server/validation.ts`
- Modify (çağıranlar): `src/server/auth/change-password.ts`, `src/server/auth/login.ts`, `src/server/platform/admin.ts`, `src/server/staff/service.ts`
- Test: `tests/unit/permissions.test.ts`, `tests/unit/navigation.test.ts`, `tests/unit/audit.test.ts`, `tests/unit/validation.test.ts`

**Interfaces:**
- Produces:
  - İzinler `'customer.view'`, `'customer.manage'` (ikisi de `owner`, `operator`)
  - `NavItem.icon` birleşimine `'customers'`
  - `type AuditAction` içine `'customer.created' | 'customer.updated' | 'customer.address_added' | 'customer.address_updated' | 'customer.address_removed' | 'customer.device_added' | 'customer.device_updated' | 'customer.device_removed'`
  - `interface AuditTarget { type: 'user' | 'customer'; id: string }`; `AuditEntry.target?: AuditTarget` (`targetUserId` kalkar)
  - `assertCustomerAuditDetails(details: Record<string, unknown>): void`
  - `AppErrorKind` içine `'stale'`; `STALE_MESSAGE`; `staleError(): AppError`
  - `fieldErrorsFrom` anahtarı artık yolun tamamı: `phones.0.number`, `address.province`

- [ ] **Adım 1: Testleri güncelle**

`tests/unit/permissions.test.ts` içindeki `EXPECTED` nesnesine ekle:

```ts
  'customer.view': { owner: true, operator: true, technician: false },
  'customer.manage': { owner: true, operator: true, technician: false },
```

`tests/unit/navigation.test.ts` dosyasının tamamı:

```ts
import { describe, expect, it } from 'vitest';
import { navItemsFor } from '@/server/navigation';

describe('menü', () => {
  it('patron Müşteriler ve Personel bölümlerini görür', () => {
    expect(navItemsFor('owner').map((i) => i.href)).toEqual([
      '/',
      '/musteriler',
      '/personel',
      '/hesabim',
    ]);
  });
  it('operatör Müşteriler bölümünü görür, Personel bölümünü görmez', () => {
    expect(navItemsFor('operator').map((i) => i.href)).toEqual(['/', '/musteriler', '/hesabim']);
  });
  it('teknisyen Müşteriler ve Personel bölümlerini görmez (kendi işinin müşterisi 4. parçada)', () => {
    expect(navItemsFor('technician').map((i) => i.href)).toEqual(['/', '/hesabim']);
  });
});
```

`tests/unit/audit.test.ts` dosyasının sonuna ekle (içe aktarmaya `assertCustomerAuditDetails` kat):

```ts
describe('müşteri kayıtlarında değer yasağı (KVKK)', () => {
  it('izinli anahtarları kabul eder', () => {
    expect(() =>
      assertCustomerAuditDetails({
        fields: ['name', 'phones'],
        addressId: '0199a1b2-0000-7000-8000-000000000001',
        locationChanged: true,
        locationSource: 'link',
      }),
    ).not.toThrow();
    expect(() => assertCustomerAuditDetails({})).not.toThrow();
    expect(() => assertCustomerAuditDetails({ locationSource: null })).not.toThrow();
  });

  it.each([
    { name: 'Ayşe' },
    { fields: ['Ayşe Yılmaz'] },
    { fields: 'name' },
    { addressId: 'Moda Cad. No 5' },
    { deviceId: '+905321234567' },
    { locationChanged: 'evet' },
    { locationSource: '41.0082,28.9784' },
    { changes: { name: { from: 'A', to: 'B' } } },
  ])('değer taşıyabilecek ayrıntıyı reddeder: %o', (details) => {
    expect(() => assertCustomerAuditDetails(details)).toThrow();
  });
});
```

`tests/unit/validation.test.ts` dosyasının sonuna ekle:

```ts
describe('iç içe alan hatası', () => {
  it('anahtar yolun tamamıdır (dizi sırası dahil)', () => {
    const schema = z.object({
      phones: z.array(z.object({ number: z.string().min(1, 'Numara yazın.') })),
      address: z.object({ province: z.string().min(1, 'İl seçin.') }),
    });
    const parsed = schema.safeParse({ phones: [{ number: 'x' }, { number: '' }], address: { province: '' } });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(fieldErrorsFrom(parsed.error)).toEqual({
      'phones.1.number': 'Numara yazın.',
      'address.province': 'İl seçin.',
    });
  });
});
```

- [ ] **Adım 2: Kırmızıyı gör**

Run: `npx vitest run --project unit tests/unit/permissions.test.ts tests/unit/navigation.test.ts tests/unit/audit.test.ts tests/unit/validation.test.ts`
Expected: FAIL (izin yok, menü eski, `assertCustomerAuditDetails` yok, anahtar `phones`).

- [ ] **Adım 3: Yetki ve menü**

`src/server/permissions.ts` tablosu:

```ts
const PERMISSIONS = {
  'customer.view': ['owner', 'operator'],
  'customer.manage': ['owner', 'operator'],
  'staff.view': ['owner'],
  'staff.manage': ['owner'],
} as const satisfies Record<string, readonly Role[]>;
```

`src/server/navigation.ts`: `icon` türü `'home' | 'customers' | 'staff' | 'account'`; `ITEMS` içinde Ana sayfa'dan sonra:

```ts
  {
    item: {
      href: '/musteriler',
      label: 'Müşteriler',
      description: 'Müşteri arayın, ekleyin; adres, konum ve cihaz bilgisini yönetin.',
      icon: 'customers',
    },
    permission: 'customer.view',
  },
```

`src/components/nav-links.tsx`:

```ts
import { Contact, House, UserRound, Users } from 'lucide-react';
// …
const ICONS = { home: House, customers: Contact, staff: Users, account: UserRound } as const;
```

- [ ] **Adım 4: Hata türü ve alan hatası anahtarı**

`src/server/errors.ts`:

```ts
export type AppErrorKind = 'validation' | 'forbidden' | 'not_found' | 'conflict' | 'stale';
```

dosyanın sonuna:

```ts
export const STALE_MESSAGE =
  'Bu kayıt siz düzenlerken değişti. Güncel hâlini gösterdik; değişikliğinizi yeniden yapın.';

/** Eşzamanlı düzenleme: form açıldığındaki sürüm artık güncel değil. Eylem güncel kaydı forma geri yükler. */
export const staleError = () => new AppError('stale', STALE_MESSAGE);
```

`src/server/validation.ts` içinde `fieldErrorsFrom`:

```ts
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    // İç içe alanlar "phones.0.number", "address.province" anahtarıyla döner; düz formlarda anahtar alan adıdır.
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : 'form';
    result[key] ??= issue.message;
  }
  return result;
}
```

- [ ] **Adım 5: İşlem geçmişini genelleştir**

`src/server/audit/audit.ts`:

```ts
import { auditLog } from '@/server/db/schema';
import { isUuid, type TenantTx } from '@/server/db/tenant';

export type AuditAction =
  | 'auth.login'
  | 'auth.locked'
  | 'user.created'
  | 'user.updated'
  | 'user.deactivated'
  | 'user.reactivated'
  | 'user.password_reset'
  | 'user.password_changed'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.address_added'
  | 'customer.address_updated'
  | 'customer.address_removed'
  | 'customer.device_added'
  | 'customer.device_updated'
  | 'customer.device_removed';

export interface AuditTarget {
  type: 'user' | 'customer';
  id: string;
}

export interface AuditEntry {
  tenantId: string;
  /** İşlemi yapan; komut satırından yapılan işlemde null. */
  actorUserId: string | null;
  action: AuditAction;
  target?: AuditTarget;
  details?: Record<string, unknown>;
  at: Date;
}
```

`assertNoSecrets` aynı kalır. Ardından ekle:

```ts
const CUSTOMER_DETAIL_KEYS: ReadonlySet<string> = new Set([
  'fields',
  'addressId',
  'deviceId',
  'locationChanged',
  'locationSource',
]);

/**
 * Müşteri kayıtlarında değer yazılmaz (KVKK, spec §11): yalnızca değişen alanın adı, alt kaydın kimliği ve konumun
 * nasıl konduğu. Silme isteğinde geçmiş kayıtlar kişisel veri taşımasın diye kodda zorlanır.
 */
export function assertCustomerAuditDetails(details: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(details)) {
    if (!CUSTOMER_DETAIL_KEYS.has(key)) throw new Error(`audit: customer detail key not allowed: ${key}`);
    const allowed =
      key === 'fields'
        ? Array.isArray(value) && value.every((f) => typeof f === 'string' && /^[a-zA-Z]{1,30}$/.test(f))
        : key === 'locationChanged'
          ? typeof value === 'boolean'
          : key === 'locationSource'
            ? value === null || value === 'geocode' || value === 'manual' || value === 'link'
            : isUuid(value);
    if (!allowed) throw new Error(`audit: customer detail value not allowed: ${key}`);
  }
}

export async function recordAudit(tx: TenantTx, entry: AuditEntry): Promise<void> {
  const details = entry.details ?? {};
  assertNoSecrets(details);
  if (entry.action.startsWith('customer.')) assertCustomerAuditDetails(details);
  await tx.insert(auditLog).values({
    tenantId: entry.tenantId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetType: entry.target?.type ?? null,
    targetId: entry.target?.id ?? null,
    details,
    createdAt: entry.at,
  });
}
```

- [ ] **Adım 6: Çağıranları güncelle**

```bash
sed -i "s/targetUserId: \(.*\),$/target: { type: 'user', id: \1 },/" src/server/auth/change-password.ts src/server/auth/login.ts src/server/platform/admin.ts src/server/staff/service.ts
grep -rn "targetUserId" src tests scripts
```

Expected: `grep` hiçbir şey bulmaz. Sekiz satır `target: { type: 'user', id: … },` olmuştur.

- [ ] **Adım 7: Yeşili gör**

```bash
npm run format && npm run typecheck && npm test
```

Expected: tip denetimi temiz; bütün birim ve entegrasyon testleri geçer (personel, giriş, şifre testleri `targetId` değerini aynen görür).

- [ ] **Adım 8: Commit**

```bash
npm run lint
git add src tests
git commit -m "Müşteriler: yetkiler, menü, işlem geçmişinde genel hedef ve değer yasağı"
```

---

### Görev 5: Müşteri servisi (ad, not, telefonlar, çift numara, sürüm)

**Files:**
- Create: `src/server/customers/common.ts`, `src/server/customers/address-input.ts`, `src/server/customers/service.ts`
- Test: `tests/integration/musteriler.test.ts`

**Interfaces:**
- Consumes: `parsePhone`, `cleanPhoneInput`, `PHONE_MESSAGES` (Görev 1); `buildSearchText` (Görev 1); `findProvince`, `findDistrict` (Görev 2); `LOCATION_SOURCES` (Görev 2); tablolar (Görev 3); `recordAudit` + `target`, `staleError`, iç içe `fieldErrorsFrom` (Görev 4)
- Produces:
  - `common.ts`: `LIMITS = { phones: 10, addresses: 50, devices: 200 }`, `collapseSpaces`, `tidyMultiline`, `requiredLine(max, emptyMessage, tooLongMessage)`, `optionalLine(max, tooLongMessage)`, `optionalMultiline(max, tooLongMessage)`, `customerScope(actor, id)`, `lockCustomer(tx, actor, id): Promise<{ id; name; note; version }>`, `touchCustomer(tx, actor, customerId, now): Promise<void>`, `refreshSearchText(tx, actor, customerId): Promise<void>`
  - `address-input.ts`: `LOCATION_MESSAGE`, `addressFields` (Zod nesnesi, süzgeçsiz), `checkPlace` (il/ilçe süzgeci), `addressSchema`, `type AddressInput`, `roundCoordinate(n)`, `locationColumns(location, actor, now)`, `insertAddress(tx, actor, customerId, input, position, now): Promise<string>`
  - `service.ts`: `interface PhoneInput { number; label }`, `type CustomerPhone`, `interface PhoneOwner { number; customerId; customerName }`, `type SaveCustomerResult = { kind: 'saved'; id } | { kind: 'duplicate_phone'; owners: PhoneOwner[] }`, `interface CustomerAddress`, `interface CustomerDevice`, `interface CustomerDetail`, `LAST_PHONE_MESSAGE`, `createCustomer(tx, actor, raw, clock)`, `getCustomer(tx, actor, id)`, `updateCustomer(tx, actor, id, raw, clock)`, `findPhoneOwners(tx, actor, rawNumber, excludeCustomerId)`
  - Girdi biçimleri (eylemler ve testler bunu yollar):
    - `createCustomer`: `{ name: string; phones: Array<{ number: string; label: string | null }>; address?: AddressRaw | null; confirmDuplicate?: boolean }`
    - `updateCustomer`: `{ version: number; name: string; note: string | null; phones: …; confirmDuplicate?: boolean }`
    - `AddressRaw`: `{ label, province, district, neighborhood, addressLine, directions: string | null; location: { latitude: number; longitude: number; source: 'geocode' | 'manual' | 'link' } | null }`

- [ ] **Adım 1: Entegrasyon testini yaz**

`tests/integration/musteriler.test.ts`:

```ts
import { eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { PHONE_MESSAGES } from '@/lib/phone';
import {
  LAST_PHONE_MESSAGE,
  createCustomer,
  findPhoneOwners,
  getCustomer,
  updateCustomer,
} from '@/server/customers/service';
import { auditLog, customers, type UserRow } from '@/server/db/schema';
import { withTenant, type TenantTx } from '@/server/db/tenant';
import { STALE_MESSAGE, type AppError } from '@/server/errors';
import { MINUTE, createFakeClock } from '../helpers/clock';
import { useTestDbs } from '../helpers/db';
import { actorFor, seedTenant, seedUser, type SeededTenant } from '../helpers/fabrika';

const clock = createFakeClock();

describe('müşteri servisi', () => {
  const { app, owner } = useTestDbs();
  let tenant: SeededTenant;
  let operator: UserRow;

  beforeEach(async () => {
    tenant = await seedTenant(owner);
    operator = await seedUser(owner, tenant.id, { role: 'operator', fullName: 'Ayşe Demir' });
  });

  const run = <T>(fn: (tx: TenantTx) => Promise<T>) => withTenant(app, tenant.id, fn);
  const asOwner = <T>(fn: (tx: TenantTx) => Promise<T>) => withTenant(owner, tenant.id, fn);
  const actor = () => actorFor(operator, tenant.code);
  const errorOf = (promise: Promise<unknown>) =>
    promise.then(
      () => undefined,
      (e: unknown) => e as AppError,
    );
  const create = (input: Record<string, unknown>) =>
    run((tx) =>
      createCustomer(
        tx,
        actor(),
        { phones: [{ number: '0532 111 22 33', label: '' }], ...input },
        clock,
      ),
    );
  const saved = async (input: Record<string, unknown>) => {
    const result = await create(input);
    if (result.kind !== 'saved') throw new Error('müşteri kaydedilmedi');
    return result.id;
  };
  const customerCount = async () =>
    (
      await asOwner((tx) =>
        tx
          .select({ n: sql<number>`count(*)::int` })
          .from(customers)
          .where(eq(customers.tenantId, tenant.id)),
      )
    )[0]!.n;
  const auditRows = () =>
    asOwner((tx) =>
      tx.select().from(auditLog).where(eq(auditLog.tenantId, tenant.id)).orderBy(auditLog.id),
    );

  describe('ekleme', () => {
    it('adı kırpar, telefonları E.164 ve sırayla kaydeder, arama metnini ve işlem geçmişini yazar', async () => {
      const id = await saved({
        name: '  Şükrü   Işık ',
        phones: [
          { number: '0532 111 22 33', label: ' Cep ' },
          { number: '+49 30 1234567', label: '' },
        ],
      });
      const detail = await run((tx) => getCustomer(tx, actor(), id));
      expect(detail).toMatchObject({
        name: 'Şükrü Işık',
        note: null,
        version: 1,
        createdByName: 'Ayşe Demir',
        updatedByName: 'Ayşe Demir',
        phones: [
          { number: '+905321112233', label: 'Cep' },
          { number: '+49301234567', label: null },
        ],
        addresses: [],
        devices: [],
      });
      const [row] = await asOwner((tx) =>
        tx
          .select({ searchText: customers.searchText, createdBy: customers.createdBy })
          .from(customers)
          .where(eq(customers.id, id)),
      );
      expect(row).toEqual({
        searchText: 'sukru isik 05321112233 905321112233 49301234567',
        createdBy: operator.id,
      });
      const audit = await auditRows();
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        action: 'customer.created',
        actorUserId: operator.id,
        targetType: 'customer',
        targetId: id,
        details: {},
      });
    });

    it('telefonsuz müşteri kaydedilmez; boş satırlar atlanır', async () => {
      expect(
        await errorOf(create({ name: 'Ali', phones: [{ number: '', label: '' }, { number: '  ', label: '' }] })),
      ).toMatchObject({ kind: 'validation', fieldErrors: { 'phones.0.number': PHONE_MESSAGES.empty } });
      expect(await errorOf(create({ name: 'Ali', phones: [] }))).toMatchObject({
        kind: 'validation',
        fieldErrors: { phones: LAST_PHONE_MESSAGE },
      });
      const ok = await create({
        name: 'Ali',
        phones: [
          { number: '', label: '' },
          { number: '0532 111 22 44', label: '' },
        ],
      });
      expect(ok.kind).toBe('saved');
    });

    it('her hata kendi alanında: ad, listede tekrar, geçersiz numara', async () => {
      const err = await errorOf(
        create({
          name: '   ',
          phones: [
            { number: '0532 111 22 33', label: '' },
            { number: '532-111-2233', label: '' },
            { number: '123', label: '' },
          ],
        }),
      );
      expect(err).toMatchObject({
        kind: 'validation',
        fieldErrors: {
          name: 'Adı yazın: ad soyad ya da firma adı.',
          'phones.1.number': 'Bu numara listede iki kez yazılmış.',
          'phones.2.number': PHONE_MESSAGES.invalid,
        },
      });
    });

    it('en çok 10 telefon', async () => {
      const phones = Array.from({ length: 11 }, (_, i) => ({
        number: `0532 111 22 ${String(i).padStart(2, '0')}`,
        label: '',
      }));
      expect(await errorOf(create({ name: 'Çok Numaralı', phones }))).toMatchObject({
        kind: 'validation',
        fieldErrors: { phones: 'En fazla 10 telefon numarası eklenebilir.' },
      });
    });

    it('ilk adresle birlikte kaydeder; il ve ilçe listeden olmalı', async () => {
      const address = {
        label: 'Ev',
        province: 'İstanbul',
        district: 'Kadıköy',
        neighborhood: 'Caferağa',
        addressLine: 'Moda Cad. No: 5',
        directions: 'Yeşil kapı',
      };
      const id = await saved({ name: 'Adresli', address: { ...address, location: null } });
      const detail = await run((tx) => getCustomer(tx, actor(), id));
      expect(detail.addresses).toMatchObject([
        { ...address, latitude: null, locationSource: null, version: 1, deviceCount: 0 },
      ]);
      expect(
        await errorOf(create({ name: 'X', address: { ...address, province: 'Atlantis', location: null } })),
      ).toMatchObject({ fieldErrors: { 'address.province': 'Listeden bir il seçin.' } });
      expect(
        await errorOf(create({ name: 'X', address: { ...address, province: 'İzmir', location: null } })),
      ).toMatchObject({
        fieldErrors: { 'address.district': 'Seçtiğiniz ilin ilçelerinden birini seçin.' },
      });
    });
  });

  describe('çift numara', () => {
    it('başka müşteride kayıtlı numarada uyarır ve kaydetmez; onayla kaydeder', async () => {
      const first = await saved({ name: 'Ayşe Yılmaz' });
      const warned = await create({
        name: 'Mehmet Yılmaz',
        phones: [{ number: '+90 532 111 22 33', label: '' }],
      });
      expect(warned).toEqual({
        kind: 'duplicate_phone',
        owners: [{ number: '+905321112233', customerId: first, customerName: 'Ayşe Yılmaz' }],
      });
      expect(await customerCount()).toBe(1);
      expect((await create({ name: 'Mehmet Yılmaz', confirmDuplicate: true })).kind).toBe('saved');
      expect(await customerCount()).toBe(2);
    });

    it('aynı ad uyarı vermez', async () => {
      await saved({ name: 'Ali Kaya' });
      expect(
        (await create({ name: 'Ali Kaya', phones: [{ number: '0532 222 33 44', label: '' }] })).kind,
      ).toBe('saved');
    });

    it('başka firmadaki aynı numara uyarı vermez', async () => {
      const other = await seedTenant(owner);
      const otherUser = await seedUser(owner, other.id);
      await withTenant(app, other.id, (tx) =>
        createCustomer(
          tx,
          actorFor(otherUser, other.code),
          { name: 'Başka Firma', phones: [{ number: '0532 111 22 33', label: '' }] },
          clock,
        ),
      );
      expect((await create({ name: 'Bizim Müşteri' })).kind).toBe('saved');
    });

    it('aynı numarayla eşzamanlı iki kayıt (çift dokunma) ikinci müşteriyi açmaz', async () => {
      const input = { name: 'Ali Veli', phones: [{ number: '0532 999 00 11', label: '' }] };
      const results = await Promise.all([create(input), create(input)]);
      expect(results.map((r) => r.kind).sort()).toEqual(['duplicate_phone', 'saved']);
      expect(await customerCount()).toBe(1);
    });

    it('canlı denetim numarayı biçimden bağımsız bulur, düzenlenen müşteriyi saymaz', async () => {
      const id = await saved({ name: 'Ayşe Yılmaz' });
      expect(await run((tx) => findPhoneOwners(tx, actor(), '0532-111-2233', null))).toEqual([
        { number: '+905321112233', customerId: id, customerName: 'Ayşe Yılmaz' },
      ]);
      expect(await run((tx) => findPhoneOwners(tx, actor(), '0532 111 22 33', id))).toEqual([]);
      expect(await run((tx) => findPhoneOwners(tx, actor(), 'yarım', null))).toEqual([]);
    });
  });

  describe('düzenleme', () => {
    const edit = (id: string, input: Record<string, unknown>) =>
      run((tx) =>
        updateCustomer(
          tx,
          actor(),
          id,
          { version: 1, note: '', phones: [{ number: '0532 111 22 33', label: '' }], ...input },
          clock,
        ),
      );

    it('ad, not ve telefonları değiştirir, sürümü artırır, geçmişe yalnızca alan adlarını yazar', async () => {
      const id = await saved({ name: 'Ayşe Yılmaz' });
      clock.advance(MINUTE);
      const result = await edit(id, {
        name: 'Ayşe Kaya',
        note: '  Kapıcıya   haber verin.\n\n\n\nZil bozuk. ',
        phones: [
          { number: '0555 123 45 67', label: 'İş' },
          { number: '0532 111 22 33', label: '' },
        ],
      });
      expect(result).toEqual({ kind: 'saved', id });
      const detail = await run((tx) => getCustomer(tx, actor(), id));
      expect(detail).toMatchObject({
        name: 'Ayşe Kaya',
        note: 'Kapıcıya haber verin.\n\nZil bozuk.',
        version: 2,
        phones: [
          { number: '+905551234567', label: 'İş' },
          { number: '+905321112233', label: null },
        ],
      });
      expect(detail.updatedAt.getTime()).toBe(clock.now().getTime());
      const audit = (await auditRows()).at(-1)!;
      expect(audit).toMatchObject({
        action: 'customer.updated',
        targetId: id,
        details: { fields: ['name', 'note', 'phones'] },
      });
      expect(JSON.stringify(audit.details)).not.toMatch(/Ayşe|Kaya|5551234567|Zil/);
    });

    it('değişiklik yoksa sürüm artmaz, geçmiş yazılmaz', async () => {
      const id = await saved({ name: 'Ayşe Yılmaz' });
      await edit(id, { name: ' Ayşe  Yılmaz ' });
      expect((await run((tx) => getCustomer(tx, actor(), id))).version).toBe(1);
      expect(await auditRows()).toHaveLength(1);
    });

    it('ana numara: sıra değişince telefonlar değişmiş sayılır', async () => {
      const phones = [
        { number: '0532 111 22 33', label: '' },
        { number: '0212 444 55 66', label: 'Ev' },
      ];
      const id = await saved({ name: 'İki Numaralı', phones });
      await edit(id, { name: 'İki Numaralı', phones: [phones[1], phones[0]] });
      const detail = await run((tx) => getCustomer(tx, actor(), id));
      expect(detail.phones.map((p) => p.number)).toEqual(['+902124445566', '+905321112233']);
      expect((await auditRows()).at(-1)).toMatchObject({ details: { fields: ['phones'] } });
    });

    it('son telefon kaldırılamaz', async () => {
      const id = await saved({ name: 'Tek Numaralı' });
      expect(await errorOf(edit(id, { name: 'Tek Numaralı', phones: [] }))).toMatchObject({
        kind: 'validation',
        fieldErrors: { phones: LAST_PHONE_MESSAGE },
      });
    });

    it('sürüm çakışması: ikinci düzenleme reddedilir, kayıt ilkinde kalır', async () => {
      const id = await saved({ name: 'Ayşe Yılmaz' });
      await edit(id, { name: 'Birinci' });
      expect(await errorOf(edit(id, { name: 'İkinci' }))).toMatchObject({
        kind: 'stale',
        userMessage: STALE_MESSAGE,
      });
      expect((await run((tx) => getCustomer(tx, actor(), id))).name).toBe('Birinci');
    });

    it('yalnızca yeni eklenen numara için çift uyarısı verir', async () => {
      const ayse = await saved({ name: 'Ayşe Yılmaz' });
      const mehmet = await saved({
        name: 'Mehmet Yılmaz',
        phones: [{ number: '0532 999 88 77', label: '' }],
      });
      const shared = [
        { number: '0532 999 88 77', label: '' },
        { number: '0532 111 22 33', label: 'Eşi' },
      ];
      expect(await edit(mehmet, { name: 'Mehmet Yılmaz', phones: shared })).toEqual({
        kind: 'duplicate_phone',
        owners: [{ number: '+905321112233', customerId: ayse, customerName: 'Ayşe Yılmaz' }],
      });
      await edit(mehmet, { name: 'Mehmet Yılmaz', phones: shared, confirmDuplicate: true });
      const renamed = await edit(mehmet, { version: 2, name: 'Mehmet Y.', phones: shared });
      expect(renamed.kind).toBe('saved');
    });

    it('olmayan ya da biçimsiz kimlik "bulunamadı"', async () => {
      expect(await errorOf(run((tx) => getCustomer(tx, actor(), 'olmayan')))).toMatchObject({
        kind: 'not_found',
      });
      expect(
        await errorOf(
          run((tx) => getCustomer(tx, actor(), '00000000-0000-7000-8000-000000000000')),
        ),
      ).toMatchObject({ kind: 'not_found' });
    });
  });
});
```

- [ ] **Adım 2: Kırmızıyı gör**

Run: `npx vitest run --project integration tests/integration/musteriler.test.ts`
Expected: FAIL, `@/server/customers/service` yok.

- [ ] **Adım 3: `src/server/customers/common.ts`**

```ts
import { and, eq } from 'drizzle-orm';
import { buildSearchText } from '@/lib/search';
import type { Actor } from '@/server/auth/actor';
import { customerAddresses, customerPhones, customers } from '@/server/db/schema';
import { isUuid, type TenantTx } from '@/server/db/tenant';
import { notFoundError } from '@/server/errors';
import { z } from '@/server/validation';

export const LIMITS = { phones: 10, addresses: 50, devices: 200 } as const;

/** Tek satırlık metin: kırpılır, art arda boşluklar teke iner. */
export const collapseSpaces = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** Çok satırlı metin (not): satır içi boşluklar teke iner, en çok bir boş satır kalır. */
export const tidyMultiline = (value: string): string =>
  value
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export function requiredLine(max: number, emptyMessage: string, tooLongMessage: string) {
  return z
    .string({ error: emptyMessage })
    .transform(collapseSpaces)
    .pipe(z.string().min(1, emptyMessage).max(max, tooLongMessage));
}

/** Boş bırakılabilen tek satır: boşsa null. */
export function optionalLine(max: number, tooLongMessage: string) {
  return z
    .string()
    .nullish()
    .transform((v) => collapseSpaces(v ?? ''))
    .pipe(z.string().max(max, tooLongMessage))
    .transform((v) => (v === '' ? null : v));
}

export function optionalMultiline(max: number, tooLongMessage: string) {
  return z
    .string()
    .nullish()
    .transform((v) => tidyMultiline(v ?? ''))
    .pipe(z.string().max(max, tooLongMessage))
    .transform((v) => (v === '' ? null : v));
}

export const customerScope = (actor: Actor, id: string) =>
  and(eq(customers.tenantId, actor.tenantId), eq(customers.id, id));

/**
 * Müşteri satırını kilitler: aynı müşteriye eşzamanlı alt kayıt eklemeler sınırı aşamaz, adres kaldırma ile cihaz
 * kaydı sıraya girer, sürüm karşılaştırması güvenilir olur. Kayıt yoksa (başka firmanınki dahil) "bulunamadı".
 */
export async function lockCustomer(
  tx: TenantTx,
  actor: Actor,
  id: string,
): Promise<{ id: string; name: string; note: string | null; version: number }> {
  if (!isUuid(id)) throw notFoundError();
  const [row] = await tx
    .select({ id: customers.id, name: customers.name, note: customers.note, version: customers.version })
    .from(customers)
    .where(customerScope(actor, id))
    .for('update');
  if (!row) throw notFoundError();
  return row;
}

/** Alt kayıt (adres, cihaz) değişince: müşteri "son güncellenen" olur, arama metni yenilenir; sürüm artmaz. */
export async function touchCustomer(
  tx: TenantTx,
  actor: Actor,
  customerId: string,
  now: Date,
): Promise<void> {
  await tx
    .update(customers)
    .set({ updatedAt: now, updatedBy: actor.userId })
    .where(customerScope(actor, customerId));
  await refreshSearchText(tx, actor, customerId);
}

/** search_text'i ad, telefonlar ve adreslerden yeniden üretir. Müşteriyi ya da alt kaydı değiştiren her işlem çağırır. */
export async function refreshSearchText(
  tx: TenantTx,
  actor: Actor,
  customerId: string,
): Promise<void> {
  const [customer] = await tx
    .select({ name: customers.name })
    .from(customers)
    .where(customerScope(actor, customerId));
  if (!customer) return;
  const phones = await tx
    .select({ number: customerPhones.number })
    .from(customerPhones)
    .where(and(eq(customerPhones.tenantId, actor.tenantId), eq(customerPhones.customerId, customerId)))
    .orderBy(customerPhones.position);
  const addresses = await tx
    .select({
      province: customerAddresses.province,
      district: customerAddresses.district,
      neighborhood: customerAddresses.neighborhood,
      addressLine: customerAddresses.addressLine,
    })
    .from(customerAddresses)
    .where(
      and(eq(customerAddresses.tenantId, actor.tenantId), eq(customerAddresses.customerId, customerId)),
    )
    .orderBy(customerAddresses.position, customerAddresses.id);
  await tx
    .update(customers)
    .set({ searchText: buildSearchText(customer.name, phones.map((p) => p.number), addresses) })
    .where(customerScope(actor, customerId));
}
```

- [ ] **Adım 4: `src/server/customers/address-input.ts`**

```ts
import { LOCATION_SOURCES } from '@/lib/geo';
import { findDistrict, findProvince } from '@/lib/tr-il-ilce';
import type { Actor } from '@/server/auth/actor';
import { customerAddresses } from '@/server/db/schema';
import type { TenantTx } from '@/server/db/tenant';
import { z } from '@/server/validation';
import { optionalLine, requiredLine } from './common';

export const LOCATION_MESSAGE = 'Konum okunamadı. Haritadan ya da bağlantıyla yeniden işaretleyin.';

const locationSchema = z.object(
  {
    latitude: z.number({ error: LOCATION_MESSAGE }).min(-90, LOCATION_MESSAGE).max(90, LOCATION_MESSAGE),
    longitude: z
      .number({ error: LOCATION_MESSAGE })
      .min(-180, LOCATION_MESSAGE)
      .max(180, LOCATION_MESSAGE),
    source: z.enum(LOCATION_SOURCES, { error: LOCATION_MESSAGE }),
  },
  { error: LOCATION_MESSAGE },
);

/** Süzgeçsiz adres alanları; düzenleme şeması buna "version" ekler (Zod 4'te süzgeçli nesne genişletilemez). */
export const addressFields = z.object({
  label: optionalLine(40, 'Etiket en fazla 40 karakter olabilir.'),
  province: z.string({ error: 'İl seçin.' }).trim().min(1, 'İl seçin.'),
  district: z.string({ error: 'İlçe seçin.' }).trim().min(1, 'İlçe seçin.'),
  neighborhood: optionalLine(80, 'Mahalle en fazla 80 karakter olabilir.'),
  addressLine: requiredLine(
    250,
    'Açık adresi yazın: cadde/sokak, bina ve daire no.',
    'Açık adres en fazla 250 karakter olabilir.',
  ),
  directions: optionalLine(250, 'Tarif en fazla 250 karakter olabilir.'),
  location: locationSchema.nullish().transform((v) => v ?? null),
});

/** İl ve ilçe sabit listeden olmalı (tarayıcıdaki seçim kutusuna güvenilmez). */
export function checkPlace(
  value: { province: string; district: string },
  ctx: z.RefinementCtx,
): void {
  if (!value.province || !value.district) return;
  const province = findProvince(value.province);
  if (!province) {
    ctx.addIssue({ code: 'custom', path: ['province'], message: 'Listeden bir il seçin.' });
  } else if (!findDistrict(province.name, value.district)) {
    ctx.addIssue({
      code: 'custom',
      path: ['district'],
      message: 'Seçtiğiniz ilin ilçelerinden birini seçin.',
    });
  }
}

export const addressSchema = addressFields.superRefine(checkPlace);
export type AddressInput = z.output<typeof addressFields>;

/** Konum 6 ondalığa (yaklaşık 10 cm) yuvarlanır; "konum değişti mi" karşılaştırması da bu hassasiyetle yapılır. */
export const roundCoordinate = (n: number): number => Math.round(n * 1e6) / 1e6;

export function locationColumns(location: AddressInput['location'], actor: Actor, now: Date) {
  return location
    ? {
        latitude: roundCoordinate(location.latitude),
        longitude: roundCoordinate(location.longitude),
        locationSource: location.source,
        locationSetBy: actor.userId,
        locationSetAt: now,
      }
    : {
        latitude: null,
        longitude: null,
        locationSource: null,
        locationSetBy: null,
        locationSetAt: null,
      };
}

export async function insertAddress(
  tx: TenantTx,
  actor: Actor,
  customerId: string,
  input: AddressInput,
  position: number,
  now: Date,
): Promise<string> {
  const [row] = await tx
    .insert(customerAddresses)
    .values({
      tenantId: actor.tenantId,
      customerId,
      label: input.label,
      province: input.province,
      district: input.district,
      neighborhood: input.neighborhood,
      addressLine: input.addressLine,
      directions: input.directions,
      ...locationColumns(input.location, actor, now),
      position,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: customerAddresses.id });
  return row!.id;
}
```

> `z.RefinementCtx` Zod 4'te dışa aktarılır. Tip denetimi bulamazsa `checkPlace`'in ikinci parametresini `ctx: { addIssue: (issue: { code: 'custom'; path: string[]; message: string }) => void }` olarak yaz.

- [ ] **Adım 5: `src/server/customers/service.ts`**

```ts
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { DeviceType } from '@/lib/device-types';
import type { LocationSource } from '@/lib/geo';
import { PHONE_MESSAGES, cleanPhoneInput, parsePhone } from '@/lib/phone';
import { recordAudit } from '@/server/audit/audit';
import type { Actor } from '@/server/auth/actor';
import type { Clock } from '@/server/clock';
import {
  customerAddresses,
  customerDevices,
  customerPhones,
  customers,
  users,
} from '@/server/db/schema';
import { isUuid, type TenantTx } from '@/server/db/tenant';
import { notFoundError, staleError, validationError } from '@/server/errors';
import { requirePermission } from '@/server/permissions';
import { fieldErrorsFrom, z } from '@/server/validation';
import { addressSchema, insertAddress } from './address-input';
import {
  LIMITS,
  customerScope,
  lockCustomer,
  optionalLine,
  optionalMultiline,
  refreshSearchText,
  requiredLine,
} from './common';

export interface PhoneInput {
  number: string;
  label: string | null;
}
export type CustomerPhone = PhoneInput;

export interface PhoneOwner {
  number: string;
  customerId: string;
  customerName: string;
}

export type SaveCustomerResult =
  | { kind: 'saved'; id: string }
  | { kind: 'duplicate_phone'; owners: PhoneOwner[] };

export interface CustomerAddress {
  id: string;
  label: string | null;
  province: string;
  district: string;
  neighborhood: string | null;
  addressLine: string;
  directions: string | null;
  latitude: number | null;
  longitude: number | null;
  locationSource: LocationSource | null;
  locationSetAt: Date | null;
  version: number;
  deviceCount: number;
}

export interface CustomerDevice {
  id: string;
  addressId: string | null;
  type: DeviceType;
  typeOther: string | null;
  brand: string | null;
  model: string | null;
  serialNo: string | null;
  installedOn: string | null;
  warrantyUntil: string | null;
  note: string | null;
  version: number;
}

export interface CustomerDetail {
  id: string;
  name: string;
  note: string | null;
  version: number;
  phones: CustomerPhone[];
  addresses: CustomerAddress[];
  devices: CustomerDevice[];
  createdAt: Date;
  createdByName: string;
  updatedAt: Date;
  updatedByName: string;
}

export const LAST_PHONE_MESSAGE = 'En az bir telefon numarası olmalı.';
const DUPLICATE_IN_LIST = 'Bu numara listede iki kez yazılmış.';

const nameField = requiredLine(
  120,
  'Adı yazın: ad soyad ya da firma adı.',
  'Ad en fazla 120 karakter olabilir.',
);
const phoneRow = z.object({
  number: z.string().default(''),
  label: optionalLine(40, 'Etiket en fazla 40 karakter olabilir.'),
});
const phonesField = z
  .array(phoneRow, { error: 'Telefonlar okunamadı. Sayfayı yenileyip yeniden deneyin.' })
  .max(LIMITS.phones, `En fazla ${LIMITS.phones} telefon numarası eklenebilir.`);

const createSchema = z.object({
  name: nameField,
  phones: phonesField,
  address: addressSchema.nullish(),
  confirmDuplicate: z.boolean().default(false),
});

const updateSchema = z.object({
  version: z.number({ error: 'Sayfayı yenileyip yeniden deneyin.' }).int().positive(),
  name: nameField,
  note: optionalMultiline(2000, 'Not en fazla 2000 karakter olabilir.'),
  phones: phonesField,
  confirmDuplicate: z.boolean().default(false),
});

const phonesOf = (actor: Actor, customerId: string) =>
  and(eq(customerPhones.tenantId, actor.tenantId), eq(customerPhones.customerId, customerId));

/** Satır satır: boş satır atlanır, her satırın hatası kendi anahtarında ("phones.1.number"). */
function parsePhoneRows(
  rows: ReadonlyArray<{ number: string; label: string | null }>,
  errors: Record<string, string>,
): PhoneInput[] {
  if (rows.length === 0) {
    errors.phones ??= LAST_PHONE_MESSAGE;
    return [];
  }
  const phones: PhoneInput[] = [];
  rows.forEach((row, i) => {
    if (cleanPhoneInput(row.number) === '' && row.label === null) return;
    const parsed = parsePhone(row.number);
    if (!parsed.ok) {
      errors[`phones.${i}.number`] ??= parsed.message;
    } else if (phones.some((p) => p.number === parsed.e164)) {
      errors[`phones.${i}.number`] ??= DUPLICATE_IN_LIST;
    } else {
      phones.push({ number: parsed.e164, label: row.label });
    }
  });
  if (phones.length === 0 && !Object.keys(errors).some((k) => k.startsWith('phones'))) {
    errors['phones.0.number'] = PHONE_MESSAGES.empty;
  }
  return phones;
}

/** Şema hatalarıyla birlikte telefon satırlarını da denetler: kullanıcı bütün hataları bir seferde görür. */
function validateWithPhones<T>(
  schema: z.ZodType<T>,
  raw: unknown,
): { data: T; phones: PhoneInput[] } {
  const parsed = schema.safeParse(raw);
  const errors: Record<string, string> = parsed.success ? {} : fieldErrorsFrom(parsed.error);
  const rows = phonesField.safeParse((raw as { phones?: unknown } | null)?.phones ?? []);
  const phones = rows.success ? parsePhoneRows(rows.data, errors) : [];
  if (!parsed.success || Object.keys(errors).length > 0) throw validationError(errors);
  return { data: parsed.data, phones };
}

/**
 * Aynı numarayla eşzamanlı iki kayıt (çift dokunma) ikisi de "çift yok" görüp geçmesin: numara başına işlem kilidi.
 * Sıralı alınır: iki işlem aynı numaraları ters sırada bekleyip kilitlenmez.
 */
async function lockNumbers(tx: TenantTx, actor: Actor, numbers: readonly string[]): Promise<void> {
  for (const number of [...numbers].sort()) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`${actor.tenantId}:${number}`}, 0))`,
    );
  }
}

async function phoneOwners(
  tx: TenantTx,
  actor: Actor,
  numbers: readonly string[],
  excludeCustomerId: string | null,
): Promise<PhoneOwner[]> {
  if (numbers.length === 0) return [];
  const conditions = [
    eq(customerPhones.tenantId, actor.tenantId),
    inArray(customerPhones.number, [...numbers]),
  ];
  if (excludeCustomerId) conditions.push(ne(customerPhones.customerId, excludeCustomerId));
  return tx
    .select({
      number: customerPhones.number,
      customerId: customers.id,
      customerName: customers.name,
    })
    .from(customerPhones)
    .innerJoin(
      customers,
      and(eq(customers.tenantId, customerPhones.tenantId), eq(customers.id, customerPhones.customerId)),
    )
    .where(and(...conditions))
    .orderBy(customers.name, customers.id)
    .limit(20);
}

async function insertPhones(
  tx: TenantTx,
  actor: Actor,
  customerId: string,
  phones: readonly PhoneInput[],
): Promise<void> {
  if (phones.length === 0) return;
  await tx.insert(customerPhones).values(
    phones.map((p, position) => ({
      tenantId: actor.tenantId,
      customerId,
      number: p.number,
      label: p.label,
      position,
    })),
  );
}

export async function createCustomer(
  tx: TenantTx,
  actor: Actor,
  raw: unknown,
  clock: Clock,
): Promise<SaveCustomerResult> {
  requirePermission(actor, 'customer.manage');
  const { data, phones } = validateWithPhones(createSchema, raw);
  const numbers = phones.map((p) => p.number);
  await lockNumbers(tx, actor, numbers);
  const owners = await phoneOwners(tx, actor, numbers, null);
  if (owners.length > 0 && !data.confirmDuplicate) return { kind: 'duplicate_phone', owners };

  const now = clock.now();
  const [row] = await tx
    .insert(customers)
    .values({
      tenantId: actor.tenantId,
      name: data.name,
      createdBy: actor.userId,
      updatedBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: customers.id });
  const id = row!.id;
  await insertPhones(tx, actor, id, phones);
  if (data.address) await insertAddress(tx, actor, id, data.address, 0, now);
  await refreshSearchText(tx, actor, id);
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'customer.created',
    target: { type: 'customer', id },
    at: now,
  });
  return { kind: 'saved', id };
}

export async function getCustomer(
  tx: TenantTx,
  actor: Actor,
  id: string,
): Promise<CustomerDetail> {
  requirePermission(actor, 'customer.view');
  if (!isUuid(id)) throw notFoundError();
  const creator = alias(users, 'creator');
  const updater = alias(users, 'updater');
  const [row] = await tx
    .select({
      id: customers.id,
      name: customers.name,
      note: customers.note,
      version: customers.version,
      createdAt: customers.createdAt,
      updatedAt: customers.updatedAt,
      createdByName: creator.fullName,
      updatedByName: updater.fullName,
    })
    .from(customers)
    .innerJoin(creator, and(eq(creator.tenantId, customers.tenantId), eq(creator.id, customers.createdBy)))
    .innerJoin(updater, and(eq(updater.tenantId, customers.tenantId), eq(updater.id, customers.updatedBy)))
    .where(customerScope(actor, id))
    .limit(1);
  if (!row) throw notFoundError();

  const phones = await tx
    .select({ number: customerPhones.number, label: customerPhones.label })
    .from(customerPhones)
    .where(phonesOf(actor, id))
    .orderBy(customerPhones.position);
  const addresses = await tx
    .select({
      id: customerAddresses.id,
      label: customerAddresses.label,
      province: customerAddresses.province,
      district: customerAddresses.district,
      neighborhood: customerAddresses.neighborhood,
      addressLine: customerAddresses.addressLine,
      directions: customerAddresses.directions,
      latitude: customerAddresses.latitude,
      longitude: customerAddresses.longitude,
      locationSource: customerAddresses.locationSource,
      locationSetAt: customerAddresses.locationSetAt,
      version: customerAddresses.version,
      deviceCount: sql<number>`(select count(*)::int from customer_devices d where d.tenant_id = ${customerAddresses.tenantId} and d.customer_id = ${customerAddresses.customerId} and d.address_id = ${customerAddresses.id})`,
    })
    .from(customerAddresses)
    .where(and(eq(customerAddresses.tenantId, actor.tenantId), eq(customerAddresses.customerId, id)))
    .orderBy(customerAddresses.position, customerAddresses.id);
  const devices = await tx
    .select({
      id: customerDevices.id,
      addressId: customerDevices.addressId,
      type: customerDevices.type,
      typeOther: customerDevices.typeOther,
      brand: customerDevices.brand,
      model: customerDevices.model,
      serialNo: customerDevices.serialNo,
      installedOn: customerDevices.installedOn,
      warrantyUntil: customerDevices.warrantyUntil,
      note: customerDevices.note,
      version: customerDevices.version,
    })
    .from(customerDevices)
    .where(and(eq(customerDevices.tenantId, actor.tenantId), eq(customerDevices.customerId, id)))
    .orderBy(customerDevices.createdAt, customerDevices.id);
  return { ...row, phones, addresses, devices };
}

export async function updateCustomer(
  tx: TenantTx,
  actor: Actor,
  id: string,
  raw: unknown,
  clock: Clock,
): Promise<SaveCustomerResult> {
  requirePermission(actor, 'customer.manage');
  const { data, phones } = validateWithPhones(updateSchema, raw);
  const current = await lockCustomer(tx, actor, id);
  if (current.version !== data.version) throw staleError();

  const oldPhones = await tx
    .select({ number: customerPhones.number, label: customerPhones.label })
    .from(customerPhones)
    .where(phonesOf(actor, id))
    .orderBy(customerPhones.position);
  // Daha önce onaylanmış ortak numara her düzenlemede yeniden uyarmasın: yalnızca yeni eklenenler denetlenir.
  const added = phones.map((p) => p.number).filter((n) => !oldPhones.some((o) => o.number === n));
  await lockNumbers(tx, actor, added);
  const owners = await phoneOwners(tx, actor, added, id);
  if (owners.length > 0 && !data.confirmDuplicate) return { kind: 'duplicate_phone', owners };

  const fields: string[] = [];
  if (data.name !== current.name) fields.push('name');
  if (data.note !== current.note) fields.push('note');
  if (JSON.stringify(oldPhones) !== JSON.stringify(phones)) fields.push('phones');
  if (fields.length === 0) return { kind: 'saved', id };

  const now = clock.now();
  await tx
    .update(customers)
    .set({
      name: data.name,
      note: data.note,
      version: current.version + 1,
      updatedAt: now,
      updatedBy: actor.userId,
    })
    .where(customerScope(actor, id));
  if (fields.includes('phones')) {
    await tx.delete(customerPhones).where(phonesOf(actor, id));
    await insertPhones(tx, actor, id, phones);
  }
  await refreshSearchText(tx, actor, id);
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'customer.updated',
    target: { type: 'customer', id },
    details: { fields },
    at: now,
  });
  return { kind: 'saved', id };
}

/** Formda numara yazılırken çağrılır: firmada bu numara başka müşteride kayıtlı mı? Başka firmaya bakmaz. */
export async function findPhoneOwners(
  tx: TenantTx,
  actor: Actor,
  rawNumber: string,
  excludeCustomerId: string | null,
): Promise<PhoneOwner[]> {
  requirePermission(actor, 'customer.view');
  const parsed = parsePhone(rawNumber);
  if (!parsed.ok) return [];
  const exclude = excludeCustomerId && isUuid(excludeCustomerId) ? excludeCustomerId : null;
  return phoneOwners(tx, actor, [parsed.e164], exclude);
}
```

> `JSON.stringify(oldPhones) !== JSON.stringify(phones)`: iki dizi de `{ number, label }` anahtar sırasıyla kurulur (seçim listesi ve `parsePhoneRows`); sıra değişikliği de "phones" sayılır (ana numara).

- [ ] **Adım 6: Yeşili gör**

Run: `npx vitest run --project integration tests/integration/musteriler.test.ts`
Expected: PASS (bütün `it` satırları).

- [ ] **Adım 7: Commit**

```bash
npm run format && npm run lint && npm run typecheck
git add src/server/customers tests/integration/musteriler.test.ts
git commit -m "Müşteriler: müşteri servisi (telefonlar, çift numara uyarısı, sürüm koruması, arama metni)"
```

---

### Görev 6: Adres ve cihaz servisi

**Files:**
- Create: `src/server/customers/addresses.ts`, `src/server/customers/devices.ts`
- Test: `tests/integration/musteri-adres-cihaz.test.ts`

**Interfaces:**
- Consumes: Görev 5'in `addressFields`, `addressSchema`, `checkPlace`, `insertAddress`, `locationColumns`, `roundCoordinate`, `LIMITS`, `lockCustomer`, `touchCustomer`, `optionalLine`, `optionalMultiline`; `DEVICE_TYPE_VALUES`
- Produces:
  - `addresses.ts`: `addressScope(actor, customerId, addressId)`, `addAddress(tx, actor, customerId, raw, clock): Promise<{ id: string }>`, `updateAddress(tx, actor, customerId, addressId, raw, clock): Promise<void>` (`raw` = adres alanları + `version`), `removeAddress(tx, actor, customerId, addressId, clock): Promise<void>`, `lastUsedProvince(tx, actor): Promise<string | null>`
  - `devices.ts`: `DEVICE_MESSAGES = { addressGone, typeOther, warranty, invalidDate }`, `addDevice(tx, actor, customerId, raw, clock): Promise<{ id: string }>`, `updateDevice(tx, actor, customerId, deviceId, raw, clock): Promise<void>`, `removeDevice(tx, actor, customerId, deviceId, clock): Promise<void>`
  - Cihaz girdisi: `{ addressId: string | null; type: DeviceType; typeOther; brand; model; serialNo: string | null; installedOn; warrantyUntil: 'YYYY-MM-DD' | '' | null; note: string | null; version?: number }`

- [ ] **Adım 1: Entegrasyon testini yaz**

`tests/integration/musteri-adres-cihaz.test.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEVICE_TYPE_VALUES } from '@/lib/device-types';
import { LOCATION_MESSAGE } from '@/server/customers/address-input';
import {
  addAddress,
  lastUsedProvince,
  removeAddress,
  updateAddress,
} from '@/server/customers/addresses';
import { DEVICE_MESSAGES, addDevice, removeDevice, updateDevice } from '@/server/customers/devices';
import { createCustomer, getCustomer } from '@/server/customers/service';
import {
  auditLog,
  customerAddresses,
  customerDevices,
  customers,
  type UserRow,
} from '@/server/db/schema';
import { withTenant, type TenantTx } from '@/server/db/tenant';
import type { AppError } from '@/server/errors';
import { MINUTE, createFakeClock } from '../helpers/clock';
import { useTestDbs } from '../helpers/db';
import { actorFor, seedTenant, seedUser, type SeededTenant } from '../helpers/fabrika';

const clock = createFakeClock();

const ADDRESS = {
  label: 'Ev',
  province: 'İstanbul',
  district: 'Kadıköy',
  neighborhood: 'Caferağa',
  addressLine: 'Moda Cad. No: 5',
  directions: null,
  location: null,
};

describe('adres ve cihaz servisi', () => {
  const { app, owner } = useTestDbs();
  let tenant: SeededTenant;
  let operator: UserRow;
  let customerId: string;

  const run = <T>(fn: (tx: TenantTx) => Promise<T>) => withTenant(app, tenant.id, fn);
  const asOwner = <T>(fn: (tx: TenantTx) => Promise<T>) => withTenant(owner, tenant.id, fn);
  const actor = () => actorFor(operator, tenant.code);
  const errorOf = (promise: Promise<unknown>) =>
    promise.then(
      () => undefined,
      (e: unknown) => e as AppError,
    );
  const newCustomer = async (name: string, number: string) => {
    const result = await run((tx) =>
      createCustomer(tx, actor(), { name, phones: [{ number, label: '' }] }, clock),
    );
    if (result.kind !== 'saved') throw new Error('müşteri kaydedilmedi');
    return result.id;
  };
  const auditOf = async (action: string) =>
    (
      await asOwner((tx) =>
        tx
          .select()
          .from(auditLog)
          .where(and(eq(auditLog.tenantId, tenant.id), eq(auditLog.action, action)))
          .orderBy(auditLog.id),
      )
    ).map((row) => row.details);

  beforeEach(async () => {
    tenant = await seedTenant(owner);
    operator = await seedUser(owner, tenant.id, { role: 'operator' });
    customerId = await newCustomer('Şükrü Işık', '0532 111 22 33');
  });

  describe('adresler', () => {
    it('ekler: sıra, konum bilgisi, arama metni; müşteri "son güncellenen" olur, sürümü değişmez', async () => {
      clock.advance(MINUTE);
      const first = await run((tx) => addAddress(tx, actor(), customerId, ADDRESS, clock));
      const second = await run((tx) =>
        addAddress(
          tx,
          actor(),
          customerId,
          {
            ...ADDRESS,
            label: 'Yazlık',
            province: 'Muğla',
            district: 'Bodrum',
            neighborhood: null,
            addressLine: 'Gümbet Sok. 3',
            location: { latitude: 37.0344419, longitude: 27.4305412, source: 'link' },
          },
          clock,
        ),
      );
      const rows = await asOwner((tx) =>
        tx
          .select()
          .from(customerAddresses)
          .where(eq(customerAddresses.customerId, customerId))
          .orderBy(customerAddresses.position),
      );
      expect(rows.map((r) => [r.position, r.label])).toEqual([
        [0, 'Ev'],
        [1, 'Yazlık'],
      ]);
      expect(rows[0]).toMatchObject({ latitude: null, locationSource: null, locationSetBy: null });
      expect(rows[1]).toMatchObject({
        latitude: 37.034442,
        longitude: 27.430541,
        locationSource: 'link',
        locationSetBy: operator.id,
        locationSetAt: clock.now(),
      });
      const detail = await run((tx) => getCustomer(tx, actor(), customerId));
      expect(detail.version).toBe(1);
      expect(detail.updatedAt.getTime()).toBe(clock.now().getTime());
      const [row] = await asOwner((tx) =>
        tx
          .select({ searchText: customers.searchText })
          .from(customers)
          .where(eq(customers.id, customerId)),
      );
      expect(row?.searchText).toContain('mugla bodrum gumbet sok 3');
      expect(await auditOf('customer.address_added')).toEqual([
        { addressId: first.id, locationChanged: false, locationSource: null },
        { addressId: second.id, locationChanged: true, locationSource: 'link' },
      ]);
    });

    it('il/ilçe listeden olmalı; konum iki değerle, aralıkta ve bilinen kaynakla', async () => {
      const add = (input: Record<string, unknown>) =>
        errorOf(run((tx) => addAddress(tx, actor(), customerId, { ...ADDRESS, ...input }, clock)));
      expect(await add({ province: 'Atlantis' })).toMatchObject({
        fieldErrors: { province: 'Listeden bir il seçin.' },
      });
      expect(await add({ province: '', district: '' })).toMatchObject({
        fieldErrors: { province: 'İl seçin.', district: 'İlçe seçin.' },
      });
      expect(
        await add({ location: { latitude: 100, longitude: 29, source: 'manual' } }),
      ).toMatchObject({ fieldErrors: { 'location.latitude': LOCATION_MESSAGE } });
      expect(await add({ location: { latitude: 41 } })).toMatchObject({
        fieldErrors: { 'location.longitude': LOCATION_MESSAGE },
      });
      expect(
        await add({ location: { latitude: 41, longitude: 29, source: 'gps' } }),
      ).toMatchObject({ fieldErrors: { 'location.source': LOCATION_MESSAGE } });
      expect(await add({ addressLine: '   ' })).toMatchObject({
        fieldErrors: { addressLine: 'Açık adresi yazın: cadde/sokak, bina ve daire no.' },
      });
    });

    it('51. adres reddedilir', async () => {
      await asOwner((tx) =>
        tx.insert(customerAddresses).values(
          Array.from({ length: 50 }, (_, i) => ({
            tenantId: tenant.id,
            customerId,
            province: 'İstanbul',
            district: 'Kadıköy',
            addressLine: `Sokak ${i}`,
            position: i,
          })),
        ),
      );
      expect(
        await errorOf(run((tx) => addAddress(tx, actor(), customerId, ADDRESS, clock))),
      ).toMatchObject({
        kind: 'validation',
        userMessage: 'Bir müşteriye en fazla 50 adres eklenebilir.',
      });
    });

    it('düzenler: değişen alanlar; konum değişince kim/ne zaman yenilenir; aynı konum değişmiş sayılmaz', async () => {
      const location = { latitude: 41.0082, longitude: 28.9784, source: 'link' as const };
      const { id } = await run((tx) =>
        addAddress(tx, actor(), customerId, { ...ADDRESS, location }, clock),
      );
      clock.advance(MINUTE);
      await run((tx) =>
        updateAddress(
          tx,
          actor(),
          customerId,
          id,
          { ...ADDRESS, version: 1, addressLine: 'Moda Cad. No: 7', location: { ...location, source: 'manual' } },
          clock,
        ),
      );
      let [row] = await asOwner((tx) =>
        tx.select().from(customerAddresses).where(eq(customerAddresses.id, id)),
      );
      expect(row).toMatchObject({ addressLine: 'Moda Cad. No: 7', version: 2, locationSource: 'link' });
      clock.advance(MINUTE);
      await run((tx) =>
        updateAddress(
          tx,
          actor(),
          customerId,
          id,
          {
            ...ADDRESS,
            version: 2,
            addressLine: 'Moda Cad. No: 7',
            location: { latitude: 41.0091, longitude: 28.9795, source: 'manual' },
          },
          clock,
        ),
      );
      [row] = await asOwner((tx) =>
        tx.select().from(customerAddresses).where(eq(customerAddresses.id, id)),
      );
      expect(row).toMatchObject({ version: 3, locationSource: 'manual', locationSetAt: clock.now() });
      expect(await auditOf('customer.address_updated')).toEqual([
        { addressId: id, fields: ['addressLine'], locationChanged: false },
        { addressId: id, fields: [], locationChanged: true, locationSource: 'manual' },
      ]);
    });

    it('sürüm çakışması: ikinci düzenleme reddedilir', async () => {
      const { id } = await run((tx) => addAddress(tx, actor(), customerId, ADDRESS, clock));
      const edit = (addressLine: string) =>
        run((tx) =>
          updateAddress(tx, actor(), customerId, id, { ...ADDRESS, version: 1, addressLine }, clock),
        );
      await edit('Birinci');
      expect(await errorOf(edit('İkinci'))).toMatchObject({ kind: 'stale' });
    });

    it('kaldırır: o adresteki cihaz müşteride kalır, adres bağı boşalır', async () => {
      const { id } = await run((tx) => addAddress(tx, actor(), customerId, ADDRESS, clock));
      const device = await run((tx) =>
        addDevice(tx, actor(), customerId, { type: 'combi_boiler', addressId: id }, clock),
      );
      await run((tx) => removeAddress(tx, actor(), customerId, id, clock));
      const detail = await run((tx) => getCustomer(tx, actor(), customerId));
      expect(detail.addresses).toEqual([]);
      expect(detail.devices).toMatchObject([{ id: device.id, addressId: null }]);
      expect(await auditOf('customer.address_removed')).toEqual([{ addressId: id }]);
    });

    it('başka müşterinin adresi ya da olmayan adres "bulunamadı"', async () => {
      const other = await newCustomer('Başka Müşteri', '0532 999 88 77');
      const { id } = await run((tx) => addAddress(tx, actor(), other, ADDRESS, clock));
      expect(
        await errorOf(run((tx) => removeAddress(tx, actor(), customerId, id, clock))),
      ).toMatchObject({ kind: 'not_found' });
      expect(
        await errorOf(
          run((tx) =>
            updateAddress(tx, actor(), customerId, id, { ...ADDRESS, version: 1 }, clock),
          ),
        ),
      ).toMatchObject({ kind: 'not_found' });
      expect(
        await errorOf(run((tx) => removeAddress(tx, actor(), customerId, 'olmayan', clock))),
      ).toMatchObject({ kind: 'not_found' });
    });

    it('son kullanılan il: firmanın en son eklediği adresin ili', async () => {
      expect(await run((tx) => lastUsedProvince(tx, actor()))).toBeNull();
      await run((tx) => addAddress(tx, actor(), customerId, ADDRESS, clock));
      clock.advance(MINUTE);
      await run((tx) =>
        addAddress(tx, actor(), customerId, { ...ADDRESS, province: 'Muğla', district: 'Bodrum' }, clock),
      );
      expect(await run((tx) => lastUsedProvince(tx, actor()))).toBe('Muğla');
    });
  });

  describe('cihazlar', () => {
    const add = (input: Record<string, unknown>) =>
      run((tx) => addDevice(tx, actor(), customerId, input, clock));

    it('her cihaz türü kaydedilebilir (veritabanı listesi src/lib/device-types.ts ile aynı)', async () => {
      for (const type of DEVICE_TYPE_VALUES) {
        clock.advance(MINUTE); // cihazlar eklenme zamanına göre sıralanır
        await add({ type, typeOther: type === 'other' ? 'Şömine' : null });
      }
      const detail = await run((tx) => getCustomer(tx, actor(), customerId));
      expect(detail.devices.map((d) => d.type)).toEqual(DEVICE_TYPE_VALUES);
    });

    it('"Diğer" tür adı ister; başka türde yazılan ad atılır', async () => {
      expect(await errorOf(add({ type: 'other', typeOther: '  ' }))).toMatchObject({
        fieldErrors: { typeOther: DEVICE_MESSAGES.typeOther },
      });
      const { id } = await add({ type: 'air_conditioner', typeOther: 'Şömine', brand: ' Arçelik ' });
      const detail = await run((tx) => getCustomer(tx, actor(), customerId));
      expect(detail.devices.find((d) => d.id === id)).toMatchObject({
        type: 'air_conditioner',
        typeOther: null,
        brand: 'Arçelik',
      });
      expect(await errorOf(add({ type: 'jet_engine' }))).toMatchObject({
        fieldErrors: { type: 'Cihaz türünü seçin.' },
      });
    });

    it('tarihler: geçersiz tarih ve garanti/kurulum sırası', async () => {
      expect(await errorOf(add({ type: 'combi_boiler', installedOn: '2026-13-01' }))).toMatchObject({
        fieldErrors: { installedOn: DEVICE_MESSAGES.invalidDate },
      });
      expect(await errorOf(add({ type: 'combi_boiler', installedOn: '2025-02-30' }))).toMatchObject({
        fieldErrors: { installedOn: DEVICE_MESSAGES.invalidDate },
      });
      expect(
        await errorOf(
          add({ type: 'combi_boiler', installedOn: '2025-03-05', warrantyUntil: '2024-03-05' }),
        ),
      ).toMatchObject({ fieldErrors: { warrantyUntil: DEVICE_MESSAGES.warranty } });
      const { id } = await add({
        type: 'combi_boiler',
        installedOn: '2025-03-05',
        warrantyUntil: '2027-03-05',
      });
      const detail = await run((tx) => getCustomer(tx, actor(), customerId));
      expect(detail.devices.find((d) => d.id === id)).toMatchObject({
        installedOn: '2025-03-05',
        warrantyUntil: '2027-03-05',
      });
    });

    it('yalnızca kendi müşterisinin adresine bağlanır', async () => {
      const other = await newCustomer('Başka Müşteri', '0532 999 88 77');
      const { id } = await run((tx) => addAddress(tx, actor(), other, ADDRESS, clock));
      expect(await errorOf(add({ type: 'combi_boiler', addressId: id }))).toMatchObject({
        kind: 'validation',
        fieldErrors: { addressId: DEVICE_MESSAGES.addressGone },
      });
    });

    it('kaldırılmış adresle cihaz kaydı Türkçe alan hatası verir (500 değil)', async () => {
      const { id: addressId } = await run((tx) => addAddress(tx, actor(), customerId, ADDRESS, clock));
      await run((tx) => removeAddress(tx, actor(), customerId, addressId, clock));
      expect(await errorOf(add({ type: 'combi_boiler', addressId }))).toMatchObject({
        kind: 'validation',
        fieldErrors: { addressId: DEVICE_MESSAGES.addressGone },
      });
    });

    it('düzenler (alanlar ve adres), sürüm çakışmasını reddeder, kaldırır', async () => {
      const { id: addressId } = await run((tx) => addAddress(tx, actor(), customerId, ADDRESS, clock));
      const { id } = await add({ type: 'combi_boiler', brand: 'Vaillant' });
      const edit = (input: Record<string, unknown>) =>
        run((tx) =>
          updateDevice(tx, actor(), customerId, id, { type: 'combi_boiler', brand: 'Vaillant', ...input }, clock),
        );
      await edit({ version: 1, model: 'ecoTEC', addressId });
      expect(await errorOf(edit({ version: 1, model: 'Başka' }))).toMatchObject({ kind: 'stale' });
      await run((tx) => removeDevice(tx, actor(), customerId, id, clock));
      expect((await run((tx) => getCustomer(tx, actor(), customerId))).devices).toEqual([]);
      expect(await auditOf('customer.device_updated')).toEqual([
        { deviceId: id, fields: ['model', 'address'] },
      ]);
      expect(await auditOf('customer.device_removed')).toEqual([{ deviceId: id }]);
    });

    it('201. cihaz reddedilir', async () => {
      await asOwner((tx) =>
        tx.insert(customerDevices).values(
          Array.from({ length: 200 }, () => ({
            tenantId: tenant.id,
            customerId,
            type: 'refrigerator' as const,
          })),
        ),
      );
      expect(await errorOf(add({ type: 'combi_boiler' }))).toMatchObject({
        kind: 'validation',
        userMessage: 'Bir müşteriye en fazla 200 cihaz eklenebilir.',
      });
    });
  });
});
```

- [ ] **Adım 2: Kırmızıyı gör**

Run: `npx vitest run --project integration tests/integration/musteri-adres-cihaz.test.ts`
Expected: FAIL, `addresses`/`devices` modülleri yok.

- [ ] **Adım 3: `src/server/customers/addresses.ts`**

```ts
import { and, desc, eq, sql } from 'drizzle-orm';
import { recordAudit } from '@/server/audit/audit';
import type { Actor } from '@/server/auth/actor';
import type { Clock } from '@/server/clock';
import { customerAddresses } from '@/server/db/schema';
import { isUuid, type TenantTx } from '@/server/db/tenant';
import { invalidActionError, notFoundError, staleError, validationError } from '@/server/errors';
import { requirePermission } from '@/server/permissions';
import { fieldErrorsFrom, z } from '@/server/validation';
import {
  addressFields,
  addressSchema,
  checkPlace,
  insertAddress,
  locationColumns,
  roundCoordinate,
} from './address-input';
import { LIMITS, lockCustomer, touchCustomer } from './common';

const updateAddressSchema = addressFields
  .extend({ version: z.number({ error: 'Sayfayı yenileyip yeniden deneyin.' }).int().positive() })
  .superRefine(checkPlace);

const ADDRESS_FIELDS = [
  'label',
  'province',
  'district',
  'neighborhood',
  'addressLine',
  'directions',
] as const;

export const addressScope = (actor: Actor, customerId: string, addressId: string) =>
  and(
    eq(customerAddresses.tenantId, actor.tenantId),
    eq(customerAddresses.customerId, customerId),
    eq(customerAddresses.id, addressId),
  );

const addressesOf = (actor: Actor, customerId: string) =>
  and(eq(customerAddresses.tenantId, actor.tenantId), eq(customerAddresses.customerId, customerId));

export async function addAddress(
  tx: TenantTx,
  actor: Actor,
  customerId: string,
  raw: unknown,
  clock: Clock,
): Promise<{ id: string }> {
  requirePermission(actor, 'customer.manage');
  const parsed = addressSchema.safeParse(raw);
  if (!parsed.success) throw validationError(fieldErrorsFrom(parsed.error));
  await lockCustomer(tx, actor, customerId);
  const [stats] = await tx
    .select({
      count: sql<number>`count(*)::int`,
      maxPosition: sql<number>`coalesce(max(${customerAddresses.position}), -1)::int`,
    })
    .from(customerAddresses)
    .where(addressesOf(actor, customerId));
  if (stats!.count >= LIMITS.addresses) {
    throw invalidActionError(`Bir müşteriye en fazla ${LIMITS.addresses} adres eklenebilir.`);
  }
  const now = clock.now();
  const id = await insertAddress(tx, actor, customerId, parsed.data, stats!.maxPosition + 1, now);
  await touchCustomer(tx, actor, customerId, now);
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'customer.address_added',
    target: { type: 'customer', id: customerId },
    details: {
      addressId: id,
      locationChanged: parsed.data.location !== null,
      locationSource: parsed.data.location?.source ?? null,
    },
    at: now,
  });
  return { id };
}

export async function updateAddress(
  tx: TenantTx,
  actor: Actor,
  customerId: string,
  addressId: string,
  raw: unknown,
  clock: Clock,
): Promise<void> {
  requirePermission(actor, 'customer.manage');
  const parsed = updateAddressSchema.safeParse(raw);
  if (!parsed.success) throw validationError(fieldErrorsFrom(parsed.error));
  await lockCustomer(tx, actor, customerId);
  if (!isUuid(addressId)) throw notFoundError();
  const [current] = await tx
    .select({
      label: customerAddresses.label,
      province: customerAddresses.province,
      district: customerAddresses.district,
      neighborhood: customerAddresses.neighborhood,
      addressLine: customerAddresses.addressLine,
      directions: customerAddresses.directions,
      latitude: customerAddresses.latitude,
      longitude: customerAddresses.longitude,
      version: customerAddresses.version,
    })
    .from(customerAddresses)
    .where(addressScope(actor, customerId, addressId))
    .for('update');
  if (!current) throw notFoundError();
  const input = parsed.data;
  if (current.version !== input.version) throw staleError();

  const fields: string[] = ADDRESS_FIELDS.filter((key) => input[key] !== current[key]);
  const next = input.location
    ? {
        latitude: roundCoordinate(input.location.latitude),
        longitude: roundCoordinate(input.location.longitude),
      }
    : { latitude: null, longitude: null };
  const locationChanged =
    next.latitude !== current.latitude || next.longitude !== current.longitude;
  if (fields.length === 0 && !locationChanged) return;

  const now = clock.now();
  await tx
    .update(customerAddresses)
    .set({
      label: input.label,
      province: input.province,
      district: input.district,
      neighborhood: input.neighborhood,
      addressLine: input.addressLine,
      directions: input.directions,
      ...(locationChanged ? locationColumns(input.location, actor, now) : {}),
      version: current.version + 1,
      updatedAt: now,
    })
    .where(addressScope(actor, customerId, addressId));
  await touchCustomer(tx, actor, customerId, now);
  const details: Record<string, unknown> = { addressId, fields, locationChanged };
  if (locationChanged) details.locationSource = input.location?.source ?? null;
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'customer.address_updated',
    target: { type: 'customer', id: customerId },
    details,
    at: now,
  });
}

/** Adres silinir; bağlı cihazlar müşteride kalır (veritabanı address_id'yi boşaltır). */
export async function removeAddress(
  tx: TenantTx,
  actor: Actor,
  customerId: string,
  addressId: string,
  clock: Clock,
): Promise<void> {
  requirePermission(actor, 'customer.manage');
  await lockCustomer(tx, actor, customerId);
  if (!isUuid(addressId)) throw notFoundError();
  const removed = await tx
    .delete(customerAddresses)
    .where(addressScope(actor, customerId, addressId))
    .returning({ id: customerAddresses.id });
  if (removed.length === 0) throw notFoundError();
  const now = clock.now();
  await touchCustomer(tx, actor, customerId, now);
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'customer.address_removed',
    target: { type: 'customer', id: customerId },
    details: { addressId },
    at: now,
  });
}

/** Yeni adres formunda il kutusu firmanın en son eklediği adresin iliyle dolu gelir (çoğu firma tek ilde çalışır). */
export async function lastUsedProvince(tx: TenantTx, actor: Actor): Promise<string | null> {
  requirePermission(actor, 'customer.manage');
  const [row] = await tx
    .select({ province: customerAddresses.province })
    .from(customerAddresses)
    .where(eq(customerAddresses.tenantId, actor.tenantId))
    .orderBy(desc(customerAddresses.createdAt), desc(customerAddresses.id))
    .limit(1);
  return row?.province ?? null;
}
```

- [ ] **Adım 4: `src/server/customers/devices.ts`**

```ts
import { and, eq, sql } from 'drizzle-orm';
import { DEVICE_TYPE_VALUES } from '@/lib/device-types';
import { recordAudit } from '@/server/audit/audit';
import type { Actor } from '@/server/auth/actor';
import type { Clock } from '@/server/clock';
import { customerAddresses, customerDevices } from '@/server/db/schema';
import { isUuid, type TenantTx } from '@/server/db/tenant';
import { invalidActionError, notFoundError, staleError, validationError } from '@/server/errors';
import { requirePermission } from '@/server/permissions';
import { fieldErrorsFrom, z } from '@/server/validation';
import { addressScope } from './addresses';
import { LIMITS, lockCustomer, optionalLine, optionalMultiline, touchCustomer } from './common';

export const DEVICE_MESSAGES = {
  addressGone: 'Seçilen adres artık yok. Sayfayı yenileyip yeniden seçin.',
  typeOther: 'Cihaz türünü yazın.',
  warranty: 'Garanti bitişi kurulum tarihinden önce olamaz.',
  invalidDate: 'Geçerli bir tarih seçin.',
} as const;

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= '1950-01-01' &&
    value <= '2100-12-31'
  );
}

const isoDate = z
  .string()
  .nullish()
  .transform((v) => (v ?? '').trim())
  .refine((v) => v === '' || isValidIsoDate(v), DEVICE_MESSAGES.invalidDate)
  .transform((v) => (v === '' ? null : v));

const deviceFields = z.object({
  addressId: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null)),
  type: z.enum(DEVICE_TYPE_VALUES, { error: 'Cihaz türünü seçin.' }),
  typeOther: optionalLine(40, 'Tür adı en fazla 40 karakter olabilir.'),
  brand: optionalLine(60, 'Marka en fazla 60 karakter olabilir.'),
  model: optionalLine(60, 'Model en fazla 60 karakter olabilir.'),
  serialNo: optionalLine(60, 'Seri no en fazla 60 karakter olabilir.'),
  installedOn: isoDate,
  warrantyUntil: isoDate,
  note: optionalMultiline(500, 'Not en fazla 500 karakter olabilir.'),
});

function checkDevice(
  value: z.output<typeof deviceFields>,
  ctx: z.RefinementCtx,
): void {
  if (value.type === 'other' && !value.typeOther) {
    ctx.addIssue({ code: 'custom', path: ['typeOther'], message: DEVICE_MESSAGES.typeOther });
  }
  if (value.installedOn && value.warrantyUntil && value.warrantyUntil < value.installedOn) {
    ctx.addIssue({ code: 'custom', path: ['warrantyUntil'], message: DEVICE_MESSAGES.warranty });
  }
}

const deviceSchema = deviceFields.superRefine(checkDevice);
const updateDeviceSchema = deviceFields
  .extend({ version: z.number({ error: 'Sayfayı yenileyip yeniden deneyin.' }).int().positive() })
  .superRefine(checkDevice);

type DeviceInput = z.output<typeof deviceFields>;

const DEVICE_FIELDS = [
  'type',
  'typeOther',
  'brand',
  'model',
  'serialNo',
  'installedOn',
  'warrantyUntil',
  'note',
] as const;

function deviceColumns(input: DeviceInput) {
  return {
    addressId: input.addressId,
    type: input.type,
    // CHECK: tür adı yalnızca "Diğer"de bulunur; başka türe geçilince atılır.
    typeOther: input.type === 'other' ? input.typeOther : null,
    brand: input.brand,
    model: input.model,
    serialNo: input.serialNo,
    installedOn: input.installedOn,
    warrantyUntil: input.warrantyUntil,
    note: input.note,
  };
}

const deviceScope = (actor: Actor, customerId: string, deviceId: string) =>
  and(
    eq(customerDevices.tenantId, actor.tenantId),
    eq(customerDevices.customerId, customerId),
    eq(customerDevices.id, deviceId),
  );

/**
 * Cihaz yalnızca kendi müşterisinin adresine bağlanır (veritabanında bileşik anahtar da var). Müşteri satırı kilitli
 * olduğundan adres bu denetimle kayıt arasında kaldırılamaz; kaldırılmışsa kullanıcı Türkçe alan hatası görür.
 */
async function assertAddressOfCustomer(
  tx: TenantTx,
  actor: Actor,
  customerId: string,
  addressId: string | null,
): Promise<void> {
  if (addressId === null) return;
  if (!isUuid(addressId)) throw validationError({ addressId: DEVICE_MESSAGES.addressGone });
  const [row] = await tx
    .select({ id: customerAddresses.id })
    .from(customerAddresses)
    .where(addressScope(actor, customerId, addressId))
    .limit(1);
  if (!row) throw validationError({ addressId: DEVICE_MESSAGES.addressGone });
}

export async function addDevice(
  tx: TenantTx,
  actor: Actor,
  customerId: string,
  raw: unknown,
  clock: Clock,
): Promise<{ id: string }> {
  requirePermission(actor, 'customer.manage');
  const parsed = deviceSchema.safeParse(raw);
  if (!parsed.success) throw validationError(fieldErrorsFrom(parsed.error));
  await lockCustomer(tx, actor, customerId);
  await assertAddressOfCustomer(tx, actor, customerId, parsed.data.addressId);
  const [stats] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(customerDevices)
    .where(and(eq(customerDevices.tenantId, actor.tenantId), eq(customerDevices.customerId, customerId)));
  if (stats!.count >= LIMITS.devices) {
    throw invalidActionError(`Bir müşteriye en fazla ${LIMITS.devices} cihaz eklenebilir.`);
  }
  const now = clock.now();
  const [row] = await tx
    .insert(customerDevices)
    .values({
      tenantId: actor.tenantId,
      customerId,
      ...deviceColumns(parsed.data),
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: customerDevices.id });
  const id = row!.id;
  await touchCustomer(tx, actor, customerId, now);
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'customer.device_added',
    target: { type: 'customer', id: customerId },
    details: { deviceId: id },
    at: now,
  });
  return { id };
}

export async function updateDevice(
  tx: TenantTx,
  actor: Actor,
  customerId: string,
  deviceId: string,
  raw: unknown,
  clock: Clock,
): Promise<void> {
  requirePermission(actor, 'customer.manage');
  const parsed = updateDeviceSchema.safeParse(raw);
  if (!parsed.success) throw validationError(fieldErrorsFrom(parsed.error));
  await lockCustomer(tx, actor, customerId);
  if (!isUuid(deviceId)) throw notFoundError();
  const [current] = await tx
    .select({
      addressId: customerDevices.addressId,
      type: customerDevices.type,
      typeOther: customerDevices.typeOther,
      brand: customerDevices.brand,
      model: customerDevices.model,
      serialNo: customerDevices.serialNo,
      installedOn: customerDevices.installedOn,
      warrantyUntil: customerDevices.warrantyUntil,
      note: customerDevices.note,
      version: customerDevices.version,
    })
    .from(customerDevices)
    .where(deviceScope(actor, customerId, deviceId))
    .for('update');
  if (!current) throw notFoundError();
  if (current.version !== parsed.data.version) throw staleError();
  await assertAddressOfCustomer(tx, actor, customerId, parsed.data.addressId);

  const next = deviceColumns(parsed.data);
  const fields: string[] = DEVICE_FIELDS.filter((key) => next[key] !== current[key]);
  if (next.addressId !== current.addressId) fields.push('address');
  if (fields.length === 0) return;

  const now = clock.now();
  await tx
    .update(customerDevices)
    .set({ ...next, version: current.version + 1, updatedAt: now })
    .where(deviceScope(actor, customerId, deviceId));
  await touchCustomer(tx, actor, customerId, now);
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'customer.device_updated',
    target: { type: 'customer', id: customerId },
    details: { deviceId, fields },
    at: now,
  });
}

export async function removeDevice(
  tx: TenantTx,
  actor: Actor,
  customerId: string,
  deviceId: string,
  clock: Clock,
): Promise<void> {
  requirePermission(actor, 'customer.manage');
  await lockCustomer(tx, actor, customerId);
  if (!isUuid(deviceId)) throw notFoundError();
  const removed = await tx
    .delete(customerDevices)
    .where(deviceScope(actor, customerId, deviceId))
    .returning({ id: customerDevices.id });
  if (removed.length === 0) throw notFoundError();
  const now = clock.now();
  await touchCustomer(tx, actor, customerId, now);
  await recordAudit(tx, {
    tenantId: actor.tenantId,
    actorUserId: actor.userId,
    action: 'customer.device_removed',
    target: { type: 'customer', id: customerId },
    details: { deviceId },
    at: now,
  });
}
```

- [ ] **Adım 5: Yeşili gör**

Run: `npx vitest run --project integration tests/integration/musteri-adres-cihaz.test.ts tests/integration/musteriler.test.ts`
Expected: PASS.

- [ ] **Adım 6: Commit**

```bash
npm run format && npm run lint && npm run typecheck
git add src/server/customers tests/integration/musteri-adres-cihaz.test.ts
git commit -m "Müşteriler: adres ve cihaz servisi (il/ilçe doğrulaması, konum bilgisi, sınırlar, sürüm koruması)"
```

---

### Görev 7: Arama ve liste servisi

**Files:**
- Create: `src/server/customers/search.ts`
- Test: `tests/integration/musteri-arama.test.ts`

**Interfaces:**
- Consumes: `analyzeSearch`, `SEARCH_MAX_LENGTH` (Görev 1), `parsePhone` (Görev 1), tablolar (Görev 3)
- Produces:
  - `interface CustomerSummary { id: string; name: string; mainPhone: string | null; place: { province: string; district: string; neighborhood: string | null } | null; addressCount: number; missingLocationCount: number }`
  - `interface CustomerPage { items: CustomerSummary[]; nextCursor: string | null }`
  - `interface CustomerSearchResult { items: CustomerSummary[]; hasMore: boolean }`
  - `PAGE_SIZE = 50`, `SEARCH_MESSAGES = { tooShort, tooLong }`
  - `listCustomers(tx, actor, { missingLocation: boolean; after: string | null }): Promise<CustomerPage>`
  - `searchCustomers(tx, actor, { query: string; missingLocation: boolean }): Promise<CustomerSearchResult>`

- [ ] **Adım 1: Entegrasyon testini yaz**

`tests/integration/musteri-arama.test.ts`:

```ts
import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { addAddress, removeAddress } from '@/server/customers/addresses';
import { SEARCH_MESSAGES, listCustomers, searchCustomers } from '@/server/customers/search';
import { createCustomer, updateCustomer } from '@/server/customers/service';
import { customerPhones, customers, type UserRow } from '@/server/db/schema';
import { withTenant, type TenantTx } from '@/server/db/tenant';
import type { AppError } from '@/server/errors';
import { MINUTE, createFakeClock } from '../helpers/clock';
import { useTestDbs } from '../helpers/db';
import { actorFor, seedTenant, seedUser, type SeededTenant } from '../helpers/fabrika';

const clock = createFakeClock();
const LOCATION = { latitude: 41.0, longitude: 29.0, source: 'link' as const };

describe('müşteri arama ve liste', () => {
  const { app, owner } = useTestDbs();

  async function setupTenant() {
    const tenant = await seedTenant(owner);
    const user = await seedUser(owner, tenant.id, { role: 'operator' });
    const actor = actorFor(user, tenant.code);
    const run = <T>(fn: (tx: TenantTx) => Promise<T>) => withTenant(app, tenant.id, fn);
    const add = async (
      name: string,
      number: string,
      address?: { province: string; district: string; neighborhood: string | null; addressLine: string; located: boolean },
    ) => {
      clock.advance(MINUTE);
      const result = await run((tx) =>
        createCustomer(tx, actor, { name, phones: [{ number, label: '' }] }, clock),
      );
      if (result.kind !== 'saved') throw new Error('kaydedilmedi');
      if (address) {
        const { located, ...rest } = address;
        await run((tx) =>
          addAddress(
            tx,
            actor,
            result.id,
            { ...rest, label: null, directions: null, location: located ? LOCATION : null },
            clock,
          ),
        );
      }
      return result.id;
    };
    return { tenant, user, actor, run, add };
  }

  type Ctx = Awaited<ReturnType<typeof setupTenant>>;
  let ctx: Ctx;
  const ids: Record<string, string> = {};
  const search = (query: string, missingLocation = false) =>
    ctx.run((tx) => searchCustomers(tx, ctx.actor, { query, missingLocation }));
  const names = async (query: string, missingLocation = false) =>
    (await search(query, missingLocation)).items.map((c) => c.name);
  const errorOf = (promise: Promise<unknown>) =>
    promise.then(
      () => undefined,
      (e: unknown) => e as AppError,
    );

  beforeAll(async () => {
    ctx = await setupTenant();
    ids.sukru = await ctx.add('Şükrü Işık', '0532 111 22 33', {
      province: 'İstanbul',
      district: 'Kadıköy',
      neighborhood: 'Caferağa',
      addressLine: 'Moda Cad. No: 5',
      located: true,
    });
    ids.ali = await ctx.add('Ali Şükrüoğlu', '0216 123 45 67', {
      province: 'İzmir',
      district: 'Bornova',
      neighborhood: 'Kazımdirik',
      addressLine: '372. Sok. No: 8',
      located: false,
    });
    ids.ayse = await ctx.add('Ayşe Yılmaz', '0555 123 45 67');
    ids.ticaret = await ctx.add('Yılmaz Ticaret', '0212 555 66 77', {
      province: 'Ankara',
      district: 'Çankaya',
      neighborhood: null,
      addressLine: 'Atatürk Blv. 10',
      located: true,
    });
    ids.ev = await ctx.add("Ayşe'nin Evi", '0532 000 11 22', {
      province: 'İstanbul',
      district: 'Kadıköy',
      neighborhood: null,
      addressLine: 'Bahariye Cad. 1',
      located: false,
    });
    ids.almanya = await ctx.add('Ahmet Almanya', '+49 532 111 22 334');
    const other = await setupTenant();
    await other.add('Şükrü Başka', '0532 111 22 33');
  });

  it('Türkçe harften bağımsız bulur; ad başı eşleşmesi önce, sonra Türkçe ad sırası', async () => {
    expect(await names('sukru')).toEqual(['Şükrü Işık', 'Ali Şükrüoğlu']);
    expect(await names('ŞÜKRÜ IŞIK')).toEqual(['Şükrü Işık']);
    expect(await names('yılmaz')).toEqual(['Yılmaz Ticaret', 'Ayşe Yılmaz']);
  });

  it('telefonun herhangi bir parçasıyla bulur; tam numara eşleşmesi en önde', async () => {
    expect(await names('0532 111')).toEqual(['Ahmet Almanya', 'Şükrü Işık']);
    expect(await names('0532 111 22 33')).toEqual(['Şükrü Işık', 'Ahmet Almanya']);
    expect(await names('+90 532 111 22 33')).toEqual(['Şükrü Işık', 'Ahmet Almanya']);
    expect(await names('0532')).toEqual(['Ahmet Almanya', "Ayşe'nin Evi", 'Şükrü Işık']);
  });

  it('il, ilçe, mahalle ve açık adres parçasıyla bulur', async () => {
    expect(await names('kadıköy')).toEqual(["Ayşe'nin Evi", 'Şükrü Işık']);
    expect(await names('moda')).toEqual(['Şükrü Işık']);
    expect(await names('bornova kazimdirik')).toEqual(['Ali Şükrüoğlu']);
  });

  it('özel karakterler joker değildir; kısa ve uzun arama reddedilir', async () => {
    expect(await names("AYŞE'NİN")).toEqual(["Ayşe'nin Evi"]);
    for (const query of ['%', '__', 'a', ' ']) {
      expect(await errorOf(search(query))).toMatchObject({
        kind: 'validation',
        fieldErrors: { q: SEARCH_MESSAGES.tooShort },
      });
    }
    expect(await errorOf(search('a'.repeat(101)))).toMatchObject({
      fieldErrors: { q: SEARCH_MESSAGES.tooLong },
    });
  });

  it('başka firmanın müşterisi hiçbir aramada çıkmaz', async () => {
    expect(await names('sukru')).not.toContain('Şükrü Başka');
    expect(await names('başka')).toEqual([]);
  });

  it('kart bilgisi: ana numara, ilk adresin yeri, adres ve konum sayıları', async () => {
    const [card] = (await search('moda')).items;
    expect(card).toEqual({
      id: ids.sukru,
      name: 'Şükrü Işık',
      mainPhone: '+905321112233',
      place: { province: 'İstanbul', district: 'Kadıköy', neighborhood: 'Caferağa' },
      addressCount: 1,
      missingLocationCount: 0,
    });
    const [noAddress] = (await search('0555 123')).items;
    expect(noAddress).toMatchObject({ place: null, addressCount: 0, missingLocationCount: 0 });
  });

  it('"Konumu eksik" süzgeci: adresi olmayan ya da konumsuz adresi olan müşteriler', async () => {
    expect(await names('kadıköy', true)).toEqual(["Ayşe'nin Evi"]);
    const page = await ctx.run((tx) =>
      listCustomers(tx, ctx.actor, { missingLocation: true, after: null }),
    );
    expect(page.items.map((c) => c.name)).toEqual([
      'Ahmet Almanya',
      "Ayşe'nin Evi",
      'Ayşe Yılmaz',
      'Ali Şükrüoğlu',
    ]);
  });

  describe('arama metni alt kayıtla birlikte yenilenir', () => {
    let fresh: Ctx;
    beforeEach(async () => {
      fresh = await setupTenant();
    });

    it('telefon değişince eski numarayla bulunmaz, yenisiyle bulunur; adres eklenip kaldırılınca da', async () => {
      const id = await fresh.add('Deneme Kişi', '0532 444 55 66');
      const find = (query: string) =>
        fresh.run((tx) => searchCustomers(tx, fresh.actor, { query, missingLocation: false }));
      await fresh.run((tx) =>
        updateCustomer(
          tx,
          fresh.actor,
          id,
          { version: 1, name: 'Deneme Kişi', note: null, phones: [{ number: '0533 777 88 99', label: null }] },
          clock,
        ),
      );
      expect((await find('0532 444')).items).toEqual([]);
      expect((await find('0533 777')).items.map((c) => c.id)).toEqual([id]);
      const { id: addressId } = await fresh.run((tx) =>
        addAddress(
          tx,
          fresh.actor,
          id,
          {
            label: null,
            province: 'İzmir',
            district: 'Bornova',
            neighborhood: null,
            addressLine: 'Ege Üniversitesi',
            directions: null,
            location: null,
          },
          clock,
        ),
      );
      expect((await find('bornova')).items.map((c) => c.id)).toEqual([id]);
      await fresh.run((tx) => removeAddress(tx, fresh.actor, id, addressId, clock));
      expect((await find('bornova')).items).toEqual([]);
    });

    it('liste en son güncellenen önce, 50şer sayfa; sayfalar örtüşmez', async () => {
      const base = clock.now().getTime();
      await withTenant(owner, fresh.tenant.id, async (tx) => {
        const rows = await tx
          .insert(customers)
          .values(
            Array.from({ length: 120 }, (_, i) => ({
              tenantId: fresh.tenant.id,
              name: `Sayfa Kişi ${i}`,
              searchText: `sayfa kisi ${i}`,
              createdBy: fresh.user.id,
              updatedBy: fresh.user.id,
              updatedAt: new Date(base + i * MINUTE),
            })),
          )
          .returning({ id: customers.id });
        await tx.insert(customerPhones).values(
          rows.map((r, i) => ({
            tenantId: fresh.tenant.id,
            customerId: r.id,
            number: `+90532${String(1000000 + i)}`,
            position: 0,
          })),
        );
      });
      const list = (after: string | null) =>
        fresh.run((tx) => listCustomers(tx, fresh.actor, { missingLocation: false, after }));
      const p1 = await list(null);
      const p2 = await list(p1.nextCursor);
      const p3 = await list(p2.nextCursor);
      expect([p1.items.length, p2.items.length, p3.items.length]).toEqual([50, 50, 20]);
      expect(p3.nextCursor).toBeNull();
      const all = [...p1.items, ...p2.items, ...p3.items].map((c) => c.name);
      expect(new Set(all).size).toBe(120);
      expect(all[0]).toBe('Sayfa Kişi 119');
      expect(all.at(-1)).toBe('Sayfa Kişi 0');

      const searched = await fresh.run((tx) =>
        searchCustomers(tx, fresh.actor, { query: 'sayfa', missingLocation: false }),
      );
      expect(searched.items).toHaveLength(50);
      expect(searched.hasMore).toBe(true);
    });

    it('bozuk sayfa imleci Türkçe hata verir', async () => {
      const err = await errorOf(
        fresh.run((tx) => listCustomers(tx, fresh.actor, { missingLocation: false, after: 'bozuk' })),
      );
      expect(err).toMatchObject({ kind: 'validation' });
    });
  });
});
```

> "0532" araması: `Ahmet Almanya` (+49 532 111 22 334 → rakamlar "4953211122334") de "532"yi içerir; tam numara eşleşmesi olmadığından ada göre (ICU tr-TR: A < Ş) sıralanır. `'Sayfa Kişi 119'`'un en üstte olması `updated_at` sırasını sınar.

- [ ] **Adım 2: Kırmızıyı gör**

Run: `npx vitest run --project integration tests/integration/musteri-arama.test.ts`
Expected: FAIL, `@/server/customers/search` yok.

- [ ] **Adım 3: `src/server/customers/search.ts`**

```ts
import { and, desc, eq, like, sql, type SQL } from 'drizzle-orm';
import { parsePhone } from '@/lib/phone';
import { SEARCH_MAX_LENGTH, SEARCH_MIN_LENGTH, analyzeSearch } from '@/lib/search';
import type { Actor } from '@/server/auth/actor';
import { customers } from '@/server/db/schema';
import { isUuid, type TenantTx } from '@/server/db/tenant';
import { validationError } from '@/server/errors';
import { requirePermission } from '@/server/permissions';

export interface CustomerSummary {
  id: string;
  name: string;
  mainPhone: string | null;
  place: { province: string; district: string; neighborhood: string | null } | null;
  addressCount: number;
  missingLocationCount: number;
}

export interface CustomerPage {
  items: CustomerSummary[];
  nextCursor: string | null;
}

export interface CustomerSearchResult {
  items: CustomerSummary[];
  hasMore: boolean;
}

export const PAGE_SIZE = 50;

export const SEARCH_MESSAGES = {
  tooShort: `Aramak için en az ${SEARCH_MIN_LENGTH} harf ya da rakam yazın.`,
  tooLong: `Arama en fazla ${SEARCH_MAX_LENGTH} karakter olabilir.`,
} as const;

// İlişkili alt sorgular: alt tablolarda da tenant_id filtresi açıkça yazılır (1. kilit), RLS de geçerlidir (2. kilit).
const summaryColumns = {
  id: customers.id,
  name: customers.name,
  mainPhone: sql<string | null>`(select p.number from customer_phones p
    where p.tenant_id = ${customers.tenantId} and p.customer_id = ${customers.id}
    order by p.position limit 1)`,
  place: sql<CustomerSummary['place']>`(select json_build_object('province', a.province, 'district', a.district, 'neighborhood', a.neighborhood)
    from customer_addresses a
    where a.tenant_id = ${customers.tenantId} and a.customer_id = ${customers.id}
    order by a.position, a.id limit 1)`,
  addressCount: sql<number>`(select count(*)::int from customer_addresses a
    where a.tenant_id = ${customers.tenantId} and a.customer_id = ${customers.id})`,
  missingLocationCount: sql<number>`(select count(*)::int from customer_addresses a
    where a.tenant_id = ${customers.tenantId} and a.customer_id = ${customers.id} and a.latitude is null)`,
};

/** "Konumu eksik": hiç adresi yok ya da en az bir adresinde iğne yok. */
const missingLocation = sql`(not exists (select 1 from customer_addresses a
    where a.tenant_id = ${customers.tenantId} and a.customer_id = ${customers.id})
  or exists (select 1 from customer_addresses a
    where a.tenant_id = ${customers.tenantId} and a.customer_id = ${customers.id} and a.latitude is null))`;

/** Arama yokken: en son güncellenen önce, (updated_at, id) anahtarıyla sayfalama; imleç son kaydın kimliğidir. */
export async function listCustomers(
  tx: TenantTx,
  actor: Actor,
  opts: { missingLocation: boolean; after: string | null },
): Promise<CustomerPage> {
  requirePermission(actor, 'customer.view');
  const conditions: SQL[] = [eq(customers.tenantId, actor.tenantId)];
  if (opts.missingLocation) conditions.push(missingLocation);
  if (opts.after !== null) {
    if (!isUuid(opts.after)) {
      throw validationError({ after: 'Liste değişti. Sayfayı yenileyip yeniden deneyin.' });
    }
    conditions.push(sql`(${customers.updatedAt}, ${customers.id}) < (select c2.updated_at, c2.id
      from customers c2 where c2.tenant_id = ${actor.tenantId} and c2.id = ${opts.after})`);
  }
  const rows = await tx
    .select(summaryColumns)
    .from(customers)
    .where(and(...conditions))
    .orderBy(desc(customers.updatedAt), desc(customers.id))
    .limit(PAGE_SIZE + 1);
  const items = rows.slice(0, PAGE_SIZE);
  return { items, nextCursor: rows.length > PAGE_SIZE ? items.at(-1)!.id : null };
}

/**
 * Tek kutudan arama: ad, telefonun herhangi bir parçası, il/ilçe/mahalle/açık adres. Sıralama: tam telefon eşleşmesi →
 * ad başı eşleşmesi → diğerleri; eşitlikte ad (veritabanı ICU tr-TR). İlk 50 sonuç; fazlası için "aramayı daraltın".
 */
export async function searchCustomers(
  tx: TenantTx,
  actor: Actor,
  opts: { query: string; missingLocation: boolean },
): Promise<CustomerSearchResult> {
  requirePermission(actor, 'customer.view');
  const query = analyzeSearch(opts.query);
  if (query.kind === 'empty' || query.kind === 'too_short') {
    throw validationError({ q: SEARCH_MESSAGES.tooShort });
  }
  if (query.kind === 'too_long') throw validationError({ q: SEARCH_MESSAGES.tooLong });

  // search_text yalnızca harf, rakam ve boşluk içerir; aranan parçalarda % ve _ kalmaz (foldSearch).
  const matches =
    query.kind === 'phone'
      ? [like(customers.searchText, `%${query.digits}%`)]
      : query.tokens.map((token) => like(customers.searchText, `%${token}%`));
  const exact = query.kind === 'phone' ? parsePhone(opts.query) : null;
  const exactPhone = exact?.ok
    ? sql`exists (select 1 from customer_phones p where p.tenant_id = ${customers.tenantId}
        and p.customer_id = ${customers.id} and p.number = ${exact.e164})`
    : sql`false`;
  const rank = sql`case when ${exactPhone} then 0
    when ${customers.searchText} like ${`${query.folded}%`} then 1 else 2 end`;

  const conditions: SQL[] = [eq(customers.tenantId, actor.tenantId), ...matches];
  if (opts.missingLocation) conditions.push(missingLocation);
  const rows = await tx
    .select(summaryColumns)
    .from(customers)
    .where(and(...conditions))
    .orderBy(rank, customers.name, customers.id)
    .limit(PAGE_SIZE + 1);
  return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}
```

> `like(…)` ve `eq(…)` `SQL | undefined` dönebilir türdedir; `SQL[]` dizisine itmek tip hatası verirse `conditions` türünü `(SQL | undefined)[]` yap (`and(...)` `undefined`'ları atlar).

- [ ] **Adım 4: Yeşili gör**

Run: `npx vitest run --project integration tests/integration/musteri-arama.test.ts`
Expected: PASS.

Sıralama farklı çıkarsa (ör. `'Ahmet Almanya', "Ayşe'nin Evi"` sırası) önce veritabanının ICU `tr-TR` karşılaştırmasıyla açıkladığını doğrula (`select 'Ayşe''nin Evi' < 'Ayşe Yılmaz'`); beklenen sırayı veritabanının gerçek Türkçe sırasına göre düzelt, sıralama kodunu değil.

- [ ] **Adım 5: Arama planını gör (dizin kullanılıyor mu)**

```bash
node -e "process.loadEnvFile('.env');const {Client}=require('pg');const c=new Client({connectionString:process.env.TEST_DATABASE_ADMIN_URL});c.connect().then(()=>c.query(\"set enable_seqscan = off\")).then(()=>c.query(\"explain select id from customers where search_text like '%kadikoy%'\")).then(r=>{console.log(r.rows.map(x=>x['QUERY PLAN']).join('\n'));return c.end()})"
```

Expected: planda `customers_search_trgm_idx` (Bitmap Index Scan). Az satırda planlayıcı normalde tabloyu tarar; `enable_seqscan = off` yalnızca dizinin kullanılabildiğini gösterir.

- [ ] **Adım 6: Commit**

```bash
npm run format && npm run lint && npm run typecheck
git add src/server/customers/search.ts tests/integration/musteri-arama.test.ts
git commit -m "Müşteriler: Türkçe arama, sayfalı liste ve 'Konumu eksik' süzgeci"
```

---

### Görev 8: Firma izolasyonu (1. kilit) ve teknisyen engeli

**Files:**
- Test: `tests/integration/firma-izolasyonu-musteri-uygulama.test.ts`, `tests/integration/musteri-yetki.test.ts`

**Interfaces:**
- Consumes: Görev 5-7'nin bütün servis işlevleri
- Produces: yalnızca testler (servis kodu doğruysa ilk çalıştırmada yeşil; kırmızı çıkarsa açık bir izolasyon hatasıdır, önce o düzeltilir)

> Bu görevin testleri TDD'nin "önce kırmızı" adımına uymaz: Görev 5-7'de yazılan servislerin davranışını ikinci bir açıdan (RLS kapalıyken) kanıtlar. Yeşil çıkmalarını beklemeden önce bir kez bozarak dene (Adım 2).

- [ ] **Adım 1: 1. kilit testini yaz**

`tests/integration/firma-izolasyonu-musteri-uygulama.test.ts`:

```ts
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addAddress,
  lastUsedProvince,
  removeAddress,
  updateAddress,
} from '@/server/customers/addresses';
import { DEVICE_MESSAGES, addDevice, removeDevice, updateDevice } from '@/server/customers/devices';
import { listCustomers, searchCustomers } from '@/server/customers/search';
import {
  createCustomer,
  findPhoneOwners,
  getCustomer,
  updateCustomer,
} from '@/server/customers/service';
import {
  customerAddresses,
  customerDevices,
  customerPhones,
  customers,
  type UserRow,
} from '@/server/db/schema';
import { withTenant, type TenantTx } from '@/server/db/tenant';
import { createFakeClock } from '../helpers/clock';
import { useTestDbs } from '../helpers/db';
import { actorFor, seedTenant, seedUser, type SeededTenant } from '../helpers/fabrika';

const clock = createFakeClock();
const B_NUMBER = '0532 765 43 21';
const ADDRESS = {
  label: null,
  province: 'Ankara',
  district: 'Çankaya',
  neighborhood: null,
  addressLine: 'Gizli Sokak 7',
  directions: null,
  location: null,
};

describe('1. kilit: müşteri servisleri RLS olmadan da firmaları ayırır', () => {
  // bypass bağlantısı RLS'yi atlar: buradaki koruma yalnızca servislerdeki tenant_id filtresinden gelir.
  const { app, bypass, owner } = useTestDbs();
  let a: SeededTenant;
  let b: SeededTenant;
  let aUser: UserRow;
  const bIds = { customer: '', address: '', device: '' };
  let aCustomer = '';

  const asA = <T>(fn: (tx: TenantTx) => Promise<T>) => withTenant(bypass, a.id, fn);
  const actor = () => actorFor(aUser, a.code);

  beforeAll(async () => {
    a = await seedTenant(owner);
    b = await seedTenant(owner);
    aUser = await seedUser(owner, a.id, { role: 'operator' });
    const bUser = await seedUser(owner, b.id, { role: 'operator' });
    const bActor = actorFor(bUser, b.code);
    // B'nin müşterisi servis yoluyla kurulur: arama metni dolu olsun (aramada sızıntı denenebilsin).
    await withTenant(app, b.id, async (tx) => {
      const saved = await createCustomer(
        tx,
        bActor,
        { name: 'Bora Gizli Müşteri', phones: [{ number: B_NUMBER, label: null }], address: ADDRESS },
        clock,
      );
      if (saved.kind !== 'saved') throw new Error('B müşterisi kaydedilmedi');
      bIds.customer = saved.id;
      const detail = await getCustomer(tx, bActor, saved.id);
      bIds.address = detail.addresses[0]!.id;
      bIds.device = (await addDevice(tx, bActor, saved.id, { type: 'combi_boiler' }, clock)).id;
    });
    const own = await withTenant(app, a.id, (tx) =>
      createCustomer(tx, actor(), { name: 'Akın Müşteri', phones: [{ number: '0532 100 00 00', label: null }] }, clock),
    );
    if (own.kind !== 'saved') throw new Error('A müşterisi kaydedilmedi');
    aCustomer = own.id;
  });

  /** B'nin satırları hiç değişmedi mi? */
  async function expectBUntouched() {
    const [customer] = await bypass
      .select({ name: customers.name, version: customers.version, updatedAt: customers.updatedAt })
      .from(customers)
      .where(eq(customers.id, bIds.customer));
    expect(customer).toMatchObject({ name: 'Bora Gizli Müşteri', version: 1 });
    expect(
      await Promise.all([
        bypass.$count(customerPhones, eq(customerPhones.customerId, bIds.customer)),
        bypass.$count(customerAddresses, eq(customerAddresses.customerId, bIds.customer)),
        bypass.$count(customerDevices, eq(customerDevices.customerId, bIds.customer)),
      ]),
    ).toEqual([1, 1, 1]);
    const [address] = await bypass
      .select({ addressLine: customerAddresses.addressLine, version: customerAddresses.version })
      .from(customerAddresses)
      .where(eq(customerAddresses.id, bIds.address));
    expect(address).toEqual({ addressLine: 'Gizli Sokak 7', version: 1 });
    const [device] = await bypass
      .select({ brand: customerDevices.brand, version: customerDevices.version })
      .from(customerDevices)
      .where(eq(customerDevices.id, bIds.device));
    expect(device).toEqual({ brand: null, version: 1 });
  }

  it('liste ve arama yalnızca kendi firmasını döndürür', async () => {
    const page = await asA((tx) => listCustomers(tx, actor(), { missingLocation: false, after: null }));
    expect(page.items.map((c) => c.id)).toEqual([aCustomer]);
    for (const query of ['bora', 'gizli', B_NUMBER, 'çankaya']) {
      const result = await asA((tx) => searchCustomers(tx, actor(), { query, missingLocation: false }));
      expect(result.items, query).toEqual([]);
    }
  });

  it('başka firmadaki aynı numara çift numara uyarısı vermez', async () => {
    expect(await asA((tx) => findPhoneOwners(tx, actor(), B_NUMBER, null))).toEqual([]);
    const saved = await asA((tx) =>
      createCustomer(tx, actor(), { name: 'Aynı Numaralı', phones: [{ number: B_NUMBER, label: null }] }, clock),
    );
    expect(saved.kind).toBe('saved');
  });

  it('"son kullanılan il" başka firmanın adresine bakmaz', async () => {
    expect(await asA((tx) => lastUsedProvince(tx, actor()))).toBeNull();
  });

  // Kapanışlar beforeAll'dan sonra çağrıldığı için kimlikler o anda doludur.
  const attempts: Array<[string, (tx: TenantTx) => Promise<unknown>]> = [
    ['müşteri ayrıntısı', (tx) => getCustomer(tx, actor(), bIds.customer)],
    [
      'müşteri düzenleme',
      (tx) =>
        updateCustomer(
          tx,
          actor(),
          bIds.customer,
          { version: 1, name: 'Ele geçirildi', note: null, phones: [{ number: B_NUMBER, label: null }] },
          clock,
        ),
    ],
    ['adres ekleme', (tx) => addAddress(tx, actor(), bIds.customer, ADDRESS, clock)],
    [
      'adres düzenleme',
      (tx) =>
        updateAddress(tx, actor(), bIds.customer, bIds.address, { ...ADDRESS, version: 1, addressLine: 'X' }, clock),
    ],
    ['adres kaldırma', (tx) => removeAddress(tx, actor(), bIds.customer, bIds.address, clock)],
    ['cihaz ekleme', (tx) => addDevice(tx, actor(), bIds.customer, { type: 'dryer' }, clock)],
    [
      'cihaz düzenleme',
      (tx) =>
        updateDevice(tx, actor(), bIds.customer, bIds.device, { version: 1, type: 'combi_boiler', brand: 'X' }, clock),
    ],
    ['cihaz kaldırma', (tx) => removeDevice(tx, actor(), bIds.customer, bIds.device, clock)],
    // Kendi müşterisinin yoluyla başka firmanın alt kaydına uzanmak:
    [
      'kendi müşterisi üzerinden B adresini düzenleme',
      (tx) =>
        updateAddress(tx, actor(), aCustomer, bIds.address, { ...ADDRESS, version: 1, addressLine: 'X' }, clock),
    ],
    ['kendi müşterisi üzerinden B adresini kaldırma', (tx) => removeAddress(tx, actor(), aCustomer, bIds.address, clock)],
    [
      'kendi müşterisi üzerinden B cihazını düzenleme',
      (tx) =>
        updateDevice(tx, actor(), aCustomer, bIds.device, { version: 1, type: 'combi_boiler', brand: 'X' }, clock),
    ],
    ['kendi müşterisi üzerinden B cihazını kaldırma', (tx) => removeDevice(tx, actor(), aCustomer, bIds.device, clock)],
  ];

  it.each(attempts)('%s "bulunamadı" verir ve B\'nin kaydına dokunmaz', async (_name, call) => {
    await expect(asA(call)).rejects.toMatchObject({ kind: 'not_found' });
    await expectBUntouched();
  });

  it('kendi cihazı başka firmanın adresine bağlanamaz (Türkçe alan hatası)', async () => {
    await expect(
      asA((tx) => addDevice(tx, actor(), aCustomer, { type: 'dryer', addressId: bIds.address }, clock)),
    ).rejects.toMatchObject({ kind: 'validation', fieldErrors: { addressId: DEVICE_MESSAGES.addressGone } });
    await expectBUntouched();
  });
});
```

- [ ] **Adım 2: Testin gerçekten koruduğunu gör (geçici bozma)**

`src/server/customers/common.ts` içindeki `customerScope`'u geçici olarak yalnızca `eq(customers.id, id)` yap.

Run: `npx vitest run --project integration tests/integration/firma-izolasyonu-musteri-uygulama.test.ts`
Expected: FAIL (en az "müşteri ayrıntısı" ve "müşteri düzenleme" satırları). Değişikliği geri al (`git diff src/server/customers/common.ts` boş olmalı).

- [ ] **Adım 3: Yeşili gör**

Run: aynı komut. Expected: PASS.

- [ ] **Adım 4: Teknisyen engeli testini yaz**

`tests/integration/musteri-yetki.test.ts`:

```ts
import { count, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  addAddress,
  lastUsedProvince,
  removeAddress,
  updateAddress,
} from '@/server/customers/addresses';
import { addDevice, removeDevice, updateDevice } from '@/server/customers/devices';
import { listCustomers, searchCustomers } from '@/server/customers/search';
import {
  createCustomer,
  findPhoneOwners,
  getCustomer,
  updateCustomer,
} from '@/server/customers/service';
import { customers, type UserRow } from '@/server/db/schema';
import { withTenant, type TenantTx } from '@/server/db/tenant';
import { createFakeClock } from '../helpers/clock';
import { useTestDbs } from '../helpers/db';
import { actorFor, seedCustomer, seedTenant, seedUser, type SeededCustomer, type SeededTenant } from '../helpers/fabrika';

const clock = createFakeClock();

describe('müşteri yetkileri', () => {
  const { app, owner } = useTestDbs();
  let tenant: SeededTenant;
  let technician: UserRow;
  let boss: UserRow;
  let seeded: SeededCustomer;

  const run = <T>(fn: (tx: TenantTx) => Promise<T>) => withTenant(app, tenant.id, fn);
  const tech = () => actorFor(technician, tenant.code);

  beforeAll(async () => {
    tenant = await seedTenant(owner);
    technician = await seedUser(owner, tenant.id, { role: 'technician' });
    boss = await seedUser(owner, tenant.id, { role: 'owner' });
    seeded = await seedCustomer(owner, tenant.id, boss.id);
  });

  // Geçerli girdilerle denenir: ret doğrulamadan değil yetkiden gelmeli.
  const calls: Array<[string, (tx: TenantTx) => Promise<unknown>]> = [
    ['liste', (tx) => listCustomers(tx, tech(), { missingLocation: false, after: null })],
    ['arama', (tx) => searchCustomers(tx, tech(), { query: 'deneme', missingLocation: false })],
    ['ayrıntı', (tx) => getCustomer(tx, tech(), seeded.id)],
    ['çift numara denetimi', (tx) => findPhoneOwners(tx, tech(), '0532 000 00 00', null)],
    [
      'müşteri ekleme',
      (tx) => createCustomer(tx, tech(), { name: 'Yeni', phones: [{ number: '0532 111 11 11', label: null }] }, clock),
    ],
    [
      'müşteri düzenleme',
      (tx) =>
        updateCustomer(
          tx,
          tech(),
          seeded.id,
          { version: 1, name: 'Değişti', note: null, phones: [{ number: '0532 000 00 00', label: null }] },
          clock,
        ),
    ],
    [
      'adres ekleme',
      (tx) =>
        addAddress(
          tx,
          tech(),
          seeded.id,
          { province: 'İstanbul', district: 'Kadıköy', addressLine: 'Moda Cad. 1' },
          clock,
        ),
    ],
    [
      'adres düzenleme',
      (tx) =>
        updateAddress(
          tx,
          tech(),
          seeded.id,
          seeded.addressId,
          { version: 1, province: 'İstanbul', district: 'Kadıköy', addressLine: 'Moda Cad. 2' },
          clock,
        ),
    ],
    ['adres kaldırma', (tx) => removeAddress(tx, tech(), seeded.id, seeded.addressId, clock)],
    ['son kullanılan il', (tx) => lastUsedProvince(tx, tech())],
    ['cihaz ekleme', (tx) => addDevice(tx, tech(), seeded.id, { type: 'dryer' }, clock)],
    [
      'cihaz düzenleme',
      (tx) => updateDevice(tx, tech(), seeded.id, seeded.deviceId, { version: 1, type: 'dryer' }, clock),
    ],
    ['cihaz kaldırma', (tx) => removeDevice(tx, tech(), seeded.id, seeded.deviceId, clock)],
  ];

  it.each(calls)('teknisyen: %s reddedilir', async (_name, call) => {
    await expect(run(call)).rejects.toMatchObject({ kind: 'forbidden' });
  });

  it('teknisyenin denemeleri hiçbir şey yazmadı', async () => {
    const [row] = await withTenant(owner, tenant.id, (tx) =>
      tx.select({ n: count() }).from(customers).where(eq(customers.tenantId, tenant.id)),
    );
    expect(row!.n).toBe(1);
    const detail = await run((tx) => getCustomer(tx, actorFor(boss, tenant.code), seeded.id));
    expect(detail).toMatchObject({ name: 'Deneme Müşteri', version: 1 });
    expect(detail.addresses).toHaveLength(1);
    expect(detail.devices).toHaveLength(1);
  });

  it('patron müşteri ekler, düzenler, adres ve cihaz ekler', async () => {
    const actor = actorFor(boss, tenant.code);
    const saved = await run((tx) =>
      createCustomer(tx, actor, { name: 'Patronun Müşterisi', phones: [{ number: '0532 222 22 22', label: null }] }, clock),
    );
    expect(saved.kind).toBe('saved');
    if (saved.kind !== 'saved') return;
    await run((tx) =>
      addAddress(tx, actor, saved.id, { province: 'İzmir', district: 'Bornova', addressLine: 'Ege Cad. 3' }, clock),
    );
    await run((tx) => addDevice(tx, actor, saved.id, { type: 'air_conditioner' }, clock));
    const detail = await run((tx) => getCustomer(tx, actor, saved.id));
    expect([detail.addresses.length, detail.devices.length]).toEqual([1, 1]);
  });
});
```

> `seedCustomer` (Görev 3) sabit `+905320000000` numarası ve "Deneme Müşteri" adıyla bir telefon, bir adres, bir cihaz yazar; sürümler 1'dir.

- [ ] **Adım 5: Yeşili gör**

Run: `npx vitest run --project integration tests/integration/musteri-yetki.test.ts`
Expected: PASS (13 ret + 2).

- [ ] **Adım 6: Bütün test takımı ve commit**

```bash
npm run format && npm run lint && npm run typecheck && npm test
git add tests/integration/firma-izolasyonu-musteri-uygulama.test.ts tests/integration/musteri-yetki.test.ts
git commit -m "Müşteriler: 1. kilit izolasyon testleri ve teknisyen engeli"
```

Expected: `npm test` yeşil; birim ve entegrasyon sayılarını not et (Görev 22'de belgelere yazılır).

---

### Görev 9: Ekran önizlemesi (sahibin onayı) 🧭

**Files:**
- Create: `C:\Users\expen\AppData\Local\Temp\claude\…\scratchpad\musteriler-onizleme.html` (geçici; depoya girmez)
- Modify: `docs/TASARIM-SISTEMI.md` (yalnızca sahip onayladıktan sonra)

**Interfaces:**
- Consumes: `docs/TASARIM-SISTEMI.md`, `src/app/globals.css` token'ları, `src/components/ui/*` bileşenlerinin görünümü, tasarım belgesi §6, §7, §8.3-8.4, §10
- Produces: sahibin onayladığı yerleşim kararları (Görev 10-13 ve 20 bunlara uyar); `--map-*` token değerleri için öneri (Görev 18'de `globals.css`'e girer)

> **Kapı:** Bu görev bitip sahip onaylamadan Görev 10-13'ün ekran kodu yazılmaz. Sahip bir yerleşimi değiştirirse Görev 10-13'teki kodda yalnızca yerleşim ve sınıflar değişir; metinler, davranış, eylemler ve testler aynı kalır. Değişiklikler Görev 9'un sonunda bu plana not olarak eklenir.

- [ ] **Adım 1: Skill'leri yükle ve mevcut sistemi oku**

`ui-ux-pro-max`, `frontend-design` ve `turkce-arayuz-metni` skill'lerini çağır; Artifact için `artifact-design` kurallarına uy. Oku: `docs/TASARIM-SISTEMI.md`, `src/app/globals.css`, `src/components/ui/card.tsx`, `badge.tsx`, `text-field.tsx`, `select-field.tsx`, `src/app/(uygulama)/personel/page.tsx` (liste kalıbı). Yeni renk kodu uydurulmaz: önizleme `globals.css`'teki token değerlerini kopyalar; tek yeni renkler `--map-*` önerileridir.

- [ ] **Adım 2: Önizleme sayfasını yaz**

Tek HTML dosyası; üstte "Telefon (360) / Masaüstü (1280)" ve "Açık / Koyu" geçişleri. Gösterilecek ekranlar ve haller:

| Ekran | Gösterilecek haller |
|---|---|
| `/musteriler` | Arama kutusu (büyüteç, temizle düğmesi), sekmeler "Tümü" / "Konumu eksik"; kart: ad, ana numara ("0532 123 45 67"), "Kadıköy · Caferağa", rozetler "Adres yok" / "Konum yok" (simge + metin); "Daha fazla göster"; boş hal ("Henüz müşteri yok" + Yeni müşteri), bulunamadı hali ("'0532 123' ile kayıtlı müşteri yok." + "Bu numarayla yeni müşteri ekle"), yükleniyor iskeleti |
| `/musteriler/yeni` | Ad; telefon satırları (Numara, Etiket, Ana numara yap, Kaldır, "+ Telefon ekle"); çift numara uyarısı ("Bu numara Ayşe Yılmaz adına kayıtlı." + Müşteriyi aç) ve kayıt sonrası "Yine de kaydet"; isteğe bağlı ilk adres bölümü (açılır) |
| `/musteriler/[id]` | Başlık + **Ara** düğmesi (telefonda büyük, başparmak erişiminde); telefonlar; adres kartları (konum var: "Konum işaretli" + Konumu düzelt; konum yok: uyarı kutusu "Konum işaretlenmedi" + Konumu işaretle); cihazlar (tür, marka/model, garanti bitişi; garantisi bitmişse "Garanti bitti" rozeti); not; "Ekleyen … · tarih", "Son değişiklik … · tarih" |
| Konum seçici | Telefonda tam ekran, masaüstünde büyük pencere; üstte "Adresi haritada bul" ve "Konum bağlantısı yapıştır"; ortada sabit iğne; sağda +/−; altta "Bu konumu kaydet" / "Vazgeç"; harita açılamadı hali. Harita SVG ile temsil edilir (cadde, su, park, bina, yazı) ve `--map-*` önerileriyle boyanır |
| Cihaz formu | Tür seçimi ("Diğer (yazın)" seçilince tür adı alanı), marka, model, seri no, kurulum tarihi, garanti bitişi, adres seçimi, not |

Harita token önerisi (açık ve koyu, iki tema için ayrı değer): `--map-background`, `--map-earth`, `--map-water`, `--map-park`, `--map-building`, `--map-road-minor`, `--map-road-major`, `--map-label`, `--map-label-halo`, `--map-boundary`. Sayfada her çiftin kontrast oranı yazılır (`--map-label` / `--map-label-halo` ve `--map-label` / `--map-earth` ≥ 4,5:1; yollar ve sınır `--map-earth` üstünde ≥ 1,5:1 ayırt edilebilirlik, yalnızca bilgi amaçlı).

Telefon ekranlarında alt menü 4 öğeyle (Ana sayfa, Müşteriler, Personel, Hesabım) gösterilir; %200 yazıda etiketin sığıp sığmadığı ayrıca bir "Büyük yazı" geçişiyle gösterilir.

- [ ] **Adım 3: Yayınla ve sahibe sun**

Artifact olarak yayınla (`icon: "layout"`). Sahibe kısa mesaj (Türkçe, ürün diliyle): ne gösterildiği, karar istenen noktalar (1) kartta hangi bilgiler, (2) müşteri sayfasında Ara düğmesinin yeri, (3) konum seçicinin düzeni, (4) harita renkleri. Önerini her birinde belirt. **Onay gelene kadar dur.**

- [ ] **Adım 4: Onaylanan kararları yaz**

`docs/TASARIM-SISTEMI.md`'ye "Müşteriler ekranları" bölümü: müşteri kartı düzeni, rozetler (Adres yok / Konum yok / Garanti bitti; tonları), Ara düğmesi kuralı, konum seçici düzeni (tam ekran/pencere eşiği, iğne, düğmeler), harita token'ları (değerler Görev 18'de `globals.css`'e girer), "telefon listesi alanı" ve "arama kutusu" bileşenleri. Sahip bir yerleşimi değiştirdiyse bu planın Görev 10-13 ve 20 başına "Önizleme kararı:" notu ekle.

- [ ] **Adım 5: Commit**

```bash
npm run format
git add docs/TASARIM-SISTEMI.md docs/superpowers/plans/2026-10-07-musteriler.md
git commit -m "Tasarım: Müşteriler ekranları ve harita renkleri (sahibin onayı)"
```

---

### Görev 10: Müşteri listesi ve arama ekranı

> Ön koşul: Görev 9'da sahip önizlemeyi onayladı. Onaylanan yerleşim aşağıdaki JSX'ten farklıysa yalnızca yerleşim ve sınıflar uyarlanır.

**Files:**
- Create: `src/lib/address-format.ts`, `src/lib/customer-links.ts`
- Create: `src/app/(uygulama)/musteriler/actions.ts`, `page.tsx`, `customer-search-box.tsx`, `customer-card.tsx`, `customer-list.tsx`
- Test: `tests/unit/address-format.test.ts`, `tests/unit/customer-links.test.ts`

**Interfaces:**
- Consumes: `listCustomers`, `searchCustomers`, `SEARCH_MESSAGES`, `CustomerSummary`, `CustomerPage` (Görev 7); `analyzeSearch` (Görev 1); `formatPhone` (Görev 1); `can`, `customer.view`/`customer.manage` (Görev 4)
- Produces:
  - `interface PlaceParts { province: string; district: string; neighborhood: string | null }`, `formatPlace(p: PlaceParts): string` ("Caferağa, Kadıköy / İstanbul"), `formatAddress(a: PlaceParts & { addressLine: string }): string`
  - `customersHref(opts: { q?: string; missing?: boolean }): string`, `newCustomerHref(query: string): string`
  - `actions.ts`: `currentActor()` (dosya içi), `loadMoreCustomersAction(after: string, missingLocation: boolean): Promise<ActionResult<CustomerPage>>`
  - `CustomerCard({ customer })`, `CustomerList({ initialItems, initialCursor, missing })`, `CustomerSearchBox({ initialQuery, missing, error? })`

- [ ] **Adım 1: Birim testlerini yaz**

`tests/unit/address-format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatAddress, formatPlace } from '@/lib/address-format';

describe('adres gösterimi', () => {
  it('mahalle varsa başta, sonra ilçe / il', () => {
    expect(formatPlace({ province: 'İstanbul', district: 'Kadıköy', neighborhood: 'Caferağa' })).toBe(
      'Caferağa, Kadıköy / İstanbul',
    );
    expect(formatPlace({ province: 'Ankara', district: 'Çankaya', neighborhood: null })).toBe(
      'Çankaya / Ankara',
    );
  });

  it('tam adres açık adresle başlar', () => {
    expect(
      formatAddress({
        province: 'İstanbul',
        district: 'Kadıköy',
        neighborhood: 'Caferağa',
        addressLine: 'Moda Cad. No: 5',
      }),
    ).toBe('Moda Cad. No: 5, Caferağa, Kadıköy / İstanbul');
  });
});
```

`tests/unit/customer-links.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { customersHref, newCustomerHref } from '@/lib/customer-links';

describe('müşteri bağlantıları', () => {
  it('arama ve süzgeç adres çubuğunda; boş arama yazılmaz', () => {
    expect(customersHref({})).toBe('/musteriler');
    expect(customersHref({ q: '  ' })).toBe('/musteriler');
    expect(customersHref({ q: ' Ayşe Yılmaz ' })).toBe('/musteriler?q=Ay%C5%9Fe+Y%C4%B1lmaz');
    expect(customersHref({ missing: true })).toBe('/musteriler?konum=eksik');
    expect(customersHref({ q: '0532', missing: true })).toBe('/musteriler?q=0532&konum=eksik');
  });

  it('bulunamayan arama: telefona benziyorsa numara, değilse ad önceden dolu', () => {
    expect(newCustomerHref('0532 123 45 67')).toBe('/musteriler/yeni?telefon=0532+123+45+67');
    expect(newCustomerHref('Ayşe')).toBe('/musteriler/yeni?ad=Ay%C5%9Fe');
    expect(newCustomerHref('a')).toBe('/musteriler/yeni');
  });
});
```

- [ ] **Adım 2: Kırmızıyı gör**

Run: `npx vitest run --project unit tests/unit/address-format.test.ts tests/unit/customer-links.test.ts`
Expected: FAIL, modüller yok.

- [ ] **Adım 3: `src/lib/address-format.ts` ve `src/lib/customer-links.ts`**

```ts
// src/lib/address-format.ts
export interface PlaceParts {
  province: string;
  district: string;
  neighborhood: string | null;
}

/** Kartta ve özetlerde: "Caferağa, Kadıköy / İstanbul". */
export function formatPlace(p: PlaceParts): string {
  const area = `${p.district} / ${p.province}`;
  return p.neighborhood ? `${p.neighborhood}, ${area}` : area;
}

/** Tam adres: "Moda Cad. No: 5, Caferağa, Kadıköy / İstanbul". */
export function formatAddress(a: PlaceParts & { addressLine: string }): string {
  return `${a.addressLine}, ${formatPlace(a)}`;
}
```

```ts
// src/lib/customer-links.ts
import { analyzeSearch } from './search';

/** Liste adresi: arama metni ve "Konumu eksik" süzgeci adres çubuğunda durur (geri tuşu ve yenileme korur). */
export function customersHref(opts: { q?: string; missing?: boolean }): string {
  const params = new URLSearchParams();
  const q = opts.q?.trim();
  if (q) params.set('q', q);
  if (opts.missing) params.set('konum', 'eksik');
  const query = params.toString();
  return query ? `/musteriler?${query}` : '/musteriler';
}

/** Bulunamayan aramadan yeni müşteri: telefona benziyorsa numara, değilse ad önceden dolu gelir. */
export function newCustomerHref(query: string): string {
  const kind = analyzeSearch(query).kind;
  const value = query.trim();
  if (kind === 'phone') return `/musteriler/yeni?${new URLSearchParams({ telefon: value })}`;
  if (kind === 'text') return `/musteriler/yeni?${new URLSearchParams({ ad: value })}`;
  return '/musteriler/yeni';
}
```

- [ ] **Adım 4: Yeşili gör**

Run: aynı komut. Expected: PASS.

- [ ] **Adım 5: Sunucu eylemleri dosyası**

`src/app/(uygulama)/musteriler/actions.ts` (sonraki görevler bu dosyaya ekler):

```ts
'use server';

import { runAction, type ActionResult } from '@/server/action-result';
import { actorFromSession } from '@/server/auth/actor';
import { requireSession } from '@/server/auth/current-user';
import { listCustomers, type CustomerPage } from '@/server/customers/search';
import { getDb } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';

async function currentActor() {
  return actorFromSession(await requireSession());
}

/** "Daha fazla göster": istemciden gelen değerlere güvenilmez; imleci servis doğrular. */
export async function loadMoreCustomersAction(
  after: string,
  missingLocation: boolean,
): Promise<ActionResult<CustomerPage>> {
  const actor = await currentActor();
  return runAction(() =>
    withTenant(getDb(), actor.tenantId, (tx) =>
      listCustomers(tx, actor, { missingLocation: missingLocation === true, after: String(after) }),
    ),
  );
}
```

- [ ] **Adım 6: Kart**

`src/app/(uygulama)/musteriler/customer-card.tsx`:

```tsx
import { ChevronRight, MapPinOff } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatPlace } from '@/lib/address-format';
import { formatPhone } from '@/lib/phone';
import type { CustomerSummary } from '@/server/customers/search';

export function CustomerCard({ customer }: { customer: CustomerSummary }) {
  const noAddress = customer.addressCount === 0;
  const missingLocation = !noAddress && customer.missingLocationCount > 0;
  return (
    <Link
      href={`/musteriler/${customer.id}`}
      className="@container flex items-center justify-between gap-3 rounded-card bg-surface p-4 shadow-card hover:bg-surface-muted"
    >
      <div className="min-w-0">
        <p className="type-display text-xl break-words text-fg">{customer.name}</p>
        {customer.mainPhone && (
          <p className="text-base text-fg tabular-nums">{formatPhone(customer.mainPhone)}</p>
        )}
        {customer.place && (
          <p className="text-base break-words text-fg-muted">{formatPlace(customer.place)}</p>
        )}
        {(noAddress || missingLocation) && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="warning">
              <MapPinOff className="size-4" aria-hidden="true" />
              {noAddress ? 'Adres yok' : 'Konum yok'}
            </Badge>
          </div>
        )}
      </div>
      {/* Kart dar kalınca (büyük yazı) ok gizlenir; eşik rem'le yazıyla birlikte büyür. */}
      <ChevronRight
        className="hidden size-6 shrink-0 text-fg-muted @3xs:block"
        aria-hidden="true"
      />
    </Link>
  );
}
```

- [ ] **Adım 7: Sayfalı liste**

`src/app/(uygulama)/musteriler/customer-list.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Spinner } from '@/components/ui/spinner';
import type { CustomerSummary } from '@/server/customers/search';
import { loadMoreCustomersAction } from './actions';
import { CustomerCard } from './customer-card';

interface CustomerListProps {
  initialItems: CustomerSummary[];
  initialCursor: string | null;
  missing: boolean;
}

/**
 * İlk sayfa sunucudan gelir ve sayfa yenilenince (kayıt sonrası) güncellenir; "Daha fazla göster" ile gelen
 * sayfalar ayrıca tutulur. Bu arada başa taşınan bir müşteri iki kez görünmesin diye kimliğe göre ayıklanır.
 */
export function CustomerList({ initialItems, initialCursor, missing }: CustomerListProps) {
  const [extra, setExtra] = useState<CustomerSummary[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [pending, startTransition] = useTransition();

  const shown = new Set(initialItems.map((c) => c.id));
  const items = [...initialItems, ...extra.filter((c) => !shown.has(c.id))];
  const nextCursor = cursor === undefined ? initialCursor : cursor;

  const loadMore = () => {
    if (!nextCursor) return;
    startTransition(async () => {
      const result = await loadMoreCustomersAction(nextCursor, missing);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setExtra((prev) => [...prev, ...result.data.items]);
      setCursor(result.data.nextCursor);
      setLoadedCount(result.data.items.length);
    });
  };

  return (
    <>
      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {items.map((c) => (
          <li key={c.id}>
            <CustomerCard customer={c} />
          </li>
        ))}
      </ul>
      {loadedCount > 0 && !pending && (
        <p role="status" className="sr-only">
          {loadedCount} müşteri daha gösterildi.
        </p>
      )}
      {error && !pending && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}
      {nextCursor && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={loadMore} disabled={pending} aria-busy={pending || undefined}>
            {pending && <Spinner />}
            {pending ? 'Yükleniyor…' : 'Daha fazla göster'}
          </Button>
        </div>
      )}
    </>
  );
}
```

- [ ] **Adım 8: Arama kutusu**

`src/app/(uygulama)/musteriler/customer-search-box.tsx`:

```tsx
'use client';

import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { describedBy, fieldClass, labelClass } from '@/components/ui/field-styles';
import { Spinner } from '@/components/ui/spinner';
import { customersHref } from '@/lib/customer-links';
import { analyzeSearch } from '@/lib/search';

const DELAY_MS = 300;

interface CustomerSearchBoxProps {
  initialQuery: string;
  missing: boolean;
  error?: string;
}

/**
 * Yazdıkça (300 ms gecikmeli) adres çubuğundaki aramayı günceller; sayfa sunucuda yeniden çizilir.
 * JavaScript yüklenmeden de sıradan bir GET formu olarak çalışır.
 */
export function CustomerSearchBox({ initialQuery, missing, error }: CustomerSearchBoxProps) {
  const router = useRouter();
  const id = useId();
  const hintId = `${id}-ipucu`;
  const errorId = error ? `${id}-hata` : undefined;
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [value, setValue] = useState(initialQuery);
  const [requested, setRequested] = useState(initialQuery);
  const [seen, setSeen] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  // Geri tuşu gibi dışarıdan gelen değişiklik kutuya yansır; kendi isteğimizin yanıtı yazılmakta olanı ezmez.
  if (initialQuery !== seen) {
    setSeen(initialQuery);
    if (initialQuery !== requested) {
      setValue(initialQuery);
      setRequested(initialQuery);
    }
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const navigate = (next: string) => {
    clearTimeout(timer.current);
    setRequested(next.trim());
    startTransition(() => {
      router.replace(customersHref({ q: next, missing }), { scroll: false });
    });
  };

  const onChange = (next: string) => {
    setValue(next);
    clearTimeout(timer.current);
    // Tek harfte sayfa yenilenmez; "en az 2" uyarısı yalnızca Enter'la görünür.
    if (analyzeSearch(next).kind === 'too_short') return;
    timer.current = setTimeout(() => navigate(next), DELAY_MS);
  };

  const clear = () => {
    setValue('');
    navigate('');
    input.current?.focus();
  };

  return (
    <form
      role="search"
      action="/musteriler"
      className="mt-4 flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        navigate(value);
      }}
    >
      {missing && <input type="hidden" name="konum" value="eksik" />}
      <label htmlFor={id} className={labelClass}>
        Müşteri ara
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-fg-muted">
          {pending ? <Spinner /> : <Search className="size-5" aria-hidden="true" />}
        </span>
        <input
          ref={input}
          id={id}
          type="search"
          name="q"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hintId, errorId)}
          className={`${fieldClass(Boolean(error))} pr-14 pl-11 [&::-webkit-search-cancel-button]:appearance-none`}
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            aria-label="Aramayı temizle"
            className="absolute top-1/2 right-1 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-control text-fg-muted hover:text-fg"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        )}
      </div>
      <p id={hintId} className="text-sm text-fg-muted">
        Ad, telefonun bir kısmı ya da adres yazın.
      </p>
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Adım 9: Liste sayfası**

`src/app/(uygulama)/musteriler/page.tsx`:

```tsx
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ForbiddenView } from '@/components/forbidden-view';
import { buttonClass } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { PageHeader } from '@/components/ui/page-header';
import { customersHref, newCustomerHref } from '@/lib/customer-links';
import { analyzeSearch } from '@/lib/search';
import { actorFromSession } from '@/server/auth/actor';
import { requireSession } from '@/server/auth/current-user';
import { SEARCH_MESSAGES, listCustomers, searchCustomers } from '@/server/customers/search';
import { getDb } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import { can } from '@/server/permissions';
import { CustomerCard } from './customer-card';
import { CustomerList } from './customer-list';
import { CustomerSearchBox } from './customer-search-box';

export const metadata: Metadata = { title: 'Müşteriler' };

type Params = { q?: string | string[]; konum?: string | string[] };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireSession();
  if (!can(session.user.role, 'customer.view')) return <ForbiddenView />;
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q : '';
  const missing = params.konum === 'eksik';
  const canManage = can(session.user.role, 'customer.manage');
  const actor = actorFromSession(session);

  const query = analyzeSearch(q);
  const searching = query.kind === 'phone' || query.kind === 'text';
  const queryError =
    query.kind === 'too_short'
      ? SEARCH_MESSAGES.tooShort
      : query.kind === 'too_long'
        ? SEARCH_MESSAGES.tooLong
        : undefined;

  const data = await withTenant(getDb(), actor.tenantId, async (tx) =>
    searching
      ? {
          kind: 'search' as const,
          ...(await searchCustomers(tx, actor, { query: q, missingLocation: missing })),
        }
      : {
          kind: 'list' as const,
          ...(await listCustomers(tx, actor, { missingLocation: missing, after: null })),
        },
  );

  const tabs = [
    { label: 'Tümü', href: customersHref({ q }), active: !missing },
    { label: 'Konumu eksik', href: customersHref({ q, missing: true }), active: missing },
  ];

  return (
    <>
      <PageHeader
        title="Müşteriler"
        actions={
          canManage && (
            <Link href="/musteriler/yeni" className={buttonClass('primary')}>
              <Plus className="size-5" aria-hidden="true" />
              Yeni müşteri
            </Link>
          )
        }
      />
      <CustomerSearchBox initialQuery={q} missing={missing} error={queryError} />
      <nav aria-label="Müşteri süzgeci" className="mt-4">
        <ul className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <li key={tab.label}>
              <Link
                href={tab.href}
                aria-current={tab.active ? 'page' : undefined}
                className={`inline-flex min-h-12 items-center rounded-control border-2 px-5 text-base ${
                  tab.active
                    ? 'border-primary bg-primary font-extrabold text-primary-fg'
                    : 'border-border-strong bg-surface font-semibold text-fg hover:bg-surface-muted'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {data.kind === 'search' ? (
        data.items.length === 0 ? (
          <EmptyState
            title="Müşteri bulunamadı"
            description={`"${q.trim()}" ile kayıtlı müşteri yok.${missing ? ' "Konumu eksik" süzgeci açık.' : ''}`}
            action={
              canManage && (
                <Link href={newCustomerHref(q)} className={buttonClass('primary')}>
                  <Plus className="size-5" aria-hidden="true" />
                  {query.kind === 'phone' ? 'Bu numarayla yeni müşteri ekle' : 'Bu adla yeni müşteri ekle'}
                </Link>
              )
            }
          />
        ) : (
          <>
            <p role="status" className="mt-4 text-base text-fg-muted">
              {data.hasMore ? 'İlk 50 sonuç gösteriliyor.' : `${data.items.length} müşteri bulundu.`}
            </p>
            <ul className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {data.items.map((c) => (
                <li key={c.id}>
                  <CustomerCard customer={c} />
                </li>
              ))}
            </ul>
            {data.hasMore && (
              <div className="mt-4">
                <Notice tone="info">Aradığınızı göremiyorsanız aramayı daraltın: soyadı ya da numaranın devamını yazın.</Notice>
              </div>
            )}
          </>
        )
      ) : data.items.length === 0 ? (
        <EmptyState
          title={missing ? 'Konumu eksik müşteri yok' : 'Henüz müşteri yok'}
          description={
            missing
              ? 'Bütün müşterilerin adresi ve konumu işaretli.'
              : 'İlk müşteriyi eklemek için "Yeni müşteri" düğmesine dokunun.'
          }
        />
      ) : (
        <CustomerList
          key={missing ? 'eksik' : 'tumu'}
          initialItems={data.items}
          initialCursor={data.nextCursor}
          missing={missing}
        />
      )}
    </>
  );
}
```

> `PageHeader`'ın `actions` özelliği `false` aldığında hiçbir şey çizmez (`actions && …`). Tür hatası verirse `canManage ? (…) : undefined` yaz.

- [ ] **Adım 10: Doğrulama ve commit**

```bash
npm run format && npm run lint && npm run typecheck && npx vitest run --project unit && npm run build
git add src/lib/address-format.ts src/lib/customer-links.ts "src/app/(uygulama)/musteriler" tests/unit/address-format.test.ts tests/unit/customer-links.test.ts
git commit -m "Müşteriler: liste, arama kutusu, 'Konumu eksik' süzgeci ve sayfalama"
```

Expected: hepsi temiz; `npm run build` çıktısında `/musteriler` rotası var. Ekranın çalışma zamanı denetimi Görev 14'teki E2E'dedir.

---

### Görev 11: Yeni müşteri ekranı (telefon listesi, çift numara uyarısı, isteğe bağlı ilk adres)

**Files:**
- Create: `src/lib/customer-form.ts`
- Create: `src/app/(uygulama)/musteriler/phone-list-field.tsx`, `duplicate-phone-notice.tsx`, `address-fields.tsx`, `location-status.tsx`, `yeni/page.tsx`, `yeni/new-customer-form.tsx`
- Modify: `src/app/(uygulama)/musteriler/actions.ts`
- Test: `tests/unit/customer-form.test.ts`

**Interfaces:**
- Consumes: `createCustomer`, `findPhoneOwners`, `PhoneOwner`, `SaveCustomerResult` (Görev 5); `lastUsedProvince` (Görev 6); `LIMITS` (Görev 5); `PROVINCES`, `findProvince` (Görev 2); `PickedLocation` (Görev 2); `parsePhone`, `formatPhone` (Görev 1)
- Produces:
  - `src/lib/customer-form.ts`: `interface PhoneRowValue { number; label }`, `interface AddressValues { label; province; district; neighborhood; addressLine; directions: string; location: PickedLocation | null }`, `EMPTY_ADDRESS`, `formText(fd, name): string`, `readPhones(fd): Array<{ number: string; label: string }>`, `readLocation(fd): { latitude: number; longitude: number; source: string } | null`, `readAddress(fd)`, `readVersion(fd): number`, `readNewCustomer(fd)`, `readCustomerEdit(fd)`, `readDevice(fd)`, `errorsUnder(errors, prefix): Record<string, string> | undefined`
  - Form alan adları: `name`, `note`, `phoneNumber`/`phoneLabel` (tekrarlanan), `withAddress`, `addressLabel`, `province`, `district`, `neighborhood`, `addressLine`, `directions`, `latitude`, `longitude`, `locationSource`, `version`, `confirmDuplicate`, cihazda `addressId`, `type`, `typeOther`, `brand`, `model`, `serialNo`, `installedOn`, `warrantyUntil`
  - `actions.ts`: `refresh(customerId?)` (dosya içi), `interface CustomerFormState extends FormState { duplicate?: PhoneOwner[] }`, `checkPhoneAction(number: string, excludeCustomerId: string | null): Promise<ActionResult<PhoneOwner[]>>`, `createCustomerAction(prev: CustomerFormState, fd: FormData): Promise<CustomerFormState>` (başarıda müşteri sayfasına yönlendirir)
  - Bileşenler: `PhoneListField({ initial, errors?, excludeCustomerId, max, onEdit? })`, `PhoneOwnerLinks({ owners })`, `DuplicatePhoneNotice({ owners })`, `AddressFields({ initial, errors? })`, `LocationStatus({ located })`

- [ ] **Adım 1: Form okuma testini yaz**

`tests/unit/customer-form.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  errorsUnder,
  readAddress,
  readCustomerEdit,
  readDevice,
  readNewCustomer,
  readPhones,
  readVersion,
} from '@/lib/customer-form';

function form(entries: Array<[string, string]>): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

describe('form okuma', () => {
  it('telefon satırları sırasıyla, boş satırlar da (hata satır numarası tutsun diye)', () => {
    const fd = form([
      ['phoneNumber', '0532 111 22 33'],
      ['phoneLabel', 'Ev'],
      ['phoneNumber', ''],
      ['phoneLabel', ''],
      ['phoneNumber', '0212 555 66 77'],
      ['phoneLabel', 'İş'],
    ]);
    expect(readPhones(fd)).toEqual([
      { number: '0532 111 22 33', label: 'Ev' },
      { number: '', label: '' },
      { number: '0212 555 66 77', label: 'İş' },
    ]);
  });

  it('konum: iki alan da boşsa yok; biri eksikse sayı değil (sunucu reddeder)', () => {
    const base: Array<[string, string]> = [
      ['province', 'İstanbul'],
      ['district', 'Kadıköy'],
      ['addressLine', 'Moda Cad. 5'],
    ];
    expect(readAddress(form(base)).location).toBeNull();
    expect(
      readAddress(
        form([...base, ['latitude', '41.0082'], ['longitude', '28.9784'], ['locationSource', 'link']]),
      ).location,
    ).toEqual({ latitude: 41.0082, longitude: 28.9784, source: 'link' });
    const half = readAddress(form([...base, ['latitude', '41.0082'], ['longitude', '']])).location;
    expect(Number.isNaN(half?.longitude)).toBe(true);
    expect(readAddress(form(base))).toEqual({
      label: '',
      province: 'İstanbul',
      district: 'Kadıköy',
      neighborhood: '',
      addressLine: 'Moda Cad. 5',
      directions: '',
      location: null,
    });
  });

  it('yeni müşteri: adres yalnızca "withAddress" ile; onay düğmesi', () => {
    const fd = form([
      ['name', 'Ayşe'],
      ['phoneNumber', '0532 111 22 33'],
      ['phoneLabel', ''],
      ['province', 'İstanbul'],
    ]);
    expect(readNewCustomer(fd)).toEqual({
      name: 'Ayşe',
      phones: [{ number: '0532 111 22 33', label: '' }],
      address: null,
      confirmDuplicate: false,
    });
    fd.append('withAddress', '1');
    fd.append('confirmDuplicate', '1');
    expect(readNewCustomer(fd)).toMatchObject({
      address: { province: 'İstanbul' },
      confirmDuplicate: true,
    });
  });

  it('sürüm: sayı değilse 0 (sunucu "sayfayı yenileyin" der)', () => {
    expect(readVersion(form([['version', '3']]))).toBe(3);
    expect(readVersion(form([['version', 'abc']]))).toBe(0);
    expect(readVersion(form([]))).toBe(0);
    expect(readCustomerEdit(form([['version', '2'], ['name', 'X'], ['note', 'Not']]))).toEqual({
      version: 2,
      name: 'X',
      note: 'Not',
      phones: [],
      confirmDuplicate: false,
    });
  });

  it('cihaz: boş adres seçimi null', () => {
    expect(readDevice(form([['type', 'combi_boiler'], ['addressId', '']]))).toEqual({
      addressId: null,
      type: 'combi_boiler',
      typeOther: '',
      brand: '',
      model: '',
      serialNo: '',
      installedOn: '',
      warrantyUntil: '',
      note: '',
    });
  });

  it('iç içe alan hataları önekten ayrılır', () => {
    expect(
      errorsUnder({ name: 'Ad', 'address.province': 'İl seçin.', 'address.location.latitude': 'K' }, 'address.'),
    ).toEqual({ province: 'İl seçin.', 'location.latitude': 'K' });
    expect(errorsUnder(undefined, 'address.')).toBeUndefined();
  });
});
```

- [ ] **Adım 2: Kırmızıyı gör**

Run: `npx vitest run --project unit tests/unit/customer-form.test.ts`
Expected: FAIL, `@/lib/customer-form` yok.

- [ ] **Adım 3: `src/lib/customer-form.ts`**

```ts
import type { PickedLocation } from './geo';

/**
 * Müşteri formlarının ortak sözleşmesi: ekranların tuttuğu değerler ve FormData → servis girdisi çevirisi.
 * Doğrulama burada değil serviste yapılır. Alan adları ekranlarla birebir aynı olmalı.
 */
export interface PhoneRowValue {
  number: string;
  label: string;
}

export interface AddressValues {
  label: string;
  province: string;
  district: string;
  neighborhood: string;
  addressLine: string;
  directions: string;
  location: PickedLocation | null;
}

export const EMPTY_ADDRESS: AddressValues = {
  label: '',
  province: '',
  district: '',
  neighborhood: '',
  addressLine: '',
  directions: '',
  location: null,
};

export function formText(fd: FormData, name: string): string {
  const value = fd.get(name);
  return typeof value === 'string' ? value : '';
}

const allText = (fd: FormData, name: string): string[] =>
  fd.getAll(name).map((v) => (typeof v === 'string' ? v : ''));

/** Telefon satırları sırasıyla; boş satırlar da gelir (servis atlar, hata anahtarı satır numarasını tutar). */
export function readPhones(fd: FormData): Array<{ number: string; label: string }> {
  const labels = allText(fd, 'phoneLabel');
  return allText(fd, 'phoneNumber').map((number, i) => ({ number, label: labels[i] ?? '' }));
}

/** İki alan da boşsa konum yok; biri boşsa NaN gider ve servis "konum okunamadı" der (0 sanılmasın). */
export function readLocation(
  fd: FormData,
): { latitude: number; longitude: number; source: string } | null {
  const lat = formText(fd, 'latitude').trim();
  const lng = formText(fd, 'longitude').trim();
  if (lat === '' && lng === '') return null;
  return {
    latitude: lat === '' ? Number.NaN : Number(lat),
    longitude: lng === '' ? Number.NaN : Number(lng),
    source: formText(fd, 'locationSource'),
  };
}

export function readAddress(fd: FormData) {
  return {
    label: formText(fd, 'addressLabel'),
    province: formText(fd, 'province'),
    district: formText(fd, 'district'),
    neighborhood: formText(fd, 'neighborhood'),
    addressLine: formText(fd, 'addressLine'),
    directions: formText(fd, 'directions'),
    location: readLocation(fd),
  };
}

export function readVersion(fd: FormData): number {
  const raw = formText(fd, 'version');
  const n = raw === '' ? Number.NaN : Number(raw);
  return Number.isInteger(n) ? n : 0;
}

const confirmed = (fd: FormData): boolean => formText(fd, 'confirmDuplicate') === '1';

export function readNewCustomer(fd: FormData) {
  return {
    name: formText(fd, 'name'),
    phones: readPhones(fd),
    address: formText(fd, 'withAddress') === '1' ? readAddress(fd) : null,
    confirmDuplicate: confirmed(fd),
  };
}

export function readCustomerEdit(fd: FormData) {
  return {
    version: readVersion(fd),
    name: formText(fd, 'name'),
    note: formText(fd, 'note'),
    phones: readPhones(fd),
    confirmDuplicate: confirmed(fd),
  };
}

export function readDevice(fd: FormData) {
  return {
    addressId: formText(fd, 'addressId') || null,
    type: formText(fd, 'type'),
    typeOther: formText(fd, 'typeOther'),
    brand: formText(fd, 'brand'),
    model: formText(fd, 'model'),
    serialNo: formText(fd, 'serialNo'),
    installedOn: formText(fd, 'installedOn'),
    warrantyUntil: formText(fd, 'warrantyUntil'),
    note: formText(fd, 'note'),
  };
}

/** "address.province" gibi iç içe hataları alt forma verir: { province }. */
export function errorsUnder(
  errors: Readonly<Record<string, string>> | undefined,
  prefix: string,
): Record<string, string> | undefined {
  if (!errors) return undefined;
  const picked = Object.entries(errors)
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, message]) => [key.slice(prefix.length), message] as const);
  return picked.length > 0 ? Object.fromEntries(picked) : {};
}
```

- [ ] **Adım 4: Yeşili gör**

Run: `npx vitest run --project unit tests/unit/customer-form.test.ts`
Expected: PASS.

- [ ] **Adım 5: Eylemler**

`src/app/(uygulama)/musteriler/actions.ts`'e ekle (içe aktarmaları dosyanın başındaki listeye kat):

```ts
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { readNewCustomer } from '@/lib/customer-form';
import type { FormState } from '@/lib/form-state';
import { createCustomer, findPhoneOwners, type PhoneOwner } from '@/server/customers/service';
import { systemClock } from '@/server/clock';

function refresh(customerId?: string): void {
  revalidatePath('/musteriler');
  // 'layout': müşterinin bütün alt sayfaları (düzenle, adresler, cihazlar) da yenilenir.
  if (customerId) revalidatePath(`/musteriler/${customerId}`, 'layout');
}

export interface CustomerFormState extends FormState {
  /** Çift numara: kayıt yapılmadı, kullanıcı "Yine de kaydet" ile onaylayabilir. */
  duplicate?: PhoneOwner[];
}

/** Numara yazılırken (gecikmeli) çağrılır: firmada bu numara başka müşteride kayıtlı mı? */
export async function checkPhoneAction(
  number: string,
  excludeCustomerId: string | null,
): Promise<ActionResult<PhoneOwner[]>> {
  const actor = await currentActor();
  return runAction(() =>
    withTenant(getDb(), actor.tenantId, (tx) =>
      findPhoneOwners(
        tx,
        actor,
        String(number).slice(0, 40),
        excludeCustomerId === null ? null : String(excludeCustomerId),
      ),
    ),
  );
}

export async function createCustomerAction(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const actor = await currentActor();
  const input = readNewCustomer(formData);
  const result = await runAction(() =>
    withTenant(getDb(), actor.tenantId, (tx) => createCustomer(tx, actor, input, systemClock)),
  );
  if (!result.ok) return { message: result.error.message, fieldErrors: result.error.fieldErrors };
  if (result.data.kind === 'duplicate_phone') return { duplicate: result.data.owners };
  refresh();
  redirect(`/musteriler/${result.data.id}`);
}
```

- [ ] **Adım 6: Konum durumu ve adres alanları**

`src/app/(uygulama)/musteriler/location-status.tsx`:

```tsx
import { MapPin, MapPinOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

/** Konum durumu yalnızca renkle değil simge ve metinle verilir. */
export function LocationStatus({ located }: { located: boolean }) {
  return located ? (
    <Badge tone="success">
      <MapPin className="size-4" aria-hidden="true" />
      Konum işaretli
    </Badge>
  ) : (
    <Badge tone="warning">
      <MapPinOff className="size-4" aria-hidden="true" />
      Konum işaretlenmedi
    </Badge>
  );
}
```

`src/app/(uygulama)/musteriler/address-fields.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { labelClass } from '@/components/ui/field-styles';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import type { AddressValues } from '@/lib/customer-form';
import { PROVINCES, findProvince } from '@/lib/tr-il-ilce';
import { LocationStatus } from './location-status';

const PROVINCE_OPTIONS = [
  { value: '', label: 'İl seçin' },
  ...PROVINCES.map((p) => ({ value: p.name, label: p.name })),
];

/**
 * Adres alanları; değerler bileşenin durumunda tutulur (React'in form sıfırlaması kontrollü alanlara dokunmaz,
 * sunucu hatasından sonra yazılanlar kaybolmaz). İl değişince ilçe boşalır. Konum, gizli alanlarla gider;
 * konum seçici Görev 20'de eklenir.
 */
export function AddressFields({
  initial,
  errors,
}: {
  initial: AddressValues;
  errors?: Readonly<Record<string, string>>;
}) {
  const [values, setValues] = useState(initial);
  const set = (patch: Partial<AddressValues>) => setValues((v) => ({ ...v, ...patch }));
  const province = findProvince(values.province);
  const districtOptions = [
    { value: '', label: province ? 'İlçe seçin' : 'Önce il seçin' },
    ...(province?.districts ?? []).map((d) => ({ value: d.name, label: d.name })),
  ];
  const locationError =
    errors?.['location.latitude'] ?? errors?.['location.longitude'] ?? errors?.['location.source'];

  return (
    <div className="grid grid-cols-1 gap-4">
      <TextField
        label="Adres etiketi (isteğe bağlı)"
        name="addressLabel"
        value={values.label}
        onChange={(e) => set({ label: e.target.value })}
        autoComplete="off"
        hint="Örneğin: Ev, Yazlık, Dükkân"
        error={errors?.label}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SelectField
          label="İl"
          name="province"
          value={values.province}
          onChange={(e) => set({ province: e.target.value, district: '' })}
          options={PROVINCE_OPTIONS}
          required
          error={errors?.province}
        />
        <SelectField
          label="İlçe"
          name="district"
          value={values.district}
          onChange={(e) => set({ district: e.target.value })}
          options={districtOptions}
          disabled={!province}
          required
          error={errors?.district}
        />
      </div>
      <TextField
        label="Mahalle (isteğe bağlı)"
        name="neighborhood"
        value={values.neighborhood}
        onChange={(e) => set({ neighborhood: e.target.value })}
        autoComplete="off"
        error={errors?.neighborhood}
      />
      <TextField
        label="Açık adres"
        name="addressLine"
        value={values.addressLine}
        onChange={(e) => set({ addressLine: e.target.value })}
        autoComplete="off"
        required
        hint="Cadde/sokak, bina ve daire no"
        error={errors?.addressLine}
      />
      <TextField
        label="Tarif (isteğe bağlı)"
        name="directions"
        value={values.directions}
        onChange={(e) => set({ directions: e.target.value })}
        autoComplete="off"
        hint="Örneğin: Eczanenin üstü, zil çalışmıyor"
        error={errors?.directions}
      />
      <div className="flex flex-col gap-2">
        <p className={labelClass}>Konum</p>
        <div>
          <LocationStatus located={values.location !== null} />
        </div>
        {locationError && <p className="text-sm font-medium text-danger">{locationError}</p>}
      </div>
      <input type="hidden" name="latitude" value={values.location?.latitude ?? ''} />
      <input type="hidden" name="longitude" value={values.location?.longitude ?? ''} />
      <input type="hidden" name="locationSource" value={values.location?.source ?? ''} />
    </div>
  );
}
```

- [ ] **Adım 7: Telefon listesi ve çift numara uyarıları**

`src/app/(uygulama)/musteriler/duplicate-phone-notice.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { buttonClass } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { formatPhone } from '@/lib/phone';
import type { PhoneOwner } from '@/server/customers/service';

const linkClass = 'inline-flex min-h-12 items-center font-bold underline underline-offset-4';

/** Numara yazılırken çıkan uyarı: aynı kişiyse kullanıcı mevcut müşteriyi açar. */
export function PhoneOwnerLinks({ owners }: { owners: PhoneOwner[] }) {
  if (owners.length === 1) {
    return (
      <Notice tone="warning">
        Bu numara <strong>{owners[0]!.customerName}</strong> adına kayıtlı.{' '}
        <Link href={`/musteriler/${owners[0]!.customerId}`} className={linkClass}>
          Müşteriyi aç
        </Link>
      </Notice>
    );
  }
  return (
    <Notice tone="warning" title={`Bu numara ${owners.length} müşteride kayıtlı`}>
      <ul>
        {owners.map((o) => (
          <li key={o.customerId}>
            <Link href={`/musteriler/${o.customerId}`} className={linkClass}>
              {o.customerName}
            </Link>
          </li>
        ))}
      </ul>
    </Notice>
  );
}

/** Kaydet'ten sonra sunucu çift numara bulduysa: kayıt yapılmadı, kullanıcı onaylayabilir. */
export function DuplicatePhoneNotice({ owners }: { owners: PhoneOwner[] }) {
  const { pending } = useFormStatus();
  return (
    <Notice tone="warning" title="Bu numara başka bir müşteride kayıtlı">
      <ul className="mt-1">
        {owners.map((o) => (
          <li key={`${o.number}-${o.customerId}`}>
            <span className="tabular-nums">{formatPhone(o.number)}</span>:{' '}
            <Link href={`/musteriler/${o.customerId}`} className={linkClass}>
              {o.customerName}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-2">
        Aynı kişiyse o müşteriyi açın. Aile üyesi ya da site yöneticisi gibi ortak bir numaraysa yine de
        kaydedebilirsiniz.
      </p>
      <button
        type="submit"
        name="confirmDuplicate"
        value="1"
        disabled={pending}
        className={`${buttonClass('secondary')} mt-3`}
      >
        Yine de kaydet
      </button>
    </Notice>
  );
}
```

`src/app/(uygulama)/musteriler/phone-list-field.tsx`:

```tsx
'use client';

import { Plus, Star, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { labelClass } from '@/components/ui/field-styles';
import { TextField } from '@/components/ui/text-field';
import type { PhoneRowValue } from '@/lib/customer-form';
import { parsePhone } from '@/lib/phone';
import type { PhoneOwner } from '@/server/customers/service';
import { checkPhoneAction } from './actions';
import { PhoneOwnerLinks } from './duplicate-phone-notice';

interface Row extends PhoneRowValue {
  key: number;
  owners: PhoneOwner[];
}

const CHECK_DELAY_MS = 500;

interface PhoneListFieldProps {
  initial: PhoneRowValue[];
  /** Sunucunun alan hataları ("phones", "phones.1.number"); satır numarası gönderilen sıradır. */
  errors?: Readonly<Record<string, string>>;
  /** Düzenlemede müşterinin kendisi "çift" sayılmasın. */
  excludeCustomerId: string | null;
  max: number;
  /** Satırlar değişince: üst form eski hataları ve çift numara uyarısını gizler. */
  onEdit?: () => void;
}

export function PhoneListField({ initial, errors, excludeCustomerId, max, onEdit }: PhoneListFieldProps) {
  const [rows, setRows] = useState<Row[]>(() =>
    (initial.length > 0 ? initial : [{ number: '', label: '' }]).map((r, i) => ({
      ...r,
      key: i,
      owners: [],
    })),
  );
  const [focusKey, setFocusKey] = useState<number | null>(null);
  const nextKey = useRef(Math.max(initial.length, 1));
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const latest = useRef(new Map<number, string>());

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => clearTimeout(t));
  }, []);

  const change = (key: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    onEdit?.();
  };

  const scheduleCheck = (key: number, number: string) => {
    clearTimeout(timers.current.get(key));
    latest.current.set(key, number);
    if (!parsePhone(number).ok) return;
    timers.current.set(
      key,
      setTimeout(async () => {
        const result = await checkPhoneAction(number, excludeCustomerId);
        if (latest.current.get(key) !== number) return; // bu arada numara değişti
        setRows((prev) =>
          prev.map((r) => (r.key === key ? { ...r, owners: result.ok ? result.data : [] } : r)),
        );
      }, CHECK_DELAY_MS),
    );
  };

  const add = () => {
    const key = nextKey.current++;
    setRows((prev) => [...prev, { key, number: '', label: '', owners: [] }]);
    setFocusKey(key);
    onEdit?.();
  };

  const remove = (key: number) => {
    clearTimeout(timers.current.get(key));
    latest.current.delete(key);
    setRows((prev) => prev.filter((r) => r.key !== key));
    onEdit?.();
  };

  const makeMain = (key: number) => {
    setRows((prev) => {
      const row = prev.find((r) => r.key === key);
      return row ? [row, ...prev.filter((r) => r.key !== key)] : prev;
    });
    onEdit?.();
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={`${labelClass} mb-2`}>Telefonlar</legend>
      {errors?.phones && <p className="text-sm font-medium text-danger">{errors.phones}</p>}
      <ol className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <li key={row.key} className="rounded-control border-2 border-border p-3">
            <fieldset>
              <legend className="type-display text-lg text-fg">
                {i === 0 ? '1. telefon (ana numara)' : `${i + 1}. telefon`}
              </legend>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  label="Numara"
                  name="phoneNumber"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  autoFocus={row.key === focusKey}
                  value={row.number}
                  onChange={(e) => {
                    change(row.key, { number: e.target.value, owners: [] });
                    scheduleCheck(row.key, e.target.value);
                  }}
                  hint={i === 0 ? 'Örneğin 0532 123 45 67' : undefined}
                  error={errors?.[`phones.${i}.number`]}
                />
                <TextField
                  label="Etiket (isteğe bağlı)"
                  name="phoneLabel"
                  autoComplete="off"
                  value={row.label}
                  onChange={(e) => change(row.key, { label: e.target.value })}
                  hint="Örneğin: Ev, İş, Site yöneticisi"
                  error={errors?.[`phones.${i}.label`]}
                />
              </div>
              {row.owners.length > 0 && (
                <div className="mt-3">
                  <PhoneOwnerLinks owners={row.owners} />
                </div>
              )}
              {(i > 0 || rows.length > 1) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {i > 0 && (
                    <Button
                      variant="ghost"
                      onClick={() => makeMain(row.key)}
                      aria-label={`${i + 1}. telefonu ana numara yap`}
                    >
                      <Star className="size-5" aria-hidden="true" />
                      Ana numara yap
                    </Button>
                  )}
                  {rows.length > 1 && (
                    <Button
                      variant="ghost"
                      onClick={() => remove(row.key)}
                      aria-label={`${i + 1}. telefonu kaldır`}
                    >
                      <Trash2 className="size-5" aria-hidden="true" />
                      Kaldır
                    </Button>
                  )}
                </div>
              )}
            </fieldset>
          </li>
        ))}
      </ol>
      {rows.length < max && (
        <div>
          <Button variant="secondary" onClick={add}>
            <Plus className="size-5" aria-hidden="true" />
            Telefon ekle
          </Button>
        </div>
      )}
    </fieldset>
  );
}
```

- [ ] **Adım 8: Yeni müşteri formu ve sayfası**

`src/app/(uygulama)/musteriler/yeni/new-customer-form.tsx`:

```tsx
'use client';

import { MapPin } from 'lucide-react';
import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/button';
import { labelClass } from '@/components/ui/field-styles';
import { Notice } from '@/components/ui/notice';
import { SubmitButton } from '@/components/ui/submit-button';
import { TextField } from '@/components/ui/text-field';
import { EMPTY_ADDRESS, errorsUnder } from '@/lib/customer-form';
import { createCustomerAction, type CustomerFormState } from '../actions';
import { AddressFields } from '../address-fields';
import { DuplicatePhoneNotice } from '../duplicate-phone-notice';
import { PhoneListField } from '../phone-list-field';

interface NewCustomerFormProps {
  initialName: string;
  initialPhone: string;
  defaultProvince: string;
  maxPhones: number;
}

export function NewCustomerForm({
  initialName,
  initialPhone,
  defaultProvince,
  maxPhones,
}: NewCustomerFormProps) {
  const [state, formAction, pending] = useActionState<CustomerFormState, FormData>(
    createCustomerAction,
    {},
  );
  const [name, setName] = useState(initialName);
  const [withAddress, setWithAddress] = useState(false);
  // Yanıttan sonra telefonlar değiştiyse o yanıtın telefon hataları ve çift numara uyarısı artık geçerli değil.
  const [phonesEditedAfter, setPhonesEditedAfter] = useState<CustomerFormState | null>(null);
  const phonesFresh = phonesEditedAfter !== state;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.message && !pending && <Notice tone="error">{state.message}</Notice>}
      <TextField
        label="Ad soyad ya da firma adı"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        autoFocus={initialName === '' && initialPhone === ''}
        required
        hint="Şirket ya da apartman yönetimiyse yetkili kişiyi telefonun etiketine yazın."
        error={state.fieldErrors?.name}
      />
      <PhoneListField
        initial={initialPhone ? [{ number: initialPhone, label: '' }] : []}
        errors={phonesFresh ? state.fieldErrors : undefined}
        excludeCustomerId={null}
        max={maxPhones}
        onEdit={() => setPhonesEditedAfter(state)}
      />
      {withAddress ? (
        <fieldset className="flex flex-col gap-4">
          <legend className={`${labelClass} mb-2`}>Adres</legend>
          <input type="hidden" name="withAddress" value="1" />
          <AddressFields
            initial={{ ...EMPTY_ADDRESS, province: defaultProvince }}
            errors={errorsUnder(state.fieldErrors, 'address.')}
          />
          <div>
            <Button variant="ghost" onClick={() => setWithAddress(false)}>
              Adresi şimdi eklemeyin
            </Button>
          </div>
        </fieldset>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div>
            <Button variant="secondary" onClick={() => setWithAddress(true)}>
              <MapPin className="size-5" aria-hidden="true" />
              Adres ekle
            </Button>
          </div>
          <p className="text-sm text-fg-muted">Adresi sonra müşteri sayfasından da ekleyebilirsiniz.</p>
        </div>
      )}
      {state.duplicate && phonesFresh && !pending && (
        <DuplicatePhoneNotice owners={state.duplicate} />
      )}
      <SubmitButton pendingLabel="Kaydediliyor…">Müşteriyi kaydet</SubmitButton>
    </form>
  );
}
```

> "Adresi şimdi eklemeyin" düğmesi metni Görev 9'daki önizlemede sahibe gösterilir; sahip başka bir metin seçerse burası değişir.

`src/app/(uygulama)/musteriler/yeni/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { ForbiddenView } from '@/components/forbidden-view';
import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { actorFromSession } from '@/server/auth/actor';
import { requireSession } from '@/server/auth/current-user';
import { lastUsedProvince } from '@/server/customers/addresses';
import { LIMITS } from '@/server/customers/common';
import { getDb } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import { can } from '@/server/permissions';
import { NewCustomerForm } from './new-customer-form';

export const metadata: Metadata = { title: 'Yeni müşteri' };

type Params = { telefon?: string | string[]; ad?: string | string[] };

const prefill = (value: string | string[] | undefined): string =>
  typeof value === 'string' ? value.trim().slice(0, 120) : '';

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const session = await requireSession();
  if (!can(session.user.role, 'customer.manage')) return <ForbiddenView />;
  const params = await searchParams;
  const actor = actorFromSession(session);
  const province = await withTenant(getDb(), actor.tenantId, (tx) => lastUsedProvince(tx, actor));

  return (
    <>
      <BackLink href="/musteriler">Müşteriler</BackLink>
      <PageHeader
        title="Yeni müşteri"
        description="En az bir telefon numarası gerekir. Adres ve cihazları sonra da ekleyebilirsiniz."
      />
      <Card className="mt-6 max-w-2xl">
        <NewCustomerForm
          initialName={prefill(params.ad)}
          initialPhone={prefill(params.telefon)}
          defaultProvince={province ?? ''}
          maxPhones={LIMITS.phones}
        />
      </Card>
    </>
  );
}
```

- [ ] **Adım 9: Doğrulama ve commit**

```bash
npm run format && npm run lint && npm run typecheck && npx vitest run --project unit && npm run build
git add src/lib/customer-form.ts "src/app/(uygulama)/musteriler" tests/unit/customer-form.test.ts
git commit -m "Müşteriler: yeni müşteri ekranı, telefon listesi ve çift numara uyarısı"
```

Expected: hepsi temiz. Lint `react-hooks` kuralları (`set-state-in-effect`, `refs`) uyarı verirse kalıbı değiştir: durum yalnızca olay işleyicilerinde ve zamanlayıcı geri çağrısında güncellenir, ref'ler çizim sırasında okunmaz (`nextKey` yalnızca `add` içinde).

---

### Görev 12: Müşteri sayfası ve düzenleme (sürüm çakışmasında güncel kayıt)

**Files:**
- Modify: `src/lib/format.ts`, `src/server/action-result.ts`, `src/lib/customer-form.ts`, `src/app/(uygulama)/musteriler/actions.ts`
- Create: `src/components/ui/text-area-field.tsx`
- Create: `src/app/(uygulama)/musteriler/customer-data.ts`, `[id]/page.tsx`, `[id]/duzenle/page.tsx`, `[id]/duzenle/edit-customer-form.tsx`
- Test: `tests/unit/format.test.ts`, `tests/unit/action-result.test.ts` (ekleme)

**Interfaces:**
- Consumes: `getCustomer`, `updateCustomer`, `CustomerDetail`, `CustomerAddress`, `CustomerDevice` (Görev 5); `STALE_MESSAGE`, `staleError` (Görev 4); `deviceTypeLabel` (Görev 1); `formatAddress` (Görev 10); `PhoneListField`, `DuplicatePhoneNotice`, `LocationStatus`, `CustomerFormState`, `refresh`, `currentActor` (Görev 11)
- Produces:
  - `format.ts`: `formatDate(iso: string): string` ("5 Mart 2025"), `isoDateInIstanbul(date: Date): string` ("2026-10-07")
  - `action-result.ts`: `type EditResult<T> = ActionResult<T> | { ok: false; stale: true; error: { message: string } }`, `runEdit<T>(fn): Promise<EditResult<T>>`
  - `customer-form.ts`: `interface CustomerEditValues { version: number; name: string; note: string; phones: PhoneRowValue[] }`
  - `TextAreaField({ label, hint?, error?, ...textarea })`
  - `customer-data.ts` (yalnızca sunucu): `loadCustomer(id, permission): Promise<{ customer: CustomerDetail; canManage: boolean } | 'forbidden'>` (bulunamazsa `notFound()`), `customerEditValues(c): CustomerEditValues`, `addressLabel(a, index): string`
  - `actions.ts`: `interface EditCustomerState extends CustomerFormState { current?: CustomerEditValues }`, `updateCustomerAction(id, prev, fd): Promise<EditCustomerState>`

- [ ] **Adım 1: Testleri yaz**

`tests/unit/format.test.ts`'e ekle (`import` satırını `formatDate, formatDateTime, isoDateInIstanbul` yap):

```ts
describe('yalnızca tarih', () => {
  it('ISO tarihi Türkçe ay adıyla, saat dilimi kaydırmadan gösterir', () => {
    expect(formatDate('2025-03-05')).toBe('5 Mart 2025');
    expect(formatDate('2026-12-31')).toBe('31 Aralık 2026');
    expect(formatDate('2027-01-01')).toBe('1 Ocak 2027');
  });

  it('İstanbul takvim günü: UTC gece yarısından önce İstanbul ertesi gündedir', () => {
    expect(isoDateInIstanbul(new Date('2026-10-06T20:59:00Z'))).toBe('2026-10-06');
    expect(isoDateInIstanbul(new Date('2026-10-06T21:00:00Z'))).toBe('2026-10-07');
  });
});
```

`tests/unit/action-result.test.ts`'e ekle (`import` satırlarını `runAction, runEdit` ve `STALE_MESSAGE, conflictError, forbiddenError, staleError, validationError` yap):

```ts
describe('runEdit', () => {
  it('başarılı sonucu runAction gibi sarar', async () => {
    expect(await runEdit(async () => 7)).toEqual({ ok: true, data: 7 });
  });

  it('sürüm çakışmasını ayrı döndürür: form güncel kayıtla yenilenir', async () => {
    expect(
      await runEdit(async () => {
        throw staleError();
      }),
    ).toEqual({ ok: false, stale: true, error: { message: STALE_MESSAGE } });
  });

  it('diğer beklenen hatalar runAction ile aynı biçimde', async () => {
    expect(
      await runEdit(async () => {
        throw validationError({ name: 'Adı yazın.' });
      }),
    ).toEqual({
      ok: false,
      error: { message: 'İşaretli alanları düzeltin.', fieldErrors: { name: 'Adı yazın.' } },
    });
  });
});
```

- [ ] **Adım 2: Kırmızıyı gör**

Run: `npx vitest run --project unit tests/unit/format.test.ts tests/unit/action-result.test.ts`
Expected: FAIL (`formatDate`, `isoDateInIstanbul`, `runEdit` yok).

- [ ] **Adım 3: `format.ts` ve `action-result.ts`**

`src/lib/format.ts`'e ekle:

```ts
const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Yalnızca tarih ("2025-03-05" → "5 Mart 2025"). Saat dilimi kaydırmasın diye UTC gece yarısı olarak biçimlenir. */
export function formatDate(iso: string): string {
  const parts = Object.fromEntries(
    dateFormatter.formatToParts(new Date(`${iso}T00:00:00Z`)).map((p) => [p.type, p.value]),
  );
  return `${parts.day} ${parts.month} ${parts.year}`;
}

const istanbulDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** İstanbul'daki takvim günü ("2026-10-07"); garanti bitişi gibi yalnızca tarih karşılaştırmaları için. */
export function isoDateInIstanbul(date: Date): string {
  const parts = Object.fromEntries(istanbulDay.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
```

`src/server/action-result.ts`'e ekle:

```ts
export type EditResult<T> =
  | ActionResult<T>
  | { ok: false; stale: true; error: { message: string } };

/**
 * runAction gibi; ek olarak sürüm çakışmasını ayrı döndürür (eylem güncel kaydı okuyup formu onunla yeniler).
 * ActionResult'ın biçimi değişmez: mevcut eylemler ve testleri etkilenmez.
 */
export async function runEdit<T>(fn: () => Promise<T>): Promise<EditResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof AppError && err.kind === 'stale') {
      return { ok: false, stale: true, error: { message: err.userMessage } };
    }
    return runAction(() => Promise.reject(err));
  }
}
```

- [ ] **Adım 4: Yeşili gör**

Run: aynı komut. Expected: PASS.

- [ ] **Adım 5: Çok satırlı alan**

`src/components/ui/text-area-field.tsx`:

```tsx
import { useId, type TextareaHTMLAttributes } from 'react';
import { describedBy, fieldClass, labelClass } from './field-styles';

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextAreaField({ label, hint, error, rows = 4, ...textarea }: TextAreaFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-ipucu` : undefined;
  const errorId = error ? `${id}-hata` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        {...textarea}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(hintId, errorId)}
        className={`${fieldClass(Boolean(error))} resize-y`}
      />
      {hint && (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Adım 6: Ortak form türü ve sunucu yardımcıları**

`src/lib/customer-form.ts`'e ekle:

```ts
export interface CustomerEditValues {
  version: number;
  name: string;
  note: string;
  phones: PhoneRowValue[];
}
```

`src/app/(uygulama)/musteriler/customer-data.ts`:

```ts
import 'server-only';
import { notFound } from 'next/navigation';
import type { CustomerEditValues } from '@/lib/customer-form';
import { formatPhone } from '@/lib/phone';
import { actorFromSession } from '@/server/auth/actor';
import { requireSession } from '@/server/auth/current-user';
import {
  getCustomer,
  type CustomerAddress,
  type CustomerDetail,
} from '@/server/customers/service';
import { getDb } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import { AppError } from '@/server/errors';
import { can, type Permission } from '@/server/permissions';

/** Müşteri sayfaları için: yetki → kayıt. Başka firmanın kaydı da "bulunamadı" (varlığı belli edilmez). */
export async function loadCustomer(
  id: string,
  permission: Permission,
): Promise<{ customer: CustomerDetail; canManage: boolean } | 'forbidden'> {
  const session = await requireSession();
  if (!can(session.user.role, permission)) return 'forbidden';
  const actor = actorFromSession(session);
  const customer = await withTenant(getDb(), actor.tenantId, (tx) => getCustomer(tx, actor, id)).catch(
    (err: unknown) => {
      if (err instanceof AppError && err.kind === 'not_found') notFound();
      throw err;
    },
  );
  return { customer, canManage: can(session.user.role, 'customer.manage') };
}

export function customerEditValues(c: CustomerDetail): CustomerEditValues {
  return {
    version: c.version,
    name: c.name,
    note: c.note ?? '',
    // Formda okunaklı yazım ("0532 123 45 67"); servis yeniden aynı E.164'e çevirir, "telefon değişti" sayılmaz.
    phones: c.phones.map((p) => ({ number: formatPhone(p.number), label: p.label ?? '' })),
  };
}

/** Etiketsiz adres sırasıyla anılır: "2. adres". */
export function addressLabel(a: Pick<CustomerAddress, 'label'>, index: number): string {
  return a.label ?? `${index + 1}. adres`;
}
```

- [ ] **Adım 7: Düzenleme eylemi**

`actions.ts`'e ekle (içe aktarmaları başa kat):

```ts
import type { Actor } from '@/server/auth/actor';
import { runEdit } from '@/server/action-result';
import { readCustomerEdit, type CustomerEditValues } from '@/lib/customer-form';
import { getCustomer, updateCustomer } from '@/server/customers/service';
import { customerEditValues } from './customer-data';

export interface EditCustomerState extends CustomerFormState {
  /** Sürüm çakışması: form bu güncel değerlerle yeniden kurulur. */
  current?: CustomerEditValues;
}

async function staleCustomer(actor: Actor, id: string, message: string): Promise<EditCustomerState> {
  const fresh = await runAction(() =>
    withTenant(getDb(), actor.tenantId, (tx) => getCustomer(tx, actor, id)),
  );
  return fresh.ok
    ? { message, current: customerEditValues(fresh.data) }
    : { message: fresh.error.message };
}

export async function updateCustomerAction(
  id: string,
  _prev: EditCustomerState,
  formData: FormData,
): Promise<EditCustomerState> {
  const actor = await currentActor();
  const input = readCustomerEdit(formData);
  const result = await runEdit(() =>
    withTenant(getDb(), actor.tenantId, (tx) => updateCustomer(tx, actor, id, input, systemClock)),
  );
  if (!result.ok) {
    if ('stale' in result) return staleCustomer(actor, id, result.error.message);
    return { message: result.error.message, fieldErrors: result.error.fieldErrors };
  }
  if (result.data.kind === 'duplicate_phone') return { duplicate: result.data.owners };
  refresh(id);
  redirect(`/musteriler/${id}`);
}
```

- [ ] **Adım 8: Düzenleme formu ve sayfası**

`src/app/(uygulama)/musteriler/[id]/duzenle/edit-customer-form.tsx`:

```tsx
'use client';

import { useActionState, useState } from 'react';
import { Notice } from '@/components/ui/notice';
import { SubmitButton } from '@/components/ui/submit-button';
import { TextAreaField } from '@/components/ui/text-area-field';
import { TextField } from '@/components/ui/text-field';
import type { CustomerEditValues } from '@/lib/customer-form';
import type { EditCustomerState } from '../../actions';
import { DuplicatePhoneNotice } from '../../duplicate-phone-notice';
import { PhoneListField } from '../../phone-list-field';

interface EditCustomerFormProps {
  action: (prev: EditCustomerState, formData: FormData) => Promise<EditCustomerState>;
  initial: CustomerEditValues;
  customerId: string;
  maxPhones: number;
}

/** Sürüm çakışmasında alanlar güncel kayıtla yeniden kurulur (key = sürüm); mesaj yerinde kalır. */
export function EditCustomerForm({ action, initial, customerId, maxPhones }: EditCustomerFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.current ?? initial;
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.message && !pending && <Notice tone="error">{state.message}</Notice>}
      <EditCustomerFields
        key={values.version}
        values={values}
        state={state}
        pending={pending}
        customerId={customerId}
        maxPhones={maxPhones}
      />
      <SubmitButton pendingLabel="Kaydediliyor…">Kaydet</SubmitButton>
    </form>
  );
}

function EditCustomerFields({
  values,
  state,
  pending,
  customerId,
  maxPhones,
}: {
  values: CustomerEditValues;
  state: EditCustomerState;
  pending: boolean;
  customerId: string;
  maxPhones: number;
}) {
  const [name, setName] = useState(values.name);
  const [note, setNote] = useState(values.note);
  const [phonesEditedAfter, setPhonesEditedAfter] = useState<EditCustomerState | null>(null);
  const phonesFresh = phonesEditedAfter !== state;
  return (
    <>
      <input type="hidden" name="version" value={values.version} />
      <TextField
        label="Ad soyad ya da firma adı"
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="off"
        required
        error={state.fieldErrors?.name}
      />
      <PhoneListField
        initial={values.phones}
        errors={phonesFresh ? state.fieldErrors : undefined}
        excludeCustomerId={customerId}
        max={maxPhones}
        onEdit={() => setPhonesEditedAfter(state)}
      />
      <TextAreaField
        label="Not (isteğe bağlı)"
        name="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        hint="Yalnızca ofiste görünür. Sağlık, din gibi hassas kişisel bilgiler yazmayın."
        error={state.fieldErrors?.note}
      />
      {state.duplicate && phonesFresh && !pending && <DuplicatePhoneNotice owners={state.duplicate} />}
    </>
  );
}
```

`src/app/(uygulama)/musteriler/[id]/duzenle/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { ForbiddenView } from '@/components/forbidden-view';
import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { LIMITS } from '@/server/customers/common';
import { updateCustomerAction } from '../../actions';
import { customerEditValues, loadCustomer } from '../../customer-data';
import { EditCustomerForm } from './edit-customer-form';

export const metadata: Metadata = { title: 'Müşteriyi düzenle' };

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadCustomer(id, 'customer.manage');
  if (loaded === 'forbidden') return <ForbiddenView />;
  const { customer } = loaded;
  return (
    <>
      <BackLink href={`/musteriler/${customer.id}`}>Müşteri sayfası</BackLink>
      <PageHeader
        title="Müşteriyi düzenle"
        description="Ad, telefonlar ve not. Adresleri ve cihazları müşteri sayfasından düzenleyin."
      />
      <Card className="mt-6 max-w-2xl">
        <EditCustomerForm
          action={updateCustomerAction.bind(null, customer.id)}
          initial={customerEditValues(customer)}
          customerId={customer.id}
          maxPhones={LIMITS.phones}
        />
      </Card>
    </>
  );
}
```

- [ ] **Adım 9: Müşteri sayfası**

`src/app/(uygulama)/musteriler/[id]/page.tsx`:

```tsx
import { Pencil, Phone, Plus } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ForbiddenView } from '@/components/forbidden-view';
import { Badge } from '@/components/ui/badge';
import { BackLink } from '@/components/ui/back-link';
import { buttonClass } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { formatAddress } from '@/lib/address-format';
import { deviceTypeLabel } from '@/lib/device-types';
import { formatDate, formatDateTime, isoDateInIstanbul } from '@/lib/format';
import { formatPhone } from '@/lib/phone';
import { systemClock } from '@/server/clock';
import { LIMITS } from '@/server/customers/common';
import { addressLabel, loadCustomer } from '../customer-data';
import { LocationStatus } from '../location-status';

export const metadata: Metadata = { title: 'Müşteri' };

const sectionTitle = 'type-display text-xl text-fg';
const smallLink = 'inline-flex min-h-12 items-center gap-1 text-base font-bold text-primary';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadCustomer(id, 'customer.view');
  if (loaded === 'forbidden') return <ForbiddenView />;
  const { customer: c, canManage } = loaded;
  const main = c.phones[0];
  const today = isoDateInIstanbul(systemClock.now());
  const base = `/musteriler/${c.id}`;

  return (
    <>
      <BackLink href="/musteriler">Müşteriler</BackLink>
      <PageHeader
        title={c.name}
        description={main ? formatPhone(main.number) : undefined}
        actions={
          <>
            {main && (
              <a
                href={`tel:${main.number}`}
                className={buttonClass('primary')}
                aria-label={`Ana numarayı ara: ${formatPhone(main.number)}`}
              >
                <Phone className="size-5" aria-hidden="true" />
                Ara
              </a>
            )}
            {canManage && (
              <Link href={`${base}/duzenle`} className={buttonClass('secondary')}>
                <Pencil className="size-5" aria-hidden="true" />
                Düzenle
              </Link>
            )}
          </>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className={sectionTitle}>Telefonlar</h2>
          <ul className="mt-2 divide-y divide-border">
            {c.phones.map((p, i) => (
              <li key={p.number}>
                <a
                  href={`tel:${p.number}`}
                  className="flex min-h-14 flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span className="min-w-0">
                    <span className="block text-lg text-fg tabular-nums">{formatPhone(p.number)}</span>
                    {p.label && <span className="block text-sm break-words text-fg-muted">{p.label}</span>}
                  </span>
                  {i === 0 && <Badge>Ana numara</Badge>}
                </a>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className={sectionTitle}>Adresler</h2>
          {c.addresses.length === 0 ? (
            <p className="mt-2 text-base text-fg-muted">Henüz adres yok.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {c.addresses.map((a, i) => (
                <li key={a.id} className="flex flex-col gap-1 py-3">
                  <p className="font-bold break-words text-fg">{addressLabel(a, i)}</p>
                  <p className="text-base break-words text-fg">{formatAddress(a)}</p>
                  {a.directions && (
                    <p className="text-sm break-words text-fg-muted">Tarif: {a.directions}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <LocationStatus located={a.latitude !== null} />
                    {a.deviceCount > 0 && <Badge>{a.deviceCount} cihaz</Badge>}
                  </div>
                  {canManage && (
                    <Link
                      href={`${base}/adresler/${a.id}`}
                      className={smallLink}
                      aria-label={`${addressLabel(a, i)}: düzenle`}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Düzenle
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canManage && c.addresses.length < LIMITS.addresses && (
            <Link href={`${base}/adresler/yeni`} className={`${buttonClass('secondary')} mt-3`}>
              <Plus className="size-5" aria-hidden="true" />
              Adres ekle
            </Link>
          )}
        </Card>

        <Card>
          <h2 className={sectionTitle}>Cihazlar</h2>
          {c.devices.length === 0 ? (
            <p className="mt-2 text-base text-fg-muted">Henüz cihaz yok.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {c.devices.map((d) => {
                const addressIndex = c.addresses.findIndex((a) => a.id === d.addressId);
                const name = deviceTypeLabel(d.type, d.typeOther);
                const model = [d.brand, d.model].filter(Boolean).join(' ');
                return (
                  <li key={d.id} className="flex flex-col gap-1 py-3">
                    <p className="font-bold break-words text-fg">
                      {name}
                      {model && <span className="font-normal"> · {model}</span>}
                    </p>
                    {d.serialNo && <p className="text-sm break-words text-fg-muted">Seri no: {d.serialNo}</p>}
                    {d.installedOn && (
                      <p className="text-sm text-fg-muted">Kurulum: {formatDate(d.installedOn)}</p>
                    )}
                    {d.warrantyUntil && (
                      <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                        Garanti bitişi: {formatDate(d.warrantyUntil)}
                        {d.warrantyUntil < today && <Badge tone="danger">Garanti bitti</Badge>}
                      </p>
                    )}
                    {c.addresses.length > 0 && (
                      <p className="text-sm break-words text-fg-muted">
                        Adres:{' '}
                        {addressIndex >= 0 ? addressLabel(c.addresses[addressIndex]!, addressIndex) : 'Seçilmedi'}
                      </p>
                    )}
                    {d.note && <p className="text-sm break-words whitespace-pre-line text-fg">{d.note}</p>}
                    {canManage && (
                      <Link
                        href={`${base}/cihazlar/${d.id}`}
                        className={smallLink}
                        aria-label={`${name}: düzenle`}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        Düzenle
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {canManage && c.devices.length < LIMITS.devices && (
            <Link href={`${base}/cihazlar/yeni`} className={`${buttonClass('secondary')} mt-3`}>
              <Plus className="size-5" aria-hidden="true" />
              Cihaz ekle
            </Link>
          )}
        </Card>

        <Card>
          <h2 className={sectionTitle}>Not</h2>
          {c.note ? (
            <p className="mt-2 text-base break-words whitespace-pre-line text-fg">{c.note}</p>
          ) : (
            <p className="mt-2 text-base text-fg-muted">Not yok.</p>
          )}
        </Card>
      </div>

      <p className="mt-6 text-sm text-fg-muted">
        Ekleyen: {c.createdByName} · {formatDateTime(c.createdAt)}
        <br />
        Son değişiklik: {c.updatedByName} · {formatDateTime(c.updatedAt)}
      </p>
    </>
  );
}
```

> İki kişi aynı ad ve etiketle iki cihaz eklediyse "Kombi: düzenle" erişilebilir adı tekrarlanır; kabul edilir (görünür metinle tutarlı, sıra bağlamı ekran okuyucuda liste öğesiyle verilir).

- [ ] **Adım 10: Doğrulama ve commit**

```bash
npm run format && npm run lint && npm run typecheck && npx vitest run --project unit && npm run build
git add src/lib src/server/action-result.ts src/components/ui/text-area-field.tsx "src/app/(uygulama)/musteriler" tests/unit/format.test.ts tests/unit/action-result.test.ts
git commit -m "Müşteriler: müşteri sayfası, düzenleme ve sürüm çakışmasında güncel kayıt"
```

Expected: hepsi temiz; `npm run build` rota listesinde `/musteriler/[id]` ve `/musteriler/[id]/duzenle`.

---

### Görev 13: Adres ve cihaz ekranları

**Files:**
- Modify: `src/lib/customer-form.ts`, `src/app/(uygulama)/musteriler/actions.ts`, `customer-data.ts`
- Create: `src/app/(uygulama)/musteriler/address-form.tsx`, `device-form.tsx`, `remove-button.tsx`
- Create: `[id]/adresler/yeni/page.tsx`, `[id]/adresler/[adresId]/page.tsx`, `[id]/cihazlar/yeni/page.tsx`, `[id]/cihazlar/[cihazId]/page.tsx`

**Interfaces:**
- Consumes: `addAddress`, `updateAddress`, `removeAddress`, `lastUsedProvince` (Görev 6); `addDevice`, `updateDevice`, `removeDevice` (Görev 6); `DEVICE_TYPES` (Görev 1); `AddressFields` (Görev 11); `runEdit` (Görev 12); `loadCustomer`, `addressLabel` (Görev 12)
- Produces:
  - `customer-form.ts`: `interface AddressFormValues extends AddressValues { version: number }` (yeni kayıtta `version: 0`), `interface DeviceFormValues { version; addressId; type; typeOther; brand; model; serialNo; installedOn; warrantyUntil; note }` (hepsi `string`, `version: number`), `EMPTY_DEVICE: DeviceFormValues`
  - `customer-data.ts`: `addressFormValues(a: CustomerAddress): AddressFormValues`, `deviceFormValues(d: CustomerDevice): DeviceFormValues`, `addressOptions(addresses): Array<{ value: string; label: string }>`
  - `actions.ts`: `interface AddressFormState extends FormState { current?: AddressFormValues }`, `interface DeviceFormState extends FormState { current?: DeviceFormValues }`, `addAddressAction(customerId, prev, fd)`, `updateAddressAction(customerId, addressId, prev, fd)`, `removeAddressAction(customerId, addressId): Promise<ActionResult<null>>`, `addDeviceAction(customerId, prev, fd)`, `updateDeviceAction(customerId, deviceId, prev, fd)`, `removeDeviceAction(customerId, deviceId): Promise<ActionResult<null>>` — başarıda hepsi müşteri sayfasına yönlendirir
  - `AddressForm({ action, initial, submitLabel, cancelHref })`, `DeviceForm({ action, initial, addresses, submitLabel, cancelHref })`, `RemoveButton({ action, label, title, description })`

- [ ] **Adım 1: Form türleri**

`src/lib/customer-form.ts`'e ekle:

```ts
export interface AddressFormValues extends AddressValues {
  /** Yeni kayıtta 0 (forma sürüm alanı konmaz). */
  version: number;
}

export interface DeviceFormValues {
  version: number;
  addressId: string;
  type: string;
  typeOther: string;
  brand: string;
  model: string;
  serialNo: string;
  installedOn: string;
  warrantyUntil: string;
  note: string;
}

export const EMPTY_DEVICE: DeviceFormValues = {
  version: 0,
  addressId: '',
  type: '',
  typeOther: '',
  brand: '',
  model: '',
  serialNo: '',
  installedOn: '',
  warrantyUntil: '',
  note: '',
};
```

`customer-data.ts`'e ekle (içe aktarmalara `formatPlace`, `AddressFormValues`, `DeviceFormValues`, `CustomerDevice` kat):

```ts
export function addressFormValues(a: CustomerAddress): AddressFormValues {
  return {
    version: a.version,
    label: a.label ?? '',
    province: a.province,
    district: a.district,
    neighborhood: a.neighborhood ?? '',
    addressLine: a.addressLine,
    directions: a.directions ?? '',
    location:
      a.latitude !== null && a.longitude !== null && a.locationSource !== null
        ? { latitude: a.latitude, longitude: a.longitude, source: a.locationSource }
        : null,
  };
}

export function deviceFormValues(d: CustomerDevice): DeviceFormValues {
  return {
    version: d.version,
    addressId: d.addressId ?? '',
    type: d.type,
    typeOther: d.typeOther ?? '',
    brand: d.brand ?? '',
    model: d.model ?? '',
    serialNo: d.serialNo ?? '',
    installedOn: d.installedOn ?? '',
    warrantyUntil: d.warrantyUntil ?? '',
    note: d.note ?? '',
  };
}

/** Cihaz formundaki adres seçimi: "Ev · Kadıköy / İstanbul". */
export function addressOptions(addresses: CustomerAddress[]): Array<{ value: string; label: string }> {
  return addresses.map((a, i) => ({ value: a.id, label: `${addressLabel(a, i)} · ${formatPlace(a)}` }));
}
```

- [ ] **Adım 2: Eylemler**

`actions.ts`'e ekle (içe aktarmaları başa kat: `readAddress`, `readDevice`, `readVersion`, `AddressFormValues`, `DeviceFormValues`; `addAddress`, `updateAddress`, `removeAddress`; `addDevice`, `updateDevice`, `removeDevice`; `addressFormValues`, `deviceFormValues`):

```ts
export interface AddressFormState extends FormState {
  current?: AddressFormValues;
}

export interface DeviceFormState extends FormState {
  current?: DeviceFormValues;
}

type Fail = { ok: false; error: { message: string; fieldErrors?: Record<string, string> } };
const failState = (result: Fail): FormState => ({
  message: result.error.message,
  fieldErrors: result.error.fieldErrors,
});

export async function addAddressAction(
  customerId: string,
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const actor = await currentActor();
  const input = readAddress(formData);
  const result = await runAction(() =>
    withTenant(getDb(), actor.tenantId, (tx) =>
      addAddress(tx, actor, String(customerId), input, systemClock),
    ),
  );
  if (!result.ok) return failState(result);
  refresh(customerId);
  redirect(`/musteriler/${customerId}`);
}

export async function updateAddressAction(
  customerId: string,
  addressId: string,
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const actor = await currentActor();
  const input = { ...readAddress(formData), version: readVersion(formData) };
  const result = await runEdit(() =>
    withTenant(getDb(), actor.tenantId, (tx) =>
      updateAddress(tx, actor, String(customerId), String(addressId), input, systemClock),
    ),
  );
  if (!result.ok) {
    if (!('stale' in result)) return failState(result);
    const fresh = await runAction(() =>
      withTenant(getDb(), actor.tenantId, (tx) => getCustomer(tx, actor, String(customerId))),
    );
    const address = fresh.ok ? fresh.data.addresses.find((a) => a.id === addressId) : undefined;
    return address
      ? { message: result.error.message, current: addressFormValues(address) }
      : { message: 'Bu adres kaldırılmış. Müşteri sayfasına dönün.' };
  }
  refresh(customerId);
  redirect(`/musteriler/${customerId}`);
}

export async function removeAddressAction(
  customerId: string,
  addressId: string,
): Promise<ActionResult<null>> {
  const actor = await currentActor();
  const result = await runAction(async () => {
    await withTenant(getDb(), actor.tenantId, (tx) =>
      removeAddress(tx, actor, String(customerId), String(addressId), systemClock),
    );
    return null;
  });
  if (!result.ok) return result;
  refresh(customerId);
  redirect(`/musteriler/${customerId}`);
}

export async function addDeviceAction(
  customerId: string,
  _prev: DeviceFormState,
  formData: FormData,
): Promise<DeviceFormState> {
  const actor = await currentActor();
  const input = readDevice(formData);
  const result = await runAction(() =>
    withTenant(getDb(), actor.tenantId, (tx) =>
      addDevice(tx, actor, String(customerId), input, systemClock),
    ),
  );
  if (!result.ok) return failState(result);
  refresh(customerId);
  redirect(`/musteriler/${customerId}`);
}

export async function updateDeviceAction(
  customerId: string,
  deviceId: string,
  _prev: DeviceFormState,
  formData: FormData,
): Promise<DeviceFormState> {
  const actor = await currentActor();
  const input = { ...readDevice(formData), version: readVersion(formData) };
  const result = await runEdit(() =>
    withTenant(getDb(), actor.tenantId, (tx) =>
      updateDevice(tx, actor, String(customerId), String(deviceId), input, systemClock),
    ),
  );
  if (!result.ok) {
    if (!('stale' in result)) return failState(result);
    const fresh = await runAction(() =>
      withTenant(getDb(), actor.tenantId, (tx) => getCustomer(tx, actor, String(customerId))),
    );
    const device = fresh.ok ? fresh.data.devices.find((d) => d.id === deviceId) : undefined;
    return device
      ? { message: result.error.message, current: deviceFormValues(device) }
      : { message: 'Bu cihaz kaldırılmış. Müşteri sayfasına dönün.' };
  }
  refresh(customerId);
  redirect(`/musteriler/${customerId}`);
}

export async function removeDeviceAction(
  customerId: string,
  deviceId: string,
): Promise<ActionResult<null>> {
  const actor = await currentActor();
  const result = await runAction(async () => {
    await withTenant(getDb(), actor.tenantId, (tx) =>
      removeDevice(tx, actor, String(customerId), String(deviceId), systemClock),
    );
    return null;
  });
  if (!result.ok) return result;
  refresh(customerId);
  redirect(`/musteriler/${customerId}`);
}
```

> `'use server'` dosyası yalnızca eşzamansız işlev dışa aktarabilir; `failState` ve `Fail` dışa aktarılmaz (tür dışa aktarımları derlemede silinir, sorun değil).

- [ ] **Adım 3: Kaldırma düğmesi**

`src/app/(uygulama)/musteriler/remove-button.tsx`:

```tsx
'use client';

import { Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Notice } from '@/components/ui/notice';
import type { ActionResult } from '@/server/action-result';

interface RemoveButtonProps {
  /** Başarıda sunucu müşteri sayfasına yönlendirir; yalnızca hata döner. */
  action: () => Promise<ActionResult<null>>;
  label: string;
  title: string;
  description: string;
}

export function RemoveButton({ action, label, title, description }: RemoveButtonProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = () =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.error.message);
    });
  return (
    <div className="flex flex-col gap-3">
      {error && !pending && <Notice tone="error">{error}</Notice>}
      <div>
        <ConfirmDialog
          trigger={
            <Button variant="danger" disabled={pending}>
              <Trash2 className="size-5" aria-hidden="true" />
              {label}
            </Button>
          }
          title={title}
          description={description}
          confirmLabel={label}
          onConfirm={run}
        />
      </div>
    </div>
  );
}
```

- [ ] **Adım 4: Adres formu ve sayfaları**

`src/app/(uygulama)/musteriler/address-form.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SubmitButton } from '@/components/ui/submit-button';
import type { AddressFormValues } from '@/lib/customer-form';
import type { AddressFormState } from './actions';
import { AddressFields } from './address-fields';

interface AddressFormProps {
  action: (prev: AddressFormState, formData: FormData) => Promise<AddressFormState>;
  initial: AddressFormValues;
  submitLabel: string;
  cancelHref: string;
}

export function AddressForm({ action, initial, submitLabel, cancelHref }: AddressFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.current ?? initial;
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.message && !pending && <Notice tone="error">{state.message}</Notice>}
      {values.version > 0 && <input type="hidden" name="version" value={values.version} />}
      <AddressFields key={values.version} initial={values} errors={state.fieldErrors} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <SubmitButton pendingLabel="Kaydediliyor…">{submitLabel}</SubmitButton>
        <Link href={cancelHref} className={buttonClass('ghost')}>
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
```

`src/app/(uygulama)/musteriler/[id]/adresler/yeni/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { ForbiddenView } from '@/components/forbidden-view';
import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EMPTY_ADDRESS } from '@/lib/customer-form';
import { actorFromSession } from '@/server/auth/actor';
import { requireSession } from '@/server/auth/current-user';
import { lastUsedProvince } from '@/server/customers/addresses';
import { getDb } from '@/server/db/client';
import { withTenant } from '@/server/db/tenant';
import { addAddressAction } from '../../../actions';
import { AddressForm } from '../../../address-form';
import { loadCustomer } from '../../../customer-data';

export const metadata: Metadata = { title: 'Adres ekle' };

export default async function NewAddressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadCustomer(id, 'customer.manage');
  if (loaded === 'forbidden') return <ForbiddenView />;
  const { customer } = loaded;
  const actor = actorFromSession(await requireSession());
  const province = await withTenant(getDb(), actor.tenantId, (tx) => lastUsedProvince(tx, actor));
  const back = `/musteriler/${customer.id}`;
  return (
    <>
      <BackLink href={back}>Müşteri sayfası</BackLink>
      <PageHeader title="Adres ekle" description={customer.name} />
      <Card className="mt-6 max-w-2xl">
        <AddressForm
          action={addAddressAction.bind(null, customer.id)}
          initial={{ ...EMPTY_ADDRESS, province: province ?? '', version: 0 }}
          submitLabel="Adresi kaydet"
          cancelHref={back}
        />
      </Card>
    </>
  );
}
```

`src/app/(uygulama)/musteriler/[id]/adresler/[adresId]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ForbiddenView } from '@/components/forbidden-view';
import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { removeAddressAction, updateAddressAction } from '../../../actions';
import { AddressForm } from '../../../address-form';
import { addressFormValues, addressLabel, loadCustomer } from '../../../customer-data';
import { RemoveButton } from '../../../remove-button';

export const metadata: Metadata = { title: 'Adresi düzenle' };

export default async function EditAddressPage({
  params,
}: {
  params: Promise<{ id: string; adresId: string }>;
}) {
  const { id, adresId } = await params;
  const loaded = await loadCustomer(id, 'customer.manage');
  if (loaded === 'forbidden') return <ForbiddenView />;
  const { customer } = loaded;
  const index = customer.addresses.findIndex((a) => a.id === adresId);
  if (index < 0) notFound();
  const address = customer.addresses[index]!;
  const back = `/musteriler/${customer.id}`;
  return (
    <>
      <BackLink href={back}>Müşteri sayfası</BackLink>
      <PageHeader title="Adresi düzenle" description={`${customer.name} · ${addressLabel(address, index)}`} />
      <div className="mt-6 grid max-w-2xl grid-cols-1 gap-6">
        <Card>
          <AddressForm
            action={updateAddressAction.bind(null, customer.id, address.id)}
            initial={addressFormValues(address)}
            submitLabel="Kaydet"
            cancelHref={back}
          />
        </Card>
        <Card>
          <RemoveButton
            action={removeAddressAction.bind(null, customer.id, address.id)}
            label="Adresi kaldır"
            title="Adres kaldırılsın mı?"
            description={
              address.deviceCount > 0
                ? `Bu adresteki ${address.deviceCount} cihaz müşteride kalır, adres bilgisi boşalır.`
                : 'Adres müşteriden kaldırılacak.'
            }
          />
        </Card>
      </div>
    </>
  );
}
```

- [ ] **Adım 5: Cihaz formu ve sayfaları**

`src/app/(uygulama)/musteriler/device-form.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SelectField } from '@/components/ui/select-field';
import { SubmitButton } from '@/components/ui/submit-button';
import { TextAreaField } from '@/components/ui/text-area-field';
import { TextField } from '@/components/ui/text-field';
import type { DeviceFormValues } from '@/lib/customer-form';
import { DEVICE_TYPES } from '@/lib/device-types';
import type { DeviceFormState } from './actions';

type Options = ReadonlyArray<{ value: string; label: string }>;

const TYPE_OPTIONS: Options = [{ value: '', label: 'Seçin' }, ...DEVICE_TYPES];

interface DeviceFormProps {
  action: (prev: DeviceFormState, formData: FormData) => Promise<DeviceFormState>;
  initial: DeviceFormValues;
  addresses: Options;
  submitLabel: string;
  cancelHref: string;
}

export function DeviceForm({ action, initial, addresses, submitLabel, cancelHref }: DeviceFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const values = state.current ?? initial;
  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      {state.message && !pending && <Notice tone="error">{state.message}</Notice>}
      {values.version > 0 && <input type="hidden" name="version" value={values.version} />}
      <DeviceFields key={values.version} initial={values} addresses={addresses} errors={state.fieldErrors} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <SubmitButton pendingLabel="Kaydediliyor…">{submitLabel}</SubmitButton>
        <Link href={cancelHref} className={buttonClass('ghost')}>
          Vazgeç
        </Link>
      </div>
    </form>
  );
}

function DeviceFields({
  initial,
  addresses,
  errors,
}: {
  initial: DeviceFormValues;
  addresses: Options;
  errors?: Readonly<Record<string, string>>;
}) {
  const [v, setV] = useState(initial);
  const set = (patch: Partial<DeviceFormValues>) => setV((prev) => ({ ...prev, ...patch }));
  return (
    <div className="grid grid-cols-1 gap-4">
      <SelectField
        label="Cihaz türü"
        name="type"
        value={v.type}
        onChange={(e) => set({ type: e.target.value })}
        options={TYPE_OPTIONS}
        required
        error={errors?.type}
      />
      {v.type === 'other' && (
        <TextField
          label="Cihaz türü adı"
          name="typeOther"
          value={v.typeOther}
          onChange={(e) => set({ typeOther: e.target.value })}
          autoComplete="off"
          required
          hint="Örneğin: Şömine, Hidrofor"
          error={errors?.typeOther}
        />
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Marka (isteğe bağlı)"
          name="brand"
          value={v.brand}
          onChange={(e) => set({ brand: e.target.value })}
          autoComplete="off"
          error={errors?.brand}
        />
        <TextField
          label="Model (isteğe bağlı)"
          name="model"
          value={v.model}
          onChange={(e) => set({ model: e.target.value })}
          autoComplete="off"
          error={errors?.model}
        />
      </div>
      <TextField
        label="Seri no (isteğe bağlı)"
        name="serialNo"
        value={v.serialNo}
        onChange={(e) => set({ serialNo: e.target.value })}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        error={errors?.serialNo}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Kurulum tarihi (isteğe bağlı)"
          name="installedOn"
          type="date"
          min="1950-01-01"
          max="2100-12-31"
          value={v.installedOn}
          onChange={(e) => set({ installedOn: e.target.value })}
          error={errors?.installedOn}
        />
        <TextField
          label="Garanti bitişi (isteğe bağlı)"
          name="warrantyUntil"
          type="date"
          min="1950-01-01"
          max="2100-12-31"
          value={v.warrantyUntil}
          onChange={(e) => set({ warrantyUntil: e.target.value })}
          error={errors?.warrantyUntil}
        />
      </div>
      {addresses.length > 0 ? (
        <SelectField
          label="Adres"
          name="addressId"
          value={v.addressId}
          onChange={(e) => set({ addressId: e.target.value })}
          options={[{ value: '', label: 'Adres seçilmedi' }, ...addresses]}
          error={errors?.addressId}
        />
      ) : (
        <input type="hidden" name="addressId" value="" />
      )}
      <TextAreaField
        label="Not (isteğe bağlı)"
        name="note"
        rows={3}
        value={v.note}
        onChange={(e) => set({ note: e.target.value })}
        hint="Örneğin: Dış ünite çatıda."
        error={errors?.note}
      />
    </div>
  );
}
```

`src/app/(uygulama)/musteriler/[id]/cihazlar/yeni/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { ForbiddenView } from '@/components/forbidden-view';
import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { EMPTY_DEVICE } from '@/lib/customer-form';
import { addDeviceAction } from '../../../actions';
import { addressOptions, loadCustomer } from '../../../customer-data';
import { DeviceForm } from '../../../device-form';

export const metadata: Metadata = { title: 'Cihaz ekle' };

export default async function NewDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await loadCustomer(id, 'customer.manage');
  if (loaded === 'forbidden') return <ForbiddenView />;
  const { customer } = loaded;
  const back = `/musteriler/${customer.id}`;
  // Tek adres varsa kendiliğinden seçili gelir.
  const onlyAddress = customer.addresses.length === 1 ? customer.addresses[0]!.id : '';
  return (
    <>
      <BackLink href={back}>Müşteri sayfası</BackLink>
      <PageHeader title="Cihaz ekle" description={customer.name} />
      <Card className="mt-6 max-w-2xl">
        <DeviceForm
          action={addDeviceAction.bind(null, customer.id)}
          initial={{ ...EMPTY_DEVICE, addressId: onlyAddress }}
          addresses={addressOptions(customer.addresses)}
          submitLabel="Cihazı kaydet"
          cancelHref={back}
        />
      </Card>
    </>
  );
}
```

`src/app/(uygulama)/musteriler/[id]/cihazlar/[cihazId]/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ForbiddenView } from '@/components/forbidden-view';
import { BackLink } from '@/components/ui/back-link';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { deviceTypeLabel } from '@/lib/device-types';
import { removeDeviceAction, updateDeviceAction } from '../../../actions';
import { addressOptions, deviceFormValues, loadCustomer } from '../../../customer-data';
import { DeviceForm } from '../../../device-form';
import { RemoveButton } from '../../../remove-button';

export const metadata: Metadata = { title: 'Cihazı düzenle' };

export default async function EditDevicePage({
  params,
}: {
  params: Promise<{ id: string; cihazId: string }>;
}) {
  const { id, cihazId } = await params;
  const loaded = await loadCustomer(id, 'customer.manage');
  if (loaded === 'forbidden') return <ForbiddenView />;
  const { customer } = loaded;
  const device = customer.devices.find((d) => d.id === cihazId);
  if (!device) notFound();
  const name = deviceTypeLabel(device.type, device.typeOther);
  const back = `/musteriler/${customer.id}`;
  return (
    <>
      <BackLink href={back}>Müşteri sayfası</BackLink>
      <PageHeader title="Cihazı düzenle" description={`${customer.name} · ${name}`} />
      <div className="mt-6 grid max-w-2xl grid-cols-1 gap-6">
        <Card>
          <DeviceForm
            action={updateDeviceAction.bind(null, customer.id, device.id)}
            initial={deviceFormValues(device)}
            addresses={addressOptions(customer.addresses)}
            submitLabel="Kaydet"
            cancelHref={back}
          />
        </Card>
        <Card>
          <RemoveButton
            action={removeDeviceAction.bind(null, customer.id, device.id)}
            label="Cihazı kaldır"
            title="Cihaz kaldırılsın mı?"
            description={`${name} müşteriden kaldırılacak.`}
          />
        </Card>
      </div>
    </>
  );
}
```

- [ ] **Adım 6: Doğrulama ve commit**

```bash
npm run format && npm run lint && npm run typecheck && npm test && npm run build
git add src/lib/customer-form.ts "src/app/(uygulama)/musteriler"
git commit -m "Müşteriler: adres ve cihaz ekranları, kaldırma onayı"
```

Expected: hepsi temiz; birim ve entegrasyon sayıları not edilir.

---

### Görev 14: Deneme verisi, birinci yarının E2E testleri ve sahibin denemesi 👤

**Files:**
- Modify: `scripts/tohum.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/hesaplar.ts`, `tests/e2e/yetki.spec.ts`, `tests/e2e/erisilebilirlik.spec.ts`, `tests/e2e/ekran-goruntuleri.spec.ts`
- Create: `tests/e2e/musteriler.spec.ts`
- Modify: `docs/YAPILACAKLAR.md`

**Interfaces:**
- Consumes: `createCustomer`, `getCustomer` (Görev 5), `addDevice` (Görev 6); bütün ekranlar (Görev 10-13)
- Produces:
  - `E2eFirm.records: Record<string, string>` ve `record(firm, key): string` — anahtarlar: A'da `sukru`, `sukruAdres`, `cagla`, `caglaAdres`, `caglaCihaz`, `yaris`, `cihazli`, `cihazliAdres`, `cihazliCihaz`; B'de `gizli`, `gizliAdres`
  - E2E müşterileri (A): Şükrü Işık `0532 111 22 33` (Kadıköy, konumlu), Çağla Öztürk `0533 444 55 66` (Üsküdar, konumsuz, kombi), Yarış Deneme `0532 222 33 44`, Cihaz Deneme `0532 888 99 00` (Bornova, kombi); (B): Bora Gizli Müşteri `0532 765 43 21` (Çankaya)

- [ ] **Adım 1: Geliştirme veritabanına deneme müşterileri**

`scripts/tohum.ts`: firma döngüsünden sonra her deneme firmasına (yeni açılmış ya da önceden var olan) müşteri ekleyen bölüm. Firma zaten müşteri içeriyorsa atlanır (komut tekrar çalıştırılabilir). İçe aktarmalara ekle:

```ts
import { and, count, eq } from 'drizzle-orm';
import { addDevice } from '../src/server/customers/devices';
import { createCustomer } from '../src/server/customers/service';
import type { Db } from '../src/server/db/pool';
import { customers, users } from '../src/server/db/schema';
import type { DeviceType } from '../src/lib/device-types';
```

Dosyaya ekle:

```ts
interface SeedCustomer {
  name: string;
  phones: Array<{ number: string; label: string | null }>;
  address?: {
    province: string;
    district: string;
    neighborhood: string | null;
    addressLine: string;
    location: { latitude: number; longitude: number; source: 'link' } | null;
  };
  device?: { type: DeviceType; brand: string | null };
}

// Uydurma kişiler ve numaralar; Türkçe harfler, ortak numara ve konumsuz adres bilerek var.
const CUSTOMERS: Record<string, SeedCustomer[]> = {
  'deneme-a': [
    {
      name: 'Şükrü Işık',
      phones: [{ number: '0532 000 00 01', label: 'Cep' }],
      address: {
        province: 'İstanbul',
        district: 'Kadıköy',
        neighborhood: 'Caferağa',
        addressLine: 'Moda Cad. No: 12 D: 3',
        location: { latitude: 40.9862, longitude: 29.0253, source: 'link' },
      },
      device: { type: 'combi_boiler', brand: 'Vaillant' },
    },
    {
      name: 'Çağla Öztürk',
      phones: [{ number: '0533 000 00 02', label: null }],
      address: {
        province: 'İstanbul',
        district: 'Üsküdar',
        neighborhood: null,
        addressLine: 'Bağlarbaşı Sok. No: 4',
        location: null,
      },
    },
    {
      name: 'Yıldız Apartmanı Yönetimi',
      phones: [
        { number: '0216 000 00 03', label: 'Yönetici Ahmet Bey' },
        { number: '0532 000 00 04', label: 'Kapıcı' },
      ],
      address: {
        province: 'İstanbul',
        district: 'Ataşehir',
        neighborhood: null,
        addressLine: 'Gül Sok. No: 7',
        location: null,
      },
      device: { type: 'air_conditioner', brand: null },
    },
    {
      name: 'İlkay Güneş',
      phones: [{ number: '0532 000 00 01', label: 'Eşinin numarası' }],
    },
    { name: 'Gökçe Ünal', phones: [{ number: '0544 000 00 05', label: null }] },
  ],
  'deneme-b': [
    {
      name: 'Ömer Çınar',
      phones: [{ number: '0535 000 00 06', label: null }],
      address: {
        province: 'Ankara',
        district: 'Çankaya',
        neighborhood: null,
        addressLine: 'Atatürk Blv. No: 100',
        location: null,
      },
    },
  ],
};

async function seedCustomers(db: Db, tenantId: string, tenantCode: string): Promise<number> {
  const list = CUSTOMERS[tenantCode] ?? [];
  return withTenant(db, tenantId, async (tx) => {
    const [existing] = await tx
      .select({ n: count() })
      .from(customers)
      .where(eq(customers.tenantId, tenantId));
    if (existing!.n > 0) return 0;
    const [owner] = await tx
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.role, 'owner')))
      .limit(1);
    if (!owner) throw new Error(`${tenantCode}: patron bulunamadı`);
    const actor = {
      tenantId,
      tenantCode,
      userId: owner.id,
      username: owner.username,
      role: 'owner' as const,
      sessionId: null,
    };
    for (const c of list) {
      const saved = await createCustomer(
        tx,
        actor,
        {
          name: c.name,
          phones: c.phones,
          address: c.address ? { label: null, directions: null, ...c.address } : null,
          confirmDuplicate: true,
        },
        systemClock,
      );
      if (saved.kind !== 'saved') throw new Error(`${tenantCode}: müşteri kaydedilmedi`);
      // Tohumda cihaz adrese bağlanmaz; adres seçimi ekranda denenir.
      if (c.device) {
        await addDevice(tx, actor, saved.id, { type: c.device.type, brand: c.device.brand }, systemClock);
      }
    }
    return list.length;
  });
}
```

`main()` içinde firma döngüsünden sonra (`finally`'den önce):

```ts
    for (const firm of FIRMS) {
      const tenant = await findTenantByCode(db, firm.code);
      if (!tenant) continue;
      const added = await seedCustomers(db, tenant.id, firm.code);
      console.log(
        added > 0
          ? `${firm.code}: ${added} deneme müşterisi eklendi.`
          : `${firm.code}: müşteriler zaten var, atlandı.`,
      );
    }
```

- [ ] **Adım 2: Tohumu çalıştır**

```bash
npm run db:migrate && npm run db:tohum
```

Expected: `deneme-a: 5 deneme müşterisi eklendi.` ve `deneme-b: 1 deneme müşterisi eklendi.`; ikinci çalıştırmada "zaten var, atlandı". Çalışan geliştirme sunucusu varsa (göç uygulandı) yeniden başlatılır: süreci PID'iyle durdur, `npm run dev` ile aç.

- [ ] **Adım 3: E2E kurulumuna müşteriler**

`tests/e2e/hesaplar.ts`:

```ts
export interface E2eFirm {
  code: string;
  tenantId: string;
  name: string;
  accounts: Record<string, E2eAccount>;
  /** E2E kurulumunun açtığı kayıtların kimlikleri (müşteri, adres, cihaz). */
  records: Record<string, string>;
}

export function record(firm: E2eFirm, key: string): string {
  const found = firm.records[key];
  if (!found) throw new Error(`E2E kaydı yok: ${firm.code}/${key}`);
  return found;
}
```

`tests/e2e/global-setup.ts` içe aktarmalarına ekle:

```ts
import { addDevice } from '../../src/server/customers/devices';
import { createCustomer, getCustomer } from '../../src/server/customers/service';
import type { DeviceType } from '../../src/lib/device-types';
```

Dosyaya ekle:

```ts
interface E2eCustomer {
  key: string;
  name: string;
  number: string;
  address?: {
    province: string;
    district: string;
    neighborhood: string | null;
    addressLine: string;
    location: { latitude: number; longitude: number; source: 'link' } | null;
  };
  device?: DeviceType;
}

const CUSTOMERS: Record<'a' | 'b', E2eCustomer[]> = {
  a: [
    {
      key: 'sukru',
      name: 'Şükrü Işık',
      number: '0532 111 22 33',
      address: {
        province: 'İstanbul',
        district: 'Kadıköy',
        neighborhood: 'Caferağa',
        addressLine: 'Moda Cad. No: 5',
        location: { latitude: 40.9862, longitude: 29.0253, source: 'link' },
      },
    },
    {
      key: 'cagla',
      name: 'Çağla Öztürk',
      number: '0533 444 55 66',
      address: {
        province: 'İstanbul',
        district: 'Üsküdar',
        neighborhood: null,
        addressLine: 'Bağlarbaşı Sok. No: 4',
        location: null,
      },
      device: 'combi_boiler',
    },
    { key: 'yaris', name: 'Yarış Deneme', number: '0532 222 33 44' },
    {
      key: 'cihazli',
      name: 'Cihaz Deneme',
      number: '0532 888 99 00',
      address: {
        province: 'İzmir',
        district: 'Bornova',
        neighborhood: null,
        addressLine: 'Ege Cad. No: 9',
        location: null,
      },
      device: 'combi_boiler',
    },
  ],
  b: [
    {
      key: 'gizli',
      name: 'Bora Gizli Müşteri',
      number: '0532 765 43 21',
      address: {
        province: 'Ankara',
        district: 'Çankaya',
        neighborhood: null,
        addressLine: 'Gizli Sok. No: 7',
        location: null,
      },
    },
  ],
};
```

Firma döngüsünde `result[firm.key] = …` satırından önce:

```ts
      const records: Record<string, string> = {};
      await withTenant(db, created.tenantId, async (tx) => {
        for (const c of CUSTOMERS[firm.key]) {
          const saved = await createCustomer(
            tx,
            actor,
            {
              name: c.name,
              phones: [{ number: c.number, label: null }],
              address: c.address ? { label: null, directions: null, ...c.address } : null,
            },
            systemClock,
          );
          if (saved.kind !== 'saved') throw new Error(`E2E müşterisi kaydedilmedi: ${c.key}`);
          records[c.key] = saved.id;
          const addressId = c.address
            ? (await getCustomer(tx, actor, saved.id)).addresses[0]!.id
            : null;
          if (addressId) records[`${c.key}Adres`] = addressId;
          if (c.device) {
            const device = await addDevice(tx, actor, saved.id, { type: c.device, addressId }, systemClock);
            records[`${c.key}Cihaz`] = device.id;
          }
        }
      });
```

ve `result[firm.key]` nesnesine `records` alanını ekle.

- [ ] **Adım 4: Müşteri akışları testi**

`tests/e2e/musteriler.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { account, accounts, loginAs, record } from './hesaplar';

test('numarayla aranır, bulunamaz, o numarayla müşteri ve adres eklenir', async ({ page }) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'operator'));
  await page.goto('/musteriler');
  await page.getByLabel('Müşteri ara').fill('0555 123 45 67');
  await expect(page).toHaveURL(/q=0555/);
  await expect(page.getByText('"0555 123 45 67" ile kayıtlı müşteri yok.')).toBeVisible();
  await page.getByRole('link', { name: 'Bu numarayla yeni müşteri ekle' }).click();

  await expect(page.getByLabel('Numara')).toHaveValue('0555 123 45 67');
  await page.getByLabel('Ad soyad ya da firma adı').fill('Gülşen Öztürk');
  await page.getByRole('button', { name: 'Adres ekle' }).click();
  await page.getByLabel('İl', { exact: true }).selectOption('İzmir');
  await page.getByLabel('İlçe', { exact: true }).selectOption('Bornova');
  await page.getByLabel('Açık adres').fill('Ege Cad. No: 3');
  await page.getByRole('button', { name: 'Müşteriyi kaydet' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Gülşen Öztürk' })).toBeVisible();
  await expect(page.getByText('Ege Cad. No: 3, Bornova / İzmir')).toBeVisible();
  await expect(page.getByText('Konum işaretlenmedi')).toBeVisible();

  await page.goto('/musteriler');
  await page.getByLabel('Müşteri ara').fill('gulsen');
  await expect(page.getByRole('link', { name: /Gülşen Öztürk/ })).toBeVisible();
});

test('kayıtlı numara yazılınca uyarı çıkar; kaydette onay istenir, "Yine de kaydet" ile kaydedilir', async ({
  page,
}) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'operator'));
  await page.goto('/musteriler/yeni');
  await page.getByLabel('Ad soyad ya da firma adı').fill('İlkay Işık');
  await page.getByLabel('Numara').fill('0532 111 22 33');
  await expect(page.getByText('Bu numara Şükrü Işık adına kayıtlı.')).toBeVisible();
  await page.getByRole('button', { name: 'Müşteriyi kaydet' }).click();
  await expect(page.getByText('Bu numara başka bir müşteride kayıtlı')).toBeVisible();
  await page.getByRole('button', { name: 'Yine de kaydet' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'İlkay Işık' })).toBeVisible();
});

test('boş ad ve numara, alan kodu eksik numara alan hatası verir; hata ekran okuyucuya duyurulur', async ({
  page,
}) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'operator'));
  await page.goto('/musteriler/yeni');
  await page.getByRole('button', { name: 'Müşteriyi kaydet' }).click();
  await expect(page.getByRole('alert')).toContainText('İşaretli alanları düzeltin.');
  await expect(page.getByText('Adı yazın: ad soyad ya da firma adı.')).toBeVisible();
  await expect(page.getByText('Telefon numarasını yazın.')).toBeVisible();

  await page.getByLabel('Numara').fill('444 55 66');
  await page.getByRole('button', { name: 'Müşteriyi kaydet' }).click();
  await expect(page.getByText('Alan koduyla yazın, örneğin 0212 123 45 67.')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('İşaretli alanları düzeltin.');
});

test('Türkçe harften bağımsız arama, kısa arama uyarısı ve "Konumu eksik" süzgeci', async ({ page }) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'operator'));
  await page.goto('/musteriler');
  await page.getByLabel('Müşteri ara').fill('SUKRU');
  await expect(page.getByRole('link', { name: /Şükrü Işık/ })).toBeVisible();
  await page.getByLabel('Müşteri ara').fill('üsküdar');
  await expect(page.getByRole('link', { name: /Çağla Öztürk/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Şükrü Işık/ })).toHaveCount(0);

  await page.getByLabel('Müşteri ara').fill('a');
  await page.getByLabel('Müşteri ara').press('Enter');
  await expect(page.getByText('Aramak için en az 2 harf ya da rakam yazın.')).toBeVisible();

  await page.goto('/musteriler?konum=eksik');
  await expect(page.getByRole('link', { name: 'Konumu eksik' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: /Çağla Öztürk/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Şükrü Işık/ })).toHaveCount(0);
});

test('aynı anda düzenleme: ikinci kaydeden uyarılır, form güncel hâliyle yenilenir', async ({
  page,
  browser,
}) => {
  const { a } = accounts();
  const id = record(a, 'yaris');
  await loginAs(page, a, account(a, 'operator'));
  await page.goto(`/musteriler/${id}/duzenle`);
  const other = await browser.newContext();
  const second = await other.newPage();
  await loginAs(second, a, account(a, 'patron'));
  await second.goto(`/musteriler/${id}/duzenle`);

  await page.getByLabel('Ad soyad ya da firma adı').fill('Yarış Birinci');
  await page.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Yarış Birinci' })).toBeVisible();

  await second.getByLabel('Ad soyad ya da firma adı').fill('Yarış İkinci');
  await second.getByRole('button', { name: 'Kaydet', exact: true }).click();
  await expect(second.getByRole('alert')).toContainText('Bu kayıt siz düzenlerken değişti.');
  await expect(second.getByLabel('Ad soyad ya da firma adı')).toHaveValue('Yarış Birinci');
  await other.close();
});

test('cihaz eklenir ve kaldırılır; adres kaldırılınca cihazlar müşteride kalır', async ({ page }) => {
  const { a } = accounts();
  const id = record(a, 'cihazli');
  await loginAs(page, a, account(a, 'patron'));
  await page.goto(`/musteriler/${id}`);

  await page.getByRole('link', { name: 'Cihaz ekle' }).click();
  await page.getByLabel('Cihaz türü', { exact: true }).selectOption({ label: 'Diğer (yazın)' });
  await page.getByLabel('Cihaz türü adı').fill('Hidrofor');
  await page.getByLabel('Marka (isteğe bağlı)').fill('Wilo');
  await expect(page.getByLabel('Adres', { exact: true })).toHaveValue(record(a, 'cihazliAdres'));
  await page.getByRole('button', { name: 'Cihazı kaydet' }).click();
  await expect(page.getByText('Hidrofor · Wilo')).toBeVisible();

  await page.getByRole('link', { name: '1. adres: düzenle' }).click();
  await page.getByRole('button', { name: 'Adresi kaldır' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Bu adresteki 2 cihaz müşteride kalır, adres bilgisi boşalır.');
  await dialog.getByRole('button', { name: 'Adresi kaldır' }).click();
  await expect(page.getByText('Henüz adres yok.')).toBeVisible();
  await expect(page.getByText('Hidrofor · Wilo')).toBeVisible();
  await expect(page.getByText('Kombi', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Hidrofor: düzenle' }).click();
  await page.getByRole('button', { name: 'Cihazı kaldır' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cihazı kaldır' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cihaz Deneme' })).toBeVisible();
  await expect(page.getByText('Hidrofor · Wilo')).toHaveCount(0);
});
```

> Cihaz satırında ad ve marka iki öğeye bölünmüştür (`Kombi` + `<span> · Vaillant</span>`); `getByText('Hidrofor · Wilo')` üst öğenin metnine bakar. Kombi'nin markası yoksa satırın metni yalnızca "Kombi"dir, `exact: true` bu yüzden.

- [ ] **Adım 5: Yetki ve firma ayrımı (ekranda)**

`tests/e2e/yetki.spec.ts`'e ekle (`record`'u içe aktar):

```ts
test('teknisyen menüde Müşteriler görmez, müşteri sayfalarına adresle de giremez', async ({ page }) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'teknisyen'));
  await expect(
    page.getByRole('navigation', { name: 'Ana menü' }).getByRole('link', { name: 'Müşteriler' }),
  ).toHaveCount(0);
  for (const path of ['/musteriler', '/musteriler/yeni', `/musteriler/${record(a, 'sukru')}`]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Bu sayfayı görme yetkiniz yok' })).toBeVisible();
    await expect(page.getByText('Şükrü Işık')).toHaveCount(0);
  }
});

test('A firmasının operatörü B firmasının müşterisini adresle açamaz, aramada bulamaz', async ({
  page,
}) => {
  const { a, b } = accounts();
  await loginAs(page, a, account(a, 'operator'));
  for (const path of [`/musteriler/${record(b, 'gizli')}`, `/musteriler/${record(b, 'gizli')}/duzenle`]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: 'Sayfa bulunamadı' })).toBeVisible();
    await expect(page.getByText('Bora Gizli Müşteri')).toHaveCount(0);
  }
  await page.goto(`/musteriler?q=${encodeURIComponent('0532 765 43 21')}`);
  await expect(page.getByText('Müşteri bulunamadı')).toBeVisible();
  await page.goto('/musteriler?q=bora');
  await expect(page.getByText('Müşteri bulunamadı')).toBeVisible();
});
```

- [ ] **Adım 6: Erişilebilirlik ve ekran görüntüleri**

`tests/e2e/erisilebilirlik.spec.ts`: `record`'u içe aktar; `SCREENS`'e ekle:

```ts
  { name: 'müşteri listesi', as: 'patron', path: () => '/musteriler' },
  { name: 'müşteri arama: sonuç yok', as: 'operator', path: () => '/musteriler?q=zzzz' },
  { name: 'yeni müşteri', as: 'operator', path: () => '/musteriler/yeni' },
  { name: 'müşteri sayfası', as: 'operator', path: (f) => `/musteriler/${record(f, 'cagla')}` },
  { name: 'müşteriyi düzenle', as: 'operator', path: (f) => `/musteriler/${record(f, 'cagla')}/duzenle` },
  {
    name: 'adresi düzenle',
    as: 'operator',
    path: (f) => `/musteriler/${record(f, 'cagla')}/adresler/${record(f, 'caglaAdres')}`,
  },
  {
    name: 'cihazı düzenle',
    as: 'operator',
    path: (f) => `/musteriler/${record(f, 'cagla')}/cihazlar/${record(f, 'caglaCihaz')}`,
  },
  { name: 'müşteriler yetkisiz', as: 'teknisyen', path: () => '/musteriler' },
```

Dosyadaki axe çağrısını bir yardımcıya taşı (mevcut döngü de onu kullanır) ve etkileşimli hal için test ekle:

```ts
async function axeViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test(`yeni müşteri: adres bölümü ve çift numara uyarısı açıkken (${colorScheme === 'light' ? 'açık' : 'koyu'}) ihlal yok`, async ({
    page,
  }) => {
    const { a } = accounts();
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await loginAs(page, a, account(a, 'operator'));
    await gotoReady(page, '/musteriler/yeni');
    await page.getByLabel('Numara').fill('0532 111 22 33');
    await expect(page.getByText('Bu numara Şükrü Işık adına kayıtlı.')).toBeVisible();
    await page.getByRole('button', { name: 'Adres ekle' }).click();
    await page.getByRole('button', { name: 'Telefon ekle' }).click();
    expect(await axeViolations(page)).toEqual([]);
  });
}
```

(`Page` türünü `@playwright/test`'ten içe aktar.)

`tests/e2e/ekran-goruntuleri.spec.ts`: `record`'u içe aktar; `SCREENS`'e ekle:

```ts
  { name: 'musteriler', as: 'patron', path: () => '/musteriler' },
  { name: 'musteriler-arama', as: 'operator', path: () => '/musteriler?q=sukru' },
  { name: 'musteriler-bulunamadi', as: 'operator', path: () => '/musteriler?q=zzzz' },
  { name: 'musteri-yeni', as: 'operator', path: () => '/musteriler/yeni' },
  { name: 'musteri-sayfasi', as: 'operator', path: (f) => `/musteriler/${record(f, 'cagla')}` },
  { name: 'musteri-duzenle', as: 'operator', path: (f) => `/musteriler/${record(f, 'cagla')}/duzenle` },
  {
    name: 'adres-duzenle',
    as: 'operator',
    path: (f) => `/musteriler/${record(f, 'cagla')}/adresler/${record(f, 'caglaAdres')}`,
  },
  {
    name: 'cihaz-duzenle',
    as: 'operator',
    path: (f) => `/musteriler/${record(f, 'cagla')}/cihazlar/${record(f, 'caglaCihaz')}`,
  },
```

Mevcut "büyük yazı (%200), 360 px" testi bu ekranlarda da çalışır (yatay kayma, taşan öğe, alt menü etiketleri — patronda 4 öğe).

- [ ] **Adım 7: Sahibe sor, sonra E2E'yi çalıştır** 🧭

Sahibe: "Müşteri ekranlarının uçtan uca testlerini görünmez bir tarayıcıda (Chromium) çalıştırayım mı? Açık tarayıcınıza dokunmaz; test veritabanını sıfırlar." Onay gelmeden çalıştırma. Entegrasyon testleri o sırada çalışmıyor olmalı (aynı veritabanı).

```bash
npm run test:e2e
```

Expected: hepsi geçer; sayıyı not et. Düşen test varsa önce ekran görüntüsüne (`tests/e2e/ekran-goruntuleri/`) ve Playwright raporuna bak; hatayı yakalayan test zaten kırmızı, düzeltmeden sonra yeşile döner.

- [ ] **Adım 8: Belgeler ve commit**

`docs/YAPILACAKLAR.md`: Müşteriler bölümünde birinci yarının maddelerini `[x] (tarih)` yap; "🙋 Şu an senden beklenenler"in başına ekle:

```markdown
1. 👤 **Müşteri ekranlarını dene.** Bilgisayarında `npm run dev` açıkken http://localhost:3000 adresinden `deneme-a` firmasına gir: bir müşteri ara, yeni müşteri ekle, bir numarayı iki müşteriye yazmayı dene, adres ve cihaz ekle. Harita bir sonraki adımda gelecek; şimdilik adreslerde "Konum işaretlenmedi" yazar. Beğenmediğin ya da garip bulduğun her şeyi yaz.
```

```bash
npm run format
git add scripts/tohum.ts tests/e2e docs/YAPILACAKLAR.md
git commit -m "Müşteriler: deneme verisi, uçtan uca testler (akışlar, yetki, firma ayrımı, erişilebilirlik)"
```

- [ ] **Adım 9: Sahibin denemesi** 👤

Sahibe kısa mesaj: ne hazır, nasıl denenir (yukarıdaki madde), test sayıları. Push için ayrıca sor. Görev 15-19 sahibin yanıtını beklemeden sürer; **Görev 20 sahibin geri bildiriminden sonra başlar.** Geri bildirimde istenen değişiklikler ayrı küçük görevler olarak yapılır (test önce).

---

## İKİNCİ YARI: Harita ve konum


### Görev 15: Harita parçası sunumu (PMTiles dosyası → `/harita/parca/...`)

**Files:**
- Create: `src/server/geo/tile-source.ts`, `src/server/geo/tiles.ts`, `src/app/harita/parca/[surum]/[z]/[x]/[y]/route.ts`
- Modify: `src/lib/proxy-decision.ts`, `package.json` (`pmtiles`)
- Create: `tests/helpers/pmtiles.ts`
- Test: `tests/unit/harita-parca.test.ts`, `tests/unit/proxy-decision.test.ts` (ekleme)

**Interfaces:**
- Consumes: `validateSession` (`src/server/auth/session.ts`), `SESSION_COOKIE`, `logger`
- Produces:
  - `class FileSource implements Source` (`getKey()`, `getBytes(offset, length)`)
  - `interface MapVersionFile { surum: string; dosya: string; kaynak: string; bbox: string; maxzoom: number | null; boyut: number; indirildi: string }` (`harita/surum.json`)
  - `interface TileStore { version: string; minZoom: number; maxZoom: number; contentType: string; getTile(z, x, y): Promise<ArrayBuffer | null> }`
  - `mapDirectory(): string` (`HARITA_KLASORU` ya da `<proje>/harita`), `openTileStore(dir): Promise<TileStore | null>`, `getTileStore(): Promise<TileStore | null>`
  - `createSessionCheckCache(opts: { ttlMs; now; validate: (cookie: string) => Promise<boolean>; maxEntries? }): (cookie: string | undefined) => Promise<boolean>`
  - `serveTile(cookie, params: { surum; z; x; y }, deps: { store: () => Promise<TileStore | null>; isSignedIn: (cookie) => Promise<boolean> }): Promise<Response>`
  - `tests/helpers/pmtiles.ts`: `writePmtilesFixture(dir, { version, minZoom, maxZoom, tiles: Array<{ z; x; y; data: Uint8Array }> }): string`

- [ ] **Adım 1: Paketi incele ve kur**

```bash
npm view pmtiles version license dependencies
```

Expected: `4.5.x`, `BSD-3-Clause`, bağımlılık yalnızca `fflate`. Kurulum betiği (`postinstall`) yok, ağ çağrısı yalnızca `FetchSource` kullanılırsa (biz kullanmıyoruz). Sonra:

```bash
npm install --silent pmtiles
```

- [ ] **Adım 2: Deneme PMTiles yazıcısı**

`tests/helpers/pmtiles.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { zxyToTileId } from 'pmtiles';

export interface FixtureTile {
  z: number;
  x: number;
  y: number;
  data: Uint8Array;
}

function varint(value: number, out: number[]): void {
  let n = value;
  while (n >= 0x80) {
    out.push((n % 0x80) | 0x80);
    n = Math.floor(n / 0x80);
  }
  out.push(n);
}

/**
 * PMTiles v3 belgesine göre küçük, sıkıştırmasız bir dosya ve yanına surum.json yazar (yalnızca testler).
 * Başlık 127 bayt; kök dizin varint kodlu; yaprak dizin yok.
 */
export function writePmtilesFixture(
  dir: string,
  opts: { version: string; minZoom: number; maxZoom: number; tiles: FixtureTile[] },
): string {
  mkdirSync(dir, { recursive: true });
  const tiles = opts.tiles
    .map((t) => ({ id: zxyToTileId(t.z, t.x, t.y), data: t.data }))
    .sort((a, b) => a.id - b.id);

  const offsets: number[] = [];
  let cursor = 0;
  for (const t of tiles) {
    offsets.push(cursor);
    cursor += t.data.length;
  }
  const tileData = Buffer.concat(tiles.map((t) => Buffer.from(t.data)));

  const entries: number[] = [];
  varint(tiles.length, entries);
  let lastId = 0;
  for (const t of tiles) {
    varint(t.id - lastId, entries);
    lastId = t.id;
  }
  for (let i = 0; i < tiles.length; i++) varint(1, entries); // run length
  for (const t of tiles) varint(t.data.length, entries);
  tiles.forEach((t, i) => {
    const consecutive = i > 0 && offsets[i] === offsets[i - 1]! + tiles[i - 1]!.data.length;
    varint(consecutive ? 0 : offsets[i]! + 1, entries);
  });
  const rootDir = Buffer.from(entries);
  const metadata = Buffer.from('{}');

  const header = Buffer.alloc(127);
  const rootOffset = 127;
  const metaOffset = rootOffset + rootDir.length;
  const dataOffset = metaOffset + metadata.length;
  header.write('PMTiles', 0, 'ascii');
  header.writeUInt8(3, 7);
  header.writeBigUInt64LE(BigInt(rootOffset), 8);
  header.writeBigUInt64LE(BigInt(rootDir.length), 16);
  header.writeBigUInt64LE(BigInt(metaOffset), 24);
  header.writeBigUInt64LE(BigInt(metadata.length), 32);
  header.writeBigUInt64LE(BigInt(dataOffset), 40); // yaprak dizin yok
  header.writeBigUInt64LE(0n, 48);
  header.writeBigUInt64LE(BigInt(dataOffset), 56);
  header.writeBigUInt64LE(BigInt(tileData.length), 64);
  header.writeBigUInt64LE(BigInt(tiles.length), 72);
  header.writeBigUInt64LE(BigInt(tiles.length), 80);
  header.writeBigUInt64LE(BigInt(tiles.length), 88);
  header.writeUInt8(1, 96); // kümelenmiş
  header.writeUInt8(1, 97); // dizin sıkıştırması: yok
  header.writeUInt8(1, 98); // parça sıkıştırması: yok
  header.writeUInt8(1, 99); // parça türü: MVT
  header.writeUInt8(opts.minZoom, 100);
  header.writeUInt8(opts.maxZoom, 101);
  header.writeInt32LE(Math.round(25.5 * 1e7), 102);
  header.writeInt32LE(Math.round(35.7 * 1e7), 106);
  header.writeInt32LE(Math.round(45.0 * 1e7), 110);
  header.writeInt32LE(Math.round(42.2 * 1e7), 114);
  header.writeUInt8(opts.minZoom, 118);
  header.writeInt32LE(Math.round(35.2 * 1e7), 119);
  header.writeInt32LE(Math.round(39.0 * 1e7), 123);

  const file = `turkiye-${opts.version}.pmtiles`;
  writeFileSync(join(dir, file), Buffer.concat([header, rootDir, metadata, tileData]));
  writeFileSync(
    join(dir, 'surum.json'),
    JSON.stringify({
      surum: opts.version,
      dosya: file,
      kaynak: 'test',
      bbox: '25.5,35.7,45.0,42.2',
      maxzoom: opts.maxZoom,
      boyut: 0,
      indirildi: '2026-10-07T00:00:00.000Z',
    }),
  );
  return join(dir, file);
}
```

- [ ] **Adım 3: Testleri yaz**

`tests/unit/harita-parca.test.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  createSessionCheckCache,
  openTileStore,
  serveTile,
  type TileStore,
} from '@/server/geo/tiles';
import { writePmtilesFixture } from '../helpers/pmtiles';

const bytes = (s: string) => new TextEncoder().encode(s);
const params = (z: string, x: string, y: string, surum = '20261006') => ({ surum, z, x, y });

describe('harita parçası', () => {
  let dir: string;
  let store: TileStore;
  const deps = () => ({ store: async () => store, isSignedIn: async () => true });

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'harita-'));
    writePmtilesFixture(dir, {
      version: '20261006',
      minZoom: 0,
      maxZoom: 2,
      tiles: [
        { z: 0, x: 0, y: 0, data: bytes('kok') },
        { z: 2, x: 2, y: 1, data: bytes('iki') },
      ],
    });
    const opened = await openTileStore(dir);
    if (!opened) throw new Error('deneme haritası açılmadı');
    store = opened;
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('sürüm ve yakınlaştırma aralığı dosyadan okunur', () => {
    expect([store.version, store.minZoom, store.maxZoom, store.contentType]).toEqual([
      '20261006',
      0,
      2,
      'application/x-protobuf',
    ]);
  });

  it('geçerli oturumda parça döner; içerik türü ve önbellek başlığı', async () => {
    const res = await serveTile('cerez', params('2', '2', '1'), deps());
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/x-protobuf');
    expect(res.headers.get('cache-control')).toBe('private, max-age=604800');
    expect(new TextDecoder().decode(await res.arrayBuffer())).toBe('iki');
  });

  it('dosyada olmayan ya da en yüksek yakınlaştırmanın üstündeki parça 204', async () => {
    expect((await serveTile('cerez', params('1', '0', '0'), deps())).status).toBe(204);
    expect((await serveTile('cerez', params('3', '0', '0'), deps())).status).toBe(204);
  });

  it('oturumsuz 401; dosyaya hiç bakılmaz, yanıt önbelleğe alınmaz', async () => {
    const storeFn = vi.fn(async () => store);
    const res = await serveTile(undefined, params('0', '0', '0'), {
      store: storeFn,
      isSignedIn: async () => false,
    });
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(storeFn).not.toHaveBeenCalled();
  });

  it.each([
    ['-1', '0', '0'],
    ['a', '0', '0'],
    ['1.5', '0', '0'],
    ['01', '0', '0'],
    ['31', '0', '0'],
    ['1', '2', '0'],
    ['1', '0', '2'],
    ['2', '-1', '0'],
  ])('geçersiz z/x/y 400: %s/%s/%s', async (z, x, y) => {
    expect((await serveTile('cerez', params(z, x, y), deps())).status).toBe(400);
  });

  it('eski sürümün adresi 404: tarayıcı önbelleğindeki eski parçalar yeni dosyayla karışmaz', async () => {
    expect((await serveTile('cerez', params('0', '0', '0', '20250101'), deps())).status).toBe(404);
  });

  it('harita dosyası yoksa 503 ve klasör yoksa openTileStore null', async () => {
    const res = await serveTile('cerez', params('0', '0', '0'), {
      store: async () => null,
      isSignedIn: async () => true,
    });
    expect(res.status).toBe(503);
    expect(await openTileStore(join(dir, 'yok'))).toBeNull();
  });
});

describe('harita oturum denetimi önbelleği', () => {
  it('aynı çerez için süre içinde veritabanına bir kez gider, süre dolunca yeniden', async () => {
    let now = 0;
    const validate = vi.fn(async (cookie: string) => cookie === 'gecerli');
    const check = createSessionCheckCache({ ttlMs: 60_000, now: () => now, validate });
    expect(await check('gecerli')).toBe(true);
    expect(await check('gecerli')).toBe(true);
    expect(await check('gecersiz')).toBe(false);
    expect(validate).toHaveBeenCalledTimes(2);
    now = 60_001;
    expect(await check('gecerli')).toBe(true);
    expect(validate).toHaveBeenCalledTimes(3);
  });

  it('çerez yoksa veritabanına gitmez', async () => {
    const validate = vi.fn(async () => true);
    const check = createSessionCheckCache({ ttlMs: 60_000, now: () => 0, validate });
    expect(await check(undefined)).toBe(false);
    expect(await check('')).toBe(false);
    expect(validate).not.toHaveBeenCalled();
  });

  it('en çok belirli sayıda çerez tutulur; en eskisi atılır', async () => {
    const validate = vi.fn(async () => true);
    const check = createSessionCheckCache({ ttlMs: 60_000, now: () => 0, validate, maxEntries: 2 });
    await check('a');
    await check('b');
    await check('c');
    await check('a');
    expect(validate).toHaveBeenCalledTimes(4);
  });
});
```

`tests/unit/proxy-decision.test.ts`'e ekle:

```ts
  it('harita dosyaları ve MapLibre işçisi yönlendirilmez, çerez yenilenmez (parça isteği kendi 401 yanıtını verir)', () => {
    const pass = { action: 'next', refreshSessionCookie: false };
    expect(decideProxy('/harita/parca/20261006/1/0/0', false)).toEqual(pass);
    expect(decideProxy('/harita/parca/20261006/1/0/0', true)).toEqual(pass);
    expect(decideProxy('/harita/yazi/Noto Sans Regular/0-255.pbf', false)).toEqual(pass);
    expect(decideProxy('/maplibre/maplibre-gl-worker.mjs', false)).toEqual(pass);
    expect(decideProxy('/haritalar', false)).toEqual({ action: 'redirect', to: '/giris' });
  });
```

- [ ] **Adım 4: Kırmızıyı gör**

Run: `npx vitest run --project unit tests/unit/harita-parca.test.ts tests/unit/proxy-decision.test.ts`
Expected: FAIL (`@/server/geo/tiles` yok; proxy testi yönlendirme bekliyor).

- [ ] **Adım 5: Dosya kaynağı**

`src/server/geo/tile-source.ts`:

```ts
import { open, type FileHandle } from 'node:fs/promises';
import type { RangeResponse, Source } from 'pmtiles';

/** PMTiles'ın istediği bayt aralıklarını diskteki dosyadan okur (ağ yok). Dosya bir kez açılır. */
export class FileSource implements Source {
  private handle: Promise<FileHandle> | null = null;

  constructor(private readonly path: string) {}

  getKey(): string {
    return this.path;
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    this.handle ??= open(this.path, 'r');
    const file = await this.handle;
    const buffer = new Uint8Array(length);
    const { bytesRead } = await file.read(buffer, 0, length, offset);
    return { data: buffer.buffer.slice(0, bytesRead) };
  }
}
```

- [ ] **Adım 6: Parça servisi**

`src/server/geo/tiles.ts`:

```ts
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PMTiles, TileType } from 'pmtiles';
import { logger } from '@/server/logger';
import { FileSource } from './tile-source';

export interface MapVersionFile {
  surum: string;
  dosya: string;
  kaynak: string;
  bbox: string;
  maxzoom: number | null;
  boyut: number;
  indirildi: string;
}

export interface TileStore {
  version: string;
  minZoom: number;
  maxZoom: number;
  contentType: string;
  getTile(z: number, x: number, y: number): Promise<ArrayBuffer | null>;
}

const VERSION_PATTERN = /^\d{8}$/;
const FILE_PATTERN = /^turkiye-\d{8}\.pmtiles$/;
const MAX_Z = 30;

export function mapDirectory(): string {
  return process.env.HARITA_KLASORU || join(process.cwd(), 'harita');
}

/** surum.json'u ve PMTiles dosyasını açar. Harita henüz indirilmediyse null (ekran "harita açılamıyor" der). */
export async function openTileStore(dir: string): Promise<TileStore | null> {
  let info: MapVersionFile;
  try {
    info = JSON.parse(await readFile(join(dir, 'surum.json'), 'utf8')) as MapVersionFile;
  } catch {
    return null;
  }
  // Dosya adı kalıba uymalı: surum.json'daki bir değer klasör dışına çıkamaz.
  if (!VERSION_PATTERN.test(info.surum) || !FILE_PATTERN.test(info.dosya)) return null;
  const archive = new PMTiles(new FileSource(join(dir, info.dosya)));
  const header = await archive.getHeader();
  return {
    version: info.surum,
    minZoom: header.minZoom,
    maxZoom: header.maxZoom,
    contentType: header.tileType === TileType.Mvt ? 'application/x-protobuf' : 'application/octet-stream',
    async getTile(z, x, y) {
      // getZxy sıkıştırmayı açar; yanıtta Content-Encoding başlığı gerekmez.
      const tile = await archive.getZxy(z, x, y);
      return tile ? tile.data : null;
    },
  };
}

let opened: TileStore | null = null;
let pending: Promise<TileStore | null> | null = null;
let lastAttempt = 0;

/** Süreç boyunca tek açık dosya. Bulunamazsa dakikada bir yeniden denenir; yeni harita indirilince sunucu yeniden başlatılır. */
export function getTileStore(): Promise<TileStore | null> {
  if (opened) return Promise.resolve(opened);
  if (pending) return pending;
  if (lastAttempt !== 0 && Date.now() - lastAttempt < 60_000) return Promise.resolve(null);
  lastAttempt = Date.now();
  pending = openTileStore(mapDirectory()).then(
    (store) => {
      opened = store;
      pending = null;
      return store;
    },
    (err: unknown) => {
      pending = null;
      logger.error('map_open_failed', err);
      return null;
    },
  );
  return pending;
}

/**
 * Harita parçası her istekte veritabanına gitmesin: çerezin özeti → sonuç, kısa süre bellekte. Bedeli: kapatılan
 * bir oturum en çok ttl kadar daha parça alabilir (parçalar kişisel veri içermez).
 */
export function createSessionCheckCache(opts: {
  ttlMs: number;
  now: () => number;
  validate: (cookie: string) => Promise<boolean>;
  maxEntries?: number;
}): (cookie: string | undefined) => Promise<boolean> {
  const maxEntries = opts.maxEntries ?? 10_000;
  const entries = new Map<string, { valid: boolean; until: number }>();
  return async (cookie) => {
    if (!cookie) return false;
    const key = createHash('sha256').update(cookie).digest('hex');
    const hit = entries.get(key);
    if (hit && hit.until > opts.now()) return hit.valid;
    const valid = await opts.validate(cookie);
    entries.delete(key);
    if (entries.size >= maxEntries) entries.delete(entries.keys().next().value!);
    entries.set(key, { valid, until: opts.now() + opts.ttlMs });
    return valid;
  };
}

const INDEX = /^(0|[1-9][0-9]{0,9})$/;

function parseTile(p: { z: string; x: string; y: string }): { z: number; x: number; y: number } | null {
  if (!INDEX.test(p.z) || !INDEX.test(p.x) || !INDEX.test(p.y)) return null;
  const z = Number(p.z);
  const x = Number(p.x);
  const y = Number(p.y);
  if (z > MAX_Z) return null;
  const size = 2 ** z;
  return x < size && y < size ? { z, x, y } : null;
}

const noStore = { 'Cache-Control': 'no-store' };
const cacheable = { 'Cache-Control': 'private, max-age=604800' };

export async function serveTile(
  cookie: string | undefined,
  params: { surum: string; z: string; x: string; y: string },
  deps: { store: () => Promise<TileStore | null>; isSignedIn: (cookie: string | undefined) => Promise<boolean> },
): Promise<Response> {
  if (!(await deps.isSignedIn(cookie))) return new Response(null, { status: 401, headers: noStore });
  const tile = parseTile(params);
  if (!tile) return new Response(null, { status: 400, headers: noStore });
  const store = await deps.store();
  if (!store) return new Response(null, { status: 503, headers: noStore });
  if (params.surum !== store.version) return new Response(null, { status: 404, headers: noStore });
  if (tile.z < store.minZoom || tile.z > store.maxZoom) {
    return new Response(null, { status: 204, headers: cacheable });
  }
  const data = await store.getTile(tile.z, tile.x, tile.y);
  if (!data) return new Response(null, { status: 204, headers: cacheable });
  return new Response(data, {
    status: 200,
    headers: { 'Content-Type': store.contentType, ...cacheable },
  });
}
```

- [ ] **Adım 7: Rota işleyicisi ve proxy**

`src/app/harita/parca/[surum]/[z]/[x]/[y]/route.ts`:

```ts
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/server/auth/cookie-config';
import { validateSession } from '@/server/auth/session';
import { systemClock } from '@/server/clock';
import { getDb } from '@/server/db/client';
import { createSessionCheckCache, getTileStore, serveTile } from '@/server/geo/tiles';

export const runtime = 'nodejs';

const isSignedIn = createSessionCheckCache({
  ttlMs: 60_000,
  now: () => Date.now(),
  validate: async (cookie) => (await validateSession(getDb(), cookie, systemClock)) !== null,
});

/** Yalnızca giriş yapmış kişiye (her rol). Parça adresi loga yazılmaz: bakılan bölge müşteri konumunu ele verebilir. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ surum: string; z: string; x: string; y: string }> },
) {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  return serveTile(cookie, await context.params, { store: getTileStore, isSignedIn });
}
```

> `src/app/**` değer olarak `@/server/db/client` içe aktarabilir (lint kuralı yalnızca `src/server/**` dışındaki istemci kodunu ve `src/server`'ı kısıtlar). Next 16'da rota işleyicisinin ikinci parametresi için `RouteContext<'/harita/parca/[surum]/[z]/[x]/[y]'>` de kullanılabilir; `node_modules/next/dist/docs` içindeki "route.js" belgesiyle doğrula.

`src/lib/proxy-decision.ts`:

```ts
const PUBLIC_PATHS = new Set(['/giris']);
/** Harita dosyaları ve MapLibre işçisi: yönlendirilmez, çerez yenilenmez; parça isteği oturumu kendisi denetler. */
const PASS_THROUGH_PREFIXES = ['/harita/', '/maplibre/'];

export function decideProxy(pathname: string, hasSessionCookie: boolean): ProxyDecision {
  if (PUBLIC_PATHS.has(pathname) || PASS_THROUGH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return { action: 'next', refreshSessionCookie: false };
  }
  if (!hasSessionCookie) return { action: 'redirect', to: '/giris' };
  return { action: 'next', refreshSessionCookie: true };
}
```

(Mevcut açıklama yorumu korunur.)

- [ ] **Adım 8: Yeşili gör**

Run: `npx vitest run --project unit tests/unit/harita-parca.test.ts tests/unit/proxy-decision.test.ts`
Expected: PASS.

- [ ] **Adım 9: Çalışma zamanında dene**

Geliştirme sunucusunu yeniden başlat (paket kuruldu): çalışan `next dev` sürecini PID'iyle durdur, `npm run dev`. Sonra:

```bash
node -e "fetch('http://localhost:3000/harita/parca/20261006/0/0/0').then(r=>console.log(r.status))"
```

Expected: `401` (oturum yok). Harita dosyası henüz yok; oturumlu istekte `503` beklenir (Görev 19'dan sonra `200`).

- [ ] **Adım 10: Commit**

```bash
npm run format && npm run lint && npm run typecheck && npx vitest run --project unit && npm run build
git add package.json package-lock.json src/server/geo src/app/harita src/lib/proxy-decision.ts tests/helpers/pmtiles.ts tests/unit/harita-parca.test.ts tests/unit/proxy-decision.test.ts
git commit -m "Harita: PMTiles parça sunumu (oturum denetimi, sürüm, önbellek başlıkları)"
```

---

### Görev 16: Konum bağlantısı ve koordinat okuma

**Files:**
- Create: `src/lib/location-link.ts`, `src/server/geo/short-link.ts`
- Test: `tests/unit/location-link.test.ts`, `tests/unit/short-link.test.ts`

**Interfaces:**
- Consumes: `GeoPoint`, `isInTurkey` (Görev 2)
- Produces:
  - `type LocationParse = { kind: 'location'; point: GeoPoint; inTurkey: boolean; swappedInTurkey: boolean } | { kind: 'google_short'; url: string } | { kind: 'unsupported_short' } | { kind: 'unreadable' }`
  - `parseLocationInput(input: string): LocationParse`, `LOCATION_LINK_MESSAGES = { unreadable, outside, swapped, failed }`
  - `resolveGoogleShortLink(url: string, deps: { fetch: typeof fetch; timeoutMs?: number; userAgent: string }): Promise<LocationParse | { kind: 'failed' }>`, `isGoogleShortLink(url: string): boolean`, `MAP_USER_AGENT`

- [ ] **Adım 1: Ayrıştırıcı testini yaz**

`tests/unit/location-link.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseLocationInput } from '@/lib/location-link';

const at = (lat: number, lng: number) => ({
  kind: 'location',
  point: { lat, lng },
  inTurkey: true,
  swappedInTurkey: false,
});

describe('konum bağlantısı: Google', () => {
  it.each([
    [
      'iğne (!3d/!4d) haritanın ortasına (@) tercih edilir',
      'https://www.google.com/maps/place/Kad%C4%B1k%C3%B6y/@40.9909,29.0303,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d40.9927!4d29.0277',
      at(40.9927, 29.0277),
    ],
    ['@ ile', 'https://www.google.com/maps/@41.0082,28.9784,17z', at(41.0082, 28.9784)],
    ['WhatsApp konumu (q=)', 'https://maps.google.com/maps?q=41.0082,28.9784', at(41.0082, 28.9784)],
    [
      'api=1 query (kodlanmış virgül)',
      'https://www.google.com/maps/search/?api=1&query=41.0082%2C28.9784',
      at(41.0082, 28.9784),
    ],
    ['ll=', 'https://maps.google.com/?ll=41.0082,28.9784&z=16', at(41.0082, 28.9784)],
  ])('%s', (_name, input, expected) => {
    expect(parseLocationInput(input)).toEqual(expected);
  });
});

describe('konum bağlantısı: Apple ve Yandex', () => {
  it.each([
    ['Apple ll', 'https://maps.apple.com/?ll=41.0082,28.9784&q=Konum', at(41.0082, 28.9784)],
    ['Apple coordinate', 'https://maps.apple.com/?coordinate=41.0082,28.9784', at(41.0082, 28.9784)],
    ['Apple q', 'https://maps.apple.com/?q=41.0082,28.9784', at(41.0082, 28.9784)],
    ['Yandex pt (boylam önce)', 'https://yandex.com.tr/harita/?pt=28.9784,41.0082&z=17', at(41.0082, 28.9784)],
    ['Yandex ll (boylam önce)', 'https://yandex.com.tr/maps/?ll=28.9784%2C41.0082&z=12', at(41.0082, 28.9784)],
  ])('%s', (_name, input, expected) => {
    expect(parseLocationInput(input)).toEqual(expected);
  });
});

describe('düz koordinat', () => {
  it.each([
    ['virgüllü', '41.0082, 28.9784'],
    ['boşluklu', '41.0082 28.9784'],
    ['Türkçe ondalık virgül, boşlukla ayrılmış', '41,0082 28,9784'],
    ['noktalı virgül', '41.0082;28.9784'],
    ['görünmez yön işaretleri ve bölünmez boşluk', '‪41.0082, 28.9784‬'],
  ])('%s', (_name, input) => {
    expect(parseLocationInput(input)).toEqual(at(41.0082, 28.9784));
  });

  it('derece-dakika-saniye (N/E ve K/D)', () => {
    for (const input of [`41°00'29.5"N 28°58'42.2"E`, `41°00′29.5″K 28°58′42.2″D`]) {
      const result = parseLocationInput(input);
      expect(result.kind).toBe('location');
      if (result.kind !== 'location') return;
      expect(result.point.lat).toBeCloseTo(41.008194, 5);
      expect(result.point.lng).toBeCloseTo(28.978389, 5);
    }
  });
});

describe('Türkiye dışı ve ters yazım', () => {
  it('Türkiye dışı konum işaretlenir', () => {
    expect(parseLocationInput('48.8584, 2.2945')).toEqual({
      kind: 'location',
      point: { lat: 48.8584, lng: 2.2945 },
      inTurkey: false,
      swappedInTurkey: false,
    });
  });

  it('ters yazılmış koordinat: Türkiye dışı ama yer değiştirince Türkiye içi', () => {
    expect(parseLocationInput('28.9784, 41.0082')).toEqual({
      kind: 'location',
      point: { lat: 28.9784, lng: 41.0082 },
      inTurkey: false,
      swappedInTurkey: true,
    });
  });
});

describe('kısa bağlantılar ve okunamayanlar', () => {
  it('WhatsApp mesajının içindeki kısa Google bağlantısı bulunur (sondaki noktalama atılır)', () => {
    expect(parseLocationInput('Konumum: https://maps.app.goo.gl/AbC123xyz 📍')).toEqual({
      kind: 'google_short',
      url: 'https://maps.app.goo.gl/AbC123xyz',
    });
    expect(parseLocationInput('(https://goo.gl/maps/Xyz789).')).toEqual({
      kind: 'google_short',
      url: 'https://goo.gl/maps/Xyz789',
    });
    expect(parseLocationInput('http://maps.app.goo.gl/AbC')).toEqual({
      kind: 'google_short',
      url: 'https://maps.app.goo.gl/AbC',
    });
  });

  it('Apple ve Yandex kısa bağlantıları desteklenmez', () => {
    expect(parseLocationInput('https://maps.apple/p/AbC.dEf')).toEqual({ kind: 'unsupported_short' });
    expect(parseLocationInput('https://yandex.com.tr/maps/-/CDabcXYZ')).toEqual({ kind: 'unsupported_short' });
  });

  it.each([
    ['tanınmayan site', 'https://example.com/?q=41.0082,28.9784'],
    ['metin', 'Kadıköy Moda'],
    ['aralık dışı', '100.5, 200.1'],
    ['boş', '   '],
    ['koordinatsız Google', 'https://www.google.com/maps/place/Kad%C4%B1k%C3%B6y'],
  ])('okunamaz: %s', (_name, input) => {
    expect(parseLocationInput(input)).toEqual({ kind: 'unreadable' });
  });
});
```

- [ ] **Adım 2: Kısa bağlantı testini yaz**

`tests/unit/short-link.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { isGoogleShortLink, resolveGoogleShortLink } from '@/server/geo/short-link';

function redirectTo(location: string | null, status = 302) {
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(null, { status, headers: location ? { location } : {} }),
  );
}

const deps = (fetchImpl: unknown) => ({ fetch: fetchImpl as typeof fetch, userAgent: 'test' });

describe('kısa Google bağlantısı', () => {
  it('yalnızca izinli alan adları ve HTTPS', () => {
    expect(isGoogleShortLink('https://maps.app.goo.gl/AbC')).toBe(true);
    expect(isGoogleShortLink('https://goo.gl/maps/AbC')).toBe(true);
    expect(isGoogleShortLink('https://goo.gl/AbC')).toBe(false);
    expect(isGoogleShortLink('http://maps.app.goo.gl/AbC')).toBe(false);
    expect(isGoogleShortLink('https://maps.app.goo.gl.example.com/AbC')).toBe(false);
    expect(isGoogleShortLink('https://evil.com/maps.app.goo.gl/AbC')).toBe(false);
  });

  it('tek istek, yönlendirme izlenmez; Location başlığındaki konum okunur', async () => {
    const fetchImpl = redirectTo('https://www.google.com/maps/place/X/data=!3d41.0082!4d28.9784');
    const result = await resolveGoogleShortLink('https://maps.app.goo.gl/AbC', deps(fetchImpl));
    expect(result).toEqual({
      kind: 'location',
      point: { lat: 41.0082, lng: 28.9784 },
      inTurkey: true,
      swappedInTurkey: false,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![1]!.redirect).toBe('manual');
  });

  it('izinli olmayan adrese hiç istek atılmaz', async () => {
    const fetchImpl = redirectTo('https://x');
    expect(await resolveGoogleShortLink('https://evil.com/AbC', deps(fetchImpl))).toEqual({
      kind: 'unreadable',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('Location yok, koordinatsız ya da yine kısa bağlantı: okunamadı', async () => {
    for (const location of [null, 'https://consent.google.com/?continue=x', 'https://maps.app.goo.gl/Baska']) {
      expect(
        await resolveGoogleShortLink('https://maps.app.goo.gl/AbC', deps(redirectTo(location))),
      ).toEqual({ kind: 'unreadable' });
    }
  });

  it('ağ hatası ya da zaman aşımı: "failed"', async () => {
    const failing = vi.fn(async () => {
      throw new DOMException('zaman aşımı', 'TimeoutError');
    });
    expect(await resolveGoogleShortLink('https://maps.app.goo.gl/AbC', deps(failing))).toEqual({
      kind: 'failed',
    });
  });
});
```

- [ ] **Adım 3: Kırmızıyı gör**

Run: `npx vitest run --project unit tests/unit/location-link.test.ts tests/unit/short-link.test.ts`
Expected: FAIL, modüller yok.

- [ ] **Adım 4: `src/lib/location-link.ts`**

```ts
import { isInTurkey, type GeoPoint } from './geo';

export type LocationParse =
  | { kind: 'location'; point: GeoPoint; inTurkey: boolean; swappedInTurkey: boolean }
  | { kind: 'google_short'; url: string }
  | { kind: 'unsupported_short' }
  | { kind: 'unreadable' };

export const LOCATION_LINK_MESSAGES = {
  unreadable:
    "Bu bağlantıdan konum okunamadı. Müşteriden konumu Google Haritalar'dan göndermesini isteyebilir ya da haritada işaretleyebilirsiniz.",
  outside: 'Bu konum Türkiye dışında görünüyor. Yine de kullanılsın mı?',
  swapped: 'Enlem ve boylam yer değiştirmiş olabilir.',
  failed: 'Bağlantı şu an açılamadı. Biraz sonra yeniden deneyin ya da haritada işaretleyin.',
} as const;

const INVISIBLE = /[​-‏‪-‮⁠-⁩﻿]/g;
const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+/i;
const TRAILING_PUNCTUATION = /[.,;:!?)\]}'"»]+$/;
const NUMBER = '(-?\\d{1,3}(?:\\.\\d+)?)';
const PAIR = new RegExp(`^\\s*${NUMBER}\\s*,\\s*${NUMBER}`);

function located(lat: number, lng: number): LocationParse {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { kind: 'unreadable' };
  }
  const point = { lat, lng };
  const inTurkey = isInTurkey(point);
  return {
    kind: 'location',
    point,
    inTurkey,
    swappedInTurkey: !inTurkey && isInTurkey({ lat: lng, lng: lat }),
  };
}

/** "41.0082,28.9784" → [41.0082, 28.9784] (sıra olduğu gibi). */
function pairOf(value: string | null): [number, number] | null {
  if (!value) return null;
  const m = PAIR.exec(value);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function parseUrl(raw: string): LocationParse {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: 'unreadable' };
  }
  const host = url.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && url.pathname.startsWith('/maps'))) {
    url.protocol = 'https:';
    return { kind: 'google_short', url: url.toString() };
  }
  if (host === 'maps.apple' || (host.endsWith('maps.apple.com') && url.pathname.startsWith('/p/'))) {
    return { kind: 'unsupported_short' };
  }
  if (host.includes('yandex.') && url.pathname.includes('/-/')) return { kind: 'unsupported_short' };

  let decoded = url.toString();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Bozuk % dizisi: kodlanmış hâliyle aranır.
  }
  const params = url.searchParams;

  if (host.includes('google.') || host === 'maps.google.com') {
    const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(decoded);
    if (pin) return located(Number(pin[1]), Number(pin[2]));
    for (const key of ['q', 'query', 'll', 'destination']) {
      const pair = pairOf(params.get(key));
      if (pair) return located(pair[0], pair[1]);
    }
    const center = /@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(decoded);
    if (center) return located(Number(center[1]), Number(center[2]));
    return { kind: 'unreadable' };
  }
  if (host.endsWith('apple.com')) {
    for (const key of ['ll', 'coordinate', 'q', 'sll']) {
      const pair = pairOf(params.get(key));
      if (pair) return located(pair[0], pair[1]);
    }
    return { kind: 'unreadable' };
  }
  if (host.includes('yandex.')) {
    // Yandex sırayı tersine yazar: boylam, enlem.
    for (const key of ['pt', 'll', 'whatshere[point]']) {
      const pair = pairOf(params.get(key));
      if (pair) return located(pair[1], pair[0]);
    }
    return { kind: 'unreadable' };
  }
  return { kind: 'unreadable' };
}

const DMS = String.raw`(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["″]|'')?\s*`;
const DMS_PAIR = new RegExp(`${DMS}([NSKG])[\\s,;]*${DMS}([EWDB])`, 'i');
const DECIMAL_PAIR = /(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)/;
const COMMA_DECIMAL_PAIR = /(-?\d{1,3},\d+)\s*[;\s]\s*(-?\d{1,3},\d+)/;

function dmsToDecimal(deg: string, min: string, sec: string, hemisphere: string): number {
  const value = Number(deg) + Number(min) / 60 + Number(sec.replace(',', '.')) / 3600;
  return /[SGWB]/i.test(hemisphere) ? -value : value;
}

function parseText(text: string): LocationParse {
  const dms = DMS_PAIR.exec(text);
  if (dms) {
    return located(
      dmsToDecimal(dms[1]!, dms[2]!, dms[3]!, dms[4]!),
      dmsToDecimal(dms[5]!, dms[6]!, dms[7]!, dms[8]!),
    );
  }
  const decimal = DECIMAL_PAIR.exec(text);
  if (decimal) return located(Number(decimal[1]), Number(decimal[2]));
  const comma = COMMA_DECIMAL_PAIR.exec(text);
  if (comma) return located(Number(comma[1]!.replace(',', '.')), Number(comma[2]!.replace(',', '.')));
  return { kind: 'unreadable' };
}

/**
 * Konum bağlantısı ya da koordinat okur (tarayıcıda ve sunucuda aynı). Metnin içindeki ilk bağlantı esas alınır
 * (WhatsApp mesajı: "Konumum: https://… 📍"). Kısa Google bağlantısı burada açılmaz; sunucu eylemi açar.
 */
export function parseLocationInput(input: string): LocationParse {
  const text = input.replace(INVISIBLE, '').replace(/ /g, ' ').trim();
  if (text === '') return { kind: 'unreadable' };
  const link = URL_IN_TEXT.exec(text);
  if (link) return parseUrl(link[0].replace(TRAILING_PUNCTUATION, ''));
  return parseText(text);
}
```

> DMS'de N/S/E/W'nin Türkçe karşılıkları: K (kuzey), G (güney), D (doğu), B (batı). `[SGWB]` güney ve batıyı eksi yapar.

- [ ] **Adım 5: `src/server/geo/short-link.ts`**

```ts
import { parseLocationInput, type LocationParse } from '@/lib/location-link';

/** Dış servislere kendimizi tanıtırız (Nominatim kuralı). Kişisel e-posta sahibin onayı olmadan yazılmaz. */
export const MAP_USER_AGENT = 'ServisTakip/0.1 (servis takip uygulamasi)';

const ALLOWED = (url: URL) =>
  url.protocol === 'https:' &&
  url.port === '' &&
  (url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps/')));

export function isGoogleShortLink(raw: string): boolean {
  try {
    return ALLOWED(new URL(raw));
  } catch {
    return false;
  }
}

/**
 * Kısa Google bağlantısını açar: tek istek, yönlendirme izlenmez, gövde okunmaz; yalnızca Location başlığı
 * ayrıştırılır. İzinli iki alan adı dışında istek atılmaz (sunucu üzerinden başka adrese istek yaptırılamaz).
 */
export async function resolveGoogleShortLink(
  raw: string,
  deps: { fetch: typeof fetch; userAgent: string; timeoutMs?: number },
): Promise<LocationParse | { kind: 'failed' }> {
  if (!isGoogleShortLink(raw)) return { kind: 'unreadable' };
  let response: Response;
  try {
    response = await deps.fetch(raw, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': deps.userAgent },
      signal: AbortSignal.timeout(deps.timeoutMs ?? 5000),
    });
  } catch {
    return { kind: 'failed' };
  }
  await response.body?.cancel().catch(() => undefined);
  const location = response.headers.get('location');
  if (response.status < 300 || response.status >= 400 || !location) return { kind: 'unreadable' };
  const parsed = parseLocationInput(new URL(location, raw).toString());
  return parsed.kind === 'location' ? parsed : { kind: 'unreadable' };
}
```

- [ ] **Adım 6: Yeşili gör**

Run: `npx vitest run --project unit tests/unit/location-link.test.ts tests/unit/short-link.test.ts`
Expected: PASS. Bir Google biçimi düşerse kalıbı düzelt, beklenen değeri değil.

- [ ] **Adım 7: Commit**

```bash
npm run format && npm run lint && npm run typecheck
git add src/lib/location-link.ts src/server/geo/short-link.ts tests/unit/location-link.test.ts tests/unit/short-link.test.ts
git commit -m "Konum: bağlantı ve koordinat okuma (Google, Apple, Yandex, DMS), kısa Google bağlantısı"
```

---

### Görev 17: Adres bulma (Nominatim) ve konum eylemleri

**Files:**
- Create: `src/server/geo/geocoder.ts`, `src/server/geo/limits.ts`, `src/app/(uygulama)/musteriler/konum-actions.ts`
- Modify: `.env.example`
- Test: `tests/unit/geocoder.test.ts`, `tests/unit/geo-limits.test.ts`, `tests/unit/logger.test.ts` (ek)

**Interfaces:**
- Consumes: `parseLocationInput`, `LOCATION_LINK_MESSAGES` (Görev 16), `resolveGoogleShortLink`, `MAP_USER_AGENT` (Görev 16), `requirePermission`, `runAction`
- Produces:
  - `interface GeocodeResult { latitude: number; longitude: number; label: string }`, `class GeocodeUnavailableError`, `createGeocoder(opts): { search(query: string): Promise<GeocodeResult[]> }`, `getGeocoder(): Geocoder | null` (`GEOCODER_URL` boşsa null), `GEOCODE_MESSAGES = { notFound, unavailable, tooMany, disabled }`, `buildAddressQuery(a): string`
  - `createMinuteLimiter(opts: { limit; windowMs; now; maxKeys? }): { take(key: string): boolean }`, `geocodeLimiter`, `linkLimiter` (kişi başına dakikada 10)
  - `konum-actions.ts`: `geocodeAddressAction(input: { province; district; neighborhood; addressLine }): Promise<ActionResult<GeocodeResult[]>>`, `resolveLocationLinkAction(text: string): Promise<ActionResult<{ latitude: number; longitude: number; inTurkey: boolean; swappedInTurkey: boolean }>>`

- [ ] **Adım 1: Testleri yaz**

`tests/unit/geo-limits.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createMinuteLimiter } from '@/server/geo/limits';

describe('dakikalık sınır', () => {
  it('kişi başına sayar, pencere dolunca sıfırlanır', () => {
    let now = 0;
    const limiter = createMinuteLimiter({ limit: 2, windowMs: 60_000, now: () => now });
    expect([limiter.take('a'), limiter.take('a'), limiter.take('a')]).toEqual([true, true, false]);
    expect(limiter.take('b')).toBe(true);
    now = 60_000;
    expect(limiter.take('a')).toBe(true);
  });

  it('en çok belirli sayıda anahtar tutulur', () => {
    const limiter = createMinuteLimiter({ limit: 1, windowMs: 60_000, now: () => 0, maxKeys: 2 });
    limiter.take('a');
    limiter.take('b');
    limiter.take('c'); // "a" atılır
    expect(limiter.take('a')).toBe(true);
  });
});
```

`tests/unit/geocoder.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { GeocodeUnavailableError, buildAddressQuery, createGeocoder } from '@/server/geo/geocoder';

const RESULT = [{ lat: '40.9862', lon: '29.0253', display_name: 'Moda Caddesi, Kadıköy, İstanbul, Türkiye' }];

function setup(response: () => Promise<Response> = async () => Response.json(RESULT)) {
  let now = 0;
  const sleeps: number[] = [];
  const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => response());
  const geocoder = createGeocoder({
    baseUrl: 'https://nominatim.example',
    userAgent: 'test',
    fetch: fetchImpl as unknown as typeof fetch,
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
  });
  return { geocoder, fetchImpl, sleeps, advance: (ms: number) => (now += ms) };
}

describe('adres bulma', () => {
  it('Türkiye ile sınırlı, Türkçe, en çok 5 sonuç; yalnızca adres metni gider', async () => {
    const { geocoder, fetchImpl } = setup();
    expect(await geocoder.search('Moda Cad. 5, Kadıköy, İstanbul, Türkiye')).toEqual([
      { latitude: 40.9862, longitude: 29.0253, label: 'Moda Caddesi, Kadıköy, İstanbul, Türkiye' },
    ]);
    const url = new URL(String(fetchImpl.mock.calls[0]![0]));
    expect(url.origin + url.pathname).toBe('https://nominatim.example/search');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      format: 'jsonv2',
      countrycodes: 'tr',
      'accept-language': 'tr',
      limit: '5',
      q: 'Moda Cad. 5, Kadıköy, İstanbul, Türkiye',
    });
    expect(new Headers(fetchImpl.mock.calls[0]![1]!.headers).get('user-agent')).toBe('test');
  });

  it('aynı adres 24 saat önbellekten (boş sonuç da); süre dolunca yeniden sorulur', async () => {
    const { geocoder, fetchImpl, advance } = setup();
    await geocoder.search('Moda');
    await geocoder.search('  moda ');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    advance(24 * 60 * 60 * 1000 + 1);
    await geocoder.search('Moda');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('bütün sunucu için saniyede en çok 1 istek: sıradaki bekler', async () => {
    const { geocoder, sleeps } = setup();
    await Promise.all([geocoder.search('a1'), geocoder.search('b2'), geocoder.search('c3')]);
    expect(sleeps).toEqual([1000, 1000]);
  });

  it('aynı anda gelen aynı arama tek istek olur', async () => {
    const { geocoder, fetchImpl } = setup();
    await Promise.all([geocoder.search('Moda'), geocoder.search('Moda')]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('servis hatası ya da zaman aşımı: GeocodeUnavailableError, önbelleğe yazılmaz', async () => {
    const { geocoder, fetchImpl } = setup(async () => new Response('x', { status: 503 }));
    await expect(geocoder.search('Moda')).rejects.toBeInstanceOf(GeocodeUnavailableError);
    await expect(geocoder.search('Moda')).rejects.toBeInstanceOf(GeocodeUnavailableError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const timeout = setup(async () => {
      throw new DOMException('zaman aşımı', 'TimeoutError');
    });
    await expect(timeout.geocoder.search('Moda')).rejects.toBeInstanceOf(GeocodeUnavailableError);
  });

  it('hata mesajında adres yok (loga kişisel veri gitmez)', async () => {
    const { geocoder } = setup(async () => new Response('x', { status: 500 }));
    const err = await geocoder.search('Gizli Sokak 7').catch((e: unknown) => e as Error);
    expect(err.message).not.toContain('Gizli');
  });

  it('adres metni: boş alanlar atlanır, sonuna "Türkiye" eklenir', () => {
    expect(
      buildAddressQuery({ addressLine: 'Moda Cad. 5', neighborhood: '', district: 'Kadıköy', province: 'İstanbul' }),
    ).toBe('Moda Cad. 5, Kadıköy, İstanbul, Türkiye');
  });
});
```

- [ ] **Adım 2: Kırmızıyı gör**

Run: `npx vitest run --project unit tests/unit/geo-limits.test.ts tests/unit/geocoder.test.ts`
Expected: FAIL, modüller yok.

- [ ] **Adım 3: `src/server/geo/limits.ts`**

```ts
/** Kişi başına sabit pencereli sayaç (bellekte; tek sunucu varsayımı, CLAUDE.md teknik borç 1). */
export function createMinuteLimiter(opts: {
  limit: number;
  windowMs: number;
  now: () => number;
  maxKeys?: number;
}): { take(key: string): boolean } {
  const maxKeys = opts.maxKeys ?? 10_000;
  const windows = new Map<string, { count: number; resetAt: number }>();
  return {
    take(key) {
      const now = opts.now();
      let entry = windows.get(key);
      if (!entry || entry.resetAt <= now) {
        windows.delete(key);
        if (windows.size >= maxKeys) windows.delete(windows.keys().next().value!);
        entry = { count: 0, resetAt: now + opts.windowMs };
        windows.set(key, entry);
      }
      if (entry.count >= opts.limit) return false;
      entry.count += 1;
      return true;
    },
  };
}

export const geocodeLimiter = createMinuteLimiter({ limit: 10, windowMs: 60_000, now: () => Date.now() });
export const linkLimiter = createMinuteLimiter({ limit: 10, windowMs: 60_000, now: () => Date.now() });
```

- [ ] **Adım 4: `src/server/geo/geocoder.ts`**

```ts
import { MAP_USER_AGENT } from './short-link';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
}

export interface Geocoder {
  search(query: string): Promise<GeocodeResult[]>;
}

/** Servis yanıt vermedi. Mesaj sabittir: adres metni hata kaydına geçmez. */
export class GeocodeUnavailableError extends Error {
  constructor() {
    super('geocoder unavailable');
    this.name = 'GeocodeUnavailableError';
  }
}

export const GEOCODE_MESSAGES = {
  notFound:
    'Adres haritada bulunamadı. Haritayı kaydırarak ya da konum bağlantısıyla işaretleyebilirsiniz.',
  unavailable:
    'Adres arama şu an çalışmıyor. Haritayı kaydırarak ya da konum bağlantısıyla işaretleyebilirsiniz.',
  tooMany: 'Kısa sürede çok arama yaptınız. Bir dakika sonra yeniden deneyin.',
  disabled: 'Adres arama kapalı. Haritayı kaydırarak ya da konum bağlantısıyla işaretleyebilirsiniz.',
} as const;

export function buildAddressQuery(a: {
  addressLine: string;
  neighborhood: string;
  district: string;
  province: string;
}): string {
  return [a.addressLine, a.neighborhood, a.district, a.province, 'Türkiye']
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Nominatim kullanım kuralları: tüm sunucu için saniyede en çok 1 istek (sıra), uygulamayı tanıtan User-Agent,
 * sonuçlar önbellekte (24 saat, en çok 1000), otomatik tamamlama yok (yalnızca düğmeyle çağrılır).
 */
export function createGeocoder(opts: {
  baseUrl: string;
  userAgent: string;
  fetch: typeof fetch;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  minIntervalMs?: number;
  cacheTtlMs?: number;
  cacheMax?: number;
  timeoutMs?: number;
}): Geocoder {
  const minInterval = opts.minIntervalMs ?? 1000;
  const ttl = opts.cacheTtlMs ?? DAY_MS;
  const cacheMax = opts.cacheMax ?? 1000;
  const cache = new Map<string, { results: GeocodeResult[]; until: number }>();
  const inFlight = new Map<string, Promise<GeocodeResult[]>>();
  let queue: Promise<unknown> = Promise.resolve();
  let nextAllowed = 0;

  async function request(query: string): Promise<GeocodeResult[]> {
    const wait = nextAllowed - opts.now();
    if (wait > 0) await opts.sleep(wait);
    nextAllowed = opts.now() + minInterval;
    const url = new URL('/search', opts.baseUrl);
    url.search = new URLSearchParams({
      format: 'jsonv2',
      countrycodes: 'tr',
      'accept-language': 'tr',
      limit: '5',
      q: query,
    }).toString();
    let body: unknown;
    try {
      const response = await opts.fetch(url, {
        headers: { 'User-Agent': opts.userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 5000),
      });
      if (!response.ok) throw new GeocodeUnavailableError();
      body = await response.json();
    } catch {
      throw new GeocodeUnavailableError();
    }
    if (!Array.isArray(body)) throw new GeocodeUnavailableError();
    return body
      .map((r: { lat?: unknown; lon?: unknown; display_name?: unknown }) => ({
        latitude: Number(r.lat),
        longitude: Number(r.lon),
        label: typeof r.display_name === 'string' ? r.display_name : '',
      }))
      .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
      .slice(0, 5);
  }

  return {
    search(raw) {
      const query = raw.replace(/\s+/g, ' ').trim();
      const key = query.toLocaleLowerCase('tr-TR');
      const hit = cache.get(key);
      if (hit && hit.until > opts.now()) return Promise.resolve(hit.results);
      const running = inFlight.get(key);
      if (running) return running;
      const job = queue.then(() => request(query));
      queue = job.catch(() => undefined);
      const tracked = job.then(
        (results) => {
          cache.delete(key);
          if (cache.size >= cacheMax) cache.delete(cache.keys().next().value!);
          cache.set(key, { results, until: opts.now() + ttl });
          return results;
        },
      ).finally(() => inFlight.delete(key));
      inFlight.set(key, tracked);
      return tracked;
    },
  };
}

let shared: Geocoder | null | undefined;

/** GEOCODER_URL boşsa özellik kapalı (düğme görünmez). Pilot firma gerçek veriyle başlamadan kapatılır ya da kendi sunucumuza bağlanır. */
export function getGeocoder(): Geocoder | null {
  if (shared !== undefined) return shared;
  const baseUrl = process.env.GEOCODER_URL?.trim();
  shared = baseUrl
    ? createGeocoder({
        baseUrl,
        userAgent: MAP_USER_AGENT,
        fetch,
        now: () => Date.now(),
        sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      })
    : null;
  return shared;
}
```

> Testteki "saniyede 1" beklentisi `[1000, 1000]`: ilk istek beklemez, sonraki iki istek sahte saatle birer saniye bekler.

- [ ] **Adım 5: Yeşili gör**

Run: `npx vitest run --project unit tests/unit/geo-limits.test.ts tests/unit/geocoder.test.ts`
Expected: PASS.

- [ ] **Adım 6: Konum eylemleri**

`src/app/(uygulama)/musteriler/konum-actions.ts`:

```ts
'use server';

import { LOCATION_LINK_MESSAGES, parseLocationInput } from '@/lib/location-link';
import { runAction, type ActionResult } from '@/server/action-result';
import { actorFromSession } from '@/server/auth/actor';
import { requireSession } from '@/server/auth/current-user';
import { invalidActionError } from '@/server/errors';
import {
  GEOCODE_MESSAGES,
  GeocodeUnavailableError,
  buildAddressQuery,
  getGeocoder,
  type GeocodeResult,
} from '@/server/geo/geocoder';
import { geocodeLimiter, linkLimiter } from '@/server/geo/limits';
import { MAP_USER_AGENT, resolveGoogleShortLink } from '@/server/geo/short-link';
import { requirePermission } from '@/server/permissions';

const text = (value: unknown, max: number): string => String(value ?? '').slice(0, max);

/** "Adresi haritada bul": dışarı yalnızca adres metni gider (ad ve telefon gitmez). */
export async function geocodeAddressAction(input: {
  province: string;
  district: string;
  neighborhood: string;
  addressLine: string;
}): Promise<ActionResult<GeocodeResult[]>> {
  // requireSession yönlendirme fırlatabilir; runAction'ın dışında çağrılır (mevcut eylemlerle aynı).
  const actor = actorFromSession(await requireSession());
  return runAction(async () => {
    requirePermission(actor, 'customer.manage');
    const geocoder = getGeocoder();
    if (!geocoder) throw invalidActionError(GEOCODE_MESSAGES.disabled);
    const query = buildAddressQuery({
      province: text(input?.province, 40),
      district: text(input?.district, 60),
      neighborhood: text(input?.neighborhood, 80),
      addressLine: text(input?.addressLine, 250),
    });
    if (!geocodeLimiter.take(actor.userId)) throw invalidActionError(GEOCODE_MESSAGES.tooMany);
    let results: GeocodeResult[];
    try {
      results = await geocoder.search(query);
    } catch (err) {
      if (err instanceof GeocodeUnavailableError) throw invalidActionError(GEOCODE_MESSAGES.unavailable);
      throw err;
    }
    if (results.length === 0) throw invalidActionError(GEOCODE_MESSAGES.notFound);
    return results;
  });
}

/** Kısa Google bağlantısını sunucu açar (tarayıcı Google'a bağlanmaz); diğer biçimler tarayıcıda zaten okunur. */
export async function resolveLocationLinkAction(input: string): Promise<
  ActionResult<{ latitude: number; longitude: number; inTurkey: boolean; swappedInTurkey: boolean }>
> {
  const actor = actorFromSession(await requireSession());
  return runAction(async () => {
    requirePermission(actor, 'customer.manage');
    let parsed = parseLocationInput(text(input, 2000));
    if (parsed.kind === 'google_short') {
      if (!linkLimiter.take(actor.userId)) throw invalidActionError(GEOCODE_MESSAGES.tooMany);
      const resolved = await resolveGoogleShortLink(parsed.url, { fetch, userAgent: MAP_USER_AGENT });
      if (resolved.kind === 'failed') throw invalidActionError(LOCATION_LINK_MESSAGES.failed);
      parsed = resolved;
    }
    if (parsed.kind !== 'location') throw invalidActionError(LOCATION_LINK_MESSAGES.unreadable);
    return {
      latitude: parsed.point.lat,
      longitude: parsed.point.lng,
      inTurkey: parsed.inTurkey,
      swappedInTurkey: parsed.swappedInTurkey,
    };
  });
}
```

`.env.example`'a ekle:

```bash
# Adres bulma (Nominatim). Boşsa "Adresi haritada bul" düğmesi görünmez.
# Geliştirmede herkese açık sunucu; pilot firma gerçek veriyle başlamadan kapatılır ya da kendi sunucumuza bağlanır.
GEOCODER_URL=https://nominatim.openstreetmap.org
# Harita dosyasının klasörü (boşsa proje kökündeki harita/). E2E kendi deneme klasörünü verir.
HARITA_KLASORU=
```

Kendi `.env` dosyana da aynı iki satırı ekle (değerlerle); sır değildir.

- [ ] **Adım 7: Logger koruma testi**

`tests/unit/logger.test.ts`'e ekle (`describe('logger', …)` içine). Logger zaten yalnızca hata adı, PostgreSQL kodu ve çağrı satırlarını yazdığı için test hemen yeşil olur; amacı, logger ileride değişirse bu parçanın yeni alanlarının (arama metni, adres, koordinat, konum bağlantısı) sızmasını yakalamaktır (tasarım §15).

```ts
  it('ağ ve sorgu hatalarında adres, koordinat, bağlantı ve arama metni yazılmaz', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const network = new TypeError(
      'fetch failed: https://maps.app.goo.gl/AbC 40.9862,29.0253',
      {
        cause: new Error('getaddrinfo ENOTFOUND nominatim?q=Moda Cad. No: 5, Kadıköy'),
      },
    );
    const query = Object.assign(
      new Error('Failed query: select … params: sukru isik,+905321112233,Moda Cad.'),
      { cause: Object.assign(new Error('duplicate key'), { code: '23505' }) },
    );
    logger.error('geocode_failed', network);
    logger.error('customer_search_failed', query);
    const logged = spy.mock.calls.flat().join(' ');
    for (const secret of ['Moda', 'Kadıköy', '40.9862', 'goo.gl', 'sukru', '905321112233']) {
      expect(logged).not.toContain(secret);
    }
    expect(logged).toContain('"pgCode":"23505"');
  });
```

Run: `npx vitest run --project unit tests/unit/logger.test.ts`
Expected: PASS.

- [ ] **Adım 8: Commit**

```bash
npm run format && npm run lint && npm run typecheck && npx vitest run --project unit
git add src/server/geo "src/app/(uygulama)/musteriler/konum-actions.ts" .env.example tests/unit/geocoder.test.ts tests/unit/geo-limits.test.ts tests/unit/logger.test.ts
git commit -m "Konum: adres bulma (Nominatim kuralları, önbellek, kişi başı sınır) ve bağlantı eylemi"
```

---

### Görev 18: Harita renkleri ve stili

> Ön koşul: Görev 9'da sahip harita renklerini onayladı. Aşağıdaki değerler önerinin başlangıcıdır; onaylanan değerler yazılır.

**Files:**
- Modify: `src/app/globals.css`, `tests/unit/tasarim-kontrast.test.ts`, `package.json` (`maplibre-gl`, `@protomaps/basemaps`)
- Create: `src/lib/map-assets.ts`, `src/components/map/map-style.ts`
- Test: `tests/unit/map-style.test.ts`

**Interfaces:**
- Consumes: `globals.css` token düzeni
- Produces:
  - Token'lar: `--map-background`, `--map-earth`, `--map-water`, `--map-park`, `--map-building`, `--map-road-minor`, `--map-road-major`, `--map-label`, `--map-label-halo`, `--map-boundary` (açık ve koyu)
  - `map-assets.ts`: `MAP_FONTSTACKS`, `MAP_SPRITES = ['light', 'dark']`, `MAP_PATHS = { fonts: '/harita/yazi', sprites: '/harita/simge', tiles: '/harita/parca' }`, `interface MapSettings { map: { version: string; maxZoom: number } | null; geocodeEnabled: boolean }`
  - `map-style.ts`: `interface MapColors { background; earth; water; park; building; roadMinor; roadMajor; label; labelHalo; boundary }`, `MAP_COLOR_TOKENS: Record<keyof MapColors, string>`, `readMapColors(el?: HTMLElement): MapColors`, `buildFlavor(theme, colors): Flavor`, `buildMapStyle(opts: { origin; version; maxZoom; theme: 'light' | 'dark'; colors }): StyleSpecification`

- [ ] **Adım 1: Paketleri incele ve kur**

```bash
npm view maplibre-gl version license dependencies
npm view @protomaps/basemaps version license dependencies
```

Expected: `maplibre-gl 6.13.x` (BSD-3-Clause), `@protomaps/basemaps 5.7.x` (BSD-3-Clause). İkisinde de `postinstall` ve telemetri yok; MapLibre yalnızca stilde verilen adreslere istek atar (bizim stilimizde hepsi `/harita/...`). Doğrula:

```bash
npm view maplibre-gl scripts --json
grep -rl "events.mapbox\|api.mapbox.com/events\|telemetry" node_modules/maplibre-gl/dist/maplibre-gl.mjs || echo "telemetri yok"
```

(İkinci komut kurulumdan sonra çalıştırılır.) Kur:

```bash
npm install --silent maplibre-gl @protomaps/basemaps
```

- [ ] **Adım 2: Kontrast testine harita token'ları**

`tests/unit/tasarim-kontrast.test.ts`: `TOKENS` listesine ekle:

```ts
  // Harita (docs/TASARIM-SISTEMI.md → Müşteriler ekranları)
  'map-background',
  'map-earth',
  'map-water',
  'map-park',
  'map-building',
  'map-road-minor',
  'map-road-major',
  'map-label',
  'map-label-halo',
  'map-boundary',
```

`TEXT_PAIRS`'e ekle:

```ts
  ['map-label', 'map-label-halo'],
  ['map-label', 'map-earth'],
  ['map-label', 'map-park'],
```

Run: `npx vitest run --project unit tests/unit/tasarim-kontrast.test.ts`
Expected: FAIL (token'lar yok).

- [ ] **Adım 3: Token'lar**

`src/app/globals.css` `:root` bloğuna (`--card-shadow`'dan önce):

```css
  /* Harita (MapLibre stili bu token'lardan kurulur) */
  --map-background: #e4e7ea;
  --map-earth: #f3f2ee;
  --map-water: #a8c8de;
  --map-park: #d3e5cb;
  --map-building: #dedad2;
  --map-road-minor: #ffffff;
  --map-road-major: #f5d35c;
  --map-label: #24282d;
  --map-label-halo: #ffffff;
  --map-boundary: #7d848c;
```

Koyu blokta:

```css
    --map-background: #0b0d0f;
    --map-earth: #1b1e22;
    --map-water: #1d3546;
    --map-park: #1d3022;
    --map-building: #2a2e34;
    --map-road-minor: #3a4048;
    --map-road-major: #6e5c17;
    --map-label: #e7e9ec;
    --map-label-halo: #0e1012;
    --map-boundary: #7a828c;
```

Run: `npx vitest run --project unit tests/unit/tasarim-kontrast.test.ts tests/unit/renk-kodu-yasagi.test.ts`
Expected: PASS. Bir çift 4,5:1'in altındaysa yalnızca o token'ın tonunu koyulaştır/açarak düzelt ve değişikliği `docs/TASARIM-SISTEMI.md`'ye yaz.

- [ ] **Adım 4: Stil testi**

`tests/unit/map-style.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildMapStyle, MAP_COLOR_TOKENS, type MapColors } from '@/components/map/map-style';
import { MAP_FONTSTACKS } from '@/lib/map-assets';

// Renk yerine ayırt edici adlar: stilin hangi token'ı nereye koyduğu sınanır (renk kodu yasağına da takılmaz).
const COLORS = Object.fromEntries(
  Object.keys(MAP_COLOR_TOKENS).map((key) => [key, `renk-${key}`]),
) as unknown as MapColors;

const style = buildMapStyle({
  origin: 'https://servis.example',
  version: '20261006',
  maxZoom: 15,
  theme: 'light',
  colors: COLORS,
});

function collectFonts(value: unknown, out: Set<string>): void {
  if (typeof value === 'string' && value.startsWith('Noto Sans')) out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectFonts(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectFonts(v, out));
}

describe('harita stili', () => {
  it('bütün dosyalar bizim sunucumuzdan: yazı tipi, simge, parça', () => {
    expect(style.glyphs).toBe('https://servis.example/harita/yazi/{fontstack}/{range}.pbf');
    expect(style.sprite).toBe('https://servis.example/harita/simge/light');
    expect(style.sources).toEqual({
      protomaps: {
        type: 'vector',
        tiles: ['https://servis.example/harita/parca/20261006/{z}/{x}/{y}'],
        minzoom: 0,
        maxzoom: 15,
        attribution: '© OpenStreetMap katkıcıları · Protomaps',
      },
    });
    const urls = JSON.stringify(style).match(/https?:\/\/[^"]+/g) ?? [];
    expect(urls.every((u) => u.startsWith('https://servis.example/'))).toBe(true);
  });

  it('stildeki her yazı tipi indirilen yazı tipi yığınlarında var', () => {
    const fonts = new Set<string>();
    collectFonts(style.layers, fonts);
    expect(fonts.size).toBeGreaterThan(0);
    for (const font of fonts) expect(MAP_FONTSTACKS).toContain(font);
  });

  it('renkler token\'lardan gelir', () => {
    const paint = (id: string) =>
      (style.layers.find((l) => l.id === id) as { paint?: Record<string, unknown> } | undefined)?.paint;
    expect(paint('background')?.['background-color']).toBe('renk-background');
    expect(paint('earth')?.['fill-color']).toBe('renk-earth');
    expect(paint('water')?.['fill-color']).toBe('renk-water');
  });

  it('koyu temada koyu simge seti', () => {
    const dark = buildMapStyle({ origin: 'https://x', version: '1', maxZoom: 15, theme: 'dark', colors: COLORS });
    expect(dark.sprite).toBe('https://x/harita/simge/dark');
  });
});
```

- [ ] **Adım 5: Kırmızıyı gör**

Run: `npx vitest run --project unit tests/unit/map-style.test.ts`
Expected: FAIL, modüller yok.

- [ ] **Adım 6: `src/lib/map-assets.ts` ve `src/components/map/map-style.ts`**

```ts
// src/lib/map-assets.ts
/** basemaps-assets'ten indirilen yazı tipi yığınları; stil bunların dışında yazı tipi istememeli (test denetler). */
export const MAP_FONTSTACKS = [
  'Noto Sans Regular',
  'Noto Sans Medium',
  'Noto Sans Italic',
  'Noto Sans Devanagari Regular v1',
] as const;

export const MAP_SPRITES = ['light', 'dark'] as const;

export const MAP_PATHS = {
  fonts: '/harita/yazi',
  sprites: '/harita/simge',
  tiles: '/harita/parca',
} as const;

/** Sunucunun ekrana verdiği harita ayarı: dosya yoksa harita kapalı, GEOCODER_URL yoksa adres bulma kapalı. */
export interface MapSettings {
  map: { version: string; maxZoom: number } | null;
  geocodeEnabled: boolean;
}
```

```ts
// src/components/map/map-style.ts
import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';
import { MAP_PATHS } from '@/lib/map-assets';

export interface MapColors {
  background: string;
  earth: string;
  water: string;
  park: string;
  building: string;
  roadMinor: string;
  roadMajor: string;
  label: string;
  labelHalo: string;
  boundary: string;
}

export const MAP_COLOR_TOKENS: Record<keyof MapColors, string> = {
  background: '--map-background',
  earth: '--map-earth',
  water: '--map-water',
  park: '--map-park',
  building: '--map-building',
  roadMinor: '--map-road-minor',
  roadMajor: '--map-road-major',
  label: '--map-label',
  labelHalo: '--map-label-halo',
  boundary: '--map-boundary',
};

/** Renkler globals.css'ten okunur (koda renk kodu yazılmaz); tema değişince yeniden okunur. */
export function readMapColors(el: HTMLElement = document.documentElement): MapColors {
  const css = getComputedStyle(el);
  return Object.fromEntries(
    Object.entries(MAP_COLOR_TOKENS).map(([key, token]) => [key, css.getPropertyValue(token).trim()]),
  ) as unknown as MapColors;
}

/** Protomaps'in hazır açık/koyu renk setinin üzerine kendi token'larımız. */
export function buildFlavor(theme: 'light' | 'dark', c: MapColors): Flavor {
  return {
    ...namedFlavor(theme),
    background: c.background,
    earth: c.earth,
    water: c.water,
    park_a: c.park,
    park_b: c.park,
    wood_a: c.park,
    wood_b: c.park,
    buildings: c.building,
    minor_a: c.roadMinor,
    minor_b: c.roadMinor,
    minor_service: c.roadMinor,
    major: c.roadMajor,
    highway: c.roadMajor,
    boundaries: c.boundary,
    roads_label_minor: c.label,
    roads_label_minor_halo: c.labelHalo,
    roads_label_major: c.label,
    roads_label_major_halo: c.labelHalo,
    subplace_label: c.label,
    subplace_label_halo: c.labelHalo,
    city_label: c.label,
    city_label_halo: c.labelHalo,
    state_label: c.label,
    state_label_halo: c.labelHalo,
    address_label: c.label,
    address_label_halo: c.labelHalo,
  };
}

export function buildMapStyle(opts: {
  origin: string;
  version: string;
  maxZoom: number;
  theme: 'light' | 'dark';
  colors: MapColors;
}): StyleSpecification {
  // Süslü parantezler URL sınıfıyla kodlanmasın diye adresler düz metin olarak birleştirilir.
  const base = opts.origin.replace(/\/$/, '');
  return {
    version: 8,
    glyphs: `${base}${MAP_PATHS.fonts}/{fontstack}/{range}.pbf`,
    sprite: `${base}${MAP_PATHS.sprites}/${opts.theme}`,
    sources: {
      protomaps: {
        type: 'vector',
        tiles: [`${base}${MAP_PATHS.tiles}/${opts.version}/{z}/{x}/{y}`],
        minzoom: 0,
        maxzoom: opts.maxZoom,
        attribution: '© OpenStreetMap katkıcıları · Protomaps',
      },
    },
    layers: layers('protomaps', buildFlavor(opts.theme, opts.colors), { lang: 'tr' }),
  };
}
```

> `Flavor` alan adları sürüme göre değişebilir: `tsc` bilinmeyen alanı yakalar. Hata çıkarsa `node_modules/@protomaps/basemaps/dist/index.d.ts` içindeki `Flavor` arayüzüne bak ve en yakın alanı kullan (ör. `park_a`/`park_b`). `layers` dönüş türü MapLibre'nin `LayerSpecification[]`'ı ile uyuşmazsa `as StyleSpecification['layers']` ile daralt.

- [ ] **Adım 7: Yeşili gör**

Run: `npx vitest run --project unit tests/unit/map-style.test.ts`
Expected: PASS. "Yazı tipi" testi düşerse `MAP_FONTSTACKS`'e eksik yığını ekle ve Görev 19'daki indirme listesine de gir.

- [ ] **Adım 8: Commit**

```bash
npm run format && npm run lint && npm run typecheck && npx vitest run --project unit
git add package.json package-lock.json src/app/globals.css src/lib/map-assets.ts src/components/map/map-style.ts tests/unit/map-style.test.ts tests/unit/tasarim-kontrast.test.ts
git commit -m "Harita: renk token'ları ve MapLibre stili (yalnızca kendi sunucumuzdan dosya)"
```

---

### Görev 19: Türkiye haritasını indirme 🧭

**Files:**
- Create: `scripts/harita-indir.ts`
- Modify: `package.json` (`harita:indir`), `.gitignore`

**Interfaces:**
- Consumes: `MAP_FONTSTACKS`, `MAP_SPRITES` (Görev 18), `MapVersionFile`, `openTileStore` (Görev 15)
- Produces: `npm run harita:indir [-- --surum YYYYMMDD] [-- --maxzoom N]`; `harita/turkiye-<surum>.pmtiles`, `harita/surum.json`, `public/harita/yazi/**`, `public/harita/simge/*`; `araclar/pmtiles(.exe)`

- [ ] **Adım 1: Sahibe sor** 🧭

İki şey için onay al (tek mesajda):
1. **Program indirme:** `pmtiles` komut satırı aracı (Protomaps, BSD-3 lisans, GitHub sürüm v1.31.2, Windows x86_64, 17,8 MB). Betik dosyanın SHA-256 özetini (`a658baa4d7e55020aef6ca17bd9ff9faa1582671266b36f58c52db0ac8e785a1`) doğrular; kurulum yapmaz, `araclar/` klasörüne açar. Ağ: yalnızca kendisine verilen harita adresine bağlanır.
2. **Harita indirme:** Türkiye kesiti, tahminen ~1 GB (indirme sırasında ölçülür), `build.protomaps.com`'dan; yazı tipleri ve simgeler GitHub'dan (basemaps-assets, sabit sürüm `028c18f…`).

Onay gelmeden Adım 4'e geçme.

- [ ] **Adım 2: Git dışı klasörler**

`.gitignore`'a ekle:

```gitignore
# Harita: büyük dosyalar ve indirilen araçlar (npm run harita:indir üretir)
/araclar/
/harita/
/public/harita/
/public/maplibre/
/tests/e2e/.harita/
```

- [ ] **Adım 3: Betik**

`scripts/harita-indir.ts`:

```ts
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MAP_FONTSTACKS, MAP_SPRITES } from '../src/lib/map-assets';
import { openTileStore, type MapVersionFile } from '../src/server/geo/tiles';

const BUILDS_URL = 'https://build-metadata.protomaps.dev/builds.json';
const BUILD_BASE = 'https://build.protomaps.com';
const BBOX = '25.5,35.7,45.0,42.2'; // Türkiye sınır kutusu (src/lib/geo.ts → TURKEY_BBOX)
const ASSETS_COMMIT = '028c18f713baecad011301ff7a69acc39bcc2ae7'; // protomaps/basemaps-assets, 2025-10-31
const ASSETS_BASE = `https://raw.githubusercontent.com/protomaps/basemaps-assets/${ASSETS_COMMIT}`;
const PMTILES_VERSION = '1.31.2';

// Sürüm sayfasındaki özetler (gh release view -R protomaps/go-pmtiles v1.31.2).
const TOOL: Record<string, { file: string; sha256: string; exe: string }> = {
  'win32-x64': {
    file: `go-pmtiles_${PMTILES_VERSION}_Windows_x86_64.zip`,
    sha256: 'a658baa4d7e55020aef6ca17bd9ff9faa1582671266b36f58c52db0ac8e785a1',
    exe: 'pmtiles.exe',
  },
  'linux-x64': {
    file: `go-pmtiles_${PMTILES_VERSION}_Linux_x86_64.tar.gz`,
    sha256: '3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f',
    exe: 'pmtiles',
  },
  'linux-arm64': {
    file: `go-pmtiles_${PMTILES_VERSION}_Linux_arm64.tar.gz`,
    sha256: 'f8bd47e7ea866863489cad588fbaf2f31f42e5821f7a03f009b3769f05801cb1',
    exe: 'pmtiles',
  },
};

const ROOT = process.cwd();
const TOOLS_DIR = join(ROOT, 'araclar');
const MAP_DIR = join(ROOT, 'harita');
const FONTS_DIR = join(ROOT, 'public', 'harita', 'yazi');
const SPRITES_DIR = join(ROOT, 'public', 'harita', 'simge');
const UA = { 'User-Agent': 'ServisTakip-harita-indir/0.1' };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function download(url: string): Promise<Buffer | null> {
  const response = await fetch(url, { headers: UA });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function ensureTool(): Promise<string> {
  const tool = TOOL[`${process.platform}-${process.arch}`];
  if (!tool) throw new Error(`Bu platform için pmtiles aracı tanımlı değil: ${process.platform}-${process.arch}`);
  const exe = join(TOOLS_DIR, tool.exe);
  if (existsSync(exe)) return exe;
  mkdirSync(TOOLS_DIR, { recursive: true });
  const url = `https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/${tool.file}`;
  console.log(`pmtiles aracı indiriliyor: ${url}`);
  const archive = await download(url);
  if (!archive) throw new Error('pmtiles aracı bulunamadı');
  const digest = createHash('sha256').update(archive).digest('hex');
  if (digest !== tool.sha256) throw new Error(`pmtiles özeti tutmuyor: ${digest}`);
  const archivePath = join(TOOLS_DIR, tool.file);
  writeFileSync(archivePath, archive);
  // Windows 10+ ve Linux'taki tar, zip ve tar.gz açar.
  execFileSync('tar', ['-xf', archivePath, '-C', TOOLS_DIR], { stdio: 'inherit' });
  rmSync(archivePath);
  if (!existsSync(exe)) throw new Error('pmtiles arşivden çıkmadı');
  return exe;
}

async function latestBuild(): Promise<string> {
  const response = await fetch(BUILDS_URL, { headers: UA });
  if (!response.ok) throw new Error(`builds.json ${response.status}`);
  const builds = (await response.json()) as Array<{ key: string }>;
  const keys = builds.map((b) => b.key).filter((k) => /^\d{8}\.pmtiles$/.test(k)).sort();
  const last = keys.at(-1);
  if (!last) throw new Error('builds.json içinde derleme yok');
  return last.slice(0, 8);
}

async function downloadAssets(): Promise<void> {
  let fetched = 0;
  let missing = 0;
  for (const stack of MAP_FONTSTACKS) {
    const dir = join(FONTS_DIR, stack);
    mkdirSync(dir, { recursive: true });
    const ranges = Array.from({ length: 256 }, (_, i) => `${i * 256}-${i * 256 + 255}`);
    // 8'er 8'er: GitHub'a aynı anda çok istek atılmaz.
    for (let i = 0; i < ranges.length; i += 8) {
      await Promise.all(
        ranges.slice(i, i + 8).map(async (range) => {
          const target = join(dir, `${range}.pbf`);
          if (existsSync(target)) return;
          const data = await download(`${ASSETS_BASE}/fonts/${encodeURIComponent(stack)}/${range}.pbf`);
          if (!data) {
            missing += 1;
            return;
          }
          await writeFile(target, data);
          fetched += 1;
        }),
      );
    }
  }
  const license = await download(`${ASSETS_BASE}/fonts/OFL.txt`);
  if (license) await writeFile(join(FONTS_DIR, 'OFL.txt'), license);
  mkdirSync(SPRITES_DIR, { recursive: true });
  for (const theme of MAP_SPRITES) {
    for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) {
      const data = await download(`${ASSETS_BASE}/sprites/v4/${theme}${suffix}`);
      if (!data) throw new Error(`simge dosyası yok: ${theme}${suffix}`);
      await writeFile(join(SPRITES_DIR, `${theme}${suffix}`), data);
    }
  }
  console.log(`Yazı tipi: ${fetched} dosya indirildi, ${missing} aralık kaynakta yok (normal).`);
}

async function main(): Promise<void> {
  const exe = await ensureTool();
  const version = arg('surum') ?? (await latestBuild());
  if (!/^\d{8}$/.test(version)) throw new Error('--surum YYYYMMDD olmalı');
  const maxzoom = arg('maxzoom');
  if (maxzoom !== undefined && !/^\d{1,2}$/.test(maxzoom)) throw new Error('--maxzoom sayı olmalı');

  mkdirSync(MAP_DIR, { recursive: true });
  const file = `turkiye-${version}.pmtiles`;
  const target = join(MAP_DIR, file);
  const source = `${BUILD_BASE}/${version}.pmtiles`;
  // Yarım kalan indirme asıl adı almaz; uzantı .pmtiles kalır (araç biçimi uzantıdan da anlar).
  const partial = join(MAP_DIR, `turkiye-${version}.yarim.pmtiles`);
  if (!existsSync(target)) {
    console.log(`Türkiye kesiti çıkarılıyor (${source}); bu birkaç dakika sürebilir…`);
    const args = ['extract', source, partial, `--bbox=${BBOX}`];
    if (maxzoom) args.push(`--maxzoom=${maxzoom}`);
    execFileSync(exe, args, { stdio: 'inherit' });
    execFileSync(exe, ['show', partial], { stdio: 'ignore' }); // dosya okunabiliyor mu
    renameSync(partial, target);
  }

  await downloadAssets();

  const info: MapVersionFile = {
    surum: version,
    dosya: file,
    kaynak: source,
    bbox: BBOX,
    maxzoom: maxzoom ? Number(maxzoom) : null,
    boyut: statSync(target).size,
    indirildi: new Date().toISOString(),
  };
  writeFileSync(join(MAP_DIR, 'surum.json'), JSON.stringify(info, null, 2));

  const store = await openTileStore(MAP_DIR);
  if (!store || store.contentType !== 'application/x-protobuf') throw new Error('İndirilen harita açılamadı');
  for (const old of readdirSync(MAP_DIR)) {
    if (/^turkiye-\d{8}\.pmtiles$/.test(old) && old !== file) rmSync(join(MAP_DIR, old));
  }
  const gb = (info.boyut / 1024 ** 3).toFixed(2);
  console.log(`Hazır: ${file} (${gb} GB, yakınlaştırma ${store.minZoom}-${store.maxZoom}).`);
  console.log('Çalışan sunucuyu yeniden başlatın: harita dosyası sunucu açılırken okunur.');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : 'harita indirilemedi');
  process.exit(1);
});
```

`package.json` → `scripts`:

```json
"harita:indir": "tsx scripts/harita-indir.ts"
```

- [ ] **Adım 4: Çalıştır ve ölç** (Adım 1'deki onaydan sonra)

```bash
npm run harita:indir
```

Expected: `Hazır: turkiye-YYYYMMDD.pmtiles (X GB, yakınlaştırma 0-15)`. Boyutu not et. **2 GB'ı aşarsa** dur ve sahibe sor: "Harita X GB çıktı. En yakın sokak ölçeğini bir kademe düşürürsek (`--maxzoom 14`) yaklaşık yarıya iner; bina numaraları biraz daha geç görünür. Küçültelim mi?"

Yeniden çalıştırma: aynı sürüm varsa çıkarma atlanır, yalnızca eksik yazı tipleri iner.

- [ ] **Adım 5: Çalışma zamanında dene**

Sunucuyu yeniden başlat (PID'le durdur, `npm run dev`). Giriş yapmış tarayıcı oturumu olmadan doğrulamak için deneme firmasının bir oturumuyla:

```bash
node -e "fetch('http://localhost:3000/harita/simge/light.json').then(r=>console.log('simge',r.status))"
node -e "fetch('http://localhost:3000/harita/yazi/Noto%20Sans%20Regular/256-511.pbf').then(r=>console.log('yazi',r.status))"
```

Expected: `simge 200`, `yazi 200` (Türkçe harfler 256-511 aralığında). Parça için oturum gerekir; Görev 21'deki E2E ve sahibin denemesi doğrular.

- [ ] **Adım 6: Commit**

```bash
npm run format && npm run lint && npm run typecheck
git add scripts/harita-indir.ts package.json .gitignore
git commit -m "Harita: Türkiye kesiti, yazı tipi ve simge indirme betiği (özet doğrulamalı)"
```

---

### Görev 20: Konum seçici ekranı

> Ön koşul: sahip birinci yarıyı denedi ve geri bildirimini verdi (Görev 14, Adım 9); Görev 9'daki konum seçici yerleşimi onaylı.

**Files:**
- Create: `scripts/maplibre-worker.ts`, `src/lib/map-view.ts`, `src/server/geo/map-settings.ts`
- Create: `src/components/map/map-canvas.tsx`, `src/components/map/location-picker.tsx`
- Modify: `package.json` (`predev`, `prebuild`), `src/app/(uygulama)/musteriler/address-fields.tsx`, `address-form.tsx`, `yeni/new-customer-form.tsx`, `yeni/page.tsx`, `[id]/page.tsx`, `[id]/adresler/yeni/page.tsx`, `[id]/adresler/[adresId]/page.tsx`
- Test: `tests/unit/map-view.test.ts`

**Interfaces:**
- Consumes: `buildMapStyle`, `readMapColors` (Görev 18); `MapSettings`, `MAP_PATHS` (Görev 18); `getTileStore` (Görev 15); `getGeocoder` (Görev 17); `geocodeAddressAction`, `resolveLocationLinkAction` (Görev 17); `parseLocationInput`, `LOCATION_LINK_MESSAGES` (Görev 16); `findProvince`, `findDistrict`, `TURKEY_CENTER`, `isInTurkey`, `PickedLocation` (Görev 2)
- Produces:
  - `map-view.ts`: `startView(initial: PickedLocation | null, place: { province: string; district: string }): { center: GeoPoint; zoom: number }`, `formatCoordinate(n: number): string` ("41,00820")
  - `getMapSettings(): Promise<MapSettings>`
  - `MapCanvas` (varsayılan dışa aktarım; `{ settings, initialCenter, initialZoom, controls, onMove, onFail }`), `interface MapCanvasHandle { moveTo(center, zoom): void; zoomIn(): void; zoomOut(): void }`
  - `LocationPicker({ open, onOpenChange, initial, place, settings, geocode, resolveLink, onSave })`
  - `AddressFields` yeni özellikleri: `mapSettings: MapSettings`, `openPickerOnMount?: boolean`, `remindIfMoved?: boolean`

- [ ] **Adım 1: Başlangıç görünümü testi**

`tests/unit/map-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TURKEY_CENTER } from '@/lib/geo';
import { formatCoordinate, startView } from '@/lib/map-view';
import { findDistrict, findProvince } from '@/lib/tr-il-ilce';

describe('konum seçicinin açılış görünümü', () => {
  it('kayıtlı iğne varsa oradan, yakın ölçekte', () => {
    expect(
      startView({ latitude: 41.0082, longitude: 28.9784, source: 'link' }, { province: 'Ankara', district: '' }),
    ).toEqual({ center: { lat: 41.0082, lng: 28.9784 }, zoom: 17 });
  });

  it('iğne yoksa ilçe merkezi, ilçe yoksa il merkezi, o da yoksa Türkiye', () => {
    const kadikoy = findDistrict('İstanbul', 'Kadıköy')!;
    const istanbul = findProvince('İstanbul')!;
    expect(startView(null, { province: 'İstanbul', district: 'Kadıköy' })).toEqual({
      center: { lat: kadikoy.lat, lng: kadikoy.lng },
      zoom: 13,
    });
    expect(startView(null, { province: 'İstanbul', district: '' })).toEqual({
      center: { lat: istanbul.lat, lng: istanbul.lng },
      zoom: 10,
    });
    expect(startView(null, { province: 'Atlantis', district: 'X' })).toEqual({ center: TURKEY_CENTER, zoom: 5 });
  });

  it('koordinat Türkçe ondalık virgülle, 5 basamak', () => {
    expect(formatCoordinate(41.0082)).toBe('41,00820');
    expect(formatCoordinate(-0.5)).toBe('-0,50000');
  });
});
```

Run: `npx vitest run --project unit tests/unit/map-view.test.ts` → FAIL (modül yok).

- [ ] **Adım 2: `src/lib/map-view.ts`**

```ts
import { TURKEY_CENTER, type GeoPoint, type PickedLocation } from './geo';
import { findDistrict, findProvince } from './tr-il-ilce';

/** Açılış: kayıtlı iğne → ilçe merkezi → il merkezi → Türkiye (tasarım §8.4). */
export function startView(
  initial: PickedLocation | null,
  place: { province: string; district: string },
): { center: GeoPoint; zoom: number } {
  if (initial) return { center: { lat: initial.latitude, lng: initial.longitude }, zoom: 17 };
  const province = findProvince(place.province);
  const district = province ? findDistrict(province.name, place.district) : undefined;
  if (district) return { center: { lat: district.lat, lng: district.lng }, zoom: 13 };
  if (province) return { center: { lat: province.lat, lng: province.lng }, zoom: 10 };
  return { center: TURKEY_CENTER, zoom: 5 };
}

const coordinate = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
  useGrouping: false,
});

export function formatCoordinate(n: number): string {
  return coordinate.format(n);
}
```

Run: aynı komut → PASS.

- [ ] **Adım 3: MapLibre işçi dosyaları**

`scripts/maplibre-worker.ts`:

```ts
import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// MapLibre 6 paketleyicide işçi adresini kendisi bulamaz (setWorkerUrl). İşçi, yanındaki "shared" dosyasını göreli
// yolla içe aktardığı için ikisi birlikte kopyalanır. Tarayıcı işçiyi bizim sunucumuzdan alır (dış CDN yok).
const SOURCE = join(process.cwd(), 'node_modules', 'maplibre-gl', 'dist');
const TARGET = join(process.cwd(), 'public', 'maplibre');
mkdirSync(TARGET, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(SOURCE, file), join(TARGET, file));
}
console.log('MapLibre işçi dosyaları public/maplibre/ klasörüne kopyalandı.');
```

`package.json` → `scripts`:

```json
"predev": "tsx scripts/maplibre-worker.ts",
"prebuild": "tsx scripts/maplibre-worker.ts",
```

Run: `npx tsx scripts/maplibre-worker.ts && ls public/maplibre`
Expected: iki `.mjs` dosyası. Dosya adları paket sürümünde farklıysa (`ls node_modules/maplibre-gl/dist`) betiği ve `setWorkerUrl` adresini ona göre düzelt.

- [ ] **Adım 4: Sunucunun harita ayarı**

`src/server/geo/map-settings.ts`:

```ts
import type { MapSettings } from '@/lib/map-assets';
import { getGeocoder } from './geocoder';
import { getTileStore } from './tiles';

/** Harita dosyası yoksa ekran "harita açılamıyor" der; GEOCODER_URL yoksa "Adresi haritada bul" görünmez. */
export async function getMapSettings(): Promise<MapSettings> {
  const store = await getTileStore();
  return {
    map: store ? { version: store.version, maxZoom: store.maxZoom } : null,
    geocodeEnabled: getGeocoder() !== null,
  };
}
```

- [ ] **Adım 5: Harita tuvali**

`src/components/map/map-canvas.tsx`:

```tsx
'use client';

import { Map as MapLibreMap, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, type RefObject } from 'react';
import type { GeoPoint } from '@/lib/geo';
import { buildMapStyle, readMapColors } from './map-style';

setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

export interface MapCanvasHandle {
  moveTo(center: GeoPoint, zoom: number): void;
  zoomIn(): void;
  zoomOut(): void;
}

export interface MapCanvasProps {
  settings: { version: string; maxZoom: number };
  initialCenter: GeoPoint;
  initialZoom: number;
  /** Üst bileşen haritayı bu tutamaçla yönetir (ref yerine düz özellik: dinamik yüklemede de çalışır). */
  controls: RefObject<MapCanvasHandle | null>;
  /** byUser: kişi kaydırdı (fare, dokunma, klavye); false: biz taşıdık (bağlantı, adres bulma). */
  onMove: (center: GeoPoint, byUser: boolean) => void;
  /** webgl: cihaz haritayı çizemez; load: kod ya da dosya yüklenemedi. */
  onFail: (reason: 'webgl' | 'load') => void;
}

const LOCALE = {
  'Map.Title': 'Harita. Ok tuşlarıyla kaydırın, artı ve eksi tuşlarıyla yakınlaştırın.',
  'AttributionControl.ToggleAttribution': 'Harita kaynaklarını göster',
};

const LOAD_TIMEOUT_MS = 15_000;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Yalnızca tarayıcıda, dinamik olarak yüklenir (MapLibre büyük; liste ekranları bu kodu indirmez). */
export default function MapCanvas({
  settings,
  initialCenter,
  initialZoom,
  controls,
  onMove,
  onFail,
}: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef({ onMove, onFail, initialCenter, initialZoom });
  useEffect(() => {
    latest.current = { onMove, onFail, initialCenter, initialZoom };
  });

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    if (!document.createElement('canvas').getContext('webgl2')) {
      latest.current.onFail('webgl');
      return;
    }
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    const style = () =>
      buildMapStyle({
        origin: window.location.origin,
        version: settings.version,
        maxZoom: settings.maxZoom,
        theme: scheme.matches ? 'dark' : 'light',
        colors: readMapColors(),
      });
    const { initialCenter: center, initialZoom: zoom } = latest.current;
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: el,
        style: style(),
        center: [center.lng, center.lat],
        zoom,
        minZoom: 4,
        maxZoom: 19,
        maxBounds: [
          [23.5, 34.0],
          [47.0, 43.8],
        ],
        locale: LOCALE,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch {
      latest.current.onFail('load');
      return;
    }
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    // Dosya ya da işçi yüklenemezse "load" hiç gelmez: süre dolunca harita kapalı sayılır, bağlantı alanı çalışır.
    const timer = setTimeout(() => latest.current.onFail('load'), LOAD_TIMEOUT_MS);
    map.once('load', () => clearTimeout(timer));
    map.on('moveend', (event) => {
      const c = map.getCenter();
      latest.current.onMove({ lat: c.lat, lng: c.lng }, 'originalEvent' in event && Boolean(event.originalEvent));
    });
    const onScheme = () => map.setStyle(style());
    scheme.addEventListener('change', onScheme);
    controls.current = {
      moveTo(target, targetZoom) {
        const options = { center: [target.lng, target.lat] as [number, number], zoom: targetZoom };
        if (reducedMotion()) map.jumpTo(options);
        else map.flyTo({ ...options, duration: 600 });
      },
      zoomIn: () => map.zoomIn({ animate: !reducedMotion() }),
      zoomOut: () => map.zoomOut({ animate: !reducedMotion() }),
    };
    return () => {
      clearTimeout(timer);
      scheme.removeEventListener('change', onScheme);
      controls.current = null;
      map.remove();
    };
  }, [settings.version, settings.maxZoom, controls]);

  return <div ref={container} className="absolute inset-0" />;
}
```

> `event.originalEvent` MapLibre 6'da olay sınıflarında bulunur; tür hatası verirse `(event as { originalEvent?: unknown }).originalEvent` kullan.

- [ ] **Adım 6: Konum seçici**

`src/components/map/location-picker.tsx`:

```tsx
'use client';

import { Crosshair, MapPin, Minus, Plus, Search, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Dialog } from 'radix-ui';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Spinner } from '@/components/ui/spinner';
import { TextField } from '@/components/ui/text-field';
import { isInTurkey, type GeoPoint, type LocationSource, type PickedLocation } from '@/lib/geo';
import { LOCATION_LINK_MESSAGES, parseLocationInput } from '@/lib/location-link';
import type { MapSettings } from '@/lib/map-assets';
import { formatCoordinate, startView } from '@/lib/map-view';
import type { ActionResult } from '@/server/action-result';
import type { GeocodeResult } from '@/server/geo/geocoder';
import type { MapCanvasHandle, MapCanvasProps } from './map-canvas';

type LinkResult = ActionResult<{
  latitude: number;
  longitude: number;
  inTurkey: boolean;
  swappedInTurkey: boolean;
}>;

interface Place {
  province: string;
  district: string;
  neighborhood: string;
  addressLine: string;
}

export interface LocationPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: PickedLocation | null;
  place: Place;
  settings: MapSettings;
  geocode: (place: Place) => Promise<ActionResult<GeocodeResult[]>>;
  resolveLink: (text: string) => Promise<LinkResult>;
  onSave: (location: PickedLocation) => void;
}

/** Harita kodu indirilemezse (bağlantı koptu, dosya engellendi): harita kapalı sayılır, bağlantı alanı çalışır. */
function MapUnavailable({ onFail }: MapCanvasProps) {
  useEffect(() => onFail('load'), [onFail]);
  return null;
}

const MapCanvas = dynamic<MapCanvasProps>(
  () => import('./map-canvas').catch(() => ({ default: MapUnavailable })),
  {
    ssr: false,
    loading: () => <div className="absolute inset-0 animate-pulse bg-surface-muted" aria-hidden="true" />,
  },
);

/**
 * Telefonda tam ekran, geniş ekranda büyük pencere. İğne ortada sabit, harita altında kaydırılır.
 * Telefonun geri tuşu yalnızca bu pencereyi kapatır (geçmişe bir adım eklenir), formu kaybettirmez.
 */
export function LocationPicker(props: LocationPickerProps) {
  const { open, onOpenChange } = props;

  useEffect(() => {
    if (!open) return;
    // Next.js yerel History API'sini destekler: eklenen adım yönlendirici durumuyla birlikte tutulur.
    window.history.pushState({ konumSecici: true }, '');
    const onPop = () => onOpenChange(false);
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if ((window.history.state as { konumSecici?: boolean } | null)?.konumSecici) window.history.back();
    };
  }, [open, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-band/70" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col bg-surface sm:inset-6 sm:rounded-card sm:shadow-card lg:inset-x-0 lg:inset-y-10 lg:mx-auto lg:max-w-4xl">
          {/* İçerik her açılışta baştan kurulur: önceki denemenin durumu kalmaz. */}
          <PickerBody {...props} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PickerBody({ initial, place, settings, geocode, resolveLink, onSave, onOpenChange }: LocationPickerProps) {
  const start = startView(initial, place);
  const controls = useRef<MapCanvasHandle | null>(null);
  const [center, setCenter] = useState<GeoPoint>(start.center);
  const [source, setSource] = useState<LocationSource>(initial?.source ?? 'manual');
  const [mapFailure, setMapFailure] = useState<'webgl' | 'load' | null>(settings.map === null ? 'load' : null);
  // Kayıtlı iğne yoksa kullanıcı haritayı oynatmadan ya da bağlantı vermeden kaydedemez: ilçe merkezi yanlışlıkla
  // müşterinin konumu olmasın.
  const [hasPoint, setHasPoint] = useState(initial !== null);
  const [linkText, setLinkText] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [outside, setOutside] = useState<{ point: GeoPoint; source: LocationSource; swapped: boolean } | null>(
    null,
  );
  const [confirmSave, setConfirmSave] = useState(false);
  const [pending, startTransition] = useTransition();

  const apply = (point: GeoPoint, from: LocationSource) => {
    setCenter(point);
    setSource(from);
    setHasPoint(true);
    setOutside(null);
    setConfirmSave(false);
    controls.current?.moveTo(point, 17);
  };

  const offer = (point: GeoPoint, from: LocationSource, inTurkey: boolean, swapped: boolean) => {
    if (inTurkey) apply(point, from);
    else setOutside({ point, source: from, swapped });
  };

  const readLink = () =>
    startTransition(async () => {
      setMessage(null);
      setResults([]);
      const parsed = parseLocationInput(linkText);
      if (parsed.kind === 'location') {
        offer(parsed.point, 'link', parsed.inTurkey, parsed.swappedInTurkey);
        return;
      }
      if (parsed.kind !== 'google_short') {
        setMessage({ tone: 'error', text: LOCATION_LINK_MESSAGES.unreadable });
        return;
      }
      const result = await resolveLink(linkText);
      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error.message });
        return;
      }
      const d = result.data;
      offer({ lat: d.latitude, lng: d.longitude }, 'link', d.inTurkey, d.swappedInTurkey);
    });

  const findAddress = () =>
    startTransition(async () => {
      setMessage(null);
      setOutside(null);
      const result = await geocode(place);
      if (!result.ok) {
        setResults([]);
        setMessage({ tone: 'error', text: result.error.message });
        return;
      }
      if (result.data.length === 1) {
        const only = result.data[0]!;
        setResults([]);
        apply({ lat: only.latitude, lng: only.longitude }, 'geocode');
        setMessage({ tone: 'info', text: 'Adres bulundu. İğnenin doğru yerde olduğunu kontrol edin.' });
      } else {
        setResults(result.data);
      }
    });

  const save = () => {
    if (!isInTurkey(center) && !confirmSave) {
      setConfirmSave(true);
      return;
    }
    onSave({ latitude: center.lat, longitude: center.lng, source });
    onOpenChange(false);
  };

  const canGeocode = settings.geocodeEnabled && place.province !== '';
  const busy = pending ? true : undefined;

  return (
    <>
      <div className="flex items-start justify-between gap-3 border-b-2 border-border p-4">
        <div className="min-w-0">
          <Dialog.Title className="type-display text-2xl text-fg">Konumu işaretle</Dialog.Title>
          <Dialog.Description className="text-base text-fg-muted">
            Haritayı kaydırın; iğne ortadaki noktayı gösterir.
          </Dialog.Description>
        </div>
        <Dialog.Close asChild>
          <Button variant="ghost" className="size-12 shrink-0 p-0" aria-label="Kapat">
            <X className="size-6" aria-hidden="true" />
          </Button>
        </Dialog.Close>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col gap-3 p-4">
          {canGeocode && (
            <div>
              <Button variant="secondary" onClick={findAddress} disabled={pending} aria-busy={busy}>
                {pending ? <Spinner /> : <Search className="size-5" aria-hidden="true" />}
                Adresi haritada bul
              </Button>
            </div>
          )}
          {results.length > 0 && (
            <ul aria-label="Bulunan adresler" className="flex flex-col gap-2">
              {results.map((r) => (
                <li key={`${r.latitude},${r.longitude}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setResults([]);
                      apply({ lat: r.latitude, lng: r.longitude }, 'geocode');
                    }}
                    className="flex min-h-12 w-full items-center gap-2 rounded-control border-2 border-border-strong px-3 py-2 text-left text-base text-fg hover:bg-surface-muted"
                  >
                    <MapPin className="size-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 break-words">{r.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-start"
            onSubmit={(e) => {
              e.preventDefault();
              readLink();
            }}
          >
            <TextField
              className="min-w-0 flex-1"
              label="Konum bağlantısı ya da koordinat"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
              hint="WhatsApp'tan gelen Google Haritalar bağlantısını ya da 41.0082, 28.9784 gibi koordinatı yapıştırın."
            />
            <Button type="submit" variant="secondary" disabled={pending || linkText.trim() === ''} className="sm:mt-7">
              <Crosshair className="size-5" aria-hidden="true" />
              Konumu al
            </Button>
          </form>
          {message && !pending && <Notice tone={message.tone}>{message.text}</Notice>}
          {outside && (
            <Notice tone="warning" title={LOCATION_LINK_MESSAGES.outside}>
              {outside.swapped && <p>{LOCATION_LINK_MESSAGES.swapped}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {outside.swapped && (
                  <Button
                    variant="secondary"
                    onClick={() => apply({ lat: outside.point.lng, lng: outside.point.lat }, outside.source)}
                  >
                    Yerlerini değiştir
                  </Button>
                )}
                <Button variant="secondary" onClick={() => apply(outside.point, outside.source)}>
                  Evet, kullan
                </Button>
                <Button variant="ghost" onClick={() => setOutside(null)}>
                  Hayır
                </Button>
              </div>
            </Notice>
          )}
        </div>

        <div className="relative min-h-80 flex-1 border-y-2 border-border">
          {mapFailure ? (
            <div className="p-4">
              <Notice tone="warning">
                {mapFailure === 'webgl'
                  ? 'Bu cihazda harita açılamıyor. Konum bağlantısı yapıştırarak ekleyebilirsiniz.'
                  : 'Harita şu an açılamıyor. Konum bağlantısı yapıştırarak ekleyebilirsiniz.'}
              </Notice>
            </div>
          ) : (
            <>
              <MapCanvas
                settings={settings.map!}
                initialCenter={start.center}
                initialZoom={start.zoom}
                controls={controls}
                onMove={(point, byUser) => {
                  setCenter(point);
                  setHasPoint(true);
                  if (byUser) {
                    setSource('manual');
                    setConfirmSave(false);
                  }
                }}
                onFail={setMapFailure}
              />
              <MapPin
                className="pointer-events-none absolute top-1/2 left-1/2 size-10 -translate-x-1/2 -translate-y-full fill-danger text-danger-fg"
                aria-hidden="true"
              />
              <div className="absolute top-3 right-3 flex flex-col gap-2">
                <Button variant="secondary" className="size-12 p-0" aria-label="Yakınlaştır" onClick={() => controls.current?.zoomIn()}>
                  <Plus className="size-6" aria-hidden="true" />
                </Button>
                <Button variant="secondary" className="size-12 p-0" aria-label="Uzaklaştır" onClick={() => controls.current?.zoomOut()}>
                  <Minus className="size-6" aria-hidden="true" />
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p aria-live="polite" className="text-sm text-fg-muted tabular-nums">
          {hasPoint
            ? `İğnenin yeri: ${formatCoordinate(center.lat)} · ${formatCoordinate(center.lng)}`
            : 'Haritayı kaydırarak iğneyi müşterinin kapısına getirin.'}
        </p>
        {confirmSave && (
          <Notice tone="warning">
            {LOCATION_LINK_MESSAGES.outside} Kullanmak için "Bu konumu kaydet" düğmesine yeniden dokunun.
          </Notice>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Dialog.Close asChild>
            <Button variant="secondary">Vazgeç</Button>
          </Dialog.Close>
          <Button onClick={save} disabled={!hasPoint}>
            <MapPin className="size-5" aria-hidden="true" />
            Bu konumu kaydet
          </Button>
        </div>
      </div>
    </>
  );
}
```

> `fill-danger`/`text-danger-fg` Tailwind'in `fill-*` yardımcısıyla token rengini kullanır (renk kodu yok). İğne her iki temada da haritadan ayrışmalı: Görev 21'deki ekran görüntülerinde kontrol edilir; zayıfsa token değil `--map-*` tonları ayarlanır.


- [ ] **Adım 7: Adres alanlarına bağla**

`src/app/(uygulama)/musteriler/address-fields.tsx` değişiklikleri:

1. İçe aktarmalar: `MapPin` (lucide), `Button`, `Notice`, `LocationPicker` (`@/components/map/location-picker`), `type MapSettings` (`@/lib/map-assets`), `geocodeAddressAction`, `resolveLocationLinkAction` (`./konum-actions`).
2. Özellikler:

```tsx
export function AddressFields({
  initial,
  errors,
  mapSettings,
  openPickerOnMount = false,
  remindIfMoved = false,
}: {
  initial: AddressValues;
  errors?: Readonly<Record<string, string>>;
  mapSettings: MapSettings;
  /** Müşteri sayfasındaki "Konumu işaretle" bağlantısı (?konum=ac). */
  openPickerOnMount?: boolean;
  /** Düzenlemede: adres değişti, iğne değişmedi → hatırlatma. */
  remindIfMoved?: boolean;
}) {
  const [values, setValues] = useState(initial);
  const [pickerOpen, setPickerOpen] = useState(openPickerOnMount);
  const [locationChecked, setLocationChecked] = useState(false);
  // … mevcut gövde
```

3. "Konum" bölümünü şununla değiştir:

```tsx
      <div className="flex flex-col gap-2">
        <p className={labelClass}>Konum</p>
        <div>
          <LocationStatus located={values.location !== null} />
        </div>
        {locationError && <p className="text-sm font-medium text-danger">{locationError}</p>}
        {showReminder && (
          <Notice tone="warning" title="Adresi değiştirdiniz. İğne hâlâ doğru yerde mi?">
            <Button variant="secondary" className="mt-2" onClick={() => setPickerOpen(true)}>
              Konumu kontrol et
            </Button>
          </Notice>
        )}
        <div>
          <Button variant="secondary" onClick={() => setPickerOpen(true)}>
            <MapPin className="size-5" aria-hidden="true" />
            {values.location ? 'Konumu düzelt' : 'Konumu işaretle'}
          </Button>
        </div>
        {!values.location && (
          <p className="text-sm text-fg-muted">
            İşaretlemeden de kaydedebilirsiniz; iş atanırken yeniden hatırlatılır.
          </p>
        )}
      </div>
      <LocationPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initial={values.location}
        place={{
          province: values.province,
          district: values.district,
          neighborhood: values.neighborhood,
          addressLine: values.addressLine,
        }}
        settings={mapSettings}
        geocode={geocodeAddressAction}
        resolveLink={resolveLocationLinkAction}
        onSave={(location) => {
          set({ location });
          setLocationChecked(true);
        }}
      />
```

ve gövdenin başında (dönüşten önce):

```tsx
  const addressMoved =
    values.province !== initial.province ||
    values.district !== initial.district ||
    values.neighborhood !== initial.neighborhood ||
    values.addressLine !== initial.addressLine;
  const showReminder = remindIfMoved && initial.location !== null && addressMoved && !locationChecked;
```

4. Bileşenin üstündeki açıklama yorumundan "konum seçici Görev 20'de eklenir" kısmını sil.

`setPickerOpen` doğrudan `onOpenChange`'e verilir (kararlı işlev): `LocationPicker`'daki geçmiş etkisi her çizimde yeniden çalışmaz.

- [ ] **Adım 8: Formlara ve sayfalara ayarı geçir**

- `address-form.tsx`: `AddressFormProps`'a `mapSettings: MapSettings; openPicker?: boolean` ekle; `<AddressFields … mapSettings={mapSettings} openPickerOnMount={openPicker} remindIfMoved={values.version > 0} />`.
- `yeni/new-customer-form.tsx`: `NewCustomerFormProps`'a `mapSettings: MapSettings` ekle; `<AddressFields … mapSettings={mapSettings} />`.
- `yeni/page.tsx`, `[id]/adresler/yeni/page.tsx`: `const mapSettings = await getMapSettings();` (`@/server/geo/map-settings`) ve forma geçir.
- `[id]/adresler/[adresId]/page.tsx`: `searchParams: Promise<{ konum?: string | string[] }>` al; `openPicker={(await searchParams).konum === 'ac'}` ve `mapSettings` geçir.
- `[id]/page.tsx` (müşteri sayfası): konumsuz adreste, `canManage` ise `LocationStatus`'un yanına bağlantı:

```tsx
                    {canManage && a.latitude === null && (
                      <Link href={`${base}/adresler/${a.id}?konum=ac`} className={smallLink}>
                        <MapPin className="size-4" aria-hidden="true" />
                        Konumu işaretle
                      </Link>
                    )}
```

(`MapPin`'i lucide içe aktarmasına ekle.)

- [ ] **Adım 9: Doğrulama**

```bash
npm run format && npm run lint && npm run typecheck && npx vitest run --project unit && npm run build
```

Expected: hepsi temiz. `npm run build` çıktısında müşteri sayfalarının ilk yük boyutu MapLibre kadar büyümemeli (dinamik yükleme): `/musteriler/[id]/adresler/[adresId]` "First Load JS" değeri Görev 13'tekine yakın olmalı; MapLibre ayrı parça olarak yüklenir.

Çalışma zamanı: geliştirme sunucusunu yeniden başlat (paketler ve `predev`). Harita dosyası indirildiyse (Görev 19) sahibe tarayıcıda denemesini önermeden önce sor; E2E (Görev 21) görünmez tarayıcıda dener.

- [ ] **Adım 10: Commit**

```bash
git add scripts/maplibre-worker.ts package.json src/lib/map-view.ts src/server/geo/map-settings.ts src/components/map "src/app/(uygulama)/musteriler" tests/unit/map-view.test.ts
git commit -m "Konum: harita üzerinde iğneyle konum seçici, bağlantı ve adres bulma"
```

---

### Görev 21: İkinci yarının E2E testleri (konum seçici, harita parçası)

**Files:**
- Create: `tests/e2e/sahte-nominatim.mjs`, `tests/e2e/konum.spec.ts`
- Modify: `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/erisilebilirlik.spec.ts`, `tests/e2e/ekran-goruntuleri.spec.ts`

**Interfaces:**
- Consumes: `writePmtilesFixture` (Görev 15), ekranlar (Görev 20), `record` (Görev 14)
- Produces: E2E kaydı `konum` (Konum Deneme, `0532 777 66 55`, adressiz); deneme haritası `tests/e2e/.harita` (sürüm `20261007`, parçasız: her parça 204); sahte Nominatim `127.0.0.1:3101`

- [ ] **Adım 1: Sahte Nominatim**

`tests/e2e/sahte-nominatim.mjs`:

```js
import { createServer } from 'node:http';

// E2E gerçek Nominatim'e gitmez: adres metnine göre sabit yanıt verir.
const PORT = Number(process.env.SAHTE_NOMINATIM_PORT ?? 3101);
const PLACES = [
  {
    match: /moda/i,
    results: [
      { lat: '40.9862', lon: '29.0253', display_name: 'Moda Caddesi, Caferağa, Kadıköy, İstanbul, Türkiye' },
      { lat: '40.9851', lon: '29.0268', display_name: 'Moda Sahili, Caferağa, Kadıköy, İstanbul, Türkiye' },
    ],
  },
  {
    match: /bahariye/i,
    results: [{ lat: '40.9888', lon: '29.0300', display_name: 'Bahariye Caddesi, Kadıköy, İstanbul, Türkiye' }],
  },
];

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname === '/saglik') {
    res.end('ok');
    return;
  }
  if (url.pathname !== '/search') {
    res.statusCode = 404;
    res.end();
    return;
  }
  const q = url.searchParams.get('q') ?? '';
  const hit = PLACES.find((p) => p.match.test(q));
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(hit ? hit.results : []));
}).listen(PORT, '127.0.0.1');
```

- [ ] **Adım 2: Playwright ayarı**

`playwright.config.ts`:
- `use` içine (WebGL2'yi görünmez Chromium'da yazılımla çizer; Chrome 137+ ikinci bayrağı ister):

```ts
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
```

- `webServer`'ı diziye çevir:

```ts
  webServer: [
    {
      command: 'node tests/e2e/sahte-nominatim.mjs',
      url: 'http://127.0.0.1:3101/saglik',
      reuseExistingServer: false,
    },
    {
      // Üretim derlemesi: geliştirme sunucusundan farklı davranışları da yakalar (secure çerez, önbellek).
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/giris`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        DATABASE_URL: process.env.TEST_DATABASE_URL ?? '',
        GEOCODER_URL: 'http://127.0.0.1:3101',
        HARITA_KLASORU: 'tests/e2e/.harita',
      },
    },
  ],
```

- [ ] **Adım 3: Kurulum: deneme haritası ve müşteri**

`tests/e2e/global-setup.ts`:
- İçe aktar: `import { rmSync } from 'node:fs';` (mevcut `writeFileSync` satırına ekle) ve `import { writePmtilesFixture } from '../helpers/pmtiles';`
- `CUSTOMERS.a` listesine ekle: `{ key: 'konum', name: 'Konum Deneme', number: '0532 777 66 55' }`
- `globalSetup()`'ın başına (veritabanı sıfırlamasından sonra):

```ts
  // Parçasız deneme haritası: her parça 204 döner, MapLibre boş harita çizer (gerçek ~1 GB dosya gerekmez).
  rmSync('tests/e2e/.harita', { recursive: true, force: true });
  writePmtilesFixture('tests/e2e/.harita', { version: '20261007', minZoom: 0, maxZoom: 15, tiles: [] });
```

> Playwright `webServer`'ı `globalSetup`'tan önce açar. Sorun değil: sunucu harita dosyasını ve `surum.json`'ı ilk harita isteğinde okur, o sırada kurulum bitmiştir. `getTileStore`/`getMapSettings` dosya yokken `null`'ı kalıcı önbelleğe alıyorsa (Görev 15/20'deki koda bak) ilk isteğe kadar okuma yapılmadığını doğrula.

- [ ] **Adım 4: Konum testleri**

`tests/e2e/konum.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';
import { account, accounts, loginAs, record } from './hesaplar';

/** "Konum Deneme" müşterisine yeni adres formu; il/ilçe/açık adres dolu, konum seçici açık. */
async function openPicker(page: Page, addressLine = 'Moda Cad. No: 20') {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'operator'));
  await page.goto(`/musteriler/${record(a, 'konum')}/adresler/yeni`);
  await page.getByLabel('İl', { exact: true }).selectOption('İstanbul');
  await page.getByLabel('İlçe', { exact: true }).selectOption('Kadıköy');
  await page.getByLabel('Açık adres').fill(addressLine);
  await page.getByRole('button', { name: 'Konumu işaretle' }).click();
  const dialog = page.getByRole('dialog', { name: 'Konumu işaretle' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('görünmez tarayıcıda WebGL2 var (harita testlerinin ön koşulu)', async ({ page }) => {
  await page.goto('/giris');
  expect(await page.evaluate(() => Boolean(document.createElement('canvas').getContext('webgl2')))).toBe(true);
});

test('harita parçası yalnızca oturumla: oturumsuz 401, oturumlu 204 (boş deneme haritası)', async ({
  page,
}) => {
  const { a } = accounts();
  expect((await page.request.get('/harita/parca/20261007/0/0/0')).status()).toBe(401);
  await loginAs(page, a, account(a, 'teknisyen'));
  expect((await page.request.get('/harita/parca/20261007/0/0/0')).status()).toBe(204);
  expect((await page.request.get('/harita/parca/20261007/1/5/0')).status()).toBe(400);
});

test('koordinat yapıştırılarak konum işaretlenir ve adresle birlikte kaydedilir', async ({ page }) => {
  const dialog = await openPicker(page);
  await dialog.getByLabel('Konum bağlantısı ya da koordinat').fill('40.9862, 29.0253');
  await dialog.getByRole('button', { name: 'Konumu al' }).click();
  await expect(dialog.getByText('İğnenin yeri: 40,98620 · 29,02530')).toBeVisible();
  await dialog.getByRole('button', { name: 'Bu konumu kaydet' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Konum işaretli')).toBeVisible();
  await page.getByRole('button', { name: 'Adresi kaydet' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Konum Deneme' })).toBeVisible();
  await expect(page.getByText('Moda Cad. No: 20, Kadıköy / İstanbul')).toBeVisible();
});

test('harita klavyeyle kaydırılınca iğnenin yeri değişir ve kaydedilir', async ({ page }) => {
  const dialog = await openPicker(page, 'Kaydırma Sok. 1');
  await expect(dialog.getByText('Haritayı kaydırarak iğneyi müşterinin kapısına getirin.')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Bu konumu kaydet' })).toBeDisabled();
  const canvas = dialog.locator('canvas.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowUp');
  await expect(dialog.getByText(/^İğnenin yeri: /)).toBeVisible();
  await dialog.getByRole('button', { name: 'Bu konumu kaydet' }).click();
  await expect(page.getByText('Konum işaretli')).toBeVisible();
});

test('"Adresi haritada bul": birden çok sonuçtan biri seçilir', async ({ page }) => {
  const dialog = await openPicker(page);
  await dialog.getByRole('button', { name: 'Adresi haritada bul' }).click();
  const list = dialog.getByRole('list', { name: 'Bulunan adresler' });
  await list.getByRole('button', { name: /Moda Sahili/ }).click();
  await expect(dialog.getByText('İğnenin yeri: 40,98510 · 29,02680')).toBeVisible();
});

test('ters yazılmış koordinat uyarısı ve "Yerlerini değiştir"; okunamayan bağlantı mesajı', async ({
  page,
}) => {
  const dialog = await openPicker(page);
  const input = dialog.getByLabel('Konum bağlantısı ya da koordinat');
  await input.fill('29.0253, 40.9862');
  await dialog.getByRole('button', { name: 'Konumu al' }).click();
  await expect(dialog.getByText('Bu konum Türkiye dışında görünüyor. Yine de kullanılsın mı?')).toBeVisible();
  await expect(dialog.getByText('Enlem ve boylam yer değiştirmiş olabilir.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Yerlerini değiştir' }).click();
  await expect(dialog.getByText('İğnenin yeri: 40,98620 · 29,02530')).toBeVisible();

  await input.fill('https://maps.apple/p/AbC.dEf');
  await dialog.getByRole('button', { name: 'Konumu al' }).click();
  await expect(dialog.getByText(/Bu bağlantıdan konum okunamadı/)).toBeVisible();
});

test('telefonun geri tuşu yalnızca konum seçiciyi kapatır; yazılanlar kaybolmaz', async ({ page }) => {
  const dialog = await openPicker(page, 'Geri Tuşu Sok. 3');
  const url = page.url();
  await page.goBack();
  await expect(dialog).toBeHidden();
  expect(page.url()).toBe(url);
  await expect(page.getByLabel('Açık adres')).toHaveValue('Geri Tuşu Sok. 3');
});

test('harita kodu yüklenemezse uyarı çıkar; bağlantıyla yine işaretlenir', async ({ page }) => {
  await page.route('**/maplibre/**', (route) => route.abort());
  const dialog = await openPicker(page);
  await expect(
    dialog.getByText('Harita şu an açılamıyor. Konum bağlantısı yapıştırarak ekleyebilirsiniz.'),
  ).toBeVisible({ timeout: 20_000 });
  await dialog.getByLabel('Konum bağlantısı ya da koordinat').fill('https://maps.google.com/maps?q=40.9862,29.0253');
  await dialog.getByRole('button', { name: 'Konumu al' }).click();
  await dialog.getByRole('button', { name: 'Bu konumu kaydet' }).click();
  await expect(page.getByText('Konum işaretli')).toBeVisible();
});

test('müşteri sayfasındaki "Konumu işaretle" bağlantısı seçiciyi açık getirir', async ({ page }) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'operator'));
  await page.goto(`/musteriler/${record(a, 'cagla')}`);
  await page.getByRole('link', { name: 'Konumu işaretle' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Konumu işaretle' })).toBeVisible();
});
```

> Harita yüklenmezse (`load` hiç gelmezse) klavye testi 15 sn sonra "harita açılamıyor" gösterir ve düşer. Olası neden simge dosyasının olmaması (`public/harita/simge` E2E'de yok): o zaman bu iki testin başında `page.route('**/harita/simge/**', …)` ile boş simge (`{}` JSON ve 1×1 PNG) döndür. Önce gerçek davranışa bak; gerekmedikçe ekleme.

- [ ] **Adım 5: Erişilebilirlik ve ekran görüntüleri**

`tests/e2e/erisilebilirlik.spec.ts`'e ekle (`axeViolations` Görev 14'te yazıldı):

```ts
for (const colorScheme of ['light', 'dark'] as const) {
  test(`konum seçici açıkken (${colorScheme === 'light' ? 'açık' : 'koyu'}) ihlal yok`, async ({ page }) => {
    const { a } = accounts();
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await loginAs(page, a, account(a, 'operator'));
    await gotoReady(page, `/musteriler/${record(a, 'cagla')}/adresler/${record(a, 'caglaAdres')}?konum=ac`);
    const dialog = page.getByRole('dialog', { name: 'Konumu işaretle' });
    await expect(dialog.locator('canvas.maplibregl-canvas')).toBeVisible();
    await dialog.getByLabel('Konum bağlantısı ya da koordinat').fill('29.0253, 40.9862');
    await dialog.getByRole('button', { name: 'Konumu al' }).click();
    await expect(dialog.getByText('Enlem ve boylam yer değiştirmiş olabilir.')).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });
}
```

> axe MapLibre'nin kendi düğmelerini (kaynak bilgisi) işaretlerse, ihlali `exclude` ile gizleme: `globals.css`'te `.maplibregl-ctrl-attrib` renklerini token'larla ver ve testi yeşile çevir.

`tests/e2e/ekran-goruntuleri.spec.ts`'e ekle:

```ts
test('ekran görüntüleri: konum seçici', async ({ page }) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'operator'));
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, `/musteriler/${record(a, 'cagla')}/adresler/${record(a, 'caglaAdres')}?konum=ac`);
      const dialog = page.getByRole('dialog', { name: 'Konumu işaretle' });
      await expect(dialog.locator('canvas.maplibregl-canvas')).toBeVisible();
      await page.screenshot({
        path: `${OUT}/konum-secici-${width}-${colorScheme === 'light' ? 'acik' : 'koyu'}.png`,
      });
    }
  }
});

test('büyük yazı (%200), 360 px: konum seçici yatay kaydırmasız, düğmeler görünür', async ({ page }) => {
  const { a } = accounts();
  await loginAs(page, a, account(a, 'operator'));
  await page.setViewportSize({ width: 360, height: 780 });
  await gotoReady(page, `/musteriler/${record(a, 'cagla')}/adresler/${record(a, 'caglaAdres')}?konum=ac`);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const dialog = page.getByRole('dialog', { name: 'Konumu işaretle' });
  const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(dialog.getByRole('button', { name: 'Bu konumu kaydet' })).toBeInViewport();
  await page.screenshot({ path: `${OUT}/konum-secici-360-buyuk-yazi.png` });
});
```

- [ ] **Adım 6: Sahibe sor, sonra çalıştır** 🧭

Sahibe: "Harita ve konum seçicinin uçtan uca testlerini görünmez Chromium'da çalıştırayım mı? Test veritabanını sıfırlar, 3100 ve 3101 portlarını kullanır." Onaydan sonra:

```bash
npm run test:e2e
```

Expected: hepsi geçer; sayıyı not et. `konum-secici-*.png` dosyalarını aç ve iğnenin iki temada da haritadan ayrıştığını gözle kontrol et.

- [ ] **Adım 7: Commit**

```bash
npm run format && npm run lint && npm run typecheck
git add playwright.config.ts tests/e2e
git commit -m "Konum: uçtan uca testler (bağlantı, klavyeyle kaydırma, adres bulma, geri tuşu, harita yoksa)"
```

---

### Görev 22: Kapanış — doğrulama, inceleme, belgeler

**Files:**
- Modify: `CLAUDE.md`, `docs/YOL-HARITASI.md`, `docs/YAPILACAKLAR.md`, `docs/KVKK-VERI-ENVANTERI.md`, `docs/TASARIM-SISTEMI.md`

- [ ] **Adım 1: Doğrulama kapısı (hepsi)**

```bash
npm run typecheck && npm run lint && npm run format:check && npm test && npm run build
```

E2E için sahibe yeniden sor (Görev 21'den sonra kod değiştiyse), sonra `npm run test:e2e`. Sayıları not et: birim, entegrasyon, E2E (ör. "birim 210/211, entegrasyon 140/140, E2E 120/120").

Çalışma zamanında (tasarım §16): iki deneme firmasıyla müşteri ekleme; gerçek harita dosyasıyla konum seçici (geliştirme sunucusu, sahibin tarayıcısı değil: görünmez tarayıcı ya da sahibin denemesi); A firmasının oturumuyla B'nin müşteri adresine istek (`/musteriler/<B-id>` → "Sayfa bulunamadı"). Yapamadığını "çalışma zamanında doğrulanmadı" diye yaz.

- [ ] **Adım 2: Farkı baştan sona incele**

```bash
git diff a749dbb --stat
git diff a749dbb -- src
```

Bak: kullanılmayan kod ve içe aktarma, tekrar eden yardımcı, `tenant_id` filtresi unutulmuş sorgu, istemci bileşenine sızan sunucu kodu, loga giden kişisel veri (arama metni, adres, koordinat, bağlantı, parça adresi), Türkçe olmayan kullanıcı metni, doğrudan renk kodu.

- [ ] **Adım 3: Güvenlik incelemesi**

`security-review` skill'i ya da komutu varsa çalıştır; yoksa elle: kısa bağlantı açma (yalnızca iki alan adı, HTTPS, yönlendirme izlenmez, gövde okunmaz, zaman aşımı, kişi başı sınır), harita rota işleyicisi (oturum, sayı denetimi, dosya adı kalıbı), yeni sunucu eylemlerinin hepsinde `requireSession` + `requirePermission` + girdi uzunluk sınırı, bağlı (`bind`) argümanların sunucuda doğrulanması, `surum.json`'dan klasör dışına çıkılamaması. Bulunan her sorun için önce test, sonra düzeltme.

- [ ] **Adım 4: Belgeler** (`sahip-belgeleri` ve `kvkk-kontrol-listesi` skill'leriyle)

- **CLAUDE.md:**
  - §1 durum satırı: Müşteriler parçası bitti; sırada **İşler ve operatör panosu**.
  - §4: `npm run harita:indir` satırı (ne zaman: harita yenilenirken; sonra sunucu yeniden başlatılır).
  - §7 kırılma noktaları: Yandex bağlantısında sıra "boylam, enlem"; MapLibre 6 işçisi `setWorkerUrl` + `public/maplibre` (`predev`/`prebuild` kopyalar); `PMTiles.getZxy` sıkıştırmayı açar; harita dosyası sunucu açılırken okunur (yeni dosyada yeniden başlat); React form sıfırlaması kontrolsüz alanları boşaltır → müşteri formları kontrollü alan kullanır; Nominatim kuralları (saniyede 1, User-Agent, önbellek, düğmeyle); `?konum=ac`.
  - §8 yapı: `src/server/customers/`, `src/server/geo/`, `src/components/map/`, `src/app/(uygulama)/musteriler/`, `src/app/harita/parca/`, `scripts/harita-indir.ts`, `scripts/maplibre-worker.ts`, `scripts/il-ilce-uret.ts`, git dışı `harita/`, `araclar/`, `public/harita/`, `public/maplibre/`.
  - §9 mimari: dört müşteri tablosu ve bileşik anahtarlar (cihaz → adres `ON DELETE SET NULL (address_id)`), `search_text` + `pg_trgm`, sürüm koruması (`stale` → güncel kayıt), danışma kilidiyle çift numara, harita mimarisi (dosya → rota işleyicisi → MapLibre; dış servis yok), yetki tablosu güncel hâli.
  - §10 test tablosu: yeni dosyalar ve sayılar.
  - §11 teknik borç (yeni): adres bulma önbelleği ve dakikalık sınırlar bellekte; kısa bağlantı açma Google'a istek atar (KVKK, avukat); harita dosyası yeni sürümde sunucu yeniden başlatılmalı; sahte Nominatim yalnızca E2E'de, gerçek Nominatim geliştirmede (pilot öncesi kapatılır); `audit_log` müşteri kayıtlarında değer yok (bilerek).
  - §12: `GEOCODER_URL`, `HARITA_KLASORU`, `npm run harita:indir`, harita dosyasının boyutu ve sürümü.
  - §13 dersler: bu parçada öğrenilenler (ör. Overpass 504 → iki uç nokta; Wikidata il/ilçe verisi dağınık; harita boyutu).
- **YOL-HARITASI.md:** "Müşteriler parçası tamamlandı (tarih)" kararı (test sayıları, harita boyutu); "Sıradaki adım": İşler parçasının tasarımı.
- **YAPILACAKLAR.md:** Müşteriler maddeleri `[x]` + tarih; durum tablosu; 👤 "Haritayı ve konum seçiciyi dene"; ⚠️ "Pilot firmadan önce adres bulma (Nominatim) kapatılır ya da kendi sunucumuza alınır"; ⚠️ "Kısa Google bağlantısı açma için canlıda karar (avukat)".
- **KVKK-VERI-ENVANTERI.md:** müşteri verileri (ad, telefon, adres, konum, cihaz bilgisi, not) — amaç, hukuki sebep (sözleşmenin ifası; veri sorumlusu firma), yer (Türkiye hedefi), süre (5. parçada); yurt dışı aktarım satırları (geliştirmede Nominatim → İngiltere, kısa bağlantı → Google/ABD); loglara yazılmayanlar.
- **TASARIM-SISTEMI.md:** Görev 9'daki bölümü son hâline getir (konum seçici, iğne rengi, harita token değerleri).

GitHub görünümü: `"/c/Program Files/GitHub CLI/gh.exe" api markdown -f mode=gfm -F text=@docs/YAPILACAKLAR.md > /dev/null && echo ok`.

- [ ] **Adım 5: Commit ve sahibe teslim**

```bash
npm run format
git add CLAUDE.md docs
git commit -m "Müşteriler parçası tamamlandı: belgeler, test sayıları, teknik borç"
```

Sahibe kısa özet (ürün diliyle): ne bitti, test sayıları, harita boyutu, senden beklenenler (deneme, pilot öncesi adres bulma kararı). **Push için ayrıca sor.**

