Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

$S = 1024
$bmp = New-Object System.Drawing.Bitmap -ArgumentList $S, $S
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.Color]::Transparent)

# ---- rounded square background ----
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$r = 200
$path.AddArc(0, 0, $r*2, $r*2, 180, 90)
$path.AddArc($S - $r*2, 0, $r*2, $r*2, 270, 90)
$path.AddArc($S - $r*2, $S - $r*2, $r*2, $r*2, 0, 90)
$path.AddArc(0, $S - $r*2, $r*2, $r*2, 90, 90)
$path.CloseFigure()
$g.SetClip($path)

$rect = New-Object System.Drawing.Rectangle -ArgumentList 0, 0, $S, $S
$bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $rect, ([System.Drawing.Color]::FromArgb(255,30,58,138)), ([System.Drawing.Color]::FromArgb(255,124,58,237)), 60
$g.FillRectangle($bgBrush, 0, 0, $S, $S)

# ---- Italian tricolor band (green / white / red) ----
$bandH = 300
$w = [int]($S/3)
$green = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(255,0,146,70))
$white = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(255,255,255,255))
$red   = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(255,206,43,55))
$g.FillRectangle($green, 0, 0, $w, $bandH)
$g.FillRectangle($white, $w, 0, $w, $bandH)
$g.FillRectangle($red, $w*2, 0, $S - $w*2, $bandH)

# soft shadow under band
$sr = New-Object System.Drawing.Rectangle -ArgumentList 0, $bandH, $S, 120
$shadow = New-Object System.Drawing.Drawing2D.LinearGradientBrush -ArgumentList $sr, ([System.Drawing.Color]::FromArgb(80,0,0,0)), ([System.Drawing.Color]::FromArgb(0,0,0,0)), ([System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
$g.FillRectangle($shadow, 0, $bandH, $S, 120)

# ---- "IT" as vector path (outline + gold fill) ----
$ff = New-Object System.Drawing.FontFamily -ArgumentList 'Segoe UI'
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = 'Center'
$sf.LineAlignment = 'Center'
$gp = New-Object System.Drawing.Drawing2D.GraphicsPath
$itStyle = [System.Drawing.FontStyle]::Bold
$gp.AddString('IT', $ff, [int]$itStyle, 430, (New-Object System.Drawing.PointF -ArgumentList 0, 320), $sf)
$penDark = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::FromArgb(255,10,18,40)), 24
$penDark.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$goldBrush = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(255,255,215,0))
$g.DrawPath($penDark, $gp)
$g.FillPath($goldBrush, $gp)

# ---- Ncx badge ----
$badgeW = 520; $badgeH = 220
$badgeX = [int](($S - $badgeW)/2); $badgeY = 760
$badgePath = New-Object System.Drawing.Drawing2D.GraphicsPath
$br = 70
$badgePath.AddArc($badgeX, $badgeY, $br*2, $br*2, 180, 90)
$badgePath.AddArc($badgeX + $badgeW - $br*2, $badgeY, $br*2, $br*2, 270, 90)
$badgePath.AddArc($badgeX + $badgeW - $br*2, $badgeY + $badgeH - $br*2, $br*2, $br*2, 0, 90)
$badgePath.AddArc($badgeX, $badgeY + $badgeH - $br*2, $br*2, $br*2, 90, 90)
$badgePath.CloseFigure()
$badgeBrush = New-Object System.Drawing.SolidBrush -ArgumentList ([System.Drawing.Color]::FromArgb(240,10,18,40))
$g.FillPath($badgeBrush, $badgePath)
$penGold = New-Object System.Drawing.Pen -ArgumentList ([System.Drawing.Color]::FromArgb(255,255,215,0)), 8
$g.DrawPath($penGold, $badgePath)

$ncxPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$ncxPath.AddString('Ncx', $ff, [int]$itStyle, 160, (New-Object System.Drawing.PointF -ArgumentList $badgeX, $badgeY), $sf)
$g.FillPath($goldBrush, $ncxPath)

$g.Dispose()
$bmp.Save("C:\Users\-\Documents\Default Project\italiano-app\app-image.png", [System.Drawing.Imaging.ImageFormat]::Png)

$bmp2 = New-Object System.Drawing.Bitmap -ArgumentList 512, 512
$g2 = [System.Drawing.Graphics]::FromImage($bmp2)
$g2.InterpolationMode = 'HighQualityBicubic'
$g2.DrawImage($bmp, 0, 0, 512, 512)
$g2.Dispose()
$bmp2.Save("C:\Users\-\Documents\Default Project\italiano-app\app-image-512.png", [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "OK: app-image.png + app-image-512.png"
