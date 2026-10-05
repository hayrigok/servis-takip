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
1. 👤 **Yeni oturum aç.** Eklentiler yazıldı; devreye girmeleri için yeni bir oturum gerekiyor.
2. 🧭 **Eski programla ilgili üç soru.** Aşağıdaki "Bekleyen kararlar" 1, 2 ve 3. maddeler. 1. aşamadaki iş açma ekranını etkiliyor.
3. 👤 **Pilot firma.** Sistemi ilk deneyecek firma. Kendi işletmen en doğal aday, çünkü eski programdan geçiş yapacaksın. Gerçek teknisyenlerle denemek, satıştan önce en çok işe yarayacak adım.

## 🧭 Bekleyen kararlar
1. **💳 Veresiye: emin misin?**
   - Durum: "Sonra ödeme olmasın" dedin, ama şu an kullandığın programda "Ödenmedi" işareti ve "Ödenmeyenler" ekranı var.
   - Neyi etkiliyor: Tahsilat ekranı, kasa, patronun alacak listesi.
   - Önerim: Eski programdaki gibi olsun. İş biter, para alınmadıysa "Ödenmedi" işaretlenir, para gelince kasaya girer.
   - Ne zamana kadar: 2. aşamadan önce.
2. **🗃️ Eski programdaki kayıtlar taşınsın mı?**
   - Neyi etkiliyor: Geçiş günü, numara geçmişinin yeni sistemde de görünmesi.
   - Önerim: Evet. Eski programa dokunmadan, yedeğinin kopyasından kendi firmanın hesabına taşırım.
   - Ne zamana kadar: 1. aşamanın sonu.
3. **🧩 Eski programdaki özellikler yeni sisteme alınsın mı?** (telefonla hızlı iş açma, numara geçmişi, potansiyeller, hatırlatmalar, geciken işler, Excel'e aktarma)
   - Önerim: Hepsi. Telefonla hızlı iş açma, numara geçmişi ve geciken işler 1. aşamada; potansiyeller, hatırlatmalar ve Excel'e aktarma 4. aşamada.
   - Ne zamana kadar: 1. aşamadaki iş açma ekranına gelmeden.
4. **🖥️ Sunucu nerede dursun?**
   - Neyi etkiliyor: Verilerin hangi ülkede durduğu (KVKK), aylık maliyet, rota motorunun nerede çalışacağı.
   - Seçenekler: Hazır yurt dışı platform (bakımsız, ücretsiz başlar ama veri yurt dışında, rota motoru ayrı yer ister) ya da Türkiye'de kiralık sunucu (veri Türkiye'de, aylık sabit kira, rota motoru da aynı yerde).
   - Önerim: Türkiye'de kiralık sunucu. "Verileriniz Türkiye'de" satışta da güçlü bir argüman.
   - Ne zamana kadar: İlk firmaya açılmadan önce (5. aşama). Geliştirme senin bilgisayarında yapılır, şimdi sunucu gerekmez.
5. **🏷️ Ürünün adı ve alan adı (site adresi)**
   - Ne zamana kadar: 5. aşamadan önce.
6. **💰 Abonelik fiyatı nasıl olsun?** (firma başına sabit, kullanıcı başına, iş sayısına göre)
   - Ne zamana kadar: 5. aşamadan önce.

## 0️⃣ Tasarım ve kararlar
🎯 **Bitti sayılması için:** Temel kararlar alındı, belgeler kuruldu, eklentiler seçildi.
- [x] İlk tasarım önerisi sunuldu (2026-10-05)
- [x] Çok firma, fatura, tahsilat, bildirim, operatör stok kararları alındı (2026-10-05)
- [x] Akıllı rota tasarlandı (2026-10-05)
- [x] Yol haritası, yapılacaklar listesi ve proje kuralları yazıldı (2026-10-05)
- [x] Randevu biçimi (zaman aralığı) ve veresiye kararı alındı (2026-10-05)
- [x] Eklenti seçimi onaylandı ve yazıldı (2026-10-05)
- [x] Sahibin kullandığı eski masaüstü programı incelendi, özellikleri belgelendi (2026-10-05)
- [ ] 🧭 Eski programla ilgili üç soru (bekleyen kararlar 1, 2, 3)

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
- [ ] İş açma: müşteri, yapılacak iş, tarih, randevu (varsayılan zaman aralığı: 09-12 / 12-15 / 15-18; gerekirse kesin saat), teknisyen
- [ ] 🧭 Telefonla hızlı iş açma (eski programdaki gibi): tek zorunlu alan telefon, bilinen numarada isim ve adres kendiliğinden dolar, "bu numaraya N iş yapılmış" bilgisi. Teknisyene atamak için adres ve harita iğnesi gerekir (karar 3)
- [ ] 🧭 Geciken işler listesi (karar 3)
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

### Eski programdan geçiş
- [ ] 🧭 🔒 Eski programdaki kayıtları (yedeğin kopyasından, asıl dosyaya dokunmadan) kendi firmanın hesabına taşıma (karar 2)

## 2️⃣ Para ve stok
🎯 **Bitti sayılması için:** Teknisyen işi kapatırken parça ve tahsilat giriyor; stok düşüyor, kasa doğru topluyor; IBAN ödemesi onaylanana kadar bekleyen görünüyor.
- [ ] Depo stoğu: parça listesi, mal girişi, azalan parça uyarısı
- [ ] İşte kullanılan parça → stoktan otomatik düşme
- [ ] Operatörün stok adetlerini görmesi
- [ ] Tahsilat: nakit, kredi kartı, IBAN; IBAN için "hesaba geçti" onayı
- [ ] 🧭 "Ödenmedi" işareti ve ödenmeyenler listesi; şimdilik kapalı, teyit bekliyor (karar 1)
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
- [ ] 🧭 Potansiyeller: fiyat sorup kesinleşmeyenler; "İşi aldım" → iş kaydı (karar 3)
- [ ] 🧭 Hatırlatmalar: günü gelince panelde uyarı (karar 3)
- [ ] 🧭 Excel'e aktarma (karar 3)
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
