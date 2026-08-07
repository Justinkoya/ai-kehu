@echo off
title AI客户经营助手
cd /d "%~dp0"
echo ========================================
echo   AI 客户经营助手 正在启动...
echo   浏览器会自动打开后台;关闭本窗口 = 停止(会同时结束服务器和 bot)
echo   日志在 data\logs\ 目录
echo ========================================
if exist "runtime\node\node.exe" (
  "runtime\node\node.exe" manager.js
) else (
  node manager.js
)
pause
