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

Kontrast denetimi (2026-10-06): bütün metin çiftleri en az 4,5:1, alan çerçevesi ve odak halkası en az 3:1.

## Yazı, köşe, gölge
- Yazı tipi: Archivo (`latin-ext`, kendi sunucumuzdan). Başlıklar dar (`font-stretch: 75%`) ve kalın (800), gövde metni normal genişlikte.
- `--radius-control`: 6px, `--radius-card`: 8px, `--shadow-card`: açık temada `0 2px 0 rgba(15, 17, 19, 0.25)`, koyu temada `0 2px 0 rgba(0, 0, 0, 0.6)`
