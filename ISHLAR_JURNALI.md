# Ishlar jurnali

Bu fayl oxirgi qilingan/qilinayotgan ishlarni qisqa yozib boradi — yangi chatda ham darrov "nima bo'layotgani"ni tushunish uchun. Eng yangi yozuv tepada. Eskirgan/tugallangan bo'limlar vaqti-vaqti bilan qisqartiriladi.

---

## 2026-08-06 — Zakas uchun KATEGORIYA-asosli ABC (`zabc`)

**Muammo:** butun saytda ishlatiladigan ABC ([backend_p2_mahsulotlar.py](backend_p2_mahsulotlar.py)) BUTUN DO'KON bo'yicha, jami tushumga qarab hisoblanadi — bitta global 80/95 Pareto. Zakas uchun bu noto'g'ri savolga javob beradi: kanselyariyaning eng zo'r ruchkasi global ro'yxatda C bo'ladi (butun do'kon aylanmasiga nisbatan arzimas), zakas unga eng kam zaxira beradi va javondagi eng yaxshi ruchka doim tugab turadi.

**Yechim:** [backend_p_zakas_abc.py](backend_p_zakas_abc.py) — yangi modul, har ICHKI KATEGORIYA (`cat`, ~146 ta qiymat) o'z ichida mustaqil ABC hisoblaydi. Natija `zabc` maydoni sifatida `data_inv_new.json`ga yoziladi, **faqat Zakas bo'limida** ishlatiladi (boshqa sahifalar — Stock, Mahsulotlar, ABC tahlili — eski global `abc` bilan davom etadi, foydalanuvchi qarori bilan doira hozircha shu bilan cheklangan).

**Formula** (real ma'lumotda (`ABC_kategoriya_v3.xlsx`, 27 sheet) sinab, foydalanuvchi bilan bir necha bosqichda kelishilgan):
```
kuch = jami tushum / sotuv bo'lgan oylar soni        (so'm/oy)
```
- Davr: 2026-01-01 (`data_history.json` boshi) dan oxirgi kungacha; **tugallanmagan joriy oy chiqarib tashlanadi** (aks holda maxrajni shishirib o'rtachani sun'iy pasaytiradi — sinovda -13% xato topilgan)
- Manfiy oy (qaytarish > sotuv) → 0
- **Ulgurji ajratilmaydi** (foydalanuvchi qarori), **stok ma'lumoti ishlatilmaydi** (u ishonchsiz — calcStock loyihasida uzoq isbotlangan)

**Klass, uch qatlamli (har `cat` ichida mustaqil):**
1. Yuqori istisno: kuch ≥1,400,000 so'm/oy va ≥10 dona → so'zsiz A (hamma tovari zo'r sotiladigan kategoriyada ham kimdir majburan C bo'lib qolmasin)
2. Kategoriya o'rni: kumulyativ ulush **mendan oldingi** holat bo'yicha (o'zi qo'shilmaydi) — aks holda kategoriyani yakka egallagan tovar C bo'lib qolardi (`qahva jacobs velvet`: kategoriyasining 99.5%-i, lekin C edi)
3. Pastki darvoza: A uchun ≥250,000 so'm/oy va ≥10 dona; B uchun ≥100,000 so'm/oy va ≥3 dona. **Pul bo'yicha, dona emas** — saralash ham pul bo'yicha ketgani uchun ikki xil o'lchov ziddiyat berardi (`shakar 50kg` 3.46 mln so'm/oy → avval B, `choy ahmad tea` 52 ming so'm/oy → avval A)

Chegaralar qat'iy raqam (foydalanuvchi qarori) — har build'da qayta hisoblanmaydi.

**Sinab ko'rilgan va rad etilgan yondashuvlar:**
- Winsorizatsiya (bitta ulgurji oy o'rtachani buzmasin) — TESKARI ta'sir qildi: `щедрое лето margarin 200gr` yanvar-mart oylarida barqaror kuchli sotilgan (16M/53M/54M so'm), keyin to'xtagan; winsor buni "anomaliya" deb 12 barobar pasaytirib yuborgan edi.
- Darvoza dona/oy bo'yicha — saralash bilan boshqa o'lchov, ziddiyat berdi (yuqorida misol).

**Natija** (`data_history.json` 2026-08-06 holatiga, 21,997 tovar): A=5,190 B=6,120 C=10,687. 7 ta nazorat tovarida (turli sabab bilan tanlangan — kategoriya yetakchisi, yuqori istisno, dalil kamligi) 7/7 to'g'ri.

**Amalga oshirish:**
- `backend_p_zakas_abc.py` — `backend_p_calc_stock.py` naqshini takrorlaydi (`build_zakas_abc(root, verbose)`, `ZABC_KEYS`-uslubidagi o'zini-tozalash). [build_all_from_api.py](build_all_from_api.py)da `build_calc_stock()`dan **OLDIN** chaqiriladi — HTML embed qilmaydi, faqat `data_inv_new.json`ga yozadi; `zabc` maydoni keyingi calcStock bosqichidagi `<script id="invdata">` splice bilan o'zi HTML'ga tushadi (12MB'lik ikkinchi yozuv oldi olindi)
- `sync.yml` `paths:`ga qo'shildi (shu bilan birga ro'yxatdan tushib qolgan `backend_p_calc_stock.py` ham qo'shildi — bu 2026-08-04/05 da bir marta muammo bo'lgan edi)
- `sales_runtime.js`: 5 nuqta — `_enrichWithInventory` (`zabc` P2'ga ko'chiriladi), `_buildZItems` (3 ta push, ZITEMS'ga `zabc`), `_zkBuildSuppliers` (`ZK_BUFFER[v.abc]` → `ZK_BUFFER[v.zabc]` — **zakas miqdoriga ta'sir qiladi**; qator obyektidagi `abc` maydoni endi `v.zabc`dan to'ldiriladi, shuning uchun saralash/sarlavha/nishon kodiga tegilmadi)
- **Nega yangi nom (`zabc`, `abc` emas):** `_winArr()` sana oralig'i faol bo'lganda barcha `v.abc`ni qayta yozib yuboradi (global Pareto'ni oyna bo'yicha qayta hisoblaydi) — `abc` nomi ishlatilsa qiymat yo'qolardi
- p5 (Stock/Zaxira) tegilmadi — u ham ZITEMS'dan foydalanadi, lekin `v.abc` o'qib eski global qiymat bilan qoladi

**Tekshirildi:** standalone ishga tushirish (Excel bilan bir xil natija), 7 nazorat tovari, idempotentlik (ikki marta ishga tushirilganda `data_inv_new.json` bayt-baytiga bir xil), to'liq ikki-bosqichli pipeline integratsiyasi (zakas_abc → calcStock, HTML'da ikkalasi ham bor), `index.html`/`sales.html` bayt-baytiga bir xil.

---

## 2026-07-30 — YANGI BO'LIM: p11 "Firmalar" (xaridor firmalar, qarz muddati)

**Rahbar topshirig'i:** "payment date" bo'limi — bizdan tovar olgan firmalar bilan ishlash.

**Eng katta topilma — Invan'da IKKITA API bor.** Biz hozirgacha faqat `https://api.7i.uz/integration/v1` (3 endpoint: `order`, `products`, `supplier_order`) bilan ishlaganmiz. Mijoz reyestri u yerda **umuman yo'q**. Ikkinchisi — `https://api.7i.uz/api/v1` — my.invan.uz saytining o'zi ishlatadigan to'liq API (**323 endpoint**, ro'yxat: [invan_api_endpointlar.md](invan_api_endpointlar.md)). `api_token.txt`dagi joriy token u yerda ham ishlaydi, chunki u cheklangan integratsiya kaliti emas, xodimning **web-sessiya tokeni** (`source:"web"`, `exp` maydoni yo'q).

Endpoint shartnomasi taxmin qilinmadi — `my.invan.uz/assets/index.*.js` bundle'idan o'qildi (u yerda `request({method,url})` juftliklari ochiq turadi). Shu orqali xavfli tuzoq aniqlandi: **`POST /api/v1/client` (BIRLIKDA) yangi mijoz YARATADI**; ro'yxat olish uchun KO'PLIK — `POST /api/v1/clients`.

**Aniqlangan faktlar:** 64,353 mijozdan **328 tasi `client_type=Business`** (firmalar), 100%ida STIR to'ldirilgan, shartnoma raqami/sanasi bor. To'lov muddati Invan'da **saqlanmaydi** — faqat qog'oz shartnomada (firma kartochkasi, DEBT chek va hisob-faktura — uchalasi tekshirildi). Qarz chek darajasida **yopilmaydi**: 1,316 DEBT chekining hech birida ikkinchi to'lov yozuvi yo'q, faqat firmaning umumiy `balance`i o'zgaradi.

**Qurildi:**
- [fetch_clients.py](fetch_clients.py) — firmalar reyestri + shartnomalar (inkremental) + Turso `orders`dan DEBT cheklari → `data_firmalar.json` (106 firma, 2,788 chek, ~200KB) va Turso `clients_business` jadvali (**faqat o'zgargan qatorlar**, `row_hash` — `turso_sync.py`dagi kvota xatosi takrorlanmasin uchun).
- p11 frontend — [sales_runtime.js](sales_runtime.js) oxirida, prefiks `fm*`. Ustunlar buxgalteriyaning **"Horeca tahlil" Excel formatiga** aynan mos: 15 kungacha / 30 kungacha / 30 kundan oshgan / 45 kundan oshgan / Jami / Puli bor. Sana oralig'i filtri, guruh filtri, qidiruv, ExcelJS `.xlsx` eksport (p10 naqshi), qator ochilganda qarz cheklari.
- `sync.yml`ga `continue-on-error` bilan qadam (bu bo'lim yiqilsa butun build to'xtamasin).

**O'zgarishlar faqat qo'shimcha** — mavjud bo'limlar kodiga tegilmadi. Ulanish nuqtalari: `_ALL_TABS`, admin `_missing`, i18n, `showPage` (2 joy), `NAZ_TABS`, nav tugmasi, sahifa bloki, JS kesh-versiyasi (`v=1785500000`). CSS to'liq `#p11` bilan scope qilingan. Lokal smoke-test (Playwright, `http://127.0.0.1:8777`): 106 firma yuklandi, filtrlar/qidiruv/tafsilot ishladi, **p1/p6/p10 ochilishi buzilmadi, konsol xatosi 0**.

**Ochiq savol:** Horeca Excel'ida 168 firmaning jami qarzi **1.19 mlrd**, Invan `balance` bo'yicha esa 256 firmada **36.1 mlrd** — 30 barobar farq. Bo'lim qarzni **chek summalaridan** hisoblaydi (Horeca usuli), `balance`dan emas. Buxgalteriya bilan bir-ikki firmani solishtirib tasdiqlash kerak.

---

## Hozirgi holat (2026-07-30, davomi) — vaqt sinovi + jim-qoldiq tuzatildi, keyingi qadam

Yuqoridagi (pastdagi) 5 qoida qo'shilgach, foydalanuvchi muhim savol berdi: **"filtrdan o'tqazib to'g'irlagan tovarlarimiz hisob bo'limida to'g'ri ishlaydimi va vaqt bilan bir xil ishlaydimi?"** Sinov o'tkazildi: har qoidaga (7 tasiga ham) bitta 0-qiymatli namuna tovar tanlab, sun'iy ravishda 100 dona kirim, keyin 3 kunda 30 dona sotuv qo'shib, natija 0→100→70 kutilganini tekshirdik.

**2 ta REAL vaqt-mosligi xatosi topildi va tuzatildi:**

1. **`sotilmagan`/`kirimsiz`:** yaqinda kirim kelgan, hali sotilmagan tovar butunlay chetlab o'tilib, saytda "—" bo'lib qolardi (100 dona kelsa ham hech narsa ko'rinmasdi). Tuzatish: oxirgi `NOSALE_STALE_DAYS` (60) kun ichidagi kirim "hali javonda" deb hisoblanib, o'sha son ko'rsatiladi. Yangi calcRule: **`yangi-kirim`** (~226 ta tovar).

2. **`jim-qoldiq`** (o'sha kuni qo'shilgan qoida): "pauza ICHIDA kirim yo'qligi" shartini talab qilardi — bu **38198 dagi original muammoning aynan o'zi**, faqat boshqa qoidada joylashgan edi. Agar hali davom etayotgan (tugamagan) pauzaga kirim kelsa, shart FALSE bo'lib filtr BUTUNLAY o'chib qolardi va eski arvoh yangi kirimga qo'shilib ketardi (sinovda 100 o'rniga 118/136 chiqargan edi). Tuzatish: endi `qoplama`/`uzoq-jimlik` bilan bir xil mantiqda — faqat pauza uzunligiga qaraydi, kirim borligiga emas (balans yurishi 0'dan boshlab kirimni normal qo'shadi).

Sinov qayta o'tkazildi: barcha 7 qoida to'g'ri (kirim→to'g'ri qiymat, sotuv→to'g'ri kamayish). Jismonan tasdiqlangan 7 tovar (38198, 38008, 28686, 2687, 7871, 9293, 2496) hech qaysi bosqichda buzilmadi.

**Sinov skripti saqlangan emas** (scratchpad'da, git'ga qo'shilmagan) — kerak bo'lsa qayta yozish oson: `backend_p_calc_stock.recompute_calc_stock_from_history()` ni chaqirib, `data_kirim.json`/`data_history.json` ga vaqtinchalik sun'iy kirim/sotuv qo'shib, oldin/keyin solishtirish.

### KEYINGI QADAM (foydalanuvchi aniq belgilagan, ISHNI SHU YERDAN BOSHLASH)

Ikkita katta guruh hali **tahlil qilinmagan** (faqat Excel qilib chiqarilgan, chuqur ko'rib chiqilmagan):

1. **`filtrsiz_guruhlar2.xlsx`** / **`muntazam_filtrsiz.xlsx`** — "filtr qo'llanilmagan" 10,479 tovar (calcRule="oddiy"). Ichida:
   - **MUNTAZAM zakas qismi (7,984 tovar)** — TAHLIL QILINMAGAN. `muntazam_filtrsiz.xlsx` da tayyor: 5 varaq (zaxira tugay deb qolgan <7 kun / hisob 0 / kam qoldi 7-21 kun / normal / ortiqcha 90+ kun). Bu ENG MUHIM qism — har kuni shu tovarlar bo'yicha buyurtma qarori qabul qilinadi.
   - **CHUQUR zakas qismi** — HAM TAHLIL QILINMAGAN.
   - `filtrsiz_guruhlar2.xlsx` da qo'shimcha: 103 ta "shubhali" (90+ kun na sotuv, na kirim — bunga jim-qoldiq qoidasi allaqachon tegdi, ~99 tasi 0 qilindi) va 140 ta "yaqinda kirim kelgan" (shubha yo'q) alohida ajratilgan edi.

2. Ikkalasi ham (muntazam va chuqur) **"filtr qo'llanilmagan"** ekanligini yodda tuting — model bularga ARALASHMAGAN, ya'ni ular allaqachon oddiy kirim/sotuv hisobidan chiqqan raqamlar. Vazifa: ular orasida yana biror naqsh (masalan Invan bilan katta farq, g'ayrioddiy qiymat) bor-yo'qligini ko'rib chiqish, kerak bo'lsa yangi qoida qo'shish.

**Ishni davom ettirish:** `muntazam_filtrsiz.xlsx` ni ochib, "1 ZAXIRA TUGAY DEB QOLGAN" va "2 HISOB 0" varaqlaridan boshlash — bular eng shoshilinch (1,512 ta jami).

---

## Hozirgi holat (2026-07-30) — Hisoblangan stok: qamrov 68% -> 89%, 7 ta qoida

2026-07-29 dagi ish (pastdagi yozuv) faqat "2026 da kirimi ham, sotuvi ham bor" tovarlarni qamragan edi (14,988 ta). Qolgan ~7,200 tovarda saytda "—" turib, zakas Invan soniga tayanardi — Invan esa aynan shu tovarlarda arvoh qoldiq ko'rsatadi. Bugun ikkita katta guruh (7,246 + 10,479) ko'rib chiqildi.

### YANGI 5 QOIDA (har biri foydalanuvchi bilan kelishilgan, chegara real ma'lumotda o'lchab tanlangan)

| Qoida | Tovar | Mezoni |
|---|---|---|
| `sotilmagan` | ~2,090 | 2026 da bitta ham sotuv yo'q + oxirgi kirimdan 60+ kun |
| `eskirgan-assortiment` | ~1,500 | 2026 da kirim yo'q + 90+ kun jim |
| `kirimsiz` | ~765 | Invan'da kirim yozuvi UMUMAN yo'q + 180+ kun jim |
| `eski-kirim` | ~583 | kirimi 2025-07 dan oldin (1-1.5 yil) + 90+ kun jim |
| `jim-qoldiq` | ~99 | hisob>0, lekin 90+ kun **na sotuv, na kirim** |

Jami qoidalar: `oddiy` (10,380) · `qoplama` (4,080) · yuqoridagi 5 ta · `uzoq-jimlik` (160).

### IKKITA MUHIM TOPILMA (ikkalasi ham foydalanuvchidan)

**1. Tabiiy tanaffus himoyasi (`STALE_ASSORT_GAP_MULT = 1.5`).** Dastlab 90 kunlik jimlik yetarli deb olingan edi — 171 ta tovar noto'g'ri 0 qilinayotgani aniqlandi. Kanselyariya, o'yinchoq, izolenta, choynak, mavsumiy krem kabi buyumlar tabiatan oylab turadi: masalan shampun 91 kun jim, lekin tarixda 229 kunlik tanaffusi bor (nisbat 0.40x). Endi OZIQ-OVQAT BO'LMAGAN tovarda jimlik uning o'z eng uzun tanaffusidan 1.5x uzun bo'lishi SHART. Tanaffus TO'LIQ oynadan (2025-07-01 dan) hisoblanadi — faqat 2026 dan hisoblansa himoya deyarli ishlamaydi (171 o'rniga 19). Oziq-ovqat bunday himoyasiz — u saqlanmaydi (`FOOD_CATEGORIES` + `Детское питание` subkategoriyasi + "корм"/"yem" nom kaliti).

**2. KIRIM sharti ham kerak.** Faqat sotuv jimligiga qarash yetarli emas: 140 ta tovar uzoq sotilmagan bo'lsa-da YAQINDA kirim olgan (masalan "konfet марсианка": 147 kun jim, ammo o'sha kuni 96 dona kelgan) — ularda tovar javonda BOR. `jim-qoldiq` qoidasi IKKALA shartni birga talab qiladi, shu bilan shubhali ro'yxat 214 -> 103 ga qisqardi.

### CHEGARALAR (nega aynan shunday)

- `NOSALE_STALE_DAYS = 60` — 30 kun yaqinda kelgan tovarni (7 kun oldin 3,600 dona kelgan borjomi) noto'g'ri 0 qilardi; 90 kun juda ko'pini chetda qoldirardi.
- `STALE_ASSORT_DAYS = 90` va `QUIET_STOCK_DAYS = 90` — sotilib turgan tovarlar uchun.
- `NOKIRIM_STALE_DAYS = 180` — kirim yozuvi UMUMAN yo'q tovarlarda hisoblash uchun boshlang'ich nuqta bo'lmagani uchun ataylab yumshoqroq (foydalanuvchi: "kirim malumoti yoq bolganlar uchun chegarani kotar").
- `PAUSE_STALE_DAYS = 90` O'ZGARMADI — u jismonan tasdiqlangan (SKU 9293 qahva 114 kun jimlikda 0 chiqadi; 180 qilinsa buziladi).

### NATIJA

| | 07-29 oxiri | 07-30 oxiri |
|---|---|---|
| Hisobi bor | 14,988 (68%) | **19,659 (89%)** |
| Yashil belgili | 4,242 | **~9,180** |
| 0 deb belgilangan | ~4,400 | **~9,600** |

B guruhning 7,246 tasidan ~4,940 to'g'irlandi (~21,000 dona arvoh qoldiq tozalandi), ~2,300 ataylab qoldi. Jismonan tasdiqlangan 7 tovar hech qaysi o'zgarishda buzilmadi (38198, 38008, 28686, 2687, 7871, 9293 — tugagan; 2496 — turgan).

### QOLGAN ISH

Hisobi yo'q ~2,300 tovar — hammasi asosli sabab bilan:
- ~1,195 kirim bor + 3 oydan kam jim (**ataylab** — hali faol)
- ~627 kirimsiz + 6 oydan kam jim (**ataylab**)
- ~267 eski kirim + 3 oydan kam jim (**ataylab**)
- ~217 kirim yaqinda keldi (**ataylab** — sotilishga ulgurmagan)

Ular vaqt o'tib sotilmasa, keyingi build'da o'zi qoidaga tushadi. Yangi tekshiruv kerak bo'lgan guruh QOLMADI.

**Yashil nuqta VAQTINCHA** (`.zk-stock-chk`) — barcha tovar tekshirilgach OLIB TASHLANADI.

**Hisobot fayllari (git'ga qo'shilmaydi):** `filtrsiz_guruhlar2.xlsx` (10,479 — 5 guruh), `b_guruh_hisobsiz.xlsx` (7,246 — B1..B4), `shoshilinch_549.xlsx` (muntazam+hisob 0), `ishonchli_hisoblangan.xlsx`, `shubhali_sekin_tovarlar.xlsx`, `uzoq_sotilmagan.xlsx`.

---

## Hozirgi holat (2026-07-29) — Hisoblangan stok: "tugab qolgan" davrni aniqlash

Zakas "Hisob." ustuni endi tovar TUGAB QOLGAN davrni aniqlaydi va arvoh zaxirani yangi kirimga QO'SHMAYDI. Muammo foydalanuvchi topilmasi bilan boshlandi: SKU 38198 (coca-cola zero) Invan'da 92 dona ko'rinardi, aslida tugagan edi; 600 dona kelgach Invan 692 qilib qo'ydi. Jonli tasdiq: bizning model 590 (0 + 600 - 10 sotuv), Invan 682.

**Ikki qoida** (`backend_p_calc_stock.py`, `_walk_with_pauses()`):
1. **QOPLAMA** — pauza boshidagi zaxira jimlikni oxirigacha yetkaza olmasa (jimlik >= 2x qoplama, `PAUSE_MIN_RATIO`) -> o'sha nuqtada balans 0, KEYIN kirim ustiga qo'shiladi. Tezlik 90 kunlik o'rtacha va to'xtash oldidagi 21 kunning (`PAUSE_RECENT_WIN`) KATTAROG'I bilan o'lchanadi — "jadal sotilib turib birdan to'xtagan" tovar aks holda yashirinib qolardi (SKU 2687 makaron: 90-kunlik o'rtachada 0.49/kun, to'xtash oldidan 1.36/kun).
2. **UZOQ JIMLIK** — 90+ kun (`PAUSE_STALE_DAYS`) sotilmagan va tovarning tabiiy pauzasidan 3x uzun bo'lsa, qoldiq qancha yozilganidan QAT'I NAZAR 0. Bu Invan'dagi xato kirim yozuvi (SKU 9293: odatda 480 keladi, bir marta 294,600 deb yozilgan) hisobni shishirib, birinchi qoidani o'ldirib qo'yishining oldini oladi — absurd zaxira "590,000 kunga yetadi" deb chiqib, 114 kunlik jimlikni ahamiyatsiz qilardi.

**Chegaralar real ma'lumotda tanlangan, taxminan emas:** 60 kun SKU 2496 (Nescafe, foydalanuvchi jismonan ~100 dona ko'rgan) ni buzardi — uning HAQIQIY 64 kunlik pauzasi bor; 120 kun esa 9293 ni o'tkazib yuborardi.

**Yo'l-yo'lakay topilgan 2 ta REAL XATO:**
- `p_kun=1` (har kuni sotiladigan tovar) formuladan chetlab o'tib "jimlik normal" deb baholanardi — eng tez sotiladigan tovarlar HECH QACHON aniqlanmasdi (coca-cola aynan shundan o'tib ketardi).
- `data_sales_2025h2.json` oxirgi kuni (2026-01-01) `data_history.json` birinchi kuni bilan bir xil bo'lib, o'sha kun sotuvi IKKI MARTA sanalardi. Endi tarixiy manba qat'iy `offset`gacha kesiladi.

**VAQT HIMOYASI** (`_check_time_alignment()`, har build'da ishlaydi): ustma-ust tushish / bo'shliq / massiv uzunligi / kelajak kirim tekshiriladi. Jiddiy muammo topilsa hisob UMUMAN qilinmaydi (`return {}`) — noto'g'ri son chiqarishdan ko'ra eski qiymat qolgani xavfsizroq. Bu foydalanuvchi talabi edi: "eng xavfli narsa sotuv va kirim vaqtlari xato qoshilib qolishidan kelib chiqadi".

**JISMONAN TASDIQLANGAN 7 ta tovar:** 38198 (coca-cola), 38008 (non), 28686 (sutli bo'tqa), 2687 (makaron), 7871 (nam salfetka), 9293 (qahva ice) — tugagan; 2496 (Nescafe) — TURGAN, model tegmasligi kerak edi va tegmadi.

**Frontend:** `calcRule` maydoni (`oddiy` / `qoplama` / `uzoq-jimlik`) + qayta hisoblangan tovar yonida VAQTINCHA yashil nuqta (`.zk-stock-chk`). Belgi ma'nosi foydalanuvchi qarori bilan "qiymati o'zgardi" emas, "tugash testidan o'tib ISHONCHLI hisoblangan" — shuning uchun baza xom clamp (4,115 ta), saytdagi eski qiymat emas (3,540 ta). **Barcha tovar tekshirilgach bu belgi OLIB TASHLANADI.**

### Holat: 21,964 faol tovar

| Holat | Tovar |
|---|---|
| Ishonchli hisoblangan (yashil belgi) | **4,115** |
| Hisobi bor, filtr ta'sir qilmadi | 11,170 |
| Hisobi yo'q — 2026 da kirimi yo'q | 2,704 |
| Hisobi yo'q — 2026 da sotuvi yo'q | 3,359 |
| Hisobi yo'q — kirim tarixi yo'q | 1,191 |

### KEYINGI QADAM (2026-07-30 ga rejalashtirilgan)

Foydalanuvchi qarori: qolgan tekshirilmagan guruhlarni ERTAGA yangi ma'lumot bilan ko'rish (bugun qilinsa, ertaga sotuv bo'lib raqamlar siljiydi).
1. `filtr_qollanilmagan.xlsx` — 11,170 talik guruhdan 60+ kun sotilmayotganlarini ko'rib chiqish -> kerak bo'lsa `PAUSE_STALE_DAYS` ni sozlash (60 kun 2496 ni buzishi ma'lum, boshqa yechim kerak bo'ladi).
2. 2,704 talik "2026 da kirimi yo'q" guruhini qamrovga qo'shish (hozir `k_2026` sharti bilan chetda; 2,702 tasi hali sotilyapti, ya'ni tirik tovarlar).
Har bosqichda oldin/keyin farq hisoboti bilan (bugungidek: 446 ta o'zgardi, hech biri oshmadi).

**Hisobot fayllari (git'ga qo'shilmaydi):** `ishonchli_hisoblangan.xlsx` (4,115, guruhlarga ajratilgan), `filtr_qollanilmagan.xlsx`, `qamrovdan_tashqari.xlsx`, `uzoq_sotilmagan.xlsx`.

---

## Hozirgi holat (2026-07-24) — Buyurtma: "Hujjatdan buyurtma" tabi qo'shildi

`zakas/build_shablon.js` (2026-07-23, qo'lda ish uchun, quyidagi yozuvga qarang) bilan qilinayotgan ishni ilovaning ICHIGA olib kirish so'raldi: foydalanuvchi endi menga fayl tashlab shablon so'rash o'rniga, ilovaning o'zida ta'minotchidan kelgan hujjatni (накладная va h.k.) to'g'ridan-to'g'ri yuklab, Invan'ga yuboradi.

**Yangi tab (Buyurtma sahifasi tepasida, "Avtomatik zakas" bilan bir qatorda):** ta'minotchi tanlanadi (mavjud 637 ta ta'minotchi ro'yxatidan, `_zkBuildSuppliers`dan) → Excel yuklanadi → tizim shtrix-kod bo'yicha TO'LIQ katalog (`ZITEMS`, 21k+ tovar, faqat ochiq supplierga emas) bilan solishtiradi → "bizda bor" jadvalida nomi/soni/narxi FAYLDAGIDEK chiqadi (tahrirlanadigan, foydalanuvchi tasdiqlagan qaror — qolgan Zakas maydonlari kabi) → "bizda yo'q" alohida oynada (nomi/shtrix/soni/narxi + Excel eksport). Belgilangan qatorlar mavjud "Demo/Invan'ga yuborish" oqimi bilan (xuddi hisoblangan zakasdagidek, `/api/invan-order`) jo'natiladi.

**Muhim farq mavjud "Excel tekshiruv (shtrix-kod)" importidan** (`zkImportBarcodes`, eski): u faqat OCHIQ supplierning HISOBLANGAN qatorlarini filtrlaydi, fayl soni/narxini tashlab yuboradi. Yangisi esa fayldagi soni/narxni AYNAN oladi, istalgan supplierni to'liq katalog bo'yicha qamraydi — ikkalasi alohida, bir-biriga tegmaydi.

**Qayta ishlatilgan kod:** `_zkDetectCols` (sarlavha so'zi bo'yicha ustun aniqlash), `_ensureExcelJS`/`_zkStripDrawingsAndRetry` (fayl yuklash), `_zkNormBc` (shtrix-kod normalizatsiya), `zkSendToInvan`ning to'liq POST/confirm/demo-prod oqimi (yangi `zkSendFileToInvan`da takrorlangan, backend `api/invan-order.js` O'ZGARMAGAN). Yangi: `_zkFullBcMap()` (bir marta keshlangan to'liq katalog shtrix-kod xaritasi).

**Tekshirish:** Playwright bilan lokal HTTP server orqali (file:// emas — fetch() json fayllarni yuklay olmaydi; login localStorage'ga to'g'ridan-to'g'ri admin sessiya qo'yib chetlab o'tildi, jonli Firebase'ga tegilmadi). Real накладная faylidan (`2004_2` xom fayli, 12 tovar) yuklanganda: 11 ta to'g'ri topildi, 1 tasi (shtrix-kodsiz qator) to'g'ri "topilmadi"ga tushdi, jadval/modal/eksport hammasi ishladi, checkbox/soni/narx tahriri summa/jami'ni to'g'ri qayta hisobladi, "Avtomatik zakas"ga qaytish asl ko'rinishni buzmadi.

**Fayllar:** `sales_runtime.js` (asosiy mantiq), `sales.html`+`index.html` (yangi `#zk-page-tabs` konteyner + 5 qator CSS, ikkalasida bir xil — [[feedback-index-html-sync]]).

**MUHIM (2026-07-24 payqaldi):** shu ishni qilish jarayonida `zakas/` papkasidagi fayllar va shu jurnalning o'zi (ISHLAR_JURNALI.md) BIR NECHA MARTA "yo'qoldi" — sabab avtomatik squash+reset tsikli ([[project-git-repo-size-cleanup]]) commitlanmagan (hatto ba'zan commitlangan-lekin-push-qilinmagan) o'zgarishlarni sinash orasida bosib ketishi ekan, ba'zan 30 daqiqadan HAM tezroq. **Bu loyihada committing qilinmagan (yoki push qilinmagan) ish har doim xavf ostida** — katta o'zgarish qilingandan keyin darhol commit VA push qilish tavsiya etiladi, aks holda reset+patch-reapify bilan tiklashga to'g'ri keladi.

---

## Hozirgi holat (2026-07-23) — Zakas: ta'minotchi fayllarini "shablon"ga o'giruvchi vosita

Foydalanuvchi **doimiy ish** sifatida `zakas/` papkasiga turli ta'minotchilardan kelgan xomashyo xlsx fayllarni (накладная, buyurtma tasdig'i va h.k.) tashlab turadi va har birini Invan import shabloniga (4 ustun: **Наименование, Штрих код, Кол-во, Цена** — nomi birinchi) o'girib berishni so'raydi. Har ta'minotchining fayl formati boshqacha (ustunlar tartibi, qo'shimcha metama'lumot qatorlari, ba'zan birlashtirilgan katakchalar bilan buzilgan bo'lishi ham mumkin — birinchi holatda shunday fayl uchrab, qo'lda tuzatilgan).

**Vosita:** `zakas/build_shablon.js` (Node + ExcelJS, `node_modules/exceljs` mahalliy o'rnatilgan, `.gitignore`ga qo'shilgan). Sarlavha qatorini so'z bo'yicha avtomatik topadi (Наименование/Название/Продукция → nomi, Штрих → shtrix kod, Кол-во/Количество (Кейs'siz) → soni, Цена (avval "без скидки"siz, oxirgi ustun) → narxi), ma'lumot qatorlarini soni/narx SON bo'lishi shartiga qarab o'qiydi (footer/"Итого" qatorlarini shu tekshiruv bilan ajratadi — nomga tayanish ishonchsiz, chunki merge qilingan katakchalar matnni "sizdirib" yuborishi mumkin).

**Ishlatish:** `node zakas/build_shablon.js` (argumentsiz — papkadagi eng oxirgi tashlangan xlsx avtomatik tanlanadi) yoki `node zakas/build_shablon.js "fayl_nomi.xlsx"`. Natija: `<asl_nom>_shablon.xlsx`, asl fayl teginilmaydi.

**Tekshirilgan holatlar:** 2 xil ta'minotchi накладнаяsi (84 ta va 27 ta tovar) + oddiy buyurtma tasdig'i (12 ta tovar) — barchasida to'g'ri natija berdi.

---

## Hozirgi holat (2026-07-22) — avg30sa: pav-yumshatish (K=5) olib tashlandi

`_compute_avg30_stock_aware()`dagi ishonch og'irligi formulasi (`avg=(tot+K*pav)/(effective+K)`, K=5) real ma'lumotda tekshirilganda tez-tez tugab qoladigan tovarlarda zakasni ko'pincha PAST ko'rsatib yuborayotgani aniqlandi: shunday 2,000 ta tovarning 43.6%ida kamroq, atigi 2%ida ko'proq chiqargan — aynan qayta to'ldirish paytida yetarli buyurtma berilmasligi xavfi eng yuqori bo'lgan holat. Butun katalogda ta'siri neytral-ijobiy edi (jami hajm +3.1%), shuning uchun foydalanuvchi bilan kelishib **butunlay olib tashlandi**. Endi faqat xom nisbat (`tot/effective`) ishlatiladi, `AVG30_CAP_MULT` (3x kalendar tezlik) bilan cheklab — bitta tasodifiy katta sotuvdan himoya sifatida qoladi. `AVG30_MIN_ACTIVE`/8-kunlik jar konstantasi ham endi ishlatilmaydi (kod ichida "ESKI, ISHLATILMAYDI" deb belgilangan).

Commit: `e5491bc`. Fayl: `build_prev_avg.py` (`_compute_avg30_stock_aware`). Bu yozuv avval jurnalga qo'shilmagan edi (2026-07-23 kunida to'ldirildi) — [[project-zakas-avg30-rebuild]] xotira faylidagi "sozlanadigan dastaklar" ro'yxatidan `AVG30_K=5` shu sababli olib tashlandi.

---

## Avvalgi holat (2026-07-22) — Zakas: xavfsizlik zaxirasi mantig'i tuzatildi + Narx qo'lda tahrirlanadigan bo'ldi

**Xavfsizlik zaxirasi — "reorder point" vs "order-up-to level" (foydalanuvchi topilmasi, muhim tuzatish):** foydalanuvchi jonli ekranda "Qolgan kun" bazaviy maqsad (20 kun)dan YUQORI (masalan 22) bo'lgan tovarlarga ham mayda (3-4 dona) zakas berilib qolayotganini payqadi. Sabab: `ZK_BUFFER` (ABC zaxirasi) avval **SHARTSIZ** qo'llanardi - har qanday tovar uchun maqsadli kunni kengaytirib (A uchun 20→24) yuborardi, garchi tovar allaqachon (bazaviy 20 kun bo'yicha) YETARLI bo'lsa ham. Foydalanuvchi standart ombor boshqaruvi nazariyasidagi to'g'ri modelni mustaqil taklif qildi: zaxira **"qachon buyurtma berish"**ga emas, faqat **"qancha buyurtma berish"**ga ta'sir qilishi kk (reorder point = bazaviy target, order-up-to level = zaxirali target). Real ma'lumotda tekshirildi: **286 ta tovar, 35.5 mln so'm** shu sababli keraksiz zakas olayotgan edi. Tuzatish: `_needsOrder=daysLeft<target` sharti qo'shildi - agar qolgan kun bazaviy maqsaddan yuqori bo'lsa, avtomatik zakas 0 (zaxiradan qat'i nazar); past bo'lsagina zaxirali (kengaytirilgan) maqsadgacha to'ldiriladi. Qo'lda kiritilgan "Qo'shimcha kun" baribir ishlaydi (menejer istalgan tovarni qo'lda majburlashi mumkin).

**Narx endi qo'lda tahrirlanadigan (foydalanuvchi so'rovi):** "narx yaqinda o'zgargan bo'lsa qo'lda tuzatib qo'yamiz" - Narx ustuni endi Zakas/Qo'shimcha-kun bilan BIR XIL ko'rinishdagi input (`.zk-adj-inp`, hech qanday maxsus rang farqisiz - foydalanuvchi aniq talab qildi: "hammasida bir xil bo'lsin"). Qo'lda kiritilgan narx Summa/jami summa hisobida ISHLATILADI.

**Avtomatik "muddati tugash" mexanizmi (foydalanuvchi aniqlashtirishi bilan):** qo'lda kiritilgan narx "Сбросить" bosilmaguncha SAQLANADI, LEKIN agar backend'dagi haqiqiy narx (yangi prixod kelib) o'zgarsa - avtomatik bekor bo'ladi. Amalga oshirish: kiritilgan paytdagi backend narxi (`rawCost`) "asos" sifatida saqlanadi (`zkRowCost[key]={val,base}`); har render `_zkAutoClearManualCost()` joriy backend narxini asos bilan solishtiradi, mos kelmasa (prixod o'zgargan) qo'lda kiritilganni o'chiradi - `zkConfirmedStock`/"Zakas berildi" belgisi stok o'zgarganda avtomatik bekor bo'lishi bilan AYNAN bir xil naqsh.

**Kichik dizayn:** galochka o'lchami birozgina kattalashtirildi (13px→16px). Ustun kengligi Narx input'i uchun qayta muvozanatlandi (product 20%, narx 10%, summa 9% - barchasi piksel darajasida xavfsiz).

**Tekshiruv:** sintaksis OK, ustun soni mos (12=12=12), **76/76 test o'tdi** (11 yangi: reorder-point chegarasi + qo'lda narx/avtomatik-bekor-bo'lish + 65 avvalgi), regressiya yo'q.

---

## Avvalgi holat (2026-07-22) — Zakas: Excel jadval o'qilishi + ekrandagi Narx yaxlitlanishi tuzatildi

**Excel eksporti — qator o'qish qulayligi (foydalanuvchi jonli yuklab ko'rib topdi):** Mahsulot/Kategoriya ustunlarida `wrapText:true` uzun nomlarni 2 qatorga bo'lib, qatorlar notekis balandlikda bo'lib qolgan edi - qaysi qiymat qaysi qatorga tegishli ekanini bir qarashda ko'rish qiyinlashgan. Tuzatish: wrapText OLIB TASHLANDI (har qator endi BITTA qatorda, notekislik yo'q), Mahsulot ustuni kengaytirildi (36→46), Kategoriya ham (16→20), va HAR QATOR orasiga ingichka kulrang chiziq (`border:bottom`) qo'shildi - ko'z bilan kuzatish yanada osonlashdi.

**Ekrandagi Narx yaxlitlanishi (muhim tuzatish, foydalanuvchi Excel bilan solishtirib topdi):** Zakas jadvalidagi "Цена" ustuni `Math.round()` bilan yaxlitlanardi - masalan haqiqiy narx `34,999.88` bo'lsa, ekranda `35,000` ko'rinardi (Excel esa to'g'ri, `34,999.88`, ko'rsatardi - ikkalasi mos kelmasdi, chalkashtiruvchi). Tuzatish: `costTxt` endi `toLocaleString(undefined,{maximumFractionDigits:2})` ishlatadi - Excel eksporti bilan bir xil aniqlik (butun sonlarda ortiqcha ".00" qo'shmaydi, kasrli narxda haqiqiy qiymatni ko'rsatadi). Boshqa `rcost` ishlatilgan joylar (Summa/Jami hisob-kitoblari) tekshirildi - faqat SHU bitta joy (unit narx displeyi) yaxlitlanish muammosiga ega ekan, qolganlari to'g'ri (jami summalarni yaxlitlash normal, chunki ular pul miqdori, birlik narx emas).

**Tekshiruv:** sintaksis OK, 20/20 export testi (yangi wrap/border/kenglik tekshiruvlari bilan) + qolgan 45 avvalgi test - jami 65/65 o'tdi, regressiya yo'q.

---

## Avvalgi holat (2026-07-22) — Zakas: Excel eksporti to'liq yangilandi + supplier nomi endi kesilmaydi

**Supplier nomi (foydalanuvchi tuzatishi):** oldingi ellipsis ("...") yechimi nomni yashirar edi. Endi `.zk-sup-title` cheklovsiz - qisqa nom 1 qatorda, uzun nom kerak bo'lsa 2+ qatorga o'raladi, HECH QACHON kesilmaydi. Yon tomondagi Итого/Целевые дни baribir joyidan siljimaydi (`flex-wrap:nowrap` tashqi konteynerda saqlanadi, faqat nom o'zi ichki o'raladi).

**Excel eksporti (`_zkExportOneDepth`) to'liq qayta qurildi:**
- **SKU → Shtrix-kod (barcode)**: qidiruv/skanerlash SKU emas, barcode bo'yicha qilinishini aks ettirdi (ko'p barcode bo'lsa vergul bilan ajratilgan holda). Eslatma: ekrandagi qidiruv paneli (`_zkRowHit()`) barcode bo'yicha allaqachon ishlaydi edi (2026-07-20 tuzatilgan) - faqat Excel'da ko'rinmagan edi.
- **Narx** ustuni qo'shildi (`r.rcost`, eng ishonchli tannarx).
- **Jami** ustuni qo'shildi (har qator: miqdor × narx).
- **Yakuniy "ZAKAS JAMI SUMMASI" qatori** - ajratilgan, brend rangida (yashil fon+chegara), barcha qatorlarning Jami yig'indisi.
- **Dizayn** ("chiroyliroq" so'rovi): sarlavha qatori endi yashil fon + oq qalin matn (avval oddiy border edi), pul ustunlari (Narx/Jami) yashil qalin shrift bilan ajratildi, zebra (bir qatorlab och fon) qo'shildi o'qish osonroq bo'lishi uchun.

**Tekshiruv:** haqiqiy ExcelJS kutubxonasi (`node_modules`da yo'q) o'rniga minimal API-mos stub yozilib, HAQIQIY (o'zgartirilmagan) eksport funksiyasi shu stub bilan ishga tushirildi - sarlavhalar tartibi, har qator qiymati (barcode/narx/zakas/jami), ko'p-barcode holati, narxsiz holat, yakuniy jami hisobi - **17/17 test o'tdi**. Qolgan 45 avvalgi test ham qayta ishga tushirildi, regressiya yo'q.

---

## Avvalgi holat (2026-07-22) — Zakas: dizayn (rang) + supplier nomi joylashuvi + jami summa birlashtirildi

**Rang (foydalanuvchi so'rovi):** Narx (aniq bo'lsa) va Summa ustunlari, shuningdek har supplier ostidagi jami summa — asosiy brend rangi (`#1D9E75`, yashil) bilan belgilandi, pul qiymati ekanini ko'rgazmali qildi. Taxminiy narx (`rcostApprox`) ATAYLAB to'q sariq (`#EF9F27`) holicha qoldirildi — "ishonchsiz" signalini yo'qotmaslik kk. Jami summa yozuvi ham kattalashtirildi (14px→18px).

**Ustun kengligi qayta muvozanatlandi (foydalanuvchi jonli ekranda ko'rib topdi):** Narx ustuni katta ekranlarda ortiqcha bo'sh joy egallagani payqaldi (7%→6%), bo'shagan joy sarlavhasi kesilib qolayotgan "Дней осталось" ustuniga berildi (5%→6%). Yakuniy colgroup: 4/3/22/5/6/7/6/10/7/6/13/11%.

**Supplier sarlavhasi joylashuvi (yangi topilma):** uzun supplier nomlarida ("''ASIAN NATIONAL DISTRIBUTION'' MCHJ (№1604 от 25.01.2024)...") yonidagi "Итого/Целевые дни" ma'lumoti PASTGA tushib ketardi (`.zk-sup-name{flex-wrap:wrap}` sababli), qisqa nomlarda esa (масалан "Falcon Fly Trade") joyida turardi — nomga qarab beqaror ko'rinish. Tuzatish: `flex-wrap:nowrap` + nom matni endi `.zk-sup-title` klassi bilan **kesib, "..." qo'yiladi** (`text-overflow:ellipsis`), to'liq nom `title` atributi (hover tooltip) orqali ko'rinadi — meta (Итого/Целевые дни) endi supplier nomi uzunligidan qat'i nazar DOIM bir xil joyda.

**Jami summa MUNTAZAM+CHUQURni birlashtirdi (muhim tuzatish, foydalanuvchi jonli ekranda topdi):** avval jami summa faqat OCHIQ TAB (Muntazam yoki Chuqur, qaysi biri ekranda ko'rinib tursa)ning belgilangan qatorlaridan hisoblanardi — agar bir supplierda ham Muntazamda, ham Chuqurda galochka qo'yilgan bo'lsa, jami summa faqat bittasini ko'rsatib, ikkinchisini "yo'qotib qo'yardi" (real test: 43,000 ko'rsatardi, to'g'risi 73,000 edi). Tuzatish: `renderZakas()`da allaqachon hisoblangan `_supOther` (boshqa bo'limning to'liq ro'yxati) dan shu supplierning qatorlari topilib, ularning belgilangan summasi ham qo'shildi — endi "bitta supplier filtr qilinganda, galochkaga kirgan HAMMA tovar (qaysi bo'limda bo'lishidan qat'i nazar) jami summasi aniq chiqadi".

**Tekshiruv:** sintaksis OK, index.html=sales.html, **45/45 test o'tdi** (2 yangi: birlashtirilgan jami summa + avvalgi 43).

---

## Avvalgi holat (2026-07-22) — Zakas: jonli ekranda topilgan 3 ta joylashuv nuqsoni tuzatildi

Oldingi push (`8cbf52d`)dan keyin foydalanuvchi jonli saytda ko'rib, 2 ta muammoni aniqladi (analitik tekshiruv payqamagan, chunki ular haqiqiy shrift render/text-transform bilan bog'liq edi):
1. **Tovar nomi ustuni** (`product`, 17%) haddan tashqari tor bo'lib qolgan — uzun nomlar 2-3 qatorga bo'linib, qatorlar cho'zilib ketgan.
2. **Ustun sarlavhalari bir-biriga qo'shilib ko'ringan** ("СРЕДН. В ДЕН", "ДНЕЙ ОС") — sabab: `_zkTh()` funksiyasida `white-space:nowrap` bor edi (`.zk-ktbl th{overflow:hidden}` bilan birga), uzun ruscha so'zlar ("Средн. в день", "Дней осталось") tor ustunda kesilib qolgan. **Bu eski, oldindan mavjud bo'lgan xususiyat edi** — mening oldingi push'im uni buzmadi, lekin ustunlarni tiqishtirish orqali muammoni ko'zga ko'proq tashlanadigan qildi.

**Tuzatish:**
- `_zkTh()`dagi `white-space:nowrap` olib tashlandi — sarlavhalar endi 2 qatorga o'raladi (`line-height:1.3` qo'shildi), hech qanday so'z kesilmaydi.
- **"Open" belgisi ixchamlashtirildi** (`padding:4px 14px`→`3px 8px`, `font-size:11px`→`10px`) — bu Status ustunini xavfsiz kichraytirishga imkon berdi.
- Colgroup qayta taqsimlandi: **product 17%→22%** (Status va Narxdan 7% olib berildi, ular 9%→7%ga tushirildi, "Open" belgisi kichraylagani uchun xavfsiz).

**Tekshiruv:** eski `white-space:nowrap` qatori kod bazasida 0 marta uchraydi (grep bilan tasdiqlangan), colgroup yig'indisi 100%, ustun soni hali ham 12=12 mos, 43/43 test qayta o'tdi (regressiya yo'q).

---

## Avvalgi holat (2026-07-22) — Zakas: Narx/Summa ustunlari + eng ishonchli tannarx (rcost)

Foydalanuvchi so'rovi: har bir zakas qatoriga kelish narxi (Narx) va shu qatorning summasi (miqdor × narx) qo'shilsin, lekin Summa **faqat galochka qo'yilgan qatorda** hisoblansin ("faqat zakas beriladigan summa chiqadi"), va har supplier jadvali ostida **belgilangan qatorlarning jami summasi** ko'rinsin.

**Backend — eng ishonchli tannarx (`build_prev_avg.py`, `recompute_current_cost`/`build_current_cost`):** foydalanuvchi alohida ta'kidladi — "cost narxini eng ishonchli joydan olishimiz kk", va yangi tovar hali prixodga kelmagan bo'lsa narx aniq bo'lmasligi mumkinligini ogohlantirdi. Yechim — `backend_p6_suppliers.py`da ALLAQACHON mavjud, sinovdan o'tgan `kirim_cost_breakpoints()`/`cost_at()` funksiyalari qayta ishlatildi (p6/p9 tannarx modeli bilan bir xil manba, yangi kod yozilmadi):
1. Har SKU uchun **haqiqiy kirim tarixidagi eng so'nggi narx** (`data_kirim.json`, Returned/Custom Return holatlari chiqarib tashlangan) — bu narx har build'da qayta hisoblanadi (keshlanmaydi), shuning uchun tovar keyinchalik prixodga kelsa yoki narxi o'zgarsa, **avtomatik, keyingi build'da** yangi narxga o'tadi.
2. Kirim tarixi umuman topilmasa (yangi tovar) — katalog `sp` (keyin `p`) ga fallback, natija `rcost_approx=true` deb belgilanadi.

Real ma'lumotda tekshirildi: 21,743 tovarga rcost hisoblandi (1,275 tasi taxminiy — hali prixodga kelmagan), mustaqil yozilgan hisob bilan **0 farq**. Bitta real misolda katalog narxi (800 so'm) haqiqiy kirim narxidan (1,400 so'm) 75% farq qilgani aniqlandi — aynan shu sabab "eng ishonchli joydan olish" muhim edi.

**Frontend (`sales_runtime.js`):** `_enrichWithInventory()`/`_buildZItems()`/`_zkBuildSuppliers()` zanjiri orqali `rcost`/`rcostApprox` har qatorga yetkazildi (mavjud `pav`/`avg30sa` bilan bir xil naqsh). Jadvalga **Narx** (Holat↔Zakas orasida) va **Summa** (Zakas'dan keyin) ustunlari qo'shildi — Summa faqat `_zkIsChecked(r)` true bo'lganda hisoblanadi, aks holda "—". Taxminiy narx (`rcostApprox`) "≈" belgisi + tooltip bilan ko'rsatiladi. Har supplier jadvali ostida, o'ng burchakda **"Belgilangan summa"** — shu supplierning belgilangan qatorlari yig'indisi (`s.rows.reduce`, har render qayta hisoblanadi — qo'lda miqdor/qo'shimcha kun o'zgartirilganda ham AVTOMATIK yangilanadi, alohida kod kerak bo'lmadi, testda tasdiqlandi).

**Joylashuv/kenglik muammosi (foydalanuvchi so'radi, tekshirildi):** 2 yangi ustun qo'shilishi bilan ba'zi ustunlardagi qattiq-o'lchamli elementlar (Qo'shimcha kun/Zakas soni input'lari, 70px) o'z katakchasiga sig'may qolish xavfi borligi piksel darajasida hisoblab aniqlandi. Jiddiyroq topilma: `.zk-tbl-wrap`da gorizontal skroll yo'q edi (`overflow-y:auto` faqat) — juda tor oynada eng o'ng ustunlar (Narx/Summa) ko'rinmay qolishi mumkin edi. Tuzatildi: `overflow:auto` (ikkala o'q), jadval `min-width` 900px→1000px, va barcha 12 ustun kengligi eng tor holatida ham xavfsiz sig'adigan qilib qayta hisoblandi (colgroup: 4/3/17/5/6/7/5/10/9/9/13/12%).

**Tekshiruv:** backend mustaqil hisob bilan 0 farq (21,743 tovar). Frontend: sintaksis OK, colgroup/thead/tbody ustun soni mos (12=12=12), JSON butunligi OK, index.html=sales.html bir xil, **43/43 test o'tdi** (13 yangi: Narx/Summa/reaktivlik + 30 avvalgi, regressiya yo'q).

**Halol eslatma:** ustun kengligi tekshiruvi analitik/matematik — haqiqiy brauzerda vizual tekshirilmadi (bu muhitda vosita yo'q), foydalanuvchidan real ko'rib tasdiqlash so'raldi.

---

## Avvalgi holat (2026-07-22) — Zakas: Kategoriya/Subkategoriya filtri kompakt "Filtr" tugmasiga yig'ildi

Foydalanuvchi: supplier ichidagi eski ikkita keng `<select>` (Kategoriya/Subkategoriya) qatori "juda noqulay" va "xunuk" ko'rinishda edi, joyni ko'p olar edi. p2 (Mahsulotlar) va p3 (ABC) sahifalarida allaqachon mavjud bo'lgan **kompakt "Filtr" tugmasi + popover** naqshi (`.p2-fbtn`/`.p2-fpop`/`.p2-fgrp`/`.p2-clear` CSS klasslari) qayta ishlatildi — yangi vizual til o'ylab topilmadi, saytda allaqachon tanish bo'lgan naqsh takrorlandi.

- **HTML** (`index.html`+`sales.html`, ikkalasi bir xil): ikkita select o'rniga `#zk-fwrap` (`.p2-fwrap`) > `#zk-fbtn` (funnel ikonka + "Filtr" + son-belgi `#zk-fcount` + chevron) > `#zk-fpop` (popover, `.p2-fgrp` ichida Kategoriya/Subkategoriya select'lari + "Filtrlarni tozalash" tugmasi).
- **CSS**: eski `.zk-sup-sel` (endi ishlatilmaydi, o'chirildi) o'rniga faqat `.zk-fpop`/`.zk-fpop.open` qo'shildi (220px, `dt-pop`/`p2-fpop`ga o'xshash popover uslubi) — qolgan uslub `.p2-fbtn`/`.p2-fgrp`/`.p2-clear`dan meros.
- **JS** (`sales_runtime.js`): `zkFToggle()` (ochish/yopish), `_zkFCount()` (nechta filtr faol — badge + tugma `has` klassi), `zkClearCatFilters()` (ikkalasini tozalab popoverni yopadi), outside-click yopish (`getElementById` bilan, p3'dagi mavjud o'xshash listenerda `.p3-fwrap` klassi HTML'da yo'qligi sababli ishlamay turgan bug'ni TAKRORLAMASLIK uchun ataylab).
- **Standart matn**: "Barcha kategoriya"/"Все категории" (uzun) → **"Tanlash"/"Select"/"Выбрать"** (qisqa, foydalanuvchi so'rovi) — `zk_all_cat`/`zk_all_subcat` tarjima qiymatlari o'zgartirildi, kalit nomlari saqlab qolindi.
- **Kaskad tekshirildi (allaqachon to'g'ri ishlar edi, kod o'zgartirilmadi):** Kategoriya tanlanganda subkategoriya ro'yxati avtomatik faqat shu kategoriyaga tegishlilarga qisqaradi (`_zkRefreshCatFilters()`dagi `r.catTop===zkCatFilter` filtri) va `zkSubFilter` tozalanadi (`zkCatFilterChange()`). Izolyatsiyadagi test bilan tasdiqlandi.

**Tekshiruv:** sintaksis OK, JSON butunligi OK, `index.html`/`sales.html` bir xil, 16 ta yangi izolyatsiya testi (kaskad, badge, tozalash, toggle) + avvalgi 14 ta test — jami 30/30 o'tdi.

**Push jarayonida gotcha:** avtomatik sync (`sync.yml`) `index.html`/`sales.html`ni push oralig'ida qayta qurib qo'ygan edi (`invdata` yangilandi — bu mening oldingi backend formulamning birinchi avtomatik natijasi). `git apply` bilan patch qo'llash ikkala HTML faylda ham jimgina TO'LIQ muvaffaqiyatsiz bo'ldi (faqat versiya-bump qatori qo'lda alohida Edit orqali kirgan edi, CSS/markup esa eski holicha qolib ketayotganini keyingi tekshiruv payqadi) — sabab: patch fayl oxiridagi qator (`\ No newline at end of file` nomuvofiqligi ehtimoli). Yechim: CSS/markup o'zgarishlarini ikkala faylga **to'g'ridan-to'g'ri Edit orqali** (patch emas) qayta qo'llash, keyin diff bilan ikkala faylning bir xilligini tasdiqlash.

---

## Avvalgi holat (2026-07-21) — Zakas: kunlik o'rtacha hisobini qayta qurish + xavfsizlik zaxirasi

Foydalanuvchi asosiy maqsadni aniq qo'ydi: **tovar tugab qolmasin VA ortiqcha zakas berilmasin**. Muammoli holat: bir oy ichida tovar goh sotiladi, goh tugab qoladi, goh stokda turib sotilmaydi — hisob chalkashadi. Butun zakas mantig'i real ma'lumot ustida qayta o'lchandi (taxmin qilinmadi; backtest 4 ta mustaqil sanada, tovar turlari bo'yicha alohida).

**Topilgan kamchiliklar (eski hisobda):**
- `stok > 10` chegarasi kichik stokli tovarlarni "tugagan" deb belgilardi — `/30`ga tushib qolgan 3,002 tovardan **2,324 tasi aslida stokda bor edi**.
- `effektiv kun >= 8` chegarasi **keskin jar** edi: 7 kun → `/30`, 8 kun → `/8` (bitta kun farqi bilan natija 3.75 barobar sakrardi).
- Stok raqamining o'zi ishonchsiz: real kunlik snapshotda **13.2% manfiy**, sotilmagan kunlarning **21%ida** raqam haqiqatga zid (6.4% "0/manfiy dedi, aslida bor edi"; 9.3% "1-10 dedi, aslida yo'q edi"; 5.3% "10dan ko'p dedi, aslida yo'q edi").

**Yangi hisob (`build_prev_avg.py` → `_compute_avg30_stock_aware`):**
1. **Stok chegarasi 10 → 2.** Sotilmagan kun, tiklangan stok **2 dan katta** bo'lsa "bor edi" (mavjud kunga qo'shiladi), aks holda "tugagan" (chiqariladi). 1-2 dona amalda ko'pincha sotib bo'lmaydigan qoldiq — foydalanuvchi do'kon tajribasidan aytdi.
2. **Ishonch og'irligi `K=5`** — `(jami + 5×pav) / (mavjud kun + 5)`. 8 kunlik jar butunlay olib tashlandi: mavjud kun kam bo'lsa hisob tayanch tezlikka (pav) suyanadi, ko'p bo'lsa o'z ma'lumotiga.
3. **3x cheklov** — kunlik o'rtacha kalendar tezligining (jami/30) 3 barobaridan oshmaydi; yangi chiqqan/portlagan tovarlardan himoya (real holat: 23 kun yo'q edi → 7 kunda 709 dona → keyin 3/kun).

**Rad etilgan variantlar (hammasi real ma'lumotda sinab ko'rilgan):**
- Tugagan kunlarni bo'luvchiga qo'shish (`/30`) — "o'lim spirali": tovar tugaydi → 0 lar o'rtachani pasaytiradi → kamroq zakas → yana tugaydi. Tugab qoladigan tovarlarning **62.9%iga kam zakas** beradi.
- Sof `jami/mavjud kun` (yumshatishsiz) — portlash holatlarida ortiqcha.
- **Trend/mavsumiylik tuzatishi** — xatoni yomonlashtirdi (0.598 → 0.774). Mavsumiy tovar (qulupnay) odam qaroriga qoladi: tarix 2026-01-01 dan boshlanadi, o'tgan yil ma'lumoti yo'q.
- **KIRIM-GUVOHLIGI** — kun sotilmagan bo'lsa, keyingi sotuv YANGI KIRIMdan keyin bo'lgan bo'lsa "tugagan" deb olish (stok raqamiga qaramasdan). Bu biroz **aniqroq** edi (0.638 va 0.652) va stok raqami xato bo'lgan holatlarni ushlardi (tugagan deb belgilangan kunlarning 24.8%ini FAQAT shu qoida topardi). Lekin foydalanuvchi **soddalik uchun faqat stok qoidasini** qoldirishni tanladi — tizim tushunarli bo'lishi muhimroq. Kod git tarixida (shu commit'dan oldingi versiyada) saqlangan.

**Natija (backtest, 2 mustaqil sana, "o'rta" zaxira bilan birga):** aniqlik `0.698 → 0.651` va `0.727 → 0.670`. Tugab qolish **beshala tovar turida ham kamaydi**: tez 8.3%→5.2%, tugab-tugab 5.4%→3.5%, sekin+stok ko'p 2.5%→2.4%, sekin+stok kam 10.0%→8.2%, o'rtacha 6.2%→5.2%. Jami: **3.9% → 3.5%**, bog'langan pul **+7%**.

**Xavfsizlik zaxirasi (`sales_runtime.js` → `ZK_BUFFER`, foydalanuvchi taklifi):** maqsadli kun ustiga ABC bo'yicha foiz qo'shiladi. Foiz (qat'iy kun emas), chunki maqsadli kun ta'minotchiga qarab 7..30 orasida o'zgaradi — "+3 kun" 7 kunlik zakasda ortiqcha, 30 kunlikda yetarli emas. A ga eng ko'p — o'lchov aynan A tovarlar eng ko'p tugab qolishini ko'rsatdi (20 kunlik maqsadda 5.5%, C esa 2.6%; tekis sotiladigan A tovarning kelasi talabi bashoratdan 33%+ oshishi 9.2% holatda).

O'lchangan pog'ona (tugab qolish / bog'langan pul, eski tizimga nisbatan):

| Daraja | A | B | C | Xavf | Pul |
|---|---|---|---|---|---|
| zaxirasiz | — | — | — | 3.6% | −8% |
| yengil | har 10 kunga +1 | har 17 ga +1 | har 33 ga +1 | 3.1% | +11% |
| **O'RTA (tanlandi)** | **har 5 kunga +1** | **har 8 ga +1** | **har 17 ga +1** | **2.7%** | **+29%** |
| kuchli | har 3 kunga +1 | har 5 ga +1 | har 10 ga +1 | 2.3% | +56% |

Foydalanuvchi avval "kuchli"ni taklif qilgan edi, keyin narxini ko'rib **"o'rta"**ni tanladi (`{A:0.20,B:0.12,C:0.06}`) — bir-ikki hafta ishlatib ko'rilgach o'zgartiriladi, faqat shu bitta qator. `ZK_BUFFER_SKIP_CATS` — muddatli tovarlar (sut/non/muzqaymoq) uchun istisno ro'yxati, hozircha bo'sh.

**Manfiy stokli tovarlar (2,944 ta, shundan 1,116 tasi sotilayotgan, ~648 mln so'mlik zakas):** avtomatik hisoblanmaydi (foydalanuvchi qarori — `-23,653` kabi holatlar hisob xatosi, jismonan tovar bor bo'lishi mumkin). Buning o'rniga: (a) endi **oddiy ro'yxatda ko'rinadi** (avval `orderQty=0` sababli "Hammasini ko'rsatish" ortida yashirinardi), (b) **"Hammasini belgilash"ga qo'shilmaydi** — menejer kategoriya mas'ulidan so'rab, "Qo'shimcha kun" ustuniga qiymat kiritadi va qo'lda belgilaydi.

**Qo'lda kiritilganlar endi saqlanadi** (`localStorage`: `zk_sup_targets`/`zk_row_adj`/`zk_row_qty`) — avval F5 bosilsa yoki brauzer yopilsa hammasi yo'qolardi.

**Tekshiruv:** backend natijasi mustaqil yozilgan hisob bilan solishtirildi — **11,459 tovarning hammasida 0 farq**. Frontend: sintaksis OK + izolyatsiyada 12 ta test (ABC zaxirasi, stok ayirilishi, manfiy stok xatti-harakati, qo'lda kun kiritilishi) — hammasi o'tdi. `sales_runtime.js` kesh-versiyasi ikkala HTML'da yangilandi.

**Tegilmagan:** ulgurji ajratish (`rt`/`wi`/`we`), `pav` hisobi, ochiq buyurtma (Open PO) mantig'i.

---

## Avvalgi holat (2026-07-17) — Zakas: ta'minotchisiz tovarlarni tiklash (real zakasga tayyorlash)

Foydalanuvchi zakas tizimini real zakasga o'tkazishdan oldin to'liq audit so'radi. Zakas kodini (frontend `zk*`/`_zk*`, `build_prev_avg.py`, `backend_p5_stock.py`) ko'rib chiqib, bir nechta kamchilik topildi. Muhokamadan keyin quyidagilar aniqlandi:

- **#3 (ochiq buyurtmada zakas 0 qilinishi) — ATAYLAB, tegilmaydi.** Open PO'li tovarga qayta zakas taklif qilinmaydi (pending ayirilmaydi), stok oshmaguncha. Xotira: [[project-zakas-open-po-suppression]]. Qo'lda qiymat ham Open'da qulflanadi (foydalanuvchi tasdiqladi — o'zgartirilmadi).
- **#1 (ta'minotchisiz tovarlar zakasdan tushib qolishi) — HAL QILINDI (1-qadam, push `6e7d67b`).** 323 ta ta'minotchisiz tovardan 223 tasining ta'minotchisi kirim tarixidan tiklanadigan (A=0: hech biri "keyin ta'minotchisiz kelim" emas — hammasi "oxirgi kelim ta'minotchili, keyin umuman kelmagan"). `build_all_from_api.py` `build()` ichida (kirimdata qurilgach, `build_invdata`/`build_supplierdata`dan oldin) bo'sh `su` maydoni `supplier_at()` (p6'ning mavjud funksiyasi) bilan kirim tarixidagi oxirgi ta'minotchidan to'ldiriladi. Mavjud `su` ustidan yozilmaydi. Real ma'lumotda **225 to'ldirildi, 0 ustidan yozildi** (lokal test bilan tasdiqlandi, API kerak bo'lmadi). Frontend o'zgarishi kerak emas — build o'zi qayta yaratadi.

- **#1 davomi (2-qadam) — HAL QILINDI (push `3ac0dbb`).** Qolgan 100 tovar (kirim tarixi ham yo'q, ta'minotchi tiklab bo'lmaydi) endi zakasда butunlay tushib qolish o'rniga **"Noma'lum"** umumiy guruhida ko'rinadi (p6 Suppliers'dagi bir xil konventsiya). `sales_runtime.js`ning `_zkBuildSuppliers()` (`ZK_NO_SUPPLIER` konstantasi, `supOf(v)` fallback) — bo'sh `v.sup` endi guruhni "tashlab ketish" o'rniga shu umumiy nomga tushadi, boshqa har qanday ta'minotchi bilan bir xil hisoblash mantig'ida (muntazam/chuqur, miqdor). Real ma'lumot tekshiruvi: 100 tadan 73 tasi `pav`ga (chuqur), 24 tasi oxirgi 30 kun sotuviga (muntazam) mos, 14 tasi haqiqatan o'lik (stok/tarix yo'q — to'g'ri ravishda hech qayerda chiqmaydi). Haqiqiy funksiya (fayldan o'zgartirilmagan holda olingan) Node'da sintetik holatlar bilan izolyatsiyada sinovdan o'tkazildi — regressiya yo'q.

**Ikkalasi ham (1+2-qadam) push qilindi va tasdiqlandi — zakas tizimi endi HECH BIR faol tovarni ta'minotchisi sababli o'tkazib yubormaydi.**

**Eslatma push jarayoni haqida:** push paytida foydalanuvchi `build_all_from_api.py`ga o'zi parallel o'zgarish kiritayotgan edi (`compute_monthly_sku_stats_from_history` va boshqalar) — faqat mening fill blokim ajratib commit qilindi, foydalanuvchining ishi ishchi papkada commit qilinmagan holda saqlanib qoldi. Shuningdek, `sync.yml`ning davriy squash+force-push mexanizmi (avvaldan ma'lum, [[project-git-repo-size-cleanup]]) push paytida bir necha marta (3 marta ketma-ket) origin'ni oldinga surib yubordi — har safar xavfsiz `git reset --mixed origin/main` + qayta commit bilan hal qilindi, ma'lumot yo'qolmadi.

---

## Avvalgi holat (2026-07-16) — Yangi bo'lim: Kategoriyalar (p10)

Foydalanuvchi ma'lum kategoriya (mas. "Мороженое") bo'yicha tushum/tannarx/foyda/marja/ABC/mahsulotlar ro'yxatini ko'radigan bo'lim so'radi — hech bir mavjud bo'lim buni to'liq bermasdi (p3 ABC'da tushum bor-lekin foyda yo'q, p2'da faqat ro'yxat, p6 Suppliers'da foyda bor-lekin ta'minotchi kesimida).

**Qaror qilingan dizayn (suhbatda aniqlashtirildi):**
- Ierarxiya: Kategoriya (top) → Subkategoriya → Mahsulotlar — Invan'ning `categories[0]` (leaf/sub) + `parent_id` (top) tuzilishiga mos (`build_all_from_api.py`da allaqachon `cat`/`catTop` sifatida hisoblanardi, faqat P2'ga yetib bormasdi — `backend_p2_mahsulotlar.py`ga bitta qator qo'shildi).
- Sana oralig'i: p1/p2/p3'dagi kabi ixtiyoriy kun-kun tanlanadi (p9 Ombor aylanmasi'dagi mustaqil `<input type="date">` juftligi naqshida), tushum/miqdor `data_history.json` (HIST, kunlik massiv) dan **aniq** hisoblanadi.
- Tannarx: dastlab p6'dagi kabi OYLIK keshlangan kirim narxi taklif qilingan edi, lekin foydalanuvchi **kun-aniq (p9 uslubi)ni** tanladi — keyin yana aniqlashtirdi: tannarx = shu sana oralig'ida HAQIQIY kirim qilingan (qabul qilingan) tovarga sarflangan summa (`data_kirim.json` dan, p9'ning `_oaRowFor()`dagi `iq`/`ia` bilan bir xil mantiq) — bu "sotilgan tovar tannarxi" (COGS) emas, balki naqd oqim ko'rsatkichi ("shu davrda sotishdan qancha kirdi, ta'minotchiga qancha ketdi"); katta hajmda kirim bo'lgan davrda FOYDA sun'iy past/manfiy ko'rinishi mumkin — bu kutilgan holat.
- ABC: har mahsulotning P2'da allaqachon hisoblangan GLOBAL (butun do'kon bo'yicha) klassifikatsiyasi qayta ishlatiladi (kategoriya kesimida alohida qayta hisoblanmaydi) — p6 supplierlar bilan bir xil naqsh.
- "Sotilmayotgan tovarlar" ro'yxati va Excel eksport (3 daraja: top-kategoriya ro'yxati, subkategoriya mahsulot jadvali, sotilmayotganlar) — p6 (Suppliers) bilan bir xil chuqurlikda, xuddi shu vizual naqshda (`_p6ShowOverlay`/`_p6MzAllItems` naqshlari).

**Implementatsiya:** yagona backend o'zgarishi — `backend_p2_mahsulotlar.py`ga `"catTop"` maydoni qo'shildi. Qolgan hammasi frontend (`sales_runtime.js`, prefiks `kt*`/`_kt*`) — yangi backend data fayli, pipeline bosqichi yoki keshlash mexanizmi kerak bo'lmadi (mavjud `data_mahsulotlar.json`+`data_history.json`+`data_kirim.json`+`data_stock_snapshot.json`/`ombor_aylanmasi.js`ning `_oa*` yordamchi funksiyalari qayta ishlatildi). Navigatsiyaga qo'shildi (`_ALL_TABS`/`NAZ_TABS`/`showPage()`/sidebar+page div ikkala HTML faylda). To'liq texnik tafsilot: [KODLAR_XARITASI.md](KODLAR_XARITASI.md) (p10 qatori).

**Keyingi qadam (foydalanuvchi so'ragan, hali bajarilmagan):** ABC tahlili (p3) sahifasining joylashuvini/ko'rinishini biroz tuzatish.

---

## Avvalgi holat (2026-07-15) — Arxitekturani qayta qurish boshlandi

Foydalanuvchi loyihani backend/frontend'ga haqiqiy ma'noda ajratishni so'radi (mobile keyingi bosqichlarga qoldirildi). To'liq reja va bosqichlar: **[ARXITEKTURA_QAYTA_QURISH.md](ARXITEKTURA_QAYTA_QURISH.md)** (yangi chatda davom ettirishdan oldin shu faylni o'qing).

**Phase 1 (hozir bajarilmoqda):** `invdata`/`p2data`/`dailydata`/`supplierdata`ni `index.html`/`sales.html`dan chiqarib, `p3data`/`kirimdata`dagi kabi "fetch on demand" naqshiga o'tkazish — HTML hajmini ~52MB'dan ~1MB'ga tushirish. Bu ishning davomida shu narsalar ham aniqlandi:
- Git squash+force-push (`sync.yml`) endi **har 30 daqiqada avtomatik** ishlaydi (70-71-qatordagi eski yozuvda "davriy qo'lda bajariladigan vazifa" deb yozilgan edi — bu endi eskirgan, avtomatlashtirilgan).
- `sales_api_client.js` — haqiqiy backend API (`/api/v1/bootstrap` va h.k.)ga mo'ljallangan, lekin hech qachon tugatilmagan stub ekani topildi (batafsil: ARXITEKTURA_QAYTA_QURISH.md).

Bu — 68-qatordagi "Kelajakda qilish kerak bo'lgan ishlar" bo'limida oldindan qayd etilgan ehtiyojning davomi (git repo hajmi muammosining tub yechimi).

---

## Avvalgi holat (2026-07-08)

**Ombor aylanmasi (p9) — Boshlanish/Yakun narx xatosi tuzatildi (deploy qilindi, commit `660b65c`).** Foydalanuvchi Invan'ning "Inventory Turnover" hisobotini bizniki bilan solishtirib, "Начало"/"Конец" summasi mos kelmasligini payqadi.
- **Sabab topildi:** `ombor_aylanmasi.js` Boshlanish/Yakun qoldig'ini baholashda **bitta flat joriy narx** (`meta.cost` — bugungi `sp`)ni istalgan o'tmish sanasiga qo'llagan, holbuki tovar narxi vaqt o'tishi bilan o'zgargan bo'lishi mumkin.
- **Tuzatish:** (1) `backend_p9_ombor_aylanmasi.py`ning `build_stock_snapshot()` funksiyasi endi kunlik qoldiq bilan birga kunlik tannarxni ham (`"c"` massivi) snapshot qiladi. (2) `ombor_aylanmasi.js`da yangi `_oaCostAt()` — snapshot oynasi ichidagi (bugun/yaqin kunlar) sanalar uchun jonli snapshot narxini, undan oldingi sanalar uchun **`data_kirim.json`dagi shu sanadan oldingi eng so'nggi haqiqiy kirim narxini** ishlatadi (FIFO va vaznli-o'rtacha modellari ham sinovdan o'tkazilib, ikkalasi ham yomonroq natija bergani uchun rad etildi — batafsil xotira `project-ombor-aylanmasi-cost-model`da). (3) Kirim sanasi UTC'dan Toshkent (+5soat)ga to'g'irlandi (`_oaLocalDate()`) — sotuv tarixi bilan bir xil kun chegarasida solishtirish uchun.
- **Tekshiruv:** Invan'ning real Excel eksportlari (21,576 SKU, 2 ta mustaqil sana oralig'i: 12.05-08.07 va 15.04-08.07) bilan solishtirildi — Boshlanish summasi mos kelishi 76%→84%ga, Yakun 92%da barqaror. Qolgan farq asosan: kirim tarixi yo'q SKU'lar va Invan'ning o'z tomonidagi kamdan-kam narx anomaliyalari (bittasi — Turso'dan to'g'ridan-to'g'ri tekshirilib, "PRICING" psevdo-buyurtma mexanizmi sababchi emasligi tasdiqlandi — bazada bor-yo'g'i 1 ta shunday yozuv bor).
- **p9 hali navigatsiyaga qo'shilmagan** (sinov bosqichida) — CI-kritik fayllar ro'yxatiga `backend_p9_ombor_aylanmasi.py`, `ombor_aylanmasi.js`, `data_stock_snapshot.json` qo'shildi ([KODLAR_XARITASI.md](KODLAR_XARITASI.md)).

**Muhim kashfiyot:** lokalda `turso_url.txt`/`turso_token.txt` (gitignored) orqali **jonli Turso bazasiga faqat-o'qish so'rovi yuborish mumkin ekan** — bu avvalgi taxmindan ("lokal test qilib bo'lmaydi") farqli, diagnostika/tekshiruv uchun foydalanish mumkin (yozish/pipeline ishga tushirish hali ham ehtiyotkorlik talab qiladi).

---

## Avvalgi holat (2026-07-06)

**Yangi "Kirim" bo'limi (p8) — ta'minotchidan kelgan tovar tarixi:** Invan'ning `POST /integration/v1/supplier_order` API endpointi shu kuni productionga chiqarilgani aniqlandi — har buyurtmaning `items[]`ida `sku`, `received` (haqiqiy kelgan miqdor), `cost`, `received_date`, `supplier.name` bor (ilgari mavjud bo'lmagan imkoniyat, batafsil: xotira `project-supplier-order-api`).
- Yangi Turso jadvali `supplier_orders` (id/created_at/data) — `turso_sync_supplier_orders.py` orqali sinxronlanadi (`turso_sync.py`ning `orders` jadvali bilan bir xil naqsh: id bo'yicha upsert, cheklovsiz tarix). Boshlang'ich 17,075 ta buyurtma bir martalik import qilindi.
- `backend_p8_kirim.py` — `merge_kirimdata()` funksiyasi SKU bo'yicha kirim tarixini (qachon, kimdan, qancha) **incremental** yig'adi (`data_history.json`ning naqshiga o'xshab, har safar butun tarixni qayta hisoblamaydi — faqat yangi/o'zgargan buyurtmalarni qo'shadi, `_synced_until` watermark bilan, 5 kunlik overlap status o'zgarishlarini (Open→Received) ushlash uchun).
- `build_all_from_api.py`ga integratsiya qilindi (`data_kirim.json` yoziladi, `kirimdata` script id orqali HTML'ga joylashtiriladi), `.github/workflows/sync.yml`ga yangi sinxronizatsiya qadami qo'shildi.
- Frontend: yangi `p8` sahifasi (`sales_runtime.js`, p6 Suppliers naqshiga o'xshab) — mahsulotlar ro'yxati (nomi, SKU, hozirgi stock, kelgan soni, kelgan narxi, oxirgi sana), qidiruv, saralash, pagination, 3 tilga tarjima; qatorga bosilganda to'liq ekranli panelda shu mahsulotning arrival tarixi (sana/ta'minotchi/kutilgan/kelgan/narx/summa/holat) ochiladi.
- **DEPLOY QILINDI VA ISHLAYAPTI** (production, tiin-market.vercel.app) — foydalanuvchi tasdiqladi. Yo'lda uchragan gotcha'lar (barchasi tuzatildi): `data_kirim.json`ni HTML ichiga joylash `index.html`ni shishirib yuborgani, `_ALL_TABS`/`NAZ_TABS` ro'yxatida yo'qligi sababli tugma yashiringani, JS kesh-versiyasi yangilanmagani — batafsil: xotira `feedback-new-page-checklist`.
- **Zakas (p7) bilan integratsiya qilindi:** agar mahsulotga ta'minotchidan ochiq (Open/New) buyurtma bo'lsa, "Holat" ustunida yashil "Open" belgisi chiqadi va yangi zakas miqdori taklif qilinmaydi (`krPendingQty()` funksiyasi, `sales_runtime.js`).
  - **ERTAGA BIRINCHI ISH — TUZATISH KERAK:** foydalanuvchi payqadi — ba'zi SKU'larda bitta buyurtma "Ochiq" turibdi, lekin o'sha SKU boshqa (alohida) buyurtma orqali ALLAQACHON "Qabul qilingan" bo'lib qolgan bo'lishi mumkin — shunda "Open" belgisi noto'g'ri/ortiqcha chiqadi (zakas kerak bo'lmasa ham ko'rsatiladi). `krPendingQty()` hozircha SKU bo'yicha barcha Open/New arrival'larni jamlaydi, boshqa Received buyurtma bilan solishtirmaydi. Yechim variantlari: (a) faqat eng so'nggi (sana bo'yicha) buyurtmaning statusiga qarash, (b) yoki Open buyurtma sanasidan keyin Received bo'lgan boshqa buyurtma bo'lsa, Open'ni e'tiborsiz qoldirish. Aniq qaysi mantiq to'g'ri ekanini foydalanuvchi bilan aniqlashtirib olish kerak.

---

**Git repo hajmini kichraytirish (yakunlandi):** `.git` papkasi 6.4GB'dan **399MB'gacha** qisqartirildi (~94%). Sabab: `sync.yml` har 30 daqiqada `index.html`(~80-124MB)/`sales.html`(~89MB)ni to'liq qayta yozib commit qilar edi, 655 ta commit shu tarzda to'plangan edi.
- Yondashuv: butun tarix (655 commit) `git commit-tree` orqali **1 ta yangi "boshlang'ich" commitga** birlashtirildi (joriy fayllar holati diff bilan tekshirilib, o'zgarishsiz saqlangani tasdiqlandi). Boshida "oxirgi 24 soatni saqlash" rejalashtirilgan edi, lekin tarixda 72 ta merge commit borligi aniqlanib (rebase konflikt xavfi), to'liq squash'ga o'tildi (foydalanuvchi tasdiqladi).
- `git push --force-with-lease origin main` bilan GitHub'ga yuborildi (avval `origin/main`da bizning ishimiz paytida qo'shilgan ~27 ta avtomatik sync commiti borligi aniqlanib, squash ular ustiga qayta qurildi — hech narsa yo'qolmadi).
- Force-push'dan keyin ham hajm darhol qisqarmadi (sabab: `refs/remotes/origin/main` lokal ko'rsatkichi eski tarixga ishora qilib, `gc`ga to'sqinlik qilgan) — `git fetch --prune` + `git repack -a -d` bilan yakunlandi.
- **CI'ga ta'siri yo'q**: `actions/checkout@v4` har doim yangi/shallow clone qiladi, tarix ketma-ketligiga bog'liq emas — foydalanuvchining keyingi qo'lda commiti (`45270da`) muvaffaqiyatli push bo'lgani bilan ham tasdiqlandi.
- Eslatma: eski 4 ta stash (`codex-before-refund-rebase` va h.k.) va `refs/codex/turn-diffs/checkpoints/...` ref'lari ko'rib chiqildi, lekin **tegilmadi** — alohida masala, kerak bo'lsa keyinroq ko'rib chiqiladi.

---

**Arxiv tozalash (yakunlandi):** `arxiv/`dagi 25 ta fayldan 23 tasi butunlay o'chirildi (kodga aloqasi yo'q, git tarixida saqlanadi) — to'liq ro'yxat [KODLAR_XARITASI.md](KODLAR_XARITASI.md#arxiv-papkasi)da. Foydalanuvchi ham root'dagi `sotuv_excel.xlsx`/`"Товары (6).xlsx"` va `arxiv/Book1.xlsx`/`sotuv_hafta_test.xlsx`ni o'zi qo'lda o'chirdi (Excel pipeline butunlay kerak emasligi tasdiqlangani uchun). Faqat `Customer_TIN_bosh_tovarlar.xlsx` va `TIN_firma_yoq_taxminiy_ulgurji.xlsx` qoldi (foydalanuvchi qaroriga qoldirilgan, tarixiy qiymati bo'lishi mumkin).

---

## Avvalgi holat (2026-07-05)

**Tugallangan:** Asosiy papkadagi fayllarni tartibga solish (backend/frontend ajratish loyihasi):
1. ✅ Ishlatilmayotgan/bir martalik fayllar `arxiv/` ga ko'chirildi (ro'yxat: [KODLAR_XARITASI.md](KODLAR_XARITASI.md#arxiv-papkasi)).
2. ✅ `build_all.py` bo'lim nomlari bilan alohida fayllarga bo'lindi (`backend_p1_boshsahifa.py`, `backend_p2_mahsulotlar.py`, `backend_p3_abc.py`, `backend_p5_stock.py`, `backend_p6_suppliers.py`, `backend_shared_utils.py`, `backend_html_embed.py`). Eski `build_all.py` → `build_legacy_excel_pipeline.py` deb qayta nomlandi. `build_all_from_api.py` import qatorlari yangilandi. Sintaksis + import + funksional smoke-test bilan tekshirildi (barchasi OK).
3. ✅ `.github/workflows/sync.yml` trigger yo'llari yangi fayl nomlari bilan yangilandi.
4. ✅ `KODLAR_XARITASI.md` yaratildi — bo'lim → fayl xaritasi (backend + frontend qator raqamlari bilan).
5. ⛔ `sales_runtime.js` (frontend) **bo'linmadi** — sabab: barcha bo'limlar kodi chatishib ketgan, umumiy o'zgaruvchilar (P1/P2/P3/P6/ZITEMS) orqali bog'langan, xavfsiz bo'lish uchun katta refaktor + brauzer sinovi kerak. Foydalanuvchi bilan kelishilmagan hali.

6. ✅ `build_legacy_excel_pipeline.py` ham `arxiv/`ga o'tkazildi — foydalanuvchi tasdiqladi: sayt endi **100% API'dan** ma'lumot oladi, Excel faqat alohida bir martalik hisobotlar uchun ishlatiladi, saytga aloqasi yo'q.
7. ✅ Commit qilindi (`65d65ae "Backend kodini bo'limlarga ajratish, keraksiz fayllarni arxivlash"`).
8. ✅ **Push qilindi va tasdiqlandi.** `origin/main`dagi 28 ta avtomatik commit bilan merge qilindi (konfliktsiz), push qilindi (`d7e2300`). GitHub Actions darhol ishga tushdi (run 28751221991) va **muvaffaqiyatli** (`success`) yakunlandi — yangi bo'lingan backend kod real Invan API/Turso ma'lumoti bilan xatosiz ishladi. Natijaviy avtomatik commit (`78c2e77`) ham keldi — pipeline yangi kod bilan to'liq normal ishlayapti. Lokal repo ham shu holatga fast-forward qilindi.

**Xulosa: reorganizatsiya loyihasi tugallandi va jonli holatda tasdiqlandi.**

**Keyingi qadam / ochiq savollar:**
- Foydalanuvchi tasdiqlasa, `sales_runtime.js` bo'lish masalasiga qaytish mumkin (hozircha bo'linmagan qoldi).
- Git repo hajmini kichraytirish vazifasi hali navbatda (pastga qarang).

**Muhim eslatma keyingi ishlar uchun:** Bu loyihada `.github/workflows/sync.yml` orqali **har 30 daqiqada avtomatik** kod ishga tushib, `main`ga o'zi commit+push qiladi (Invan API + Turso). Bu skript uchun kerakli haqiqiy API/DB tokenlar faqat GitHub Actions sirlarida bor — **lokal muhitda pipeline'ni to'liq oxirigacha ishga tushirib bo'lmaydi**. Shu sabab CI-kritik fayllarni (ro'yxat [KODLAR_XARITASI.md](KODLAR_XARITASI.md#ci-kritik-fayllar--rootda-qolishi-shart)da) o'zgartirishda faqat sintaksis/import/qo'lda-yozilgan smoke-test bilan tekshirish mumkin, keyin foydalanuvchi bilan kelishib push qilish kerak.

---

## Kelajakda qilish kerak bo'lgan ishlar (foydalanuvchi so'ragan, hali qilinmagan)

- **Git repo hajmini yana tozalash (davriy, takrorlanadigan vazifa).** 2026-07-06'da `.git` 6.4GB'dan 399MB'ga qisqartirildi (butun tarix 1 commitga squash + force-push, tafsilot yuqorida). Lekin sabab (har 30 daqiqada `index.html`/`sales.html` to'liq qayta commit qilinishi) hal qilinmagani uchun **hajm яна asta-sekin o'sib boradi** (taxminan ~450MB/kun, ya'ni bir necha oyda яна sezilarli bo'lishi mumkin). Foydalanuvchi: "to'g'ri, keyinroq yana tozalaymiz" dedi — ya'ni bu **vaqti-vaqti bilan takrorlanishi kerak bo'lgan ish**, keyingi safar shu suhbatdagi bosqichlarni takrorlash kifoya (commit-tree bilan squash → force-push → fetch --prune → repack).
  - Kelajakda tub yechim sifatida ko'rib chiqish mumkin: (a) shu tozalashni avtomatlashtirish (masalan davriy GitHub Action), yoki (b) katta fayllarni umuman git tarixidan chiqarib, boshqa joyda saqlash (arxitekturani o'zgartirish, Vercel zero-config sozlamasiga ta'sir qiladi) — hali muhokama qilinmagan, faqat variant sifatida aytilgan.

## Arxiv (eski yozuvlar)

*(hozircha yo'q — birinchi yozuv yuqorida)*
