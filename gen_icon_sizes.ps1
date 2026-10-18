Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$src = 'C:\Users\-\Downloads\Classical Scholar Against the Italian Tricolor.png'
$base = 'C:\Users\-\Documents\Default Project\italiano-app'

$img = [System.Drawing.Image]::FromFile($src)
$min = [Math]::Min($img.Width, $img.Height)
$sx = [int](($img.Width - $min) / 2)
$sy = [int](($img.Height - $min) / 2)
$srcRect = New-Object System.Drawing.Rectangle -ArgumentList $sx, $sy, $min, $min

function Save-Sized([int]$size, [string]$outFile, [string]$format) {
  $b = New-Object System.Drawing.Bitmap -ArgumentList $size, $size
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'AntiAlias'
  $g.DrawImage($script:img, (New-Object System.Drawing.Rectangle -ArgumentList 0,0,$size,$size), $script:srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  if ($format -eq 'jpg') {
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $params = New-Object System.Drawing.Imaging.EncoderParameters -ArgumentList 1
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter -ArgumentList ([System.Drawing.Imaging.Encoder]::Quality), ([long]85)
    $b.Save($outFile, $codec, $params)
  } else {
    $b.Save($outFile, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  $b.Dispose()
  $kb = [math]::Round((Get-Item $outFile).Length / 1KB)
  Write-Host ("  {0,-24} {1,4}x{1,-4} {2,5} KB" -f (Split-Path $outFile -Leaf), $size, $kb)
}

Write-Host "Generated sizes:"
Save-Sized 512 (Join-Path $base 'icon.png') 'png'
Save-Sized 192 (Join-Path $base 'icon-192.png') 'png'
Save-Sized 180 (Join-Path $base 'apple-touch-icon.png') 'png'
Save-Sized 32 (Join-Path $base 'favicon-32.png') 'png'

$img.Dispose()
Write-Host "Done."
