@echo off
node "%~dp0server.cjs" %*
if errorlevel 1 pause
