<#
  Downloads Plane's own UI screenshots from their public documentation into
  docs\plane-reference\ so Claude Code can look at the real thing instead of
  working from a written description.

  These are Plane's copyrighted product images (docs.plane.so). They are a build
  reference only — do not ship them, publish them, or commit them anywhere public.

  Run from the repo root:
      powershell -ExecutionPolicy Bypass -File .\Get-PlaneScreenshots.ps1
#>

$dest = Join-Path $PSScriptRoot 'docs\plane-reference'
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$base = 'https://cdn.arcade.software/cdn-cgi/image/fit=scale-down,format=auto,dpr=2,width=3840/extension-uploads'

$shots = @(
  @{ n='01-list-layout.png';           p='aMn1AOJX3fr7pRLQmGVJ/image/613e3544-5f80-499a-9917-6b89aa3d09fa.png' }
  @{ n='01b-list-inline-edit.png';     p='aMn1AOJX3fr7pRLQmGVJ/image/fddf1bdf-0a7f-4740-8de3-1bf6bc73e1d9.png' }
  @{ n='01c-list-grouped.png';         p='aMn1AOJX3fr7pRLQmGVJ/image/19d77b4f-f9a0-4c71-9ff8-8c251357968d.png' }
  @{ n='02-board-layout.png';          p='OLwTdTUp6uyusI32iidp/image/6fa8e68d-193c-4363-96b3-7d67fcb8be8e.png' }
  @{ n='03-calendar-layout.png';       p='XGoIilNP1NOlUYt9lAAb/image/7b54e9b3-f21d-48f0-826a-f58e691652f7.png' }
  @{ n='03b-calendar-detail.png';      p='XGoIilNP1NOlUYt9lAAb/image/918e8c17-c883-4b4b-a39c-006a9541b090.png' }
  @{ n='04-table-layout.png';          p='TSIc61SiRJavqKmnvmG4/image/da05107f-9e9e-4780-8a8f-d834044c4692.png' }
  @{ n='04b-table-detail.png';         p='TSIc61SiRJavqKmnvmG4/image/d424d69a-feb2-46c0-a140-cc6aa32e27d0.png' }
  @{ n='05-timeline-layout.png';       p='r1R9tGYjkMO0ljiRnmLr/image/5039df1d-7765-4f1a-9d21-7b759ed4d2c4.png' }
)

foreach ($s in $shots) {
  $out = Join-Path $dest $s.n
  try {
    Invoke-WebRequest -Uri "$base/$($s.p)" -OutFile $out -UseBasicParsing
    $kb = [math]::Round((Get-Item $out).Length / 1KB)
    Write-Host ("  OK  {0,-28} {1,6} KB" -f $s.n, $kb) -ForegroundColor Green
  } catch {
    Write-Host ("  FAIL {0,-28} {1}" -f $s.n, $_.Exception.Message) -ForegroundColor Red
  }
}

@"
# Plane UI reference screenshots

Captured from Plane's public documentation (https://docs.plane.so/core-concepts/issues/layouts).
These are Plane's own product screenshots, used here as a build reference for the
KiranOS project management module.

| File | Shows |
| --- | --- |
| 01-list-layout.png | List layout — collapsible group headers, rows with priority icon, item ID, title, right-aligned property pills |
| 01b-list-inline-edit.png | Editing a property inline from the row, without opening the item |
| 01c-list-grouped.png | The same list under a different grouping |
| 02-board-layout.png | Kanban board — columns per state, coloured dot + count in each header, cards with property pills |
| 03-calendar-layout.png | Month grid, items placed on their due date |
| 03b-calendar-detail.png | Calendar with an item open |
| 04-table-layout.png | Spreadsheet layout — one row per item, one column per property |
| 04b-table-detail.png | Table with cells being edited |
| 05-timeline-layout.png | Gantt — bars from start to due date over a scrollable date axis |

**Do not ship these.** They are Plane's copyrighted material and exist only so the
build has something accurate to work from. Keep them out of any public repo or
client deliverable.
"@ | Set-Content -Path (Join-Path $dest 'README.md') -Encoding UTF8

Write-Host "`nSaved to $dest`n" -ForegroundColor Cyan
