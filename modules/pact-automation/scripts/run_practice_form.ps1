# Opens the practice form (a PACT look-alike). Leave the window visible while testing.
$root = Split-Path $PSScriptRoot -Parent
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'practice\practice_form.ps1')
