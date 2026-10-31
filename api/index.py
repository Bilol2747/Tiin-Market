"""
api/index.py — Vercel'ning eng ishonchli, standart Python funksiya
konventsiyasi (`/api/*.py` fayl -> Vercel Function). `backend/app.py`dagi
haqiqiy FastAPI ilovasini shu yerga eksport qiladi, xolos — biznes mantiq
BUTUNLAY backend/ papkasida qoladi, bu yerda faqat "ko'rsatkich".

Nega kerak: pyproject.toml'dagi `[tool.vercel] entrypoint` (backend/app.py
to'g'ridan-to'g'ri) build'ni muvaffaqiyatli o'tkazdi, lekin HECH QANDAY
marshrutlash (routing) yaratmadi - /api/v1/health va h.k. 404 qaytardi.
Standart /api/ papka konventsiyasi esa bu loyihada allaqachon (invan-order.js,
telegram-webhook.js) sinalgan va ishlaydi.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app import app  # noqa: F401,E402
