$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assetsDir = Join-Path $root "store\assets"
$iconPath = Join-Path $root "icons\icon-300.png"

if (-not (Test-Path $iconPath)) {
  throw "Missing icon file at $iconPath. Run the icon generator first."
}

New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

function New-Brush {
  param([string]$Hex)
  return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($Hex))
}

function New-RoundedRectanglePath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = [Math]::Min($Radius * 2, [Math]::Min($Width, $Height))

  if ($diameter -le 0) {
    $path.AddRectangle((New-Object System.Drawing.RectangleF($X, $Y, $Width, $Height)))
    return $path
  }

  $arcRect = New-Object System.Drawing.RectangleF($X, $Y, $diameter, $diameter)
  $path.AddArc($arcRect, 180, 90)
  $arcRect.X = $X + $Width - $diameter
  $path.AddArc($arcRect, 270, 90)
  $arcRect.Y = $Y + $Height - $diameter
  $path.AddArc($arcRect, 0, 90)
  $arcRect.X = $X
  $path.AddArc($arcRect, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-Tile {
  param(
    [int]$Width,
    [int]$Height,
    [string]$Headline,
    [string]$Subhead,
    [string]$Footer,
    [string]$OutFile
  )

  $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $iconImage = [System.Drawing.Image]::FromFile($iconPath)

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $fullRect = [System.Drawing.RectangleF]::new([single]0, [single]0, [single]$Width, [single]$Height)
    $background = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      $fullRect,
      [System.Drawing.ColorTranslator]::FromHtml("#0f2d64"),
      [System.Drawing.ColorTranslator]::FromHtml("#6ea9ff"),
      0
    )

    try {
      $graphics.FillRectangle($background, $fullRect)
    } finally {
      $background.Dispose()
    }

    $overlayPath = New-RoundedRectanglePath -X ($Width * 0.03) -Y ($Height * 0.1) -Width ($Width * 0.94) -Height ($Height * 0.8) -Radius ([Math]::Max(12, $Height * 0.08))
    $overlayBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(38, 255, 255, 255))
    try {
      $graphics.FillPath($overlayBrush, $overlayPath)
    } finally {
      $overlayBrush.Dispose()
      $overlayPath.Dispose()
    }

    $iconSize = [int]([Math]::Min($Height * 0.56, $Width * 0.22))
    $iconX = [int]($Width * 0.07)
    $iconY = [int](($Height - $iconSize) / 2)
    $graphics.DrawImage($iconImage, $iconX, $iconY, $iconSize, $iconSize)

    $headlineFont = [System.Drawing.Font]::new("Segoe UI Semibold", [single]([Math]::Max(18, $Height * 0.12)), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $subheadFont = [System.Drawing.Font]::new("Segoe UI", [single]([Math]::Max(12, $Height * 0.06)), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $footerFont = [System.Drawing.Font]::new("Segoe UI", [single]([Math]::Max(10, $Height * 0.04)), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $whiteBrush = New-Brush "#ffffff"
    $softBrush = New-Brush "#d7e6ff"

    try {
      $textX = $iconX + $iconSize + ($Width * 0.06)
      $headlineRect = [System.Drawing.RectangleF]::new([single]$textX, [single]($Height * 0.19), [single]($Width * 0.56), [single]($Height * 0.28))
      $subheadRect = [System.Drawing.RectangleF]::new([single]$textX, [single]($Height * 0.46), [single]($Width * 0.56), [single]($Height * 0.2))
      $footerRect = [System.Drawing.RectangleF]::new([single]$textX, [single]($Height * 0.72), [single]($Width * 0.56), [single]($Height * 0.1))

      $stringFormat = New-Object System.Drawing.StringFormat
      $stringFormat.Alignment = [System.Drawing.StringAlignment]::Near
      $stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Near

      $graphics.DrawString($Headline, $headlineFont, $whiteBrush, $headlineRect, $stringFormat)
      $graphics.DrawString($Subhead, $subheadFont, $softBrush, $subheadRect, $stringFormat)
      $graphics.DrawString($Footer, $footerFont, $softBrush, $footerRect, $stringFormat)

      $stringFormat.Dispose()
    } finally {
      $headlineFont.Dispose()
      $subheadFont.Dispose()
      $footerFont.Dispose()
      $whiteBrush.Dispose()
      $softBrush.Dispose()
    }

    $bitmap.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $iconImage.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

Draw-Tile -Width 440 -Height 280 -Headline "Export Copilot Chat" -Subhead "Print-friendly transcript preview" -Footer "Independent Edge extension" -OutFile (Join-Path $assetsDir "small-promotional-tile.png")
Draw-Tile -Width 1400 -Height 560 -Headline "Copilot Chat Exporter" -Subhead "Export Microsoft 365 Copilot Chat to a clean print preview" -Footer "Independent Edge extension" -OutFile (Join-Path $assetsDir "large-promotional-tile.png")

Copy-Item -LiteralPath $iconPath -Destination (Join-Path $assetsDir "store-logo-300.png") -Force

Write-Host "Generated store assets in $assetsDir"
