@echo off
setlocal

call :UseVsDevCmd

where cargo.exe >nul 2>nul
if errorlevel 1 (
  echo cargo.exe was not found in PATH. Install Rust or add Cargo bin to PATH.
  exit /b 1
)

npx tauri build
exit /b %ERRORLEVEL%

:UseVsDevCmd
if defined VSINSTALLDIR (
  if exist "%VSINSTALLDIR%Common7\Tools\VsDevCmd.bat" (
    call "%VSINSTALLDIR%Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64
    exit /b 0
  )
)

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if exist "%VSWHERE%" (
  for /f "usebackq delims=" %%I in (`"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do (
    if exist "%%I\Common7\Tools\VsDevCmd.bat" (
      call "%%I\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64
      exit /b 0
    )
  )
)

for %%I in (
  "%ProgramFiles%\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
  "%ProgramFiles%\Microsoft Visual Studio\2022\Professional\Common7\Tools\VsDevCmd.bat"
  "%ProgramFiles%\Microsoft Visual Studio\2022\Enterprise\Common7\Tools\VsDevCmd.bat"
  "%ProgramFiles%\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat"
) do (
  if exist %%~I (
    call %%~I -arch=x64 -host_arch=x64
    exit /b 0
  )
)

echo Visual Studio C++ build tools were not detected automatically.
echo If the build fails, install Visual Studio Build Tools with the Desktop development with C++ workload.
exit /b 0
