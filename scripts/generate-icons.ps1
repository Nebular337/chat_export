$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $root "icons"
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

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

function New-Brush {
  param(
    [string]$Hex
  )

  return New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($Hex))
}

$sizes = @(16, 32, 48, 128, 300)

foreach ($size in $sizes) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $backgroundRect = New-Object System.Drawing.RectangleF(0, 0, ($size - 1), ($size - 1))
    $backgroundPath = New-RoundedRectanglePath -X 0 -Y 0 -Width ($size - 1) -Height ($size - 1) -Radius ([Math]::Max(2, $size * 0.18))
    $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      $backgroundRect,
      [System.Drawing.ColorTranslator]::FromHtml("#1d56c5"),
      [System.Drawing.ColorTranslator]::FromHtml("#6aa7ff"),
      90
    )
    $backgroundBorder = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#123c96"), [Math]::Max(1, $size * 0.04))

    try {
      $graphics.FillPath($backgroundBrush, $backgroundPath)
      $graphics.DrawPath($backgroundBorder, $backgroundPath)
    } finally {
      $backgroundBrush.Dispose()
      $backgroundBorder.Dispose()
      $backgroundPath.Dispose()
    }

    $paperX = [float]($size * 0.29)
    $paperY = [float]($size * 0.12)
    $paperWidth = [float]($size * 0.42)
    $paperHeight = [float]($size * 0.54)
    $paperPath = New-RoundedRectanglePath -X $paperX -Y $paperY -Width $paperWidth -Height $paperHeight -Radius ([Math]::Max(1, $size * 0.05))
    $paperFill = New-Brush "#ffffff"
    $paperBorder = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#d8e3ff"), [Math]::Max(1, $size * 0.025))

    try {
      $graphics.FillPath($paperFill, $paperPath)
      $graphics.DrawPath($paperBorder, $paperPath)
    } finally {
      $paperFill.Dispose()
      $paperBorder.Dispose()
      $paperPath.Dispose()
    }

    $foldSize = [float]($size * 0.09)
    $fold = New-Object System.Drawing.PointF[] 3
    $fold[0] = New-Object System.Drawing.PointF(($paperX + $paperWidth - $foldSize), $paperY)
    $fold[1] = New-Object System.Drawing.PointF(($paperX + $paperWidth), $paperY)
    $fold[2] = New-Object System.Drawing.PointF(($paperX + $paperWidth), ($paperY + $foldSize))
    $foldBrush = New-Brush "#d9e5ff"

    try {
      $graphics.FillPolygon($foldBrush, $fold)
    } finally {
      $foldBrush.Dispose()
    }

    $lineBrush = New-Brush "#2f6fed"
    try {
      foreach ($lineIndex in 0..2) {
        $lineY = $paperY + ($size * 0.11) + ($lineIndex * $size * 0.085)
        $lineWidth = if ($lineIndex -eq 2) { $paperWidth * 0.56 } else { $paperWidth * 0.7 }
        $graphics.FillRectangle($lineBrush, $paperX + ($paperWidth * 0.14), $lineY, $lineWidth, [Math]::Max(1, $size * 0.035))
      }
    } finally {
      $lineBrush.Dispose()
    }

    $printerBody = New-RoundedRectanglePath -X ($size * 0.18) -Y ($size * 0.48) -Width ($size * 0.64) -Height ($size * 0.23) -Radius ([Math]::Max(1, $size * 0.06))
    $printerFill = New-Brush "#11357f"
    $printerHighlight = New-Brush "#f5f8ff"

    try {
      $graphics.FillPath($printerFill, $printerBody)
      $graphics.FillRectangle($printerHighlight, $size * 0.27, $size * 0.57, $size * 0.46, [Math]::Max(1, $size * 0.045))
    } finally {
      $printerFill.Dispose()
      $printerHighlight.Dispose()
      $printerBody.Dispose()
    }

    $trayPath = New-RoundedRectanglePath -X ($size * 0.24) -Y ($size * 0.68) -Width ($size * 0.52) -Height ($size * 0.11) -Radius ([Math]::Max(1, $size * 0.03))
    $trayFill = New-Brush "#dce7ff"
    try {
      $graphics.FillPath($trayFill, $trayPath)
    } finally {
      $trayFill.Dispose()
      $trayPath.Dispose()
    }

    $statusDotBrush = New-Brush "#7ef0a6"
    try {
      $dotSize = [float]($size * 0.07)
      $graphics.FillEllipse($statusDotBrush, $size * 0.68, $size * 0.54, $dotSize, $dotSize)
    } finally {
      $statusDotBrush.Dispose()
    }

    $fileName = "icon-$size.png"
    $outputPath = Join-Path $iconsDir $fileName
    $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

Write-Host "Generated icons in $iconsDir"
