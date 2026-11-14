# Invan.uz Bo'limlari — To'liq Tahlil

> Bu fayl Invan tizimidagi har bir bo'limni tahlil qilib, bizning dashboardimiz uchun foydali yoki foydasiz ekanligini belgilaydi.
> Rahbardan yangi topshiriq kelganda — shu faylga qarab qaysi bo'lim orqali yechim topish mumkinligini aniqlaymiz.
> Har safar yangi bo'lim ko'rilganda shu faylga qo'shiladi.

---

## QAYTA TEKSHIRISH KERAK — Asosiy vazifa

**Rahbar topshirig'i:** Invan'ning stok ma'lumotlari xato. Quyidagi formula orqali tekshirish kerak:
```
Opening stock + Stock in (kelgan) - Stock out (sotilgan) = Expected stock
Expected stock ≠ My Inventory "On Hand" → XATO TOPILDI
```

**Asosiy kerakli bo'limlar:** `Inventory Turnover` + `My Inventory`

### Hozirgacha topilgan manfiy stok xatolari (jonli misol sifatida)
| SKU/Mahsulot | Manfiy qiymat | Topilgan joy |
|---|---|---|
| Saqich Trident Senses Peppermint Sugar Free 27gr | -1 | Purchasing Management |
| Хлеб Qo'qon Patir 1sht | -207 | Reports → Inventory → Inventory adjustment |
| Гималайская Розовая Соль Средний Помол м/у 700г | -65 | Reports → Inventory → Inventory adjustment |
| Dezodorant Rexona Ayollar Bamboo & Aloe Vera 150ml | -405 | Reports → Inventory → Inventory adjustment |
| SKU 2880035 — Энергетический напиток Dynamic Coffee 0.5л | -2 | Reports → Daily Reports |

→ Bular hammasi **faqat tasodifiy ko'rilgan namunalar** (filtrlab qidirilmagan). Demak haqiqiy xatolar soni ancha ko'p bo'lishi mumkin. To'liq audit qilinganda bu ro'yxat kengayadi.

---

## 1. DASHBOARD
Hali chuqur tahlil qilinmagan.

---

## 2. PRODUCTS

### 2.1 Catalog
- Mahsulot ro'yxati: SKU, nom, narx, kategoriya, stokda qancha bor
- Har bir mahsulotning **Inventory History** (Supply order tarixi) ko'rinadi:
  - Har bir P0# buyurtma: sana, kelish narxi, miqdor
  - Bizga ABDORLIK NARXI tarixini ko'rsatadi (masalan President saryog'i: 43,334 → 39,000 ga tushdi)
- **Bizga kk:** ✅ Narx tarixini tekshirish uchun, individual mahsulot SKU orqali solishtirish uchun

---

## 3. INVENTORY (Ombor)

### 3.1 Orders
- Supplierlarga berilgan buyurtmalar: PO raqami, supplier, status (Received/Open/Custom Return), expected date
- "Received" bo'lganlar Inventory Turnover'da "Stock in" bo'lib ko'rinadi
- **Bizga kk:** ⚠️ Qisman — chuqur audit kerak bo'lganda (Stock in haqiqatan omborga tushganmi tekshirish uchun)

### 3.2 Suppliers
- Supplier ro'yxati
- **Bizga kk:** ✅ Supplier nomlarini solishtirish uchun (bizning Suppliers bo'limimiz bilan)

### 3.3 My Inventory
- Joriy **On Hand** (hozirgi stok) — har mahsulot uchun
- **Bizga kk:** ✅✅✅ ENG MUHIM — stok tekshiruvi uchun asosiy manba (Inventory Turnover'ning Closing bilan solishtiriladi)

### 3.4 Write off
- Hisobdan chiqarilgan tovarlar (juda kam yozuv ko'rilgan)
- **Bizga kk:** ⚠️ Faqat xato sababini aniqlashtirish kerak bo'lganda (asosiy tekshiruv uchun shart emas — chunki Inventory Turnover'ning "Stock out" allaqachon buni o'z ichiga oladi degan taxmin bor, tasdiqlanishi kerak)

### 3.5 Purchasing Management
- Sales History (QTY, Amount, Sales in Day) + Current Balance (On Hand, Days in Stock) + Forecast (Stockpile, Order)
- Invan'ning o'z zakas/buyurtma tizimi
- **TOPILGAN XATOLAR:**
  - "Days in Stock" hisobida xato (masalan On Hand=122, kuniga 3.58 bo'lsa 34 kun bo'lishi kerak, lekin "1" ko'rsatgan)
  - Manfiy On Hand topilgan: Saqich Trident Senses -1 (fizik mumkin emas)
- **Bizniki yaxshiroq sabablari:**
  - Retail va ulgurji ALOHIDA hisoblanmaydi (Invan aralashtiradi) → katta xato keltirib chiqaradi (masalan President saryog'i: Invan 2,687 dona buyurtma tavsiya qildi, bizniki 90-141 — sababi XALQ RETAIL 1 martalik 2,795 donalik buyurtmani oddiy savdo deb hisoblagan)
  - ABC guruh asosida farqlanmaydi (bizda A=30, B=20, C=10 kun)
  - Supplier guruhlash yo'q, signal tizimi yo'q
- **Bizga kk:** ❌ Asosiy buyurtma tavsiyasi uchun kerak emas (bizniki aniqroq). Faqat On Hand ustuni foydali bo'lishi mumkin (lekin My Inventory'da ham bor)

### 3.6 Inventory Turnover
- Opening stock → Stock in → Stock out → Closing stock (miqdor + summa)
- **Narx tizimi (tasdiqlangan, Президент saryog'i misolida):**
  - Opening stock → **eski kelish narxida**
  - Stock in → **yangi kelish narxida**
  - Stock out → **sotish narxida (retail)**
  - Closing stock → **yangi kelish narxida** (FIFO usulida — eski stok avval tugaydi)
- Formula tekshirildi: 9 (eski) + 160 (yangi) - 11 (chiqim) = 158 (qoldi) ✓ FIFO bilan mos
- **Bizga kk:** ✅✅✅ ENG MUHIM — bu bo'lim orqali Opening+In-Out=Closing formula tekshiriladi, keyin Closing My Inventory On Hand bilan solishtiriladi

### 3.7 Invoices
- Faqat 3 ta hujjat ko'rilgan, Status: Open
- **Bizga kk:** ❌ Juda kam ma'lumot, kerak emas

---

## 4. SALES

### 4.1 All sales
- Har bir chek: Sale#, Type, Store, Kassa, Sana, To'lov turi, Item soni, Kassir, Summa
- Export: "Sales by Receipt" yoki "Sales by Item" shablon
- **Bizga kk:** ⚠️ Qisman — "Sales by Item" Inventory Turnover'ning Stock out bilan solishtirish uchun foydali bo'lishi mumkin

### 4.2 New sale
- Kassa POS interfeysi (sotuv kiritish joyi)
- **Bizga kk:** ❌ Tahlil uchun emas, operatsion joy

---

## 5. FINANCE

### 5.1 Accounts
- Customers/Suppliers balance overview (With Balance, With Debt)
- Hisoblar: Cash account, Card account, Bank account
- **TOPILGAN:** Supplierlarga umumiy qarz 16.2 mlrd so'm (High debt holatida)
- **Bizga kk:** ❌ Stok tekshiruvi uchun emas, lekin moliyaviy kontekst uchun foydali

### 5.2 Finance categories
- 9 ta kategoriya (Supplies, Salary, Transfer va h.k.) — sozlama bo'limi
- **Bizga kk:** ❌ Kerak emas

### 5.3 Transactions
- Supplierlarga to'lovlar jurnali (889 ta tranzaksiya/oy), hammasi "Supplies" kategoriyasida, Bank account'dan chiqim
- **Bizga kk:** ❌ Hozircha kerak emas (kelajakda Orders bilan solishtirish uchun foydali bo'lishi mumkin)

### 5.4 Supplier transactions
- Har supplier: Opening Balance, Credit, Debit, Closing Balance (1,611 ta yozuv, yillik)
- Manfiy = biz qarzdormiz, Musbat = ular qarzdor
- **TOPILGAN:** Ba'zi supplierlarning qarzi yil boshidan o'zgarmagan (masalan ЧП TURAYEV: -2,644,797 → -2,644,797)
- **Bizga kk:** ❌ Stok uchun emas, qarzdorlik monitoring uchun kelajakda foydali

---

## 6. REPORTS (eng boy bo'lim — Uzbek/Ingliz interfeys aralash)

### 6.1 Sales (by items)
- Mahsulot nomi, Miqdor, Aniq savdo, **Qiymati (cost)**, Umumiy daromad, **Marja %**
- **Bizga kk:** ✅✅✅ ENG QIYMATLI — bizda hozircha COST va MARJA yo'q, bu bo'lim to'ldiradi

### 6.2 Sales transactions
- Chek darajasida: Receipt#, Sana, To'lov turi, Summa, Xodim, Mijoz
- **Bizga kk:** ⚠️ Bizda allaqachon shunga o'xshash ma'lumot bor (May 2026)

### 6.3 By category
- Kategoriya bo'yicha: Items sold, Net sale, **Cost**, **Gross profit** (marja hisoblanadi)
- Misol: Зоотовары 21.4% marja, Текстиль 24.4%, Фреш 19.3%
- **Bizga kk:** ✅✅✅ Kategoriya darajasida real marja — bizda yo'q

### 6.4 Sales by supplier
- Supplier bo'yicha: Items sold, Sales, **Cost**, **Gross Profit** (576 ta supplier)
- **Bizga kk:** ✅✅✅ Supplier rentabelligi — bizning Suppliers bo'limimizda faqat Tushum bor, Cost/Foyda yo'q

### 6.5 Registers (Kassa)
- Har kassa: Sales, Refunds, Discount
- **TOPILGAN ANOMALIYA:** Kassa 1a refund 44 mln (1.66%) — boshqalardan yuqori. Ikkita "Kassa 5" yozuvi bor (dublikat shubhasi)
- **Bizga kk:** ⚠️ Kassa monitoring uchun foydali, asosiy tekshiruv uchun shart emas

### 6.6 Employees
- Xodim bo'yicha: Gross Sale, **Refunds soni**, Receipts, Average Sale
- **TOPILGAN ANOMALIYA:** Aqliddin Nodirov — 321 refund (boshqalarda 0-5 oralig'ida) — tekshirish kerak
- **Bizga kk:** ✅ Xodim nazorati uchun, bizning top_emp ma'lumotimizga refund ko'rsatkichini qo'shish mumkin

---

### 6.7 Reports → Inventory (Inventory History) — ENG KUCHLI BO'LIM TOPILDI

4 ta sub-tab bor:

**a) Current inventory**
- Product, Barcode, SKU, In Stock, **Unit Cost**, **Total Cost**, Price
- My Inventory'ning narx bilan boyitilgan versiyasi — bir joyda stok HAM narx
- 63,485 yozuv (barcha variant/o'lchamlar bilan)

**b) Inventory purchase**
- PO#, Date, Supplier, Type (Received/Custom Return), **QTY**, **QTY Received**, Cost
- QTY ≠ QTY Received bo'lsa → qisman yetkazib berish, tekshirish kerak
- 276 yozuv (6 kunlik davrda)

**c) Inventory adjustment — ENG MUHIM TOPILMA**
- Item, Date, Type (Sale), Reason (Z#/chek raqami), Employee, **Before**, **Adjustment**, **After**
- Har bir SOTUV TRANZAKSIYASI uchun aniq stok harakati (before→after), 54,294 yozuv (6 kun)
- **TOPILGAN XATOLAR (jonli, hozirgi vaqtda):**
  - Хлеб Qo'qon Patir 1sht: -205 → **-207** (manfiy stok, yomonlashayapti)
  - Гималайская Розовая Соль 700g: -64 → **-65**
  - Dezodorant Rexona Ayollar Bamboo 150ml: -404 → **-405**
  - Bu uchtasi alohida-alohida sotuvlarda (turli Z-raqamlar, xodim AO) manfiy stokda davom etayapti
- Bu tab orqali xatoni FORMULA orqali emas, BEVOSITA har bir tranzaksiyada ko'rish mumkin — qaysi xodim, qaysi chek, qaysi sana

**d) Cost of goods sold**
- Item, QTY Sold, Sales, Purchase Cost, **Average Cost**, Discount, Gross Profit
- Sales (by items) bilan o'xshash, lekin Average Cost qo'shilgan — narx o'zgargan davrda aniqroq
- 7,520 yozuv

**Bizga kk:** ✅✅✅ ENG YUQORI ustuvorlik — bu bo'lim Inventory Turnover + My Inventory'ning vazifasini bitta joyda, tranzaksiya darajasida bajaradi. Manfiy stok xatolarini formula hisoblamasdan TO'G'RIDAN-TO'G'RI ko'rsatadi.

### 6.8 Reports → Register (Shift report)
- Cashbox, Time Opened/Closed, **Expected**, **Actual**, **Difference**
- Har smena uchun kassadagi pul balansi tekshiruvi (kutilgan vs haqiqiy)
- Ko'rilgan 47 smenada barchasi Difference=0 (kamomad yo'q)
- **Bizga kk:** ❌ Stok uchun emas (pul uchun). Lekin metodologik tasdiq: Invan o'zi "Expected vs Actual vs Difference" mantiqini kassada ishlatadi — bizning stok formulamiz xuddi shu mantiqqa asoslanadi

### 6.9 Reports → Payments
- Kunlik kesimda to'lov turlari: Card, Cash, Cashback, Click, Debt, Payme, Refund, Total
- Misol (6 kun): Total 1.77 mlrd, Card 637M, Cash 493M, Debt 359M (qarzga sotuv)
- **Bizga kk:** ❌ Moliyaviy/to'lov tahlili, stok tekshiruvi bilan bog'liq emas

### 6.10 Reports → ABC Analitika (Custom Reports)
- Mahsulot nomi, Miqdor, Artikul (SKU), **Sotuv %** (umumiy savdo ulushi), **Nako %** (marja/ustama), **ABC** guruh
- ABC chegaralari sozlanadi: A 80%, B 15%, C 5% (default)
- 7,576 mahsulot
- Misol: Kreker Krispi — 8,959 dona sotilgan lekin Sotuv%=0.00% (arzon) → **B** guruh; Nako%=91.33% (yuqori marja)
- **Bizga kk:** ✅ Nako% — mahsulot darajasida yana bir marja manbai. ⚠️ Invan ABC klassifikatsiyasini bizning data_abc.json bilan solishtirish mumkin (metodologiya farqini tekshirish uchun). ❌ Stok tekshiruvi bilan bevosita bog'liq emas

### 6.11 Reports → Daily Reports
- SKU, Name, **In Stock**, har kun uchun alohida ustun (01.05...31.05) — kunlik sotilgan miqdor
- 28,928 mahsulot, oylik davr tanlanadi
- Bizning data_mahsulotlar.json'dagi `d` (31 kunlik savdo) massiviga ekvivalent, jadval ko'rinishida
- **YANA TOPILGAN XATO:** SKU 2880035 (Энергетический напиток Dynamic Coffee 0.5л) → In Stock: **-2** (manfiy stok)
- **Bizga kk:** ✅ Bizning kunlik savdo ma'lumotini tasdiqlash/solishtirish uchun, yana bir manfiy stok namunasi. ❌ Yangi funksiya sifatida kerak emas (bizda allaqachon bor)

---

## 7. CUSTOMERS
- Full Name, External ID, Phone Number, Group (Cashback 0.5%), Total Purchase Amount, Loyalty Points
- 63,327 mijoz — loyalty/CRM tizimi
- **Bizga kk:** ❌ Stok tekshiruvi bilan aloqasi yo'q. Kelajakda alohida "mijozlar" funksiyasi uchun foydali bo'lishi mumkin

---

## XULOSA — Ustuvorlik bo'yicha kerakli bo'limlar

| # | Bo'lim | Nima uchun | Ustuvorlik |
|---|---|---|---|
| 1 | **Reports → Inventory → Inventory adjustment** | Har tranzaksiyada Before/After, xatoni bevosita ko'rsatadi | 🔴🔴 ENG YUQORI |
| 2 | **Reports → Inventory → Current inventory** | Stok + Unit Cost + Total Cost birga | 🔴🔴 ENG YUQORI |
| 3 | Inventory Turnover | Stok formula tekshiruvi (davr darajasida) | 🔴 Yuqori |
| 4 | My Inventory | On Hand solishtirish | 🔴 Yuqori |
| 5 | Reports → Inventory → Cost of goods sold | Average cost bilan COGS | 🟠 Yuqori |
| 6 | Reports → By category | Marja qo'shish | 🟠 Yuqori |
| 7 | Reports → Sales by supplier | Supplier marja | 🟠 Yuqori |
| 8 | Reports → Employees | Refund anomaliya nazorati | 🟡 O'rta |
| 9 | Products → Catalog | Narx tarixi tekshiruvi | 🟡 O'rta |
| 10 | Reports → Inventory → Inventory purchase | QTY vs QTY Received farqi | 🟡 O'rta |
| 11 | Reports → Registers | Kassa nazorati | 🟢 Past |
| 12 | Orders | Stock in tasdiqlash (audit) | 🟢 Past |

## Hali ko'rilmagan bo'limlar
- Dashboard (chuqur)
- Customers
- Settings
- ABC Analytics (Reports ichida)
- Daily Reports (Reports ichida)
- Payments (Reports ichida)
- Register (Reports ichida, Inventory'dan alohida)
