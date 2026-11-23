@echo off
set "launcher=%~dp0artifacts\Dashboard-Service-Local-0.1.0\Start.cmd"
if not exist "%launcher%" (
  echo The Dashboard-Service local package was not found in artifacts.
  pause
  exit /b 1
)
call "%launcher%" %*
