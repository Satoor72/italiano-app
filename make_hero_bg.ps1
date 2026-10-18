Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$src = 'C:\Users\-\Downloads\Italia_ A History in Infinite Layers.png'
$base = 'C:\Users\-\Documents\Default Project\italiano-app'

$img = [System.Drawing.Image]::FromFile($src)
$w = 1280; $h = [int]($img.Height * (1280 / $img.Width))
$bmp = New-Object System.Drawing.Bitmap -ArgumentList $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = 'HighQualityBicubic'
$g.DrawImage($img, 0, 0, $w, $h)
$g.Dispose(); $img.Dispose()

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters -ArgumentList 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter -ArgumentList ([System.Drawing.Imaging.Encoder]::Quality), ([long]75)
$bmp.Save((Join-Path $base 'hero-bg.jpg'), $codec, $params)
$bmp.Dispose()

$size = [math]::Round((Get-Item (Join-Path $base 'hero-bg.jpg')).Length / 1KB)
Write-Host "hero-bg.jpg: ${w}x${h} = ${size}KB"
