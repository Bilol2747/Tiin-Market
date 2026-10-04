# Zakas agenti

Ta'minotchidan kelgan Excel faylni o'qib, Invan bilan solishtirib, buyurtma yaratadigan vositalar.

> **Bu papkadagi `.js` fayllar git'da saqlanadi — o'chib ketmaydi.**
> Ta'minotchi fayllari (`.xls`/`.xlsx`) esa git'ga tushmaydi ([.gitignore](.gitignore)) —
> ular vaqtinchalik ish materiali. Vercel'ga ham yuborilmaydi ([../.vercelignore](../.vercelignore)).

## Kerakli kutubxonalar

```bash
npm install exceljs xlsx --no-save     # loyiha ildizida
```

⚠️ **Ikkalasini BIRGA yozing.** Loyihada `package.json` yo'q (Vercel zero-config
sozlamasini buzmaslik uchun ataylab), shu sabab `npm install <bitta-paket> --no-save`
qolganlarini **o'chirib yuboradi** — 2026-07-31 da aynan shunday `exceljs` yo'qolgan edi.
Skriptlar buni sezsa aniq tiklash buyrug'ini ko'rsatadi.

## 1. Tekshiruv — buyurtma yaratmaydi

```bash
node zakas/order_agent.js                      # papkadagi eng oxirgi faylni oladi
node zakas/order_agent.js "ORIMI 2026.xls"     # aniq fayl
```

Ko'rsatadi:
- qaysi ustunlar tanlandi (nomi / shtrix / soni / narx) — taxminiy joyi bo'lsa ogohlantiradi
- har tovar holati: ✅ aktiv · ⚠️ **noaktiv** (Invan'da yoqish kerak) · ❌ umuman yo'q
- narx oxirgi kirimdan ±5% dan ortiq farq qilsa — ro'yxat
- soni×narx yig'indisi faylning o'z jamisiga mos keladimi

## 2. Buyurtma yaratish (qoralama)

```bash
node zakas/order_agent.js --suppliers "first"                    # ta'minotchi nomini topish
node zakas/order_agent.js "fayl.xls" --supplier "<aniq nom>" --create
```

Invan'da **qoralama** buyurtma yaratadi (avtomatik tasdiqlanmaydi), keyin uni qayta
o'qib pozitsiya soni va summa mos kelishini tekshiradi.

## 3. Nazorat

```bash
node zakas/order_agent.js --monitor 40
```

Invan'dagi oxirgi buyurtmalarni ko'rib chiqadi: Invan'ning `total_amount` qiymati
soni×narx yig'indisiga mos keladimi, bo'sh buyurtma yoki narxi 0 pozitsiya bormi.
Qaytarish (return) hujjatlari summa tekshiruvidan chetlatiladi — ularda narx boshqa
maydonlarda turadi va farq **xato emas**.

## 4. Shablon fayl (Invan importi uchun)

```bash
node zakas/build_shablon.js --all
```

Xomashyo faylni 4 ustunli shablonga o'giradi: `Наименование · Штрих код · Кол-во · Цена`.

## Muhim qoidalar

- **Moslashtirish FAQAT shtrix-kod bo'yicha.** Nom bo'yicha moslashtirish ataylab yo'q:
  "Greenfield 2grx25" va "Greenfield 2grx100" nomi deyarli bir xil, lekin boshqa tovar.
- **Narx fayldan olinadi.** Invan o'z narxini qo'ymaydi — nima yuborilsa o'shani yozadi
  (19408-buyurtmada tasdiqlangan: aksiya narxi 13 770 o'tgan, bizdagi 16 200 emas).
- **Hech narsa oldindan yuklab saqlanmaydi.** Har shtrix-kod Invan'dan o'sha zahoti
  so'raladi (~0.17s/ta). Sabab: lokal katalog fayllari faqat AKTIV tovarni saqlaydi va
  eskiradi — 2026-07-31 da shu sabab 5 ta tovar "yo'q" deb noto'g'ri xabar qilingan edi.
