# 1. aşama, 1. parça: Temel (iskelet, çok firma, giriş, roller, personel) — Tasarım

- **Tarih:** 2026-10-06
- **Durum:** Sahip bölümleri tek tek onayladı (2026-10-06); yazılı belge sahibin incelemesini bekliyor.
- **Sonraki adım:** Onaydan sonra uygulama planı (`docs/superpowers/plans/`).

## 1. Amaç ve "bitti" ölçütü

1. aşama beş parçaya bölündü; her parça kendi tasarım → plan → kod döngüsünden geçer:

1. **Temel** (bu belge): proje iskeleti, çok firmalı veritabanı (çift kilit), deneme firması açma, giriş ve hesap kilidi, roller, patronun personel yönetimi.
2. Müşteriler (harita iğnesi dahil).
3. İşler ve operatör panosu.
4. Teknisyenin telefon ekranı ve bildirim.
5. Çöp kutusu ve işlem geçmişi ekranı.

**Bitti sayılması için:**
- İki deneme firmasının patronları giriş yapıp operatör ve teknisyen hesabı açabiliyor.
- Bir firma diğerinin personelini hiçbir yoldan göremiyor. Otomatik testle kanıtlı, iki kilit ayrı ayrı sınanmış.
- Operatör ve teknisyenin personel işlemleri sunucuda reddediliyor.
- Doğrulama kapısı (bölüm 17) temiz, ekranlar bölüm 12'deki tasarım sürecinden geçmiş.

## 2. Kapsam

**İçinde:** Bölüm 1'deki "Temel" maddeleri, işlem geçmişinin kaydı (ekranı değil), tasarım sistemi, geliştirme ortamı kurulumu, test altyapısı, belgelerin doldurulması.

**Dışında (sonraki parçalar):** Müşteriler, işler, teknisyen iş ekranı, Web Push bildirimi, PWA (ana ekrana ekleme, manifest, service worker), çöp kutusu, işlem geçmişi ekranı, sistem sahibi paneli, tam içerik güvenliği politikası (CSP), kullanıcı adını sonradan değiştirme.

## 3. Bu oturumda alınan kararlar (2026-10-06)

| Karar | Gerekçe |
|---|---|
| Geliştirme veritabanı: PostgreSQL 18 Windows'a doğrudan kurulur (winget, resmi EDB kurulumu) | Sahibin seçimi. En sorunsuz yol, Türkçe sıralama (ICU) tam. Docker ağır, gömülü paket Windows'ta riskli. |
| "Sahaya çıkar" işareti: patron ve operatör de işe atanabilir | Sahibin seçimi. Küçük firmalarda patron işe kendisi gider; tek hesapla iki ekran. Rolün yetkilerini değiştirmez. |
| Kendi giriş sistemimiz + çift kilit (uygulama filtresi + PostgreSQL Row-Level Security) | Sahibin seçimi. "Firma kodu + kullanıcı adı" girişi hazır kütüphanelerde yama ister; ayrı veritabanı her firma için ağır. |
| Oturum 30 gün, kullanıldıkça uzar | Teknisyen her gün yeniden giriş yapmasın. |
| 5 yanlış şifrede hesap 15 dakika kilitlenir; aynı IP'den çok denemeye ayrıca sınır | Tahminle girişi zorlaştırmak. |
| Şifreyi patron sıfırlar (geçici şifre), personel ilk girişte kendi şifresini belirler; e-posta/SMS ile sıfırlama yok | Personelin e-postası olmayabilir; SMS ücretli. |
| İşlem geçmişi bu parçada kaydedilmeye başlar, ekranı 5. parçada | Sonradan eklemek geçmişi kaybettirir. |
| `ui-ux-pro-max` skill'i bu projede açıldı | Sahibin isteği. Betikleri incelendi: yalnızca Python standart kütüphanesi, ağ bağlantısı yok. Aynı paketten `design` ve `banner-design` Gemini'ye istek attığı için açılmadı. |

## 4. Teknik yığın

Sürümler plan aşamasında context7 ile yeniden doğrulanır.

- **Next.js 16.2** (App Router, `proxy.ts`), React 19, **TypeScript strict** (`noUncheckedIndexedAccess` dahil).
- **PostgreSQL 18.6** (`winget` kimliği `PostgreSQL.PostgreSQL.18`). Kimlikler `uuidv7()` ile (PostgreSQL 18'de yerleşik).
- **Drizzle ORM** + drizzle-kit (SQL göç dosyaları depoya girer), sürücü `pg` (node-postgres).
- **Zod**: sunucuda girdi doğrulama.
- **argon2id** (`@node-rs/argon2`): şifre özeti.
- **Tailwind CSS v4**: CSS-first `@theme` token'ları.
- Erişilebilir temel parçalar (onay penceresi, menü vb.) için Radix tabanlı yapı taşları. Görünüm tamamen bizim token'larımızla. Kesin seçim planda.
- **Vitest**: birim ve entegrasyon testleri (gerçek PostgreSQL). **Playwright + axe-core**: ekran ve erişilebilirlik kontrolleri (görünmez tarayıcı, sahibe sorularak).
- ESLint (flat config) + Prettier. Paket yöneticisi npm (pnpm kurulu değil). Betikler `tsx` ile.
- Kod tanımlayıcıları İngilizce. Kullanıcının gördüğü adresler (route) ve bütün arayüz metinleri Türkçe.

## 5. Veri modeli

Bütün zamanlar `timestamptz` (UTC); gösterim `Europe/Istanbul`.

### `tenants` (firmalar) — platform tablosu
| Sütun | Tür | Not |
|---|---|---|
| `id` | uuid PK | `uuidv7()` |
| `code` | text, benzersiz | Sadeleştirilmiş (bölüm 7.1), `^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$` (3-30 karakter) |
| `name` | text | 1-80 karakter |
| `status` | text | `active` \| `suspended` |
| `created_at` | timestamptz | |

`tenant_id` sütunu yoktur (kendisi firmadır). Uygulama kullanıcısı yalnızca `SELECT` yapabilir (girişte kodla firma bulmak için); kişisel veri içermez. Yazma yalnızca sistem sahibi komutlarıyla.

### `users` (personel) — firma tablosu
| Sütun | Tür | Not |
|---|---|---|
| `id` | uuid PK | `uuidv7()` |
| `tenant_id` | uuid, FK → tenants | |
| `username` | text | Sadeleştirilmiş, `^[a-z0-9._-]{3,30}$`; `(tenant_id, username)` benzersiz |
| `full_name` | text | 1-80 karakter |
| `role` | text | `owner` (Patron) \| `operator` \| `technician` |
| `field_work` | boolean | "Sahaya çıkar". Teknisyende her zaman `true` (CHECK kısıtı) |
| `password_hash` | text | argon2id |
| `must_change_password` | boolean | Geçici şifreyle açılan hesapta `true` |
| `is_active` | boolean | Pasif hesap giriş yapamaz, kayıtları durur |
| `failed_attempts` | integer | Ardışık yanlış şifre sayısı |
| `locked_until` | timestamptz, boş olabilir | |
| `last_login_at` | timestamptz, boş olabilir | |
| `created_at`, `updated_at` | timestamptz | |

`(tenant_id, id)` üzerinde ayrıca benzersiz kısıt bulunur. Firma tablolarının birbirine bağlantıları **bileşik yabancı anahtarla** (`(tenant_id, user_id) → users(tenant_id, id)`) kurulur. Böylece veritabanı başka firmanın kaydına bağlantı kurulmasına da izin vermez (üçüncü güvence).

### `sessions` (oturumlar) — firma tablosu
| Sütun | Tür | Not |
|---|---|---|
| `id` | text PK | Çerezdeki belirtecin SHA-256 özeti (hex). Belirtecin kendisi saklanmaz |
| `tenant_id`, `user_id` | uuid | Bileşik FK → users, `ON DELETE CASCADE` |
| `expires_at` | timestamptz | |
| `created_at` | timestamptz | |

Oturum çözümü firma bilinmeden yapılmak zorunda olduğu için `resolve_session(token_hash)` adlı `SECURITY DEFINER` bir veritabanı fonksiyonu yalnızca `(tenant_id, user_id, expires_at)` döndürür (`search_path` sabitlenmiş). Uygulama kullanıcısı tabloyu yalnızca kendi firması bağlamında okuyup yazabilir.

### `audit_log` (işlem geçmişi) — firma tablosu
| Sütun | Tür | Not |
|---|---|---|
| `id` | uuid PK | `uuidv7()` |
| `tenant_id` | uuid | |
| `actor_user_id` | uuid, boş olabilir | Bileşik FK → users. Komut satırından yapılan işlemde boş |
| `action` | text | `auth.login`, `auth.locked`, `user.created`, `user.updated`, `user.deactivated`, `user.reactivated`, `user.password_reset`, `user.password_changed` |
| `target_type`, `target_id` | text, uuid | |
| `details` | jsonb | Değişen alanların eski/yeni değeri. Şifre, özet, belirteç **asla** yazılmaz |
| `created_at` | timestamptz | |

Uygulama kullanıcısına yalnızca `INSERT` ve `SELECT` izni verilir; kayıtlar değiştirilemez ve silinemez. Saklama süresi 5. aşamada KVKK envanteriyle belirlenir.

## 6. Çift kilit: firma izolasyonu

**Veritabanı kullanıcıları**
- `servis_owner`: tabloların sahibi, göçleri çalıştırır. Süper kullanıcı değil, `BYPASSRLS` yok.
- `servis_app`: uygulamanın kullandığı kullanıcı. Tablo sahibi değil, `BYPASSRLS` yok, yalnızca gereken izinler (göç dosyalarında açıkça `GRANT`).
- `servis_test_bypass`: **yalnızca test veritabanına** bağlanabilir, `BYPASSRLS` var. Tek amacı 1. kilidin tek başına koruduğunu kanıtlamak.

**2. kilit (veritabanı):** `tenant_id` sütunu olan her tabloda `ENABLE` ve `FORCE ROW LEVEL SECURITY` bulunur. Politika:

```sql
USING (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid)
```

Firma bağlamı yoksa ifade `NULL` olur, hiçbir satır görünmez ve yazılamaz (kapalı başarısızlık). `FORCE` sayesinde komut satırı araçları da (tablo sahibiyle bağlansa bile) kilide uyar.

**Firma bağlamı:** Her istek tek bir işlem (transaction) içinde çalışır:

```ts
withTenant(tenantId, async (tx) => { ... })
// içeride: select set_config('app.tenant_id', $1, true)  -- parametreli, sql.raw yok
```

`true` (yerel) parametresi sayesinde ayar işlem bitince düşer ve havuzdaki bağlantıya sızmaz.

**1. kilit (uygulama):** Servis fonksiyonları `tx` ve `ctx: { tenantId, userId, role }` alır. Her sorgu `eq(table.tenantId, ctx.tenantId)` içerir. Ham `db` istemcisi yalnızca `server/db` ve `server/platform` içinden kullanılabilir; başka yerden içe aktarılması ESLint `no-restricted-imports` kuralıyla engellenir.

**Başka firmanın kaydı istenirse** "bulunamadı" yanıtı verilir. Kaydın var olduğu belli edilmez.

**Yeni tablo denetimi:** Bir test, şemadaki `tenant_id` sütunlu her tabloda RLS'nin açık ve zorunlu olduğunu ve politikanın bulunduğunu denetler. İstisna listesi boştur. İkinci kilidi olmayan bir tablo eklenirse test başarısız olur.

## 7. Giriş, oturum ve kilit

### 7.1 Sadeleştirme
Firma kodu ve kullanıcı adı girişte ve kayıtta aynı fonksiyondan geçer: baştaki ve sondaki boşluklar silinir, Türkçe harfler ASCII karşılığına çevrilir (`İ I ı → i`, `ş → s`, `ğ → g`, `ü → u`, `ö → o`, `ç → c`), sonra küçük harfe çevrilir. "İsmail", "Ismail" ve "ısmail" yazılışlarının hepsi `ismail` olur. Giriş alanlarında `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"` kullanılır.

### 7.2 Giriş akışı (sunucu eylemi)
1. Girdi Zod ile doğrulanır ve sadeleştirilir.
2. **IP sınırı** (yalnızca bellekte): Aynı IP'den 15 dakikada 20 başarısız deneme olursa "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin." mesajı gösterilir. IP hiçbir yere yazılmaz. Tek sunucu varsayımı, ileride çoklu sunucuya geçilirse paylaşılan depoya taşınmalı (bölüm 19).
3. Firma kodla bulunur. Yoksa sahte bir argon2 doğrulaması yapılır (yanıt süresi eşit kalsın) ve genel hata verilir.
4. Firma bağlamında kullanıcı bulunur. Yoksa sahte doğrulama ve genel hata.
5. `locked_until` gelecekteyse: "Bu hesap çok fazla hatalı deneme nedeniyle kilitlendi. {n} dakika sonra tekrar deneyin." Şifre denenmez.
6. Şifre yanlışsa `failed_attempts` tek bir atomik `UPDATE ... RETURNING` ile artırılır. 5'e ulaşırsa `locked_until = şimdi + 15 dk`, sayaç sıfırlanır, `auth.locked` kaydedilir ve kilit mesajı gösterilir. Değilse genel hata.
7. Şifre doğru ama hesap pasifse: "Bu hesap kullanıma kapalı. Firmanızın yöneticisiyle görüşün."
8. Şifre doğru ama firma dondurulmuşsa: "Firmanızın hesabı şu an kullanıma kapalı." Firma durumu yalnızca doğru şifreden sonra belli edilir.
9. Başarılı girişte sayaç ve kilit sıfırlanır, `last_login_at` güncellenir, oturum açılır, `auth.login` kaydedilir. `must_change_password` ise `/sifre-belirle`, değilse `/` adresine yönlendirilir.

**Genel hata metni:** "Firma kodu, kullanıcı adı ya da şifre hatalı."

### 7.3 Oturum
- Belirteç: 32 rastgele bayt, base64url. Veritabanında yalnızca SHA-256 özeti tutulur.
- Çerez `oturum`: `httpOnly`, `sameSite=lax`, `path=/`, üretimde `secure`, ömür 30 gün.
- Çerez `firma_kodu`: `httpOnly`, ömür 1 yıl. Giriş formunu önceden doldurur, "Firma kodunu değiştir" bağlantısıyla değiştirilebilir. Çıkışta silinmez.
- **Kayan süre:** Doğrulamada bitişe 15 günden az kaldıysa veritabanında süre 30 güne uzatılır. Sunucu bileşenleri çerez yazamadığı için çerezin ömrü `proxy.ts` içinde her istekte yenilenir (veritabanına bakılmaz).
- **`proxy.ts`** yalnızca iyimser denetim yapar: çerez yoksa korumalı sayfadan `/giris` adresine yönlendirir. Asıl doğrulama veri erişim katmanında yapılır (`getCurrentUser()`, React `cache` ile istek başına bir kez): oturum çözülür, süresi, kullanıcının etkinliği ve firmanın durumu denetlenir. Geçersizse oturum silinir.
- Pasifleştirme, şifre sıfırlama ve firma dondurma ilgili oturumları siler. Kişi kendi şifresini değiştirince **diğer** oturumları silinir.
- Çıkış: oturum satırı ve `oturum` çerezi silinir.

### 7.4 Şifre kuralları
- 8-128 karakter.
- Kullanıcı adını (sadeleştirilmiş hâliyle) ya da firma kodunu içeremez.
- Yaygın şifre listesinde olamaz (yaklaşık 100 kayıt; `12345678`, `qwerty123`, `sifre123`, `parola123`, takım adları gibi Türkçe örnekler dahil).
- Karmaşıklık kuralı (büyük harf, sembol zorunluluğu) yoktur.
- argon2id parametreleri OWASP önerisine göre seçilir ve planda doğrulanır.

**Geçici şifre:** Karışan karakterler çıkarılmış alfabeden (`0 O 1 l I` yok) `crypto.randomInt` ile üretilen 12 karakter. Okunuşu kolay olsun diye `abcd-efgh-jkmn` biçiminde gösterilir.

### 7.5 İlk girişte şifre belirleme
`must_change_password` açıkken veri erişim katmanı `/sifre-belirle` dışındaki her sayfayı oraya yönlendirir. Şifre belirleme ve çıkış dışındaki her sunucu eylemi reddedilir. Bu akışta yeni şifre iki kez sorulur. Hesabım'daki gönüllü değişiklikte ayrıca mevcut şifre sorulur.

## 8. Roller ve yetki

- `server/permissions.ts` içinde izin → roller tablosu tutulur. Bu parçada: `staff.view`, `staff.manage` → yalnızca `owner`. Sonraki parçalar satır ekler. Tablo CLAUDE.md'deki yetki tablosuyla birebir aynı olmak zorundadır.
- `requirePermission(user, izin)` her sunucu eyleminin ve korumalı sayfanın başında çağrılır. Yetkisiz sayfada "Bu sayfayı görme yetkiniz yok." görünümü gösterilir. Next.js 16'nın `forbidden()` desteği planda doğrulanır, yoksa kendi 403 görünümümüz kullanılır.
- Menü yalnızca kişinin yetkili olduğu bölümleri gösterir. Bu yalnızca kolaylıktır, asıl kontrol sunucudadır.
- `field_work` yetkileri değiştirmez. 3. ve 4. parçada iş atanabilirliği ve "Bugünkü işlerim" ekranı için kullanılır.

## 9. Personel yönetimi kuralları

- **Ekleme:** Ad soyad, kullanıcı adı (sadeleştirilmiş hâli canlı gösterilir), rol ve "Sahaya çıkar" girilir. Teknisyende "Sahaya çıkar" işaretli ve değiştirilemez. Geçici şifre bir kez gösterilir. `must_change_password = true`. Kullanıcı adı firmada varsa: "Bu kullanıcı adı firmanızda zaten kullanılıyor."
- **Kullanıcı adı** sonradan değiştirilemez (bu parçada). Ekleme ekranındaki önizleme yazım hatasını önlemek içindir.
- **Düzenleme:** Ad soyad, rol ve "Sahaya çıkar" değiştirilebilir. Patron kendi rolünü değiştiremez ve kendini pasifleştiremez.
- **Son patron kuralı:** Bir işlem firmadaki etkin patron sayısını sıfıra indirecekse reddedilir. Eşzamanlı işlemlerde iki patronun birbirini pasifleştirmesini önlemek için işlem içinde etkin patron satırları `SELECT ... FOR UPDATE` ile kilitlenip sayılır.
- **Pasifleştirme ve yeniden etkinleştirme:** Onay ister. Pasifleştirmede oturumlar silinir. Yeniden etkinleştirmede şifre değişmez; gerekirse ayrıca sıfırlanır.
- **Şifre sıfırlama:** Onay ister. Yeni geçici şifre bir kez gösterilir, `must_change_password = true` olur, hesap kilidi ve sayaç sıfırlanır (kilitli hesabı açmanın yolu da budur), oturumlar silinir. Patron kendi şifresini buradan değil Hesabım'dan değiştirir.
- **Liste:** Türkçe sıralı ad. Etkin/Pasif filtresi. Rol, "Sahaya çıkar" rozeti ve son giriş zamanı gösterilir. Sayfalama yok (firmalar küçük).
- Her değişiklik `audit_log` tablosuna yazılır.

## 10. Ekranlar ve adresler

| Adres | Kim | İçerik |
|---|---|---|
| `/giris` | Herkes | Firma kodu, kullanıcı adı, şifre (göster/gizle) |
| `/sifre-belirle` | Geçici şifreli kullanıcı | Yeni şifre ×2, kurallar görünür |
| `/` | Giriş yapmış herkes | Karşılama ve rolüne göre açık bölümler. "Yakında" menüsü yok |
| `/hesabim` | Giriş yapmış herkes | Şifre değiştirme, çıkış |
| `/personel` | Patron | Liste, filtre |
| `/personel/yeni` | Patron | Ekleme formu ve geçici şifre gösterimi |
| `/personel/[id]` | Patron | Düzenleme, pasifleştirme/etkinleştirme, şifre sıfırlama |

Ayrıca Türkçe 403, 404 ve hata sınırı (error boundary) görünümleri bulunur. Her ekranın yükleniyor, boş ve hata hali olur. Uygulama kabuğunun telefon ve masaüstü yerleşimi (üst çubuk, alt menü vb.) bölüm 12'deki tasarım yönüyle belirlenir.

## 11. Sistem sahibi komutları

`servis_owner` bağlantısıyla çalışır. Firma tablolarına yazarken firma bağlamını kurar, yani kilide uyar.

- `npm run firma:ac -- --kod <kod> --ad "<ad>" --patron-ad "<ad soyad>" --patron-kullanici <kullanıcı>`: firmayı ve ilk patronu açar, geçici şifreyi bir kez yazdırır.
- `npm run firma:dondur -- --kod <kod>` / `npm run firma:etkinlestir -- --kod <kod>`: dondurma firmanın bütün oturumlarını siler.
- `npm run db:tohum`: geliştirme için `deneme-a` ve `deneme-b` firmalarını patron, operatör ve teknisyenleriyle açar, geçici şifreleri yazdırır.

## 12. Tasarım süreci (ekran kodundan önce)

1. **Yön araştırması:** `ui-ux-pro-max` ürün türünü tarif eden sorgularla çalıştırılır (ör. "field service management B2B technician mobile dispatch office dashboard"). "Premium", "luxury" gibi kelimeler kullanılmaz (Cagriservis dersi: iki kez yanlış yön). Öneriler bu belgedeki kısıtlarla süzülür. `frontend-design` ile şablon görünümünden kaçınılır. Hedef: her gün saatlerce kullanılan, yormayan, güven veren bir iş aracı.
2. **2-3 görsel yön:** Her biri gerçek boyutta telefon ve masaüstü önizlemesiyle, açık ve koyu temada, sahibe bir sayfa olarak gösterilir. Önizlemelerde giriş ekranı, personel listesi ve **ileride gelecek teknisyen iş kartının taslağı** bulunur (güneş altında okunabilirlik, büyük düğme, tek el). Sahip seçer. Seçmeden ekran kodu yazılmaz.
3. **Tasarım sistemi:** `docs/TASARIM-SISTEMI.md` belgesine şunlar yazılır: renk token'ları (açık/koyu, kontrast oranları ölçülmüş: metin en az 4,5:1, büyük metin ve arayüz parçaları en az 3:1), yazı ölçeği, boşluk ölçeği, köşe yuvarlaklıkları, gölgeler, ikon seti, hareket kuralları (`prefers-reduced-motion`) ve bileşen kuralları (düğme, alan, kart, liste, onay penceresi, bildirim, boş/yükleniyor/hata halleri). Token'lar Tailwind `@theme` içinde tek yerde tanımlanır.
4. **Yazı tipi:** Türkçe harflerin tamamını (ğ ş ı İ ç ö ü) desteklemeli. Kendi sunucumuzdan yüklenir (`next/font` derleme sırasında indirir), kullanıcının tarayıcısı Google'a bağlanmaz.
5. **Koda doğrudan renk kodu yazılmaz.** Bir test, token dosyası dışında `#hex`, `rgb()`, `hsl()`, `oklch()` kullanımını yakalar.
6. **Doğrulama (her ekran):** 360 / 768 / 1280 px genişlikte; açık ve koyu temada; %200 yazı büyütmede; "hareketi azalt" ayarında. axe-core ile otomatik erişilebilirlik denetimi, kontrast ölçümü, yalnızca klavyeyle gezinme. Dokunma hedefi en az 44 px. Ekran görüntüleri sahibe gösterilir. Görünmez tarayıcı açılmadan önce her seferinde sahibe sorulur.
7. Türkçe arayüz metinleri `turkce-arayuz-metni` skill'iyle yazılır.

## 13. Hata yönetimi ve kayıt (log)

- Hata türleri: `ValidationError` (alan bazlı Türkçe mesajlar), `AuthError`, `ForbiddenError`, `NotFoundError`, `ConflictError`.
- Sunucu eylemleri `{ ok: true, data } | { ok: false, error: { message, fieldErrors? } }` döndürür. Kullanıcıya ham İngilizce hata gösterilmez.
- Beklenmeyen hatada kullanıcı şunu görür: "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin. (Hata kodu: XXXX)". Sunucu kaydına hata kodu, hata türü ve yığın izi yazılır; **girdi değerleri, ad, telefon, adres, şifre, belirteç ve IP yazılmaz.**
- Tek bir küçük `logger` modülü kullanılır. `console.*` yalnızca bu modülde ve komut satırı betiklerinde serbesttir (ESLint `no-console`).
- Güvenlik başlıkları (`next.config`): `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `X-Frame-Options: DENY`, kısıtlı `Permissions-Policy`. Tam CSP 5. aşamada.
- Sunucu eylemleri Next.js'in yerleşik kaynak (origin) denetimiyle CSRF'ye karşı korunur.

## 14. Proje yapısı (öneri, planda kesinleşir)

```
src/
  app/
    (genel)/giris, (genel)/sifre-belirle
    (uygulama)/layout.tsx        oturum zorunlu
    (uygulama)/page.tsx, hesabim, personel/...
    globals.css                  @theme token'ları
  proxy.ts
  server/
    db/          istemci, şema, withTenant
    platform/    firma kodu çözümü, oturum çözümü
    auth/        şifre, oturum, giriş, IP sınırı, sadeleştirme, getCurrentUser
    staff/       personel servisi ve sunucu eylemleri
    audit/       işlem geçmişi kaydı
    permissions.ts, errors.ts, logger.ts, clock.ts
  components/    temel parçalar ve uygulama kabuğu
scripts/         db-kur, firma, tohum
drizzle/         göç dosyaları
tests/           unit/, integration/, e2e/
docs/TASARIM-SISTEMI.md
```

İş kuralları sade fonksiyonlardadır (`tx`, `ctx` ve `clock` alır). Sunucu eylemleri yalnızca ince bir sarmalayıcıdır. Böylece kurallar Next.js çalıştırılmadan test edilir. Zaman `clock` üzerinden alınır, testlerde saat ileri alınabilir.

## 15. Test stratejisi

Testler önce yazılır ve başarısız olduğu görülür, sonra kod yazılır (TDD).

- **Ortam:** Ayrı `servis_takip_test` veritabanı. Test çalıştırması başında şema sıfırlanıp göçler uygulanır. Her test kendi rastgele firmalarını açar; firmalar zaten birbirinden yalıtık olduğu için testler birbirini etkilemez.
- **Firma izolasyonu:**
  - *Yalnızca 2. kilit:* A bağlamında filtresiz `select` yalnızca A satırlarını döndürür; B'nin `tenant_id` değeriyle ekleme reddedilir; B satırını güncelleme ve silme 0 satır etkiler; bağlam yokken 0 satır görünür; `audit_log` için `UPDATE` ve `DELETE` izni yoktur.
  - *Yalnızca 1. kilit:* Servis fonksiyonları `servis_test_bypass` bağlantısıyla (RLS devre dışı) çağrıldığında yine yalnızca kendi firmasını döndürür. Başka firmanın kimliğiyle yapılan istek "bulunamadı" döner.
  - *Bileşik anahtar:* Başka firmanın kullanıcısına bağlanan kayıt veritabanı tarafından reddedilir.
  - *Yeni tablo denetimi* (bölüm 6).
- **Rol yetkileri:** Testteki bağımsız beklenti tablosu (CLAUDE.md'den) `permissions.ts` ile karşılaştırılır. Her personel eylemi operatör ve teknisyen olarak çağrıldığında reddedilir.
- **Giriş ve oturum:** Bölüm 7'deki her madde. Yanlış şifre; 5'te kilit; 15 dakika sonra açılma (saat ileri alınarak); IP sınırı; pasif hesap; dondurulmuş firma; olmayan firma ve kullanıcıda genel hata; oturum süresi ve uzaması; pasifleştirme, sıfırlama ve dondurmada oturumların silinmesi; ilk girişte şifre zorunluluğu; Türkçe sadeleştirme; şifre kuralları.
- **Personel:** Ekleme, benzersiz kullanıcı adı, teknisyende "Sahaya çıkar" zorunluluğu, kendi rolünü değiştirememe, son patron kuralı (eşzamanlı deneme dahil), geçici şifre biçimi, işlem geçmişi kayıtları.
- **Tasarım:** Doğrudan renk kodu testi. `test:e2e` içinde axe denetimi ve üç genişlikte ekran görüntüsü (görünmez tarayıcı, sahibe sorularak).

## 16. Geliştirme ortamı kurulumu

1. Sahibe komut gösterilir, onayıyla `winget install PostgreSQL.PostgreSQL.18` gözetimsiz kipte kurulur (Stack Builder yok; süper kullanıcı şifresi rastgele üretilir). Bir kez Windows yönetici onayı çıkar. Gözetimsiz kurulum seçenekleri planda doğrulanır.
2. `listen_addresses = 'localhost'`: veritabanına yalnızca bu bilgisayardan erişilir.
3. `npm run db:kur` (tek seferlik): `servis_owner`, `servis_app`, `servis_test_bypass` kullanıcılarını rastgele şifrelerle; `servis_takip` ve `servis_takip_test` veritabanlarını `LOCALE_PROVIDER icu`, `ICU_LOCALE 'tr-TR'`, `UTF8` ile açar ve `.env` dosyasını yazar. `.env.example` depoya girer, `.env` girmez.
4. `npm run db:migrate`, `npm run db:tohum`, `npm run dev`.

## 17. Doğrulama kapısı ("bitti" demeden önce)

- `npm run typecheck` (tsc --noEmit), `npm run lint`, `npm test` (birim + entegrasyon), `npm run build`. Hepsi temiz geçmeli, sonuçlar sayılarıyla raporlanır.
- `npm run test:e2e`: ekran ve erişilebilirlik kontrolleri, sahibin onayıyla.
- Çalışma zamanında doğrulama: iki deneme firmasıyla gerçek giriş, personel ekleme, firmalar arası erişim denemesi.
- Kod incelemesi ve güvenlik incelemesi (`/security-review`).
- Bu komutlar ve neyi yakaladıkları CLAUDE.md'nin 4. bölümüne yazılır.

## 18. Belgeler

- **CLAUDE.md:** 4 (doğrulama kapısı), 8 (proje yapısı), 9 (mimari: çift kilit, oturum, yetki), 10 (test altyapısı) doldurulur. 7. bölüme Türkçe sadeleştirme kuralı eklenir.
- **YOL-HARITASI.md:** Bölüm 3'teki kararlar tarihli ve gerekçeli eklenir. 1. aşamanın beş parçaya bölündüğü yazılır.
- **YAPILACAKLAR.md:** Biten maddeler işaretlenir; "Telefon firma kodunu hatırlar" gibi maddeler bu parçada kapanır.
- **TASARIM-SISTEMI.md:** Bölüm 12'de anlatıldığı gibi.

## 19. Planda doğrulanacaklar ve bilinen riskler

- `@node-rs/argon2`: Windows için hazır derlenmiş paketi ve Next.js 16'da `serverExternalPackages` gereksinimi.
- drizzle-kit'in `FORCE ROW LEVEL SECURITY`, `SECURITY DEFINER` fonksiyon ve bileşik yabancı anahtar desteği. Desteklemediği kısımlar elle yazılmış SQL göç dosyasıyla yapılır.
- Next.js 16'da `forbidden()` / `authInterrupts` durumu; `proxy.ts` içinde çerez yenileme.
- EDB kurulumunun gözetimsiz kip seçenekleri; Windows yapımında ICU `tr-TR`.
- Tailwind v4 + Next.js 16 kurulumu; Radix tabanlı yapı taşlarının güncel durumu.
- **IP sınırı bellekte tutulur:** Tek sunucuda doğru çalışır. Birden çok sunucuya geçilirse paylaşılan bir depoya taşınmalı. 5. aşamada, sunucu kararıyla birlikte ele alınacak.
- **Ters vekil (reverse proxy) arkasında gerçek IP:** `x-forwarded-for` başlığına yalnızca güvenilen vekilden gelirse güvenilir. Sunucu kararıyla birlikte ayarlanacak.
