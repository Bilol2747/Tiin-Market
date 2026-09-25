// ─────────────────────────────────────────────────────────────────
// DOIMIY ZAKAS NAZORATI (2026-09-24, Bilol): sayt zakas sahifasida katakcha
// belgilangan (nazoratga olingan) firmalarni har ~3 soatda tekshiradi.
//
// QOIDA (Bilol: "firmani zakasi zakas berishga tushmaguncha zakas berilmasin,
// zakasga tushib tugab ham qolmasin"):
//   • Firma "zakas berishga tushdi" = uning kamida BITTA tovari "MUST" zonasida
//     (oxirgi kirimdan qolgan zaxira < ZKA_MUST_ORDER_DAYS = 7 kun). Faqat shundan
//     keyin buyurtma beriladi (firmaning butun zakas ro'yxati bilan: MUST + CAN).
//   • Faqat "CAN" zonasidagi (7-14 kun) tovarlar bor firma KUTADI - hali zakas
//     berilmaydi, birinchi tovar MUST'ga tushganda beriladi.
//   • Tekshiruv har 3 soatda, MUST chegarasi 7 kun => tovar chegaraga tushgach eng ko'pi
//     3 soatda ushlanadi, tugab qolishga 7 kun zaxira bor. Tugashga yaqinlari (<=3 kun)
//     hisobotda "SHOSHILINCH" deb alohida ko'rsatiladi.
//
// YUBORISH KALITI (sukut: O'CHIQ = faqat hisobot, Invan'ga hech narsa yuborilmaydi):
//   auto-data branch'idagi zakas_auto_mode.json {send:true} bo'lsa (kalitni faqat ADMIN sayt
//   panelidan yoki api/zakas-auto-firms.js "mode_set" orqali o'zgartiradi) VA INVAN_PERSONAL_TOKEN
//   secret'i berilgan bo'lsa VA jonli ma'lumot yangi bo'lsa - "zakas berishga tushgan" firmaga
//   HAQIQIY buyurtma yaratiladi, Open qilinadi va ta'minotchiga SMS yuboriladi (sayt katakchasi
//   bilan AYNAN bir xil yo'l: api/invan-order.js, finalize:true, Bilolning shaxsiy Invan hisobidan).
//   Xavfsizlik: firma kuniga 1 ta buyurtma (ledger: zakas_auto_ledger.json, Toshkent kuni);
//   Invan'da telefon raqami yo'q firmaga YUBORILMAYDI (SMS ketmasdi); summa chegarasi
//   (mode.max_sum, 0 = chegarasiz) oshsa - qo'lda tasdiqlash uchun o'tkazib yuboriladi;
//   bir ishga tushishda ko'pi bilan ZAKAS_AUTO_MAX_ORDERS (sukut 15) buyurtma.
//
// Hisob TAYYOR sales_runtime.js'dan chaqiriladi (qayta yozilmagan - saytdagi bilan bir xil
// raqam chiqishi shart, [[feedback-reuse-not-rewrite-calc-code]]): qo'lda kiritilgan
// miqdorlar (zakas-draft) YUKLANMAYDI - faqat sof tizim hisobi. Kirim rejimidagi formula
// stok tuzatishlariga tayanmaydi, shuning uchun Vercel'ga UMUMAN so'rov yuborilmaydi.
//
// Ma'lumot manbalari (hammasi GitHub, Vercel emas):
//   mahsulotlar  - repo'dagi data_mahsulotlar.json (Actions checkout, main)
//   invdata/kirimdata/meta - live-data-latest tag'i (har 15 daqiqada yangilanadi)
//   firmalar     - auto-data branch'idagi zakas_auto_firms.json
//
// Ishlatilishi:
//   node zakas/auto_control.js [--firms-file f.json] [--products f.json] [--invdata f.json|url]
//        [--kirim f.json|url] [--meta f.json|url] [--out hisobot.json] [--all (sinov: hamma firma)]
// Muhit: TELEGRAM_BOT_TOKEN + ZAKAS_AUTO_REPORT_CHAT_ID berilsa - hisobot Telegramga ham
// yuboriladi (berilmasa faqat konsol + GitHub job summary).
// ─────────────────────────────────────────────────────────────────
'use strict';
const fs = require('fs');
const path = require('path');
require('./watch_agent.js');   // DOM stub'larini o'rnatadi va sales_runtime.js'ni yuklaydi
const RT = require(path.join(__dirname, '..', 'sales_runtime.js'));

const RAW = 'https://raw.githubusercontent.com/Bilol2747/Tiin-Market';
const DEFAULTS = {
  'firms-file': `${RAW}/auto-data/zakas_auto_firms.json`,
  invdata: `${RAW}/live-data-latest/live/invdata.json`,
  kirim: `${RAW}/live-data-latest/live/kirimdata.json`,
  meta: `${RAW}/live-data-latest/live/meta.json`,
  products: path.join(__dirname, '..', 'data_mahsulotlar.json'),
};
const URGENT_DAYS = 3;            // shundan kam kun qolgan tovar - "SHOSHILINCH"
const STALE_MINUTES = 90;         // jonli ma'lumot shundan eski bo'lsa - ogohlantirish
const TIMEOUT_MS = 60000;
const PRODUCTS_MAX_AGE_DAYS = 2;  // data_mahsulotlar.json (kuniga 2 marta build) eng oxirgi sotuv sanasi shundan eski bo'lsa - eskirgan
const SEND_DEADLINE_MS = Number(process.env.ZAKAS_AUTO_DEADLINE_MS) || 10 * 60000;   // yuborish bosqichi umumiy dedlayni (job timeout 15 daq)
const NET_FAIL_LIMIT = 2;         // ketma-ket shuncha tarmoq xatosi (ko'prik osilgan) - yuborish to'xtatiladi
const UNRESOLVED_DAYS = 7;        // ledger'dagi hal qilinmagan (inflight/unknown/partial/failed) yozuvlar shuncha kun hisobotda turadi
// Ta'minotchi nomi -> Invan supplier_id (api/invan-order.js bilan bir xil xarita). Ledger dedup'i
// supplier_id bo'yicha: xaritada 2 juft nom bitta supplier_id'ga tushadi (bir firmaga kuniga 2 SMS ketmasin).
const SUPPLIER_ID_MAP = (() => { try { return require(path.join(__dirname, '..', 'api', '_supplier_id_map.json')); } catch (_) { return {}; } })();
const supplierIdOf = sup => SUPPLIER_ID_MAP[String(sup || '').trim()] || null;

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : null;
}

async function loadJson(src, allow404) {
  if (!/^https?:\/\//.test(src)) {
    if (allow404 && !fs.existsSync(src)) return null;
    return JSON.parse(fs.readFileSync(src, 'utf8'));
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(src, { signal: ctrl.signal, cache: 'no-store' });
    if (r.status === 404 && allow404) return null;
    if (!r.ok) throw new Error(`${src} -> HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Timeout (${TIMEOUT_MS / 1000}s): ${src}`);
    throw e;
  } finally { clearTimeout(t); }
}

const som = n => Math.round(n).toLocaleString('ru-RU').replace(/\u00a0/g, ' ');
const d1 = n => (Math.round(n * 10) / 10).toString();
// Qolgan kun: 0 yoki manfiy = oxirgi kirim to'liq sotilib bo'lgan (hisob bo'yicha tovar tugagan).
const dayTxt = n => (n == null ? '?' : n <= 0 ? 'tugagan' : `${d1(n)} kun`);

// Bitta firma holati. rows - shu firmaning BARCHA qatorlari (orderQty=0 ham).
function evaluateFirm(sup, allRows) {
  const MUST = RT.ZKA_MUST_ORDER_DAYS;
  const order = allRows.filter(r => r.orderQty > 0 && r.sku);
  const must = order.filter(r => r.zkaDays != null && r.zkaDays < MUST);
  const urgent = order.filter(r => r.zkaDays != null && r.zkaDays <= URGENT_DAYS);
  // Xavf: MUST zonasida, lekin zakas chiqmagan (ochiq buyurtma ham yo'q, C-filtr (zabc=C va ck=0) ham emas) -
  // formula uni tashlab ketgan bo'lishi mumkin ("tugab qolmasin" nazorati).
  const cFiltered = r => r.abc === 'C' && r.ck === 0;
  const dropped = allRows.filter(r => r.zkaDays != null && r.zkaDays < MUST && !(r.orderQty > 0)
    && !(r.pendingQty > 0) && !cFiltered(r));
  // Faqat hisobot uchun (buyurtma mantig'iga ta'sir qilmaydi) - jimgina o'tib ketadigan guruhlar:
  //  noCalc: kirim ma'lumoti yo'q (zkaDays=null), sotuvi bor, qoldiq <= 0
  //  poHidden: ochiq (Open/New) buyurtma bor, lekin zaxira <= 0 kun - yetkazilmagan PO tugashni yashiradi
  //  cOut: C-filtr tufayli zakas berilmaydigan va tugagan tovarlar (soni)
  const noCalc = allRows.filter(r => r.zkaDays == null && r.dailyAvg > 0 && !(r.stock > 0));
  const poHidden = allRows.filter(r => r.pendingQty > 0 && r.zkaDays != null && r.zkaDays <= 0);
  const cOut = allRows.filter(r => cFiltered(r) && r.zkaDays != null && r.zkaDays <= 0);
  const sum = order.reduce((a, r) => a + r.orderQty * (r.rcost || 0), 0);
  // Summa chegarasi uchun: tannarx yo'q tovar sotuv narxi bilan baholanadi (0 deb sanalmaydi);
  // ikkalasi ham yo'q bo'lsa - noPriceCount (chegara qo'yilgan bo'lsa yuborilmaydi).
  const sumMax = order.reduce((a, r) => a + r.orderQty * (r.rcost || r.price || 0), 0);
  const noPriceCount = order.filter(r => !r.rcost && !r.price).length;
  const sample = r => ({ sku: String(r.sku), name: r.name, days: r.zkaDays == null ? null : Math.round(r.zkaDays * 10) / 10 });
  const toItem = r => ({ sku: String(r.sku), name: r.name, qty: r.orderQty, days: r.zkaDays == null ? null : Math.round(r.zkaDays * 10) / 10, cost: r.rcost || 0, bc: r.bc || [] });
  let status = 'none';
  if (must.length) status = 'send';
  else if (order.length) status = 'wait';
  const minDays = order.reduce((m, r) => (r.zkaDays != null && r.zkaDays < m ? r.zkaDays : m), Infinity);
  return {
    sup, status, sum: Math.round(sum), sumMax: Math.round(sumMax), noPriceCount,
    orderCount: order.length, mustCount: must.length, urgentCount: urgent.length,
    noCostCount: order.filter(r => !r.rcost).length,
    minDays: minDays === Infinity ? null : Math.round(minDays * 10) / 10,
    items: order.sort((a, b) => (a.zkaDays == null ? 999 : a.zkaDays) - (b.zkaDays == null ? 999 : b.zkaDays)).map(toItem),
    dropped: dropped.slice(0, 10).map(sample),
    droppedCount: dropped.length,
    noCalc: noCalc.slice(0, 5).map(sample), noCalcCount: noCalc.length,
    poHidden: poHidden.slice(0, 5).map(sample), poHiddenCount: poHidden.length,
    cOutCount: cOut.length,
  };
}

function buildReport(res, warnings, when, sendInfo, unresolved) {
  sendInfo = sendInfo || { enabled: false, why: '', results: [] };
  unresolved = unresolved || [];
  const send = res.filter(r => r.status === 'send');
  const wait = res.filter(r => r.status === 'wait');
  const none = res.filter(r => r.status === 'none');
  const L = [];
  L.push(`# Doimiy zakas nazorati — ${when} (Toshkent)`);
  L.push('');
  if (sendInfo.enabled) L.push('**Rejim: YUBORISH YOQILGAN — "zakas berishga tushgan" firmalarga buyurtma yaratiladi, Open qilinadi, SMS ketadi.**');
  else L.push(`**Rejim: FAQAT HISOBOT — hech narsa Invan'ga yuborilmadi.**${sendInfo.why ? ' (' + sendInfo.why + ')' : ''}`);
  L.push('');
  warnings.forEach(w => L.push(`⚠️ ${w}`));
  if (warnings.length) L.push('');
  L.push(`Nazoratdagi firmalar: **${res.length}** | 🔴 Zakas berishga tushdi: **${send.length}** | 🟡 Kutmoqda (faqat 7–14 kun zonasi): **${wait.length}** | 🟢 Zakas kerak emas: **${none.length}**`);
  L.push('');
  const sentR = sendInfo.results.filter(x => x.outcome === 'sent');
  const skipR = sendInfo.results.filter(x => x.outcome === 'skipped');
  const failR = sendInfo.results.filter(x => x.outcome === 'failed');
  if (sentR.length) {
    L.push('## ✅ Buyurtma yuborildi');
    sentR.forEach(x => L.push(`- **${x.sup}** — buyurtma ${x.po || '?'}, ${x.count} ta tovar, ${som(x.sum)} so'm — ${x.note}`));
    L.push('');
  }
  if (failR.length) {
    L.push('## ❌ Yuborishda XATO (zudlik bilan tekshiring)');
    failR.forEach(x => L.push(`- **${x.sup}** — ${x.note}`));
    L.push('');
  }
  if (unresolved.length) {
    L.push(`## ⚠️ Hal qilinmagan buyurtmalar (oxirgi ${UNRESOLVED_DAYS} kun, ledger) — Invan'da TEKSHIRING`);
    const st = { inflight: 'yuborish boshlangan, natija yozilmagan (job yiqilgan bo\'lishi mumkin)', unknown: 'javob kelmagan', partial: 'yaratilgan, lekin Open/SMS to\'liq emas', failed: 'xato' };
    unresolved.forEach(o => L.push(`- ${o.day} **${o.firm}** — ${st[o.status] || o.status}${o.po ? `, buyurtma ${o.po}` : ''}${o.note ? ` — ${o.note}` : ''}`));
    L.push('');
  }
  if (skipR.length) {
    L.push('## ⏭ Yuborilmadi (sabab bilan)');
    skipR.forEach(x => L.push(`- ${x.sup} — ${x.note}`));
    L.push('');
  }
  if (send.length) {
    L.push(sendInfo.enabled ? '## 🔴 Zakas berishga tushdi' : '## 🔴 Zakas berishga tushdi (yuborish kaliti yoqilsa, avtomatik ketadi)');
    send.sort((a, b) => (a.minDays ?? 999) - (b.minDays ?? 999)).forEach(r => {
      L.push(`- **${r.sup}** — ${r.orderCount} ta tovar (${r.mustCount} tasi MUST${r.urgentCount ? `, ${r.urgentCount} tasi 🚨 SHOSHILINCH` : ''}), summa ${som(r.sum)} so'm${r.noCostCount ? ` (⚠️ ${r.noCostCount} tovarda narx yo'q)` : ''}, eng kami: ${dayTxt(r.minDays)}`);
      r.items.slice(0, 5).forEach(i => L.push(`    - ${i.name} — ${i.qty} dona, ${dayTxt(i.days)}${i.days != null && i.days > 0 ? ' qolgan' : ''}`));
      if (r.items.length > 5) L.push(`    - … yana ${r.items.length - 5} ta`);
    });
    L.push('');
  }
  if (wait.length) {
    L.push('## 🟡 Kutmoqda (hali zakas berilmaydi)');
    wait.sort((a, b) => (a.minDays ?? 999) - (b.minDays ?? 999)).forEach(r =>
      L.push(`- ${r.sup} — ${r.orderCount} ta tovar 7–14 kun zonasida, eng kami ${d1(r.minDays)} kun (MUST chegarasi 7 kun)`));
    L.push('');
  }
  const risky = res.filter(r => r.droppedCount > 0);
  if (risky.length) {
    L.push('## ❗ Tekshirib ko\'ring: 7 kundan kam qolgan, lekin zakas chiqmagan tovarlar');
    risky.forEach(r => L.push(`- ${r.sup}: ${r.droppedCount} ta (${r.dropped.slice(0, 3).map(i => `${i.name} ${dayTxt(i.days)}`).join('; ')}${r.droppedCount > 3 ? '; …' : ''})`));
    L.push('');
  }
  const noCalcF = res.filter(r => r.noCalcCount > 0);
  if (noCalcF.length) {
    L.push('## ❔ Kirim ma\'lumoti yo\'q (qolgan kun hisoblanmaydi), sotuvi bor va qoldiq <= 0');
    noCalcF.forEach(r => L.push(`- ${r.sup}: ${r.noCalcCount} ta (${r.noCalc.slice(0, 3).map(i => i.name).join('; ')}${r.noCalcCount > 3 ? '; …' : ''})`));
    L.push('');
  }
  const poF = res.filter(r => r.poHiddenCount > 0);
  if (poF.length) {
    L.push('## 📦 Ochiq buyurtma bor, lekin tovar tugagan (yetkazilmagan PO tugashni yashiradi)');
    poF.forEach(r => L.push(`- ${r.sup}: ${r.poHiddenCount} ta (${r.poHidden.slice(0, 3).map(i => i.name).join('; ')}${r.poHiddenCount > 3 ? '; …' : ''})`));
    L.push('');
  }
  const cOutTotal = res.reduce((a, r) => a + (r.cOutCount || 0), 0);
  if (cOutTotal) {
    L.push(`## ⚪ C-filtr: tugagan, lekin kam sotilgani uchun zakas berilmaydigan tovarlar — ${cOutTotal} ta (${res.filter(r => r.cOutCount > 0).length} firmada)`);
    L.push('');
  }
  if (!res.length) L.push('_Nazoratga olingan firma yo\'q (sayt zakas sahifasida firma yonidagi katakchani belgilang)._');
  return L.join('\n');
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.ZAKAS_AUTO_REPORT_CHAT_ID;
  if (!token || !chat) return false;
  const body = text.replace(/[*#]/g, '').slice(0, 3900);   // Telegram plain text, 4096 chegara
  const r = await timedFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: body }),
  }, 20000);
  if (!r.ok) throw new Error(`Telegram HTTP ${r.status}`);
  return true;
}

// ── GitHub Contents API (auto-data branch): rejim kaliti, ro'yxat, ledger ──────────
const REPO = process.env.GITHUB_REPOSITORY || 'Bilol2747/Tiin-Market';
const DATA_BRANCH = 'auto-data';
const INVAN_ORDER_URL = process.env.INVAN_ORDER_URL || 'https://tiin-market.vercel.app/api/invan-order';

async function timedFetch(url, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms || TIMEOUT_MS);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}
async function ghApi(pathname, opts, allow404) {
  const r = await timedFetch(`https://api.github.com${pathname}`, {
    ...(opts || {}),
    headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
  });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch (_) { body = text; }
  if (r.status === 404 && allow404) return null;
  if (!r.ok) {
    const err = new Error(`GitHub ${pathname} -> ${r.status}: ${(typeof body === 'string' ? body : JSON.stringify(body)).slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  return body;
}
async function ghReadJson(file, empty) {
  const f = await ghApi(`/repos/${REPO}/contents/${file}?ref=${DATA_BRANCH}`, {}, true);
  if (!f || !f.content) return { sha: null, data: empty() };
  let data; try { data = JSON.parse(Buffer.from(f.content, 'base64').toString('utf8')); } catch (_) { data = empty(); }
  return { sha: f.sha, data: data && typeof data === 'object' ? data : empty() };
}
async function ghWriteJson(file, data, sha, message) {
  const body = { message, branch: DATA_BRANCH, content: Buffer.from(JSON.stringify(data, null, 2) + '\n', 'utf8').toString('base64') };
  if (sha) body.sha = sha;
  const r = await ghApi(`/repos/${REPO}/contents/${file}`, { method: 'PUT', body: JSON.stringify(body) });
  return r && r.content ? r.content.sha : null;
}

const LEDGER_FILE = 'zakas_auto_ledger.json';
const MODE_FILE = 'zakas_auto_mode.json';
const tashkentDay = d => (d ? new Date(d) : new Date()).toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
const OPEN_STATUSES = new Set(['inflight', 'unknown', 'partial', 'failed']);

// api/invan-order.js'ga so'rov (sayt katakchasi bilan bir xil yo'l). Tarmoq xatosi/timeout - istisno.
// Timeout javob TANASINI o'qishni ham qamraydi (sarlavha kelib, tana osilib qolsa ham to'xtaydi).
async function invanCall(body, ms) {
  ms = ms || 90000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(INVAN_ORDER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal });
    let j = null, readErr = null;
    try { j = await r.json(); } catch (e) { readErr = e; }
    if (readErr && readErr.name === 'AbortError') throw readErr;
    if (!j) throw new Error(`Invan ko'prigi javobi o'qilmadi (HTTP ${r.status})`);
    return j;
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error(`Invan ko'prigi ${ms / 1000}s ichida javob bermadi`);
    throw e;
  } finally { clearTimeout(t); }
}

async function readMode() {
  const m = (await ghReadJson(MODE_FILE, () => ({ send: false, max_sum: 0 }))).data;
  return { send: m.send === true, max_sum: Number(m.max_sum) > 0 ? Number(m.max_sum) : 0 };
}
async function readLedger() {
  const L = await ghReadJson(LEDGER_FILE, () => ({ orders: [] }));
  if (!Array.isArray(L.data.orders)) L.data.orders = [];
  return L;
}
// Ledger yozuvini (id bo'yicha) qo'shadi/yangilaydi. 409/422 (sha eskirgan) - qayta o'qib, 3 martagacha.
// Yozib bo'lmasa - istisno (job yiqiladi, qayta yuborib yubormaslik uchun).
async function ledgerUpsert(L, entry, message) {
  for (let attempt = 0; ; attempt++) {
    const i = L.data.orders.findIndex(o => o.id === entry.id);
    if (i >= 0) L.data.orders[i] = entry; else L.data.orders.push(entry);
    L.data.orders = L.data.orders.slice(-1000);
    try { L.sha = await ghWriteJson(LEDGER_FILE, L.data, L.sha, message); return; }
    catch (e) {
      if ((e.status !== 409 && e.status !== 422) || attempt >= 2) throw e;
      const fresh = await readLedger();
      L.sha = fresh.sha; L.data = fresh.data;
    }
  }
}
// Firma bugun (Toshkent kuni) ledger'da bormi - nomi YOKI supplier_id bo'yicha (har qanday status bloklaydi).
function ledgerHasToday(L, sup, sid, day, exceptId) {
  return L.data.orders.some(o => o.day === day && (exceptId == null || o.id !== exceptId) && (o.firm === sup || (sid && o.sid === sid)));
}
function unresolvedEntries(orders, sinceDay) {
  return (orders || []).filter(o => o && OPEN_STATUSES.has(o.status) && String(o.day || '') >= sinceDay);
}

// YUBORISH: faqat "zakas berishga tushgan" (status=send) firmalar. Natijalar ro'yxatini qaytaradi.
// ctx: { firms: nazorat ro'yxati (firma -> {at,...}), runIds: shu ishga tushishda yozilgan ledger id'lari }
async function sendPhase(res, mode, warnings, results, ctx) {
  results = results || [];   // tashqaridan beriladi: istisno chiqsa ham shu paytgacha yuborilganlar hisobotda qoladi
  ctx = ctx || {};
  const runIds = ctx.runIds || new Set();
  const token = process.env.INVAN_PERSONAL_TOKEN;
  // Bo'sh token bilan api/invan-order.js UMUMIY statik tokenga o'tib yaratib yuboradi - bunga yo'l qo'yilmaydi.
  if (!token) throw new Error('INVAN_PERSONAL_TOKEN bo\'sh - yuborilmaydi');
  const L = await readLedger();
  const day = tashkentDay();
  const t0 = Date.now();
  let maxSum = Number(mode.max_sum) > 0 ? Number(mode.max_sum) : 0;
  const maxOrders = Number(process.env.ZAKAS_AUTO_MAX_ORDERS) || 15;
  const firms = ctx.firms || {};
  const targets = res.filter(r => r.status === 'send').sort((a, b) => (a.minDays ?? 999) - (b.minDays ?? 999));
  const skip = (f, note) => results.push({ sup: f.sup, outcome: 'skipped', note });
  const fail = (f, note) => results.push({ sup: f.sup, outcome: 'failed', note });
  let made = 0, netFails = 0;
  for (let k = 0; k < targets.length; k++) {
    const f = targets[k];
    if (Date.now() - t0 > SEND_DEADLINE_MS) {
      targets.slice(k).forEach(x => skip(x, 'vaqt chegarasi tugadi — keyingi ishga tushishda'));
      warnings.push(`Yuborish bosqichi ${Math.round(SEND_DEADLINE_MS / 60000)} daqiqalik chegaraga yetdi — qolgan firmalar keyingi safar.`);
      break;
    }
    const sid = supplierIdOf(f.sup);
    if (ledgerHasToday(L, f.sup, sid, day)) { skip(f, 'bugun allaqachon buyurtma berilgan (kuniga 1 ta)'); continue; }
    const fe = firms[f.sup];
    if (fe && fe.at && tashkentDay(fe.at) === day) { skip(f, 'bugun saytda (katakcha bilan) qo\'lda buyurtma berilgan — avtomatik yuborilmaydi'); continue; }
    if (made >= maxOrders) { skip(f, `bir ishga tushishdagi chegara (${maxOrders} ta buyurtma) — keyingi safar`); continue; }

    let ph;
    try { ph = await invanCall({ action: 'phones', target: 'prod', supplier_name: f.sup, invan_token: token }, 30000); }
    catch (e) {
      fail(f, `telefonni tekshirib bo'lmadi: ${e.message}`);
      if (++netFails >= NET_FAIL_LIMIT) { warnings.push(`Invan ko'prigi ketma-ket ${netFails} marta javob bermadi — yuborish TO'XTATILDI.`); break; }
      continue;
    }
    netFails = 0;
    if (ph.token_expired) { fail(f, 'Invan tokeni muddati o\'tgan — yuborish TO\'XTATILDI, INVAN_PERSONAL_TOKEN secret\'ini yangilang'); warnings.push('Invan shaxsiy tokeni yaroqsiz — yuborish to\'xtatildi.'); break; }
    if (!ph.ok) { skip(f, `telefonni tekshirib bo'lmadi: ${ph.error || 'noma\'lum xato'}`); continue; }
    if (!ph.found) { skip(f, 'firma Invan xaritasida topilmadi — yuborilmadi'); continue; }
    if (!ph.phones || !ph.phones.length) { skip(f, 'Invan\'da firmaning telefon raqami YO\'Q — SMS ketmasdi, yuborilmadi'); continue; }

    // Kalit (va summa chegarasi) har buyurtmadan OLDIN qayta o'qiladi - run o'rtasida o'chirilsa darhol to'xtaydi.
    const m = await readMode();
    if (m.send !== true) { warnings.push('Yuborish kaliti ish davomida O\'CHIRILDI — qolgan firmalarga yuborilmadi.'); break; }
    maxSum = m.max_sum;
    if (maxSum && f.noPriceCount) { skip(f, `${f.noPriceCount} ta tovarda narx yo'q — summani chegara (${som(maxSum)}) bilan tekshirib bo'lmaydi, qo'lda tasdiqlash kerak`); continue; }
    if (maxSum && Math.max(f.sum, f.sumMax || 0) > maxSum) { skip(f, `summa ${som(Math.max(f.sum, f.sumMax || 0))} so'm chegaradan (${som(maxSum)}) oshdi — qo'lda tasdiqlash kerak`); continue; }

    // Buyurtmadan OLDIN ledger'ga "inflight" - so'rov ketgach runner yiqilsa/ledger yozilmasa ham bugun qayta yuborilmaydi.
    const items = f.items.map(i => ({ sku: String(i.sku), qty: i.qty, cost: i.cost || 0, name: i.name, bc: i.bc || [] }));
    const entry = { id: `${day}|${sid || f.sup}|${Date.now()}`, firm: f.sup, sid, day, at: new Date().toISOString(), status: 'inflight', sum: f.sum, items: items.length };
    await ledgerUpsert(L, entry, `Zakas nazorati ledger: ${f.sup} (yuborilmoqda)`);
    runIds.add(entry.id);
    if (ledgerHasToday(L, f.sup, sid, day, entry.id)) {   // qayta o'qishda boshqa yozuv paydo bo'lgan (parallel yozuv)
      entry.status = 'failed'; entry.note = 'parallel yozuv: bugun boshqa buyurtma bor — yuborilmadi';
      skip(f, 'bugun allaqachon buyurtma berilgan (parallel yozuv)');
      await ledgerUpsert(L, entry, `Zakas nazorati ledger: ${f.sup} (bekor)`);
      continue;
    }

    let j;
    try {
      j = await invanCall({ target: 'prod', supplier_name: f.sup, comment: `Avtomatik zakas: ${f.sup}`, expected_date: `${day}T00:00:00Z`, items, invan_token: token, finalize: true });
    } catch (e) {
      // Javob kelmadi - buyurtma yaratilgan bo'lishi MUMKIN. Takroriy SMS ketmasligi uchun bugunga bloklanadi.
      fail(f, `javob kelmadi (${e.message}) — buyurtma yaratilgan bo'lishi mumkin, Invan'da TEKSHIRING; bugun qayta yuborilmaydi`);
      warnings.push("Invan ko'prigi javob bermadi — qolgan firmalarga yuborish TO'XTATILDI (keyingi ishga tushishda qayta uriniladi).");
      Object.assign(entry, { status: 'unknown', note: e.message });
      await ledgerUpsert(L, entry, `Zakas nazorati ledger: ${f.sup} (noaniq)`);
      break;   // xizmat ishlamayotgan bo'lishi mumkin - har firma uchun 90s kutib job'ni osib qo'ymaymiz
    }
    if (j.token_expired) {
      fail(f, 'Invan tokeni muddati o\'tgan — yuborish TO\'XTATILDI');
      warnings.push('Invan shaxsiy tokeni yaroqsiz — yuborish to\'xtatildi.');
      Object.assign(entry, { status: 'failed', note: 'token muddati o\'tgan' });
      await ledgerUpsert(L, entry, `Zakas nazorati ledger: ${f.sup} (xato)`);
      break;
    }
    if (!j.ok) {
      // Buyurtma yaratilib, keyin xato bo'lgan bo'lishi mumkin - bugunga bloklanadi (har 3 soatda bo'sh "New" qoralama ketmasin).
      const note = `Invan xatosi: ${j.error || 'noma\'lum'}${j.unmapped && j.unmapped.length ? ` (Invan'da topilmagan tovar: ${j.unmapped.length})` : ''}`;
      fail(f, note + ' — bugun qayta yuborilmaydi, Invan\'da tekshiring');
      Object.assign(entry, { status: 'failed', note });
      await ledgerUpsert(L, entry, `Zakas nazorati ledger: ${f.sup} (xato)`);
      continue;
    }

    const fz = j.finalize || {};
    const status = fz.opened && fz.sms_sent ? 'ok' : 'partial';
    made++;
    const note = fz.opened && fz.sms_sent ? `Open qilindi, SMS yuborildi (${(fz.phones || []).join(', ')})`
      : fz.opened ? `Open qilindi, LEKIN SMS yuborilmadi: ${fz.note || 'sababi noma\'lum'}` : `yaratildi (New), LEKIN Open qilib bo'lmadi: ${fz.note || 'sababi noma\'lum'}`;
    // Natija ledger yozuvidan OLDIN - ledger yozilmasa ham hisobotda buyurtma ko'rinadi.
    results.push({ sup: f.sup, outcome: status === 'ok' ? 'sent' : 'failed', po: j.po, count: j.added != null ? j.added : items.length, sum: f.sum,
      note: note + (j.unmapped && j.unmapped.length ? ` | Invan'da topilmagan tovar: ${j.unmapped.length} ta` : '') });
    Object.assign(entry, { status, po: j.po, items: j.added != null ? j.added : items.length,
      opened: !!fz.opened, sms_sent: !!fz.sms_sent, phones: fz.phones || [], note: fz.note || '', unmapped: (j.unmapped || []).length });
    await ledgerUpsert(L, entry, `Zakas nazorati ledger: ${f.sup} (${j.po})`);   // yozilmasa - job YIQILADI ("inflight" qoladi - bugunga blok)
  }
  return results;
}

// data_mahsulotlar.json yangiligi: fayl ichida sana yo'q (git tarixi siqiladi) - eng oxirgi sotuv sanasi (`ld`).
function productsNewestDay(p2) {
  let max = '';
  if (Array.isArray(p2)) for (const p of p2) { const d = p && p.ld; if (typeof d === 'string' && d > max) max = d; }
  return max || null;
}

async function main() {
  const src = k => arg(k) || DEFAULTS[k];
  const warnings = [];
  const haveGh = !!process.env.GITHUB_TOKEN;
  const isAll = process.argv.includes('--all');

  // Ro'yxat: Actions'da GitHub API (yangi, keshsiz), aks holda fayl/raw URL
  const firmsPromise = (haveGh && !arg('firms-file'))
    ? ghReadJson('zakas_auto_firms.json', () => ({ firms: {} })).then(x => x.data)
    : loadJson(src('firms-file'), true);
  const modePromise = haveGh ? readMode() : Promise.resolve({ send: false, max_sum: 0 });
  const [firmsDoc, mode, p2, invdata, kirim, meta] = await Promise.all([
    firmsPromise,
    modePromise,
    loadJson(src('products')),
    loadJson(src('invdata')),
    loadJson(src('kirim')),
    loadJson(src('meta')).catch(() => null),
  ]);

  // Jonli ma'lumot yangiligi - eskirgan bo'lsa (Actions ishlamay qolgan) natijaga ishonib bo'lmaydi.
  // Noto'g'ri sana (NaN) ham ESKIRGAN hisoblanadi (fail-closed).
  let stale = false, freshKnown = false;
  if (meta && meta.published_at) {
    freshKnown = true;
    const ageMin = (Date.now() - new Date(meta.published_at).getTime()) / 60000;
    if (!(ageMin <= STALE_MINUTES)) { stale = true; warnings.push(`Jonli ma'lumot ESKIRGAN yoki sanasi noto'g'ri: ${isFinite(ageMin) ? Math.round(ageMin) + ' daqiqa oldin yangilangan' : `"${meta.published_at}"`} (chegara ${STALE_MINUTES}). Bunday holatda hech narsa yuborilmaydi.`); }
  } else warnings.push('Jonli ma\'lumot yangiligini (meta.json) tekshirib bo\'lmadi — yuborilmaydi.');
  // Mahsulotlar (sotuv tezligi) yangiligi: build kuniga 2 marta - eng oxirgi sotuv sanasi 2 kundan eski bo'lsa eskirgan.
  const pDay = productsNewestDay(p2);
  const pAgeDays = pDay ? (Date.parse(tashkentDay() + 'T00:00:00Z') - Date.parse(pDay + 'T00:00:00Z')) / 86400000 : NaN;
  const productsStale = !(pAgeDays <= PRODUCTS_MAX_AGE_DAYS);
  if (productsStale) warnings.push(`Mahsulotlar ma'lumoti (data_mahsulotlar.json) ESKIRGAN yoki sanasi yo'q: oxirgi sotuv ${pDay || '?'} (chegara ${PRODUCTS_MAX_AGE_DAYS} kun). Bunday holatda hech narsa yuborilmaydi.`);

  const firmsMap = firmsDoc && firmsDoc.firms && typeof firmsDoc.firms === 'object' ? firmsDoc.firms : {};
  let enrolled = Object.keys(firmsMap).sort((a, b) => a.localeCompare(b, 'ru'));

  const apiData = { products: p2, inventory: invdata };
  await RT._ensureP2Data(apiData);
  RT.setP8(kirim);
  await RT._enrichWithInventory(p2, apiData);
  RT._buildZItems();

  const map = RT._zkAutoAllRowsMap();
  if (isAll) enrolled = Object.keys(map).sort((a, b) => a.localeCompare(b, 'ru'));   // faqat tahlil/sinov uchun
  const res = [];
  for (const sup of enrolled) {
    if (!(sup in map)) { warnings.push(`"${sup}" nazoratda, lekin zakas ma'lumotida topilmadi (nomi o'zgargan bo'lishi mumkin).`); continue; }
    res.push(evaluateFirm(sup, map[sup]));
  }

  // Yuborish faqat: kalit yoqilgan + shaxsiy token bor + GitHub yozish huquqi bor + ma'lumot yangi + --all emas
  let why = '';
  if (mode.send !== true) why = 'yuborish kaliti o\'chiq';
  else if (!process.env.INVAN_PERSONAL_TOKEN) why = 'INVAN_PERSONAL_TOKEN secret\'i berilmagan';
  else if (!haveGh) why = 'GITHUB_TOKEN yo\'q (ledger yozib bo\'lmaydi)';
  else if (!freshKnown || stale) why = 'jonli ma\'lumot yangiligi tasdiqlanmadi';
  else if (productsStale) why = 'mahsulotlar ma\'lumoti eskirgan';
  else if (isAll) why = '--all sinov rejimi';
  const sendInfo = { enabled: !why, why, results: [] };
  const runIds = new Set();
  let fatal = null;
  if (sendInfo.enabled) {
    try { await sendPhase(res, mode, warnings, sendInfo.results, { firms: firmsMap, runIds }); }
    catch (e) { fatal = e; warnings.push(`Yuborish jarayoni XATO bilan to'xtadi: ${e.message}`); }
  }

  // Hal qilinmagan ledger yozuvlari (oldingi ishga tushishlardan) - har run hisobotda qayta ko'rsatiladi.
  let unresolved = [];
  if (haveGh) {
    try {
      const since = tashkentDay(Date.now() - UNRESOLVED_DAYS * 86400000);
      unresolved = unresolvedEntries((await readLedger()).data.orders, since).filter(o => !runIds.has(o.id));
    } catch (e) { warnings.push(`Ledger'ni o'qib bo'lmadi (hal qilinmagan buyurtmalar ko'rsatilmadi): ${e.message}`); }
  }

  const when = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' }).slice(0, 16);
  const report = buildReport(res, warnings, when, sendInfo, unresolved);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  const out = arg('out');
  if (out) fs.writeFileSync(out, JSON.stringify({ when, stale, productsStale, warnings, send: sendInfo, unresolved, firms: res }, null, 2));

  const notable = res.some(r => r.status === 'send') || res.some(r => r.droppedCount > 0) || sendInfo.results.length > 0 || unresolved.length > 0;
  if (notable) {
    try { if (await sendTelegram(report)) console.log('(Telegramga yuborildi)'); }
    catch (e) { console.error('Telegram xatosi:', e.message); }
  }
  if (fatal) throw fatal;   // job qizil bo'lsin - jimgina o'tib ketmasin
  if (sendInfo.results.some(r => r.outcome === 'failed')) process.exitCode = 1;
  // Kalit YOQIQ, lekin yuborib bo'lmadi (token yo'q / ma'lumot eskirgan) - job qizil (yashil bo'lib jim o'tmasin).
  if (mode.send === true && !sendInfo.enabled && !isAll) { console.error(`Yuborish kaliti yoqiq, lekin yuborilmadi: ${why}`); process.exitCode = 1; }
}

module.exports = { evaluateFirm, sendPhase, buildReport, productsNewestDay, main };
if (require.main === module) {
  main().then(() => process.exit(process.exitCode || 0)).catch(e => { console.error('XATOLIK:', e && e.stack || e); process.exit(1); });
}
