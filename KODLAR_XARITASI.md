# Kodlar xaritasi — bo'lim → fayl

Bu fayl saytning har bir bo'limi qaysi backend (Python) va frontend (JS) faylida/qatorida joylashganini ko'rsatadi. Birorta bo'limga o'zgartirish kerak bo'lsa, butun kodni qidirmasdan, shu jadvaldan to'g'ridan-to'g'ri fayl+qatorga o'tish mumkin.

## Bo'limlar

| Bo'lim (page id) | Nomi | Backend (ma'lumot yasovchi) | Frontend (render, kalit funksiyalar) | Ma'lumot manbai |
|---|---|---|---|---|
| p1 | Bosh sahifa | `build_p1data()` — [backend_p1_boshsahifa.py](backend_p1_boshsahifa.py) | `renderP1()` @ [sales_runtime.js:1942](sales_runtime.js#L1942), `P1FULL`/`P1` @ :625, `buildRangedP1()` (sana oralig'i uchun) | `<script id="p1data">` (embedded, kichik — darhol kerak) + `data_daily.json` |
| p2 | Mahsulotlar | `build_p2data()`, `build_basket()` — [backend_p2_mahsulotlar.py](backend_p2_mahsulotlar.py) | `initP2()` @ :2443, `loadHistory()` @ :2206, yuklash: `_ensureP2Data()`. Boshqa funksiyalar `p2*`/`_p2*` prefiksi bilan (`grep "function p2"`) | `<script id="p2data">` (doim bo'sh) → `fetch("data_mahsulotlar.json")`, faqat p2/p5/p6/p7 birinchi ochilganda; tarix uchun `data_history.json` (fetch) |
| p3 | ABC tahlili | `build_p3data()`, `gen_why_how()` — [backend_p3_abc.py](backend_p3_abc.py) | `initP3()` @ :2831. Boshqa funksiyalar `p3*`/`_p3*` prefiksi bilan | `<script id="p3data">` (doim bo'sh), fallback: `fetch("data_abc.json")` |
| p5 | Stock / Zaxira | `build_invdata()` — [backend_p5_stock.py](backend_p5_stock.py) | `_buildZItems()` @ [sales_runtime.js:1550](sales_runtime.js#L1550), `renderZaxira()` @ :1840, `initP5()` @ :1377, yuklash: `_ensureInvData()`. Boshqa funksiyalar `z*`/`_z*` prefiksi bilan (**diqqat:** `zk*` emas — bu p7/Zakas, ikkalasi ~636-1920 oralig'ida chatishib ketgan, izoh bor) | `<script id="invdata">` (doim bo'sh) → `fetch("data_inv_new.json")`, faqat kerak bo'lganda (`_enrichWithInventory()` chaqirilganda) |
| p6 | Suppliers | `build_supplierdata()`, `build_supplier_months()` — [backend_p6_suppliers.py](backend_p6_suppliers.py) | `initP6()` @ [sales_runtime.js:2997](sales_runtime.js#L2997), yuklash: `_ensureSupplierData()`. Boshqa funksiyalar `p6*`/`_p6*` prefiksi bilan, eksport: `exportSuppliersXLSX`/`exportP6DetailXLSX`/`exportP6MzXLSX` | `<script id="supplierdata">` (doim bo'sh) → `fetch("data_supplier.json")`, faqat p6 birinchi ochilganda; oylik kesh: `supplier_months_cache.json` |
| p7 | Buyurtma / Zakas | `build_prev_avg.py` — UCHTA mustaqil hisob: `pav` ("chuqur zakas", `.pav_cache.json`), **`avg30sa`** ("muntazam zakas" kunlik o'rtachasi, `_compute_avg30_stock_aware()` — stok-asosli, xom nisbat `tot/effective` + `AVG30_CAP_MULT` cheklov, 2026-07-22 pav-yumshatish/`K` olib tashlandi) va **`rcost`/`rcost_approx`** (Narx/Summa ustunlari uchun eng ishonchli tannarx, `recompute_current_cost()` — `backend_p6_suppliers.py`dagi `kirim_cost_breakpoints`/`cost_at` qayta ishlatadi, har build qayta hisoblanadi). Xavfsizlik zaxirasi frontendda: `ZK_BUFFER` @ [sales_runtime.js:699](sales_runtime.js#L699). Asosiy ro'yxat p5 invdata'dan quriladi | `renderZakas()` @ [sales_runtime.js:1096](sales_runtime.js#L1096), `renderZakasPag()` @ :992. Boshqa funksiyalar `zk*`/`_zk*` prefiksi bilan (~636-1920 oralig'ida, p5/Stock bilan chatishgan) | `ZITEMS` (p5 invdata asosida) + `.pav_cache.json` + `data_kirim.json` (`krPendingQty()` orqali ochiq buyurtma tekshiruvi) |
| p8 | Kirim (ta'minotchidan kelgan tovar) | `merge_kirimdata()`, `pending_order_ids()` — [backend_p8_kirim.py](backend_p8_kirim.py), sinxronizatsiya — [turso_sync_supplier_orders.py](turso_sync_supplier_orders.py) (`fetch_orders_by_ids()` — uzoq "Open" buyurtmalarni ID bo'yicha qayta tekshiradi) | `renderP8()` @ [sales_runtime.js:3749](sales_runtime.js#L3749), `renderP8Pag()` @ :3776, `krOpenDetail()` @ :3810. Boshqa funksiyalar `kr*` prefiksi bilan | `<script id="kirimdata">` (doim bo'sh) → `fetch("data_kirim.json")`, manba: Turso `supplier_orders` jadvali (Invan `supplier_order` API) |
| p9 | Ombor aylanmasi (Inventory turnover, sinov bosqichida — navigatsiyada yo'q) | `build_stock_snapshot()` — [backend_p9_ombor_aylanmasi.py](backend_p9_ombor_aylanmasi.py) (kunlik qoldiq + tannarx snapshoti) | `oaInit()`, `_oaRowFor()`, `_oaCostAt()` — [ombor_aylanmasi.js](ombor_aylanmasi.js) (mustaqil fayl, boshqa sahifalarga bog'liq emas, `oa*`/`_oa*` prefiksi) | `data_stock_snapshot.json` (kunlik qoldiq "s" + tannarx "c" massivlari) + `data_kirim.json` (Boshlanish narxi: shu sanadan oldingi eng so'nggi haqiqiy kirim narxi) + `data_history.json` |
| p10 | Kategoriyalar (kategoriya→subkategoriya→mahsulot, tushum/tannarx/foyda/marja/ABC) | Yo'q — yangi backend data fayli/pipeline bosqichi yo'q, mavjud `data_mahsulotlar.json`(P2, endi `catTop` maydoni bilan)+`data_history.json`(HIST, kunlik tushum/miqdor)+`data_kirim.json`(P8, haqiqiy kirim yozuvlari) dan frontendda hisoblanadi. Yagona backend o'zgarish: `build_p2data()` — [backend_p2_mahsulotlar.py](backend_p2_mahsulotlar.py) endi `"catTop"` maydonini ham qo'shadi (kategoriya ierarxiyasi `build_all_from_api.py`ning `api_read_products()`sida allaqachon hisoblangan edi, faqat P2ga yetib bormasdi) | `ktInit()`/`ktCompute()` @ sales_runtime.js (prefiks `kt*`/`_kt*`) — kunlik tushum `HIST`dan, tannarx tanlangan sana oralig'ida haqiqiy kirim qilingan (`P8.skus[sku].arrivals`) summadan (⚠️ "sotilgan tovar tannarxi" emas — "shu davrda kirim qilingan tovarga sarflangan summa", `ombor_aylanmasi.js`'ning `_oaIsRealKirim`/`_oaLocalDate` funksiyalari qayta ishlatiladi), ABC har mahsulotning P2'dagi GLOBAL klassifikatsiyasidan (p6 supplierlar bilan bir xil naqsh). 3 daraja: `ktRenderList()` (top/sub jadval) → `ktOpenSub()`+`_ktShowOverlay()` (mahsulot jadvali, p6 `_p6ShowOverlay()` naqshida) → "sotilmayotgan" ro'yxati (`ZITEMS` dan `cat` bo'yicha filtrlangan, p6'ning `_p6MzAllItems` naqshi) | Alohida `<input type="date">` sana oralig'i (p9'dagi kabi, umumiy tepa sana tanlagichiga bog'lanmagan) |
| p11 | Firmalar (xaridor firmalar — qarz muddati bo'yicha tahlil) | [fetch_clients.py](fetch_clients.py) — Invan'ning **ICHKI** API'sидан (`https://api.7i.uz/api/v1`, `integration/v1` EMAS) `POST /clients` orqali `client_type=Business` mijozlar reyestri (328 firma: nom, STIR, telefon, balans) + `GET /client/{id}` shartnoma raqami/sanasi (**inkremental** — faqat yangi firmalar uchun) + Turso `orders`dan `DEBT` to'lovli cheklar. Turso `clients_business` jadvaliga **faqat o'zgargan qatorlar** yoziladi (`row_hash`). ⚠️ `POST /api/v1/client` (BIRLIKDA) yangi mijoz YARATADI — ro'yxat uchun faqat KO'PLIK `clients` ishlatiladi | `fmInit()`/`fmRender()`/`fmExportXLSX()` — [sales_runtime.js](sales_runtime.js) oxiri, prefiks `fm*`/`_fm*`. Guruhlar buxgalteriyaning "Horeca tahlil" Excel formatiga mos: 15 kungacha / 30 kungacha / 30 kundan oshgan / 45 kundan oshgan / Jami / Puli bor (`balans>0`). Qatorni bosganda qarz cheklari ochiladi | `data_firmalar.json` (fetch, faqat p11 birinchi ochilganda). Sana oralig'i — p10/p9 kabi alohida `<input type="date">` |
| p_nazorat | Nazorat (admin/foydalanuvchilar) | Yo'q — to'g'ridan-to'g'ri Firebase Firestore | `nazLoad()` @ [sales_runtime.js:3856](sales_runtime.js#L3856). Boshqa funksiyalar `naz*`/`_naz*` prefiksi bilan; Firebase init — faylning boshida (`_FB_CFG`, 1-7-qatorlar) | Firestore `"users"` to'plami |
| p4 | *(o'chirilgan bo'lim)* | — | `initP4()` @ :1376 — o'lik kod, nav tugmasi va HTML div'i yo'q | — |
| Login/i18n/umumiy | Kirish ekrani, til tanlash, sidebar, sana oralig'i tanlagichi | — | I18N lug'at @ :108, `showPage()` dispatcher @ :1369 (BARCHA sahifalar shu orqali ochiladi), `toggleSidebar()` @ :1362, sana oralig'i (`_dtApplyRange` va h.k.) @ ~:2066, umumiy yordamchilar `fmt()`/`esc()` @ :1937 | — |

**Navigatsiya maslahati:** faylda `// ─── ... ───` uslubidagi izohlar har bo'limning boshlanish nuqtasini belgilaydi — `grep -n "// ───" sales_runtime.js` bilan butun faylning qisqa "tarkib jadvali"ni olish mumkin.

## Umumiy (shared) fayllar

- [backend_shared_utils.py](backend_shared_utils.py) — `ROOT`, `rq()`, `norm()`, `is_wholesale()`, `median()`, `pctl()`, konstantalar (`WEEKDAYS_UZ`, `MONTHS_UZ`, ulgurji so'zlari). Barcha `backend_p*.py` fayllar shundan import qiladi.
- [backend_html_embed.py](backend_html_embed.py) — `embed_html()`: barcha bo'limlarning tayyor ma'lumotini `index.html`/`sales.html` ichidagi `<script id="...data">` bloklariga yozadi. Bo'limga xos emas — umumiy HTML generatsiya bosqichi.

## Backend quvur liniyasi (pipeline)

**Avtomatik (har 30 daqiqada, `.github/workflows/sync.yml`):**
```
fetch_api_data.py --skip-orders     (Invan API'dan mahsulot katalogi)
        ↓
turso_sync.py                       (sotuvlarni Turso bazasiga sinxronlash)
        ↓
turso_sync_supplier_orders.py       (ta'minotchi buyurtmalarini/kirimni Turso'ga sinxronlash)
        ↓
fetch_clients.py                    (xaridor firmalar — p11; continue-on-error,
                                      yiqilsa build to'xtamaydi)
        ↓
build_all_from_api.py               (asosiy orchestrator — backend_p*.py,
                                      build_sales_demand.py, inject_last_sale.py,
                                      build_prev_avg.py'ni chaqiradi)
        ↓
index.html + sales.html + data_daily/mahsulotlar/abc/inv_new/supplier/kirim.json +
data_history.json + .pav_cache.json + supplier_months_cache.json yangilanadi
        ↓
git commit + push (avtomatik, github-actions[bot])
```

**Qo'lda / zaxira yo'l (Excel asosida, agar API ishlamay qolsa):**
[build_legacy_excel_pipeline.py](build_legacy_excel_pipeline.py) — `sotuv_excel.xlsx` + `"Товары (6).xlsx"` o'qib, xuddi shu backend_p*.py funksiyalarni chaqiradi.

## CI-kritik fayllar — ROOT'da qolishi SHART

Bu fayllarni papkaga ko'chirish yoki nomini o'zgartirish **avtomatik pipeline'ni buzadi** (har 30 daqiqada ishlaydi, real API/Turso tokensiz lokal test qilib bo'lmaydi):

`index.html`, `sales.html`, `sales_runtime.js`, `sales_api_client.js`, `ombor_aylanmasi.js`, `data_daily.json`, `data_mahsulotlar.json`, `data_abc.json`, `data_inv_new.json`, `data_supplier.json`, `data_kirim.json`, `data_history.json`, `data_monthly_rev.json`, `data_stock_snapshot.json`, `supplier_months_cache.json`, `.pav_cache.json`, `api_raw_products.json`, `api_raw_orders.json`, `arrival_data.json`, `fetch_api_data.py`, `turso_sync.py`, `turso_sync_supplier_orders.py`, `build_all_from_api.py`, `backend_shared_utils.py`, `backend_p1_boshsahifa.py`, `backend_p2_mahsulotlar.py`, `backend_p3_abc.py`, `backend_p5_stock.py`, `backend_p6_suppliers.py`, `backend_p8_kirim.py`, `backend_p9_ombor_aylanmasi.py`, `backend_html_embed.py`, `build_sales_demand.py`, `build_prev_avg.py`, `inject_last_sale.py`, `fetch_clients.py`, `data_firmalar.json`.

**Eslatma (2026-07-30):** `index.html` — **asosiy shablon**. `build_all_from_api.py` uni o'qib, `<script id="...data">` bloklarini almashtiradi va keyin `sales.html`ni undan nusxalaydi. Ya'ni qo'lda HTML tahriri **`index.html`ga** kiritiladi (avvalgi tartib teskari edi).

**Eslatma:** `turso_url.txt`/`turso_token.txt` mahalliyda mavjud bo'lsa (`.gitignore`da — commit qilinmaydi, foydalanuvchi qo'lda qo'ygan), `turso_sync.py`/`turso_sync_supplier_orders.py` orqali **jonli Turso bazasiga faqat-o'qish so'rovi** yuborish mumkin — bu holatda pastdagi "lokal test qilib bo'lmaydi" cheklovi qisman olib tashlanadi (yozish/pipeline ishga tushirish hali ham ehtiyotkorlik talab qiladi, lekin tekshiruv/diagnostika uchun jonli ma'lumotni o'qish mumkin).

**Eslatma:** `data_kirim.json` boshqalardan farqli — ichida `_synced_until` watermark bor, bu `build_all_from_api.py`ning incremental yangilash mantig'i uchun kerak (fayl o'chirilsa, keyingi build butun Turso tarixini qayta o'qib chiqadi, xato bo'lmaydi lekin sekinroq ishlaydi).

**Eslatma:** `data_monthly_rev.json` — kichik (bir necha yuz bayt) fayl, `build_history_incremental()` (`build_all_from_api.py`) har build'da `data_history.json`dagi tushum massividan oylik jami tushumni hisoblab yozadi. ABC tahlili (p3) sahifasidagi "Oylik hisobot" grafigi shu faylni o'qiydi — **butun `data_history.json`ni (o'nlab MB) frontendga yubormaslik uchun** ataylab yaratilgan (2026-07-10, `sales_runtime.js`dagi `renderMonthly3()` avval to'g'ridan-to'g'ri `data_history.json`ni o'qib, sahifani sekinlashtirgan edi).

## arxiv/ papkasi

Ishlatilmayotgan, lekin ehtimol kerak bo'lib qolishi mumkin bo'lgan fayl:
`Customer_TIN_bosh_tovarlar.xlsx`, `TIN_firma_yoq_taxminiy_ulgurji.xlsx` — eski qo'lda tahlil uchun ishlatilgan Excel eksportlar (kod jihatidan hech kimga kerak emas, faqat tarixiy/biznes qiymati bo'lishi mumkin).

**Butunlay o'chirilgan fayllar (2026-07-06, hech qanday qiymati qolmagan deb tasdiqlangan):**
`build_p6.py`, `build_p6_sales.py`, `build_monthly_supplier_abc.py` (backend_p6_suppliers.py bilan almashtirilgan), `build_legacy_excel_pipeline.py`, `sotuv_excel.xlsx`, `"Товары (6).xlsx"` (sayt 100% API'dan ishlaydi, Excel pipeline butunlay kerak emas), `data_boshsahifa.json` (eski arxitekturadan qolgan), `check_jun30.py`, `check_jun30_v2.py`, `check_order.py`, `refund_fix_summary.txt`, `_test_names.csv` (bir martalik, vazifasi tugagan), `data_history.json.bak`, `data_history.json.bak2` (~65MB, eski zaxira nusxalar), `api_server.py`, `upload.html`, `Tiin Market.bat` (Excel qo'lda yuklash uchun eski mahalliy server), `rebuild_history.py`, `rebuild_sales_dashboard.py`, `build_daily.ps1`, `import_arrivals.py`, `_make_week.py` (eski, chaqirilmaydigan skriptlar), `snip_initp3.js`, `cta_new.js`, `check_syntax.js`, `tovarlar.html`, `formula_taqdimot.html` (eski frontend qoldiqlari), `Book1.xlsx`, `sotuv_hafta_test.xlsx` (eski Excel eksportlar). Git tarixida saqlanib qoladi, kerak bo'lsa `git log --diff-filter=D` orqali topib qaytarish mumkin.

## Frontend fayl bo'linmagan sababi

`sales_runtime.js` (~3900 qator) alohida fayllarga ajratilmagan — chunki ba'zi bo'limlarning kodi (ayniqsa Zakas/p7 va Stock/p5) bir-biriga chatishib ketgan va `P1`/`P2`/`P3`/`P6`/`ZITEMS` kabi umumiy o'zgaruvchilar orqali bog'langan. Bo'lish uchun katta qayta yozish va brauzerda to'liq sinov kerak — 2026-07-15'da bu tekshirilib, **tezlik nuqtai nazaridan qiymati kichik** deb topildi (fayl allaqachon Brotli siqilgan holda, HTML oxirida yuklanadi), shuning uchun rad etildi (batafsil: [ARXITEKTURA_QAYTA_QURISH.md](ARXITEKTURA_QAYTA_QURISH.md)). Buning o'rniga faylning o'ziga `// ─── ... ───` uslubidagi bo'lim-boshlanish izohlari qo'shildi — yuqoridagi jadvaldagi qator raqamlari va prefiks konvensiyalari orqali kerakli joyni tez topish mumkin.
