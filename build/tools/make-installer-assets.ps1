param(
  [string]$SpecPath = (Join-Path $PSScriptRoot 'installer-assets.json'),
  [string]$OutDir = (Split-Path -Parent $PSScriptRoot)
)

Add-Type -AssemblyName System.Drawing

$spec = [System.IO.File]::ReadAllText($SpecPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }

function C([string]$hex) { return [System.Drawing.ColorTranslator]::FromHtml($hex) }

function New-RoundedPath([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [single]($r * 2)
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc(($x + $w - $d), $y, $d, $d, 270, 90)
  $p.AddArc(($x + $w - $d), ($y + $h - $d), $d, $d, 0, 90)
  $p.AddArc($x, ($y + $h - $d), $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function Add-YMark($g, [single]$x, [single]$y, [single]$size) {
  $s = [single]($size / 256.0)
  $path = New-RoundedPath $x $y $size $size ([single](40 * $s))
  $brush = New-Object System.Drawing.SolidBrush (C $spec.accent)
  $g.FillPath($brush, $path)
  $brush.Dispose()

  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ([single](21.6 * $s))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $pts = New-Object 'System.Drawing.PointF[]' 3
  $pts[0] = New-Object System.Drawing.PointF ([single]($x + 75.2 * $s)), ([single]($y + 68.8 * $s))
  $pts[1] = New-Object System.Drawing.PointF ([single]($x + 128.0 * $s)), ([single]($y + 137.6 * $s))
  $pts[2] = New-Object System.Drawing.PointF ([single]($x + 128.0 * $s)), ([single]($y + 195.2 * $s))
  $g.DrawLines($pen, $pts)
  $pen.Dispose()

  $pen2 = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(184, 255, 255, 255)), ([single](21.6 * $s))
  $pen2.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen2.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($pen2, ([single]($x + 180.8 * $s)), ([single]($y + 68.8 * $s)), ([single]($x + 128.0 * $s)), ([single]($y + 137.6 * $s)))
  $pen2.Dispose()
}

function Set-Graphics($g) {
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
}

function New-Font([string]$family, [single]$px, [string]$style) {
  $fs = [System.Drawing.FontStyle]::Regular
  if ($style -eq "bold") { $fs = [System.Drawing.FontStyle]::Bold }
  return New-Object System.Drawing.Font ($family), $px, $fs, ([System.Drawing.GraphicsUnit]::Pixel)
}

# ---------------- icon.ico ----------------
$sizes = @(256, 128, 64, 48, 32, 24, 16)
$blobs = @()
foreach ($sz in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap ($sz), ($sz), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  Set-Graphics $g
  $g.Clear([System.Drawing.Color]::Transparent)
  Add-YMark $g 0 0 ([single]$sz)
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $blobs += , $ms.ToArray()
  $ms.Dispose()
  $g.Dispose()
  $bmp.Dispose()
}

$icoPath = Join-Path $OutDir "icon.ico"
$fs = [System.IO.File]::Create($icoPath)
$bw = New-Object System.IO.BinaryWriter ($fs)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $sz = $sizes[$i]
  $b = 0
  if ($sz -lt 256) { $b = $sz }
  $bw.Write([Byte]$b)
  $bw.Write([Byte]$b)
  $bw.Write([Byte]0)
  $bw.Write([Byte]0)
  $bw.Write([UInt16]1)
  $bw.Write([UInt16]32)
  $bw.Write([UInt32]$blobs[$i].Length)
  $bw.Write([UInt32]$offset)
  $offset += $blobs[$i].Length
}
foreach ($blob in $blobs) { $bw.Write($blob) }
$bw.Flush()
$bw.Close()
$fs.Close()

# preview png
$prev = New-Object System.Drawing.Bitmap (256), (256), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$pg = [System.Drawing.Graphics]::FromImage($prev)
Set-Graphics $pg
$pg.Clear([System.Drawing.Color]::Transparent)
Add-YMark $pg 0 0 256
$prev.Save((Join-Path $OutDir "icon-preview.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$pg.Dispose()
$prev.Dispose()

# ---------------- header 150x57 ----------------
$hb = New-Object System.Drawing.Bitmap (150), (57), ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$hg = [System.Drawing.Graphics]::FromImage($hb)
Set-Graphics $hg
$hg.Clear([System.Drawing.Color]::White)
$line = New-Object System.Drawing.Pen (C "#E5E7EB"), 1
$hg.DrawLine($line, 0, 12, 0, 45)
$hg.DrawLine($line, 0, 56, 150, 56)
$line.Dispose()
Add-YMark $hg 16 16 24
$fb = New-Font "Microsoft YaHei" 10.5 "bold"
$b1 = New-Object System.Drawing.SolidBrush (C "#111827")
$hg.DrawString($spec.short, $fb, $b1, 48, 12)
$b1.Dispose()
$fb.Dispose()
$fv = New-Font "Consolas" 8 "regular"
$b2 = New-Object System.Drawing.SolidBrush (C "#6B7280")
$hg.DrawString($spec.headerVersion, $fv, $b2, 48, 30)
$b2.Dispose()
$fv.Dispose()
$hb.Save((Join-Path $OutDir "installerHeader.bmp"), [System.Drawing.Imaging.ImageFormat]::Bmp)
$hg.Dispose()
$hb.Dispose()

# ---------------- sidebar ----------------
function New-Sidebar([string]$label, $steps, [string]$file) {
  $bmp = New-Object System.Drawing.Bitmap (164), (314), ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  Set-Graphics $g
  $g.Clear((C $spec.bg))

  $edge = New-Object System.Drawing.SolidBrush (C $spec.border)
  $g.FillRectangle($edge, 163, 0, 1, 314)
  $edge.Dispose()

  Add-YMark $g 18 22 34

  $fName = New-Font "Microsoft YaHei" 11 "bold"
  $bName = New-Object System.Drawing.SolidBrush (C $spec.text)
  $g.DrawString($spec.brand, $fName, $bName, 18, 68)
  $bName.Dispose()
  $fName.Dispose()

  $fSub = New-Font "Microsoft YaHei" 7.5 "regular"
  $bSub = New-Object System.Drawing.SolidBrush (C $spec.text3)
  $g.DrawString($spec.product, $fSub, $bSub, 18, 87)
  $bSub.Dispose()
  $fSub.Dispose()

  $div = New-Object System.Drawing.Pen (C $spec.border), 1
  $g.DrawLine($div, 18, 106, 146, 106)

  $fLabel = New-Font "Microsoft YaHei" 7.5 "regular"
  $bLabel = New-Object System.Drawing.SolidBrush (C $spec.text4)
  $g.DrawString($label, $fLabel, $bLabel, 18, 114)
  $bLabel.Dispose()
  $fLabel.Dispose()

  $fVer = New-Font "Consolas" 7.5 "regular"
  $bVer = New-Object System.Drawing.SolidBrush (C $spec.text3)
  $g.DrawString($spec.version, $fVer, $bVer, 18, 129)
  $bVer.Dispose()
  $fVer.Dispose()

  $fNum = New-Font "Consolas" 7.5 "bold"
  $fStep = New-Font "Microsoft YaHei" 8.5 "regular"
  $bNum = New-Object System.Drawing.SolidBrush (C $spec.text3)
  $bStep = New-Object System.Drawing.SolidBrush (C $spec.text2)
  $sep = New-Object System.Drawing.Pen (C $spec.border), 1
  $y = 158
  for ($i = 0; $i -lt $steps.Count; $i++) {
    $g.DrawString(("{0:00}" -f ($i + 1)), $fNum, $bNum, 18, $y)
    $g.DrawString($steps[$i], $fStep, $bStep, 42, ($y - 1))
    if ($i -lt ($steps.Count - 1)) {
      $g.DrawLine($sep, 18, ($y + 20), 146, ($y + 20))
    }
    $y += 30
  }
  $sep.Dispose()
  $bNum.Dispose()
  $bStep.Dispose()
  $fNum.Dispose()
  $fStep.Dispose()

  $g.DrawLine($div, 18, 276, 146, 276)
  $div.Dispose()

  $fFoot = New-Font "Consolas" 7 "regular"
  $bFoot = New-Object System.Drawing.SolidBrush (C $spec.text4)
  $g.DrawString($spec.platform, $fFoot, $bFoot, 18, 285)
  $bFoot.Dispose()
  $fFoot.Dispose()

  $bmp.Save((Join-Path $OutDir $file), [System.Drawing.Imaging.ImageFormat]::Bmp)
  $g.Dispose()
  $bmp.Dispose()
}

New-Sidebar $spec.installLabel $spec.installSteps "installerSidebar.bmp"
New-Sidebar $spec.uninstallLabel $spec.uninstallSteps "uninstallerSidebar.bmp"

Get-ChildItem $OutDir | Select-Object Name, Length
