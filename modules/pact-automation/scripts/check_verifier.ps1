# Validates the Anthropic key in .env and lists models you can use.
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$env:PYTHONPATH = $root
& ".venv\Scripts\python.exe" verifier\verify.py --check
