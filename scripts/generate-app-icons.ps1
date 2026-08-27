# Gera icones de launcher iOS/Android a partir do logo final (nao usar o placeholder Capacitor).
# Uso: powershell -ExecutionPolicy Bypass -File scripts/generate-app-icons.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$logoPath = Join-Path $root 'src\assets\icon\logo_controle_de_bola.png'
if (-not (Test-Path $logoPath)) {
  throw "Logo nao encontrado: $logoPath"
}

function New-SquarePng {
  param(
    [string]$SourcePath,
    [string]$DestPath,
    [int]$Size,
    [double]$PaddingRatio = 0.08
  )

  $src = [System.Drawing.Image]::FromFile($SourcePath)
  try {
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.Clear([System.Drawing.Color]::White)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $pad = [int][Math]::Round($Size * $PaddingRatio)
      $inner = $Size - (2 * $pad)
      $g.DrawImage($src, $pad, $pad, $inner, $inner)
      $dir = Split-Path -Parent $DestPath
      if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
      }
      $bmp.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
      $g.Dispose()
      $bmp.Dispose()
    }
  }
  finally {
    $src.Dispose()
  }
}

$resources = Join-Path $root 'resources'
New-SquarePng -SourcePath $logoPath -DestPath (Join-Path $resources 'icon.png') -Size 1024 -PaddingRatio 0.06

$iosIconDir = Join-Path $root 'ios-config\AppIcon.appiconset'
New-SquarePng -SourcePath $logoPath -DestPath (Join-Path $iosIconDir 'AppIcon-1024.png') -Size 1024 -PaddingRatio 0.06

$androidSizes = @{
  'mipmap-ldpi'    = @{ launcher = 36;  foreground = 81  }
  'mipmap-mdpi'    = @{ launcher = 48;  foreground = 108 }
  'mipmap-hdpi'    = @{ launcher = 72;  foreground = 162 }
  'mipmap-xhdpi'   = @{ launcher = 96;  foreground = 216 }
  'mipmap-xxhdpi'  = @{ launcher = 144; foreground = 324 }
  'mipmap-xxxhdpi' = @{ launcher = 192; foreground = 432 }
}

$resRoot = Join-Path $root 'android\app\src\main\res'
foreach ($folder in $androidSizes.Keys) {
  $sizes = $androidSizes[$folder]
  $dir = Join-Path $resRoot $folder
  New-SquarePng -SourcePath $logoPath -DestPath (Join-Path $dir 'ic_launcher.png') -Size $sizes.launcher -PaddingRatio 0.06
  New-SquarePng -SourcePath $logoPath -DestPath (Join-Path $dir 'ic_launcher_round.png') -Size $sizes.launcher -PaddingRatio 0.06
  New-SquarePng -SourcePath $logoPath -DestPath (Join-Path $dir 'ic_launcher_foreground.png') -Size $sizes.foreground -PaddingRatio 0.14
  New-SquarePng -SourcePath $logoPath -DestPath (Join-Path $dir 'ic_launcher_background.png') -Size $sizes.foreground -PaddingRatio 1.0
}

Write-Host "Icones gerados em resources/, ios-config/AppIcon.appiconset/ e android mipmaps."
