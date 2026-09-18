# One-command setup + run for KPAC. First run creates .venv and installs packages.
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example - open it and paste your ANTHROPIC_API_KEY, then re-run." -ForegroundColor Yellow
  notepad .env
  exit 1
}

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if (-not $py) { Write-Host "Python not found. Install from https://www.python.org/downloads/ and tick 'Add python.exe to PATH'." -ForegroundColor Red; exit 1 }

if (-not (Test-Path ".venv")) {
  Write-Host "Creating virtual environment..." -ForegroundColor Cyan
  & $py.Source -m venv .venv
}
& ".venv\Scripts\python.exe" -m pip install --quiet --upgrade pip
Write-Host "Installing/checking packages..." -ForegroundColor Cyan
& ".venv\Scripts\python.exe" -m pip install --quiet -r requirements.txt

$env:PYTHONPATH = $root
$h = (Get-Content .env | Where-Object { $_ -match '^HOST=' }) -replace 'HOST=',''; if (-not $h) { $h = '127.0.0.1' }
$p = (Get-Content .env | Where-Object { $_ -match '^PORT=' }) -replace 'PORT=',''; if (-not $p) { $p = '8765' }

# Windows can reserve or hand out a port to something else (Hyper-V, an old server still running).
# Fail loudly here rather than letting uvicorn die with winerror 10013.
$free = $true
try {
  $probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse($h), [int]$p)
  $probe.Start(); $probe.Stop()
} catch { $free = $false }
if (-not $free) {
  Write-Host "Port $p on $h is not available (in use, or reserved by Windows)." -ForegroundColor Red
  $alt = 0
  foreach ($c in 8766..8790) {
    try { $t = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse($h), $c); $t.Start(); $t.Stop(); $alt = $c; break } catch {}
  }
  if ($alt) { Write-Host "Set  PORT=$alt  in .env and run this again." -ForegroundColor Yellow }
  Write-Host "(Check what holds it with:  Get-NetTCPConnection -LocalPort $p -State Listen)" -ForegroundColor DarkGray
  exit 1
}

Write-Host "KPAC console: http://$h`:$p" -ForegroundColor Green
Start-Process "http://$h`:$p"
& ".venv\Scripts\python.exe" -m uvicorn server.app:app --host $h --port $p
