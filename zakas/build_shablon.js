// zakas/ papkasiga tashlangan xomashyo Excel (накладная/buyurtma fayli)ni "shablon"
// formatiga (Наименование, Штрих код, Кол-во, Цена — nomi birinchi ustunda) o'giradi.
// Har ta'minotchi fayli boshqacha ustun tartibida keladi, shuning uchun ustunlar
// FAYL NOMI/POZITSIYASI emas, sarlavha SO'ZLARI bo'yicha avtomatik topiladi.
//
// Ishlatish: node build_shablon.js ["fayl_nomi.xlsx"]
//   Argumentsiz — zakas/ papkasidagi eng oxirgi o'zgargan xomashyo fayl avtomatik tanlanadi
//   (allaqachon _shablon.xlsx bo'lganlar, shablonning o'zi va backup fayllar chetlab o'tiladi).
//   --all — papkadagi barcha xomashyo fayllarni birdaniga o'giradi.
// Natija: <asl_nom>_shablon.xlsx, xuddi shu papkada.
//
// Qo'llab-quvvatlanadigan formatlar: .xlsx (ExcelJS) va eski .xls/.xlsm (SheetJS).
// FAQAT soni yozilgan qatorlar olinadi — "Заказ"/"Кол-во" ustuni bo'sh tovarlar
// (ta'minotchi katalogidagi buyurtma qilinmagan pozitsiyalar) tashlab ketiladi.
const fs = require('fs');
const path = require('path');

// Kutubxonalar loyiha ildizidagi node_modules'da turadi va git'ga TUSHMAYDI
// (.gitignore). Ular yo'q bo'lib qolsa (masalan `npm install <boshqa paket>
// --no-save` eskilarini tozalab yuborsa — 2026-07-31 da aynan shunday bo'lib
// exceljs o'chib ketdi) tushunarsiz xato o'rniga aniq yechim ko'rsatamiz.
function need(name) {
  try { return require(name); }
  catch (e) {
    if (e.code !== 'MODULE_NOT_FOUND') throw e;
    console.error(`\nXATOLIK: "${name}" kutubxonasi topilmadi.\n` +
      `Tiklash uchun loyiha ildizida bitta buyruq bajaring:\n` +
      `   npm install exceljs xlsx --no-save\n` +
      `(ikkalasini BIRGA yozish shart — bittasini alohida o'rnatish ikkinchisini o'chirib yuboradi)\n`);
    process.exit(1);
  }
}
const ExcelJS = need('exceljs');
const XLSX = need('xlsx');

const DIR = __dirname;
const SRC_RE = /\.(xlsx|xlsm|xls)$/i;
// O'ZIMIZ yaratgan fayllar manba sifatida olinmasligi SHART. `_chiqmagan.xlsx`
// eng oxirgi yaratilgan fayl bo'lgani uchun (agent uni o'zi yozadi) argumentsiz
// ishga tushirilganda ENG YANGI deb tanlanib qolardi — ya'ni agent o'z chiqishini
// qayta o'qishga urinardi (2026-07-31 aniqlandi va tuzatildi).
const SKIP_RE = /_(shablon|chiqmagan)\.xlsx$|^supplier_order_template(_original_backup)?\.xlsx$/i;
// Jami/footer qatorlari — nomi shu so'zlar bilan boshlansa, tovar emas.
const FOOTER_RE = /^(итог|всего|общ|total|jami|сумма)/i;

// Ishlanmagan (xomashyo) fayllar ro'yxati — yangidan eskiga tartiblangan.
// _shablon.xlsx, shablon-namuna va Excel lock (~$) fayllar chetlab o'tiladi.
function listCandidates() {
  return fs.readdirSync(DIR)
    .filter(f => SRC_RE.test(f) && !SKIP_RE.test(f) && !f.startsWith('~$'))
    .map(f => ({ f, mtime: fs.statSync(path.join(DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map(x => path.join(DIR, x.f));
}
function pickSourceFile() {
  const arg = process.argv[2];
  if (arg && arg !== '--all') return path.isAbsolute(arg) ? arg : path.join(DIR, arg);
  const candidates = listCandidates();
  if (!candidates.length) throw new Error('zakas/ papkasida ishlanmagan Excel fayl topilmadi.');
  return candidates[0];
}

// Sarlavha katakchasini tasniflaydi. rank — moslik darajasi (0 eng ishonchli):
// bir qatorda bir necha nomzod bo'lsa, rank kichigi tanlanadi. Masalan "Кол-во"
// (rank 0) "Заказ"dan (rank 1) ustun, "Наименование" (rank 0) "Description"dan (rank 1).
function classifyHeader(text) {
  // Ba'zi накладныйlarda katakcha matni so'z O'RTASIDAN qator ko'chirilgan holda
  // keladi (masalan "Кол-\nво" — "Кол-во" so'zining o'ziga xos wrap ko'rinishi,
  // 2026-08-29 "тиин 9 .xls" faylida uchradi). \n ni olib tashlash so'zni asl
  // holiga qaytaradi ("Кол-во"); boshqa joylarda \n oldidan bo'sh joy bo'lgani
  // uchun (masalan "учетом \nНДС") natija baribir to'g'ri so'z ajratuvi bilan qoladi.
  const raw = String(text || '').toLowerCase().replace(/[\r\n]+/g, '').trim();
  if (!raw) return null;
  // Ba'zi накладныйlarda so'z takroriy harf bilan xato yozilgan bo'ladi
  // (masalan "Колличество" - to'g'risi bitta "л" bilan "Количество"). Ketma-ket
  // takrorlangan harflarni bittaga qisqartirib solishtiramiz - shu orqali
  // bunday oddiy imlo xatolari ham to'g'ri tanilinadi (2026-08-04, "TIIN ЗАКАЗ
  // 14.xls" faylida uchradi: soni ustuni shu sabab topilmay, butun sarlavha
  // rad etilgan edi). Maqsadli so'zlarning hech birida ataylab takroriy harf
  // yo'q, shuning uchun bu almashtirish xavfsiz.
  const t = raw.replace(/(.)\1+/g, '$1');
  if (!t) return null;
  // shtrix-kod: "штрих код"/"штрих-код"/"штрихкод" yoki xato yozilgan "штри-код" (х tushib
  // qolgan holat, ba'zi накладныйlarda uchraydi) — harf bo'lmagan belgilarni tashlab tekshiramiz
  const letters = t.replace(/[^a-zа-яё]/gi, '');
  // Kirillcha ("Штрих код", "Штри-код" xatosi, "Баркод") va LOTINCHA/o'zbekcha
  // ("shtrix kod", "shtrih kod", "barcode", "shk") yozilishlarini ham qabul qiladi —
  // ta'minotchilar ikkala alifboda ham yozadi (2026-07-31: "tiin zakaz" faylida
  // "shtrix kod" deb yozilgani sabab shtrix ustuni umuman topilmay qolgan edi).
  if (letters.includes('штри') || letters.includes('баркод') ||
      letters.includes('shtri') || letters.includes('shtrix') || letters.includes('shtrih') ||
      t.includes('barcode') || letters === 'шк' || letters === 'shk') {
    return { kind: 'barcode', rank: 0 };
  }
  // soni: "Количество в кейсе/коробке/кор/упаковке" — o'ram sig'imi (bitta quti/karobkada
  // necha dona), buyurtma soni EMAS. "Заказ" ustuni ustunlik olishi kerak (2026-08-18,
  // "Нивеа заказ TIIN.xlsx"da "Кол-во в кор" shu sabab noto'g'ri tanlanib, butun
  // buyurtma summasi mos kelmagan edi).
  // \b JS regexda kirillcha bilan ishlamaydi (\w faqat lotin harflarni oladi) — shu
  // sabab "кор" so'zini alohida token sifatida oddiy regex bilan ushlaymiz.
  // "Количество УПК (БЛОК)" — УПК/БЛОК ham qadoq birligi (2026-08-24, "ТИИН
  // оптом" faylida uchradi: bu ustun "Кол-во заказа"dan chapda turgani uchun
  // best() uni tanlab, butun buyurtma bitta blokdagi dona soniga teng chiqib
  // qolar edi).
  const isPackagingUnit = t.includes('кейс') || t.includes('короб') ||
    /(^|[^а-яё])кор([^а-яё]|$)/.test(t) || t.includes('упаков') ||
    t.includes('упк') || t.includes('блок');
  // "К-во" — "Количество"ning yana bir qisqartmasi ("Кол-во"dan farqli, "ол"siz).
  // 2026-08-27, "OOO_TIIN_OPTOM ... Сайрам махалля.xls"da uchradi: sarlavha
  // faqat "К-во" edi, "кол-во"/"количество" ichida bu qisqa forma yo'q, shuning
  // uchun soni ustuni umuman topilmay, butun fayl "tovar qatori topilmadi" deb
  // rad etilgan edi.
  // "Колво" — "Кол-во"ning defissiz yozilishi (2026-08-31, "шт код товара.xlsx"
  // faylida uchradi: sarlavha "Колво" edi, defis yo'qligi sabab "кол-во" moslik
  // topilmay, soni ustuni aniqlanmagan edi). `letters` harflar-only bo'lgani
  // uchun defis/probeldan qat'iy nazar solishtiradi.
  if ((t.includes('кол-во') || t.includes('количество') || t.includes('к-во') || letters.includes('колво')) && !isPackagingUnit) return { kind: 'qty', rank: 0 };
  if (t.includes('заказ') || t.includes('zakaz') || t.includes('zakas')) return { kind: 'qty', rank: 1 };
  // "Итого штук" — накладная'da jami yetkazilgan/qabul qilingan dona soni
  // ("Штук в кор." — qadoq sig'imidan farqli, isPackagingUnit shuni ushlaydi).
  // 2026-08-28, "ТИИН ОПТОМ НАКЛАДНАЯ 28.08.2026.xlsx"da uchradi: bu ustun
  // "кол-во"/"количество"/"заказ" so'zlarining hech birini ishlatmagani uchun
  // soni ustuni topilmay, butun fayl rad etilgan edi.
  if (t.includes('итого') && t.includes('штук') && !isPackagingUnit) return { kind: 'qty', rank: 1 };
  // "Сумма со скидкой" / "сумма с учетом скидки" — chegirma qo'llangandan keyingi
  // YAKUNIY qator summasi. "Цена" ustuni ko'pincha chegirmagacha bo'lgan narx
  // bo'ladi (накладныйда alohida "Скидка" ustuni bo'lganda, 2026-08-07 "TIIN
  // OPTOM.xls"da topildi: "Цена" 12500, haqiqiy chegirmali narx 10125 edi —
  // agent chegirmasiz narxdan buyurtma tuzayotgan edi). Bu ustun bo'lsa
  // narx priceCols'dan emas, shundan (summa/soni) hisoblanadi.
  if (t.includes('сума') && t.includes('скидк')) return { kind: 'finalsum', rank: 0 };
  // Ba'zi накладныйlarda birlik narx umuman yo'q — faqat qator JAMI summasi bor
  // ("Сумма" ustuni, Tomiko накладной 2026-08-08da uchradi: №/Штрих-код/Название/
  // Кейс/Кол-во/Вес/Сумма — "Цена" yo'q). Narx ustuni topilmasa shundan (summa/soni)
  // hisoblanadi — lekin haqiqiy "Цена" ustuni bo'lsa unga ustunlik beriladi
  // (extractSheet'da faqat boshqa narx manbai topilmaganda ishlatiladi).
  if (t.includes('сума')) return { kind: 'sumonly', rank: 0 };
  // narx: "без скидки" — chegirmasiz narx, yakuniy narx emas (rank 2 — eng oxirgi variant)
  if (t.includes('цена')) return { kind: 'price', rank: t.includes('без скидки') ? 2 : 0 };
  if (letters === 'price' || t.includes('price')) return { kind: 'price', rank: 1 };
  // "Себестоимость" — ba'zi ta'minotchi shablonlarida "Цена" o'rniga shu so'z
  // ishlatiladi (2026-08-24, "ТИИН оптом" faylida uchradi), lekin narx ustuni
  // sifatida ma'nosi bir xil — bizga sotiladigan narx.
  if (t.includes('себестоим')) return { kind: 'price', rank: 1 };
  // "ТМЦ" (Товарно-Материальные Ценности) - ba'zi накладныйlarda "Наименование"
  // o'rniga shu qisqartma ishlatiladi (2026-08-01, "OOO International Paper"
  // faylida uchradi - shtrix/soni/narx to'g'ri tanilgan, faqat nom ustuni
  // tanilmagani uchun butun sarlavha rad etilib, "fayl tushunilmadi" bo'lib
  // chiqqan edi). "Номенклатура" ham xuddi shunday nom ustuni sinonimi
  // (2026-08-24, "ТИИН оптом" faylida uchradi).
  // "Продукт" — "продукция"dan farqli qisqa forma (2026-08-29, "тиин заказ.xlsx"
  // faylida uchradi: sarlavha faqat "Продукт" edi, "продукци" ichida bu forma
  // yo'q, shuning uchun nom ustuni topilmay, butun varaq rad etilgan edi).
  if (t.includes('наимен') || t.includes('назв') || t.includes('товар') || letters === 'тмц' ||
      t.includes('номенклатур') || t.includes('продукт') ||
      (t.includes('продукци') && !t.includes('код'))) return { kind: 'name', rank: 0 };
  if (t.includes('описание') || t.includes('description')) return { kind: 'name', rank: 1 };
  return null;
}

// Son o'qish: narx/soni ba'zi fayllarda MATN sifatida ruscha formatда keladi
// ("28 000,00" — probel/nbsp mingliklar ajratkichi, vergul kasr ajratkichi). Number()
// buni NaN qiladi, shuning uchun probel/nbsp'ni olib tashlaymiz va vergulni nuqtaga aylantiramiz.
function parseNum(v) {
  let s = String(v == null ? '' : v).replace(/ /g, ' ').trim();
  if (!s) return NaN;
  s = s.replace(/\s+/g, '');                 // mingliklar probeli/nbsp
  const hasComma = s.includes(','), hasDot = s.includes('.');
  if (hasComma && hasDot) {                   // ikkalasi bor — oxirgisi kasr ajratkichi
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasComma) {
    s = s.replace(',', '.');                  // faqat vergul — ruscha kasr ajratkichi
  }
  return Number(s);
}

function toText(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') return v.richText ? v.richText.map(p => p.text).join('') : String(v.result ?? '');
  return String(v).trim();
}

// ---- Fayl o'qish ----------------------------------------------------------
// Ikkala formatni bir xil ko'rinishga keltiramiz: har varaq — qatorlar massivi,
// har qator — katakchalar massivi (0-indeksli). Shundan keyingi mantiq bitta.
function readSheetsViaSheetJS(src) {
  const wb = XLSX.readFile(src, { cellDates: true });
  return wb.SheetNames.map(name => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true }),
  }));
}

async function readSheets(src) {
  if (/\.xls$/i.test(src)) {
    // Eski BIFF (.xls) — ExcelJS o'qiy olmaydi, SheetJS ishlatiladi.
    return readSheetsViaSheetJS(src);
  }
  let wb;
  try {
    wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(src);
  } catch (e) {
    // ExcelJS ba'zi .xlsx fayllarni (masalan ichida logotip/rasm bo'lsa)
    // o'z ichki xatosi bilan o'qiy olmay qoladi ("Cannot read properties of
    // undefined (reading 'anchors')" - media/drawing reconcile xatosi,
    // 2026-08-04 "Тиин.xlsx"da uchradi). SheetJS bunday fayllarni muammosiz
    // o'qiydi, shuning uchun ExcelJS yiqilsa unga tushamiz.
    return readSheetsViaSheetJS(src);
  }
  return wb.worksheets.map(ws => {
    const rows = [];
    const maxCol = ws.columnCount;
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const arr = [];
      for (let c = 1; c <= maxCol; c++) arr.push(row.getCell(c).value);
      rows.push(arr);
    }
    return { name: ws.name, rows };
  });
}

const cell = (rows, r, c) => (rows[r] ? rows[r][c] : undefined);   // 0-indeksli

function findHeaderRow(rows) {
  const maxScan = Math.min(rows.length, 20);
  for (let r = 0; r < maxScan; r++) {
    const row = rows[r] || [];
    const found = { name: [], barcode: [], qty: [], price: [], finalsum: [], sumonly: [] };
    row.forEach((v, c) => {
      const hit = classifyHeader(toText(v));
      if (hit) found[hit.kind].push({ col: c, rank: hit.rank });
    });
    if (!found.qty.length) continue;
    // Nom ustuni sarlavhasi ba'zan shunchaki tashkilot/varaq nomi bo'ladi (masalan
    // "TIIN optom"), "наименование"/"товар" kabi kalit so'zlarning hech biri emas —
    // 2026-09-05, "tiiin avto zakas.xlsx" faylida uchradi (B ustuni sarlavhasi
    // "TIIN optom" edi, ostida esa tovar nomlari turardi). Bunday holda pastdagi
    // qatorlarda eng ko'p KO'P HARFLI MATN (uzunligi >= 6, sof raqam emas) bo'lgan,
    // hali band bo'lmagan ustun nom ustuni deb olinadi — eng past ishonch (rank 3)
    // bilan, ya'ni haqiqiy kalit so'z topilsa har doim UNGA ustunlik beriladi.
    if (!found.name.length) {
      const usedColsPre = new Set(
        [...found.name, ...found.qty, ...found.price, ...found.finalsum, ...found.sumonly].map(x => x.col));
      const sample = rows.slice(r + 1, r + 1 + 15);
      let bestCol = null, bestHits = 0;
      for (let c = 0; c < row.length; c++) {
        if (usedColsPre.has(c)) continue;
        let hits = 0, total = 0;
        for (const sr of sample) {
          const v = toText(sr ? sr[c] : '');
          if (!v) continue;
          total++;
          if (/[a-zа-яё]/i.test(v) && !/^\d+([.,]\d+)?$/.test(v) && v.replace(/\s+/g, '').length >= 6) hits++;
        }
        if (total >= 3 && hits / total >= 0.7 && hits > bestHits) { bestHits = hits; bestCol = c; }
      }
      if (bestCol != null) found.name.push({ col: bestCol, rank: 3 });
    }
    if (!found.name.length) continue;
    // Shtrix-kod ustuni sarlavhasi ba'zan tovar guruh nomi bo'ladi (masalan
    // "Minipack Huggies"), haqiqiy so'z ("штрих", "barcode"...) emas — 2026-08-26,
    // "08,2026 tiin HAGIS.xlsx" faylida uchradi. Bunday holda keyingi qatorlardagi
    // qiymatlarga qarab aniqlaymiz: 8-14 xonali raqamlar ustuni bo'lsa (EAN/UPC
    // uzunligi), band bo'lmagan (nomi/soni/narx uchun band emas) ustunlardan eng
    // ishonchlisi shtrix-kod deb olinadi — pastroq ishonch (rank 2) bilan.
    if (!found.barcode.length) {
      const usedCols = new Set(
        [...found.name, ...found.qty, ...found.price, ...found.finalsum, ...found.sumonly].map(x => x.col));
      const sample = rows.slice(r + 1, r + 1 + 15);
      let bestCol = null, bestHits = 0;
      for (let c = 0; c < row.length; c++) {
        if (usedCols.has(c)) continue;
        let hits = 0, total = 0;
        for (const sr of sample) {
          const v = toText(sr ? sr[c] : '');
          if (!v) continue;
          total++;
          if (/^\d{8,14}$/.test(v)) hits++;
        }
        if (total >= 3 && hits / total >= 0.7 && hits > bestHits) { bestHits = hits; bestCol = c; }
      }
      if (bestCol != null) found.barcode.push({ col: bestCol, rank: 2 });
    }
    // Narx ustuni umuman yo'q bo'lishi mumkin — masalan faqat shtrix-kod + buyurtma
    // soni yozilgan ta'minotchi shabloni (2026-09-05, "tiiin avto zakas.xlsx"da
    // uchradi: "TIIN optom"/Баркод/zakaz, narx yo'q). Bunday holda order_agent
    // Invan'dagi oxirgi kirim narxidan taxminiy to'ldiradi. Lekin tasodifiy matn
    // qatorini sarlavha deb qabul qilib yubormaslik uchun bu holatda kamida
    // shtrix-kod ustuni topilgan bo'lishi SHART.
    const hasPrice = found.price.length || found.finalsum.length || found.sumonly.length;
    if (!hasPrice && !found.barcode.length) continue;
    // Eng ishonchli (rank kichik) nomzodlar ichidan eng chapdagisi.
    const best = list => {
      const minRank = Math.min(...list.map(x => x.rank));
      return list.filter(x => x.rank === minRank).sort((a, b) => a.col - b.col)[0].col;
    };
    // Bir xil ishonch darajasida BIR NECHTA nomzod bo'lsa - tanlov taxminiy bo'ladi.
    // Buni yashirmaymiz: hisobotda ogohlantirish chiqadi, foydalanuvchi ko'zi bilan
    // tekshiradi (summa tekshiruvi asosiy himoya, bu qo'shimcha).
    const ambiguous = list => {
      const minRank = Math.min(...list.map(x => x.rank));
      return list.filter(x => x.rank === minRank).length > 1;
    };
    // Narx uchun BIR NECHTA ustun qoldiriladi (masalan "Price" va "Цена по акции"):
    // har qator uchun eng o'ngdagi to'ldirilgani olinadi — ya'ni aksiya narxi bo'lsa
    // o'sha, bo'lmasa oddiy narx. "Без скидки" ustuni boshqa narx ustuni bo'lsa tashlanadi.
    const hasReal = found.price.some(x => x.rank < 2);
    const priceCols = found.price.filter(x => !hasReal || x.rank < 2).map(x => x.col).sort((a, b) => a - b);
    const label = c => `${String.fromCharCode(65 + c)} "${String(row[c] || '').trim().slice(0, 22)}"`;
    const finalSumCol = found.finalsum.length ? best(found.finalsum) : null;
    const sumOnlyCol = found.sumonly.length ? best(found.sumonly) : null;
    return {
      headerRow: r,
      nameCol: best(found.name),
      barcodeCol: found.barcode.length ? best(found.barcode) : null,
      qtyCol: best(found.qty),
      priceCols,
      finalSumCol,
      sumOnlyCol,
      // Hisobot uchun: qaysi ustun tanlandi, qaysilari nomzod edi, taxminiy joyi bormi
      pick: {
        name: label(best(found.name)),
        barcode: found.barcode.length ? label(best(found.barcode)) : null,
        qty: label(best(found.qty)),
        price: priceCols.map(label),
        finalSum: finalSumCol != null ? label(finalSumCol) : null,
        sumOnly: sumOnlyCol != null ? label(sumOnlyCol) : null,
        qtyOther: found.qty.filter(x => x.col !== best(found.qty)).map(x => label(x.col)),
        ambiguousQty: ambiguous(found.qty),
        ambiguousName: ambiguous(found.name),
      },
    };
  }
  return null;
}

// Bitta varaqdan tovarlarni yig'adi. Faqat SONI yozilgan qatorlar olinadi —
// katalogdagi buyurtma qilinmagan (Заказ bo'sh) pozitsiyalar kerak emas.
function extractSheet(rows) {
  const hdr = findHeaderRow(rows);
  if (!hdr) return null;
  const data = [];
  let skippedNoQty = 0, skippedBad = 0;
  for (let r = hdr.headerRow + 1; r < rows.length; r++) {
    const name = toText(cell(rows, r, hdr.nameCol));
    const qtyText = toText(cell(rows, r, hdr.qtyCol));
    const qtyNum = parseNum(qtyText);
    // Soni bo'sh/nol — bu tovar buyurtma qilinmagan, tashlab ketamiz.
    if (!qtyText || isNaN(qtyNum) || qtyNum <= 0) { if (name) skippedNoQty++; continue; }
    // Jami/footer qatori (Итог, Всего...) — birlashtirilgan katakcha tufayli
    // nom ustuniga matn "sizib chiqishi" mumkin, nomi bo'yicha ham tekshiramiz.
    if (!name || FOOTER_RE.test(name)) { skippedBad++; continue; }
    // Narx: eng o'ngdagi to'ldirilgan narx ustuni (aksiya narxi ustun).
    let priceNum = NaN;
    for (let i = hdr.priceCols.length - 1; i >= 0; i--) {
      const p = parseNum(toText(cell(rows, r, hdr.priceCols[i])));
      if (!isNaN(p) && p > 0) { priceNum = p; break; }
    }
    // "Сумма со скидкой" ustuni bo'lsa — bu YAKUNIY (chegirmali) qator summasi,
    // undan hisoblangan birlik narxi "Цена" ustunidan ustun turadi (o'sha
    // chegirmagacha bo'lishi mumkin). Chegirma yo'q qatorlarda ikkalasi baribir
    // teng chiqadi, shuning uchun har doim shu yo'l bilan hisoblash xavfsiz.
    if (hdr.finalSumCol != null) {
      const fs = parseNum(toText(cell(rows, r, hdr.finalSumCol)));
      if (!isNaN(fs) && fs > 0) priceNum = Math.round((fs / qtyNum) * 100) / 100;
    }
    // Birlik narx umuman yo'q, faqat qator JAMI summasi bor ("Сумма" ustuni) —
    // boshqa manba topilmagandagina ishlatiladi (haqiqiy "Цена"/chegirmali summa bo'lsa ustun kelmaydi).
    if (isNaN(priceNum) && hdr.sumOnlyCol != null) {
      const s = parseNum(toText(cell(rows, r, hdr.sumOnlyCol)));
      if (!isNaN(s) && s > 0) priceNum = Math.round((s / qtyNum) * 100) / 100;
    }
    const noPriceSource = !hdr.priceCols.length && hdr.finalSumCol == null && hdr.sumOnlyCol == null;
    if (isNaN(priceNum)) {
      if (!noPriceSource) { skippedBad++; continue; }
      priceNum = null; // narx manbada umuman yo'q - order_agent Invan'dan taxminiy to'ldiradi
    }
    const barcode = hdr.barcodeCol == null ? '' : toText(cell(rows, r, hdr.barcodeCol));
    data.push({ name, barcode, qty: qtyNum, price: priceNum, priceMissing: priceNum == null });
  }
  return { hdr, data, skippedNoQty, skippedBad };
}

// Bitta faylni shablonga o'giradi va statistikani qaytaradi (tekshirish uchun:
// soni*narx yig'indisi manba faylning "Сумма" ustuni bilan mos kelishi kerak).
async function convertOne(src) {
  const sheets = await readSheets(src);
  // Kerakli varaqni o'zi topadi: sarlavhasi mos kelgan va tovari bor birinchi varaq.
  let picked = null, headerOnly = null;
  for (const sh of sheets) {
    const res = extractSheet(sh.rows);
    if (!res) continue;
    if (res.data.length) { picked = { sheet: sh.name, ...res }; break; }
    if (!headerOnly) headerOnly = { sheet: sh.name, ...res };
  }
  if (!picked) picked = headerOnly;
  if (!picked) throw new Error('Sarlavha qatori topilmadi (nomi/soni/narx ustunlariga mos so\'z yo\'q).');
  const { data, hdr } = picked;
  if (!data.length) throw new Error(`"${picked.sheet}" varag'ida soni yozilgan tovar topilmadi.`);

  const outWb = new ExcelJS.Workbook();
  const outWs = outWb.addWorksheet('Заказ');
  const headerRow = outWs.addRow(['Наименование', 'Штрих код', 'Кол-во', 'Цена']);
  headerRow.eachCell(c => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDEBF7' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  data.forEach(r => {
    const row = outWs.addRow([r.name, r.barcode, r.qty, r.price]);
    row.getCell(2).numFmt = '@';          // shtrix-kod matn sifatida (uzun raqam ilmiy formatga o'tmasin)
    row.getCell(3).numFmt = '#,##0';
    row.getCell(4).numFmt = '#,##0.##';
  });
  outWs.columns = [{ width: 55 }, { width: 18 }, { width: 10 }, { width: 12 }];

  const base = path.basename(src).replace(SRC_RE, '');
  const outPath = path.join(DIR, `${base}_shablon.xlsx`);
  await outWb.xlsx.writeFile(outPath);

  const totalSum = data.reduce((a, r) => a + r.qty * r.price, 0);
  const totalQty = data.reduce((a, r) => a + r.qty, 0);
  const noBc = data.filter(r => !r.barcode).map(r => r.name);
  return { outPath, count: data.length, sheet: picked.sheet, hdr, totalSum, totalQty, noBc,
           skippedNoQty: picked.skippedNoQty, skippedBad: picked.skippedBad };
}

const colLetter = i => (i == null ? '(yo\'q)' : String.fromCharCode(65 + i));

function reportStat(s) {
  console.log('  Varaq:', s.sheet, '| sarlavha qatori:', s.hdr.headerRow + 1);
  const narxLabel = s.hdr.priceCols.length ? s.hdr.priceCols.map(colLetter).join('→')
    : s.hdr.finalSumCol != null ? `${colLetter(s.hdr.finalSumCol)} (jami summa/soni)`
    : s.hdr.sumOnlyCol != null ? `${colLetter(s.hdr.sumOnlyCol)} (jami summa/soni)`
    : '(yo\'q)';
  console.log('  Ustunlar — nomi:', colLetter(s.hdr.nameCol), '| shtrix:', colLetter(s.hdr.barcodeCol),
    '| soni:', colLetter(s.hdr.qtyCol), '| narx:', narxLabel);
  console.log('  Tovarlar:', s.count, '| jami dona:', s.totalQty.toLocaleString('ru-RU'),
    '| jami summa:', s.totalSum.toLocaleString('ru-RU'));
  console.log('  Soni yozilmagani uchun tashlandi:', s.skippedNoQty,
    s.skippedBad ? `| nomi/narxi yo'qligi uchun: ${s.skippedBad}` : '');
  if (s.noBc.length) console.log('  ⚠ Shtrix-kodsiz', s.noBc.length, 'ta:', s.noBc.slice(0, 5).join(' ; ') + (s.noBc.length > 5 ? ' …' : ''));
  console.log('  → Yozildi:', path.basename(s.outPath));
}

async function main() {
  const all = process.argv.includes('--all');
  const targets = all ? listCandidates() : [pickSourceFile()];
  if (!targets.length) throw new Error('zakas/ papkasida ishlanmagan Excel fayl topilmadi.');
  console.log(all ? `BATCH rejim — ${targets.length} ta fayl:` : 'Bitta fayl rejimi:');
  let ok = 0, fail = 0;
  for (const src of targets) {
    console.log('\n• ' + path.basename(src));
    try {
      reportStat(await convertOne(src));
      ok++;
    } catch (e) {
      console.log('  XATOLIK:', e.message);
      fail++;
    }
  }
  if (targets.length > 1) console.log(`\nYakun: ${ok} ta tayyor, ${fail} ta xato.`);
}

// Fayl o'qish/ustun aniqlash mantiqi order_agent.js'da ham ishlatiladi - shuning
// uchun eksport qilinadi. main() faqat shu fayl TO'G'RIDAN-TO'G'RI ishga tushirilganda
// chaqiriladi (require qilinganda emas).
module.exports = { readSheets, extractSheet, findHeaderRow, parseNum, toText, listCandidates, convertOne, DIR };

if (require.main === module) {
  main().catch(e => { console.error('XATOLIK:', e.message); process.exit(1); });
}
