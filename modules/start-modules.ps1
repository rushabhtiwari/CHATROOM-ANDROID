# Starts every module that runs beside the Central Platform, each on its own ports.
#
#   powershell -ExecutionPolicy Bypass -File .\modules\start-modules.ps1            # PACT + payment
#   powershell -ExecutionPolicy Bypass -File .\modules\start-modules.ps1 -Kcms      # ... and KCMS
#   powershell -ExecutionPolicy Bypass -File .\modules\start-modules.ps1 -Stop      # stop them all
#
#   PACT Automation   robot 8765 · API 3001 · console 5173
#   Workspace         API 3011 · console 5174      (every department tile, and the shared chat)
#   KCMS              3020 (one container: app, /god-mode/ admin, /spaces/, /live/)
#
# Everything is started detached and logs to %TEMP%\central-modules\. A service whose port is
# already answering is left alone, so the script is safe to run twice.

param([switch]$Kcms, [switch]$Stop)

$ErrorActionPreference = 'Stop'
$modules = $PSScriptRoot
$pact = Join-Path $modules 'pact-automation'
$kos = Join-Path $pact 'base-system\Kiran-Demo-Os-V1'
$pay = Join-Path $modules 'kiran-payment'
$mgmt = Join-Path $modules 'kiran-mgmt'
$logs = Join-Path $env:TEMP 'central-modules'
New-Item -ItemType Directory -Force $logs | Out-Null

function Test-Port([int]$port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try { $client.Connect('127.0.0.1', $port); return $true } catch { return $false } finally { $client.Dispose() }
}

function Start-Service-Once([string]$name, [int]$port, [string]$exe, [string[]]$arguments, [string]$cwd, [hashtable]$environment = @{}) {
    if (Test-Port $port) { Write-Host ("  {0,-22} already up on :{1}" -f $name, $port) -ForegroundColor DarkGray; return }
    $saved = @{}
    foreach ($key in $environment.Keys) { $saved[$key] = [Environment]::GetEnvironmentVariable($key); [Environment]::SetEnvironmentVariable($key, $environment[$key]) }
    try {
        Start-Process -FilePath $exe -ArgumentList $arguments -WorkingDirectory $cwd -WindowStyle Hidden `
            -RedirectStandardOutput (Join-Path $logs "$name.out.log") -RedirectStandardError (Join-Path $logs "$name.err.log")
    } finally {
        foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key]) }
    }
    Write-Host ("  {0,-22} starting on :{1}" -f $name, $port) -ForegroundColor Green
}

if ($Stop) {
    $ports = 8765, 3001, 5173, 3011, 5174
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $ports -contains $_.LocalPort } |
        Select-Object -ExpandProperty OwningProcess -Unique |
        ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Write-Host 'Module processes stopped. (KCMS: docker compose -f modules\kcms.compose.yml stop)' -ForegroundColor Yellow
    return
}

Write-Host 'PACT Automation' -ForegroundColor Cyan
# OpenClaw Tray also wants 8765 and keeps it if it starts first - see modules\README.md.
Start-Service-Once 'pact-robot' 8765 (Join-Path $pact '.venv\Scripts\python.exe') `
    @('-m', 'uvicorn', 'server.app:app', '--host', '127.0.0.1', '--port', '8765') $pact @{ PYTHONPATH = $pact }
Start-Service-Once 'pact-api' 3001 (Join-Path $kos 'backend\.venv\Scripts\python.exe') `
    @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '3001') (Join-Path $kos 'backend')
Start-Service-Once 'pact-console' 5173 'cmd.exe' @('/c', 'npm run dev') (Join-Path $kos 'master-frontend\varun')

Write-Host 'Department workspaces and chat' -ForegroundColor Cyan
Start-Service-Once 'payment-api' 3011 (Join-Path $pay 'backend\.venv\Scripts\python.exe') `
    @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '3011') (Join-Path $pay 'backend')
Start-Service-Once 'payment-console' 5174 'cmd.exe' @('/c', 'npm run dev') (Join-Path $pay 'master-frontend\vd') `
    @{ KIRAN_API = 'http://127.0.0.1:3011'; KIRAN_PORT = '5174' }

if ($Kcms) {
    Write-Host 'KCMS (Project Management)' -ForegroundColor Cyan
    # One container holds all of KCMS. The first run builds the image (about 15 minutes);
    # after that this returns in seconds and the app answers on :3020 within a minute or two.
    docker compose -f (Join-Path $modules 'kcms.compose.yml') up -d
}

# Take the department tiles live in the launcher. The SQL only touches tiles that are still
# "coming soon", so running it on every start is harmless.
$platform = Split-Path $modules
if (docker compose --project-directory $platform ps -q postgres) {
    Get-Content (Join-Path $modules 'open-departments.sql') -Raw |
        docker compose --project-directory $platform exec -T postgres psql -U central -d identity -q -v ON_ERROR_STOP=1 | Out-Null
    Write-Host 'Launcher tiles: departments, chat and projects are live' -ForegroundColor Cyan
} else {
    Write-Host 'Platform database is not running; skipped opening the department tiles.' -ForegroundColor Yellow
}

Write-Host ''
Write-Host "Logs: $logs" -ForegroundColor DarkGray
