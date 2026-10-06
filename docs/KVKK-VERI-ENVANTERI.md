# 🔒 Servis Takip: KVKK Veri Envanteri

> 📌 Sistemin hangi kişisel veriyi neden, nerede ve ne kadar süre tuttuğu. Her yeni parçada güncellenir.
>
> ⚠️ **Bu bir taslaktır, hukuki görüş değildir.** Hukuki sebepler ve süreler yayından önce avukatla doğrulanacak (5. aşama).
>
> 🗓️ Son güncelleme: 2026-10-06 (Temel parça)

## 👥 Roller
- **Servis firması = veri sorumlusu.** Kendi personelinin (ve sonraki parçalarda müşterilerinin) verisinden sorumludur.
- **Platform (biz) = veri işleyen.** Veriyi firma adına, firmanın talimatıyla işleriz. Firmalarla veri işleme sözleşmesi yapılacak (avukat, 5. aşama).
- Her firmanın verisi diğerlerinden iki kat kilitle ayrıdır (uygulama filtresi + veritabanı satır güvenliği); bir firmanın kullanıcısı başka firmanın hiçbir kaydını göremez (otomatik testle kanıtlı).

## 📋 Envanter (Temel parça)
| Veri | Amaç | Hukuki sebep (taslak) | Nerede | Ne kadar süre | Kimlerle |
|---|---|---|---|---|---|
| Personelin ad soyadı, kullanıcı adı, rolü, "Sahaya çıkar" işareti | Hesap ve yetki | Sözleşmenin ifası (firma ile personel arasındaki iş ilişkisi); platform veri işleyen | PostgreSQL (geliştirme: bu bilgisayar; üretim: sunucu kararı, bkz. YAPILACAKLAR "Bekleyen kararlar" 1) | Hesap süresince; pasifleştirilen hesap geçmiş kayıtlar için tutulur (süre belirlenecek) | Aynı firmanın patronu; kişinin kendisi (Hesabım) |
| Şifre özeti (argon2id) | Giriş | Sözleşmenin ifası | PostgreSQL | Hesap süresince | Kimse (geri çevrilemez; geçici şifre yalnızca bir kez ekranda gösterilir, saklanmaz) |
| Hatalı deneme sayısı, kilit bitiş zamanı | Hesabı tahmin saldırısına karşı korumak | Meşru menfaat (bilgi güvenliği) | PostgreSQL | Başarılı girişte sıfırlanır | Kimse (patron yalnızca "Kilitli" durumunu görür) |
| Son giriş zamanı | Güvenlik; patronun hesabın kullanılıp kullanılmadığını görmesi | Meşru menfaat | PostgreSQL | Hesap süresince | Aynı firmanın patronu |
| Oturum belirteci özeti (SHA-256), başlangıç ve bitiş zamanı | Oturumu sürdürmek | Sözleşmenin ifası | PostgreSQL + `oturum` çerezi (zorunlu çerez) | En fazla 30 gün; çıkışta, şifre değişince ya da pasifleştirmede silinir | Kimse |
| `firma_kodu` çerezi (firma kodu) | Girişte firma kodunu yeniden yazdırmamak | Zorunlu çerez (kullanıcının istediği hizmet) | Kullanıcının tarayıcısı | 1 yıl | Kimse |
| İşlem geçmişi: kim, ne zaman, ne yaptı; değişen alanların eski/yeni değeri (ör. ad soyad, rol) | Güvenlik ve hesap verebilirlik | Meşru menfaat | PostgreSQL (firmaya ayrılmış, yalnızca eklenir, değiştirilemez) | Belirlenecek (1. aşamanın 5. parçası) | Aynı firmanın patronu (ekranı 5. parçada) |
| IP adresi | Aynı yerden çok sayıda hatalı girişi sınırlamak | Meşru menfaat (bilgi güvenliği) | **Yalnızca sunucu belleği**; veritabanına ve loga yazılmaz | En fazla 15 dakika (sunucu yeniden başlayınca silinir) | Kimse |

Firma adı ve kodu kural olarak kişisel veri değildir; ancak şahıs firmalarında firma adı kişinin adını içerebilir. Bu yüzden firma bilgisi de aynı özenle korunur.

## 🌍 Yurt dışına aktarım
**Yok.**
- Yazı tipi (Archivo) derleme sırasında indirilip kendi sunucumuzdan verilir; kullanıcının tarayıcısı Google'a bağlanmaz.
- Next.js telemetrisi bu bilgisayarda kapalı. Üretim sunucusunda da kapatılacak (`NEXT_TELEMETRY_DISABLED=1`, 5. aşama).
- Analitik, hata raporlama, e-posta ya da SMS servisi yok.
- Uçtan uca testlerde kullanılan görünmez tarayıcı yalnızca geliştirme aracıdır ve yalnızca uydurma test verisiyle çalışır.

## 🍪 Çerezler
Yalnızca zorunlu çerezler var: `oturum` (giriş), `firma_kodu` (firma kodunu hatırlama). İkisi de `httpOnly` ve `SameSite=Lax`, canlıda yalnızca HTTPS ile gönderilir. Analitik ya da reklam çerezi yok; bu yüzden çerez bandı gerekmiyor (avukatla doğrulanacak).

## 🛡️ Teknik tedbirler
- Şifreler argon2id ile, oturum belirteçleri SHA-256 özetiyle saklanır; düz hali hiçbir yerde tutulmaz.
- 5 hatalı denemede hesap 15 dakika kilitlenir; aynı adresten 15 dakikada 20 hatalı denemeden sonra giriş durdurulur; mevcut şifre 15 dakikada 5 kez denenebilir.
- Uygulama loglarına ad, telefon, adres, şifre, belirteç ya da IP yazılmaz: yalnızca olay adı, kimlikler, hata kodu ve hatanın kod satırları; kişisel veri içerebilecek hata mesajı atılır (otomatik testle denetlenir). Kullanıcı yalnızca hata kodunu görür.
- Yetki her istekte sunucuda denetlenir; personel bilgisini yalnızca patron görür.
- `.env` (veritabanı şifreleri) git dışındadır; Linux sunucuda yalnızca sahibinin okuyabileceği izinle (0600) yazılır (Windows'ta bu izin etkisizdir, geliştirme bilgisayarı kişiseldir).

## ⏳ Açık konular (avukat ve sonraki parçalar)
- [ ] Hukuki sebeplerin ve saklama sürelerinin avukatla doğrulanması (5. aşama)
- [ ] Pasifleştirilen personel verisinin ne kadar tutulacağı ve sonra anonimleştirilmesi
- [ ] İşlem geçmişi saklama süresi (5. parça). Geçmiş kayıtlar uygulama tarafından değiştirilemez; bir silme isteğinde içlerindeki adların anonimleştirilmesi için yönetici yetkisiyle çalışan ayrı bir işlem gerekecek.
- [ ] Personel için aydınlatma metni (firmanın veri sorumlusu olarak vermesi; şablonu biz sunarız)
- [ ] Şifreli yedekleme ve veri ihlali durumunda yapılacaklar (5. aşama)
- [ ] Müşteri verisi (ad, telefon, adres, konum iğnesi) Müşteriler parçasında bu tabloya eklenecek
