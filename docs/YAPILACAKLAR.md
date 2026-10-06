# ✅ Servis Takip: Yapılacaklar Listesi

> 📌 Projenin ayrıntılı iş listesi. Bir iş bitince kutusunu işaretleyip tarihini yazarım. Kararlar ve gerekçeleri [YOL-HARITASI.md](YOL-HARITASI.md)'de.
>
> 🗓️ Son güncelleme: 2026-10-06

## 🔤 İşaretler
| İşaret | Anlamı |
|---|---|
| 👤 | Senin yapacağın iş |
| 🧭 | Senin vereceğin karar |
| ⚠️ | Dikkat: risk ya da kural |
| 💡 | Öneri: istersen ekleriz |
| 🔒 | Gizlilikle ilgili |
| 💰 | Para gerektiriyor |

İşareti olmayan işleri ben (Claude) yaparım.

## 📊 Genel durum
| Aşama | Durum |
|---|---|
| 0️⃣ Tasarım ve kararlar | ✅ Bitti |
| 1️⃣ Çekirdek | 🟡 Sürüyor (0/5 parça; Temel'in tasarımı ve planı hazır) |
| 2️⃣ Para ve stok | ⏳ Bekliyor |
| 3️⃣ Akıllı rota | ⏳ Bekliyor |
| 4️⃣ Fatura ve rapor | ⏳ Bekliyor |
| 5️⃣ Satışa hazırlık | ⏳ Bekliyor |

## 🙋 Şu an senden beklenenler
1. 👤 **Temel parçanın planını onayla ve yürütme yolunu seç.** Plan: [2026-10-06-temel.md](superpowers/plans/2026-10-06-temel.md). Teknik bir belge; ürün diliyle özetini sohbette verdim. Onaylamadan kod yazılmaz.
2. 👤 **Veritabanı kurulumunda yönetici izni.** Kurulum sırasında Windows bir kez "Bu uygulamanın değişiklik yapmasına izin veriyor musunuz?" diye sorabilir; onay vermen gerekecek. Ne zaman: plan onaylanınca, ilk görevde.
3. 🧭 **Görsel yön seçimi.** Ekranlar kodlanmadan önce 2-3 tasarım yönünü telefon ve masaüstü boyutunda göstereceğim; birini seçeceksin. Ne zaman: veritabanı kurulumundan hemen sonra.
4. 👤 **Pilot firma.** Sistemi ilk deneyecek bir servis firması düşün. Gerçek teknisyenlerle denemek, satıştan önce en çok işe yarayacak adım. Ne zamana kadar: 1. aşama bitince.

## 🧭 Bekleyen kararlar
Hiçbiri 1. aşamayı bekletmiyor.
1. **🖥️ Sunucu nerede dursun?**
   - Neyi etkiliyor: Verilerin hangi ülkede durduğu (KVKK), aylık maliyet, rota motorunun nerede çalışacağı.
   - Seçenekler: Hazır yurt dışı platform (bakımsız, ücretsiz başlar ama veri yurt dışında, rota motoru ayrı yer ister) ya da Türkiye'de kiralık sunucu (veri Türkiye'de, aylık sabit kira, rota motoru da aynı yerde).
   - Önerim: Türkiye'de kiralık sunucu. "Verileriniz Türkiye'de" satışta da güçlü bir argüman.
   - Ne zamana kadar: İlk firmaya açılmadan önce (5. aşama). Geliştirme senin bilgisayarında yapılır, şimdi sunucu gerekmez.
2. **🏷️ Ürünün adı ve alan adı (site adresi)**
   - Ne zamana kadar: 5. aşamadan önce.
3. **💰 Abonelik fiyatı nasıl olsun?** (firma başına sabit, kullanıcı başına, iş sayısına göre)
   - Ne zamana kadar: 5. aşamadan önce.

## 0️⃣ Tasarım ve kararlar
🎯 **Bitti sayılması için:** Temel kararlar alındı, belgeler kuruldu, eklentiler seçildi.
- [x] İlk tasarım önerisi sunuldu (2026-10-05)
- [x] Çok firma, fatura, tahsilat, bildirim, operatör stok kararları alındı (2026-10-05)
- [x] Akıllı rota tasarlandı (2026-10-05)
- [x] Yol haritası, yapılacaklar listesi ve proje kuralları yazıldı (2026-10-05)
- [x] Randevu biçimi (zaman aralığı) ve veresiye kararı alındı (2026-10-05)
- [x] Eklenti seçimi onaylandı ve yazıldı (2026-10-05)
- [x] Sahibin kendi kullandığı eski programın bu üründen ayrı kalmasına karar verildi: kayıt taşınmaz, özellikleri otomatik alınmaz (2026-10-05)

## 1️⃣ Çekirdek
🎯 **Bitti sayılması için:** İki ayrı deneme firmasında operatör müşteri ekleyip iş atayabiliyor; teknisyen telefonundan bildirimi alıp işi görüyor ve kapatıyor; bir firma diğerinin hiçbir verisini göremiyor (otomatik testle kanıtlı); yetki testleri geçiyor.

### 🧩 Parçalar (her biri: tasarım → plan → kod)
- [ ] **Temel:** iskelet, çok firma altyapısı, giriş, roller, personel. Tasarım ✅ (2026-10-06) · Plan ✅ (2026-10-06) · Kod ⏳
- [ ] **Müşteriler** (harita iğnesi dahil)
- [ ] **İşler ve operatör panosu**
- [ ] **Teknisyenin telefon ekranı ve bildirim**
- [ ] **Çöp kutusu ve işlem geçmişi ekranı**

### Altyapı
- [ ] Geliştirme veritabanının bu bilgisayara kurulması (👤 yönetici izni gerekebilir)
- [ ] 🧭 Görsel yön seçimi ve tasarım sistemi (renkler, yazı tipi, açık/koyu tema)
- [ ] Proje iskeleti, veritabanı, test altyapısı
- [ ] Çok firmalı veri yapısı: her kayıt bir firmaya bağlı, firmalar arası erişim iki kat kilitli ⚠️
- [ ] Deneme firması açma (basit; tam panel 5. aşamada)

### Giriş ve roller
- [ ] Firma kodu + kullanıcı adı + şifre ile giriş; telefon firma kodunu hatırlar
- [ ] Art arda yanlış şifrede geçici kilit 🔒
- [ ] Patronun personel hesabı açması, kapatması (işten ayrılanın geçmişi silinmez), şifre sıfırlaması (geçici şifreyle; kişi ilk girişte kendi şifresini belirler)
- [ ] "Sahaya çıkar" işareti: patron ve operatöre de iş atanabilir
- [ ] Yetkilerin sunucuda kontrolü ve her rol için yetki testleri ⚠️

### Müşteriler
- [ ] Müşteri ekleme ve düzenleme: ad, telefon(lar), adres(ler), cihaz bilgisi, not
- [ ] Haritada iğne: sistem adresi bulur, operatör iğneyi düzeltir
- [ ] Telefon numarasıyla hızlı arama; aynı numara iki kez eklenince uyarı
- [ ] Müşterinin geçmiş servisleri
- [ ] 💡 Teknisyenin "bilgi yanlış" notu bırakması

### İşler
- [ ] İş açma: müşteri, yapılacak iş, tarih, randevu (varsayılan zaman aralığı: 09-12 / 12-15 / 15-18; gerekirse kesin saat), teknisyen
- [ ] Durumlar: Yeni, Atandı, Tamamlandı, Ertelendi (yeni tarih + neden), Parça bekleniyor, Müşteri evde yok, İptal
- [ ] Her durum değişikliğinin kim ve ne zaman bilgisiyle kaydı
- [ ] Operatör panosu: atanmamış işler, teknisyen bazında bugünün işleri, günü geçmiş işler

### Teknisyenin telefon ekranı
- [ ] "Bugünkü işlerim" listesi; büyük düğmeler, tek elle kullanım
- [ ] İş ayrıntısı: Ara, Yol tarifi (Google Haritalar / Yandex), yapılacak iş, cihaz geçmişi
- [ ] İş kapandıktan birkaç gün sonra müşterinin adresi teknisyenin ekranından kalkar 🔒
- [ ] Ana ekrana ekleme rehberi (iPhone ve Android)
- [ ] İş atanınca telefon bildirimi

### Silme ve geçmiş
- [ ] Silme yalnızca patronda; çöp kutusu (30 gün içinde geri alma)
- [ ] İşlem geçmişi: kim, ne zaman, neyi değiştirdi (patron görür). Kaydı Temel parçada başlar, ekranı bu parçada.

## 2️⃣ Para ve stok
🎯 **Bitti sayılması için:** Teknisyen işi kapatırken parça ve tahsilat giriyor; stok düşüyor, kasa doğru topluyor; IBAN ödemesi onaylanana kadar bekleyen görünüyor.
- [ ] Depo stoğu: parça listesi, mal girişi, azalan parça uyarısı
- [ ] İşte kullanılan parça → stoktan otomatik düşme
- [ ] Operatörün stok adetlerini görmesi
- [ ] Tahsilat: nakit, kredi kartı, IBAN; IBAN için "hesaba geçti" onayı
- [ ] Kasa: gelir, gider, bakiye (yalnızca patron)

## 3️⃣ Akıllı rota
🎯 **Bitti sayılması için:** Teknisyenin günlük işleri gerçek yol mesafesine göre sıralanıyor, randevu saatleri korunuyor, iş eklenince ya da ertelenince sıra yenileniyor.
- [ ] Rota motorunun kurulumu (Türkiye haritasıyla)
- [ ] Günlük sıralama: başlangıç noktası (firma ya da teknisyenin konumu), randevulara uyum
- [ ] "Sıradaki işe git" düğmesi
- [ ] Teknisyenin sırayı elle değiştirmesi
- [ ] Yeni iş açılırken en yakın ve müsait teknisyen önerisi
- [ ] Teknisyenin yerinde "konumu buraya düzelt" demesi

## 4️⃣ Fatura ve rapor
🎯 **Bitti sayılması için:** Patron alış ve satış faturalarını girip listeleyebiliyor, aylık raporda ciro ve teknisyen performansı doğru çıkıyor.
- [ ] Alış faturaları (tedarikçi, tutar, KDV, mal girişiyle bağlantı)
- [ ] Satış faturaları (müşteri ve işle bağlantı)
- [ ] Raporlar: günlük ve aylık ciro, teknisyen başına biten iş, bekleyen işler, en çok kullanılan parçalar
- [ ] Excel'e aktarma: işler, kasa hareketleri, alış ve satış faturaları (patron; muhasebeciye vermek için)
- [ ] 👤 Muhasebeciye fatura saklama süresini teyit ettir (genelde 10 yıl)

## 5️⃣ Satışa hazırlık
🎯 **Bitti sayılması için:** Yeni bir firma kendi hesabını açıp deneyebiliyor; sistem Türkiye'deki sunucuda yedekli çalışıyor; yasal metinler avukattan geçti.
- [ ] Sistem sahibi paneli: firma listesi, açma, dondurma, kullanım bilgisi (firmaların müşteri verisini görmez 🔒)
- [ ] Firma kaydı ve deneme süresi
- [ ] Abonelik ve ödeme alma 💰 (🧭 karar 3)
- [ ] 🧭 Sunucu seçimi (karar 1), taşıma, otomatik ve şifreli yedek 💰
- [ ] 🔒 KVKK veri envanteri, aydınlatma metni
- [ ] 👤 🔒 Avukat: firmalarla hizmet ve veri işleme sözleşmesi, aydınlatma metni kontrolü. Firmalar müşterilerinin verisinden sorumludur (veri sorumlusu), sen o veriyi onlar adına işlersin (veri işleyen).
- [ ] 👤 Abonelik faturası kesebilmek için şirket yapını muhasebecinle netleştir

## 🛠️ Bakım ve teknik borç
- Henüz yok.

## 🔭 Çıkıştan sonra: fikir havuzu
Seçtiğin fikir ilgili aşamaya taşınır.
- 💡 **Periyodik bakım hatırlatması:** Kombi ve klimanın yıllık bakım zamanı gelen müşteriler listelenir, operatör arar. Firmaya kendiliğinden yeni iş getirir. ⚠️ Kampanya amaçlı arama ya da mesaj için müşterinin önceden izni (İYS) gerekir.
- 💡 **Garanti takibi:** Yapılan işin garanti süresi kaydedilir. Müşteri aynı arızayla yeniden arayınca operatör "garanti kapsamında" uyarısını görür. Müşteriyle tartışmayı ve para kaybını önler.
- 💡 **Hizmet ve fiyat listesi:** Sık yapılan işler fiyatlarıyla kaydedilir, teknisyen işi seçince tutar kendiliğinden dolar. Fiyat teknisyene göre değişmez, iş daha hızlı kapanır.
- 💡 **Servis fişi:** İş bitince yapılan işi, parçaları ve tutarı gösteren fiş oluşur, teknisyen müşteriye WhatsApp'tan gönderir. Firmaya kurumsal görünüm kazandırır, ücretsizdir.
- 💡 **Müşteri imzası ve fotoğraf:** İşin öncesi ve sonrası fotoğraflanır, müşteri ekrana imza atar. "Bu iş yapılmadı" tartışmasında firmanın elinde kanıt olur. 💰 Fotoğrafları saklamak küçük bir ek maliyet.
- 💡 **Müşteri memnuniyeti:** İş bitince müşteriye tek soruluk değerlendirme bağlantısı gider. Patron teknisyen başına puanı görür. WhatsApp ile ücretsiz, SMS ile 💰.
- 💡 **"Teknisyeniniz yolda" mesajı:** Müşteri evde hazır bekler, "müşteri evde yok" durumu azalır. 💰 Her SMS ücretli.
- 💡 **İnternet çekmeyen yerde çalışma:** Teknisyen bodrumda da işi kapatır, bilgi internet gelince gönderilir. Teknik olarak en zor fikir.
- 💡 **Araç stoğu:** Her teknisyenin aracındaki parça ayrı izlenir. Parçanın nerede olduğu bilinir, depo ile araç arasında kayıp olmaz.
- 💡 **Resmi e-Fatura:** Fatura sistemden resmi olarak kesilir, muhasebeye ayrıca girilmez. 💰 Entegratör firmaya yıllık ücret.
