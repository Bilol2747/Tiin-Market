"""
Vercel Serverless Funksiya: Login + Nazorat (foydalanuvchilar) — server tomonida.
─────────────────────────────────────────────────────────────────────────
2026-08-25: aniqlandiki, sayt ilgari Firestore `users` to'plamiga TO'G'RIDAN-
TO'G'RI brauzerdan (login-siz ham!) kirar edi — to'plam butunlay ochiq edi.
Bu fayl o'sha yo'lni butunlay yopadi: brauzer endi Firestore'ga hech qachon
bevosita murojaat qilmaydi, faqat shu endpoint orqali (`POST /api/auth`,
JSON body ichida {"action": "..."}).

Firestore'ga bu yerdan xizmat hisobi (service account) orqali, `firebase-
admin` OG'IR kutubxonasisiz (u `grpcio` tortadi — bu loyihada `numpy`
qo'shilganda bundle hajmi 225MB limitini buzgan xuddi shu turdagi muammo)
ulaniladi: xizmat hisobi RSA kaliti bilan JWT imzolanadi (RS256, `cryptography`
orqali), Google OAuth2'dan token olinadi, keyin Firestore'ning oddiy REST
API'siga `requests` bilan so'rov yuboriladi. Bu token Firestore Security
Rules'ni chetlab o'tadi (xizmat hisobi kirishi qoidalarga bog'liq emas) -
shuning uchun Firestore Rules keyinchalik butunlay yopib qo'yilsa ham
(`allow read, write: if false`), bu funksiya ishlashda davom etadi.

Parol endi bir tomonlama SHA-256 emas, AES-256-GCM bilan QAYTARIB OLSA
BO'LADIGAN (reversible) shaklda saqlanadi (`password_enc` maydoni) - buni
admin panelida ko'rsatish (reveal) uchun ataylab shunday. Eski `password_hash`
qiymatlari birinchi muvaffaqiyatli login paytida avtomatik `password_enc`ga
ko'chiriladi (parolning o'zi o'zgarmaydi, faqat saqlash shakli).

Sessiya tokeni HMAC-SHA256 bilan imzolanadi (qo'shimcha kutubxonasiz, stdlib
`hmac`), tarkibida `pw_ver` (parol versiyasi) bor - admin panelidan onigli
parol o'zgartirilganda bu +1 oshadi, shu orqali eski sessiyalar avtomatik
haqiqiy emas bo'lib qoladi (`session_check` amali buni tekshiradi - frontend
buni sayt ochiq turgan paytda davriy chaqiradi, shu bilan parol o'zgarsa/
blok qilinsa foydalanuvchi darhol chiqarib tashlanadi).

Kerakli Environment Variables (Vercel → Settings → Environment Variables):
  FIREBASE_SERVICE_ACCOUNT_JSON - Firebase xizmat hisobi kaliti, TO'LIQ JSON
                                   (Firebase Console -> tiim-market loyihasi ->
                                   Project Settings -> Service Accounts ->
                                   "Generate new private key")
  SESSION_SECRET                - tasodifiy 32+ baytli maxfiy matn (sessiya
                                   tokenlarini imzolash uchun)
  PASSWORD_ENC_KEY              - 32 bayt (64 ta hex belgi) AES kaliti
                                   (parollarni shifrlash uchun)
─────────────────────────────────────────────────────────────────────────
"""
import base64
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler

import requests
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

SESSION_TTL_SECONDS = 7 * 24 * 3600  # 7 kun


# ─── Google xizmat hisobi -> Firestore REST (firebase-admin'siz) ───

_token_cache = {"token": None, "exp": 0}


def _service_account():
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        raise RuntimeError("FIREBASE_SERVICE_ACCOUNT_JSON o'rnatilmagan")
    return json.loads(raw)


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _get_access_token() -> str:
    now = int(time.time())
    if _token_cache["token"] and _token_cache["exp"] - 60 > now:
        return _token_cache["token"]
    sa = _service_account()
    header = {"alg": "RS256", "typ": "JWT"}
    claims = {
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/datastore",
        "aud": "https://oauth2.googleapis.com/token",
        "iat": now,
        "exp": now + 3600,
    }
    signing_input = (
        _b64url(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + _b64url(json.dumps(claims, separators=(",", ":")).encode())
    )
    priv = serialization.load_pem_private_key(sa["private_key"].encode(), password=None)
    sig = priv.sign(signing_input.encode(), padding.PKCS1v15(), hashes.SHA256())
    assertion = signing_input + "." + _b64url(sig)
    r = requests.post(
        "https://oauth2.googleapis.com/token",
        data={"grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion},
        timeout=10,
    )
    r.raise_for_status()
    data = r.json()
    _token_cache["token"] = data["access_token"]
    _token_cache["exp"] = now + int(data.get("expires_in", 3600))
    return _token_cache["token"]


def _fs_base_url() -> str:
    return f"https://firestore.googleapis.com/v1/projects/{_service_account()['project_id']}/databases/(default)/documents"


def _fs_headers() -> dict:
    return {"Authorization": f"Bearer {_get_access_token()}", "Content-Type": "application/json"}


def _fs_encode_value(v):
    if v is None:
        return {"nullValue": None}
    if isinstance(v, bool):
        return {"booleanValue": v}
    if isinstance(v, int):
        return {"integerValue": str(v)}
    if isinstance(v, float):
        return {"doubleValue": v}
    if isinstance(v, str):
        return {"stringValue": v}
    if isinstance(v, list):
        return {"arrayValue": {"values": [_fs_encode_value(x) for x in v]}}
    raise TypeError(f"Firestore uchun qo'llab-quvvatlanmaydigan tur: {type(v)}")


def _fs_decode_value(fv: dict):
    if "nullValue" in fv:
        return None
    if "booleanValue" in fv:
        return fv["booleanValue"]
    if "integerValue" in fv:
        return int(fv["integerValue"])
    if "doubleValue" in fv:
        return fv["doubleValue"]
    if "stringValue" in fv:
        return fv["stringValue"]
    if "timestampValue" in fv:
        return fv["timestampValue"]
    if "arrayValue" in fv:
        return [_fs_decode_value(x) for x in fv["arrayValue"].get("values", [])]
    if "mapValue" in fv:
        return {k: _fs_decode_value(x) for k, x in fv["mapValue"].get("fields", {}).items()}
    return None


def _fs_doc_to_dict(doc: dict) -> dict:
    name = doc.get("name", "")
    doc_id = name.rsplit("/", 1)[-1] if name else None
    d = {k: _fs_decode_value(v) for k, v in doc.get("fields", {}).items()}
    d["id"] = doc_id
    return d


def _fs_get_user(doc_id: str):
    r = requests.get(f"{_fs_base_url()}/users/{doc_id}", headers=_fs_headers(), timeout=10)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return _fs_doc_to_dict(r.json())


def _fs_list_users() -> list:
    out = []
    page_token = None
    while True:
        params = {"pageSize": 300}
        if page_token:
            params["pageToken"] = page_token
        r = requests.get(f"{_fs_base_url()}/users", headers=_fs_headers(), params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        out.extend(_fs_doc_to_dict(doc) for doc in data.get("documents", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return out


def _fs_query_by_phone(phone: str) -> list:
    body = {
        "structuredQuery": {
            "from": [{"collectionId": "users"}],
            "where": {
                "fieldFilter": {
                    "field": {"fieldPath": "phone"},
                    "op": "EQUAL",
                    "value": {"stringValue": phone},
                }
            },
            "limit": 5,
        }
    }
    r = requests.post(f"{_fs_base_url()}:runQuery", headers=_fs_headers(), json=body, timeout=10)
    r.raise_for_status()
    return [_fs_doc_to_dict(item["document"]) for item in r.json() if item.get("document")]


def _fs_create_user(fields: dict) -> dict:
    body = {"fields": {k: _fs_encode_value(v) for k, v in fields.items()}}
    r = requests.post(f"{_fs_base_url()}/users", headers=_fs_headers(), json=body, timeout=10)
    r.raise_for_status()
    return _fs_doc_to_dict(r.json())


def _fs_patch_user(doc_id: str, fields: dict, delete_fields=None) -> dict:
    """`fields`dagi kalitlar yoziladi/yangilanadi. `delete_fields`da nomlangan
    maydonlar esa BUTUNLAY o'chiriladi - Firestore REST'ning o'zi shunday
    ishlaydi: updateMask'da nomlangan, lekin `fields` tanasida bo'lmagan
    maydon o'chiriladi (eski `password_hash`ni ko'chirishda ishlatiladi)."""
    mask_paths = list(fields.keys()) + list(delete_fields or [])
    params = [("updateMask.fieldPaths", p) for p in mask_paths]
    body = {"fields": {k: _fs_encode_value(v) for k, v in fields.items()}}
    r = requests.patch(f"{_fs_base_url()}/users/{doc_id}", headers=_fs_headers(), params=params, json=body, timeout=10)
    r.raise_for_status()
    return _fs_doc_to_dict(r.json())


def _fs_delete_user(doc_id: str):
    r = requests.delete(f"{_fs_base_url()}/users/{doc_id}", headers=_fs_headers(), timeout=10)
    r.raise_for_status()


# ─── Parolni qaytarib olsa bo'ladigan shifrlash (AES-256-GCM) ───


def _enc_key() -> bytes:
    raw = os.environ.get("PASSWORD_ENC_KEY", "").strip()
    if not raw:
        raise RuntimeError("PASSWORD_ENC_KEY o'rnatilmagan")
    key = bytes.fromhex(raw)
    if len(key) != 32:
        raise RuntimeError("PASSWORD_ENC_KEY 32 bayt (64 ta hex belgi) bo'lishi kerak")
    return key


def encrypt_password(plaintext: str) -> str:
    nonce = os.urandom(12)
    ct = AESGCM(_enc_key()).encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode()


def decrypt_password(blob_b64: str) -> str:
    raw = base64.b64decode(blob_b64)
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(_enc_key()).decrypt(nonce, ct, None).decode("utf-8")


def _sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


# ─── Sessiya tokeni (HMAC-SHA256, stdlib) ───


def _session_secret() -> bytes:
    raw = os.environ.get("SESSION_SECRET", "").strip()
    if not raw:
        raise RuntimeError("SESSION_SECRET o'rnatilmagan")
    return raw.encode("utf-8")


def make_token(uid: str, phone: str, role: str, pw_ver: int):
    now = int(time.time())
    payload = {"uid": uid, "phone": phone, "role": role, "pw_ver": int(pw_ver),
               "iat": now, "exp": now + SESSION_TTL_SECONDS}
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode())
    sig = hmac.new(_session_secret(), payload_b64.encode(), hashlib.sha256).hexdigest()
    return payload_b64 + "." + sig, payload["exp"]


def verify_token(token: str):
    if not token or "." not in token:
        return None
    payload_b64, sig = token.rsplit(".", 1)
    expected = hmac.new(_session_secret(), payload_b64.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        pad = "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64 + pad))
    except Exception:
        return None
    if payload.get("exp", 0) < int(time.time()):
        return None
    return payload


# ─── Amallar (actions) ───


def _public_user(u: dict) -> dict:
    """Faqat XAVFSIZ maydonlar - parol/shifr hech qachon bu orqali chiqmaydi."""
    return {
        "id": u.get("id"),
        "phone": u.get("phone"),
        "name": u.get("name"),
        "role": u.get("role"),
        "tabs": u.get("tabs") or [],
        "active": bool(u.get("active")),
        "pw_migrated": bool(u.get("password_enc")),
    }


def action_login(body: dict):
    phone = "".join(ch for ch in str(body.get("phone") or "") if ch.isdigit())
    password = str(body.get("password") or "")
    if not phone or not password:
        return 400, {"ok": False, "error": "Telefon va parol kerak"}

    # DIQQAT: "active" filtri PAROL TEKSHIRUVIDAN OLDIN emas - bloklangan
    # hisobga ham parol to'g'ri kelsa, "bloklangan" deb ANIQ aytish uchun
    # (aks holda "parol noto'g'ri" deb chalg'itardi - foydalanuvchi buni
    # ilgari alohida so'ragan edi).
    matched = None
    blocked = False
    for u in _fs_query_by_phone(phone):
        password_ok = False
        if u.get("password_enc"):
            try:
                password_ok = hmac.compare_digest(decrypt_password(u["password_enc"]), password)
            except Exception:
                password_ok = False
        elif u.get("password_hash"):
            password_ok = hmac.compare_digest(u["password_hash"], _sha256_hex(password))
        if not password_ok:
            continue
        if not u.get("active"):
            blocked = True
            continue
        matched = u
        if not u.get("password_enc") and u.get("password_hash"):
            # Avtomatik ko'chirish: endi shifrlangan shaklga o'tkazamiz.
            # pw_ver OSHMAYDI - parolning o'zi o'zgargani yo'q, faqat
            # saqlash shakli (boshqa qurilmadagi ochiq sessiya buzilmasin).
            try:
                _fs_patch_user(u["id"], {"password_enc": encrypt_password(password)},
                                delete_fields=["password_hash"])
            except Exception:
                pass
        break
    if not matched:
        if blocked:
            return 401, {"ok": False, "error": "Hisobingiz bloklangan"}
        return 401, {"ok": False, "error": "Telefon yoki parol noto'g'ri"}

    pw_ver = int(matched.get("pw_ver") or 1)
    token, exp = make_token(matched["id"], matched["phone"], matched["role"], pw_ver)
    return 200, {"ok": True, "token": token, "exp": exp, "user": _public_user(matched)}


def _auth_from_token(body: dict):
    """Token imzosi+muddatini, SO'NG Firestore'dagi ENG JORIY holatni tekshiradi.
    (payload, user) yoki (None, sabab) qaytaradi - sabab: expired/deleted/
    blocked/password_changed."""
    payload = verify_token(str(body.get("token") or ""))
    if not payload:
        return None, "expired"
    user = _fs_get_user(payload["uid"])
    if not user:
        return None, "deleted"
    if not user.get("active"):
        return None, "blocked"
    if int(user.get("pw_ver") or 1) != int(payload.get("pw_ver") or 1):
        return None, "password_changed"
    return payload, user


def action_session_check(body: dict):
    payload, result = _auth_from_token(body)
    if payload is None:
        return 401, {"ok": False, "reason": result}
    return 200, {"ok": True, "user": _public_user(result)}


def _require_admin(body: dict):
    """(admin_user, None) yoki (None, (status, payload)) qaytaradi."""
    payload, result = _auth_from_token(body)
    if payload is None:
        return None, (401, {"ok": False, "reason": result})
    if result.get("role") != "admin":
        return None, (403, {"ok": False, "error": "Faqat admin uchun"})
    return result, None


def action_list_users(body: dict):
    admin, err = _require_admin(body)
    if err:
        return err
    users = sorted(_fs_list_users(), key=lambda u: (u.get("name") or ""))
    return 200, {"ok": True, "users": [_public_user(u) for u in users]}


def action_create_user(body: dict):
    admin, err = _require_admin(body)
    if err:
        return err
    name = str(body.get("name") or "").strip()
    phone = "".join(ch for ch in str(body.get("phone") or "") if ch.isdigit())
    password = str(body.get("password") or "")
    role = str(body.get("role") or "staff")
    tabs = list(body.get("tabs") or [])
    if not name or not phone or not password:
        return 400, {"ok": False, "error": "Ism, telefon, parol kerak"}
    if len(password) < 6:
        return 400, {"ok": False, "error": "Parol kamida 6 belgi bo'lishi kerak"}
    if role == "admin" and "p_nazorat" not in tabs:
        tabs.append("p_nazorat")
    fields = {
        "name": name, "phone": phone, "role": role, "tabs": tabs,
        "active": True, "pw_ver": 1,
        "password_enc": encrypt_password(password),
        "created": datetime.now(timezone.utc).isoformat(),
    }
    created = _fs_create_user(fields)
    return 200, {"ok": True, "id": created["id"]}


def action_update_user(body: dict):
    admin, err = _require_admin(body)
    if err:
        return err
    uid = str(body.get("id") or "")
    if not uid:
        return 400, {"ok": False, "error": "id kerak"}
    name = str(body.get("name") or "").strip()
    phone = "".join(ch for ch in str(body.get("phone") or "") if ch.isdigit())
    role = str(body.get("role") or "staff")
    tabs = list(body.get("tabs") or [])
    password = str(body.get("password") or "")
    if not name or not phone:
        return 400, {"ok": False, "error": "Ism, telefon kerak"}
    if role == "admin" and "p_nazorat" not in tabs:
        tabs.append("p_nazorat")

    # E'TIBOR: `active` ATAYLAB bu yerga qo'shilmaydi - faqat toggle_active
    # orqali o'zgaradi. Eski xato: har saqlashda active:true majburan
    # yozilardi, bloklangan xodimni tahrirlash uni bexosdan blokdan chiqarib
    # yuborardi.
    fields = {"name": name, "phone": phone, "role": role, "tabs": tabs}
    delete_fields = []
    if password:
        if len(password) < 6:
            return 400, {"ok": False, "error": "Parol kamida 6 belgi bo'lishi kerak"}
        current = _fs_get_user(uid) or {}
        fields["password_enc"] = encrypt_password(password)
        fields["pw_ver"] = int(current.get("pw_ver") or 1) + 1
        delete_fields.append("password_hash")
    _fs_patch_user(uid, fields, delete_fields=delete_fields)
    return 200, {"ok": True}


def action_toggle_active(body: dict):
    admin, err = _require_admin(body)
    if err:
        return err
    uid = str(body.get("id") or "")
    if not uid:
        return 400, {"ok": False, "error": "id kerak"}
    _fs_patch_user(uid, {"active": bool(body.get("active"))})
    return 200, {"ok": True}


def action_delete_user(body: dict):
    admin, err = _require_admin(body)
    if err:
        return err
    uid = str(body.get("id") or "")
    if not uid:
        return 400, {"ok": False, "error": "id kerak"}
    if uid == admin.get("id"):
        return 400, {"ok": False, "error": "O'zingizni o'chira olmaysiz"}
    _fs_delete_user(uid)
    return 200, {"ok": True}


def action_reveal_password(body: dict):
    admin, err = _require_admin(body)
    if err:
        return err
    uid = str(body.get("id") or "")
    if not uid:
        return 400, {"ok": False, "error": "id kerak"}
    user = _fs_get_user(uid)
    if not user:
        return 404, {"ok": False, "error": "Topilmadi"}
    if not user.get("password_enc"):
        return 200, {"ok": False, "error": "not_available"}
    try:
        pw = decrypt_password(user["password_enc"])
    except Exception:
        return 500, {"ok": False, "error": "Shifrni ochib bo'lmadi"}
    return 200, {"ok": True, "password": pw}


ACTIONS = {
    "login": action_login,
    "session_check": action_session_check,
    "list_users": action_list_users,
    "create_user": action_create_user,
    "update_user": action_update_user,
    "delete_user": action_delete_user,
    "toggle_active": action_toggle_active,
    "reveal_password": action_reveal_password,
}


class handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self._cors()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length else b"{}"
            body = json.loads(raw or b"{}")
        except Exception:
            self._json(400, {"ok": False, "error": "Noto'g'ri so'rov"})
            return
        fn = ACTIONS.get(str(body.get("action") or ""))
        if not fn:
            self._json(400, {"ok": False, "error": "Noma'lum action"})
            return
        try:
            status, payload = fn(body)
        except Exception as e:
            self._json(500, {"ok": False, "error": str(e)})
            return
        self._json(status, payload)
