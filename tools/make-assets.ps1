# Generates the PNG icons and the Open Graph card for the static site.
# Requires Windows PowerShell (System.Drawing).
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$bg = [System.Drawing.ColorTranslator]::FromHtml("#0a0a0c")
$panel = [System.Drawing.ColorTranslator]::FromHtml("#15151d")
$red = [System.Drawing.ColorTranslator]::FromHtml("#e10600")
$redBright = [System.Drawing.ColorTranslator]::FromHtml("#ff4d4d")
$text = [System.Drawing.ColorTranslator]::FromHtml("#ece9e4")
$muted = [System.Drawing.ColorTranslator]::FromHtml("#9a978f")

function New-Icon {
  param([int]$Size, [string]$Path)

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear($bg)

  $stripe = New-Object System.Drawing.Drawing2D.GraphicsPath
  $stripe.AddPolygon(@(
      (New-Object System.Drawing.Point 0, $Size),
      (New-Object System.Drawing.Point ([int]($Size * 0.45)), 0),
      (New-Object System.Drawing.Point ([int]($Size * 0.70)), 0),
      (New-Object System.Drawing.Point ([int]($Size * 0.22)), $Size)
    ))
  $graphics.FillPath((New-Object System.Drawing.SolidBrush $red), $stripe)

  $thin = New-Object System.Drawing.Drawing2D.GraphicsPath
  $thin.AddPolygon(@(
      (New-Object System.Drawing.Point ([int]($Size * 0.55)), 0),
      (New-Object System.Drawing.Point ([int]($Size * 0.62)), 0),
      (New-Object System.Drawing.Point ([int]($Size * 0.16)), $Size),
      (New-Object System.Drawing.Point ([int]($Size * 0.09)), $Size)
    ))
  $graphics.FillPath((New-Object System.Drawing.SolidBrush $redBright), $thin)

  $font = New-Object System.Drawing.Font("Arial Black", [single]($Size * 0.52), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF 0, 0, $Size, $Size
  $graphics.DrawString("B", $font, (New-Object System.Drawing.SolidBrush $text), $rect, $format)

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-Icon -Size 512 -Path (Join-Path $root "icon-512.png")
New-Icon -Size 192 -Path (Join-Path $root "icon-192.png")
New-Icon -Size 180 -Path (Join-Path $root "apple-touch-icon.png")

# Open Graph card 1200x630
$width = 1200
$height = 630
$og = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($og)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  (New-Object System.Drawing.Rectangle 0, 0, $width, $height),
  [System.Drawing.ColorTranslator]::FromHtml("#17171f"),
  $bg,
  25
)
$g.FillRectangle($gradient, 0, 0, $width, $height)

# Speed stripes on the right
for ($i = 0; $i -lt 6; $i++) {
  $offset = 820 + ($i * 62)
  $points = @(
    (New-Object System.Drawing.Point $offset, $height),
    (New-Object System.Drawing.Point ($offset + 150), 0),
    (New-Object System.Drawing.Point ($offset + 182), 0),
    (New-Object System.Drawing.Point ($offset + 32), $height)
  )
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30 + ($i * 8), $red))
  $g.FillPolygon($brush, $points)
}

$titleFont = New-Object System.Drawing.Font("Arial Black", 112, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$subFont = New-Object System.Drawing.Font("Arial", 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$smallFont = New-Object System.Drawing.Font("Arial", 23, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)

$g.DrawString("BLACKLIST", $titleFont, (New-Object System.Drawing.SolidBrush $text), 78, 150)
$g.FillRectangle((New-Object System.Drawing.SolidBrush $red), 82, 300, 420, 8)
$g.DrawString("F1 2026 · ШАНСЫ НА ТИТУЛ", $subFont, (New-Object System.Drawing.SolidBrush $text), 82, 338)
$g.DrawString("ОЧКИ · МАКСИМУМ ДО ФИНИША · КЛИНЧ · ИНДЕКС", $smallFont, (New-Object System.Drawing.SolidBrush $muted), 82, 410)
$g.DrawString("ПИЛОТЫ И КОМАНДЫ · МАТЕМАТИКА, А НЕ ПРОГНОЗЫ", $smallFont, (New-Object System.Drawing.SolidBrush $muted), 82, 452)
$g.DrawString("pavpl.github.io/f1-blacklist", $smallFont, (New-Object System.Drawing.SolidBrush $redBright), 82, 540)

$og.Save((Join-Path $root "og.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$og.Dispose()

Write-Host "Assets generated in $root"
