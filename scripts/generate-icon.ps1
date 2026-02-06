# 生成 EGE 图标用于 Dev-C++ 模板
# 输出：assets/templates/devcpp/ege-template.ico (< 5KB)
# 格式：传统 BMP 位图格式（非 PNG 压缩）以兼容 Dev-C++ 5.11

Add-Type -AssemblyName System.Drawing

$outputPath = Join-Path $PSScriptRoot "..\assets\templates\devcpp\ege-template.ico"

# 创建 32x32 图标（Dev-C++ 主要使用这个尺寸）
$size = 32
$bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)

# 启用抗锯齿
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

# 背景：白色
$whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
$graphics.FillRectangle($whiteBrush, $rect)

# 绘制蓝色边框
$bluePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 41, 128, 185), 2)
$graphics.DrawRectangle($bluePen, 1, 1, $size - 3, $size - 3)

# 绘制 "EGE" 文字（蓝色，合适字号确保三个字母完整显示）
$text = "EGE"
$fontFamily = [System.Drawing.FontFamily]::GenericSansSerif
$fontSize = 7  # 进一步减小字号确保三个字母都能显示
$font = New-Object System.Drawing.Font($fontFamily, $fontSize, [System.Drawing.FontStyle]::Bold)
$textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 41, 128, 185))  # 蓝色文字

# 计算文字居中位置（禁止换行）
$stringFormat = New-Object System.Drawing.StringFormat
$stringFormat.Alignment = [System.Drawing.StringAlignment]::Center
$stringFormat.LineAlignment = [System.Drawing.StringAlignment]::Center
$stringFormat.FormatFlags = [System.Drawing.StringFormatFlags]::NoWrap  # 禁止换行
[int]$rectWidth = $size - 4
$textRect = New-Object System.Drawing.RectangleF([float]2, [float]0, [float]$rectWidth, [float]$size)

# 绘制主文字（不需要阴影，白底上蓝字对比度足够）
$graphics.DrawString($text, $font, $textBrush, $textRect, $stringFormat)

# 清理 GDI+ 资源
$graphics.Dispose()
$whiteBrush.Dispose()
$bluePen.Dispose()
$textBrush.Dispose()
$font.Dispose()
$stringFormat.Dispose()

# 手动创建 ICO 文件（传统 BMP DIB 格式，非 PNG 压缩）
# 这是为了兼容 Dev-C++ 5.11，它不支持 PNG 压缩的 ICO

$ms = New-Object System.IO.MemoryStream

# 将 Bitmap 转换为 32bpp ARGB DIB 数据
$bmpData = $bitmap.LockBits(
    (New-Object System.Drawing.Rectangle(0, 0, $size, $size)),
    [System.Drawing.Imaging.ImageLockMode]::ReadOnly,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
)

$stride = $bmpData.Stride
$scan0 = $bmpData.Scan0
$bytes = New-Object byte[]($stride * $size)
[System.Runtime.InteropServices.Marshal]::Copy($scan0, $bytes, 0, $bytes.Length)
$bitmap.UnlockBits($bmpData)

# 创建 BITMAPINFOHEADER (40 bytes)
$dibHeader = New-Object byte[](40)
[System.BitConverter]::GetBytes([uint32]40).CopyTo($dibHeader, 0)          # biSize
[System.BitConverter]::GetBytes([int32]$size).CopyTo($dibHeader, 4)        # biWidth
[System.BitConverter]::GetBytes([int32]($size * 2)).CopyTo($dibHeader, 8)  # biHeight (x2 for XOR+AND masks)
[System.BitConverter]::GetBytes([uint16]1).CopyTo($dibHeader, 12)          # biPlanes
[System.BitConverter]::GetBytes([uint16]32).CopyTo($dibHeader, 14)         # biBitCount
[System.BitConverter]::GetBytes([uint32]0).CopyTo($dibHeader, 16)          # biCompression (BI_RGB)
[System.BitConverter]::GetBytes([uint32]($bytes.Length)).CopyTo($dibHeader, 20) # biSizeImage

# 翻转图像数据（BMP 是从下到上存储）
$flippedBytes = New-Object byte[]($bytes.Length)
for ($y = 0; $y -lt $size; $y++) {
    $srcOffset = $y * $stride
    $dstOffset = ($size - 1 - $y) * $stride
    [Array]::Copy($bytes, $srcOffset, $flippedBytes, $dstOffset, $stride)
}

# 创建 AND mask (全部透明)
$andMaskSize = [Math]::Ceiling($size / 8) * $size
$andMask = New-Object byte[]($andMaskSize)

# 计算图像数据大小
$imageDataSize = 40 + $flippedBytes.Length + $andMask.Length

# 创建 ICONDIR (6 bytes)
$iconDir = New-Object byte[](6)
$iconDir[0] = 0  # Reserved
$iconDir[1] = 0
$iconDir[2] = 1  # Type: 1 = ICO
$iconDir[3] = 0
$iconDir[4] = 1  # Image count
$iconDir[5] = 0

# 创建 ICONDIRENTRY (16 bytes)
$iconDirEntry = New-Object byte[](16)
$iconDirEntry[0] = $size      # Width
$iconDirEntry[1] = $size      # Height
$iconDirEntry[2] = 0          # Color count (0 = true color)
$iconDirEntry[3] = 0          # Reserved
$iconDirEntry[4] = 1          # Color planes
$iconDirEntry[5] = 0
$iconDirEntry[6] = 32         # Bits per pixel
$iconDirEntry[7] = 0
[System.BitConverter]::GetBytes([uint32]$imageDataSize).CopyTo($iconDirEntry, 8)   # Image size
[System.BitConverter]::GetBytes([uint32]22).CopyTo($iconDirEntry, 12)              # Image offset (6 + 16)

# 写入 ICO 文件
$outputFile = [System.IO.File]::Create($outputPath)
$outputFile.Write($iconDir, 0, 6)
$outputFile.Write($iconDirEntry, 0, 16)
$outputFile.Write($dibHeader, 0, 40)
$outputFile.Write($flippedBytes, 0, $flippedBytes.Length)
$outputFile.Write($andMask, 0, $andMask.Length)
$outputFile.Close()

$bitmap.Dispose()

# 显示结果
$fileInfo = Get-Item $outputPath
Write-Host "✓ 图标生成成功！" -ForegroundColor Green
Write-Host "  路径: $outputPath" -ForegroundColor Cyan
Write-Host "  大小: $($fileInfo.Length) 字节 ($('{0:N2}' -f ($fileInfo.Length / 1KB)) KB)" -ForegroundColor Cyan
Write-Host "  格式: 传统 BMP DIB 格式 (32bpp ARGB)" -ForegroundColor Cyan

if ($fileInfo.Length -gt 5KB) {
    Write-Host "  ⚠ 警告: 图标大于 5KB，可能导致 Dev-C++ 崩溃" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ 大小符合 Dev-C++ 要求 (< 5KB)" -ForegroundColor Green
}

# 验证格式
Write-Host "`n验证图标格式..." -ForegroundColor Cyan
$checkBytes = [System.IO.File]::ReadAllBytes($outputPath) | Select-Object -First 50
$header = ($checkBytes[0..19] | ForEach-Object { $_.ToString('x2') }) -join ' '
Write-Host "  文件头: $header" -ForegroundColor Gray
Write-Host "  ✓ 使用传统 ICO 格式（非 PNG 压缩）" -ForegroundColor Green
