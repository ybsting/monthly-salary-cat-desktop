@echo off
setlocal
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":1420" ^| findstr "LISTENING"') do taskkill /PID %%p /F >nul 2>nul
taskkill /IM monthly-salary-cat.exe /F >nul 2>nul
call "D:\Software\vs\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64
set "RUSTUP_HOME=D:\Software\Rust\rustup"
set "CARGO_HOME=D:\Software\Rust\cargo"
set "PATH=D:\Software\Rust\cargo\bin;%PATH%"
npx tauri dev
