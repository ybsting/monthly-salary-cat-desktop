$ErrorActionPreference = "SilentlyContinue"

$projectRoot = (Resolve-Path (Join-Path -Path $PSScriptRoot -ChildPath "..")).Path

function Stop-PortListener {
  param([int]$Port)
  $listeners = netstat -ano |
    Select-String -Pattern "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"

  foreach ($listener in $listeners) {
    $processId = [int]$listener.Matches[0].Groups[1].Value
    if ($processId -gt 0) {
      Stop-Process -Id $processId -Force
    }
  }
}

Get-Process -Name "monthly-salary-cat" | Stop-Process -Force
Stop-PortListener -Port 1420

Write-Host "Monthly Salary Meow stopped."
