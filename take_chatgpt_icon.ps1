Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$src = 'C:\Users\-\Downloads\Classical Scholar Against the Italian Tricolor.png'
$out = 'C:\Users\-\Documents\Default Project\italiano-app'

$img = [System.Drawing.Image]::FromFile($src)
$min = [Math]::Min($img.Width, $img.Height)
$sx = [int](($img.Width - $min) / 2)
$sy = [int](($img.Height - $min) / 2)

# full-res square crop 1024
$full = New-Object System.Drawing.Bitmap -ArgumentList 1024, 1024
$gf = [System.Drawing.Graphics]::FromImage($full)
$gf.InterpolationMode = 'HighQualityBicubic'
$gf.DrawImage($img, (New-Object System.Drawing.Rectangle -ArgumentList 0,0,1024,1024), (New-Object System.Drawing.Rectangle -ArgumentList $sx,$sy,$min,$min), [System.Drawing.GraphicsUnit]::Pixel)
$gf.Dispose()
$full.Save((Join-Path $out 'app-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)

# 512 png (PWA)
$png512 = New-Object System.Drawing.Bitmap -ArgumentList 512, 512
$g1 = [System.Drawing.Graphics]::FromImage($png512)
$g1.InterpolationMode = 'HighQualityBicubic'
$g1.DrawImage($full, 0, 0, 512, 512)
$g1.Dispose()
$png512.Save((Join-Path $out 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)

# ICO: 256 / 48 / 32 / 16
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter -ArgumentList $ms
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]4)
$sizes = @(256,48,32,16)
$offset = 6
$pngBytes = @()
foreach ($s in $sizes) {
  $b = New-Object System.Drawing.Bitmap -ArgumentList $s, $s
  $gb = [System.Drawing.Graphics]::FromImage($b)
  $gb.InterpolationMode = 'HighQualityBicubic'
  $gb.DrawImage($full, 0, 0, $s, $s)
  $gb.Dispose()
  $ms2 = New-Object System.IO.MemoryStream
  $b.Save($ms2, [System.Drawing.Imaging.ImageFormat]::Png)
  $b.Dispose()
  $data = $ms2.ToArray()
  $pngBytes += ,$data
  if ($s -eq 256) { $bw.Write([byte]0) } else { $bw.Write([byte]$s) }
  $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([byte]1); $bw.Write([byte]0)
  $bw.Write([uint16]32)
  $bw.Write([uint32]$data.Length)
  $bw.Write([uint32]$offset)
  $offset += $data.Length
}
foreach ($d in $pngBytes) { $bw.Write($d) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $out 'icon.ico'), $ms.ToArray())
$bw.Dispose()
$full.Dispose(); $png512.Dispose(); $img.Dispose()

Write-Host "OK: icon.ico + icon.png + app-icon.png from ChatGPT image"
