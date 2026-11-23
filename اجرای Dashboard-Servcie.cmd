@echo off
set "launcher=%~dp0artifacts\source-package\Start.cmd"
if not exist "%launcher%" (
  echo The local Dashboard-Servcie package was not found in artifacts\source-package.
  pause
  exit /b 1
)
call "%launcher%" %*
