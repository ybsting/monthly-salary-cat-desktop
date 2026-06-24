$ErrorActionPreference = "Stop"

$rustRoot = "D:\Software\Rust"
$rustupHome = Join-Path -Path $rustRoot -ChildPath "rustup"
$cargoHome = Join-Path -Path $rustRoot -ChildPath "cargo"
$cargoBin = Join-Path -Path $cargoHome -ChildPath "bin"
$toolchain = Join-Path -Path $rustupHome -ChildPath "toolchains\stable-x86_64-pc-windows-msvc"
$installer = Join-Path -Path $env:TEMP -ChildPath "rustup-init.exe"

$env:RUSTUP_HOME = $rustupHome
$env:CARGO_HOME = $cargoHome
$env:RUSTUP_DIST_SERVER = "https://rsproxy.cn"
$env:RUSTUP_UPDATE_ROOT = "https://rsproxy.cn/rustup"
$env:CARGO_REGISTRIES_CRATES_IO_PROTOCOL = "sparse"
$env:Path = $cargoBin + ";" + $env:Path

New-Item -ItemType Directory -Force -Path $rustupHome | Out-Null
New-Item -ItemType Directory -Force -Path $cargoHome | Out-Null

if (-not (Test-Path -LiteralPath $installer)) {
  Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $installer
}

# Clean the broken stable toolchain left by the interrupted install.
if (Test-Path -LiteralPath $toolchain) {
  Remove-Item -LiteralPath $toolchain -Recurse -Force
}

& $installer -y --default-toolchain stable --profile minimal --no-modify-path
rustup default stable
rustup component add rustc rust-std cargo --toolchain stable-x86_64-pc-windows-msvc

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($null -eq $userPath) {
  $userPath = ""
}

if (-not (($userPath -split ";") -contains $cargoBin)) {
  $newPath = ($userPath.TrimEnd(";") + ";" + $cargoBin).TrimStart(";")
  [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
}

[Environment]::SetEnvironmentVariable("RUSTUP_HOME", $rustupHome, "User")
[Environment]::SetEnvironmentVariable("CARGO_HOME", $cargoHome, "User")

rustc --version
cargo --version

$projectRoot = Resolve-Path (Join-Path -Path $PSScriptRoot -ChildPath "..")
Push-Location $projectRoot
try {
  npm.cmd run tauri:dev
}
finally {
  Pop-Location
}
