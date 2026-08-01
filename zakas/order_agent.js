// ─────────────────────────────────────────────────────────────────────────────
// ZAKAS AGENTI — ta'minotchi faylini o'qib, Invan bilan solishtirib, buyurtma
// yaratadi va natijani tekshiradi.
//
// Ishlatilishi:
//   node zakas/order_agent.js "ORIMI 2026.xls"
//       → faqat TEKSHIRUV (hisobot chiqaradi, hech narsa yaratmaydi)
//   node zakas/order_agent.js "ORIMI 2026.xls" --supplier "FIRSTGROUP ... (Jokey, TESS)" --create
//       → Invan'da QORALAMA buyurtma yaratadi va yaratilgandan keyin tekshiradi
//   node zakas/order_agent.js --suppliers "first"
//       → ta'minotchi nomini qidiradi (--supplier uchun aniq nom topish)
//
// MOSLASHTIRISH FAQAT SHTRIX-KOD BO'YICHA. Nom bo'yicha moslashtirish ataylab
// YO'Q: bizdagi "Greenfield 2grx25" va keladigan "Greenfield 2grx100" nomi
// deyarli bir xil, lekin butunlay boshqa tovar — nom bo'yicha moslashtirilsa
// noto'g'ri tovar buyurtma qilinadi (2026-07-31 muhokamasi).
//
// NEGA JONLI QIDIRUV, KESHLANGAN RO'YXAT EMAS: lokal katalog fayllari (
// data_inv_new.json, api/_product_match_index.json) ataylab FAQAT aktiv
// tovarlarni saqlaydi va eskirib qoladi. 2026-07-31 da shu sabab 5 ta tovar
// "bizda yo'q" deb noto'g'ri xabar qilindi — aslida hammasi Invan'da bor edi,
// faqat is_active=False. Invan'dan bittalab so'rash 0.17s/ta (58 talik fayl ~10s)
// — arzon, va HECH QACHON eskirmaydi.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const { readSheets, extractSheet, listCandidates } = require('./build_shablon.js');

const ROOT = path.join(__dirname, '..');
const AUTH_BASE = 'https://api.7i.uz';
const BASE = 'https://api.7i.uz/integration/v1';
const API_V1 = 'https://api.7i.uz/api/v1';
const SHOP_ID = 'aa954511-3801-46f8-a0bd-d41fa7e40369';   // Tiin Optom
const SUPPLIER_MAP = require(path.join(ROOT, 'api', '_supplier_id_map.json'));
const MY_TOKEN_PATH = path.join(__dirname, 'my_token.txt');

const token = () => {
  const p = path.join(ROOT, 'api_token.txt');
  if (!fs.existsSync(p)) throw new Error('api_token.txt topilmadi.');
  const t = fs.readFileSync(p, 'utf8').trim();
  if (!t) throw new Error('api_token.txt bo\'sh.');
  return t;
};
function myToken() {
  if (!fs.existsSync(MY_TOKEN_PATH)) return null;
  const t = fs.readFileSync(MY_TOKEN_PATH, 'utf8').trim();
  return t || null;
}
// IKKI XIL TOKEN, IKKI XIL VAZIFA (2026-07-31 aniqlandi):
//   - `/integration/v1/*` (qidiruv, buyurtmalar ro'yxati) - FAQAT umumiy
//     api_token.txt (source:"web") bilan ishlaydi. Shaxsiy login tokeni
//     (source:"pos") bu yerda 401 qaytaradi - "unauthorized".
//   - `/api/v1/*` (buyurtma yaratish) - shaxsiy token bilan ishlaydi, shunda
//     buyurtma haqiqiy yuborgan odam nomidan chiqadi.
// Shuning uchun H() DOIM umumiy tokenni ishlatadi (o'qish uchun); yaratish
// so'rovlariga esa alohida `token` argumenti orqali shaxsiy token beriladi.
const H = (t) => ({ Authorization: 'Bearer ' + (t || token()), 'Content-Type': 'application/json', Timezone: '300' });
const num = n => Number(n || 0).toLocaleString('ru-RU');

function normPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 9) d = '998' + d;
  return d;
}
function decodeJwtName(t) {
  try {
    const p = JSON.parse(Buffer.from(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return p.name || p.full_name || p.fullName || p.employee_name || '';
  } catch { return ''; }
}

// Shaxsiy login: telefon+parol -> token. Parol HECH QAYERGA yozilmaydi, faqat
// so'rovda yuboriladi; natijada olingan TOKEN my_token.txt'ga saqlanadi (bu fayl
// .gitignore'da). Shundan keyingi barcha buyurtmalar SIZNING Invan hisobingizdan
// yaratiladi - umumiy api_token.txt (Murodjon Tursunov nomidan chiqishi
// 2026-07-31 aniqlangan) o'rniga.
async function doLogin(phoneRaw, password) {
  const phone = normPhone(phoneRaw);
  if (!phone || !password) throw new Error('Foydalanish: --login "<telefon>" "<parol>"');
  const r = await fetch(AUTH_BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phone, password }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body.token) throw new Error('Login muvaffaqiyatsiz: ' + (body.error || body.message || r.status));
  fs.writeFileSync(MY_TOKEN_PATH, body.token, 'utf8');
  const name = decodeJwtName(body.token);
  console.log(`✅ Kirish muvaffaqiyatli${name ? ' — ' + name : ''}. Bundan keyingi buyurtmalar shu hisobdan yaratiladi.`);
  console.log(`   Token saqlandi: ${path.relative(ROOT, MY_TOKEN_PATH)} (git'ga tushmaydi)`);
}

async function apiPost(url, { params, body, token: tok } = {}) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(params || {})) u.searchParams.set(k, v);
  const r = await fetch(u, { method: 'POST', headers: H(tok), body: JSON.stringify(body || {}) });
  const text = await r.text();
  let parsed; try { parsed = JSON.parse(text); } catch { parsed = text; }
  if (!r.ok) {
    // Invan xatoni obyekt sifatida qaytaradi - String() qilsak "[object Object]"
    // bo'lib qoladi va sabab ko'rinmaydi, shuning uchun JSON qilib chiqaramiz.
    const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed);
    throw new Error(`${u.pathname} -> ${r.status}: ${detail.slice(0, 400)}`);
  }
  return parsed;
}

// ── 1-QADAM: faylni o'qish ───────────────────────────────────────────────────
// build_shablon.js'ning ustun aniqlash mantiqi ishlatiladi (sarlavha so'zi
// bo'yicha), shu sabab har ta'minotchining o'z formati qo'llab-quvvatlanadi.
async function readOrderFile(src) {
  const sheets = await readSheets(src);
  for (const sh of sheets) {
    const res = extractSheet(sh.rows);
    if (res && res.data.length) return { sheet: sh.name, ...res };
  }
  throw new Error('Faylda soni yozilgan tovar qatori topilmadi.');
}

// Qaysi ustunlar tanlanganini OCHIQ ko'rsatadi. Ta'minotchi fayllarida ko'pincha
// bir nechta narx ("Price" + "Цена по акции") yoki bir nechta soni ("Кол-во" +
// "Заказ") ustuni bo'ladi — tanlov noto'g'ri bo'lsa butun buyurtma noto'g'ri
// chiqadi, shuning uchun taxmin qilinganini yashirmay ko'rsatamiz. Asosiy
// himoya — soni×narx yig'indisini faylning O'Z jamisi bilan solishtirish.
function columnReport(hdr) {
  const p = hdr.pick;
  console.log('  Ustunlar — nomi: ' + p.name + ' | shtrix: ' + (p.barcode || '(yo\'q)'));
  console.log('             soni: ' + p.qty + ' | narx: ' + p.price.join('  →  '));
  if (p.price.length > 1) console.log('             (bir necha narx ustuni — har qatorda eng o\'ngdagi to\'ldirilgani olinadi, ya\'ni aksiya narxi ustun)');
  if (p.qtyOther.length) console.log('             ⚠️  soni uchun boshqa nomzod ham bor edi: ' + p.qtyOther.join(', '));
  if (p.ambiguousQty) console.log('             ⚠️  SONI ustuni TAXMINIY tanlandi — pastdagi summa tekshiruvini albatta ko\'ring!');
  if (p.ambiguousName) console.log('             ⚠️  NOM ustuni taxminiy tanlandi.');
}

// ── 2-QADAM: har shtrix-kodni Invan'da tekshirish ────────────────────────────
// Invan'ning `search` parametri shtrix-kod bo'yicha ishlaydi va AKTIV/NOAKTIV
// demay qidiradi (2026-07-31 tekshirildi). Qaytgan ro'yxatdan shtrix-kodi AYNAN
// mos kelganini olamiz — qidiruv o'xshash natijalarni ham qaytaradi.
async function lookupBarcode(bc) {
  const b = String(bc || '').trim();
  if (!b) return { status: 'shtrixsiz' };
  let data;
  try {
    const r = await apiPost(`${BASE}/products`, { params: { page: 1, limit: 20, search: b }, body: { filters: [] } });
    data = r.data || [];
  } catch (e) {
    return { status: 'xato', error: e.message };
  }
  const hit = data.find(p => (p.barcode || []).some(x => String(x).trim() === b));
  if (!hit) return { status: 'yoq' };
  return {
    status: hit.is_active ? 'aktiv' : 'noaktiv',
    sku: String(hit.sku || ''), name: String(hit.name || ''),
    id: hit.id, type: hit.product_type_id,
  };
}

// Bir vaqtda bir nechta so'rov (Invan'ni bosmaslik uchun cheklangan).
async function lookupAll(items, conc = 6) {
  const out = new Array(items.length);
  let i = 0, done = 0;
  const tick = () => {
    done++;
    if (done % 10 === 0 || done === items.length) process.stdout.write(`\r  tekshirilmoqda: ${done}/${items.length}`);
  };
  await Promise.all(Array.from({ length: Math.min(conc, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await lookupBarcode(items[k].barcode);
      tick();
    }
  }));
  process.stdout.write('\n');
  return out;
}

// ── 3-QADAM: narx o'zgarishini aniqlash (oxirgi kirim narxiga nisbatan) ──────
function priceHistoryIndex() {
  const p = path.join(ROOT, 'data_kirim.json');
  if (!fs.existsSync(p)) return null;
  const skus = JSON.parse(fs.readFileSync(p, 'utf8')).skus || {};
  const bySku = new Map();
  for (const [sku, v] of Object.entries(skus)) bySku.set(String(sku), v);
  return bySku;
}

// Ta'minotchini FAYLDAN emas, TOVARLARDAN aniqlaydi: fayldagi tovarlar ilgari
// kimdan kelgan bo'lsa, bu safar ham o'shandan keladi. Fayl nomi ("ORIMI 2026")
// Invan'dagi ta'minotchi nomiga ("FIRSTGROUP MCHJ ... (Jokey, TESS)") umuman
// o'xshamasligi mumkin, shuning uchun nom bo'yicha taxmin qilish ishonchsiz.
// Har tovarning ENG OXIRGI kirimidagi ta'minotchi hisobga olinadi, eng ko'p
// takrorlangani taklif qilinadi (id ham shu yerdan olinadi - nom xaritasi kerak emas).
function guessSupplier(matched, hist) {
  if (!hist) return null;
  const tally = new Map();
  for (const x of matched) {
    const h = hist.get(String(x.sku));
    const a = h && h.arrivals && h.arrivals[0];
    if (!a || !a.supplier_id) continue;
    const k = a.supplier_id;
    const cur = tally.get(k) || { id: k, name: a.supplier || '', n: 0 };
    cur.n++;
    tally.set(k, cur);
  }
  const list = [...tally.values()].sort((a, b) => b.n - a.n);
  if (!list.length) return null;
  return { best: list[0], all: list.slice(0, 3), total: matched.length };
}

// ── 4-QADAM: hisobot ─────────────────────────────────────────────────────────
function report(items, looks, fileTotal) {
  const g = { aktiv: [], noaktiv: [], yoq: [], xato: [], shtrixsiz: [] };
  items.forEach((it, k) => g[looks[k].status].push({ ...it, ...looks[k] }));

  console.log('\n' + '═'.repeat(72));
  console.log('  TEKSHIRUV NATIJASI');
  console.log('═'.repeat(72));
  console.log(`  Fayldagi tovarlar : ${items.length} ta`);
  console.log(`  Fayl jami summasi : ${num(fileTotal)} so'm`);
  console.log('  ─────────────────────────────────────────────────────────────────');
  console.log(`  ✅ Aktiv (muammosiz)      : ${g.aktiv.length} ta`);
  console.log(`  ⚠️  Noaktiv (yoqish kerak) : ${g.noaktiv.length} ta`);
  console.log(`  ❌ Invan'da umuman yo'q    : ${g.yoq.length} ta`);
  if (g.shtrixsiz.length) console.log(`  ⁉️  Shtrix-kodsiz qator     : ${g.shtrixsiz.length} ta`);
  if (g.xato.length) console.log(`  🔌 So'rov xatosi           : ${g.xato.length} ta`);

  if (g.noaktiv.length) {
    console.log('\n  ⚠️  NOAKTIV — Invan\'da bu tovarlarni Aktiv qilish kerak:');
    g.noaktiv.forEach(x => console.log(`     SKU ${String(x.sku).padEnd(9)} ${x.barcode}  ${x.name.slice(0, 46)}  (${x.qty} dona)`));
  }
  if (g.yoq.length) {
    console.log('\n  ❌ UMUMAN YO\'Q — Invan\'da yangi kartochka ochish kerak:');
    g.yoq.forEach(x => console.log(`     ${x.barcode}  ${x.name.slice(0, 50)}  (${x.qty} dona × ${num(x.price)})`));
  }
  if (g.xato.length) {
    console.log('\n  🔌 TEKSHIRIB BO\'LMADI (tarmoq/API xatosi) — qayta ishga tushiring:');
    g.xato.forEach(x => console.log(`     ${x.barcode}  ${x.error.slice(0, 60)}`));
  }
  return g;
}

function priceReport(g, hist) {
  if (!hist) return;
  const rows = [];
  for (const x of [...g.aktiv, ...g.noaktiv]) {
    const h = hist.get(String(x.sku));
    if (!h || !h.last_cost) continue;
    const d = (x.price - h.last_cost) / h.last_cost * 100;
    if (Math.abs(d) >= 5) rows.push({ ...x, old: h.last_cost, d, date: String(h.last_date || '').slice(0, 10) });
  }
  if (!rows.length) return;
  rows.sort((a, b) => b.d - a.d);
  console.log('\n  💰 NARX O\'ZGARGAN (oxirgi kirimga nisbatan, ±5% dan ortiq):');
  rows.forEach(x => {
    const pct = ((x.d > 0 ? '+' : '') + x.d.toFixed(1) + '%').padEnd(8);
    console.log(`     ${x.d > 0 ? '↑' : '↓'} ${pct}` +
      `${num(x.old)} → ${num(x.price)}`.padEnd(22) + `${x.name.slice(0, 40).padEnd(42)}oxirgi kirim ${x.date}`);
  });
}

// ── Muammoli tovarlarni Excel qilib berish ───────────────────────────────────
// Buyurtmaga TUSHMAGAN yoki e'tibor talab qiladigan har bir tovar sababi bilan
// alohida faylga yoziladi — chatdagi ro'yxatni qo'lda ko'chirish shart bo'lmasin,
// Invan'da ishlash uchun tayyor ro'yxat bo'lsin.
const SABAB = {
  noaktiv: 'NOAKTIV — Invan\'da bu tovarni Aktiv qilish kerak (kartochka tayyor)',
  yoq: 'INVAN\'DA YO\'Q — yangi kartochka ochish kerak',
  xato: 'TEKSHIRILMADI — tarmoq/API xatosi, agentni qayta ishga tushiring',
  shtrixsiz: 'SHTRIX-KOD YO\'Q — faylda shu qatorda shtrix-kod yozilmagan',
};

async function writeProblemExcel(src, g) {
  const rows = [];
  for (const kind of ['noaktiv', 'yoq', 'xato', 'shtrixsiz']) {
    for (const x of g[kind]) {
      rows.push({
        name: x.name || '', bc: x.barcode || '', qty: x.qty, price: x.price,
        sabab: SABAB[kind], sku: x.sku || '', invan: kind === 'noaktiv' ? (x.name || '') : '',
        holat: kind,
      });
    }
  }
  if (!rows.length) return null;

  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Chiqmagan tovarlar');
  const hdr = ws.addRow(['Tovar (fayldagi nomi)', 'Shtrix kod', 'Soni', 'Narx', 'SABAB', 'SKU (Invan)']);
  hdr.eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE24B4A' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  // Noaktiv (oson tuzatiladi) sariq, umuman yo'q (uzoq ish) qizil - ko'z bilan ajratish uchun
  const FILL = { noaktiv: 'FFFFF3CD', yoq: 'FFF8D7DA', xato: 'FFE2E3E5', shtrixsiz: 'FFE2E3E5' };
  rows.forEach(r => {
    const row = ws.addRow([r.name, r.bc, r.qty, r.price, r.sabab, r.sku]);
    row.getCell(2).numFmt = '@';
    row.getCell(3).numFmt = '#,##0';
    row.getCell(4).numFmt = '#,##0.##';
    row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[r.holat] } }; });
  });
  ws.columns = [{ width: 50 }, { width: 17 }, { width: 8 }, { width: 12 }, { width: 56 }, { width: 12 }];
  const out = path.join(path.dirname(src), path.basename(src).replace(/\.[^.]+$/, '') + '_chiqmagan.xlsx');
  await wb.xlsx.writeFile(out);
  return { path: out, count: rows.length };
}

// QISQA hisobot (--short) — foydalanuvchi tasdiqlashi uchun eng zarur 4-5 qator.
// Uzun hisobot faqat muammo chuqurroq ko'rilganda kerak bo'ladi.
function shortReport(fileName, g, fileTotal, sup, hist, fileTotalKnown = true) {
  const ok = [...g.aktiv, ...g.noaktiv];
  const sum = ok.reduce((a, x) => a + x.qty * x.price, 0);
  let priceUp = 0, maxUp = null;
  for (const x of ok) {
    const h = hist && hist.get(String(x.sku));
    if (!h || !h.last_cost) continue;
    const d = (x.price - h.last_cost) / h.last_cost * 100;
    if (d >= 5) { priceUp++; if (!maxUp || d > maxUp.d) maxUp = { d, name: x.name }; }
  }
  console.log('\n' + '─'.repeat(60));
  console.log(`📄 ${fileName}`);
  if (sup) console.log(`🏢 ${sup.best.name}   [${sup.best.n}/${sup.total} tovar shundan]`);
  else console.log(`🏢 Ta'minotchi aniqlanmadi — qo'lda ko'rsatish kerak`);
  console.log(`📦 ${ok.length} ta tovar · ${num(sum)} so'm` +
    (!fileTotalKnown ? '' : sum === fileTotal ? '  ✅ fayl jamisiga mos' : `  ❌ fayl jamisi ${num(fileTotal)} — FARQ BOR`));
  if (ok.some(x => x.priceGuessed)) console.log('💡 Narx manbada yo\'q edi — oxirgi kirim narxi ishlatildi (taxminiy)');
  if (g.noaktiv.length) console.log(`⚠️  ${g.noaktiv.length} ta noaktiv — Invan'da yoqish kerak: SKU ` + g.noaktiv.map(x => x.sku).join(', '));
  if (g.yoq.length) console.log(`❌ ${g.yoq.length} ta Invan'da yo'q: ` + g.yoq.map(x => x.barcode).join(', '));
  if (g.xato.length) console.log(`🔌 ${g.xato.length} ta tekshirilmadi (tarmoq xatosi) — qayta ishga tushiring`);
  if (priceUp) console.log(`💰 ${priceUp} ta narx oshgan (eng kattasi +${maxUp.d.toFixed(0)}% ${maxUp.name.slice(0, 32)})`);
  console.log('─'.repeat(60));
}

// ── 5-QADAM: Invan'da qoralama buyurtma yaratish ─────────────────────────────
// Buyurtma "Yangi"/qoralama holatida yaratiladi — menejer Invan'da ko'rib o'zi
// tasdiqlaydi. Avtomatik yuborilmaydi.
async function createOrder(g, supplierId, opts = {}) {
  if (!supplierId) throw new Error('Ta\'minotchi aniqlanmadi.');

  // Bir xil product_id ikki marta yuborilsa Invan butun buyurtmani rad etadi
  // ("ON CONFLICT DO UPDATE ... second time"), shuning uchun birlashtiramiz:
  // soni QO'SHILADI, narx miqdor bo'yicha o'rtachalanadi (jami summa saqlanadi).
  const byProduct = new Map();
  for (const x of [...g.aktiv, ...g.noaktiv]) {
    const ex = byProduct.get(x.id);
    if (ex) {
      const tot = ex.cost * ex.expected_amount + x.price * x.qty;
      ex.expected_amount += x.qty;
      ex.cost = ex.expected_amount ? tot / ex.expected_amount : x.price;
    } else {
      // MAYDON NOMI product_type_id, product_type EMAS - 2026-07-31 birinchi real
      // yozuvda HTTP 400 "invalid body" bilan aniqlandi (api/invan-order.js'da ham
      // xuddi shu xato bor edi, u hech qachon real yozuv bilan sinalmagan edi).
      byProduct.set(x.id, { product_id: x.id, expected_amount: x.qty, cost: x.price, product_type_id: x.type, return_amount: 0 });
    }
  }
  const items = [...byProduct.values()];
  if (!items.length) throw new Error('Yuboriladigan tovar yo\'q.');

  // /api/v1 yaratish so'rovlari shaxsiy tokenda ketadi (bor bo'lsa) - shunda
  // buyurtma "kim yaratdi" maydonida haqiqiy yuborgan odam ko'rinadi, umumiy
  // hisob (Murodjon Tursunov) emas (2026-07-31, foydalanuvchi so'rovi).
  const writeTok = myToken() || undefined;
  const created = await apiPost(`${API_V1}/supplier_order_new`, {
    token: writeTok,
    body: {
      supplier_id: supplierId, shop_id: SHOP_ID,
      expected_date: opts.expected || new Date().toISOString().slice(0, 10) + 'T00:00:00Z',
      comment: opts.comment || 'Zakas agent', invoice_number: opts.invoice || '',
    },
  });
  const orderId = created.id || (created.data && created.data.id);
  if (!orderId) throw new Error('Buyurtma id qaytmadi.');
  await apiPost(`${API_V1}/supplier_order_multiple_items`, { token: writeTok, body: { supplier_order_id: orderId, items } });
  return { orderId, po: created.value || created.external_id || '', sent: items };
}

// ── 6-QADAM: yaratilgandan keyin TEKSHIRISH ──────────────────────────────────
// Buyurtmani Invan'dan qayta o'qib, nechta pozitsiya tushgani va jami summa
// biz yuborgan bilan mos kelishini solishtiradi — "yubordim" degan bilan
// "haqiqatda tushdi" boshqa narsa.
async function verifyOrder(orderId, sent) {
  const expectCount = sent.length;
  const expectSum = sent.reduce((a, x) => a + x.expected_amount * x.cost, 0);
  let got = null;
  for (let attempt = 1; attempt <= 3 && !got; attempt++) {
    try {
      const r = await apiPost(`${BASE}/supplier_order`, { params: { page: 1, limit: 50 }, body: { filters: [] } });
      got = (r.data || []).find(o => String(o.id) === String(orderId)) || null;
    } catch { /* qayta urinamiz */ }
    if (!got && attempt < 3) await new Promise(r => setTimeout(r, 1500));
  }
  if (!got) return { ok: null, msg: 'Buyurtmani qayta o\'qib bo\'lmadi (oxirgi 50 ta ichida topilmadi) — Invan\'da qo\'lda tekshiring.' };
  const gotItems = got.items || [];
  const gotSum = gotItems.reduce((a, i) => a + (Number(i.expected_amount) || 0) * (Number(i.cost) || 0), 0);
  return {
    ok: gotItems.length === expectCount && Math.abs(gotSum - expectSum) < 1,
    expectCount, gotCount: gotItems.length, expectSum, gotSum,
    // status - obyekt ({id, name, translation}), matnga aylantirmasak "[object Object]" chiqadi
    status: statusName(got), invanTotal: Number(got.total_amount) || 0, po: got.external_id || '',
  };
}

// ── NAZORAT: Invan'dagi buyurtmalar holati ───────────────────────────────────
const statusName = o => String((o.status && o.status.name) || '—');
// Qaytarish (return) hujjatlarida narx boshqa maydonlarda turadi va soni*narx
// har doim 0 chiqadi - bu XATO EMAS, shuning uchun summa tekshiruvidan chetlatamiz.
const isReturn = o => /return/i.test(statusName(o));

async function monitor(limit = 40) {
  const r = await apiPost(`${BASE}/supplier_order`, { params: { page: 1, limit }, body: { filters: [] } });
  const orders = r.data || [];
  const problems = [];
  console.log('\n' + '═'.repeat(88));
  console.log(`  INVAN BUYURTMALARI NAZORATI — oxirgi ${orders.length} ta`);
  console.log('═'.repeat(88));
  console.log('  №       holat        poz.   Invan jamisi     hisoblangan   ta\'minotchi');
  console.log('  ' + '─'.repeat(86));
  for (const o of orders) {
    const it = o.items || [];
    const invan = Number(o.total_amount) || 0;
    const calc = it.reduce((a, i) => a + (Number(i.expected_amount) || 0) * (Number(i.cost) || 0), 0);
    const st = statusName(o);
    let flag = '  ';
    if (!isReturn(o)) {
      if (!it.length) { flag = '❗'; problems.push(`№${o.external_id} — bo'sh buyurtma (0 pozitsiya)`); }
      else if (Math.abs(calc - invan) >= 1) { flag = '❌'; problems.push(`№${o.external_id} — summa mos emas: Invan ${num(invan)} / hisob ${num(Math.round(calc))}`); }
      else if (it.some(i => !Number(i.cost))) { flag = '⚠️ '; problems.push(`№${o.external_id} — narxi 0 bo'lgan pozitsiya bor`); }
    }
    console.log(`  ${flag}${String(o.external_id || '—').padEnd(7)} ${st.slice(0, 12).padEnd(12)} ${String(it.length).padStart(4)}  ` +
      `${num(invan).padStart(15)} ${(isReturn(o) ? '—' : num(Math.round(calc))).padStart(15)}   ${String(o.supplier && o.supplier.name || '').slice(0, 30)}`);
  }
  const open = orders.filter(o => /^(open|new)$/i.test(statusName(o)));
  console.log('  ' + '─'.repeat(86));
  console.log(`  Ochiq/yangi (hali kelmagan): ${open.length} ta | jami ${num(open.reduce((a, o) => a + (Number(o.total_amount) || 0), 0))} so'm`);
  if (problems.length) {
    console.log(`\n  ❗ E'TIBOR BERING — ${problems.length} ta muammo:`);
    problems.forEach(p => console.log('     •', p));
  } else {
    console.log('  ✅ Muammo topilmadi — barcha buyurtmalarda summa mos.');
  }
  console.log('═'.repeat(88));
}

// ── Yordamchi: ta'minotchi nomini qidirish ───────────────────────────────────
function findSuppliers(q) {
  const s = String(q || '').toLowerCase();
  const hits = Object.keys(SUPPLIER_MAP).filter(k => k.toLowerCase().includes(s));
  console.log(`"${q}" bo'yicha ${hits.length} ta ta'minotchi:`);
  hits.forEach(k => console.log('  •', k));
  if (!hits.length) console.log('  (topilmadi — boshqa so\'z bilan qidiring)');
}

// ── Asosiy ───────────────────────────────────────────────────────────────────
function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
}

async function main() {
  if (process.argv.includes('--suppliers')) return findSuppliers(arg('--suppliers'));
  if (process.argv.includes('--monitor')) return monitor(Number(arg('--monitor')) || 40);
  if (process.argv.includes('--login')) {
    const i = process.argv.indexOf('--login');
    return doLogin(process.argv[i + 1], process.argv[i + 2]);
  }
  if (process.argv.includes('--whoami')) {
    const t = myToken();
    if (!t) { console.log('Shaxsiy login qilinmagan — hozir umumiy api_token.txt (Murodjon Tursunov) ishlatiladi.'); return; }
    console.log('Shaxsiy hisob faol' + (decodeJwtName(t) ? ': ' + decodeJwtName(t) : ' (token bor).'));
    return;
  }

  // --items-json <fayl>: rasm/skrinshotdan QO'LDA (yoki boshqa tashqi manbadan)
  // transkripsiya qilingan [{name,barcode,qty,price}] ro'yxati. Excel'dan farqli
  // o'laroq narx odatda yo'q bo'ladi (rasmda faqat nomi/soni/shtrix bo'ladi) -
  // shu holda price=null qoldiriladi va agent oxirgi kirim narxidan to'ldiradi
  // (2026-07-31, birinchi marta shunday fayl ishlatildi: 16 ta tovar, rasm orqali).
  const itemsJsonArg = arg('--items-json');
  let items, src, fileTotalKnown = true;
  if (itemsJsonArg) {
    src = path.isAbsolute(itemsJsonArg) ? itemsJsonArg : path.join(__dirname, itemsJsonArg);
    const raw = JSON.parse(fs.readFileSync(src, 'utf8'));
    console.log('Manba (qo\'lda kiritilgan ro\'yxat):', path.basename(src), `— ${raw.length} ta tovar`);
    const hist = priceHistoryIndex();
    items = [];
    for (const d of raw) {
      let price = d.price, priceGuessed = false;
      if (price == null) {
        // Narx berilmagan - Invan'dan shtrix bo'yicha topib, o'sha SKU'ning
        // oxirgi kirim narxini olamiz. Bu TAXMIN, real narx bilan farq qilishi
        // mumkin - shuning uchun hisobotda alohida ogohlantiriladi.
        const look = await lookupBarcode(d.barcode);
        const h = look.sku && hist ? hist.get(String(look.sku)) : null;
        price = h && h.last_cost ? h.last_cost : 0;
        priceGuessed = true;
      }
      items.push({ name: d.name, barcode: d.barcode, qty: d.qty, price, priceGuessed });
    }
    fileTotalKnown = false; // manbada "jami" yo'q - summa tekshiruvi qilinmaydi
  } else {
    const fileArg = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
    src = fileArg
      ? (path.isAbsolute(fileArg) ? fileArg : path.join(__dirname, fileArg))
      : (listCandidates()[0] || null);
    if (!src) throw new Error('zakas/ papkasida fayl topilmadi.');
    if (!fs.existsSync(src)) throw new Error('Fayl topilmadi: ' + src);

    console.log('Fayl:', path.basename(src));
    var parsed = await readOrderFile(src);
    items = parsed.data.map(d => ({ name: d.name, barcode: d.barcode, qty: d.qty, price: d.price }));
  }

  // Ta'minotchi faylidagi shtrix-kod xatosini tuzatish:
  //   --fix-bc "xato=to'g'ri,xato2=to'g'ri2"
  // Manba fayl O'ZGARTIRILMAYDI — tuzatish faqat shu ishga tushirishga taalluqli
  // va ekranda ochiq ko'rsatiladi. Real misol (2026-07-31, BONNA LUX): faylda
  // 780066510236 yozilgan, bosh "4" tushib qolgan, to'g'risi 4780066510236.
  const fixArg = arg('--fix-bc');
  if (fixArg) {
    const map = new Map(String(fixArg).split(',').map(p => p.split('=').map(s => s.trim())));
    let n = 0;
    for (const it of items) {
      const to = map.get(String(it.barcode));
      if (to) { console.log(`  🔧 shtrix tuzatildi: ${it.barcode} → ${to}  (${it.name.slice(0, 40)})`); it.barcode = to; n++; }
    }
    if (n !== map.size) console.log(`  ⚠️  --fix-bc: ${map.size} ta juft berildi, ${n} tasi qo'llandi (qolganining shtrixi faylda topilmadi)`);
  }
  const fileTotal = items.reduce((a, x) => a + x.qty * x.price, 0);
  if (itemsJsonArg) {
    const guessedN = items.filter(it => it.priceGuessed).length;
    if (guessedN) console.log(`  ⚠️  Manbada narx yo'q edi — ${guessedN} ta tovarga OXIRGI KIRIM narxi qo'llandi (taxminiy, real narx bilan farq qilishi mumkin).`);
  } else {
    console.log(`Varaq "${parsed.sheet}" — ${items.length} ta tovar, soni yozilmagani uchun ${parsed.skippedNoQty} ta tashlandi.`);
    columnReport(parsed.hdr);
  }

  console.log('\nInvan\'da tekshirilmoqda (shtrix-kod bo\'yicha, aktiv+noaktiv)...');
  const looks = await lookupAll(items);
  const hist = priceHistoryIndex();
  const gAll = { aktiv: [], noaktiv: [], yoq: [], xato: [], shtrixsiz: [] };
  items.forEach((it, k) => gAll[looks[k].status].push({ ...it, ...looks[k] }));
  const sup = guessSupplier([...gAll.aktiv, ...gAll.noaktiv], hist);

  const prob = await writeProblemExcel(src, gAll);

  if (process.argv.includes('--short')) {
    shortReport(path.basename(src), gAll, fileTotal, sup, hist, fileTotalKnown);
    if (prob) console.log(`📋 Chiqmaganlar ro'yxati: ${path.basename(prob.path)} (${prob.count} ta, sababi bilan)`);
    return;
  }

  const g = report(items, looks, fileTotal);
  priceReport(g, hist);
  if (sup) {
    console.log(`\n  🏢 TA'MINOTCHI (tovarlarning oxirgi kirimidan aniqlandi):`);
    console.log(`     ${sup.best.name}`);
    console.log(`     ${sup.best.n}/${sup.total} tovar shu ta'minotchidan kelgan | id ${sup.best.id}`);
    if (sup.all.length > 1) sup.all.slice(1).forEach(s => console.log(`     (boshqa: ${s.name} — ${s.n} ta)`));
  }

  if (prob) console.log(`\n  📋 Chiqmaganlar Excel qilib yozildi: ${path.basename(prob.path)} (${prob.count} ta, har birida sababi)`);

  const orderable = g.aktiv.length + g.noaktiv.length;
  const orderSum = [...g.aktiv, ...g.noaktiv].reduce((a, x) => a + x.qty * x.price, 0);
  console.log('\n  ─────────────────────────────────────────────────────────────────');
  console.log(`  Buyurtmaga tushadigan: ${orderable} ta | summasi: ${num(orderSum)} so'm`);
  if (!fileTotalKnown) {
    // --items-json manbada mustaqil "jami" yo'q (narx o'zimizdan qo'shilgan bo'lishi
    // mumkin) - fileTotal shu items'ning o'zidan hisoblangani uchun taqqoslash
    // ma'nosiz (doim mos chiqadi). Shuning uchun "mos keldi" da'vosi qilinmaydi.
  } else if (orderSum !== fileTotal) {
    console.log(`  ⚠️  Fayl jamisidan farq: ${num(fileTotal - orderSum)} so'm (yuqoridagi topilmaganlar sababli)`);
  } else {
    console.log('  ✅ Fayl jami summasi bilan AYNAN mos.');
  }

  if (!process.argv.includes('--create')) {
    console.log('\n  (Bu faqat tekshiruv edi — buyurtma YARATILMADI.');
    console.log('   Yaratish uchun: --supplier "<nom>" --create)');
    console.log('═'.repeat(72));
    return;
  }

  // Ta'minotchini uch xil ko'rsatish mumkin: "auto" (tovarlarning kirim tarixidan
  // aniqlangani), aniq nom (SUPPLIER_ID_MAP orqali) yoki to'g'ridan-to'g'ri id.
  const supArg = arg('--supplier');
  let supplierId = null, supplierLabel = '';
  if (!supArg || supArg === 'auto') {
    if (!sup) throw new Error('Ta\'minotchi avtomatik aniqlanmadi — --supplier "<nom>" bilan ko\'rsating.');
    supplierId = sup.best.id; supplierLabel = sup.best.name + ` (avtomatik: ${sup.best.n}/${sup.total} tovar)`;
  } else if (SUPPLIER_MAP[supArg]) {
    supplierId = SUPPLIER_MAP[supArg]; supplierLabel = supArg;
  } else if (/^[0-9a-f-]{36}$/i.test(supArg)) {
    supplierId = supArg; supplierLabel = supArg;
  } else {
    throw new Error(`Ta'minotchi topilmadi: "${supArg}" (--suppliers bilan qidiring)`);
  }
  const me = myToken();
  if (me) console.log(`\n  👤 Hisob: ${decodeJwtName(me) || 'shaxsiy login (--login orqali)'}`);
  else console.log(`\n  ⚠️  Shaxsiy login qilinmagan — buyurtma UMUMIY hisobdan (Murodjon Tursunov) yaratiladi.`
    + `\n      O'z nomingizdan yaratish uchun avval: node zakas/order_agent.js --login "<telefon>" "<parol>"`);
  console.log(`  Invan'da qoralama buyurtma yaratilmoqda — ta'minotchi: ${supplierLabel}`);
  const { orderId, po, sent } = await createOrder(g, supplierId, {
    comment: arg('--comment') || `Zakas agent — ${path.basename(src)}`,
    invoice: arg('--invoice') || '', expected: arg('--expected') || null,
  });
  console.log(`  ✅ Yaratildi — buyurtma № ${po || '(raqamsiz)'} | id ${orderId} | ${sent.length} ta pozitsiya`);

  console.log('\n  Tekshirilmoqda (Invan\'dan qayta o\'qib)...');
  const v = await verifyOrder(orderId, sent);
  if (v.ok === null) console.log('  ⚠️ ', v.msg);
  else if (v.ok) {
    console.log(`  ✅ MOS: Invan'da ${v.gotCount} ta pozitsiya, jami ${num(Math.round(v.gotSum))} so'm | holat: ${v.status}`);
    console.log(`     Invan'ning o'z jamisi (total_amount): ${num(v.invanTotal)} so'm`);
  } else {
    console.log(`  ❌ FARQ BOR — yuborildi ${v.expectCount} ta / ${num(Math.round(v.expectSum))} so'm`);
    console.log(`               Invan'da  ${v.gotCount} ta / ${num(Math.round(v.gotSum))} so'm | holat: ${v.status}`);
  }
  console.log('═'.repeat(72));
}

// Boshqa skriptlar (masalan zakas/telegram_bot_runner.js) shu funksiyalarni
// QAYTA YOZMASDAN ishlatishi uchun eksport qilinadi. `require.main === module`
// tekshiruvi build_shablon.js'dagi bilan bir xil naqsh — shu fayl to'g'ridan-to'g'ri
// ishga tushirilgandagina (require qilinganda emas) CLI sifatida ishlaydi.
module.exports = {
  readOrderFile, lookupBarcode, lookupAll, priceHistoryIndex, guessSupplier,
  createOrder, verifyOrder, writeProblemExcel, monitor, findSuppliers,
  num, statusName, isReturn,
};

if (require.main === module) {
  main().catch(e => { console.error('\nXATOLIK:', e.message); process.exit(1); });
}
