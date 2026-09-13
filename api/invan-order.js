// ─────────────────────────────────────────────────────────────────────────
// Vercel Serverless Funksiya: Zakas → Invan'ga buyurtma yuborish
// ─────────────────────────────────────────────────────────────────────────
// Sayt (Zakas bo'limi) belgilangan tovarlarni shu funksiyaga yuboradi.
// Funksiya Invan API'ga ulanib (token/login MAXFIY — Environment Variables'da,
// brauzerga chiqmaydi) supplier_order yaratadi va tovarlarni qo'shadi.
// Buyurtma "Yangi" (qoralama) holatida yaratiladi — menejer Invan'da ko'rib,
// o'zi Open/tasdiqlaydi. AVTOMATIK yuborilmaydi.
//
// Ikki rejim (INVAN_ENV):
//   "demo" (standart) — dev.api.7i.uz, telefon+parol login (test uchun)
//   "prod"            — api.7i.uz, static token (real do'kon uchun)
//
// Kerakli Environment Variables (Vercel → Settings → Environment Variables):
//   INVAN_ENV            = demo   (yoki prod)
//   -- demo uchun:
//   INVAN_DEMO_PHONE     = 998777772122
//   INVAN_DEMO_PASS      = ******
//   INVAN_DEMO_SUPPLIER  = 7a31c10b-532d-40c9-9cf1-3a92d6bb091c  (ixtiyoriy, standart shu)
//   -- prod uchun:
//   INVAN_TOKEN          = <static token>
//   INVAN_PROD_SHOP      = aa954511-3801-46f8-a0bd-d41fa7e40369
//   -- ixtiyoriy himoya (sayt bilan funksiya orasida umumiy maxfiy so'z):
//   INVAN_BRIDGE_SECRET  = <istalgan uzun so'z>
// ─────────────────────────────────────────────────────────────────────────

// Ta'minotchi nomi -> HAQIQIY Invan supplier_id (data_kirim.json'dan bir martalik
// ajratilgan, 686 ta'minotchi - live qidiruv endpointi tasdiqlanmagani uchun
// bizning REAL, tasdiqlangan sinxronizatsiya ma'lumotidan foydalanamiz, taxmin
// qilinadigan API o'rniga. Yangilash: shu faylni build_all_from_api.py pipeline'ga
// qo'shish kerak (hozircha qo'lda, 2026-07-23 holati).
const SUPPLIER_ID_MAP = require("./_supplier_id_map.json");

const CFG = {
  demo: {
    base: "https://dev.api.7i.uz",
    shop: "fc0a3ed0-b8ce-4445-a8c9-7f0c077d1741",     // MaxiBoom demo do'koni
    defSupplier: process.env.INVAN_DEMO_SUPPLIER || "7a31c10b-532d-40c9-9cf1-3a92d6bb091c",
  },
  prod: {
    base: "https://api.7i.uz",
    shop: process.env.INVAN_PROD_SHOP || "aa954511-3801-46f8-a0bd-d41fa7e40369", // Tiin Optom
    defSupplier: null, // prod'da supplier_id frontend'dan (real) keladi
  },
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-bridge-secret");
}

async function invan(base, path, opts, token) {
  const headers = { "Content-Type": "application/json", "Timezone": "300" };
  if (token) headers["Authorization"] = "Bearer " + token;
  const r = await fetch(base + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!r.ok) {
    const msg = (body && body.error) || (body && body.message) || text || ("HTTP " + r.status);
    const err = new Error(`Invan ${path} -> ${r.status}: ${msg}`);
    err.status = r.status;
    throw err;
  }
  return body;
}

// JWT payload'ni (imzoni tekshirmasdan) o'qiydi - faqat tabriknoma uchun ism
// olishga urinamiz, xavfsizlik qarori BUNGA tayanmaydi (imzo Invan'ning o'zida
// tekshiriladi, biz faqat token'ni shaffof o'tkazamiz).
function decodeJwtName(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length < 2) return "";
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const p = JSON.parse(json);
    return p.name || p.full_name || p.fullName || p.employee_name || "";
  } catch { return ""; }
}

function normPhone(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 9) d = "998" + d;
  return d;
}

// Demo: telefon+parol bilan login → token. Prod: static token.
async function getToken(env) {
  if (env === "prod") {
    const t = process.env.INVAN_TOKEN;
    if (!t) throw new Error("INVAN_TOKEN o'rnatilmagan (prod rejim)");
    return t;
  }
  const phone = process.env.INVAN_DEMO_PHONE, pass = process.env.INVAN_DEMO_PASS;
  if (!phone || !pass) throw new Error("INVAN_DEMO_PHONE / INVAN_DEMO_PASS o'rnatilmagan (demo rejim)");
  const r = await invan(CFG.demo.base, "/auth/login", {
    method: "POST", body: JSON.stringify({ phone_number: phone, password: pass }),
  });
  if (!r.token) throw new Error("Login token qaytarmadi");
  return r.token;
}

// SKU/barcode -> {product_id, product_type} ni MAHALLIY indeksdan (aniq,
// fuzzy emas) topadi. Avval BARCODE (foydalanuvchi qo'lda ham aynan shu
// usulda ishlaydi - eng ishonchli), keyin SKU bo'yicha.
//
// ESKI USUL (Invan'ning jonli qidiruv endpointi, top-5 natija) ISHLATILMAYDI:
// u ko'p tovarni "topolmay" tashlab ketardi - masalan qisqa SKU "50" bo'yicha
// 27,000+ mos natija qaytadi, haqiqiy tovar top-5'ga kirmay qoladi (2026-07-28
// aniqlangan xato). Bundan tashqari o'sha kod `hit.product_type` (mavjud
// bo'lmagan maydon) o'qirdi - to'g'ri nomi `product_type_id`, shu sabab
// product_type doim standart 1'ga tushib qolardi.
//
// Indeks fayli (api/_product_match_index.json) build_invan_match_index.py
// bilan mahalliy api_raw_products.json'dan qurilgan, hozircha QO'LDA
// yangilanadi (_supplier_id_map.json bilan bir xil naqsh).
const MATCH_INDEX = require("./_product_match_index.json");

function resolveProductLocal(sku, barcodes) {
  const bcList = Array.isArray(barcodes) ? barcodes : (barcodes ? [barcodes] : []);
  for (const bc of bcList) {
    const b = String(bc || "").trim();
    if (!b) continue;
    const hit = MATCH_INDEX.byBarcode[b];
    if (hit) return { product_id: hit.id, product_type: hit.type != null ? hit.type : 1 };
  }
  const s = String(sku || "").trim();
  if (s) {
    const hit = MATCH_INDEX.bySku[s];
    if (hit) return { product_id: hit.id, product_type: hit.type != null ? hit.type : 1 };
  }
  return null;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const defaultEnv = (process.env.INVAN_ENV || "demo").toLowerCase();

  if (req.method === "GET") {
    const cfg = CFG[defaultEnv] || CFG.demo;
    res.status(200).json({ ok: true, env: defaultEnv, shop: cfg.shop, msg: "Invan buyurtma ko'prigi tayyor" });
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Faqat POST" }); return; }

  // Ixtiyoriy umumiy maxfiy so'z tekshiruvi
  const secret = process.env.INVAN_BRIDGE_SECRET;
  if (secret && req.headers["x-bridge-secret"] !== secret) {
    res.status(401).json({ ok: false, error: "Ruxsat yo'q (secret mos emas)" }); return;
  }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body || "{}");
    body = body || {};

    // Frontend ikkita tugma orqali tanlaydi ("target": "demo"|"prod") - server
    // o'zining standart (INVAN_ENV) qiymatiga TUSHMAYDI, mijoz aniq so'ragan
    // muhitga ulanadi. "prod" INVAN_TOKEN sozlanmaguncha getToken() aniq xato
    // bilan to'xtaydi - noto'g'ri/yarim buyurtma yaratilmaydi.
    const env = (body.target === "prod" ? "prod" : body.target === "demo" ? "demo" : defaultEnv);
    const cfg = CFG[env] || CFG.demo;

    // Foydalanuvchi o'z Invan telefon+paroli bilan "kirish" so'ragan bo'lsa - shu
    // yerda alohida ishlanadi (buyurtma yaratmaydi, faqat login qilib token qaytaradi).
    // MAQSAD: barcha buyurtmalar bitta umumiy (statik) hisob emas, HAQIQIY yuborgan
    // odamning shaxsiy Invan hisobidan yaratilsin (foydalanuvchi so'rovi, 2026-07-25 -
    // avval hammasi bitta xodim nomidan ketayotgani muammo bo'lgan edi).
    if (body.action === "login") {
      const phone = normPhone(body.phone), password = String(body.password || "");
      if (!phone || !password) { res.status(400).json({ ok: false, error: "Telefon va parol kiriting" }); return; }
      const r = await invan(cfg.base, "/auth/login", {
        method: "POST", body: JSON.stringify({ phone_number: phone, password }),
      });
      if (!r.token) { res.status(401).json({ ok: false, error: "Login token qaytmadi" }); return; }
      res.status(200).json({ ok: true, token: r.token, name: decodeJwtName(r.token) });
      return;
    }

    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) { res.status(400).json({ ok: false, error: "items bo'sh" }); return; }

    // Shaxsiy token (foydalanuvchi o'z hisobi bilan kirgan) bo'lsa - SHU ishlatiladi,
    // shunda Invan'da buyurtma "yaratuvchisi" haqiqatda yuborgan odam bo'ladi, umumiy
    // integratsiya hisobi emas. Bo'lmasa (masalan hali shaxsiy login qilinmagan) -
    // eski umumiy token/login'ga tushadi (orqaga moslik uchun).
    const token = body.invan_token ? String(body.invan_token) : await getToken(env);

    // supplier_id: prod'da mahalliy REAL xaritadan (SUPPLIER_ID_MAP, ta'minotchi
    // nomi orqali - bizning nom bazamiz Invan'ning haqiqiy nomi bilan bir xil,
    // PO19153 misolida harfma-harf tasdiqlangan), demo'da standart demo supplier.
    const supplierId = body.supplier_id
      || (env === "prod" ? SUPPLIER_ID_MAP[String(body.supplier_name || "").trim()] : null)
      || cfg.defSupplier;
    if (!supplierId) {
      const msg = env === "prod"
        ? `Ta'minotchi "${body.supplier_name || ""}" mahalliy xaritada topilmadi (hali bu ta'minotchidan kirim bo'lmagan bo'lishi mumkin)`
        : "supplier_id aniqlanmadi";
      res.status(400).json({ ok: false, error: msg }); return;
    }

    // 1) SKU/barcode → product_id (mahalliy indeksdan, tarmoq so'rovi yo'q)
    const resolved = items.map(it => ({ it, prod: resolveProductLocal(it.sku, it.bc) }));
    const mapped = resolved.filter(x => x.prod);
    const unmapped = resolved.filter(x => !x.prod).map(x => ({
      sku: String(x.it.sku || ""),
      name: String(x.it.name || ""),
      bc: Array.isArray(x.it.bc) ? x.it.bc : (x.it.bc ? [x.it.bc] : []),
      qty: Number(x.it.qty) || 0,
    }));
    if (!mapped.length) {
      res.status(422).json({ ok: false, error: "Hech bir tovar Invan katalogida topilmadi", unmapped });
      return;
    }

    // 2) Buyurtma yaratish (qoralama)
    const expected = body.expected_date || new Date().toISOString().slice(0, 10) + "T00:00:00Z";
    const created = await invan(cfg.base, "/api/v1/supplier_order_new", {
      method: "POST",
      body: JSON.stringify({
        supplier_id: supplierId, shop_id: cfg.shop, expected_date: expected,
        comment: body.comment || "Tiin dashboard zakas", invoice_number: body.invoice_number || "",
      }),
    }, token);
    const orderId = created.id || (created.data && created.data.id);
    const po = created.value || created.external_id || "";
    if (!orderId) throw new Error("Buyurtma id qaytmadi");

    // 3) Tovarlarni qo'shish
    // MUHIM: Invan bitta so'rovda BIR XIL product_id'ni ikki marta upsert qila
    // olmaydi - "pq: ON CONFLICT DO UPDATE command cannot affect row a second
    // time" xatosi bilan butun buyurtma qulaydi (foydalanuvchi topilmasi,
    // 2026-07-25: "Hujjatdan buyurtma"da ikkita qator bir xil shtrix-kodga -
    // demak bir xil mahsulotga - moslashgani sabab yuz berdi). Shu sabab
    // product_id bo'yicha birlashtiramiz: miqdorlar QO'SHILADI, narx esa
    // miqdor bo'yicha o'rtachalanadi (jami summa o'zgarmasin uchun).
    const byProduct = new Map();
    for (const { it, prod } of mapped) {
      const qty = Number(it.qty) || 0, cost = Number(it.cost) || 0;
      const ex = byProduct.get(prod.product_id);
      if (ex) {
        const totalCost = ex.cost * ex.expected_amount + cost * qty;
        ex.expected_amount += qty;
        ex.cost = ex.expected_amount ? totalCost / ex.expected_amount : cost;
      } else {
        // MAYDON NOMI supplier_order_multiple_items so'rovida product_type_id,
        // product_type EMAS - 2026-07-31 zakas/order_agent.js orqali birinchi
        // REAL yozuvda HTTP 400 "invalid body" bilan aniqlandi va tuzatildi.
        // Bu fayl o'zi hali real yozuv bilan sinalmagan edi, xuddi shu xato bor edi.
        byProduct.set(prod.product_id, { product_id: prod.product_id, expected_amount: qty, cost, product_type_id: prod.product_type, return_amount: 0 });
      }
    }
    const payloadItems = [...byProduct.values()];
    await invan(cfg.base, "/api/v1/supplier_order_multiple_items", {
      method: "POST",
      body: JSON.stringify({ supplier_order_id: orderId, items: payloadItems }),
    }, token);

    res.status(200).json({
      ok: true, env, po, order_id: orderId,
      added: payloadItems.length, unmapped,
      mapped: mapped.map(({ it, prod }) => ({ sku: it.sku, qty: it.qty, product_id: prod.product_id })),
    });
  } catch (e) {
    // 401 - token (shaxsiy yoki umumiy) yaroqsiz/eskirgan - frontend buni ko'rib,
    // saqlangan shaxsiy tokenni tozalab, qayta login so'raydi.
    const status = e && e.status === 401 ? 401 : 500;
    res.status(status).json({ ok: false, error: String(e && e.message || e), token_expired: status === 401 });
  }
};
