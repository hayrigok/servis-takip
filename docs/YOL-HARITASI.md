# 🗺️ Servis Takip: Yol Haritası

> 📌 Alınan kararlar (tarihli, gerekçeli), aşamalar ve sıradaki adım. Ayrıntılı iş listesi [YAPILACAKLAR.md](YAPILACAKLAR.md)'de.
>
> 🗓️ Son güncelleme: 2026-10-05

## 🎯 Ürün
Servis firmaları (kombi, klima, beyaz eşya vb.) için web tabanlı servis takip sistemi. Ofis müşteriyi kaydeder ve işi teknisyene atar. Teknisyen işini telefondan görür, kapatır, kullandığı parçayı ve aldığı parayı girer. Patron stoğu, kasayı ve raporları görür. **Birden çok firmaya abonelikle satılacak.**

## ✅ Alınan kararlar

- **Çok firmalı yapı (2026-10-05):** Sistem baştan birden çok firmaya hizmet verecek şekilde kurulur. Her firmanın verisi diğerlerinden tamamen ayrıdır. Gerekçe: Ürün satılacak. Bunu sonradan eklemek bütün veritabanını yeniden yazmak demektir. Etkisi: Girişte firma kodu da sorulur (iki firmada aynı kullanıcı adı olabilir), sistem sahibi için ayrı bir yönetim paneli gerekir.
- **Roller (2026-10-05):** Patron, Operatör, Teknisyen. Silme yetkisi yalnızca patronda; silinen kayıt 30 gün çöp kutusunda bekler. Teknisyen yalnızca kendisine atanan işlerin müşterisini görür, müşteri bilgisini değiştiremez. Ayrıntılı yetki tablosu CLAUDE.md'de.
- **Operatör stok adetlerini görür (2026-10-05):** Telefonda müşteriye "parça var" diyebilmesi için. Kasayı ve faturaları görmez.
- **Fatura yalnızca kayıt (2026-10-05):** Sistem alış ve satış faturalarını kaydeder, resmi e-Fatura/e-Arşiv kesmez. Gerekçe: Resmi fatura bir entegratör firmaya bağlanmayı ve yıllık ücreti gerektirir; başlangıçta firmalar faturayı mevcut yollarıyla kesmeye devam eder. İleride eklenebilir.
- **Tahsilat (2026-10-05):** Teknisyen ve ofis tahsilatı üç yolla girer: nakit, kredi kartı (firmanın kendi POS cihazıyla çekilir, sistem yalnızca kaydeder), IBAN (havale/EFT). IBAN ödemesi hesaba geçtiği onaylanana kadar "bekleyen tahsilat" görünür. Teknisyen kasanın toplamını görmez.
- **Bildirim ücretsiz telefon bildirimiyle (2026-10-05):** İş atanınca teknisyene telefon bildirimi gider, SMS kullanılmaz. iPhone'da bildirim için sitenin ana ekrana eklenmesi gerekir; ilk girişte bunu anlatan bir rehber gösterilir.
- **Mağaza uygulaması yok, web uygulaması (2026-10-05):** Site telefonun ana ekranına uygulama gibi eklenir. Gerekçe: Mağaza onayı ve iki ayrı uygulama bakımı gerekmez, güncellemeler anında herkese ulaşır.
- **Tek depo ile başlanır (2026-10-05):** Sahip bu soruyu yanıtlamadı, önerim uygulandı. Her teknisyenin araç stoğu sonraya bırakıldı. Sahip isterse değiştirilir.
- **Akıllı rota (2026-10-05):** Sahibin isteği. Sistem her teknisyenin günlük işlerini gerçek yol mesafesine göre sıralar ("yakından yakına"), randevu saatlerine uyar, teknisyen "Sıradaki işe git" deyince Google Haritalar ya da Yandex Navigasyon o adrese açılır. Her müşteri adresi bir kez haritada iğneyle işaretlenir, çünkü Türkiye adreslerini otomatik bulmak sık şaşar ve yanlış iğne yanlış rota demektir. Önerilen altyapı: kendi sunucumuzda çalışan ücretsiz, açık kaynaklı rota motoru (istek başına ücret yok, veri Türkiye'de kalır; canlı trafik hesaba katılmaz, navigasyon uygulaması yolda trafiği zaten hesaba katar). Konum iğnesi 1. aşamada, rota sıralama 3. aşamada.
- **Randevu zaman aralığıyla (2026-10-05):** İş açılırken varsayılan olarak zaman aralığı seçilir (09-12, 12-15, 15-18); gerekirse kesin saat de verilebilir. Gerekçe: Rota sıralaması aralıkla çok daha iyi kurulur, teknisyen "geç kaldı" durumuna düşmez.
- **Veresiye yok (2026-10-05):** Sahip "sonra ödeme olmasın" dedi. ⚠️ Sahibin şu an kullandığı masaüstü programında "Ödenmedi" işareti ve "Ödenmeyenler" ekranı var (iş biter, para sonra alınır). Bu çelişki sahibe soruldu; yanıta göre bu madde güncellenecek.
- **Geliştirme eklentileri (2026-10-05):** Sahip onayladı. Liste ve token maliyetleri `.claude/settings.local.json`'da; toplam yaklaşık 4.300 token/oturum.
- **Teknik altyapı (2026-10-05, Claude'un kararı):** Arayüz ve sunucu tek kod tabanında (Next.js + TypeScript), veritabanı PostgreSQL. Gerekçe: Yaygın, iyi belgelenmiş, her barındırma seçeneğinde çalışır; sunucu kararı sonraya bırakılabilir. Ayrıntılar CLAUDE.md'de.

## 🗃️ Mevcut program (2026-10-05'te bulundu)
Sahip bugün `D:\Projelerim\MÜŞTERİ TAKİP` klasöründeki masaüstü "Servis Takip" programını (Python, tek bilgisayar, internetsiz) kullanıyor; her gün otomatik yedek alıyor. Yeni sistem bu programın çok firmalı, çok kullanıcılı ve telefonlu hâlidir. Programdan öğrenilen ve sahibin alıştığı akışlar:
- **Telefon esaslı iş açma:** Tek zorunlu alan telefon; isim ve adres sonra yazılabilir. Aynı numara gelince "bu numaraya 3 iş yapılmış, son: …" görünür, bilinen isim ve adres kendiliğinden dolar.
- **Numara geçmişi:** Bir numaraya yapılan bütün işler, toplam tutar, son iş tarihi.
- **Potansiyeller** (fiyat sorup kesinleşmeyenler; "İşi aldım" → iş kaydı), **hatırlatmalar**, **geciken işler**, **ödenmeyenler**, iptal nedeni, Excel'e aktarma, günlük özet paneli, klavye kısayolları.
Bu özelliklerin yeni sisteme alınması ve eski kayıtların taşınması sahibe soruldu.

## ⏳ Açık kararlar
Ayrıntıları ve önerilerim [YAPILACAKLAR.md](YAPILACAKLAR.md) → "Bekleyen kararlar" bölümünde: veresiye teyidi, eski kayıtların taşınması, eski programdaki özellikler, sunucu yeri, ürün adı, abonelik fiyatı.

## 🧱 Aşamalar
1. [ ] **Çekirdek:** Çok firma altyapısı, giriş ve roller, müşteriler (harita iğnesiyle), iş açma ve atama, teknisyenin telefon ekranı, telefon bildirimi, silme yetkisi, çöp kutusu, işlem geçmişi
2. [ ] **Para ve stok:** Tahsilat (nakit, kart, IBAN), kasa, depo stoğu, işte kullanılan parça
3. [ ] **Akıllı rota:** Günlük sıralama, sıradaki işe git, elle sıra değiştirme, en yakın teknisyen önerisi
4. [ ] **Fatura ve rapor:** Alış ve satış fatura kayıtları, patron raporları
5. [ ] **Satışa hazırlık:** Sistem sahibi paneli, firma kaydı ve deneme süresi, abonelik, yasal metinler, sunucuya taşıma, yedekleme
6. [ ] **Sonrası:** Fikir havuzu (YAPILACAKLAR.md'nin sonunda)

## 👉 Sıradaki adım
Eklentiler onaylandı ve yazıldı. Sahip yeni bir oturum açınca 1. aşamaya başlanır: proje iskeleti, çok firmalı veritabanı, giriş ve roller. Eski programla ilgili üç soru 1. aşamadaki iş açma ekranını etkilediği için o ekrana gelmeden yanıtlanmalı. Sahibin şu anki işleri: [YAPILACAKLAR.md → Şu an senden beklenenler](YAPILACAKLAR.md#-şu-an-senden-beklenenler).
