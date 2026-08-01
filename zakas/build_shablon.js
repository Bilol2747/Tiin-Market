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
  const t = String(text || '').toLowerCase().trim();
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
  // soni: "Количество в кейсе" — o'ram sig'imi, buyurtma soni emas.
  if ((t.includes('кол-во') || t.includes('количество')) && !t.includes('кейс')) return { kind: 'qty', rank: 0 };
  if (t.includes('заказ') || t.includes('zakaz')) return { kind: 'qty', rank: 1 };
  // narx: "без скидки" — chegirmasiz narx, yakuniy narx emas (rank 2 — eng oxirgi variant)
  if (t.includes('цена')) return { kind: 'price', rank: t.includes('без скидки') ? 2 : 0 };
  if (letters === 'price' || t.includes('price')) return { kind: 'price', rank: 1 };
  if (t.includes('наимен') || t.includes('назв') || t.includes('товар') ||
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
async function readSheets(src) {
  if (/\.xls$/i.test(src)) {
    // Eski BIFF (.xls) — ExcelJS o'qiy olmaydi, SheetJS ishlatiladi.
    const wb = XLSX.readFile(src, { cellDates: true });
    return wb.SheetNames.map(name => ({
      name,
      rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true }),
    }));
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(src);
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
    const found = { name: [], barcode: [], qty: [], price: [] };
    row.forEach((v, c) => {
      const hit = classifyHeader(toText(v));
      if (hit) found[hit.kind].push({ col: c, rank: hit.rank });
    });
    if (!found.name.length || !found.qty.length || !found.price.length) continue;
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
    return {
      headerRow: r,
      nameCol: best(found.name),
      barcodeCol: found.barcode.length ? best(found.barcode) : null,
      qtyCol: best(found.qty),
      priceCols,
      // Hisobot uchun: qaysi ustun tanlandi, qaysilari nomzod edi, taxminiy joyi bormi
      pick: {
        name: label(best(found.name)),
        barcode: found.barcode.length ? label(best(found.barcode)) : null,
        qty: label(best(found.qty)),
        price: priceCols.map(label),
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
    if (isNaN(priceNum)) { skippedBad++; continue; }
    const barcode = hdr.barcodeCol == null ? '' : toText(cell(rows, r, hdr.barcodeCol));
    data.push({ name, barcode, qty: qtyNum, price: priceNum });
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
  console.log('  Ustunlar — nomi:', colLetter(s.hdr.nameCol), '| shtrix:', colLetter(s.hdr.barcodeCol),
    '| soni:', colLetter(s.hdr.qtyCol), '| narx:', s.hdr.priceCols.map(colLetter).join('→'));
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
