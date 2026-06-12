@echo off
cd /d "C:\Tiim Market Base Loyihasi"

:: Eski server o'chib tursa to'xtatish
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8765 "') do (
    taskkill /f /pid %%a >nul 2>&1
)

:: Serverni fon rejimida ishga tushirish (terminal ko'rinmaydi)
start /min "Tiin Server" python api_server.py

:: Server ko'tarilguncha kutish
timeout /t 4 /nobreak >nul

:: Dashboardni brauzerda ochish
start http://127.0.0.1:8765/sales.html
