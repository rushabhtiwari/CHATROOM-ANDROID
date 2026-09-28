# Starts KiranOS: the Python API on :3001, and the console on :5173, the
# phone app on :5174, or both.
#
#   powershell -ExecutionPolicy Bypass -File .\start.ps1             # console
#   powershell -ExecutionPolicy Bypass -File .\start.ps1 -App mobile # phone app
#   powershell -ExecutionPolicy Bypass -File .\start.ps1 -App both
#
# Leave this window open. Ctrl+C stops everything it started.

param(
    [ValidateSet('console', 'mobile', 'both')]
    [string]$App = 'console'
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$console = Join-Path $root 'master-frontend\vd'
$mobile = Join-Path $root 'mobile'

$venvPython = Join-Path $root 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Host 'Setting up the backend virtual environment (one time)...' -ForegroundColor Cyan
    python -m venv (Join-Path $root 'backend\.venv')
    & $venvPython -m pip install --upgrade pip --quiet
}
# An environment made by a tool other than `python -m venv` (uv, for one) can
# lack pip entirely; give it one rather than failing the install below.
# Windows PowerShell turns a native command's stderr into a terminating error
# under 'Stop', redirected or not — so the probe for pip must not run under it.
$ErrorActionPreference = 'Continue'
& $venvPython -m pip --version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'The backend environment has no pip; installing it (one time)...' -ForegroundColor Cyan
    & $venvPython -m ensurepip --upgrade --default-pip 2>&1 | Out-Null
}
# Cheap when everything is already present, and it catches a dependency added
# since the environment was created. pip writes notices to stderr, so this too
# runs outside 'Stop' and is judged by its exit code instead.
& $venvPython -m pip install -r (Join-Path $root 'backend\requirements.txt') --quiet 2>&1 |
    Where-Object { $_ -notmatch 'notice|new release of pip' } | Out-Host
$pipExit = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($pipExit -ne 0) { throw 'Installing the backend requirements failed.' }

# The console and the phone app are one npm workspace: a single install at the
# root serves both, and packages are hoisted into the root's node_modules.
if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host 'Installing packages for the console and the phone app (one time)...' -ForegroundColor Cyan
    Push-Location $root
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
    Write-Host 'Without them everything still runs end to end; those two paths' -ForegroundColor Yellow
    Write-Host 'fall back to manual entry and to clearly-marked demo links.' -ForegroundColor Yellow
    Write-Host ''
}

# The address other devices on this network reach this machine at: the first
# ordinary IPv4 address, skipping loopback, link-local and virtual adapters.
function Get-LanAddress {
    try {
        Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object {
                $_.IPAddress -notlike '127.*' -and
                $_.IPAddress -notlike '169.254.*' -and
                $_.InterfaceAlias -notmatch 'vEthernet|Loopback|VirtualBox|VMware|WSL'
            } |
            Select-Object -First 1 -ExpandProperty IPAddress
    }
    catch { $null }
}

Write-Host 'Starting API on http://localhost:3001' -ForegroundColor Green
$started = @()
$started += Start-Process -FilePath $venvPython `
    -ArgumentList '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '3001' `
    -WorkingDirectory (Join-Path $root 'backend') -PassThru -NoNewWindow

Start-Sleep -Seconds 2

if ($App -in 'mobile', 'both') {
    $lan = Get-LanAddress
    Write-Host 'Starting the phone app on http://localhost:5174' -ForegroundColor Green
    Write-Host '  In a desktop browser, open developer tools and pick a phone size.' -ForegroundColor DarkGray
    if ($lan) {
        Write-Host "  On an iPhone on the same Wi-Fi, open http://${lan}:5174 in Safari." -ForegroundColor Cyan
        Write-Host '  (If it does not load, allow Node.js through Windows Firewall on private networks.)' -ForegroundColor DarkGray
    }
}
if ($App -eq 'both') {
    # The phone app runs alongside; the console holds this window.
    $started += Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' `
        -WorkingDirectory $mobile -PassThru -NoNewWindow
    Start-Sleep -Seconds 1
}

$foreground = if ($App -eq 'mobile') { $mobile } else { $console }
if ($App -ne 'mobile') {
    Write-Host 'Starting the console on http://localhost:5173' -ForegroundColor Green
}

Push-Location $foreground
try {
    npm run dev
}
finally {
    Pop-Location
    foreach ($process in $started) {
        if ($process -and -not $process.HasExited) {
            # /T takes the process tree: npm and uvicorn both run children.
            taskkill /T /F /PID $process.Id *> $null
        }
    }
    Write-Host 'Stopped.' -ForegroundColor DarkGray
}
