# ✅ Servis Takip: Yapılacaklar Listesi

> 📌 Projenin ayrıntılı iş listesi. Bir iş bitince kutusunu işaretleyip tarihini yazarım. Kararlar ve gerekçeleri [YOL-HARITASI.md](YOL-HARITASI.md)'de.
>
> 🗓️ Son güncelleme: 2026-10-05

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
| 0️⃣ Tasarım ve kararlar | 🟡 Sürüyor |
| 1️⃣ Çekirdek | ⏳ Bekliyor |
| 2️⃣ Para ve stok | ⏳ Bekliyor |
| 3️⃣ Akıllı rota | ⏳ Bekliyor |
| 4️⃣ Fatura ve rapor | ⏳ Bekliyor |
| 5️⃣ Satışa hazırlık | ⏳ Bekliyor |

## 🙋 Şu an senden beklenenler
1. 🧭 **Eklenti seçimi.** Bu projede açılacak geliştirme eklentilerini onayla (listesi sohbette). Onaydan sonra yeni bir oturum açman gerekir.
2. 🧭 **Randevu saati biçimi.** Aşağıdaki "Bekleyen kararlar" 2. madde. 1. aşamadaki iş açma ekranını etkiliyor.
3. 👤 **Pilot firma.** Sistemi ilk deneyecek bir servis firması düşün (kendi işletmen de olabilir). Gerçek teknisyenlerle denemek, satıştan önce en çok işe yarayacak adım.

## 🧭 Bekleyen kararlar
1. **🖥️ Sunucu nerede dursun?**
   - Neyi etkiliyor: Verilerin hangi ülkede durduğu (KVKK), aylık maliyet, rota motorunun nerede çalışacağı.
   - Seçenekler: Hazır yurt dışı platform (bakımsız, ücretsiz başlar ama veri yurt dışında, rota motoru ayrı yer ister) ya da Türkiye'de kiralık sunucu (veri Türkiye'de, aylık sabit kira, rota motoru da aynı yerde).
   - Önerim: Türkiye'de kiralık sunucu. "Verileriniz Türkiye'de" satışta da güçlü bir argüman.
   - Ne zamana kadar: İlk firmaya açılmadan önce (5. aşama). Geliştirme senin bilgisayarında yapılır, şimdi sunucu gerekmez.
2. **🕐 Randevu: kesin saat mi, zaman aralığı mı?**
   - Neyi etkiliyor: İş açma ekranı ve rota sıralamasının kalitesi.
   - Önerim: Varsayılan zaman aralığı (09-12, 12-15, 15-18), gerekirse kesin saat de seçilebilsin. Aralık verilince sistem sırayı çok daha iyi kurar, teknisyen de "geç kaldı" durumuna düşmez.
   - Ne zamana kadar: 1. aşamada iş açma ekranına gelmeden.
3. **💳 Veresiye ("sonra ödeyecek") seçeneği olsun mu?**
   - Neyi etkiliyor: Tahsilat ekranı, müşterinin borç bakiyesi, patronun alacak raporu.
   - Önerim: Evet. Servis işinde sık görülür.
   - Ne zamana kadar: 2. aşamadan önce.
4. **🏷️ Ürünün adı ve alan adı (site adresi)**
   - Ne zamana kadar: 5. aşamadan önce.
5. **💰 Abonelik fiyatı nasıl olsun?** (firma başına sabit, kullanıcı başına, iş sayısına göre)
   - Ne zamana kadar: 5. aşamadan önce.

## 0️⃣ Tasarım ve kararlar
🎯 **Bitti sayılması için:** Temel kararlar alındı, belgeler kuruldu, eklentiler seçildi.
- [x] İlk tasarım önerisi sunuldu (2026-10-05)
- [x] Çok firma, fatura, tahsilat, bildirim, operatör stok kararları alındı (2026-10-05)
- [x] Akıllı rota tasarlandı (2026-10-05)
- [x] Yol haritası, yapılacaklar listesi ve proje kuralları yazıldı (2026-10-05)
- [ ] 🧭 Eklenti seçimi

## 1️⃣ Çekirdek
🎯 **Bitti sayılması için:** İki ayrı deneme firmasında operatör müşteri ekleyip iş atayabiliyor; teknisyen telefonundan bildirimi alıp işi görüyor ve kapatıyor; bir firma diğerinin hiçbir verisini göremiyor (otomatik testle kanıtlı); yetki testleri geçiyor.

### Altyapı
- [ ] Proje iskeleti, veritabanı, test altyapısı
- [ ] Çok firmalı veri yapısı: her kayıt bir firmaya bağlı, firmalar arası erişim iki kat kilitli ⚠️
- [ ] Deneme firması açma (basit; tam panel 5. aşamada)

### Giriş ve roller
- [ ] Firma kodu + kullanıcı adı + şifre ile giriş; telefon firma kodunu hatırlar
- [ ] Art arda yanlış şifrede geçici kilit 🔒
- [ ] Patronun personel hesabı açması, kapatması (işten ayrılanın geçmişi silinmez), şifre sıfırlaması
- [ ] Yetkilerin sunucuda kontrolü ve her rol için yetki testleri ⚠️

### Müşteriler
- [ ] Müşteri ekleme ve düzenleme: ad, telefon(lar), adres(ler), cihaz bilgisi, not
- [ ] Haritada iğne: sistem adresi bulur, operatör iğneyi düzeltir
- [ ] Telefon numarasıyla hızlı arama; aynı numara iki kez eklenince uyarı
- [ ] Müşterinin geçmiş servisleri
- [ ] 💡 Teknisyenin "bilgi yanlış" notu bırakması

### İşler
- [ ] İş açma: müşteri, yapılacak iş, tarih ve randevu (🧭 karar 2), teknisyen
- [ ] Durumlar: Yeni, Atandı, Tamamlandı, Ertelendi (yeni tarih + neden), Parça bekleniyor, Müşteri evde yok, İptal
- [ ] Her durum değişikliğinin kim ve ne zaman bilgisiyle kaydı
- [ ] Operatör panosu: atanmamış işler, teknisyen bazında bugünün işleri

### Teknisyenin telefon ekranı
- [ ] "Bugünkü işlerim" listesi; büyük düğmeler, tek elle kullanım
- [ ] İş ayrıntısı: Ara, Yol tarifi (Google Haritalar / Yandex), yapılacak iş, cihaz geçmişi
- [ ] İş kapandıktan birkaç gün sonra müşterinin adresi teknisyenin ekranından kalkar 🔒
- [ ] Ana ekrana ekleme rehberi (iPhone ve Android)
- [ ] İş atanınca telefon bildirimi

### Silme ve geçmiş
- [ ] Silme yalnızca patronda; çöp kutusu (30 gün içinde geri alma)
- [ ] İşlem geçmişi: kim, ne zaman, neyi değiştirdi (patron görür)

## 2️⃣ Para ve stok
🎯 **Bitti sayılması için:** Teknisyen işi kapatırken parça ve tahsilat giriyor; stok düşüyor, kasa doğru topluyor; IBAN ödemesi onaylanana kadar bekleyen görünüyor.
- [ ] Depo stoğu: parça listesi, mal girişi, azalan parça uyarısı
- [ ] İşte kullanılan parça → stoktan otomatik düşme
- [ ] Operatörün stok adetlerini görmesi
- [ ] Tahsilat: nakit, kredi kartı, IBAN; IBAN için "hesaba geçti" onayı
- [ ] 🧭 Veresiye ve müşteri borç bakiyesi (karar 3)
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
- [ ] 👤 Muhasebeciye fatura saklama süresini teyit ettir (genelde 10 yıl)

## 5️⃣ Satışa hazırlık
🎯 **Bitti sayılması için:** Yeni bir firma kendi hesabını açıp deneyebiliyor; sistem Türkiye'deki sunucuda yedekli çalışıyor; yasal metinler avukattan geçti.
- [ ] Sistem sahibi paneli: firma listesi, açma, dondurma, kullanım bilgisi (firmaların müşteri verisini görmez 🔒)
- [ ] Firma kaydı ve deneme süresi
- [ ] Abonelik ve ödeme alma 💰 (🧭 karar 5)
- [ ] 🧭 Sunucu seçimi (karar 1), taşıma, otomatik ve şifreli yedek 💰
- [ ] 🔒 KVKK veri envanteri, aydınlatma metni
- [ ] 👤 🔒 Avukat: firmalarla hizmet ve veri işleme sözleşmesi, aydınlatma metni kontrolü. Firmalar müşterilerinin verisinden sorumludur (veri sorumlusu), sen o veriyi onlar adına işlersin (veri işleyen).
- [ ] 👤 Abonelik faturası kesebilmek için şirket yapını muhasebecinle netleştir

## 🛠️ Bakım ve teknik borç
- Henüz yok.

## 🔭 Çıkıştan sonra: fikir havuzu
- 💡 Müşteriye "teknisyeniniz yolda" SMS'i 💰
- 💡 Müşteri imzası, iş öncesi ve sonrası fotoğraf
- 💡 İnternetin çekmediği yerde (bodrum) çalışma
- 💡 Resmi e-Fatura/e-Arşiv bağlantısı 💰
- 💡 Her teknisyenin araç stoğu
