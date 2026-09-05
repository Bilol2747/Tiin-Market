// ─────────────────────────────────────────────────────────────────────────
// ZAKAS KUZATUVCHI AGENT — stok kam qolgan (ABC A/B, belgilangan kunlik
// chegaradan kam) tovarlarni ta'minotchi bo'yicha aniqlaydi va, so'ralganda,
// shu ta'minotchi uchun N kunlik tayyor zakas ro'yxatini tuzadi.
//
// MUHIM: zakas miqdorini hisoblash (necha kun qolgani, ABC xavfsizlik
// zaxirasi, karobka/quti o'lchamiga yaxlitlash) BU YERDA QAYTA YOZILMAGAN -
// sales_runtime.js'dagi (brauzer uchun yozilgan, lekin sof funksiya bo'lgan)
// _zkBuildSuppliers/_buildZItems va h.k. TO'G'RIDAN-TO'G'RI chaqiriladi
// (fayl oxiridagi eksport orqali). Sabab: bu turdagi hisobni qayta yozishga
// urinishda ilgari 46 baravar xato chiqqan edi - reja:
// C:\Users\User\.claude\plans\replicated-plotting-hoare.md
//
// Ishlatilishi:
//   node zakas/watch_agent.js --test              — aniqlashni CLI'da sinash
//   node zakas/watch_agent.js --mode=cron          — barcha yoqilgan chatlarni
//                                                     tekshirib, Telegram xabar
//                                                     yuboradi (GitHub Actions)
// Boshqa skript (telegram_bot_runner.js) `buildSupplierOrder`ni to'g'ridan-to'g'ri
// require qiladi (order_agent.js'dan namuna olingan naqsh).
// ─────────────────────────────────────────────────────────────────────────
const SITE_BASE = 'https://tiin-market.vercel.app';
const WATCH_ENDPOINT = `${SITE_BASE}/api/zakas-watch`;

// ── sales_runtime.js'ni Node'da yuklash uchun sodda DOM stub ───────────────
// `location.protocol="file:"` ATAYLAB tanlangan: sales_runtime.js ichidagi
// _zkStockOvEndpoint()/_zkDraftEndpoint() kabi funksiyalar shu holatda
// AVTOMATIK ravishda production absolute URL ishlatadi (xuddi shu fayl
// lokal file:// orqali ochilganda ishlagani kabi - bu ATAYLAB shunday
// yozilgan, biz o'ylab topgan narsa emas), va fon-yangilanish/setInterval
// (fayl oxirida) ishga tushmaydi - CLI skript hech qachon tugamay qolmasin.
function _fakeEl() {
  return new Proxy(function () {}, {
    get(target, prop) {
      if (prop === 'textContent') return '{}';
      if (prop === 'value') return '';
      if (prop === 'style') return _fakeEl();
      if (prop === 'classList') return { add() {}, remove() {}, contains() { return false; }, toggle() { return false; } };
      if (prop === 'dataset') return {};
      if (prop === 'then') return undefined;
      return function () { return _fakeEl(); };
    },
    set() { return true; },
    apply() { return _fakeEl(); },
  });
}
function _installDomStubs() {
  global.document = new Proxy({}, {
    get(target, prop) {
      if (prop === 'getElementById') return () => _fakeEl();
      if (prop === 'querySelector') return () => _fakeEl();
      if (prop === 'querySelectorAll') return () => [];
      if (prop === 'createElement') return () => _fakeEl();
      if (prop === 'activeElement') return null;
      if (prop === 'head' || prop === 'body') return _fakeEl();
      if (prop in target) return target[prop];
      return function () {};
    },
  });
  global.window = global;
  global.addEventListener = function () {};
  global.removeEventListener = function () {};
  global.location = { protocol: 'file:' };
  global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  global.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!global.navigator) global.navigator = { userAgent: 'node' };
}
_installDomStubs();
const path = require('path');
const RT = require(path.join(__dirname, '..', 'sales_runtime.js'));

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`);
  return r.json();
}

// ── Ma'lumotni bir marta yig'ish (P2+INVDATA+P8+zakas-draft+stock-override) ──
let _loaded = false;
async function ensureData() {
  if (_loaded) return;
  const [p2, invdata, kirim] = await Promise.all([
    fetchJson(`${SITE_BASE}/data_mahsulotlar.json`),
    fetchJson(`${SITE_BASE}/api/v1/invdata`),
    fetchJson(`${SITE_BASE}/api/v1/kirimdata`),
  ]);
  const apiData = { products: p2, inventory: invdata };
  await RT._ensureP2Data(apiData);
  RT.setP8(kirim);
  await RT._ensureStockOverrides();
  await RT._ensureZkDraft();
  await RT._enrichWithInventory(p2, apiData);
  RT._buildZItems();
  _loaded = true;
}

// ── Aniqlash: ABC A/B, belgilangan kundan kam qolgan, kategoriya filtriga mos ──
// (kategoriyalar bo'sh bo'lsa - hammasi tekshiriladi)
function detectUrgentSuppliers(thresholdDays, categories) {
  const items = RT.getZItems() || [];
  const cats = (categories || []).filter(Boolean);
  const bySup = {};
  for (const v of items) {
    if (v.zabc !== 'A' && v.zabc !== 'B') continue;
    if (v.daysLeft == null || v.daysLeft > thresholdDays) continue;
    if (cats.length && !cats.includes(v.catTop) && !cats.includes(v.cat)) continue;
    const sup = v.sup || RT.ZK_NO_SUPPLIER;
    (bySup[sup] = bySup[sup] || []).push({ sku: String(v.sku || v.name), name: v.name, daysLeft: v.daysLeft });
  }
  return Object.keys(bySup).sort((a, b) => a.localeCompare(b, 'ru')).map(supplier => ({
    supplier, items: bySup[supplier].sort((a, b) => a.daysLeft - b.daysLeft),
  }));
}

// ── Tanlangan ta'minotchi uchun N kunlik tayyor zakas ro'yxati ─────────────
// `days` FAQAT shu chaqiruv uchun (xotirada) qo'llaniladi - umumiy
// zakas-draft'dagi ta'minotchi maqsadli kuniga YOZILMAYDI (dashboarddagi
// "Maqsadli kun" sozlamasi buzilmasligi uchun, reja: bo'lim 2).
async function buildSupplierOrder(supplier, days) {
  await ensureData();
  const targets = RT.getZkSupTargets();
  const hadPrev = Object.prototype.hasOwnProperty.call(targets, supplier);
  const prevTarget = targets[supplier];
  targets[supplier] = Number(days) || RT.ZK_DEFAULT_TARGET;
  let rows;
  try {
    const normal = RT._zkBuildSuppliers('normal').find(s => s.sup === supplier);
    const deep = RT._zkBuildSuppliers('chuqur').find(s => s.sup === supplier);
    rows = [...(normal ? normal.rows : []), ...(deep ? deep.rows : [])];
  } finally {
    if (hadPrev) targets[supplier] = prevTarget; else delete targets[supplier];
  }
  return rows.filter(r => r.orderQty > 0).map(r => ({
    name: r.name, barcode: (r.bc && r.bc[0]) || '', qty: r.orderQty, price: r.rcost || r.price,
  }));
}

// ── zakas-watch (Turso, Vercel Python) bilan yengil aloqa ──────────────────
async function watchGet(action, params) {
  const qs = new URLSearchParams({ action, ...(params || {}) });
  const d = await fetchJson(`${WATCH_ENDPOINT}?${qs.toString()}`);
  if (!d.ok) throw new Error(d.error || 'zakas-watch GET xato');
  return d;
}
async function watchPost(body) {
  const r = await fetch(WATCH_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(d.error || 'zakas-watch POST xato');
  return d;
}

// ── Telegram (tgCall/sendMessage - telegram_bot_runner.js bilan bir xil naqsh) ──
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

function tashkentDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' }); // "YYYY-MM-DD"
}

// ── Cron rejimi: barcha yoqilgan chatlarni tekshirib, yangi/o'zgargan ──────
// shoshilinch ta'minotchilar uchun inline tugmali xabar yuboradi. Bir xil
// holat uchun kuniga ko'pi bilan bir marta (yoki shoshilinch SKU to'plami
// o'zgarganda) qayta xabar beriladi - zakas_watch_alert_state orqali.
async function runCron() {
  await ensureData();
  const { rows: chats } = await watchGet('settings_list');
  console.log(`${chats.length} ta yoqilgan chat topildi.`);
  for (const chat of chats) {
    const chatId = chat.chat_id;
    const groups = detectUrgentSuppliers(chat.threshold_days, chat.watched_categories);
    if (!groups.length) { console.log(`  chat ${chatId}: shoshilinch tovar yo'q.`); continue; }

    const { rows: alertState } = await watchGet('alert_state', { chat_id: chatId });
    const stateBySup = {}; alertState.forEach(r => { stateBySup[r.supplier] = r; });
    const today = tashkentDate();

    const toAlert = groups.filter(g => {
      const st = stateBySup[g.supplier];
      if (!st) return true;
      const curSkus = JSON.stringify(g.items.map(i => i.sku).sort());
      const prevSkus = JSON.stringify((st.last_sku_set || []).slice().sort());
      return st.last_alert_date !== today || curSkus !== prevSkus;
    });
    if (!toAlert.length) { console.log(`  chat ${chatId}: ${groups.length} ta ta'minotchi shoshilinch, lekin bugun/o'zgarishsiz allaqachon xabar berilgan.`); continue; }

    const tokenMap = {};
    const lines = ['🚨 Zakas tushdi! Quyidagi ta\'minotchilarda muhim (A/B) tovar tugashga yaqin:', ''];
    const buttons = [];
    toAlert.forEach((g, i) => {
      tokenMap[String(i)] = g.supplier;
      lines.push(`• ${g.supplier} — ${g.items.length} ta tovar (eng shoshilinchi: ${g.items[0].name}, ${g.items[0].daysLeft} kun qoldi)`);
      buttons.push([{ text: g.supplier.slice(0, 40), callback_data: `wsup:${i}` }]);
    });
    await tgCall('sendMessage', { chat_id: chatId, text: lines.join('\n'), reply_markup: { inline_keyboard: buttons } });
    await watchPost({ action: 'pending_set', chat_id: String(chatId), kind: 'alert_sent', token_map: tokenMap });
    for (const g of toAlert) {
      await watchPost({
        action: 'alert_state_set', chat_id: String(chatId), supplier: g.supplier,
        last_alert_date: today, last_sku_set: g.items.map(i => i.sku),
      });
    }
    console.log(`  chat ${chatId}: ${toAlert.length} ta ta'minotchi uchun xabar yuborildi.`);
  }
}

module.exports = { ensureData, detectUrgentSuppliers, buildSupplierOrder, runCron, SITE_BASE };

if (require.main === module) {
  (async () => {
    if (process.argv.includes('--test')) {
      await ensureData();
      const groups = detectUrgentSuppliers(Number(process.argv[process.argv.indexOf('--test') + 1]) || 5, []);
      console.log(JSON.stringify(groups, null, 1));
      return;
    }
    if (process.argv.includes('--mode=cron')) return runCron();
    console.log('Foydalanish: node zakas/watch_agent.js --test [kunlar] | --mode=cron');
  })().then(() => process.exit(0)).catch(e => { console.error('XATOLIK:', e.message); process.exit(1); });
}
