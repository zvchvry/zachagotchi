@echo off
setlocal
rem Execution policy applies to this process only; no administrator access needed.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0flash.ps1" %*
exit /b %errorlevel%
