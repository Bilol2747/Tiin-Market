# Tiim Market Bosh Sahifasi Loyihasi — CLAUDE.md

## Loyiha haqida
**Tiin Supermarket** uchun savdo tahlil paneli (retail analytics dashboard).
Savdo, ABC tahlil, mahsulot/savat tahlili, zaxira, ta'minotchilar va zakas (buyurtma) uchun **Single Page Application (SPA)**.

- **Til:** O'zbek tili (UI), ba'zi mahsulot nomlari ruscha
- **Joylashuv:** Toshkent, O'zbekiston

> **Tez orientatsiya uchun:**
> - Qaysi bo'lim qaysi faylda joylashgani → [KODLAR_XARITASI.md](KODLAR_XARITASI.md)
> - Oxirgi/joriy ishlar holati → [ISHLAR_JURNALI.md](ISHLAR_JURNALI.md) (yangi chatda ishni davom ettirishdan oldin shu faylni o'qing)
> - Backend/frontend arxitekturasini qayta qurish holati → [ARXITEKTURA_QAYTA_QURISH.md](ARXITEKTURA_QAYTA_QURISH.md)

---

## Texnologiya Steki
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+) — hech qanday framework yo'q. Vizualizatsiya: Chart.js 4.4.1 (CDN).
- **Backend (data pipeline):** Python — Invan API'dan mahsulot/sotuv ma'lumotini oladi, Turso (libSQL) bazasiga sinxronlaydi, sayt HTML'ini qayta quradi.
- **Avtomatlashtirish:** GitHub Actions (`.github/workflows/sync.yml`) — **har 30 daqiqada** avtomatik ishga tushadi, natijani `main`ga o'zi commit+push qiladi.
- **Hosting:** Vercel — repo ROOT'dagi `index.html`'ni to'g'ridan-to'g'ri (zero-config, statik) serve qiladi.
- **Autentifikatsiya (admin panel):** Firebase Firestore (`p_nazorat` bo'limi, foydalanuvchi ruxsatlari).

## Muhim arxitektura eslatmasi
`index.html` va `sales.html` — ikkalasi ham **avtomatik generatsiya qilinadigan** fayllar (~47MB), ichida barcha bo'limlarning ma'lumoti `<script id="p1data">`, `<script id="p2data">` kabi bloklarda joylashgan (JSON fetch qilinmaydi — faqat `data_history.json` va `data_abc.json` frontendda alohida `fetch()` qilinadi, qolganlari HTML ichiga joylashtirilgan). Bu fayllarni **qo'lda tahrirlash mantiqsiz** — keyingi avtomatik build (30 daqiqa ichida) ustidan yozib yuboradi. Kodni o'zgartirish uchun backend `build_p*data()` funksiyalarini yoki frontend `sales_runtime.js`ni tahrirlash kerak — xarita: [KODLAR_XARITASI.md](KODLAR_XARITASI.md).

**CI-kritik fayllarni papkaga ko'chirish yoki qayta nomlash xavfli** — ro'yxat va sabab [KODLAR_XARITASI.md](KODLAR_XARITASI.md#ci-kritik-fayllar--rootda-qolishi-shart)da. Real Invan API/Turso token faqat GitHub Actions sirlarida bor, shuning uchun to'liq pipeline'ni lokal test qilib bo'lmaydi — o'zgarishlarni sintaksis/import/qo'lda smoke-test bilan tekshirib, foydalanuvchi bilan kelishib push qilish kerak.

---

## Ilovaning bo'limlari (SPA sahifalari)

| Bo'lim | Nomi |
|---|---|
| p1 | Bosh sahifa — KPI kartochkalar, kunlik/haftalik daromad, top kategoriya/mahsulot/xodim, ABC yig'ma |
| p2 | Mahsulotlar — qidiruv, savat tahlili, kunlik savdo grafigi, mahsulot kartochkasi |
| p3 | ABC tahlili — A/B/C va C1/C2/C3 tasnif, har mahsulot uchun sabab/tavsiya |
| p5 | Stock / Zaxira — inventar holati |
| p6 | Suppliers — ta'minotchilar kesimida daromad/ABC (jami va oylik) |
| p7 | Buyurtma / Zakas — yetkazib beruvchiga buyurtma tavsiyasi ("oddiy" va "chuqur" rejim) |
| p10 | Kategoriyalar — kategoriya→subkategoriya→mahsulot kesimida tushum/tannarx/foyda/marja/ABC, sana oralig'i tanlanadigan (p6 Suppliers'ga o'xshash, lekin kategoriya kesimida) |
| p_nazorat | Nazorat — admin panel, foydalanuvchi ruxsatlari (Firebase) |

Har bo'limning aniq fayl/qator manzili uchun: [KODLAR_XARITASI.md](KODLAR_XARITASI.md)

---

## Backend pipeline (qisqacha)
```
fetch_api_data.py → turso_sync.py → build_all_from_api.py → index.html/sales.html + data_*.json
```
To'liq tafsilot, CI-kritik fayllar ro'yxati va `arxiv/` papkasi tarkibi: [KODLAR_XARITASI.md](KODLAR_XARITASI.md)

---

## Dizayn Tizimi (Ranglar)
- **Asosiy:** `#1D9E75` (yashil)
- **Ikkinchi:** `#534AB7` (binafsha)
- **Accent:** `#EF9F27` (to'q sariq), `#E24B4A` (qizil)

---

## Muhim Eslatmalar
- Hamma narsa o'zbek tilida, foydalanuvchilar supermarket menejerlari.
- Savdo ko'rsatkichlari (daromad, cheklar, ABC taqsimot va h.k.) doimiy o'zgarib turadi (har 30 daqiqada yangilanadi) — aniq raqamlarni bu faylga yozib qo'yish o'rniga, kerak bo'lganda joriy `data_daily.json`/`index.html` ichidan o'qing.
