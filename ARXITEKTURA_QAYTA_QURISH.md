# Arxitekturani qayta qurish — holat va yo'l xaritasi

Bu fayl — backend/frontend'ni haqiqiy ma'noda ajratish loyihasining **doimiy holat hujjati**. Yangi chatda ishni davom ettirishdan oldin shu faylni o'qing (xuddi [ISHLAR_JURNALI.md](ISHLAR_JURNALI.md) kabi).

## Nega bu ish boshlandi

- `index.html`/`sales.html` — har biri ~52MB. Sabab: haqiqiy backend (doim ishlaydigan server) yo'q — GitHub Actions har 30 daqiqada butun ma'lumotni HTML ichiga "pishiradi" (`backend_html_embed.py`), Vercel esa shu tayyor faylni zero-config statik serve qiladi.
- `.github/workflows/sync.yml`da git tarixini "squash + force-push" qilish **har 30 daqiqada avtomatik** ishlaydi (avvalgi taxmin — bu qo'lda bajariladigan davriy vazifa — noto'g'ri edi). Bu — hozirgi arxitekturaning haqiqiy zo'riqishini ko'rsatadi.
- `invdata`/`p2data`/`dailydata`/`supplierdata` har biri **UCH marta** saqlanadi: alohida `data_*.json` fayl + `index.html` ichida + `sales.html` ichida (dasturiy tekshirilgan — barchasi bir xil tuzilishga ega).
- Kutilmagan topilma: `sales_api_client.js` — haqiqiy `/api/v1/bootstrap` va h.k. endpoint'lariga mo'ljallangan REST client (`window.TiinDataAPI`) allaqachon mavjud, lekin hech qanday backend bu route'larni servis qilmaydi va faqat bitta joyda (p2) chaqiriladi. Kimdir shu yo'nalishni boshlab, tugatmagan.

To'liq tahlil: 2026-07-15 sessiyasi (ISHLAR_JURNALI.md'da qisqa yozuv, batafsili shu fayl tarixida).

## Bosqichlar

| Bosqich | Maqsad | Holat |
|---|---|---|
| **Phase 1** | `invdata`/`p2data`/`dailydata`/`supplierdata`ni HTML'dan chiqarib, `p3data`/`kirimdata`dagi kabi "fetch on demand" qilish — HTML hajmini ~52MB→~1MB'ga tushirish | ✅ Bajarildi (2026-07-15) |
| **Phase 2** | Haqiqiy backend API qurish (Vercel'dan tashqarida — Railway/Render/Fly.io kabi joyda), `sales_api_client.js` stub'ini to'ldirish — git'ga har 30 daqiqada ulkan fayl commit qilish shart bo'lmay qoladi | ⛔ Boshlanmagan — reja |
| **Phase 3** | ~~`sales_runtime.js`ni bo'limlarga bo'lish~~ → qayta baholandi, o'rniga CDN skriptlarni lazy-load/defer qilish (pastga qarang) | ✅ Bajarildi (2026-07-15, qayta baholangan holda) |
| **Mobile** | Mobil ilova, Phase 2'dagi backend API'dan foydalanadi | ⛔ Juda keyingi bosqich, foydalanuvchi aniq so'ragan — hozircha ko'rib chiqilmaydi |

## Phase 2 uchun ochiq savollar (keyingi rejalashtirish sessiyasida hal qilinadi)

- Xosting tanlovi (Railway/Render/Fly.io/VPS) va byudjet — foydalanuvchi hozircha kelajakka qoldirdi (2026-07-15).
- GitHub Actions cron backend'ning "ma'lumot yangilash" qismi sifatida qoladimi, yoki backend o'zi Turso'dan jonli o'qiydimi?
- `sales_api_client.js`dagi qaysi endpoint'lar (`bootstrap`/`products`/`demand`/`stocks`) haqiqatan kerak, qaysilari ortiqcha?
- Autentifikatsiya/CORS — API ochiq bo'ladimi yoki himoyalanadimi?

## Phase 3 — qayta baholash va nima qilindi (2026-07-15)

Asl reja `sales_runtime.js`ni (3925 qator) bo'limlarga bo'lish edi. Chuqur tekshiruvda bu g'oya rad etildi:
- `sales_runtime.js`dagi bo'limlar (Stock/p5, Zakas/p7) kod darajasida chatishib ketgan — xavfsiz bo'lish katta qayta yozishni talab qiladi.
- Lekin `sales_runtime.js`ning o'zi endi muammo emas — Brotli siqilgan holda uzatiladi, HTML oxirida joylashgan (bloklamaydi). Bo'lishning tezlik foydasi kichik (Phase 1 katta muammoni hal qilgan).

**O'rniga topilgan, ancha yuqori qiymat/xavf nisbatiga ega narsa:** `<head>`da 3 ta CDN skript (Chart.js, ExcelJS, Firebase) `defer`siz, sinxron yuklanardi. **ExcelJS — 925KB**, faqat "Export" tugmasi bosilganda kerak (7 funksiyada, barchasi allaqachon `typeof ExcelJS==="undefined"` bilan himoyalangan edi). Qilingan o'zgarish:
1. ExcelJS HTML'dan olib tashlandi, `_ensureExcelJS()` (sales_runtime.js) orqali faqat kerak bo'lganda dinamik yuklanadi (7 ta chaqiruv joyiga `await _ensureExcelJS()` qo'shildi: `exportZakasCSV`, `exportStockXLSX`, `exportSuppliersXLSX`, `exportP6DetailXLSX`, `exportP6MzXLSX`, `oaImportFileChange`, `oaExport`).
2. Chart.js/Firebase (head) **va** sales_api_client.js/sales_runtime.js/ombor_aylanmasi.js (body oxiri) barchasiga `defer` qo'shildi — **muhim:** faqat head skriptlariga defer qo'shib bo'lmaydi, chunki sales_runtime.js `Chart`/`firebase`ga sinxron tayanadi (masalan `renderP1()` ichida `new Chart(...)`) — agar faqat Chart.js deferred bo'lsa-yu sales_runtime.js oddiy skript bo'lib qolsa, ijro tartibi buzilib `Chart is not defined` xatosi chiqishi mumkin edi. Barcha 6 ta skriptga defer qo'shish orqali original hujjat tartibi saqlanadi (defer skriptlar hujjatdagi tartibda ishga tushadi), faqat brauzer ularni parallel yuklab olish imkoniyati qo'shiladi.

**Kelajakda (past ustuvorlik, tezlik uchun emas, faqat kod tozaligi uchun):** `sales_runtime.js`ni to'liq modullashtirish hali variant sifatida qoladi, lekin alohida "code quality" loyihasi sifatida, "tezlik" bilan bog'lab qilinmaydi.

## O'zgargan fayllar

**Phase 1:** `backend_html_embed.py`, `sales_runtime.js`, `KODLAR_XARITASI.md` (eskirgan Firebase yozuvi tuzatildi), `CLAUDE.md`/`ISHLAR_JURNALI.md` (shu faylga havola).

**Phase 3 (qayta baholangan):** `sales_runtime.js` (`_ensureExcelJS()` + 5 chaqiruv joyi), `ombor_aylanmasi.js` (2 chaqiruv joyi), `sales.html`/`index.html` (ExcelJS skripti olib tashlandi, 6 ta skriptga `defer` qo'shildi).
