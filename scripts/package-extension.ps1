$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$distDir = Join-Path $root "dist"
$stagingDir = Join-Path $distDir "package"
$manifestPath = Join-Path $root "manifest.json"
$manifest = Get-Content -Raw $manifestPath | ConvertFrom-Json

New-Item -ItemType Directory -Force -Path $distDir | Out-Null

if (Test-Path $stagingDir) {
  Remove-Item -LiteralPath $stagingDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $stagingDir | Out-Null

$packageItems = @(
  "manifest.json",
  "service-worker.js",
  "content",
  "lib",
  "preview",
  "icons"
)

foreach ($item in $packageItems) {
  Copy-Item -LiteralPath (Join-Path $root $item) -Destination $stagingDir -Recurse -Force
}

$zipName = "chat-exporter-edge-v{0}.zip" -f $manifest.version
$zipPath = Join-Path $distDir $zipName

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
Remove-Item -LiteralPath $stagingDir -Recurse -Force

Write-Host "Created $zipPath"
