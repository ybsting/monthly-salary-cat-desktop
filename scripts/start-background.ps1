$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path -Path $PSScriptRoot -ChildPath "..")
$logDir = Join-Path -Path $projectRoot -ChildPath "logs"
$logFile = Join-Path -Path $logDir -ChildPath "desktop-start.log"
$desktopWebServerLogFile = Join-Path -Path $logDir -ChildPath "desktop-web-server.log"
$releaseExe = Join-Path -Path $projectRoot -ChildPath "src-tauri\target\release\monthly-salary-cat.exe"
$debugExe = Join-Path -Path $projectRoot -ChildPath "src-tauri\target\debug\monthly-salary-cat.exe"

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Write-StartLog {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Add-Content -Path $logFile -Value $line -Encoding UTF8
}

function Test-PortListening {
  param([int]$Port)
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect("127.0.0.1", $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(300)) {
      return $false
    }

    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Stop-PortListener {
  param([int]$Port)
  $listeners = netstat -ano |
    Select-String -Pattern "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"

  foreach ($listener in $listeners) {
    $processId = [int]$listener.Matches[0].Groups[1].Value
    if ($processId -gt 0) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
      Write-StartLog "Stopped listener on port $Port, pid=$processId"
    }
  }
}

function Quote-CmdArgument {
  param([string]$Value)
  return '"' + ($Value -replace '"', '""') + '"'
}

function Start-HiddenProcess {
  param(
    [string]$FilePath,
    [string]$Arguments,
    [string]$WorkingDirectory
  )

  $shell = New-Object -ComObject WScript.Shell
  $shell.CurrentDirectory = $WorkingDirectory
  $command = (Quote-CmdArgument $FilePath)
  if (-not [string]::IsNullOrWhiteSpace($Arguments)) {
    $command += " $Arguments"
  }
  $shell.Run($command, 0, $false) | Out-Null
}

function Start-DesktopWebServerIfNeeded {
  if (Test-PortListening -Port 1420) {
    Write-StartLog "Desktop web server already listening on port 1420."
    return
  }

  Write-StartLog "Starting desktop web server for existing debug executable."
  $nodeExe = (Get-Command "node.exe").Source
  $serverEntry = Join-Path -Path $projectRoot -ChildPath "scripts\desktop-web-server.cjs"
  Start-HiddenProcess -FilePath $nodeExe -Arguments (Quote-CmdArgument $serverEntry) -WorkingDirectory $projectRoot

  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-PortListening -Port 1420) {
      Write-StartLog "Desktop web server is ready."
      return
    }
  }

  throw "Desktop web server did not become ready. See $desktopWebServerLogFile"
}

$exePath = $null
$needsDesktopWebServer = $false

if (Test-Path -LiteralPath $releaseExe) {
  $exePath = $releaseExe
  Write-StartLog "Using release executable: $exePath"
} elseif (Test-Path -LiteralPath $debugExe) {
  $exePath = $debugExe
  $needsDesktopWebServer = $true
  Write-StartLog "Using existing debug executable without running Cargo: $exePath"
} else {
  Write-StartLog "No existing Tauri executable found."
  throw "Monthly Salary Meow executable was not found. Build the Tauri app once in an environment that allows Rust build scripts, then start it again."
}

Get-Process -Name "monthly-salary-cat" -ErrorAction SilentlyContinue |
  Stop-Process -Force

if ($needsDesktopWebServer) {
  Write-StartLog "Refreshing desktop web server so desktop launch uses current dist assets."
  Stop-PortListener -Port 1420
  Start-DesktopWebServerIfNeeded
}

$exeDir = Split-Path -Parent $exePath
Start-HiddenProcess -FilePath $exePath -Arguments "" -WorkingDirectory $exeDir
Start-Sleep -Seconds 1
$runningProcess = Get-Process -Name "monthly-salary-cat" -ErrorAction SilentlyContinue | Select-Object -First 1
Write-StartLog "Monthly Salary Meow process started. running=$($null -ne $runningProcess)"

if ($null -eq $runningProcess) {
  $message = "Monthly Salary Meow executable did not remain running. Windows Application Control policy may have blocked the unsigned executable."
  Write-StartLog $message
  throw $message
}
