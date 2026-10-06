# 🎨 Servis Takip: Tasarım Sistemi

> Görsel kararların tek kaynağı. Değerler `src/app/globals.css` içindeki token'larla birebir aynıdır. Koda doğrudan renk yazılmaz.
>
> 🗓️ Son güncelleme: 2026-10-06

## Seçilen yön (2026-10-06, sahibin seçimi)
**Saha:** Siyah-sarı iş güvenliği dili, dar ve kalın başlıklar; sahada, güneş altında okunmak için kurulmuş sade bir iş aracı. Neden: Sahip önerilen yönü seçti. Güneş altında en yüksek kontrastı veriyor, uzun Türkçe kelimeler dar telefon ekranına sığıyor, servis işinin dünyasına (alet, iş güvenliği sarısı) benziyor ve hazır şablon gibi durmuyor. Diğer iki yön (A · Servis Fişi, C · Okunaklı) seçilmedi.

## Renk token'ları
| Token | Açık | Koyu | Kullanım |
|---|---|---|---|
| `bg` | #EDEFF1 | #0E1012 | Sayfa zemini |
| `surface` | #FFFFFF | #181B1F | Kart, form zemini |
| `surface-muted` | #E1E4E8 | #23272C | Sakin dolgu, seçili sekme |
| `fg` | #0F1113 | #F2F3F5 | Ana metin |
| `fg-muted` | #4A515A | #A9B0B9 | İkincil metin (≥ 4,5:1) |
| `border` | #C9CED5 | #2C3137 | Ayırıcı çizgi (süs) |
| `border-strong` | #5B636D | #6E7782 | Alan çerçevesi (≥ 3:1) |
| `primary` / `primary-hover` / `primary-fg` | #16191D / #2E343B / #FFD60A | #FFD60A / #FFE45C / #16191D | Ana eylem |
| `danger` / `danger-fg` / `danger-soft` | #B3261E / #FFFFFF / #FBE9E7 | #FF8A80 / #3A0905 / #3B1513 | Hata, geri alınamaz eylem |
| `success` / `success-soft` | #176B38 / #E1F2E6 | #6FD49A / #10301D | Başarı bildirimi |
| `warning` / `warning-soft` | #9A4A00 / #FFEBCC | #FFA149 / #3A2410 | Uyarı |
| `focus` | #0B57D0 | #7FB0FF | Odak halkası (≥ 3:1) |
| `band` / `band-fg` / `band-muted` | #16191D / #FFD60A / #C9CED5 | #181B1F / #FFD60A / #A9B0B9 | Üst bant ve alt menü: koyu zemin, etkin bağlantı sarı, diğerleri soluk |
| `signal` / `signal-fg` | #FFD60A / #16191D | #FFD60A / #16191D | Sarı işaret: marka, etkin sekme şeridi, öne çıkan rozet |

Kontrast `tests/unit/tasarim-kontrast.test.ts` ile her çalıştırmada denetlenir: bütün metin çiftleri en az 4,5:1, alan çerçevesi ve odak halkası en az 3:1. Başka dosyada renk kodu yazılırsa `tests/unit/renk-kodu-yasagi.test.ts` kırmızı verir.

## Yazı, köşe, gölge
- Yazı tipi: Archivo (`latin-ext`, kendi sunucumuzdan). Başlıklar dar (`font-stretch: 75%`) ve kalın (800), gövde metni normal genişlikte.
- `--radius-control`: 6px, `--radius-card`: 8px, `--shadow-card`: açık temada `0 2px 0 rgba(15, 17, 19, 0.25)`, koyu temada `0 2px 0 rgba(0, 0, 0, 0.6)`
- Rozet köşesi 4 px (`rounded-sm`).

## Yazı ölçeği
| Sınıf | Boyut | Nerede |
|---|---|---|
| `text-sm` | 14 px | Alan etiketi, ipucu, hata satırı, rozet |
| `text-base` | 16 px | Gövde metni, açıklama |
| `text-lg` | 18 px | Alan içi yazı, düğme |
| `text-xl` | 20 px | Pencere ve boş durum başlığı |
| `text-3xl` | 30 px | Sayfa başlığı |

- **`type-display`** (dar %75, 800, harf aralığı 0,03em): sayfa başlığı, pencere başlığı, düğmeler. Yönün imzası budur; gövde metninde kullanılmaz.
- Alan etiketleri küçük, kalın ve büyük harf (`labelClass`). Büyük harfe CSS çevirir; sayfa `lang="tr"` olduğu için "i" doğru biçimde "İ" olur ve ekran okuyucu özgün metni okur. Kaynak metin normal yazılır.
- Rozet metni de büyük harf ve kalın.

## Boşluk ve dokunma
- Boşluklar 4 px'in katları. Kart iç boşluğu telefonda 16, geniş ekranda 24 px.
- Dokunma hedefi en az 44 px. Saha yönünde düğmeler 48 px (`min-h-12`), form alanları 56 px (`min-h-14`), alt menü 56 px ve üstü.
- Alanlar 2 px çerçeveli. Odakta çerçeve koyulaşır ve 3 px odak halkası çıkar.

## Bileşenler ve ne zaman hangisi
| Bileşen | Kullanım |
|---|---|
| `Button` / `buttonClass` | `primary` ekranda bir tane (ana eylem). `secondary` ikinci eylem, `ghost` sakin eylem. `danger` yalnızca geri alınması zor işlemde. |
| `SubmitButton` | Form gönderimi. Beklerken düğme kilitlenir ve "…yor" metni gösterilir (ör. "Kaydediliyor"). |
| `TextField`, `PasswordField`, `SelectField`, `CheckboxField` | Her alanın görünür etiketi var. İpucu ve hata alanın altında, ekran okuyucuya bağlı (`aria-describedby`). Seçim için telefonun kendi listesi (`<select>`). |
| `Notice` | Sayfa düzeyinde bilgi. Hata `tone="error"` ve ekran okuyucuda hemen okunur. Renk tek başına bilgi vermez, simge ve metin eşlik eder. |
| `ConfirmDialog` | Geri alınması zor işlem: `tone="danger"` ile onay. Telefonda alttan açılır. |
| `Badge` | Kısa durum etiketi (rol, "Pasif", "Kilitli"). Sarı (`primary`) yalnızca öne çıkan durum için. |
| `Card`, `PageHeader`, `EmptyState`, `BackLink`, `Spinner` | Sayfa iskeleti. Boş liste her zaman `EmptyState` ile ne yapılacağını söyler. |

## İmza öğeleri
- Uygulamanın üstünde koyu bant (`band`) ve altında 4 px sarı şerit (`signal`). Etkin menü bağlantısı sarı yazı ve şeritle belirtilir, yalnızca renkle değil.
- Telefonda alt menüde etkin sekmenin üstünde 4 px sarı şerit.

## Hareket
- Yalnızca durum geçişleri (renk değişimi, düğme bekleme simgesi). Süs animasyonu yok.
- "Hareketi azalt" ayarında bütün geçişler kapanır (`globals.css`).

## Arayüz dili
- "Siz" dili, kısa cümleler. Düğmeler fiille biter ve sonucu söyler ("Kaydet", "Personel ekle", "Şifreyi sıfırla").
- Hata mesajı ne olduğunu ve ne yapılacağını söyler, kullanıcıyı suçlamaz. Ham İngilizce hata gösterilmez.
- Metinler `turkce-arayuz-metni` kurallarına uyar.

## Simgeler
- lucide (çizgi simgeler), 20-24 px. Simge her zaman metinle birlikte kullanılır. Yalnız simgeli düğmede `aria-label` zorunludur (ör. şifre göster/gizle).
