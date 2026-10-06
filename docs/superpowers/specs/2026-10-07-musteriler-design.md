# 1. aşama, 2. parça: Müşteriler (kayıt, arama, harita iğnesi) — Tasarım

- **Tarih:** 2026-10-07
- **Durum:** Sahip bölüm bölüm onayladı (2026-10-07); yazılı belge sahibin incelemesinde.
- **Sonraki adım:** Onaydan sonra uygulama planı (`docs/superpowers/plans/`).
- **Dayanak:** Temel parçanın tasarımı (`2026-10-06-temel-design.md`): çift kilit, servis/eylem ayrımı, yetki tablosu, işlem geçmişi, Saha tasarım sistemi aynen geçerli.

## 1. Amaç ve "bitti" ölçütü

Müşteri telefon ettiğinde operatör onu saniyeler içinde bulur ya da kaydeder. Adresin haritadaki konumu doğru işaretlenir; 3. parçada iş atama, 3. aşamada rota sıralaması bu konuma dayanır.

**Bitti sayılması için:**
- İki deneme firmasında patron ve operatör müşteri ekleyip düzenleyebiliyor, numara/ad/adres parçasıyla bulabiliyor; adrese konum iğnesini adres aramasıyla, bağlantı yapıştırarak ya da elle koyabiliyor.
- Bir firma diğerinin müşterisini, telefonunu, adresini, cihazını hiçbir yoldan göremiyor ve değiştiremiyor (dört tablo × iki kilit, otomatik testle).
- Teknisyenin müşteri ekranları ve eylemleri sunucuda reddediliyor.
- Tarayıcı harita için hiçbir dış servise bağlanmıyor.
- Doğrulama kapısı (bölüm 16) temiz; ekranlar bölüm 10.2'deki tasarım sürecinden geçmiş.

## 2. Kapsam

**İçinde:** Müşteri, telefonlar, adresler (il/ilçe listesi, konum iğnesi), cihazlar, not; arama ve "konumu eksik" süzgeci; çift numara uyarısı; eşzamanlı düzenleme koruması; konum seçici (kendi sunucumuzdan Türkiye haritası, adres bulma, konum bağlantısı okuma); işlem geçmişi kaydı; KVKK veri envanteri güncellemesi.

**Dışında:**

| Ne | Nerede |
|---|---|
| Müşterinin geçmiş servisleri | 3. parça (İşler) |
| Teknisyenin müşteri görünümü, "bilgi yanlış" notu, notun teknisyene görünürlüğü | 4. parça |
| Müşteri silme, çöp kutusu, çift kaydı birleştirme, KVKK silme isteğinde anonimleştirme | 5. parça |
| Kendi adres bulma sunucumuz, teknisyenin yerinde "konumu buraya düzelt" demesi | 3. aşama (rota motoruyla) |
| Vergi bilgileri | 4. aşama (faturayla) |
| Excel'den müşteri aktarma | 5. aşama (firma kaydıyla) |
| Bakım ve garanti hatırlatması | Fikir havuzu |
| Uydu görüntüsü | Yok (açık kaynakta ücretsiz kaynağı yok) |

## 3. Bu oturumda alınan kararlar (2026-10-07)

| Karar | Kim | Gerekçe |
|---|---|---|
| Konum iğnesi isteğe bağlı; eksikse belirgin uyarı ve "Konumu eksik" süzgeci | Sahip | Telefondaki acele kayıt yavaşlamaz; eksik konum fark edilir, iş atanırken (3. parça) yeniden hatırlatılır. |
| Cihaz: tür (sabit liste + "Diğer"), marka, model, seri no, kurulum tarihi, garanti bitişi, not | Sahip | Tarihler şimdiden birikir; bakım hatırlatması ileride açılırsa eski müşterilerde de çalışır. Sabit tür listesi raporu doğru kılar. |
| Tek ad alanı ("Ad soyad ya da firma adı"); yetkili kişi telefon etiketine yazılır | Sahip | En sade form. Vergi bilgileri 4. aşamada faturayla. |
| Konum bağlantısı yapıştırma bu parçada; Excel'den aktarma 5. aşamada; çift kaydı birleştirme 5. parçada | Sahip | Fikir olarak sunuldu, üçü de seçildi. |
| Harita kendi sunucumuzda (Türkiye PMTiles dosyası); adres bulma şimdilik herkese açık Nominatim, ayarla kapatılabilir | Sahip | Tarayıcı dış servise bağlanmaz (KVKK), harita rengi bir kez ayarlanır, canlıya geçişte yeniden yapılmaz. Kendi adres sunucusu 3. aşamada. |
| Geçmiş servisler ve "bilgi yanlış" notu 3./4. parçaya kayar; ekranda "yakında" bölümü gösterilmez | Claude, sahip onayladı | İş kaydı olmadan çalışamazlar. |
| Telefon/adres/cihaz kaldırmak "müşteriyi düzenlemek" sayılır (operatör de yapar); müşterinin tamamını silmek yalnızca patronda, 5. parçada | Claude, sahip onayladı | Yanlış girişi düzeltmek günlük iştir; kayıt silme çöp kutusu ister. |
| İşlem geçmişine müşteri için yalnızca değişen alanın adı yazılır, eski/yeni değer yazılmaz | Claude, sahip onayladı | KVKK silme isteğinde geçmiş kayıtları kişisel veri taşımaz. Bedeli: eski adres geçmişte görünmez. |
| Aynı numara başka müşteride varsa uyarı; "Yine de kaydet" ile kaydedilir | Claude, sahip onayladı | Aile, site yöneticisi aynı numarayı paylaşabilir; engellemek yanlış olur, sessiz geçmek çift kayıt üretir. |
| Eşzamanlı düzenleme koruması (sürüm numarası) | Claude, sahip onayladı | Ofiste birden çok operatör aynı müşteriyi düzenleyebilir; sessizce üstüne yazılmaz. |
| Müşteri notu bu parçada yalnızca ofiste; not alanında "hassas bilgi yazmayın" ipucu | Claude, sahip onayladı | Nota kolayca özel nitelikli veri (sağlık) ya da öznel yargı yazılır. |
| Kısa bağlantı açma yalnızca Google (`maps.app.goo.gl`) için; Apple/Yandex kısa bağlantıları okunmaz | Claude | Sahibin onayladığı dış istek yalnızca Google'a. Diğerleri ihtiyaç olursa sahibe sorularak eklenir. |

## 4. Teknik yığın eklemeleri

Sürümler planda güncel belgeden (context7, npm) doğrulanır. Yalnızca kararlı sürümler.

- **MapLibre GL JS** (`maplibre-gl`): vektör harita çizimi. Yalnızca konum seçici açılınca yüklenir (dinamik `import`). Telemetri göndermediği planda doğrulanır.
- **`pmtiles`** (npm): sunucuda PMTiles dosyasından `z/x/y` parçası okumak için (kendi dosya `Source` sınıfımızla).
- **`@protomaps/basemaps`** (npm): harita katmanları ve renk "flavor"ları (`light`/`dark`), etiket dili `tr`.
- **`pmtiles` komut satırı aracı** (go-pmtiles, BSD-3): yalnızca indirme betiğinde, Türkiye kesitini çıkarmak için. Kurulmadan önce incelenir (kaynak, sağlama toplamı, ağ davranışı); depo dışında, git'e girmeyen bir klasörde durur.
- **Yazı tipi ve simgeler:** `protomaps/basemaps-assets` deposundan sabit bir sürüm; `public/harita/` altında bizden sunulur.
- **PostgreSQL `pg_trgm`** eklentisi: arama dizini (`gin_trgm_ops`). Güvenilir (trusted) eklentidir; `db:kur`/göçte açılması planda doğrulanır.

## 5. Veri modeli

Dört yeni **firma tablosu**. Hepsinde `tenant_id`, RLS `ENABLE` + `FORCE`, `tenant_isolation` politikası, `servis_app`'e yalnızca gereken izinler (CLAUDE.md §9 kontrol listesi). Kimlikler `uuidv7()`, zamanlar `timestamptz`.

### `customers`
| Sütun | Tür | Not |
|---|---|---|
| `id` | uuid PK | `(tenant_id, id)` benzersiz (bileşik FK hedefi) |
| `tenant_id` | uuid, FK → tenants | |
| `name` | text | 1-120 karakter; yazıldığı gibi saklanır (büyük/küçük harf değiştirilmez) |
| `note` | text, boş olabilir | En çok 2000 karakter |
| `search_text` | text | Aramaya hazır, sadeleştirilmiş metin (bölüm 7). Servis her değişiklikte aynı işlemde yeniden üretir. GIN trigram dizini |
| `version` | integer | Eşzamanlı düzenleme koruması; müşteri, telefon, not değişince artar |
| `created_by` | uuid | Bileşik FK → users |
| `created_at`, `updated_at` | timestamptz | |
| `updated_by` | uuid | Bileşik FK → users |

`servis_app` izinleri: `SELECT`, `INSERT`, `UPDATE`. **`DELETE` yok** (silme 5. parçada çöp kutusuyla).

### `customer_phones`
| Sütun | Tür | Not |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id`, `customer_id` | uuid | Bileşik FK → customers, `ON DELETE CASCADE` |
| `number` | text | E.164 (`+905321234567`); CHECK `^\+[1-9][0-9]{7,14}$` |
| `label` | text, boş olabilir | En çok 40 karakter ("Cep", "Yönetici Ahmet Bey") |
| `position` | smallint | 0 = ana numara |

`(customer_id, number)` benzersiz (aynı müşteride aynı numara iki kez olmaz). `(tenant_id, number)` dizini: çift numara denetimi. İzinler: `SELECT`, `INSERT`, `UPDATE`, `DELETE`.

### `customer_addresses`
| Sütun | Tür | Not |
|---|---|---|
| `id` | uuid PK | `(tenant_id, customer_id, id)` benzersiz (cihaz FK hedefi) |
| `tenant_id`, `customer_id` | uuid | Bileşik FK → customers, `ON DELETE CASCADE` |
| `label` | text, boş olabilir | En çok 40 karakter ("Ev", "Yazlık") |
| `province` | text | İl adı; sunucuda il/ilçe listesine göre doğrulanır |
| `district` | text | İlçe adı; seçilen ilin ilçesi olmalı |
| `neighborhood` | text, boş olabilir | Mahalle, en çok 80 karakter |
| `address_line` | text | Cadde/sokak, bina no, daire; 1-250 karakter |
| `directions` | text, boş olabilir | Tarif ("Yeşil kapı, zil bozuk"), en çok 250 karakter |
| `latitude`, `longitude` | double precision, boş olabilir | İkisi birlikte boş ya da dolu (CHECK); geçerli aralık (CHECK) |
| `location_source` | text, boş olabilir | `geocode` \| `manual` \| `link` (3. aşamada `gps` eklenir) |
| `location_set_by` | uuid, boş olabilir | Bileşik FK → users |
| `location_set_at` | timestamptz, boş olabilir | |
| `position` | smallint | Gösterim sırası |
| `version` | integer | Eşzamanlı düzenleme koruması |
| `created_at`, `updated_at` | timestamptz | |

İzinler: `SELECT`, `INSERT`, `UPDATE`, `DELETE`. 3. parçada işler adrese bağlanınca, işi olan adresin kaldırılması o parçada yeniden ele alınır.

### `customer_devices`
| Sütun | Tür | Not |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id`, `customer_id` | uuid | Bileşik FK → customers, `ON DELETE CASCADE` |
| `address_id` | uuid, boş olabilir | Bileşik FK `(tenant_id, customer_id, address_id)` → customer_addresses; **cihaz yalnızca kendi müşterisinin adresine bağlanabilir**; adres kaldırılınca `SET NULL` (yalnızca `address_id` sütunu) |
| `type` | text | Sabit liste anahtarı (bölüm 6.4); CHECK |
| `type_other` | text, boş olabilir | `type = 'other'` ise zorunlu, en çok 40 karakter (CHECK) |
| `brand`, `model`, `serial_no` | text, boş olabilir | En çok 60 karakter |
| `installed_on`, `warranty_until` | date, boş olabilir | İkisi de doluysa garanti bitişi kurulumdan önce olamaz |
| `note` | text, boş olabilir | En çok 500 karakter |
| `version` | integer | |
| `created_at`, `updated_at` | timestamptz | |

İzinler: `SELECT`, `INSERT`, `UPDATE`, `DELETE`.

**Şema denetimi testi** dört tabloyu kendiliğinden kapsar (RLS'siz tablo eklenemez).

## 6. İş kuralları

### 6.1 Müşteri
- Ad zorunlu. **En az bir telefon zorunlu.** Adres isteğe bağlı (3. parçada iş açarken zorunlu olacak). Cihaz yeni müşteri formunda yok, müşteri sayfasından eklenir.
- Metin alanları kırpılır, art arda boşluklar teke iner. Ad yazıldığı gibi saklanır.
- **Sınırlar:** bir müşteride en çok 10 telefon, 50 adres, 200 cihaz. Aşılırsa Türkçe mesaj.

### 6.2 Telefon
- **Biçim:** Kullanıcı nasıl yazarsa yazsın ("0532 123 45 67", "532-123-4567", "+90 532 …", "0090 …") Türkiye numarası `+90` + 10 haneye çevrilir. İlk hane 2, 3, 4, 5 ya da 8 (0850) olmalı. "+" (ya da "00") ile başlayan yabancı numara E.164 genel kuralıyla (8-15 hane) kabul edilir.
- 7 haneli numara: "Alan koduyla yazın, örneğin 0212 123 45 67."
- **Gösterim:** Türkiye numarası "0532 123 45 67", yabancı numara "+49 …" biçiminde.
- **Ana numara:** sıradaki ilk numara. "Ana numara yap" ile herhangi biri öne alınır.
- **Çift numara:** Numara yazılınca (gecikmeli, sunucuya sorularak) firmada başka bir müşteride kayıtlıysa form altında "Bu numara Ayşe Yılmaz adına kayıtlı." ve **Müşteriyi aç** bağlantısı çıkar. Kaydet'e basıldığında sunucu yeniden denetler; çift numara varsa ve kullanıcı onaylamadıysa kayıt yapılmaz, **Yine de kaydet** düğmesi gösterilir. Aynı ad uyarı vermez.

### 6.3 Adres
- İl ve ilçe listeden (`<select>`, bölüm 8.6). İl kutusu, firmanın en son eklediği adresin iliyle dolu gelir; hiç adres yoksa boş.
- Konum isteğe bağlı. Konum konunca `location_source`, `location_set_by`, `location_set_at` yazılır.
- Düzenleme formunda il/ilçe/mahalle/açık adres değiştirilir ve iğne değiştirilmezse formda "Adresi değiştirdiniz. İğne hâlâ doğru yerde mi?" hatırlatması ve **Konumu kontrol et** düğmesi çıkar. İğne kendiliğinden silinmez.
- Konumsuz adreste belirgin "Konum işaretlenmedi" uyarısı (simge + metin, yalnızca renk değil).

### 6.4 Cihaz
- **Tür listesi** (anahtar → etiket): `combi_boiler` Kombi, `air_conditioner` Klima, `instant_water_heater` Şofben, `storage_water_heater` Termosifon, `refrigerator` Buzdolabı, `washing_machine` Çamaşır makinesi, `dryer` Kurutma makinesi, `dishwasher` Bulaşık makinesi, `oven_stove` Fırın / ocak, `range_hood` Aspiratör / davlumbaz, `water_purifier` Su arıtma, `television` Televizyon, `other` Diğer (yazın). Liste planda sahibe gösterilir; ekleme yalnızca göçle.
- Birden çok adres varsa cihazın adresi seçilir; tek adres varsa o kendiliğinden seçili gelir; adres yoksa boş kalır.

### 6.5 Eşzamanlı düzenleme
- Her düzenleme formu açıldığı andaki `version` değerini taşır. Kaydederken `UPDATE … WHERE id = … AND version = …` tutmazsa kayıt yapılmaz ve şu mesaj döner: "Bu kayıt siz düzenlerken değişti. Güncel hâlini gösterdik; değişikliğinizi yeniden yapın." Form güncel değerlerle yeniden yüklenir.
- Müşteri formu (ad, not, telefonlar) `customers.version`, adres ve cihaz formları kendi `version` sütununu kullanır. Telefon değişikliği müşterinin sürümünü artırır.

### 6.6 Kaldırma
- Telefon, adres ve cihaz kaldırma patron ve operatörde; onay penceresiyle. Son telefon kaldırılamaz ("En az bir telefon numarası olmalı.").
- Adres kaldırılırken o adrese bağlı cihaz varsa onay penceresi söyler: "Bu adresteki 2 cihaz müşteride kalır, adres bilgisi boşalır." Cihazlar silinmez.
- Müşterinin tamamını silmek bu parçada yok.

## 7. Arama

- **Tek kutu:** ad, telefonun herhangi bir parçası, il/ilçe/mahalle/açık adres. En az 2 karakter, en çok 100.
- **Sadeleştirme:** `src/lib/search.ts` içinde `foldSearch` (mevcut `foldIdentifier` ile aynı Türkçe harf eşlemesi; ayrıca noktalama boşluğa döner, art arda boşluk teke iner). "Şükrü" ve "sukru", "Işık" ve "isik" aynı sonuca çıkar.
- **`search_text`:** sadeleştirilmiş ad + her telefonun ulusal biçimi (`05321234567`) ve E.164 rakamları + sadeleştirilmiş il, ilçe, mahalle, açık adres. Servis, müşteriyi ya da alt kaydı değiştiren her işlemde aynı işlem içinde yeniden yazar.
- **Sorgu:** Girdi sadeleştirilir. Yalnızca rakam, boşluk, `+`, `-`, parantezden oluşuyorsa rakamlara indirgenir (baştaki `90`/`0` farkı tolere edilir) ve telefon araması yapılır. Sıralama: tam telefon eşleşmesi → ad başı eşleşmesi → diğer eşleşmeler; eşitlikte ada göre Türkçe sıralama (`tr-TR` ICU).
- **Arama yokken liste:** en son güncellenen müşteriler önce. Her sayfada 50 kayıt; **Daha fazla göster** (anahtar tabanlı sayfalama, `updated_at, id`).
- **"Konumu eksik" süzgeci:** hiç adresi olmayan ya da en az bir adresinde iğne olmayan müşteriler. Kartta "Adres yok" ya da "Konum yok" rozeti.
- Arama metni sayfa adresinde (`/musteriler?q=…`) tutulur: geri tuşu ve sayfa yenileme aramayı korur. Yazarken gecikmeli (yaklaşık 300 ms) güncellenir. Arama kendi veritabanımızda yapılır, dışarı bir şey gitmez.
- Kayıt bulunamazsa: "'0532 123' ile kayıtlı müşteri yok." ve **Bu numarayla yeni müşteri ekle** (girdi telefona benziyorsa numara, değilse ad önceden dolu).

## 8. Harita ve konum

### 8.1 Harita dosyası
- `npm run harita:indir`: Protomaps günlük derlemesinden (`build.protomaps.com`) Türkiye sınır kutusunu (yaklaşık `25.6,35.8,44.9,42.2`; planda kesinleşir) `pmtiles extract` ile çıkarır, yazı tipi ve simgeleri indirir, dosyayı doğrular, derleme tarihini sürüm olarak yazar.
- Dosya `harita/` altında (git dışında). Boyutu tahminen ~1 GB (indirince ölçülüp CLAUDE.md'ye yazılır; çok büyükse `--maxzoom` ile küçültme seçeneği sahibe sorulur).
- Veri lisansı ODbL: haritada "© OpenStreetMap katkıcıları" (ve Protomaps) atfı görünür. Yılda bir-iki kez tazelenmesi yeterli.
- Canlı sunucuda dosya imajın içine değil ayrı bir birime (volume) konur (5. aşama).

### 8.2 Harita parçalarını sunma
- Rota işleyicisi: `GET /harita/parca/<sürüm>/<z>/<x>/<y>` (Node çalışma zamanı). PMTiles'tan parçayı okur, `Content-Type: application/x-protobuf`, sıkıştırma başlığı dosyadaki türe göre; parça yoksa 204.
- **Yalnızca giriş yapmış kişiye** (her rol). Oturum doğrulaması her parça isteğinde veritabanına gitmesin diye 60 saniyelik bellek önbelleğiyle yapılır (oturum özeti → geçerlilik); geçersiz oturumda 401. Bedeli: kapatılan bir oturum en çok 60 saniye daha harita parçası alabilir (parçalar kişisel veri içermez).
- `Cache-Control: private, max-age=604800` (7 gün); adres sürüm içerdiği için yeni dosya indirilince önbellek kendiliğinden yenilenir.
- `z`, `x`, `y` sayı ve aralık denetiminden geçer; geçersizse 400.

### 8.3 Görünüm
- Stil istemcide `@protomaps/basemaps` ile kurulur: `layers(kaynak, flavor, { lang: 'tr' })`. Flavor, `light`/`dark` adlı flavor'ın üzerine `globals.css` harita token'larından (`--map-*`) okunan renklerle oluşur. Koda renk kodu yazılmaz (mevcut test).
- Tema değişince (açık/koyu) stil yeniden kurulur.
- `glyphs` ve `sprite` adresleri `/harita/...` (bizden).

### 8.4 Konum seçici
- Adres formundan **Konumu işaretle / Konumu düzelt** ile açılır. Telefonda tam ekran, geniş ekranda büyük pencere (erişilebilir iletişim kutusu, odak içeride kalır, Esc kapatır). Telefonun geri tuşu yalnızca seçiciyi kapatır, formu kaybettirmez (geçmişe bir adım eklenir).
- **İğne ortada sabit, harita altında kaydırılır.** Başlangıç: varsa mevcut iğne; yoksa adres araması sonucu; yoksa seçilen ilçenin merkezi; o da yoksa ilin merkezi; il de yoksa Türkiye.
- Üstte: **Adresi haritada bul** (formdaki adres alanlarıyla; ayar kapalıysa görünmez) ve **Konum bağlantısı yapıştır** alanı. Altta: **Bu konumu kaydet**, **Vazgeç**. İğnenin `location_source` değeri son kullanılan yönteme göre yazılır (elle kaydırılırsa `manual`).
- Klavye: harita odaktayken ok tuşları kaydırır, `+`/`-` yakınlaştırır. Ekran okuyucuya iğnenin konumu yazıyla bildirilir; bağlantı/koordinat alanı haritaya alternatif yoldur.
- **Hata halleri:** harita kodu ya da dosyası yüklenemezse "Harita şu an açılamıyor. Konum bağlantısı yapıştırarak ekleyebilirsiniz."; WebGL yoksa "Bu cihazda harita açılamıyor. …" — iki durumda da bağlantı alanı çalışır.

### 8.5 Adres bulma (geocoding)
- Sunucu eylemi; tarayıcı dış servise bağlanmaz. Yalnızca **Adresi haritada bul** düğmesine basınca (yazarken değil).
- Giden yalnızca adres metni (mahalle, açık adres, ilçe, il, "Türkiye"); ad ve telefon gitmez. `countrycodes=tr`, `accept-language=tr`, en çok 5 sonuç. Birden çok sonuçta liste gösterilir.
- **Nominatim kuralları:** tüm sunucu için saniyede en çok 1 istek (sıra), uygulamayı tanıtan `User-Agent` (planda kesinleşir), sonuçlar bellekte 24 saat önbellekte (en çok 1000 kayıt), otomatik tamamlama yok. Ayrıca kişi başına dakikada 10 istek. Zaman aşımı 5 sn.
- **Ayar:** `GEOCODER_URL` ortam değişkeni. Boşsa özellik kapalı (düğme görünmez). Geliştirme `.env`'inde herkese açık Nominatim; **pilot firma gerçek veriyle başlamadan önce kapatılır ya da kendi sunucumuza bağlanır.**
- Hata: "Adres haritada bulunamadı. Haritayı kaydırarak ya da konum bağlantısıyla işaretleyebilirsiniz." / servis yanıt vermezse "Adres arama şu an çalışmıyor. …". Ham hata gösterilmez, adres metni loga yazılmaz.

### 8.6 Konum bağlantısı okuma
- **Saf ayrıştırıcı** `src/lib/location-link.ts` (tarayıcıda ve sunucuda aynı): 
  - Google: `!3d<lat>!4d<lng>` (tercih), `@<lat>,<lng>`, `?q=<lat>,<lng>`, `?ll=`, `query=`; `maps.google.com/maps?q=…` (WhatsApp konum bağlantısı).
  - Apple: `maps.apple.com/?ll=<lat>,<lng>`, `?q=` koordinatı, `coordinate=`.
  - Yandex: `pt=<lng>,<lat>` ya da `ll=<lng>,<lat>` (**sıra ters**).
  - Düz koordinat: `41.0082, 28.9784`; `41,0082 28,9784` (Türkçe ondalık virgül, boşlukla ayrılmışsa); derece-dakika-saniye (`41°00'29.5"N 28°58'42.2"E`).
- **Kısa Google bağlantısı** (`maps.app.goo.gl/…`, `goo.gl/maps/…`): sunucu eylemi bu adrese tek bir istek atar (`redirect: 'manual'`), yalnızca `Location` başlığını okuyup ayrıştırır; yönlendirmeyi izlemez. Yalnızca bu iki alan adı kabul edilir (SSRF'ye karşı), yalnızca HTTPS, zaman aşımı 5 sn, kişi başına sınır.
- Apple (`maps.apple/p/…`) ve Yandex (`yandex.com.tr/maps/-/…`) kısa bağlantıları: "Bu bağlantıdan konum okunamadı. Müşteriden konumu Google Haritalar'dan göndermesini isteyebilir ya da haritada işaretleyebilirsiniz."
- Konum Türkiye sınır kutusunun dışındaysa uyarı: "Bu konum Türkiye dışında görünüyor. Yine de kullanılsın mı?"

### 8.7 İl ve ilçe listesi
- 81 il ve bütün ilçeler, il ve ilçe merkez koordinatlarıyla, `src/lib/` altında sabit bir veri dosyası. Kaynak ve lisansı planda belirlenir (resmi ad listesi + açık lisanslı merkez koordinatları; kaynak dosya başında yazılır).
- Hem istemci (seçim kutuları) hem sunucu (doğrulama) aynı listeyi kullanır. Türkçe sıralı.

## 9. Yetki

`permissions.ts`'e eklenir (CLAUDE.md §5 tablosuyla birebir):

| İzin | Roller | Kullanım |
|---|---|---|
| `customer.view` | owner, operator | Liste, arama, müşteri sayfası, çift numara denetimi |
| `customer.manage` | owner, operator | Ekleme, düzenleme, telefon/adres/cihaz ekleme-kaldırma, adres bulma, kısa bağlantı açma |

- Teknisyen: sayfalarda `ForbiddenView`, eylemlerde `forbiddenError`. (4. parçada kendi işinin müşterisi için ayrı, sınırlı okuma yolu gelir.)
- Harita parçaları: oturumu olan her rol.
- Başka firmanın kaydı istenirse "bulunamadı" (var olduğu belli edilmez).
- Menü: **Müşteriler** (`customer.view`), simge lucide `Contact`. Patronda alt menü 4 öğeye çıkar; 360 px ve %200 yazıda E2E ile denetlenir.

## 10. Ekranlar ve adresler

### 10.1 Adresler
| Adres | İçerik |
|---|---|
| `/musteriler` | Arama kutusu, "Konumu eksik" süzgeci, kartlar (ad, ana numara, ilk adresin ilçe/mahallesi, rozetler), Daha fazla göster, boş/bulunamadı halleri |
| `/musteriler/yeni` | Ad, telefonlar (+ Telefon ekle), isteğe bağlı ilk adres (adres formu + konum seçici). `?telefon=` / `?ad=` ile önceden dolu |
| `/musteriler/[id]` | Ad, ana numara ve **Ara** (`tel:`), telefonlar, adresler (konum durumu, Konumu düzelt), cihazlar, not, "Ekleyen … · tarih", "Son değişiklik … · tarih" |
| `/musteriler/[id]/duzenle` | Ad, not, telefonlar (ekle, kaldır, ana numara yap, etiket) |
| `/musteriler/[id]/adresler/yeni`, `/musteriler/[id]/adresler/[adresId]` | Adres formu + konum seçici; düzenlemede **Adresi kaldır** |
| `/musteriler/[id]/cihazlar/yeni`, `/musteriler/[id]/cihazlar/[cihazId]` | Cihaz formu; düzenlemede **Cihazı kaldır** |

Her ekranın yükleniyor (`loading.tsx` iskeleti), boş ve hata hali olur. Ana sayfadaki rol bölümlerine "Müşteriler" eklenir.

### 10.2 Tasarım süreci (ekran kodundan önce)
- Mevcut Saha tasarım sistemi ve bileşenleri (`TextField`, `SelectField`, `Card`, `Badge`, `Notice`, `ConfirmDialog`, `EmptyState`…) yeniden kullanılır; yeni bileşen yalnızca gerekirse (telefon listesi alanı, konum seçici, arama kutusu).
- `ui-ux-pro-max` + `frontend-design` ile liste, müşteri sayfası ve konum seçici için **telefon ve masaüstü önizlemesi**, açık ve koyu temada, sahibe gösterilir. Sahip onaylamadan ekran kodu yazılmaz.
- Harita için `--map-*` token'ları `globals.css`'e eklenir; konum seçicinin üstündeki düğmeler ve metinler kontrast testine girer.
- Doğrulama: 360 / 768 / 1280 px, açık/koyu, %200 yazı, "hareketi azalt", klavye, axe. Arayüz metinleri `turkce-arayuz-metni` ile.

## 11. İşlem geçmişi

`audit_log`'a yeni eylemler; `target_type = 'customer'`, `target_id` = müşteri kimliği. `recordAudit` hedef türünü genel alacak biçimde genişletilir (`{ type, id }`).

| Eylem | `details` |
|---|---|
| `customer.created` | `{}` |
| `customer.updated` | `{ fields: ['name' \| 'note' \| 'phones'] }` |
| `customer.address_added` / `address_updated` / `address_removed` | `{ addressId, fields?, locationChanged?, locationSource? }` |
| `customer.device_added` / `device_updated` / `device_removed` | `{ deviceId, fields? }` |

**Değer yazılmaz** (ad, telefon, adres, not, seri no, koordinat). Bir test, müşteri eylemlerinde `details` içinde yalnızca izin verilen anahtarların bulunduğunu denetler.

## 12. KVKK

- `docs/KVKK-VERI-ENVANTERI.md`'ye müşteri verileri eklenir: ad, telefon, adres, konum, cihaz bilgisi, not. Amaç: servis hizmetinin verilmesi (sözleşmenin ifası). Veri sorumlusu firma, platform veri işleyen. Saklama ve silme 5. parçada.
- **Yurt dışı (yalnızca geliştirmede, avukata sorulacak):** adres bulmada adres metni Nominatim'e (OpenStreetMap Vakfı, İngiltere); kısa bağlantı açmada bağlantının kendisi Google'a (ABD). Canlıda adres bulma kendi sunucumuzda; kısa bağlantı açma için sahibe yeniden sorulur.
- Not alanı ipucu: "Sağlık, din gibi hassas kişisel bilgiler yazmayın."
- Uygulama loguna arama metni, telefon, adres, koordinat, bağlantı yazılmaz (mevcut `logger` testi kapsamı genişletilir).
- Teknisyenin müşteri verisine erişimi ve "iş kapanınca N gün sonra gizlenir" kuralı 4. parçada.
- Harita parçası istekleri sunucu loguna kişi ve konum bilgisiyle yazılmaz (hangi bölgeye bakıldığı müşteri konumunu ele verebilir).

## 13. Hata yönetimi

- Mevcut `AppError` / `runAction` / `ActionResult` kalıbı. Yeni durumlar: çift numara (`duplicatePhone` sonucu, eşleşen müşterilerin adı ve kimliği), sürüm çakışması (`ConflictError` + güncel kayıt), sınır aşımı (`ValidationError`), adres bulma ve bağlantı açma hataları (Türkçe, bölüm 8.5-8.6).
- Dış servis hataları kullanıcıya genel Türkçe mesajla döner; loga yalnızca hata kodu ve türü.

## 14. Proje yapısı (eklenecekler; planda kesinleşir)

```
drizzle/0002_musteriler.sql            Tablolar, dizinler, RLS, GRANT, pg_trgm
scripts/harita-indir.ts                Türkiye kesiti, yazı tipi/simge indirme ve doğrulama
harita/                                (git dışında) turkiye.pmtiles, sürüm bilgisi
public/harita/                         Yazı tipi (glyph) ve simge (sprite) dosyaları
src/lib/phone.ts                       Telefon ayrıştırma, biçimleme
src/lib/search.ts                      foldSearch
src/lib/location-link.ts               Konum bağlantısı/koordinat ayrıştırıcı
src/lib/tr-il-ilce.ts                  İl/ilçe listesi ve merkezleri
src/lib/device-types.ts                Cihaz türü listesi
src/server/customers/service.ts        Müşteri, telefon, adres, cihaz iş kuralları
src/server/customers/search.ts         Arama ve sayfalama
src/server/geo/geocoder.ts             Adres bulma (sıra, önbellek, ayar)
src/server/geo/short-link.ts           Kısa Google bağlantısı açma
src/server/geo/tiles.ts                PMTiles dosya kaynağı, parça okuma
src/app/harita/parca/[...]/route.ts    Harita parçası rota işleyicisi
src/app/(uygulama)/musteriler/...      Ekranlar ve sunucu eylemleri
src/components/map/location-picker.tsx Konum seçici (dinamik yüklenen)
```

**Uygulama sırası:** Plan iki yarıda ilerler. Önce müşteri kaydı ve arama haritasız biter (konum alanları şemada var, ekranda "Konum işaretlenmedi"); sahip ekranları dener. Sonra harita dosyası, parça sunumu, konum seçici, adres bulma ve bağlantı okuma eklenir. Böylece harita altyapısındaki bir gecikme müşteri kaydını bekletmez.

## 15. Test stratejisi

TDD: test önce, kırmızı görülür, sonra kod.

- **Birim:**
  - `phone`: Türkiye cep/sabit/0850, boşluklu/tireli/parantezli/`+90`/`0090`, 7 hane uyarısı, yabancı numara, geçersizler; gösterim biçimi.
  - `search`: Türkçe harf eşlemesi, noktalama, telefon girdisinin rakama indirgenmesi.
  - `location-link`: her Google/Apple/Yandex biçimi, Yandex ters sıra, düz/ondalık virgüllü/DMS koordinat, Türkiye dışı, okunamayan bağlantı, kısa bağlantı tanıma.
  - `tr-il-ilce`: 81 il, her ilin en az bir ilçesi, il içinde benzersiz ilçe adı, merkezlerin Türkiye sınır kutusunda olması.
  - `device-types`, `permissions` (yeni izinler × her rol), `navigation`, `audit` (müşteri eylemlerinde yalnızca izinli anahtarlar), `logger` (yeni alanlar sızmıyor).
- **Entegrasyon (gerçek PostgreSQL):**
  - Müşteri ekleme (telefonsuz reddi), düzenleme, telefon/adres/cihaz ekleme-kaldırma, son telefonun kaldırılamaması, ana numara.
  - Çift numara: uyarı, onaysız reddi, onaylı kayıt; başka firmadaki aynı numara uyarı **vermez**.
  - Sürüm çakışması (iki düzenleme, ikincisi reddedilir).
  - Sınırlar (11. telefon), il/ilçe doğrulaması, garanti/kurulum tarihi sırası, `type_other` kuralı.
  - Arama: Türkçe harf, telefon parçası, adres parçası, sıralama, sayfalama, "konumu eksik" süzgeci, `search_text` alt kayıt değişince güncelleniyor.
  - **Firma izolasyonu:** dört tablo × iki kilit (`firma-izolasyonu-*` kalıbı); cihazın başka müşterinin/firmanın adresine bağlanamaması (bileşik FK); çift numara denetiminin firma dışına bakmaması.
  - Teknisyenin her müşteri eyleminde reddi.
  - İşlem geçmişi kayıtları ve değer yazılmaması.
  - Adres bulma: sahte Nominatim sunucusuyla (gerçek servise gidilmez): saniyede 1 sıra, önbellek, kişi başı sınır, zaman aşımı, kapalı ayar.
  - Kısa bağlantı: sahte sunucuyla; izinli olmayan alan adı reddi, `Location` yoksa okunamadı, zaman aşımı.
  - Harita parçası: geçerli oturumda parça, oturumsuz 401, geçersiz `z/x/y` 400, olmayan parça 204 (küçük deneme PMTiles dosyasıyla).
- **E2E (Playwright, sahibe sorularak):**
  - Asıl akış: numara aranır → bulunamaz → o numarayla müşteri eklenir → adres girilir → bağlantı yapıştırılarak konum işaretlenir → müşteri sayfası.
  - Çift numara uyarısı ve "Yine de kaydet"; eşzamanlı düzenleme mesajı.
  - Konum seçici: harita açılıyor, kaydırınca iğne konumu değişiyor, kaydediliyor (görünmez Chromium'da WebGL; gerekirse SwiftShader ayarı planda).
  - Firma ayrımı ve teknisyen engeli ekranda.
  - Erişilebilirlik (axe, açık/koyu × telefon/masaüstü) konum seçici dahil; 360 px'te %200 yazı (yatay kayma, taşan öğe, alt menü etiketleri 4 öğeyle); ekran görüntüleri.

## 16. Doğrulama kapısı

CLAUDE.md §4 aynen: `typecheck`, `lint`, `format:check`, `npm test` (birim + entegrasyon), `build`, `test:e2e` (sahibin onayıyla). Sonuçlar sayılarıyla raporlanır. Ayrıca çalışma zamanında: iki deneme firmasıyla müşteri ekleme, gerçek harita dosyasıyla konum seçici, firmalar arası erişim denemesi. Kod ve güvenlik incelemesi (`/security-review`), özellikle kısa bağlantı açma (SSRF) ve harita rota işleyicisi.

## 17. Belgeler

- **CLAUDE.md:** §5 yetki tablosu (değişmez, izin adları eşlenir), §7 kırılma noktaları (Yandex ters koordinat, harita dosyası, Nominatim kuralları), §8 yapı, §9 yeni firma tabloları ve harita mimarisi, §10 test tablosu ve sayılar, §11 yeni teknik borçlar, §12 `GEOCODER_URL` ve `harita:indir`.
- **YOL-HARITASI.md:** Bölüm 3'teki sahip kararları tarihli ve gerekçeli.
- **YAPILACAKLAR.md:** Müşteriler maddeleri; seçilen fikirlerin yerleri (Excel aktarma → 5. aşama, birleştirme → 5. parça); geçmiş servisler ve "bilgi yanlış" notunun taşınması; pilot öncesi "adres bulma ayarı" uyarısı.
- **KVKK-VERI-ENVANTERI.md:** Bölüm 12.
- **TASARIM-SISTEMI.md:** Harita token'ları, konum seçici ve yeni bileşen kuralları.

## 18. Planda doğrulanacaklar ve bilinen riskler

- MapLibre GL JS, `pmtiles`, `@protomaps/basemaps` güncel kararlı sürümleri; MapLibre'nin telemetri göndermediği; React 19/Next 16 ile istemci tarafı dinamik yükleme.
- `pmtiles` komut satırı aracının Windows sürümü, sağlama toplamı, ağ davranışı; Türkiye kesitinin gerçek boyutu ve indirme süresi.
- `basemaps-assets` yazı tiplerinde Türkçe harfler (Latin Extended-A aralığı) ve gerekli aralıklar.
- İl/ilçe listesi ve merkez koordinatları için güvenilir, lisansı uygun kaynak; ilçe sayısının güncelliği.
- `pg_trgm` eklentisinin EDB PostgreSQL 18 Windows kurulumunda bulunması ve `servis_owner`'ın açabilmesi.
- Cihaz → adres bileşik anahtarında `ON DELETE SET NULL (address_id)` (yalnızca bir sütunu boşaltan biçim, PostgreSQL 15+) Drizzle şemasında ifade edilemeyebilir; göç elle yazılır, şema denetimi testi kısıtın varlığını doğrular.
- Görünmez Chromium'da WebGL (SwiftShader bayrağı gerekebilir).
- Nominatim `User-Agent`/iletişim bilgisi gereksinimi; gerekirse sahibe sorulur (kişisel e-posta sahibin onayı olmadan yazılmaz).
- **Risk:** Türkiye adreslerinde Nominatim sık yanılır → iğne her zaman kullanıcı onayıyla kaydedilir; bağlantı yapıştırma öne çıkarılır.
- **Risk:** ~1 GB harita dosyası geliştirme bilgisayarında ve ileride sunucuda yer kaplar; parça sunumu disk okuması yapar (önbellek başlıkları ile hafifletilir).
- **Risk:** Patronun alt menüsü 4 öğeye çıkıyor; dar ekranda ve büyük yazıda etiketler sığmayabilir (E2E denetimi; gerekirse kısa etiket).
