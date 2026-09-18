# Starts KiranOS: Python API on :3001, the console on :5173.
#
#   powershell -ExecutionPolicy Bypass -File .\start.ps1
#
# Leave this window open. Ctrl+C stops both.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$app = Join-Path $root 'master-frontend\varun'

$venvPython = Join-Path $root 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Host 'Setting up the backend virtual environment (one time)...' -ForegroundColor Cyan
    python -m venv (Join-Path $root 'backend\.venv')
    & $venvPython -m pip install --upgrade pip --quiet
}
# Cheap when everything is already present, and it catches a dependency added
# since the environment was created.
& $venvPython -m pip install -r (Join-Path $root 'backend\requirements.txt') --quiet

if (-not (Test-Path (Join-Path $app 'node_modules'))) {
    Write-Host 'Installing console packages (one time)...' -ForegroundColor Cyan
    Push-Location $app
    npm install --no-audit --no-fund
    Pop-Location
}

$envFile = Join-Path $root 'backend\.env'
if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $root 'backend\.env.example') $envFile
    Write-Host ''
    Write-Host 'Created backend\.env.' -ForegroundColor Yellow
    Write-Host '  ANTHROPIC_API_KEY  turns on receipt reading and the in-chat assistant.' -ForegroundColor Yellow
    Write-Host '  GOOGLE_* keys      turn on real Meet links and Calendar invitations.' -ForegroundColor Yellow
    Write-Host 'Without them the console still runs end to end; those two paths' -ForegroundColor Yellow
    Write-Host 'fall back to manual entry and to clearly-marked demo links.' -ForegroundColor Yellow
    Write-Host ''
}

Write-Host 'Starting API on http://localhost:3001' -ForegroundColor Green
$api = Start-Process -FilePath $venvPython `
    -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '3001' `
    -WorkingDirectory (Join-Path $root 'backend') -PassThru -NoNewWindow

Start-Sleep -Seconds 2

Write-Host 'Starting KiranOS on http://localhost:5173' -ForegroundColor Green
Push-Location $app
try {
    npm run dev
}
finally {
    Pop-Location
    if ($api -and -not $api.HasExited) {
        Stop-Process -Id $api.Id -Force -ErrorAction SilentlyContinue
        Write-Host 'API stopped.' -ForegroundColor DarkGray
    }
}
