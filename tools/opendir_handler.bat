@echo off
setlocal enabledelayedexpansion
set "url=%~1"
set "path=!url:opendir:=!"
start "" explorer.exe "!path!"
