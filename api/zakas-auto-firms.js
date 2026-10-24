// ─────────────────────────────────────────────────────────────────
// Vercel Serverless Funksiya: DOIMIY ZAKAS NAZORATIGA olingan firmalar ro'yxati
// (2026-09-24, Bilol: "galochka qo'ygan firmalar qachondir yana tugab qolishi
// mumkin - har 3 soatda tekshirib tur").
//
// Sayt zakas sahifasida firma yonidagi katakchani BELGILAGANDA shu firma
// ro'yxatga qo'shiladi, belgini olganda - chiqariladi. `zakas/auto_control.js`
// (GitHub Actions, har ~3 soatda) FAQAT shu ro'yxatdagi firmalarni tekshiradi.
// "Hammasini tanlash" ro'yxatga HECH NARSA qo'shmaydi (frontendda ham, bu yerda ham
// faqat aniq firma nomlari qabul qilinadi).
//
// SAQLASH: Turso/Blob EMAS - repo'ning alohida `auto-data` branch'idagi bitta
// JSON fayl (`zakas_auto_firms.json`), GitHub Contents API orqali (api/telegram-webhook.js
// dagi `telegram-data` branch bilan bir xil naqsh: main'ga commit tushmaydi, shuning
// uchun Vercel qayta deploy qilmaydi - vercel.json'da `auto-data` uchun
// deploymentEnabled=false). Vercel Blob/Origin Transfer kvotasiga umuman tegmaydi.
//
// REJIM (avtomatik YUBORISH kaliti): xuddi shu branch'dagi `zakas_auto_mode.json`
// ({send, max_sum}). `send:false` (sukut) - nazorat FAQAT hisobot beradi; `send:true` -
// zakas/auto_control.js haqiqatan buyurtma yaratadi, Open qiladi va SMS yuboradi.
// Kalitni faqat ADMIN o'zgartira oladi (action "mode_set"); o'qish - har qanday kirgan foydalanuvchi.
//
// BELGISI OLIB TASHLANGAN TOVAR (2026-09-25, Bilol; 2-variant): firma sahifasida qatordan belgi olib tashlangan tovar
// (action "exclude") `zakas_auto_exclude.json`ga yoziladi: {"firms":{"<firma>":{"<sku>":"<qachondan ISO>"}}}.
// Belgisi olingan tovar O'ZI SABABLI buyurtma chiqara olmaydi (firmani "zakasga tushdi" qilmaydi), lekin firmaga boshqa
// tovar sababli buyurtma ketsa - u bilan BIRGA ketadi. Firmaga buyurtma berilgach (avtomat, sayt katakchasi yoki
// Invan'da qo'lda) belgi "ishlatilgan" bo'ladi va tovar oddiy tartibga qaytadi (zakas/auto_control.js tozalaydi);
// unutilgan belgi 14 kundan keyin o'zi tugaydi. "exclude_get" saytga faol belgilarni qaytaradi.
//
// XAVFSIZLIK: har so'rov sessiya tokeni bilan (api/auth.py dagi HMAC-SHA256
// token, SESSION_SECRET bilan bir xil imzo) - tokensiz/muddati o'tgan so'rov 401.
// Bu ro'yxat keyinchalik AVTOMATIK buyurtma yuborishga asos bo'ladi, shuning uchun
// ochiq qoldirilmaydi.
//
// Faqat Node built-in (fetch, crypto) - package.json yo'q (ataylab, boshqa api/*.js kabi).
//
// Environment Variables (Vercel):
//   SESSION_SECRET = api/auth.py bilan bir xil (allaqachon bor)
//   GITHUB_PAT     = api/telegram-webhook.js bilan bir xil (Contents: write)
// ─────────────────────────────────────────────────────────────────
const crypto = require("crypto");

const GITHUB_REPO = "Bilol2747/Tiin-Market";
const GITHUB_API = "https://api.github.com";
const DATA_BRANCH = "auto-data";
const DATA_FILE = "zakas_auto_firms.json";
const MODE_FILE = "zakas_auto_mode.json";
const EXCLUDE_FILE = "zakas_auto_exclude.json";
const MAX_EXCLUDE_SKUS = 500;
const tashkentDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
const MAX_CHANGES = 500;
const MAX_FIRMS = 1000;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// api/auth.py verify_token bilan AYNAN bir xil: "<payload_b64url>.<hmac_sha256_hex>"
function verifyToken(token) {
  const secret = (process.env.SESSION_SECRET || "").trim();
  if (!secret) throw new Error("SESSION_SECRET o'rnatilmagan");
  if (!token || typeof token !== "string" || token.indexOf(".") < 0) return null;
  const i = token.lastIndexOf(".");
  const payloadB64 = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac("sha256", secret).update(payloadB64).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")); }
  catch (_) { return null; }
  if (!payload || (payload.exp || 0) < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function ghToken() {
  const t = process.env.GITHUB_PAT;
  if (!t) throw new Error("GITHUB_PAT o'rnatilmagan");
  return t;
}

async function gh(path, opts, allow404) {
  const r = await fetch(GITHUB_API + path, {
    ...(opts || {}),
    headers: {
      Authorization: "Bearer " + ghToken(),
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
  });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch (_) { body = text; }
  if (r.status === 404 && allow404) return null;
  if (!r.ok) {
    const err = new Error(`GitHub ${path} -> ${r.status}: ${(typeof body === "string" ? body : JSON.stringify(body)).slice(0, 200)}`);
    err.status = r.status;
    throw err;
  }
  return body;
}

async function readFile(file, empty) {
  const f = await gh(`/repos/${GITHUB_REPO}/contents/${file}?ref=${DATA_BRANCH}`, {}, true);
  if (!f || !f.content) return { sha: null, data: empty() };
  let data;
  try { data = JSON.parse(Buffer.from(f.content, "base64").toString("utf8")); }
  catch (_) { data = empty(); }
  if (!data || typeof data !== "object") data = empty();
  return { sha: f.sha, data };
}
async function readState() {
  const st = await readFile(DATA_FILE, () => ({ firms: {} }));
  if (typeof st.data.firms !== "object" || st.data.firms === null) st.data.firms = {};
  return st;
}
async function readMode() {
  const st = await readFile(MODE_FILE, () => ({ send: false, max_sum: 0 }));
  st.data.send = st.data.send === true;
  st.data.max_sum = Number(st.data.max_sum) > 0 ? Number(st.data.max_sum) : 0;
  return st;
}

// Faol istisnolar: 14 kundan eskilari va eski (kunlik) format tashlab yuboriladi.
const EXCLUDE_TTL_MS = 14 * 86400000;
async function readExclude() {
  const st = await readFile(EXCLUDE_FILE, () => ({ firms: {} }));
  const f = st.data.firms;
  if (st.data.day || typeof f !== "object" || f === null || Array.isArray(f)) st.data = { firms: {} };
  const now = Date.now();
  for (const firm of Object.keys(st.data.firms)) {
    const m = st.data.firms[firm];
    if (!m || typeof m !== "object" || Array.isArray(m)) { delete st.data.firms[firm]; continue; }
    for (const sku of Object.keys(m)) if (!(now - Date.parse(m[sku]) < EXCLUDE_TTL_MS)) delete m[sku];
    if (!Object.keys(m).length) delete st.data.firms[firm];
  }
  return st;
}

// `auto-data` branch birinchi yozishdan oldin main'dan yaratiladi (bir marta).
async function ensureBranch() {
  const ref = await gh(`/repos/${GITHUB_REPO}/git/ref/heads/${DATA_BRANCH}`, {}, true);
  if (ref) return;
  const main = await gh(`/repos/${GITHUB_REPO}/git/ref/heads/main`);
  await gh(`/repos/${GITHUB_REPO}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${DATA_BRANCH}`, sha: main.object.sha }),
  });
}

async function writeState(data, sha, message, file) {
  const body = {
    message,
    content: Buffer.from(JSON.stringify(data, null, 2) + "\n", "utf8").toString("base64"),
    branch: DATA_BRANCH,
  };
  if (sha) body.sha = sha;
  return gh(`/repos/${GITHUB_REPO}/contents/${file || DATA_FILE}`, { method: "PUT", body: JSON.stringify(body) });
}

function firmList(data) {
  return Object.keys(data.firms).sort((a, b) => a.localeCompare(b, "ru"));
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Faqat POST" }); return; }
  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch (_) { body = {}; } }
    body = body || {};

    const user = verifyToken(String(body.token || ""));
    if (!user) { res.status(401).json({ ok: false, reason: "expired", error: "Sessiya yaroqsiz yoki muddati o'tgan" }); return; }

    const action = String(body.action || "get");
    if (action === "get") {
      const { data } = await readState();
      res.status(200).json({ ok: true, firms: firmList(data), updated_at: data.updated_at || null });
      return;
    }
    if (action === "mode_get") {
      const { data } = await readMode();
      res.status(200).json({ ok: true, send: data.send, max_sum: data.max_sum, by: data.by || "", at: data.at || null });
      return;
    }
    if (action === "mode_set") {
      // FAQAT admin: haqiqiy buyurtma/SMS yuborishni yoqadi/o'chiradi.
      if (user.role !== "admin") { res.status(403).json({ ok: false, error: "Faqat admin uchun" }); return; }
      const hasSend = typeof body.send === "boolean";
      const hasMax = body.max_sum !== undefined && body.max_sum !== null && body.max_sum !== "";
      const maxSum = Number(body.max_sum);
      if (!hasSend && !hasMax) { res.status(400).json({ ok: false, error: "send (true/false) yoki max_sum kerak" }); return; }
      if (hasMax && !(maxSum >= 0 && isFinite(maxSum))) { res.status(400).json({ ok: false, error: "max_sum >= 0 son bo'lishi kerak" }); return; }
      await ensureBranch();
      let lastMErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { sha, data } = await readMode();
        if (hasSend) data.send = body.send;
        if (hasMax) data.max_sum = maxSum;
        data.by = String(body.by || "").trim().slice(0, 120);
        data.uid = String(user.uid || "");   // kim o'zgartirgani - imzolangan tokendan (mijoz `by`iga ishonilmaydi)
        data.at = new Date().toISOString();
        try {
          await writeState(data, sha, `Zakas nazorati: rejim (send=${data.send}, max_sum=${data.max_sum})`, MODE_FILE);
          res.status(200).json({ ok: true, send: data.send, max_sum: data.max_sum, by: data.by, at: data.at });
          return;
        } catch (e) {
          lastMErr = e;
          if (e.status !== 409 && e.status !== 422) throw e;
        }
      }
      throw lastMErr || new Error("Yozib bo'lmadi");
    }
    if (action === "exclude_get") {
      const { data } = await readExclude();
      const firms = {};
      for (const firm of Object.keys(data.firms)) firms[firm] = Object.keys(data.firms[firm]);
      res.status(200).json({ ok: true, firms });
      return;
    }
    if (action === "exclude") {
      // {"firm": "Firma A", "skus": ["123", ...]} - firmaning belgisi olingan tovarlar ro'yxatini ALMASHTIRADI (bo'sh = o'chadi).
      // Ro'yxatda avvaldan bor tovarning "qachondan" vaqti SAQLANADI, yangilariga hozirgi vaqt qo'yiladi.
      const firm = String(body.firm || "").trim();
      if (!firm || firm.length > 200) { res.status(400).json({ ok: false, error: "firm kerak" }); return; }
      if (!Array.isArray(body.skus)) { res.status(400).json({ ok: false, error: "skus (ro'yxat) kerak" }); return; }
      if (body.skus.length > MAX_EXCLUDE_SKUS) { res.status(400).json({ ok: false, error: "skus juda ko'p" }); return; }
      const skus = [];
      for (const x of body.skus) {
        if (typeof x !== "string" && typeof x !== "number") { res.status(400).json({ ok: false, error: "sku satr bo'lishi kerak" }); return; }
        const v = String(x).trim();
        if (!v || v.length > 60) { res.status(400).json({ ok: false, error: "sku 1-60 belgi bo'lishi kerak" }); return; }
        if (!skus.includes(v)) skus.push(v);
      }
      // Faqat hozir nazoratda turgan firma (boshqa nomlar bilan faylni to'ldirib bo'lmasin).
      const { data: fdata } = await readState();
      if (!Object.prototype.hasOwnProperty.call(fdata.firms, firm)) { res.status(400).json({ ok: false, error: "firma doimiy nazoratda emas" }); return; }
      await ensureBranch();
      let lastXErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const nowIso = new Date().toISOString();
        const { sha, data } = await readExclude();
        const prevM = data.firms[firm] || {};
        const next = {};
        skus.forEach(k => { next[k] = prevM[k] || nowIso; });
        const same = JSON.stringify(Object.keys(prevM).sort()) === JSON.stringify(Object.keys(next).sort());
        if (Object.keys(next).length) data.firms[firm] = next; else delete data.firms[firm];
        if (same) { res.status(200).json({ ok: true, firm, count: skus.length }); return; }   // o'zgarish yo'q - commit qilinmaydi
        data.updated_at = nowIso;
        try {
          await writeState(data, sha, `Zakas nazorati: belgisi olingan tovarlar (${firm}: ${skus.length} ta)`, EXCLUDE_FILE);
          res.status(200).json({ ok: true, firm, count: skus.length });
          return;
        } catch (e) {
          lastXErr = e;
          if (e.status !== 409 && e.status !== 422) throw e;
        }
      }
      throw lastXErr || new Error("Yozib bo'lmadi");
    }
    if (action !== "set") { res.status(400).json({ ok: false, error: "action: get, set, exclude, exclude_get, mode_get yoki mode_set" }); return; }

    // {"changes": {"Firma A": true, "Firma B": false}} - true = nazoratga olinadi, false = chiqariladi.
    const changes = body.changes;
    if (!changes || typeof changes !== "object" || Array.isArray(changes) || !Object.keys(changes).length) {
      res.status(400).json({ ok: false, error: "changes (obyekt) kerak" }); return;
    }
    if (Object.keys(changes).length > MAX_CHANGES) { res.status(400).json({ ok: false, error: "changes juda ko'p" }); return; }
    const by = String(body.by || "").trim().slice(0, 120);

    await ensureBranch();
    // Parallel yozuvlar (ikki qurilma bir vaqtda) - sha mos kelmasa qayta o'qib, o'zgarishni qayta qo'llaymiz.
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { sha, data } = await readState();
      const now = new Date().toISOString();
      for (const name of Object.keys(changes)) {
        const firm = String(name).trim();
        if (!firm || firm.length > 200) continue;
        // `at` - zakas/auto_control.js shu Toshkent kuni qo'lda (katakcha bilan) buyurtma berilgan deb,
        // firmani bugun avtomatik yubormaydi (jonli kirim ma'lumoti 15+ daqiqa kechikadi).
        // `uid` - imzolangan sessiya tokenidan (`by` - faqat ko'rsatish uchun ism, mijozdan keladi).
        if (changes[name] === true) data.firms[firm] = { by, uid: String(user.uid || ""), at: now };
        else if (changes[name] === false) delete data.firms[firm];
      }
      if (Object.keys(data.firms).length > MAX_FIRMS) { res.status(400).json({ ok: false, error: "firmalar soni chegaradan oshdi" }); return; }
      data.updated_at = now;
      try {
        await writeState(data, sha, `Zakas nazorati: ro'yxat yangilandi (${Object.keys(changes).length} ta o'zgarish)`);
        res.status(200).json({ ok: true, firms: firmList(data), updated_at: now });
        return;
      } catch (e) {
        lastErr = e;
        if (e.status !== 409 && e.status !== 422) throw e;
      }
    }
    throw lastErr || new Error("Yozib bo'lmadi");
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e && e.message || e) });
  }
};
