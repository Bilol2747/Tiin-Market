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
  // Xavf: MUST zonasida, lekin zakas chiqmagan (ochiq buyurtma ham yo'q, C-filtr ham emas) -
  // formula uni tashlab ketgan bo'lishi mumkin ("tugab qolmasin" nazorati).
  const dropped = allRows.filter(r => r.zkaDays != null && r.zkaDays < MUST && !(r.orderQty > 0)
    && !(r.pendingQty > 0) && !(r.abc === 'C'));
  const sum = order.reduce((a, r) => a + r.orderQty * (r.rcost || 0), 0);
  const toItem = r => ({ sku: String(r.sku), name: r.name, qty: r.orderQty, days: r.zkaDays == null ? null : Math.round(r.zkaDays * 10) / 10, cost: r.rcost || 0, bc: r.bc || [] });
  let status = 'none';
  if (must.length) status = 'send';
  else if (order.length) status = 'wait';
  const minDays = order.reduce((m, r) => (r.zkaDays != null && r.zkaDays < m ? r.zkaDays : m), Infinity);
  return {
    sup, status, sum: Math.round(sum),
    orderCount: order.length, mustCount: must.length, urgentCount: urgent.length,
    noCostCount: order.filter(r => !r.rcost).length,
    minDays: minDays === Infinity ? null : Math.round(minDays * 10) / 10,
    items: order.sort((a, b) => (a.zkaDays == null ? 999 : a.zkaDays) - (b.zkaDays == null ? 999 : b.zkaDays)).map(toItem),
    dropped: dropped.slice(0, 10).map(r => ({ sku: String(r.sku), name: r.name, days: Math.round(r.zkaDays * 10) / 10 })),
    droppedCount: dropped.length,
  };
}

function buildReport(res, warnings, when, sendInfo) {
  sendInfo = sendInfo || { enabled: false, why: '', results: [] };
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
  if (!res.length) L.push('_Nazoratga olingan firma yo\'q (sayt zakas sahifasida firma yonidagi katakchani belgilang)._');
  return L.join('\n');
}

async function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.ZAKAS_AUTO_REPORT_CHAT_ID;
  if (!token || !chat) return false;
  const body = text.replace(/[*#]/g, '').slice(0, 3900);   // Telegram plain text, 4096 chegara
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: body }),
  });
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
  if (!r.ok) throw new Error(`GitHub ${pathname} -> ${r.status}: ${(typeof body === 'string' ? body : JSON.stringify(body)).slice(0, 200)}`);
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
const tashkentDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });

// api/invan-order.js'ga so'rov (sayt katakchasi bilan bir xil yo'l). Tarmoq xatosi/timeout - istisno.
async function invanCall(body) {
  const r = await timedFetch(INVAN_ORDER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 90000);
  let j = null; try { j = await r.json(); } catch (_) { /* pastda */ }
  if (!j) throw new Error(`Invan ko'prigi javobi o'qilmadi (HTTP ${r.status})`);
  return j;
}

// YUBORISH: faqat "zakas berishga tushgan" (status=send) firmalar. Natijalar ro'yxatini qaytaradi.
async function sendPhase(res, mode, warnings, results) {
  results = results || [];   // tashqaridan beriladi: istisno chiqsa ham shu paytgacha yuborilganlar hisobotda qoladi
  const token = process.env.INVAN_PERSONAL_TOKEN;
  const ledger = await ghReadJson(LEDGER_FILE, () => ({ orders: [] }));
  if (!Array.isArray(ledger.data.orders)) ledger.data.orders = [];
  let sha = ledger.sha;
  const day = tashkentDay();
  const doneToday = new Set(ledger.data.orders.filter(o => o.day === day).map(o => o.firm));
  const maxSum = Number(mode.max_sum) > 0 ? Number(mode.max_sum) : 0;
  const maxOrders = Number(process.env.ZAKAS_AUTO_MAX_ORDERS) || 15;
  const targets = res.filter(r => r.status === 'send').sort((a, b) => (a.minDays ?? 999) - (b.minDays ?? 999));
  const skip = (f, note) => results.push({ sup: f.sup, outcome: 'skipped', note });
  const fail = (f, note) => results.push({ sup: f.sup, outcome: 'failed', note });
  let made = 0;
  for (const f of targets) {
    if (doneToday.has(f.sup)) { skip(f, 'bugun allaqachon buyurtma berilgan (kuniga 1 ta)'); continue; }
    if (made >= maxOrders) { skip(f, `bir ishga tushishdagi chegara (${maxOrders} ta buyurtma) — keyingi safar`); continue; }
    if (maxSum && f.sum > maxSum) { skip(f, `summa ${som(f.sum)} so'm chegaradan (${som(maxSum)}) oshdi — qo'lda tasdiqlash kerak`); continue; }

    let ph;
    try { ph = await invanCall({ action: 'phones', target: 'prod', supplier_name: f.sup, invan_token: token }); }
    catch (e) { fail(f, `telefonni tekshirib bo'lmadi: ${e.message}`); continue; }
    if (ph.token_expired) { fail(f, 'Invan tokeni muddati o\'tgan — yuborish TO\'XTATILDI, INVAN_PERSONAL_TOKEN secret\'ini yangilang'); warnings.push('Invan shaxsiy tokeni yaroqsiz — yuborish to\'xtatildi.'); break; }
    if (!ph.ok) { skip(f, `telefonni tekshirib bo'lmadi: ${ph.error || 'noma\'lum xato'}`); continue; }
    if (!ph.found) { skip(f, 'firma Invan xaritasida topilmadi — yuborilmadi'); continue; }
    if (!ph.phones || !ph.phones.length) { skip(f, 'Invan\'da firmaning telefon raqami YO\'Q — SMS ketmasdi, yuborilmadi'); continue; }

    const items = f.items.map(i => ({ sku: String(i.sku), qty: i.qty, cost: i.cost || 0, name: i.name, bc: i.bc || [] }));
    let j;
    try {
      j = await invanCall({ target: 'prod', supplier_name: f.sup, comment: `Avtomatik zakas: ${f.sup}`, expected_date: `${day}T00:00:00Z`, items, invan_token: token, finalize: true });
    } catch (e) {
      // Javob kelmadi - buyurtma yaratilgan bo'lishi MUMKIN. Takroriy SMS ketmasligi uchun bugunga bloklanadi.
      ledger.data.orders.push({ firm: f.sup, day, at: new Date().toISOString(), status: 'unknown', note: e.message, sum: f.sum, items: items.length });
      sha = await ghWriteJson(LEDGER_FILE, ledger.data, sha, `Zakas nazorati ledger: ${f.sup} (noaniq)`);
      doneToday.add(f.sup);
      fail(f, `javob kelmadi (${e.message}) — buyurtma yaratilgan bo'lishi mumkin, Invan'da TEKSHIRING; bugun qayta yuborilmaydi`);
      warnings.push("Invan ko'prigi javob bermadi — qolgan firmalarga yuborish TO'XTATILDI (keyingi ishga tushishda qayta uriniladi).");
      break;   // xizmat ishlamayotgan bo'lishi mumkin - har firma uchun 90s kutib job'ni osib qo'ymaymiz
    }
    if (j.token_expired) { fail(f, 'Invan tokeni muddati o\'tgan — yuborish TO\'XTATILDI'); warnings.push('Invan shaxsiy tokeni yaroqsiz — yuborish to\'xtatildi.'); break; }
    if (!j.ok) { fail(f, `Invan xatosi: ${j.error || 'noma\'lum'}${j.unmapped && j.unmapped.length ? ` (Invan'da topilmagan tovar: ${j.unmapped.length})` : ''}`); continue; }

    const fz = j.finalize || {};
    const status = fz.opened && fz.sms_sent ? 'ok' : 'partial';
    ledger.data.orders.push({ firm: f.sup, day, at: new Date().toISOString(), status, po: j.po, items: j.added != null ? j.added : items.length, sum: f.sum,
      opened: !!fz.opened, sms_sent: !!fz.sms_sent, phones: fz.phones || [], note: fz.note || '', unmapped: (j.unmapped || []).length });
    ledger.data.orders = ledger.data.orders.slice(-1000);
    sha = await ghWriteJson(LEDGER_FILE, ledger.data, sha, `Zakas nazorati ledger: ${f.sup} (${j.po})`);   // yozilmasa - job YIQILADI (qayta yuborib yubormaslik uchun)
    doneToday.add(f.sup);
    made++;
    const note = fz.opened && fz.sms_sent ? `Open qilindi, SMS yuborildi (${(fz.phones || []).join(', ')})`
      : fz.opened ? `Open qilindi, LEKIN SMS yuborilmadi: ${fz.note || 'sababi noma\'lum'}` : `yaratildi (New), LEKIN Open qilib bo'lmadi: ${fz.note || 'sababi noma\'lum'}`;
    results.push({ sup: f.sup, outcome: status === 'ok' ? 'sent' : 'failed', po: j.po, count: j.added != null ? j.added : items.length, sum: f.sum, note });
    if (j.unmapped && j.unmapped.length) results[results.length - 1].note += ` | Invan'da topilmagan tovar: ${j.unmapped.length} ta`;
  }
  return results;
}

async function main() {
  const src = k => arg(k) || DEFAULTS[k];
  const warnings = [];
  const haveGh = !!process.env.GITHUB_TOKEN;

  // Ro'yxat: Actions'da GitHub API (yangi, keshsiz), aks holda fayl/raw URL
  const firmsPromise = (haveGh && !arg('firms-file'))
    ? ghReadJson('zakas_auto_firms.json', () => ({ firms: {} })).then(x => x.data)
    : loadJson(src('firms-file'), true);
  const modePromise = haveGh
    ? ghReadJson('zakas_auto_mode.json', () => ({ send: false, max_sum: 0 })).then(x => x.data)
    : Promise.resolve({ send: false, max_sum: 0 });
  const [firmsDoc, mode, p2, invdata, kirim, meta] = await Promise.all([
    firmsPromise,
    modePromise,
    loadJson(src('products')),
    loadJson(src('invdata')),
    loadJson(src('kirim')),
    loadJson(src('meta')).catch(() => null),
  ]);

  // Jonli ma'lumot yangiligi - eskirgan bo'lsa (Actions ishlamay qolgan) natijaga ishonib bo'lmaydi.
  let stale = false, freshKnown = false;
  if (meta && meta.published_at) {
    freshKnown = true;
    const ageMin = (Date.now() - new Date(meta.published_at).getTime()) / 60000;
    if (ageMin > STALE_MINUTES) { stale = true; warnings.push(`Jonli ma'lumot ESKIRGAN: ${Math.round(ageMin)} daqiqa oldin yangilangan (chegara ${STALE_MINUTES}). Bunday holatda hech narsa yuborilmaydi.`); }
  } else warnings.push('Jonli ma\'lumot yangiligini (meta.json) tekshirib bo\'lmadi — yuborilmaydi.');

  let enrolled = firmsDoc && firmsDoc.firms ? Object.keys(firmsDoc.firms).sort((a, b) => a.localeCompare(b, 'ru')) : [];

  const apiData = { products: p2, inventory: invdata };
  await RT._ensureP2Data(apiData);
  RT.setP8(kirim);
  await RT._enrichWithInventory(p2, apiData);
  RT._buildZItems();

  const map = RT._zkAutoAllRowsMap();
  if (process.argv.includes('--all')) enrolled = Object.keys(map).sort((a, b) => a.localeCompare(b, 'ru'));   // faqat tahlil/sinov uchun
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
  else if (process.argv.includes('--all')) why = '--all sinov rejimi';
  const sendInfo = { enabled: !why, why, results: [] };
  let fatal = null;
  if (sendInfo.enabled) {
    try { await sendPhase(res, mode, warnings, sendInfo.results); }
    catch (e) { fatal = e; warnings.push(`Yuborish jarayoni XATO bilan to'xtadi: ${e.message}`); }
  }

  const when = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Tashkent' }).slice(0, 16);
  const report = buildReport(res, warnings, when, sendInfo);
  console.log(report);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
  const out = arg('out');
  if (out) fs.writeFileSync(out, JSON.stringify({ when, stale, warnings, send: sendInfo, firms: res }, null, 2));

  const notable = res.some(r => r.status === 'send') || res.some(r => r.droppedCount > 0) || sendInfo.results.length > 0;
  if (notable) {
    try { if (await sendTelegram(report)) console.log('(Telegramga yuborildi)'); }
    catch (e) { console.error('Telegram xatosi:', e.message); }
  }
  if (fatal) throw fatal;   // job qizil bo'lsin - jimgina o'tib ketmasin
  if (sendInfo.results.some(r => r.outcome === 'failed')) process.exitCode = 1;
}

module.exports = { evaluateFirm, sendPhase, main };
if (require.main === module) {
  main().then(() => process.exit(process.exitCode || 0)).catch(e => { console.error('XATOLIK:', e && e.stack || e); process.exit(1); });
}
