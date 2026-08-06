@echo off
rem AI kehu WeChat bot launcher (merchant mobile assistant)
cd /d "%~dp0"
set WXQR_PNG=%CD%\login-qr.png
echo Starting AI kehu WeChat bot...
echo IMPORTANT: keep this window open. Close it to stop the bot.
node_modules\.bin\tsx.cmd bot/index.ts
echo.
echo Bot stopped. Press any key to close.
pause >nul
