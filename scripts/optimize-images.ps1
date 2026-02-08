# 图片优化脚本 - 转换为 PNG 索引格式并压缩
param(
    [string]$ImagesPath = "$PSScriptRoot\..\assets\docs\images"
)

$ErrorActionPreference = "Stop"

Write-Host "=== PNG 图片优化脚本 ===" -ForegroundColor Cyan
Write-Host "目标目录: $ImagesPath" -ForegroundColor Yellow

# 确保目录存在
if (-not (Test-Path $ImagesPath)) {
    Write-Host "错误: 目录不存在: $ImagesPath" -ForegroundColor Red
    exit 1
}

# 获取所有 PNG 文件
$pngFiles = Get-ChildItem -Path $ImagesPath -Filter "*.png"
if ($pngFiles.Count -eq 0) {
    Write-Host "未找到 PNG 文件" -ForegroundColor Yellow
    exit 0
}

Write-Host "找到 $($pngFiles.Count) 个 PNG 文件`n" -ForegroundColor Green

# 检查是否安装了 pngquant
$pngquant = Get-Command pngquant -ErrorAction SilentlyContinue

if (-not $pngquant) {
    # 检查项目 temp 目录是否已经下载过
    $projectTempDir = "$PSScriptRoot\..\temp\pngquant"
    $localPngquant = Get-ChildItem -Path $projectTempDir -Filter "pngquant.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    
    if ($localPngquant) {
        $pngquant = $localPngquant.FullName
        Write-Host "使用项目缓存的 pngquant: $pngquant`n" -ForegroundColor Green
    } else {
        Write-Host "未找到 pngquant，尝试下载到项目目录..." -ForegroundColor Yellow
        
        # 创建项目 temp 目录
        New-Item -ItemType Directory -Path $projectTempDir -Force | Out-Null
        
        # 下载 pngquant (Windows 64-bit)
        $pngquantUrl = "https://pngquant.org/pngquant-windows.zip"
        $zipPath = "$projectTempDir\pngquant.zip"
        
        try {
            Write-Host "下载 pngquant..." -ForegroundColor Yellow
            Invoke-WebRequest -Uri $pngquantUrl -OutFile $zipPath -UseBasicParsing
            
            # 解压
            Expand-Archive -Path $zipPath -DestinationPath $projectTempDir -Force
            
            # 删除 zip 文件
            Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
            
            # 查找 pngquant.exe
            $pngquantExe = Get-ChildItem -Path $projectTempDir -Filter "pngquant.exe" -Recurse | Select-Object -First 1
            if ($pngquantExe) {
                $pngquant = $pngquantExe.FullName
                Write-Host "pngquant 已下载到: $pngquant`n" -ForegroundColor Green
            } else {
                throw "无法找到 pngquant.exe"
            }
        } catch {
            Write-Host "下载 pngquant 失败: $_" -ForegroundColor Red
            Write-Host "将使用 .NET 方法进行基本优化..." -ForegroundColor Yellow
            $pngquant = $null
        }
    }
} else {
    $pngquant = $pngquant.Source
    Write-Host "使用系统已安装的 pngquant: $pngquant`n" -ForegroundColor Green
}

# 统计信息
$totalOriginalSize = 0
$totalOptimizedSize = 0

# 优化每个文件
foreach ($file in $pngFiles) {
    $originalSize = $file.Length
    $totalOriginalSize += $originalSize
    
    Write-Host "处理: $($file.Name)" -ForegroundColor Cyan
    Write-Host "  原始大小: $([math]::Round($originalSize / 1KB, 2)) KB"
    
    if ($pngquant) {
        # 使用 pngquant 优化（256色索引颜色）
        $outputFile = $file.FullName
        $tempOutput = "$($file.DirectoryName)\$($file.BaseName)_temp.png"
        
        try {
            # 运行 pngquant: --force 覆盖，--quality 80-100 保持高质量，256 颜色，--output 指定输出
            $arguments = @(
                "--force",
                "--quality=80-100",
                "--speed=1",
                "256",
                "--output", $tempOutput,
                $file.FullName
            )
            
            $process = Start-Process -FilePath $pngquant -ArgumentList $arguments -Wait -NoNewWindow -PassThru
            
            if ($process.ExitCode -eq 0 -and (Test-Path $tempOutput)) {
                $tempSize = (Get-Item $tempOutput).Length
                
                # 只有在优化后文件更小时才替换
                if ($tempSize -lt $originalSize) {
                    Remove-Item $file.FullName -Force
                    Move-Item $tempOutput $file.FullName -Force
                    
                    $newSize = (Get-Item $file.FullName).Length
                    $totalOptimizedSize += $newSize
                    $savings = $originalSize - $newSize
                    $savingsPercent = [math]::Round(($savings / $originalSize) * 100, 2)
                    
                    Write-Host "  优化后大小: $([math]::Round($newSize / 1KB, 2)) KB" -ForegroundColor Green
                    Write-Host "  节省: $([math]::Round($savings / 1KB, 2)) KB ($savingsPercent%)" -ForegroundColor Green
                } else {
                    # 优化后反而更大，保持原文件
                    Remove-Item $tempOutput -Force -ErrorAction SilentlyContinue
                    $totalOptimizedSize += $originalSize
                    Write-Host "  优化后文件更大，保持原文件" -ForegroundColor Yellow
                }
            } else {
                $totalOptimizedSize += $originalSize
                Write-Host "  优化失败，保持原文件" -ForegroundColor Yellow
                Remove-Item $tempOutput -Force -ErrorAction SilentlyContinue
            }
        } catch {
            $totalOptimizedSize += $originalSize
            Write-Host "  处理出错: $_" -ForegroundColor Red
            Remove-Item $tempOutput -Force -ErrorAction SilentlyContinue
        }
    } else {
        # 使用 .NET 进行基本优化
        try {
            Add-Type -AssemblyName System.Drawing
            
            $image = [System.Drawing.Image]::FromFile($file.FullName)
            $tempOutput = "$($file.DirectoryName)\$($file.BaseName)_temp.png"
            
            # 保存为 PNG (会进行一定压缩，但不会转换为索引颜色)
            $image.Save($tempOutput, [System.Drawing.Imaging.ImageFormat]::Png)
            $image.Dispose()
            
            $newSize = (Get-Item $tempOutput).Length
            
            if ($newSize -lt $originalSize) {
                Remove-Item $file.FullName -Force
                Move-Item $tempOutput $file.FullName -Force
                
                $totalOptimizedSize += $newSize
                $savings = $originalSize - $newSize
                $savingsPercent = [math]::Round(($savings / $originalSize) * 100, 2)
                
                Write-Host "  优化后大小: $([math]::Round($newSize / 1KB, 2)) KB" -ForegroundColor Green
                Write-Host "  节省: $([math]::Round($savings / 1KB, 2)) KB ($savingsPercent%)" -ForegroundColor Yellow
            } else {
                Remove-Item $tempOutput -Force
                $totalOptimizedSize += $originalSize
                Write-Host "  无需优化" -ForegroundColor Yellow
            }
        } catch {
            $totalOptimizedSize += $originalSize
            Write-Host "  处理出错: $_" -ForegroundColor Red
        }
    }
    
    Write-Host ""
}

# 显示总结
$totalSavings = $totalOriginalSize - $totalOptimizedSize
$totalSavingsPercent = if ($totalOriginalSize -gt 0) { 
    [math]::Round(($totalSavings / $totalOriginalSize) * 100, 2) 
} else { 
    0 
}

Write-Host "=== 优化完成 ===" -ForegroundColor Cyan
Write-Host "原始总大小: $([math]::Round($totalOriginalSize / 1KB, 2)) KB" -ForegroundColor Yellow
Write-Host "优化后总大小: $([math]::Round($totalOptimizedSize / 1KB, 2)) KB" -ForegroundColor Yellow
Write-Host "总节省: $([math]::Round($totalSavings / 1KB, 2)) KB ($totalSavingsPercent%)" -ForegroundColor Green
