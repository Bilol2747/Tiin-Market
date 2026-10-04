// ─────────────────────────────────────────────────────────────────────────
// Vercel Serverless Funksiya: Telegram bot webhook (Zakas guruhi)
// ─────────────────────────────────────────────────────────────────────────
// Telegram'dan kelayotgan yangilanishlarni (guruh xabarlari) qabul qiladi.
// BOSQICH 2: Excel fayl (.xlsx/.xls) kelsa — GitHub repo'ga commit qilib,
// `.github/workflows/telegram_zakas.yml`ni (workflow_dispatch) ishga
// tushiradi. "ha"/"yo'q" javobi kelsa — confirm/cancel sifatida xuddi shu
// workflow'ga uzatiladi. Og'ir ish (Excel parslash, Invan'ga yozish) BU
// YERDA EMAS — GitHub Actions'da (`zakas/telegram_bot_runner.js`).
//
// `api/invan-order.js` bilan bir xil qoida: FAQAT Node built-in (fetch) —
// npm bog'liqlik yo'q, chunki repo'da package.json yo'q (ataylab, Vercel
// zero-config rejimini buzmaslik uchun — zakas/README.md'ga qarang).
//
// Kerakli Environment Variables (Vercel → Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN      = MAJBURIY — bot tokeni.
//   GITHUB_PAT              = MAJBURIY — fine-grained PAT, FAQAT shu repo'ga
//                             "Contents: write" + "Actions: write" huquqi bilan.
//   TELEGRAM_WEBHOOK_SECRET = (ixtiyoriy — setWebhook'dagi secret_token bilan bir xil
//                              bo'lishi kerak, Telegram'dan kelmagan so'rovlarni chetlatadi)
// Reja: C:\Users\User\.claude\plans\crystalline-sauteeing-scone.md
// ─────────────────────────────────────────────────────────────────────────

const GITHUB_REPO = "Bilol2747/Tiin-Market";
const GITHUB_API = "https://api.github.com";
const XLSX_RE = /\.(xlsx|xls)$/i;
// Tasdiq/bekor so'zlari. Ro'yxat 2026-08-04 da kengaytirildi: foydalanuvchi
// "zakas ber" deb yozgan, u ro'yxatda yo'q edi va bot (tanimagan matnga ataylab
// javob bermagani uchun) jim qolgan - tashqaridan "bot to'xtab qolgan"dek
// ko'rinardi. Tabiiy aytilishi mumkin bo'lgan iboralar ham qo'shildi.
const YES_RE = /^(ha|ha\.|xa|xa\.|hop|mayli|ok|okay|yes|tasdiq|tasdiqla|tasdiqlayman|tasdiqlaymiz|davom|davom et|yarat|zakas ber|zakas bering|zakas berila|buyurtma ber|buyurtma bering|buyurtma yarat)$/i;
const NO_RE = /^(yo'q|yoq|yo'q\.|yoq\.|bekor|bekor qil|bekor qiling|kerakmas|kerak emas|to'xta|toxta|cancel|no)$/i;

function botToken() {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error("TELEGRAM_BOT_TOKEN o'rnatilmagan");
  return t;
}
function githubToken() {
  const t = process.env.GITHUB_PAT;
  if (!t) throw new Error("GITHUB_PAT o'rnatilmagan");
  return t;
}

async function tgCall(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${botToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method} -> ${JSON.stringify(data).slice(0, 300)}`);
  return data.result;
}
function sendMessage(chatId, text) {
  return tgCall("sendMessage", { chat_id: chatId, text });
}

async function tgDownloadFile(fileId) {
  const info = await tgCall("getFile", { file_id: fileId });
  const url = `https://api.telegram.org/file/bot${botToken()}/${info.file_path}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Telegram fayl yuklab bo'lmadi: HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function ghApi(path, opts) {
  const r = await fetch(GITHUB_API + path, {
    ...(opts || {}),
    headers: {
      Authorization: "Bearer " + githubToken(),
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...((opts && opts.headers) || {}),
    },
  });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  if (!r.ok) {
    const detail = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(`GitHub ${path} -> ${r.status}: ${detail.slice(0, 300)}`);
  }
  return body;
}

// Contents API yo'lida "/" harflari LITERAL qolishi kerak (papka bo'linishi),
// faqat har bir segment o'zi encode qilinadi.
function encodeRepoPath(p) {
  return p.split("/").map(encodeURIComponent).join("/");
}

// `main`ga EMAS — alohida `telegram-data` branch'iga commit qilinadi.
// Sabab: har Excel yuklanganda `main`ga commit tushsa, Vercel HAR SAFAR
// butun saytni qayta deploy qiladi va kunlik deploy kvotasini (Hobby tarif)
// tezda tugatib qo'yadi (2026-08-01 aniqlandi — [[project-telegram-zakas-bot]]).
// `vercel.json`da shu branch uchun `git.deploymentEnabled: false` qilingan.
const DATA_BRANCH = "telegram-data";

async function commitFileToRepo(repoPath, buf, message) {
  return ghApi(`/repos/${GITHUB_REPO}/contents/${encodeRepoPath(repoPath)}`, {
    method: "PUT",
    body: JSON.stringify({ message, content: buf.toString("base64"), branch: DATA_BRANCH }),
  });
}

async function dispatchWorkflow(inputs) {
  await ghApi(`/repos/${GITHUB_REPO}/actions/workflows/telegram_zakas.yml/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: "main", inputs }),
  });
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({ ok: true, msg: "Telegram webhook tayyor (bosqich 2: fayl + tasdiq)" });
    return;
  }
  if (req.method !== "POST") { res.status(405).json({ ok: false, error: "Faqat POST" }); return; }

  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expectedSecret && req.headers["x-telegram-bot-api-secret-token"] !== expectedSecret) {
    res.status(401).json({ ok: false, error: "Ruxsat yo'q" });
    return;
  }

  try {
    let update = req.body;
    if (typeof update === "string") update = JSON.parse(update || "{}");
    update = update || {};

    const msg = update.message;
    // Telegram javobni kutmaydi (webhook - fire and forget), shuning uchun
    // xato bo'lsa ham 200 qaytaramiz - aks holda Telegram qayta-qayta urinib,
    // bir xil xabarni bir necha marta yuborishi mumkin.
    if (msg && msg.chat) {
      const chatId = msg.chat.id;
      try {
        if (msg.document && XLSX_RE.test(msg.document.file_name || "")) {
          const fname = msg.document.file_name;
          await sendMessage(chatId, `📄 "${fname}" qabul qildim, tekshiryapman (biroz vaqt oladi)...`);
          const buf = await tgDownloadFile(msg.document.file_id);
          const repoPath = `zakas/telegram_incoming/${chatId}_${msg.message_id}_${fname}`;
          await commitFileToRepo(repoPath, buf, `Telegram zakas fayli: ${fname} (chat ${chatId})`);
          await dispatchWorkflow({
            chat_id: String(chatId), message_id: String(msg.message_id),
            kind: "new_file", file_path: repoPath,
          });
        } else if (msg.document) {
          await sendMessage(chatId, "Faqat .xlsx/.xls Excel fayl qabul qilaman.");
        } else if (typeof msg.text === "string") {
          const t = msg.text.trim();
          if (YES_RE.test(t)) {
            await dispatchWorkflow({ chat_id: String(chatId), kind: "confirm" });
          } else if (NO_RE.test(t)) {
            await dispatchWorkflow({ chat_id: String(chatId), kind: "cancel" });
          } else if (/zakas|buyurtma|tasdiq/i.test(t) && t.length <= 60) {
            // Niyat aniq (zakas/buyurtma haqida yozyapti), lekin so'z ro'yxatga
            // tushmadi - jim qolish o'rniga nima yozish kerakligini aytamiz
            // (2026-08-04: "zakas ber" javobsiz qolgani shu yerdan chiqqan).
            await sendMessage(chatId,
              'Tushunmadim. Tasdiqlash uchun "ha", bekor qilish uchun "yo\'q" deb yozing.');
          }
          // Qolgan oddiy xabarlarga javob qaytarmaymiz - guruh suhbatiga aralashmaslik uchun.
        }
      } catch (inner) {
        // Avval bu yerdagi xato faqat server logiga yozilib, foydalanuvchi
        // hech qachon bilmasdan "jim qolib ketardi" (2026-08-01 aniqlandi) -
        // endi guruhga ham aniq xabar boradi.
        console.error("telegram-webhook ichki xatolik:", inner && inner.message);
        try { await sendMessage(chatId, `⚠️ Xatolik chiqdi: ${inner && inner.message || inner}`); } catch { /* Telegram ham ishlamasa qila olmaymiz */ }
      }
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("telegram-webhook xatolik:", e && e.message);
    res.status(200).json({ ok: false, error: String(e && e.message || e) });
  }
};
