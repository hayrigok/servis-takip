# Servis Takip — Proje Kuralları

@docs/YOL-HARITASI.md

## 1. Proje özeti
Servis firmaları için çok firmalı (multi-tenant) web tabanlı servis takip sistemi; abonelikle satılacak. Ofis müşteri kaydeder ve iş atar, teknisyen işini telefondan (PWA) görür ve kapatır, patron stok/kasa/rapor görür. Fark: akıllı rota sıralaması, telefon öncelikli teknisyen ekranı, verilerin Türkiye'de tutulması (hedef).

Durum (2026-10-05): Tasarım aşaması. Kod yok.

## 2. Çalışma standardı
Bilgisayar düzeyindeki kişisel standart (`~/.claude/CLAUDE.md`) geçerli. Projeye özel ekler:
- **Firma izolasyonu pazarlık konusu değildir.** Her yeni tablo ve uç nokta için "başka firmanın kullanıcısı buna erişemez" testi yazılır.
- Yetki kontrolü her zaman sunucuda yapılır; arayüzde düğme gizlemek yalnızca kolaylıktır.
- Arayüz Türkçe, telefon öncelikli (teknisyen ekranları 360 px genişlikte ve büyük yazıda denenir).

## 3. Git
- Commit serbest, push yalnızca sahibin açık onayıyla (her push ayrı onay).
- `.claude/settings.local.json`, `.env*` git dışında.

## 4. Doğrulama kapısı
Kod iskeleti kurulunca doldurulacak (tip kontrolü, lint, test, derleme komutları ve neyi yakaladıkları).

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

## 6. Kod standartları (planlanan; kodlamada context7 ile güncel belgeden doğrulanacak)
- Next.js (App Router) + TypeScript (strict). Tek kod tabanı: arayüz + sunucu.
- PostgreSQL. Her firma verisi tablosunda `tenant_id`; uygulama katmanı filtresine ek olarak PostgreSQL Row-Level Security ikinci kilit.
- Para tutarları kuruş cinsinden tam sayı (integer); ondalıklı sayı kullanılmaz.
- Saat dilimi `Europe/Istanbul`; tarihler veritabanında UTC.
- Telefon numaraları `+905XXXXXXXXX` biçiminde normalize edilir.
- PWA + Web Push (VAPID); ücretsiz, SMS yok.
- Harita: MapLibre + OpenStreetMap verisi. Adres→koordinat ve rota için açık kaynak, kendi sunucuda (OSRM + VROOM aday; boyut ve RAM ihtiyacı 3. aşamada doğrulanacak). Geliştirmede herkese açık OSM servislerinin kullanım kurallarına uyulur (istek sınırı).
- Barındırmaya bağımlı olmayan yapı (Docker ile taşınabilir); sunucu kararı açık.

## 7. Kritik kırılma noktaları
- Türkçe büyük/küçük harf ve arama: `İ/i`, `I/ı` (`toLocaleUpperCase('tr-TR')`, veritabanında Türkçe karşılaştırma).
- iOS'ta Web Push yalnızca ana ekrana eklenmiş PWA'da çalışır.
- Türkiye adreslerinde otomatik konum bulma sık yanılır; iğne operatör/teknisyen onayıyla kaydedilir.

## 8. Proje yapısı
Kod iskeleti kurulunca yazılacak.

## 9. Mimari
Kod yazıldıkça modül modül yazılacak.

## 10. Test altyapısı
Kurulunca yazılacak. Zorunlu test grupları: firma izolasyonu, rol yetkileri, iş durumu geçişleri, para hesapları.

## 11. Bilinen sorunlar ve teknik borç
Henüz yok.

## 12. Hesaplar ve ortam
Henüz hesap açılmadı. Sırlar yalnızca `.env` dosyasında tutulur, buraya yazılmaz.
