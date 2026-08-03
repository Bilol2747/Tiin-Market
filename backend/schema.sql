-- ============================================================================
-- Tiin Market — normallashtirilgan baza sxemasi (SQLite)
--
-- NEGA BU KERAK:
-- Turso'dagi eski `orders` jadvali har bir chekni ~10 KB JSON blob sifatida
-- saqlaydi (104k chek = 1.4 GB). Ichida har safar takrorlanadi: do'kon,
-- kompaniya, kassa, status tarjimalari, rasm nomlari, MXIK kodlari.
-- Natijada "SKU X ning 30 kunlik sotuvi" kabi oddiy savolga javob berish uchun
-- ham butun 1.4 GB ni o'qib, JSON parse qilish kerak bo'ladi — shuning uchun
-- hamma narsa har 30 daqiqada oldindan hisoblanib, HTML/JSON ga "pishirilgan".
--
-- Bu sxemada o'sha savol `receipt_items(sku, d)` indeksi bo'yicha ~1 ms da
-- javob oladi. Hajm ~50 MB ga tushadi (28x kichik).
--
-- KELISHUVLAR (mavjud Python kodidan aynan ko'chirilgan — o'zgartirilmasin):
--   * `d`      — Toshkent MAHALLIY sanasi (UTC+5), 'YYYY-MM-DD'.
--                Manbasi: parse_local_date() @ build_all_from_api.py:52
--                Kunlik savdo chegarasi mahalliy vaqt bo'yicha bo'lgani uchun.
--   * `sign`   — sotuv uchun +1, qaytarish (refund) uchun -1.
--                Manbasi: `order.type != "sale"` → refund.
--                Miqdor/tushum RAW (musbat) saqlanadi; sof qiymat =
--                SUM(qty * sign). Shu orqali "yalpi" va "sof" ikkalasi ham
--                hisoblanadi (biri ikkinchisini yo'qotmaydi).
--   * `revenue`— safe_item_revenue() @ build_sales_demand.py:157 mantig'i:
--                total_price, ammo total_price < 0 va qty > 0 bo'lsa →
--                price * qty (Invan tomonidagi ma'lum xato uchun himoya).
-- ============================================================================

PRAGMA journal_mode = WAL;      -- o'qish yozishni bloklamaydi (API + sync birga ishlaydi)
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;


-- ─── Cheklar (sarlavha) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipts (
    id            TEXT PRIMARY KEY,       -- Invan order.id (uuid)
    created_at    TEXT NOT NULL,          -- ISO-8601 UTC, Invan'dagi create_time
    d             TEXT NOT NULL,          -- Toshkent mahalliy sanasi 'YYYY-MM-DD'
    sign          INTEGER NOT NULL,       -- +1 sotuv, -1 qaytarish
    total_price   REAL    NOT NULL DEFAULT 0,
    discount      REAL    NOT NULL DEFAULT 0,
    customer      TEXT    NOT NULL DEFAULT '',   -- client.first_name + last_name
    tin           TEXT    NOT NULL DEFAULT '',   -- STIR (API'da odatda bo'sh)
    client_id     TEXT    NOT NULL DEFAULT '',
    employee      TEXT    NOT NULL DEFAULT '',   -- created_by.first_name + last_name
    shop          TEXT    NOT NULL DEFAULT '',
    cashbox       TEXT    NOT NULL DEFAULT '',
    external_id   TEXT    NOT NULL DEFAULT '',
    -- is_wholesale(customer, tin) @ backend_shared_utils.py:42 natijasi.
    -- DIQQAT: bu faqat OSHKORA (nom/STIR bo'yicha) ulgurji. Loyihadagi
    -- "dinamik ulgurji" aniqlash bundan kengroq va API qatlamida qo'llanadi.
    is_wholesale  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_receipts_d        ON receipts(d);
CREATE INDEX IF NOT EXISTS ix_receipts_employee ON receipts(employee, d);
CREATE INDEX IF NOT EXISTS ix_receipts_client   ON receipts(client_id, d);


-- ─── Chek qatorlari (ASOSIY fakt jadvali) ───────────────────────────────────
-- Butun tahlilning ~90% shu jadvaldan chiqadi. `d` va `sign` ataylab
-- denormallashtirilgan (receipts bilan JOIN qilmaslik uchun) — bu eng ko'p
-- ishlatiladigan so'rovlarni sezilarli tezlashtiradi.
CREATE TABLE IF NOT EXISTS receipt_items (
    id            INTEGER PRIMARY KEY,
    receipt_id    TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    d             TEXT NOT NULL,          -- denorm: receipts.d
    sign          INTEGER NOT NULL,       -- denorm: receipts.sign
    sku           TEXT NOT NULL DEFAULT '',
    product_id    TEXT NOT NULL DEFAULT '',
    product_name  TEXT NOT NULL DEFAULT '',  -- norm() qilingan (kichik harf, siqilgan probel)
    barcode       TEXT NOT NULL DEFAULT '',
    qty           REAL NOT NULL DEFAULT 0,   -- RAW musbat (item.value)
    price         REAL NOT NULL DEFAULT 0,   -- birlik sotuv narxi
    supply_price  REAL NOT NULL DEFAULT 0,   -- Invan ko'rsatgan tannarx (item.supply_price)
    revenue       REAL NOT NULL DEFAULT 0,   -- RAW musbat, safe_item_revenue() bo'yicha
    discount      REAL NOT NULL DEFAULT 0,
    unit          TEXT NOT NULL DEFAULT ''
);
-- Eng muhim indeks: "shu SKU, shu sana oralig'ida" — zakas/p2/p3/p10 hammasi shundan.
CREATE INDEX IF NOT EXISTS ix_items_sku_d  ON receipt_items(sku, d);
CREATE INDEX IF NOT EXISTS ix_items_d      ON receipt_items(d);
CREATE INDEX IF NOT EXISTS ix_items_receipt ON receipt_items(receipt_id);
-- Nom bo'yicha qidiruv (SKU bo'sh bo'lgan eski yozuvlar uchun zaxira yo'l)
CREATE INDEX IF NOT EXISTS ix_items_name_d ON receipt_items(product_name, d);


-- ─── Mahsulot katalogi ──────────────────────────────────────────────────────
-- Manba: Invan /product API (fetch_api_data.py). Faqat joriy holat — tarix yo'q
-- (tarixiy tannarx `arrivals` jadvalidan olinadi).
CREATE TABLE IF NOT EXISTS products (
    sku            TEXT PRIMARY KEY,
    product_id     TEXT NOT NULL DEFAULT '',
    name           TEXT NOT NULL DEFAULT '',   -- norm() qilingan
    name_raw       TEXT NOT NULL DEFAULT '',   -- ko'rsatish uchun asl nom
    cat            TEXT NOT NULL DEFAULT '',   -- kichik (leaf) kategoriya
    cat_top        TEXT NOT NULL DEFAULT '',   -- yuqori (parent) kategoriya
    supplier       TEXT NOT NULL DEFAULT '',
    supplier_id    TEXT NOT NULL DEFAULT '',
    unit           TEXT NOT NULL DEFAULT '',
    price          REAL NOT NULL DEFAULT 0,    -- joriy chakana narx
    supply_price   REAL NOT NULL DEFAULT 0,    -- joriy tannarx
    stock          REAL NOT NULL DEFAULT 0,    -- joriy qoldiq
    is_active      INTEGER NOT NULL DEFAULT 1,
    updated_at     TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_products_name     ON products(name);
CREATE INDEX IF NOT EXISTS ix_products_supplier ON products(supplier);
CREATE INDEX IF NOT EXISTS ix_products_cat      ON products(cat_top, cat);
CREATE INDEX IF NOT EXISTS ix_products_active   ON products(is_active);

-- Bitta mahsulotda bir nechta shtrix-kod bo'lishi mumkin → alohida jadval.
CREATE TABLE IF NOT EXISTS product_barcodes (
    sku     TEXT NOT NULL REFERENCES products(sku) ON DELETE CASCADE,
    barcode TEXT NOT NULL,
    PRIMARY KEY (sku, barcode)
);
CREATE INDEX IF NOT EXISTS ix_barcodes_barcode ON product_barcodes(barcode);

-- Tez matnli qidiruv (p2 "qidiruv" maydoni server tomonda ishlashi uchun).
-- Kontentsiz FTS5: faqat indeks saqlanadi, matn products'dan olinadi.
CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
    name, sku, barcode,
    content = '',
    tokenize = 'unicode61 remove_diacritics 2'
);


-- ─── Kirim (ta'minotchi buyurtmalari) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_orders (
    id            TEXT PRIMARY KEY,
    external_id   TEXT NOT NULL DEFAULT '',   -- inson o'qiydigan buyurtma raqami
    created_at    TEXT NOT NULL,
    d             TEXT NOT NULL,
    expected_date TEXT NOT NULL DEFAULT '',   -- kutilgan yetkazib berish sanasi
    received_at   TEXT NOT NULL DEFAULT '',   -- eng so'nggi haqiqiy kirim sanasi
    status        TEXT NOT NULL DEFAULT '',   -- Open / New / Received / ...
    supplier      TEXT NOT NULL DEFAULT '',
    supplier_id   TEXT NOT NULL DEFAULT '',
    total_price   REAL NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ix_so_d      ON supplier_orders(d);
CREATE INDEX IF NOT EXISTS ix_so_status ON supplier_orders(status);

CREATE TABLE IF NOT EXISTS arrivals (
    id            INTEGER PRIMARY KEY,
    order_id      TEXT NOT NULL REFERENCES supplier_orders(id) ON DELETE CASCADE,
    d             TEXT NOT NULL,            -- denorm: haqiqiy kirim sanasi (yoki created)
    status        TEXT NOT NULL DEFAULT '', -- denorm: supplier_orders.status
    sku           TEXT NOT NULL DEFAULT '',
    product_name  TEXT NOT NULL DEFAULT '',
    qty           REAL NOT NULL DEFAULT 0,  -- buyurtma qilingan
    received_qty  REAL NOT NULL DEFAULT 0,  -- haqiqatda kelgan
    cost          REAL NOT NULL DEFAULT 0,  -- birlik kirim narxi (tarixiy tannarx manbai)
    supplier      TEXT NOT NULL DEFAULT ''
);
-- "Shu SKU uchun shu sanadan oldingi eng so'nggi haqiqiy kirim narxi" —
-- p6 foyda/marja, p9 ombor aylanmasi va p10 tannarx hisobining asosi.
CREATE INDEX IF NOT EXISTS ix_arrivals_sku_d ON arrivals(sku, d);
CREATE INDEX IF NOT EXISTS ix_arrivals_order ON arrivals(order_id);


-- ─── Xaridor firmalar (p11) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients_business (
    id              TEXT PRIMARY KEY,
    tin             TEXT NOT NULL DEFAULT '',
    nom             TEXT NOT NULL DEFAULT '',
    tel             TEXT NOT NULL DEFAULT '',
    external_id     TEXT NOT NULL DEFAULT '',
    xarid           REAL NOT NULL DEFAULT 0,
    balans          REAL NOT NULL DEFAULT 0,
    guruh           TEXT NOT NULL DEFAULT '',
    shartnoma       TEXT NOT NULL DEFAULT '',
    shartnoma_sana  TEXT NOT NULL DEFAULT '',
    qarzga_ruxsat   INTEGER NOT NULL DEFAULT 0,
    synced_at       TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_clients_tin ON clients_business(tin);


-- ─── "ILIQ" qatlam: oldindan hisoblangan kunlik jamlanma ────────────────────
-- Har SKU uchun kunlik yig'indi. receipt_items dan hosila — lekin p1/p3/p6/p10
-- kabi keng oraliqli so'rovlarni yana ~10x tezlashtiradi (800k qator o'rniga
-- ~kunlar×SKU qator o'qiladi). Sync worker har yangi chek qo'shilganda
-- shu jadvalning tegishli kunini yangilaydi.
CREATE TABLE IF NOT EXISTS daily_sku (
    d           TEXT NOT NULL,
    sku         TEXT NOT NULL,
    qty         REAL NOT NULL DEFAULT 0,     -- sof (sign qo'llanilgan)
    revenue     REAL NOT NULL DEFAULT 0,     -- sof
    cost        REAL NOT NULL DEFAULT 0,     -- supply_price × qty (taxminiy)
    receipts    INTEGER NOT NULL DEFAULT 0,  -- nechta chekda uchragan
    PRIMARY KEY (d, sku)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS ix_daily_sku_sku ON daily_sku(sku, d);

-- Kunlik xodim kesimi (p1 "top xodimlar" uchun).
-- Busiz bu ko'rsatkich `receipts` va `receipt_items` ni har safar birlashtirib
-- hisoblashga majbur bo'ladi — o'lchandi: 230 ms, butun bosh sahifaning eng
-- sekin qismi. Jamlanma bilan ~0 ms.
CREATE TABLE IF NOT EXISTS daily_employee (
    d         TEXT NOT NULL,
    employee  TEXT NOT NULL,
    revenue   REAL NOT NULL DEFAULT 0,
    receipts  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (d, employee)
) WITHOUT ROWID;

-- Kunlik umumiy (p1 bosh sahifa KPI uchun — bir necha yuz qator, darhol o'qiladi)
CREATE TABLE IF NOT EXISTS daily_totals (
    d              TEXT PRIMARY KEY,
    revenue        REAL NOT NULL DEFAULT 0,
    cost           REAL NOT NULL DEFAULT 0,
    receipts       INTEGER NOT NULL DEFAULT 0,
    items_qty      REAL NOT NULL DEFAULT 0,
    refund_total   REAL NOT NULL DEFAULT 0,
    wholesale_rev  REAL NOT NULL DEFAULT 0
) WITHOUT ROWID;


-- ─── Sinxronizatsiya holati (watermark) ─────────────────────────────────────
-- Fon ishchisi qayergacha o'qiganini eslab qoladi → har safar noldan emas,
-- faqat YANGI cheklarni oladi (bu 30 daqiqalik to'liq qayta qurishni
-- 1-2 daqiqalik inkremental yangilashga aylantiradigan asosiy narsa).
CREATE TABLE IF NOT EXISTS sync_state (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
);


-- ─── TO'PLANUVCHI artefaktlar ───────────────────────────────────────────────
-- Ba'zi ma'lumotlarni bazadan QAYTA HISOBLAB BO'LMAYDI, chunki ular vaqt
-- o'tishi bilan to'planadi. Asosiy misol — `data_stock_snapshot.json`:
-- har build'da o'sha kunning qoldig'i massivga qo'shiladi. Bizda faqat
-- JORIY qoldiq bor, kechagi qoldiq esa hech qayerda saqlanmagan — shuning
-- uchun to'plangan tarixni yo'qotmaslik kerak.
--
-- Bu jadval shunday artefaktlarni JSON sifatida saqlaydi va mavjud
-- `build_stock_snapshot()` funksiyasi o'zgarishsiz ishlatiladi (u avvalgi
-- holatni kirish sifatida oladi va yangisini qaytaradi).
CREATE TABLE IF NOT EXISTS blobs (
    key        TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT ''
);
