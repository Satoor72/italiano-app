Add-Type -AssemblyName System.Drawing
$w = 256; $h = 256
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAlias'

$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, [System.Drawing.Color]::FromArgb(255,37,99,235), [System.Drawing.Color]::FromArgb(255,124,58,237), 45)
$g.FillRectangle($brush, $rect)

$font1 = New-Object System.Drawing.Font('Segoe UI', 96, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$font2 = New-Object System.Drawing.Font('Segoe UI', 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$white = [System.Drawing.Brushes]::White
$gold = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,255,215,0))
$dark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,30,58,138))

$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Center'

$g.DrawString('IT', $font1, $white, (New-Object System.Drawing.RectangleF(0, 40, 256, 130)), $sf)
$g.FillEllipse($gold, 78, 175, 100, 60)
$g.DrawString('Ncx', $font2, $dark, (New-Object System.Drawing.RectangleF(78, 175, 100, 60)), $sf)

# Save PNG 256
$bmp.Save("C:\Users\-\Documents\Default Project\italiano-app\icon.png", [System.Drawing.Imaging.ImageFormat]::Png)

# Build ICO with 256 + 48 + 32 sizes
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]4)
$sizes = @(256,48,32,16)
$offset = 6
$pngs = @()
foreach ($s in $sizes) {
  if ($s -eq 256) { $pngData = [System.IO.File]::ReadAllBytes("C:\Users\-\Documents\Default Project\italiano-app\icon.png") }
  else {
    $small = New-Object System.Drawing.Bitmap($s, $s)
    $sg = [System.Drawing.Graphics]::FromImage($small)
    $sg.InterpolationMode = 'HighQualityBicubic'
    $sg.DrawImage($bmp, 0, 0, $s, $s)
    $sg.Dispose()
    $ms2 = New-Object System.IO.MemoryStream
    $small.Save($ms2, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngData = $ms2.ToArray()
    $small.Dispose()
  }
  $pngs += ,$pngData
  if ($s -eq 256) { $bw.Write([byte]0) } else { $bw.Write([byte]$s) }
  $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([byte]1); $bw.Write([byte]0)
  $bw.Write([uint16]32)
  $bw.Write([uint32]$pngData.Length)
  $bw.Write([uint32]$offset)
  $offset += $pngData.Length
}
foreach ($p in $pngs) { $bw.Write($p) }
$bw.Flush()
[System.IO.File]::WriteAllBytes("C:\Users\-\Documents\Default Project\italiano-app\icon.ico", $ms.ToArray())
$bw.Dispose(); $g.Dispose(); $bmp.Dispose()
Write-Host "icon.ico created: $((Get-Item 'C:\Users\-\Documents\Default Project\italiano-app\icon.ico').Length) bytes"
