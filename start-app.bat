@echo off
title AI客户经营助手
cd /d "%~dp0"
echo ========================================
echo   AI 客户经营助手 正在启动...
echo   - 微信机器人:另开「ai-kehu-bot」窗口运行
echo   - 网页后台:浏览器会自动打开 http://localhost:3000
echo   关闭此窗口 = 停止网页服务器
echo   关闭「微信机器人」窗口 = 停止微信机器人
echo ========================================
start "ai-kehu-bot" cmd /c "%~dp0start-bot.bat"
start "" cmd /c "timeout /t 8 >nul && start http://localhost:3000"
npm run dev
pause
