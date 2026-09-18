# Dump a window's control tree.  Usage:  .\scripts\discover.ps1 "PACT RevenU"
param([string]$Title = "PACT RevenU")
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root
$env:PYTHONPATH = $root
& ".venv\Scripts\python.exe" discovery\discover.py --title $Title
