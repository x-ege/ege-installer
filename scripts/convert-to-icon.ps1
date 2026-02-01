# 将图片转换为 ICO 格式
# 用法: .\convert-to-icon.ps1 -InputImage "input.jpg" -OutputIcon "output.ico"

param(
    [string]$InputImage = "..\assets\egelogo.png",
    [string]$OutputIcon = "..\assets\ege-icon.ico",
    [int[]]$Sizes = @(256, 128, 64, 48, 32, 16)
)

$ErrorActionPreference = "Stop"

# 获取绝对路径
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InputPath = Join-Path $ScriptDir $InputImage | Resolve-Path
$OutputPath = Join-Path $ScriptDir $OutputIcon

Write-Host "Converting image to icon..."
Write-Host "Input: $InputPath"
Write-Host "Output: $OutputPath"

Add-Type -AssemblyName System.Drawing

try {
    # 加载源图片
    $srcImage = [System.Drawing.Image]::FromFile($InputPath)
    
    # 创建 ICO 文件流
    $iconStream = [System.IO.File]::Create($OutputPath)
    $writer = [System.IO.BinaryWriter]::new($iconStream)
    
    # 写入 ICO 文件头
    $writer.Write([uint16]0)  # Reserved (must be 0)
    $writer.Write([uint16]1)  # Type (1 = ICO)
    $writer.Write([uint16]$Sizes.Length)  # Number of images
    
    # 准备图像数据
    $imageDataList = @()
    foreach ($size in $Sizes) {
        # 创建调整大小后的位图
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($srcImage, 0, 0, $size, $size)
        $graphics.Dispose()
        
        # 转换为 PNG 以保持透明度和质量
        $pngStream = New-Object System.IO.MemoryStream
        $bitmap.Save($pngStream, [System.Drawing.Imaging.ImageFormat]::Png)
        $pngData = $pngStream.ToArray()
        $pngStream.Dispose()
        $bitmap.Dispose()
        
        $imageDataList += @{
            Size = $size
            Data = $pngData
        }
    }
    
    # 计算图像数据偏移
    $offset = 6 + (16 * $Sizes.Length)  # 文件头 + 目录项
    
    # 写入目录项
    foreach ($imageData in $imageDataList) {
        $size = $imageData.Size
        $data = $imageData.Data
        
        $iconSize = if ($size -eq 256) { 0 } else { $size }
        $writer.Write([byte]$iconSize)  # Width (0 = 256)
        $writer.Write([byte]$iconSize)  # Height (0 = 256)
        $writer.Write([byte]0)  # Color palette (0 = no palette)
        $writer.Write([byte]0)  # Reserved
        $writer.Write([uint16]1)  # Color planes
        $writer.Write([uint16]32)  # Bits per pixel
        $writer.Write([uint32]$data.Length)  # Image data size
        $writer.Write([uint32]$offset)  # Image data offset
        
        $offset += $data.Length
    }
    
    # 写入图像数据
    foreach ($imageData in $imageDataList) {
        $writer.Write($imageData.Data)
    }
    
    $writer.Close()
    $iconStream.Close()
    $srcImage.Dispose()
    
    Write-Host "Icon created successfully!"
    Write-Host "Sizes included: $($Sizes -join ', ')"
    $fileSize = (Get-Item $OutputPath).Length
    Write-Host "File size: $([math]::Round($fileSize / 1024, 2)) KB"
    
} catch {
    Write-Host "Error: $_"
    if ($writer) { $writer.Close() }
    if ($iconStream) { $iconStream.Close() }
    if ($srcImage) { $srcImage.Dispose() }
    if (Test-Path $OutputPath) { Remove-Item $OutputPath }
    throw
}
