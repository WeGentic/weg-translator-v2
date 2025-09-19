@echo off
setlocal
set DIR=%~dp0
set ARCH=win-x64

set C1=%DIR%..\resources\openxliff\%ARCH%
set C2=%DIR%resources\openxliff\%ARCH%

if exist "%C1%\merge.cmd" (
  call "%C1%\merge.cmd" %*
  exit /b %ERRORLEVEL%
)

if exist "%C2%\merge.cmd" (
  call "%C2%\merge.cmd" %*
  exit /b %ERRORLEVEL%
)

echo [merge wrapper] Could not locate OpenXLIFF resources for %ARCH% relative to %DIR% >&2
exit /b 1
