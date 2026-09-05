// ─────────────────────────────────────────────────────────────────────────
// Telegram zakas boti — GitHub Actions runneri.
// ─────────────────────────────────────────────────────────────────────────
// `api/telegram-webhook.js` (Vercel) shu skriptni workflow_dispatch orqali
// ishga tushiradi. Excel parslash va Invan bilan ishlash MANTIG'I
// `zakas/order_agent.js`dan (qayta yozmasdan) olinadi — bu yerda faqat
// Telegram bilan bog'lash va "pending" (tasdiq kutayotgan) holatni
// zakas/telegram_pending/<chat_id>.json fayliga saqlash/o'qish bor.
//
// Uch xil "--kind":
//   new_file — faylni o'qiydi, Invan'da tekshiradi, qisqa hisobot yozadi,
//              pending holatni saqlaydi. HECH NARSA YARATMAYDI.
//   confirm  — pending holatni o'qib, Invan'da buyurtma yaratadi, tekshiradi,
//              PDF oladi va guruhga jo'natadi.
//   cancel   — pending holatni o'chiradi.
//
// Reja: C:\Users\User\.claude\plans\crystalline-sauteeing-scone.md
// ─────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const {
  readOrderFile, lookupAll, priceHistoryIndex, guessSupplier,
  createOrder, verifyOrder, writeProblemExcel, num, myToken,
} = require('./order_agent.js');
const { buildSupplierOrder } = require('./watch_agent.js');

const ROOT = path.join(__dirname, '..');
const PENDING_DIR = path.join(__dirname, 'telegram_pending');
const API_V1 = 'https://api.7i.uz/api/v1';
// order_agent.js'dagi bilan bir xil manba - ta'minotchi NOMINI Invan
// supplier_id'ga o'girish uchun (zakas kuzatuvchida ta'minotchi allaqachon
// ANIQ - guessSupplier()dagi kirim-tarixi orqali TAXMIN qilish shart emas).
const SUPPLIER_MAP = require(path.join(ROOT, 'api', '_supplier_id_map.json'));

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : '';
}

function botToken() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN o\'rnatilmagan');
  return t;
}

async function tgCall(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method} -> ${JSON.stringify(data).slice(0, 300)}`);
  return data.result;
}
const sendMessage = (chatId, text) => tgCall('sendMessage', { chat_id: chatId, text });

// Fayl (PDF yoki Excel) yuborish uchun multipart/form-data kerak — Node
// built-in FormData/Blob (Node 18+) yetarli, npm paket kerak emas.
const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};
async function sendDocument(chatId, buf, filename, caption) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const fd = new FormData();
  fd.append('chat_id', String(chatId));
  if (caption) fd.append('caption', caption);
  fd.append('document', new Blob([buf], { type: MIME[ext] || 'application/octet-stream' }), filename);
  const r = await fetch(`https://api.telegram.org/bot${botToken()}/sendDocument`, { method: 'POST', body: fd });
  const data = await r.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram sendDocument -> ${JSON.stringify(data).slice(0, 300)}`);
  return data.result;
}

function invanToken() {
  const p = path.join(ROOT, 'api_token.txt');
  const t = fs.readFileSync(p, 'utf8').trim();
  if (!t) throw new Error('api_token.txt bo\'sh');
  return t;
}

async function getOrderPdfLink(orderId) {
  const r = await fetch(`${API_V1}/supplier_order_pdf/${orderId}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + invanToken(), 'Content-Type': 'application/json', Timezone: '300' },
    body: '{}',
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.link) throw new Error(`supplier_order_pdf -> ${r.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data.link;
}

function pendingPath(chatId) {
  return path.join(PENDING_DIR, `${chatId}.json`);
}
function readPending(chatId) {
  const p = pendingPath(chatId);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function writePending(chatId, data) {
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  fs.writeFileSync(pendingPath(chatId), JSON.stringify(data, null, 1), 'utf8');
}
function clearPending(chatId) {
  const p = pendingPath(chatId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// ── new_file: faylni tekshirib, qisqa hisobot + pending holat ──────────────
async function handleNewFile(chatId, filePath) {
  const src = path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
  if (!fs.existsSync(src)) {
    await sendMessage(chatId, `❌ Faylni topa olmadim: ${filePath}`);
    return;
  }
  try {
    await handleNewFileInner(chatId, src);
  } finally {
    // Manba fayl kerakli ma'lumot pending JSON'ga ko'chirilgandan keyin ortiq
    // shart emas - repo'da doimiy to'planib qolmasin (zakas/.gitignore'ning
    // "vaqtinchalik ish materiali" niyatiga mos).
    try { fs.unlinkSync(src); } catch { /* allaqachon yo'q bo'lishi mumkin */ }
  }
}

async function handleNewFileInner(chatId, src) {
  await sendMessage(chatId, '🔎 Faylni o\'qiyapman, Invan\'da tekshiryapman...');

  let parsed;
  try {
    parsed = await readOrderFile(src);
  } catch (e) {
    await sendMessage(chatId, `⚠️ Bu faylni tushunmadim: ${e.message}\nUstunlarni tekshirib, qo'lda ko'rib chiqishim kerak bo'lishi mumkin.`);
    return;
  }
  const items = parsed.data.map(d => ({ name: d.name, barcode: d.barcode, qty: d.qty, price: d.price }));
  if (!items.length) {
    await sendMessage(chatId, '⚠️ Faylda soni yozilgan tovar topilmadi.');
    return;
  }

  // Taxminiy tanlangan (ambiguous) ustun bo'lsa — ochiq ogohlantiramiz, chunki
  // TIIN.xlsx/Новинки tajribasida ("Кол-во в кор" quti sig'imi, sarlavhasiz
  // oxirgi ustun) noto'g'ri ustun tanlanishi mumkin ([[project-telegram-zakas-bot]]).
  const p = parsed.hdr.pick;
  if (p.ambiguousQty || p.ambiguousName) {
    await sendMessage(chatId,
      `⚠️ Bu faylning ustunlari MENGA ANIQ EMAS (bir nechta nomzod bor edi):\n` +
      `   nomi: ${p.name} | soni: ${p.qty}${p.qtyOther.length ? ' (boshqa nomzod: ' + p.qtyOther.join(', ') + ')' : ''}\n` +
      `Xato ustun tanlanib qolishi mumkin — bu faylni hozircha qo'lda tekshirib chiqishimiz kerak, avtomatik davom etmayman.`);
    return;
  }

  const fileTotal = items.reduce((a, x) => a + x.qty * x.price, 0);
  const looks = await lookupAll(items);
  const hist = priceHistoryIndex();
  const g = { aktiv: [], noaktiv: [], yoq: [], xato: [], shtrixsiz: [] };
  items.forEach((it, k) => g[looks[k].status].push({ ...it, ...looks[k] }));
  const sup = guessSupplier([...g.aktiv, ...g.noaktiv], hist);

  const ok = [...g.aktiv, ...g.noaktiv];
  const orderSum = ok.reduce((a, x) => a + x.qty * x.price, 0);

  const lines = [];
  lines.push(`📄 ${path.basename(src)}`);
  lines.push(sup ? `🏢 ${sup.best.name}   [${sup.best.n}/${sup.total} tovar shundan]` : '🏢 Ta\'minotchi aniqlanmadi');
  lines.push(`📦 ${ok.length} ta tovar · ${num(orderSum)} so'm` + (orderSum === fileTotal ? '  ✅ fayl jamisiga mos' : `  ❌ fayl jamisi ${num(fileTotal)} — FARQ BOR`));
  if (g.noaktiv.length) lines.push(`⚠️ ${g.noaktiv.length} ta noaktiv (Invan'da yoqish kerak)`);
  if (g.yoq.length) lines.push(`❌ ${g.yoq.length} ta Invan'da yo'q`);
  if (g.xato.length) lines.push(`🔌 ${g.xato.length} ta tekshirilmadi (tarmoq xatosi)`);
  if (g.shtrixsiz.length) lines.push(`⁉️ ${g.shtrixsiz.length} ta shtrix-kodsiz`);
  lines.push('');
  lines.push(ok.length ? 'Shu tovarlarga buyurtma yarataymi? Tasdiqlash uchun "ha" deb yozing.' : 'Buyurtmaga tushadigan tovar yo\'q.');

  // Buyurtmaga tushmagan (noaktiv/yo'q/xato/shtrixsiz) tovarlar SABAB ustuni
  // bilan alohida Excel qilib yuboriladi - CLI'dagi bir xil funksiyadan
  // (order_agent.js) foydalaniladi, qayta yozilmaydi.
  const prob = await writeProblemExcel(src, g);
  if (prob) lines.push(`📋 Buyurtmaga tushmagan ${prob.count} ta tovar ro'yxatini pastda Excel qilib yuboraman.`);

  if (!ok.length || !sup) {
    await sendMessage(chatId, lines.join('\n'));
  } else {
    writePending(chatId, {
      createdAt: new Date().toISOString(),
      srcFile: path.basename(src),
      supplierId: sup.best.id,
      supplierLabel: sup.best.name,
      items: ok,
      fileTotal,
    });
    await sendMessage(chatId, lines.join('\n'));
  }

  if (prob) {
    try {
      const buf = fs.readFileSync(prob.path);
      await sendDocument(chatId, buf, path.basename(prob.path), `Buyurtmaga tushmagan tovarlar (${prob.count} ta)`);
    } finally {
      try { fs.unlinkSync(prob.path); } catch { /* allaqachon yo'q bo'lishi mumkin */ }
    }
  }
}

// ── pick_supplier: zakas kuzatuvchi tugmasi + kun soni → tayyor ro'yxat ────
// Excel fayldan farqli o'laroq ta'minotchi ALLAQACHON ANIQ (foydalanuvchi
// tugma orqali tanlagan) - guessSupplier() (kirim tarixidan TAXMIN) shart
// emas, SUPPLIER_MAP orqali to'g'ridan-to'g'ri Invan supplier_id topiladi.
// Miqdorlar watch_agent.js'dan (sales_runtime.js'dagi haqiqiy zakas hisobi,
// qayta yozilmagan) keladi - bu yerda faqat Invan bilan solishtirish bor.
async function handlePickSupplier(chatId, supplier, days) {
  await sendMessage(chatId, `🔎 ${supplier} uchun ${days} kunlik zakas hisoblanyapti, Invan'da tekshiryapman...`);

  const supplierId = SUPPLIER_MAP[supplier];
  if (!supplierId) {
    await sendMessage(chatId, `❌ "${supplier}" Invan ta'minotchilar xaritasida topilmadi - qo'lda tekshirish kerak.`);
    return;
  }

  let items;
  try {
    items = await buildSupplierOrder(supplier, days);
  } catch (e) {
    await sendMessage(chatId, `⚠️ Zakas ro'yxati tuzilmadi: ${e.message}`);
    return;
  }
  if (!items.length) {
    await sendMessage(chatId, `Hozircha "${supplier}"dan ${days} kunlik zakas kerak bo'lgan tovar yo'q.`);
    return;
  }

  const fileTotal = items.reduce((a, x) => a + x.qty * x.price, 0);
  const looks = await lookupAll(items);
  const g = { aktiv: [], noaktiv: [], yoq: [], xato: [], shtrixsiz: [] };
  items.forEach((it, k) => g[looks[k].status].push({ ...it, ...looks[k] }));

  const ok = [...g.aktiv, ...g.noaktiv];
  const orderSum = ok.reduce((a, x) => a + x.qty * x.price, 0);

  const lines = [];
  lines.push(`🏢 ${supplier}`);
  lines.push(`📦 ${ok.length} ta tovar · ${num(orderSum)} so'm (${days} kunlik zakas)`);
  if (g.noaktiv.length) lines.push(`⚠️ ${g.noaktiv.length} ta noaktiv (Invan'da yoqish kerak)`);
  if (g.yoq.length) lines.push(`❌ ${g.yoq.length} ta Invan'da yo'q`);
  if (g.xato.length) lines.push(`🔌 ${g.xato.length} ta tekshirilmadi (tarmoq xatosi)`);
  if (g.shtrixsiz.length) lines.push(`⁉️ ${g.shtrixsiz.length} ta shtrix-kodsiz`);
  lines.push('');
  lines.push(ok.length ? 'Shu tovarlarga buyurtma yarataymi? Tasdiqlash uchun "ha" deb yozing.' : 'Buyurtmaga tushadigan tovar yo\'q.');

  // writeProblemExcel natija faylini "src" nomidan hosil qiladi (path.dirname/
  // basename) - ta'minotchi NOMINI to'g'ridan-to'g'ri berish xavfli (ba'zi
  // nomlarda "/" yoki boshqa maxsus belgi bo'lishi mumkin), shuning uchun
  // xavfsiz sintetik yo'l ishlatiladi (fayl baribir yuborilgach o'chiriladi).
  const prob = await writeProblemExcel(path.join(ROOT, 'zakas', `pick_${chatId}_tmp.xlsx`), g);
  if (prob) lines.push(`📋 Buyurtmaga tushmagan ${prob.count} ta tovar ro'yxatini pastda Excel qilib yuboraman.`);

  if (!ok.length) {
    await sendMessage(chatId, lines.join('\n'));
  } else {
    writePending(chatId, {
      createdAt: new Date().toISOString(),
      srcFile: `${supplier} (${days} kunlik zakas)`,
      supplierId, supplierLabel: supplier,
      items: ok, fileTotal,
    });
    await sendMessage(chatId, lines.join('\n'));
  }

  if (prob) {
    try {
      const buf = fs.readFileSync(prob.path);
      await sendDocument(chatId, buf, path.basename(prob.path), `Buyurtmaga tushmagan tovarlar (${prob.count} ta)`);
    } finally {
      try { fs.unlinkSync(prob.path); } catch { /* allaqachon yo'q bo'lishi mumkin */ }
    }
  }
}

// ── confirm: pending holatdan Invan'da buyurtma yaratish + PDF ─────────────
async function handleConfirm(chatId) {
  const pending = readPending(chatId);
  if (!pending) {
    await sendMessage(chatId, 'Hozir tasdiqlash kutilayotgan buyurtma yo\'q — avval Excel fayl tashlang.');
    return;
  }
  await sendMessage(chatId, '⏳ Invan\'da buyurtma yaratyapman...');

  const g = { aktiv: pending.items, noaktiv: [] };
  let created;
  try {
    created = await createOrder(g, pending.supplierId, { comment: 'Telegram zakas boti' });
  } catch (e) {
    // Shaxsiy token muammosi bo'lsa pending SAQLANADI - sir to'g'rilangach
    // foydalanuvchi yana "ha" deb yozsa, faylni qayta tashlamay davom etadi.
    await sendMessage(chatId, `❌ Buyurtma yaratilmadi: ${e.message}`);
    return;
  }
  const v = await verifyOrder(created.orderId, created.sent);
  const okMsg = v.ok
    ? `✅ Yaratildi va tekshirildi — № ${created.po || created.orderId}, ${v.gotCount} ta pozitsiya, ${num(Math.round(v.gotSum))} so'm`
    : `⚠️ Yaratildi (№ ${created.po || created.orderId}), lekin tekshiruvda farq bor — Invan'da qo'lda ko'ring`;
  // Buyurtma KIM nomidan yozilgani (2026-08-04). Shaxsiy token topilmasa
  // umumiy hisob ishlaydi va buyurtma boshqa odam nomidan chiqadi - bu
  // 2026-08-04 da sezilmay o'tib ketgan edi, endi har safar xabarda ko'rinadi.
  const whoMsg = v.createdBy
    ? (myToken()
        ? `👤 Kim yaratdi: ${v.createdBy}`
        : `👤 Kim yaratdi: ${v.createdBy}\n⚠️ Shaxsiy token topilmadi — buyurtma UMUMIY hisob nomidan yozildi. INVAN_MY_TOKEN sirini tekshiring.`)
    : '';
  await sendMessage(chatId, whoMsg ? `${okMsg}\n${whoMsg}` : okMsg);

  try {
    const link = await getOrderPdfLink(created.orderId);
    const pdf = await fetch(link).then(r => r.arrayBuffer());
    await sendDocument(chatId, Buffer.from(pdf), `PO${created.po || created.orderId}.pdf`, pending.supplierLabel);
  } catch (e) {
    await sendMessage(chatId, `⚠️ PDF yuborib bo'lmadi: ${e.message} (buyurtma o'zi yaratildi, Invan'dan qo'lda oling)`);
  }

  clearPending(chatId);
}

async function handleCancel(chatId) {
  const pending = readPending(chatId);
  clearPending(chatId);
  await sendMessage(chatId, pending ? '❌ Bekor qilindi.' : 'Hozir bekor qiladigan narsa yo\'q edi.');
}

async function main() {
  const chatId = arg('--chat');
  const kind = arg('--kind');
  const filePath = arg('--file');
  if (!chatId || !kind) throw new Error('--chat va --kind majburiy');

  if (kind === 'new_file') return handleNewFile(chatId, filePath);
  if (kind === 'confirm') return handleConfirm(chatId);
  if (kind === 'cancel') return handleCancel(chatId);
  if (kind === 'pick_supplier') {
    const supplier = arg('--supplier'), days = arg('--days');
    if (!supplier || !days) throw new Error('pick_supplier uchun --supplier va --days majburiy');
    return handlePickSupplier(chatId, supplier, days);
  }
  throw new Error(`Noma'lum --kind: ${kind}`);
}

main().catch(e => { console.error('XATOLIK:', e.message); process.exit(1); });
