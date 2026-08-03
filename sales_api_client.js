/* ============================================================================
 * sales_api_client.js — yangi backend (backend/app.py) bilan ishlash.
 *
 * ASOSIY TAMOYIL: FALLBACK. Har bir so'rov avval API'ga uriladi; API yo'q,
 * o'chirilgan yoki xato bersa — `null` qaytariladi va chaqiruvchi tomon
 * ESKI usulda (data_*.json fayllardan) o'qiydi. Shu sababli:
 *   - server ishlamay qolsa ham sayt ishlashda davom etadi
 *   - bo'limlarni BIRMA-BIR ko'chirish mumkin, hammasini birdan emas
 *   - orqaga qaytarish uchun kodni o'zgartirish shart emas
 *
 * MANZILNI SOZLASH (birinchi topilgani ishlatiladi):
 *   1. localStorage.tiinApiBase   — brauzer konsolidan sinov uchun eng qulay:
 *        localStorage.tiinApiBase = "http://127.0.0.1:8000/api/v1"
 *        localStorage.removeItem("tiinApiBase")   // o'chirish
 *   2. window.TIIN_API_BASE       — HTML'da <script> orqali
 *   3. <meta name="tiin-api-base" content="...">
 *   4. Avtomatik: lokal muhitda (localhost / 127.0.0.1 / file://) →
 *      http://127.0.0.1:8000/api/v1
 *   5. Aks holda "/api/v1" (server sayt bilan bir domenda bo'lsa)
 *
 * O'CHIRISH: localStorage.tiinApiOff = "1"  → hamma so'rov o'tkazib
 * yuboriladi, sayt to'liq eski usulda ishlaydi.
 * ========================================================================== */
(function () {
  var TIMEOUT_MS = 12000;      // katta tuzilmalar (invdata ~1.3 MB) uchun yetarli
  var HEALTH_TIMEOUT_MS = 2500; // "server bormi" tekshiruvi tez bo'lishi kerak

  function detectBase() {
    try {
      var ls = window.localStorage && localStorage.getItem("tiinApiBase");
      if (ls) return ls.replace(/\/+$/, "");
    } catch (e) { /* localStorage bloklangan bo'lishi mumkin */ }
    if (window.TIIN_API_BASE) return String(window.TIIN_API_BASE).replace(/\/+$/, "");
    var meta = document.querySelector('meta[name="tiin-api-base"]');
    if (meta && meta.content) return meta.content.replace(/\/+$/, "");
    var h = location.hostname;
    if (location.protocol === "file:" || h === "localhost" || h === "127.0.0.1") {
      return "http://127.0.0.1:8000/api/v1";
    }
    return "/api/v1";
  }

  function isOff() {
    try { return localStorage.getItem("tiinApiOff") === "1"; } catch (e) { return false; }
  }

  var BASE = detectBase();
  var _healthPromise = null;   // bir marta tekshiriladi, natija keshlanadi

  function request(path, timeoutMs) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs || TIMEOUT_MS);
    return fetch(BASE + path, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    }).finally(function () { clearTimeout(timer); });
  }

  /* Server bormi? Bir marta so'raladi, javob keshlanadi.
     Muhim: pipeline hali hisoblanmagan bo'lsa (`ready:false`) ham API'ni
     "yo'q" deb hisoblaymiz — chala ma'lumot ko'rsatgandan ko'ra eski,
     lekin to'liq faylni ishlatish xavfsizroq. */
  function health() {
    if (isOff()) return Promise.resolve(false);
    if (_healthPromise) return _healthPromise;
    _healthPromise = request("/pipeline/status", HEALTH_TIMEOUT_MS)
      .then(function (d) { return !!(d && d.ready); })
      .catch(function () { return false; });
    return _healthPromise;
  }

  /* Asosiy yordamchi: API'dan olishga urinadi, bo'lmasa null.
     HECH QACHON xato tashlamaydi — chaqiruvchi tomon `null` ni ko'rib
     eski yo'lga o'tadi. */
  function tryGet(path) {
    return health().then(function (ok) {
      if (!ok) return null;
      return request(path).catch(function (e) {
        if (window.console && console.debug) {
          console.debug("[TiinAPI] " + path + " olinmadi:", e && e.message);
        }
        return null;
      });
    });
  }

  window.TiinDataAPI = {
    get base() { return BASE; },
    setBase: function (v) {
      BASE = String(v).replace(/\/+$/, "");
      _healthPromise = null;          // yangi manzil — qayta tekshiriladi
      return BASE;
    },
    health: health,
    reset: function () { _healthPromise = null; },

    /* ── Mavjud hisob kodlari natijasi (backend/pipeline_runner.py) ──
       Qaytadigan tuzilmalar ESKI data_*.json fayllari bilan AYNAN bir xil,
       chunki ular o'sha build_* funksiyalarining o'zidan chiqadi. */
    p1data:        function () { return tryGet("/p1data"); },
    dailydata:     function () { return tryGet("/dailydata"); },
    history:       function () { return tryGet("/history"); },
    stockSnapshot: function () { return tryGet("/stock_snapshot"); },
    p2data:        function () { return tryGet("/p2data"); },
    p3data:        function () { return tryGet("/p3data"); },
    invdata:       function () { return tryGet("/invdata"); },
    supplierdata:  function () { return tryGet("/supplierdata"); },
    kirimSummary:  function () { return tryGet("/kirimdata/summary"); },
    kirimdata:     function () { return tryGet("/kirimdata"); },
    kirimBySku:    function (sku) { return tryGet("/kirimdata?sku=" + encodeURIComponent(sku)); },
    status:        function () { return tryGet("/pipeline/status"); },

    /* ── Baza kesimidagi sahifalangan so'rovlar (kelajakda katta
       ro'yxatlarni bo'lib yuklash uchun; hozircha ishlatilmaydi) ── */
    products: function (q) {
      var p = new URLSearchParams(q || {}).toString();
      return tryGet("/products" + (p ? "?" + p : ""));
    },
    search:   function (q, limit) {
      return tryGet("/search?q=" + encodeURIComponent(q) + "&limit=" + (limit || 20));
    },
    dashboard: function (from, to) {
      var p = [];
      if (from) p.push("from=" + from);
      if (to) p.push("to=" + to);
      return tryGet("/dashboard" + (p.length ? "?" + p.join("&") : ""));
    }
  };
})();
