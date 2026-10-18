Add-Type -AssemblyName System.Drawing
function Get-Avg([System.Drawing.Image]$img) {
  $b = New-Object System.Drawing.Bitmap -ArgumentList 16,16
  $g = [System.Drawing.Graphics]::FromImage($b)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.DrawImage($img, 0, 0, 16, 16)
  $g.Dispose()
  $r=0;$gr=0;$bl=0
  for($x=0;$x -lt 16;$x++){for($y=0;$y -lt 16;$y++){$c=$b.GetPixel($x,$y);$r+=$c.R;$gr+=$c.G;$bl+=$c.B}}
  $b.Dispose()
  return ,@([int]($r/256),[int]($gr/256),[int]($bl/256))
}
function Diff($a,$b){ return [int]( [Math]::Abs($a[0]-$b[0]) + [Math]::Abs($a[1]-$b[1]) + [Math]::Abs($a[2]-$b[2]) ) }

$base = 'C:\Users\-\Documents\Default Project\italiano-app'
$srcImg = [System.Drawing.Image]::FromFile("$base\icon.png")
$srcAvg = Get-Avg $srcImg
$srcImg.Dispose()
Write-Host "SOURCE avg: $($srcAvg -join ',')"

$exes = @('dist\IT Ncx Setup 1.0.0.exe', 'dist\IT Ncx 1.0.0.exe', 'dist\win-unpacked\IT Ncx.exe')
foreach ($e in $exes) {
  $full = Join-Path $base $e
  if (!(Test-Path $full)) { Write-Host "$e : NOT BUILT YET"; continue }
  $ico = [System.Drawing.Icon]::ExtractAssociatedIcon($full)
  $bmp = $ico.ToBitmap()
  $avg = Get-Avg $bmp
  $bmp.Dispose()
  $d = Diff $srcAvg $avg
  $ok = if ($d -lt 60) { 'MATCH' } else { 'DIFFERENT' }
  Write-Host "$e -> avg $($avg -join ',') diff=$d [$ok]"
  Start-Sleep -Milliseconds 200
}
