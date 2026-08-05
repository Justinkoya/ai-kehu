@echo off
title AI客户经营助手
cd /d "%~dp0"
echo ========================================
echo   AI 客户经营助手 正在启动...
echo   浏览器会自动打开 http://localhost:3000
echo   如果没自动打开,请手动访问该地址
echo   关闭此窗口 = 停止服务器
echo ========================================
start "" cmd /c "timeout /t 8 >nul && start http://localhost:3000"
npm run dev
pause
