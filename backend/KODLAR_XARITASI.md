# Backend kodlar xaritasi

Bu papka — **yangi server** (haqiqiy backend). Jonli saytga hali ulanmagan:
sayt hozircha eski yo'ldan (GitHub Actions → 243 MB commit → Vercel) ishlaydi.

> **Eng muhim qoida:** bu papkada **hech qanday biznes formula yo'q**.
> Barcha hisob-kitob repo ROOT'idagi mavjud fayllarda (`build_sales_demand.py`,
> `build_prev_avg.py`, `backend_p*.py`) qoladi va shundan **chaqiriladi**.
> Bu yerda faqat: baza, ma'lumot olib kelish, tarjimon (adapter) va API.
> Sabab: [ISHLAR_JURNALI.md](../ISHLAR_JURNALI.md) — qayta yozilganda
> `avg30sa` 46 barobar xato bergan edi.

---

## Fayllar — qaysi biri nima qiladi

| Fayl | Vazifasi | Qachon ishlaydi |
|---|---|---|
| [schema.sql](schema.sql) | Baza tuzilishi (jadvallar + indekslar) | Baza yaratilganda |
| [db.py](db.py) | Ulanish qatlami (o'qish/yozish, WAL) | Doim |
| [etl_from_turso.py](etl_from_turso.py) | **Bir martalik** — Turso'dagi eski ma'lumotni ko'chirish | Qo'lda, bir marta |
| [backfill_from_api.py](backfill_from_api.py) | **Bir martalik** — Invan API'dan tarixiy sotuv | Qo'lda, bo'shliq to'ldirishda |
| [sync_worker.py](sync_worker.py) | Invan'dan yangi cheklar + qoldiq | Doimiy, har 1 daqiqada |
| [pipeline_adapter.py](pipeline_adapter.py) | Baza qatorlari → Invan API formati (**tarjimon**) | pipeline_runner chaqiradi |
| [pipeline_runner.py](pipeline_runner.py) | Mavjud hisob kodlarini ishga tushirib keshlaydi | Fonda, har 3 daqiqada |
| [app.py](app.py) | API endpoint'lar (FastAPI) | Doim |

---

## "Saytda X ni o'zgartirmoqchiman" → qayerga qarash kerak

| Nimani o'zgartirmoqchisiz | Qaysi faylni tahrirlash kerak |
|---|---|
| **Zakas miqdori formulasi** (maqsadli kun, zaxira %) | `../sales_runtime.js` — `ZK_DEFAULT_TARGET`, `ZK_BUFFER` (798-816-qatorlar). **Backendda emas!** |
| **Kunlik o'rtacha** (`avg30sa`) | `../build_prev_avg.py` — `_compute_avg30_stock_aware()` |
| **Chuqur zakas** (`pav`) | `../build_prev_avg.py` — `_compute_pav_from_item()` |
| **Ulgurji ajratish** (qaysi xarid ulgurji) | `../build_sales_demand.py` — `cap`/`threshold` hisobi |
| **ABC chegaralari** (80% / 95%) | `../backend_p2_mahsulotlar.py` — 56-qator |
| **Kirim qoidalari** (PRICING chiqarish va h.k.) | `../backend_p8_kirim.py` — `_extract_item_arrivals()` |
| **Bosh sahifa ko'rsatkichlari** | `../backend_p1_boshsahifa.py` |
| **Ta'minotchi hisobi** | `../backend_p6_suppliers.py` |
| Qaysi davr oynasi ishlatilishi (30 kun) | `../build_all_from_api.py` — `SITE_WINDOW_DAYS` |
| Nechchi daqiqada yangilanishi | `pipeline_runner.py` — `REFRESH_SECONDS`, `sync_worker.py` — `SALES_INTERVAL` |
| Yangi API endpoint qo'shish | `app.py` |
| Bazaga yangi ustun/jadval | `schema.sql` + tegishli ETL/sync joyi |

---

## Ma'lumot oqimi

```
Invan API
   │
   ├─ sync_worker.py ──────────► tiin.db          (har 1 daqiqada, yangi cheklar + qoldiq)
   │
   └─ backfill_from_api.py ────► tiin.db          (bir martalik, tarixiy)

tiin.db
   │
   └─ pipeline_adapter.py  (baza → Invan formati)
         │
         └─ pipeline_runner.py  ── ROOT'dagi MAVJUD hisob kodlarini chaqiradi:
                │                     build_sales_demand.build()
                │                     build_invdata()  build_p2data()
                │                     build_p3data()   build_p1data()
                │                     build_supplierdata()  build_kirimdata()
                │                     _compute_avg30_stock_aware()  _compute_pav_from_item()
                │
                └─► pipeline_cache.pkl  (natija + oldindan siqilgan JSON)
                          │
                          └─ app.py ──► /api/v1/...  ──► frontend
```

---

## API endpoint'lar

### Mavjud hisob kodlari natijasi (pipeline keshidan, 1-4 ms)

| Endpoint | Nima qaytaradi | Manba funksiya |
|---|---|---|
| `GET /api/v1/p1data` | Bosh sahifa | `build_p1data()` |
| `GET /api/v1/p2data` | Mahsulotlar (`?limit=` bilan sahifalanadi) | `build_p2data()` |
| `GET /api/v1/p3data` | ABC tahlili | `build_p3data()` |
| `GET /api/v1/invdata` | Zaxira + zakas kirishlari (`avg30sa`, `pav` bilan) | `build_invdata()` |
| `GET /api/v1/supplierdata` | Ta'minotchilar | `build_supplierdata()` |
| `GET /api/v1/kirimdata` | Kirim (`?sku=` bilan bitta tovar) | `build_kirimdata()` |
| `GET /api/v1/kirimdata/summary` | Zakas uchun qisqa kirim holati | shundan hosila |
| `GET /api/v1/pipeline/status` | Hisob qachon yangilangani | — |

### Baza kesimidagi to'g'ridan-to'g'ri so'rovlar (sahifalangan, tez)

| Endpoint | Nima uchun |
|---|---|
| `GET /api/v1/dashboard` | KPI + kunlik grafik (sana oralig'i tanlanadigan) |
| `GET /api/v1/products` | Mahsulot jadvali — server tomonda qidiruv/saralash |
| `GET /api/v1/search` | Tez avtoto'ldirish |
| `GET /api/v1/stock` | Zaxira — necha kunga yetadi |
| `GET /api/v1/suppliers` | Ta'minotchilar (sana oralig'i bo'yicha) |
| `GET /api/v1/categories` | Kategoriyalar (`?parent=` bilan ichkariga) |
| `GET /api/v1/kirim` | Kirim ro'yxati |
| `GET /api/v1/firmalar` | Xaridor firmalar |
| `GET /api/v1/health` | Server/baza holati |

Avtomatik hujjat va sinov sahifasi: **http://127.0.0.1:8000/docs**

---

## Baza jadvallari

| Jadval | Nima saqlaydi | Qatorlar |
|---|---|---|
| `receipts` | Chek sarlavhasi (sana, xaridor, xodim, ulgurjimi) | ~107 ming |
| `receipt_items` | **Asosiy fakt jadvali** — chek qatorlari | ~699 ming |
| `products` | Mahsulot katalogi + joriy qoldiq | ~22 ming |
| `product_barcodes` | Shtrix-kodlar (bitta tovarda bir nechta bo'lishi mumkin) | ~25 ming |
| `supplier_orders` | Ta'minotchi buyurtmalari | ~18 ming |
| `arrivals` | Kirim qatorlari | ~163 ming |
| `clients_business` | Xaridor firmalar | 328 |
| `daily_sku` | Kunlik jamlanma (kun × SKU) | ~249 ming |
| `daily_totals` | Kunlik umumiy | kun soni |
| `daily_employee` | Kunlik xodim kesimi | ~658 |
| `sync_state` | Sinxronizatsiya belgilari (watermark) | bir nechta |

Eng muhim indeks: `receipt_items(sku, d)` — "shu tovar, shu davrda" so'rovlarining hammasi shundan.

---

## Ishga tushirish

```bash
# API server
python -m uvicorn backend.app:app --port 8000

# Chopar (alohida oyna) — Invan'dan yangilanish
python backend/sync_worker.py

# Hisobni qo'lda qayta ishga tushirish
python backend/pipeline_runner.py

# Tarixiy ma'lumotni to'ldirish
python backend/backfill_from_api.py
```

---

## Holat va ochiq masalalar

| Narsa | Holat |
|---|---|
| Sotuv ma'lumoti to'g'riligi | ✅ 3 kun bo'yicha 0.00% farq |
| ABC tasnifi | ✅ sayt bilan 99.1% mos |
| `avg30sa` | ✅ 93.6% mos (median farq 0.000%) |
| `pav` | ⚠️ **hali noto'g'ri** — bazada 2026-01-04…05-16 oralig'i yo'q (133 kun). Backfill qilingandan keyin to'g'rilanadi |
| Frontend ulanishi | ⛔ boshlanmagan |
| Server (xosting) | ⛔ tanlanmagan |
