# Tiim Market Bosh Sahifasi Loyihasi — CLAUDE.md

## Loyiha haqida
**Tiin Supermarket** uchun savdo tahlil paneli (retail analytics dashboard).  
Savdo ma'lumotlarini ko'rish, ABC tahlil va mahsulot savat tahlili uchun yaratilgan **Single Page Application (SPA)**.

- **Til:** O'zbek tili (UI), ba'zi mahsulot nomlari ruscha
- **Davr:** May 2026 savdo ma'lumotlari
- **Joylashuv:** Toshkent, O'zbekiston

---

## Texnologiya Steki
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+) — hech qanday framework yo'q
- **Vizualizatsiya:** Chart.js 4.4.1 (CDN orqali)
- **Ma'lumotlar:** JSON fayllar (backend yo'q, server yo'q)
- **Arxitektura:** To'liq client-side, statik fayllar

---

## Fayl Strukturasi
```
C:\Tiim Market Base Loyihasi
├── tiin_dashboard.html              # Asosiy SPA (19.5 MB) — ASOSIY FAYL
├── tiin_dashboard_KOD (1).html      # Kod nusxasi/zaxira (45 KB)
├── data_boshsahifa.json             # Bosh sahifa uchun yig'ma statistika (2.5 KB)
├── data_mahsulotlar.json            # Mahsulot + savat tahlili (9.4 MB)
├── data_abc.json                    # ABC kategoriya tahlili (7.5 MB)
└── CLAUDE.md                        # Bu fayl
```

---

## Ma'lumotlar Sxemasi

### data_boshsahifa.json
```json
{
  "gross": 10326909275,     // Jami daromad (so'm)
  "refund": 197480420,      // Qaytarishlar
  "refund_pct": 1.91,       // Qaytarish foizi
  "receipts": 45556,        // Jami cheklar
  "avg_check": 226686,      // O'rtacha chek
  "sku": 12356,             // Mahsulot turlari soni
  "staff": 15,              // Xodimlar soni
  "daily": [...],           // 31 kunlik daromad
  "weekly": [...],          // Hafta kunlari bo'yicha
  "top_cats": [...],        // Top 8 kategoriya
  "top_items": [...],       // Top 8 mahsulot
  "top_emp": [...],         // Top 8 xodim
  "abc": {...},             // ABC tahlil yig'masi
  "best_day": {...},
  "worst_day": {...}
}
```

### data_mahsulotlar.json
Mahsulot nomi kalit sifatida. Har bir mahsulotda:
- `r`: rank, `rev`: daromad, `rp`: foiz, `qty`: miqdor, `rec`: cheklar
- `p`: narx, `kg`: vazn bilan sotiladimi, `ld`: oxirgi sana, `cat`: kategoriya, `abc`: ABC guruhi
- `b`: birga sotib olingan mahsulotlar (savat tahlili) — `[{n, c}]`
- `d`: 31 kunlik savdo miqdori massivi

### data_abc.json
Mahsulotlar massivi. Har birida qo'shimcha:
- `sub`: kichik kategoriya (C1, C2, C3)
- `di`: oxirgi savdodan o'tgan kunlar
- `why`: [4 ta sabab] — nima uchun bu kategoriyada
- `how`: [3-4 ta tavsiya] — qanday yaxshilash mumkin

---

## Ilovaning 3 Sahifasi (Tab)

### 1. Bosh sahifa
- 6 KPI kartochka: daromad, cheklar, o'rtacha chek, SKU, qaytarish %, xodimlar
- Kunlik daromad grafigi (May 2026)
- Top kategoriyalar (gorizontal bar)
- Top 8 mahsulot va xodim reytingi
- Haftalik savdo, ABC donut chart

### 2. Mahsulot tahlili
- Mahsulot qidirish (12,333 mahsulot, autocomplete)
- Savat tahlili — birga sotib olinganlar
- Kunlik savdo grafigi
- Mahsulot ma'lumot kartochkasi

### 3. ABC tahlili
- A guruhi: 2,924 mahsulot → daromadning 80%
- B guruhi: 4,017 mahsulot → daromadning 15%
- C guruhi: 5,392 mahsulot → daromadning 5%
- C1: 2,418 dona — chiqarib yuborish tavsiya etiladi
- Har bir mahsulot uchun sabab va tavsiyalar

### Kelajakdagi tablar (tez kunda)
- Xodimlar, Kreativ, Trend

---

## Asosiy JavaScript Funksiyalari
- `showPage(n)` — tab almashtirish
- `fmt(n)` — raqam formatlash (mlrd/mln/ming)
- `esc(s)` — XSS himoyasi uchun HTML escaping
- `renderP2()` — mahsulot tahlili render
- `renderTable3()` — ABC jadvali + filter
- `showDetail3(i)` — mahsulot detail ko'rinishi

## Ma'lumotlar yuklash tartibi
1. P1 (bosh sahifa) — sahifa yuklanishida avtomatik
2. P2 (mahsulotlar) — 2-tab bosilganda lazy load
3. P3 (ABC) — 3-tab bosilganda lazy load

---

## Dizayn Tizimi (Ranglar)
- **Asosiy:** `#1D9E75` (yashil)
- **Ikkinchi:** `#534AB7` (binafsha)
- **Accent:** `#EF9F27` (to'q sariq), `#E24B4A` (qizil)

---

## Savdo Ko'rsatkichlari (May 2026)
| Ko'rsatkich | Qiymat |
|---|---|
| Jami daromad | 10.33 mlrd so'm |
| Jami cheklar | 45,556 |
| O'rtacha chek | 226,686 so'm |
| SKU soni | 12,356 |
| Xodimlar | 15 |
| Qaytarish | 1.91% |
| Top kategoriya | Tortlar va shirinliklar — 1.87 mlrd |
| Top mahsulot | President sariyog' 82% — 129.2 mln |
| Top xodim | Shohrux Bahromov — 3.5 mlrd, 14,935 chek |
| Eng yaxshi kun | Juma — 1.84 mlrd |
| Eng zaif kun | Payshanba — 1.12 mlrd |

---

## Muhim Eslatmalar
- **Backend yo'q** — barcha hisob-kitob brauzerda
- **API yo'q** — JSON fayllardan to'g'ridan-to'g'ri o'qiladi
- Asosiy fayl `tiin_dashboard.html` — bu 19.5 MB, ichida ma'lumotlar ham bor
- `tiin_dashboard_KOD (1).html` — bu kod ko'rinishi/zaxira versiyasi
- Hamma narsa o'zbek tilida, foydalanuvchilar supermarket menejerlari
