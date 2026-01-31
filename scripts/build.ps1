# EGE Installer Build Script
# 构建 EGE 安装程序打包脚本

param(
    [string]$OutputDir = "dist",
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$SrcDir = Join-Path $ProjectRoot "src"
$EgeLibsDir = Join-Path (Split-Path -Parent $ProjectRoot) "xege_libs"

Write-Host "=== EGE Installer Build Script ===" -ForegroundColor Cyan
Write-Host "Project Root: $ProjectRoot"
Write-Host "Source Dir: $SrcDir"
Write-Host "EGE Libs Dir: $EgeLibsDir"
Write-Host ""

# 检查 7-Zip
$7zPath = $null
$7zPaths = @(
    "C:\Program Files\7-Zip\7z.exe",
    "C:\Program Files (x86)\7-Zip\7z.exe",
    (Get-Command "7z.exe" -ErrorAction SilentlyContinue).Source
)

foreach ($path in $7zPaths) {
    if ($path -and (Test-Path $path)) {
        $7zPath = $path
        break
    }
}

if (-not $7zPath) {
    Write-Host "Error: 7-Zip not found. Please install 7-Zip." -ForegroundColor Red
    exit 1
}

Write-Host "Using 7-Zip: $7zPath" -ForegroundColor Green

# 检查 EGE 库目录
if (-not (Test-Path $EgeLibsDir)) {
    Write-Host "Error: EGE libs directory not found: $EgeLibsDir" -ForegroundColor Red
    Write-Host "Please ensure xege_libs is in the parent directory." -ForegroundColor Yellow
    exit 1
}

# 创建输出目录
$OutputPath = Join-Path $ProjectRoot $OutputDir
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath | Out-Null
}

# 创建临时打包目录
$TempDir = Join-Path $env:TEMP "ege-installer-build-$(Get-Random)"
New-Item -ItemType Directory -Path $TempDir | Out-Null

Write-Host ""
Write-Host "Building package..." -ForegroundColor Cyan

try {
    # 复制安装程序源文件
    Write-Host "  Copying installer files..."
    $InstallDir = Join-Path $TempDir "installer"
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
    
    Copy-Item "$SrcDir\setup.hta" $InstallDir
    Copy-Item "$SrcDir\detector.js" $InstallDir
    Copy-Item "$SrcDir\installer.js" $InstallDir
    
    # 复制 EGE 库文件
    Write-Host "  Copying EGE library files..."
    $LibsDir = Join-Path $TempDir "libs"
    New-Item -ItemType Directory -Path $LibsDir | Out-Null
    
    # 复制 include 目录
    Copy-Item "$EgeLibsDir\include" "$LibsDir\include" -Recurse
    
    # 复制 lib 目录
    Copy-Item "$EgeLibsDir\lib" "$LibsDir\lib" -Recurse
    
    # 创建版本信息文件
    @"
EGE Installer
Version: $Version
Build Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@ | Out-File -FilePath "$TempDir\version.txt" -Encoding UTF8
    
    # 创建自解压配置
    $SfxConfig = @"
;!@Install@!UTF-8!
Title="EGE 图形库安装程序"
BeginPrompt="是否安装 EGE 图形库？"
RunProgram="mshta.exe \"%%T\\installer\\setup.hta\""
;!@InstallEnd@!
"@
    $SfxConfig | Out-File -FilePath "$TempDir\sfx.txt" -Encoding UTF8
    
    # 打包为 7z
    Write-Host "  Creating archive..."
    $ArchivePath = Join-Path $TempDir "ege-setup.7z"
    & $7zPath a -t7z -mx=9 -mf=BCJ2 -r $ArchivePath "$TempDir\installer" "$TempDir\libs" "$TempDir\version.txt" | Out-Null
    
    if (-not (Test-Path $ArchivePath)) {
        throw "Failed to create archive"
    }
    
    # 获取 7-Zip SFX 模块
    $SfxModule = Join-Path (Split-Path $7zPath -Parent) "7z.sfx"
    if (-not (Test-Path $SfxModule)) {
        # 尝试使用控制台 SFX
        $SfxModule = Join-Path (Split-Path $7zPath -Parent) "7zCon.sfx"
    }
    
    if (-not (Test-Path $SfxModule)) {
        Write-Host "Warning: SFX module not found, creating 7z archive only" -ForegroundColor Yellow
        $FinalPath = Join-Path $OutputPath "ege-setup-$Version.7z"
        Copy-Item $ArchivePath $FinalPath
    } else {
        # 创建自解压 EXE
        Write-Host "  Creating self-extracting executable..."
        $FinalPath = Join-Path $OutputPath "ege-setup-$Version.exe"
        
        # 合并 SFX + Config + Archive
        $SfxConfigPath = "$TempDir\sfx.txt"
        
        $output = New-Object System.IO.FileStream($FinalPath, [System.IO.FileMode]::Create)
        
        # Write SFX module
        $sfxBytes = [System.IO.File]::ReadAllBytes($SfxModule)
        $output.Write($sfxBytes, 0, $sfxBytes.Length)
        
        # Write config
        $configBytes = [System.IO.File]::ReadAllBytes($SfxConfigPath)
        $output.Write($configBytes, 0, $configBytes.Length)
        
        # Write archive
        $archiveBytes = [System.IO.File]::ReadAllBytes($ArchivePath)
        $output.Write($archiveBytes, 0, $archiveBytes.Length)
        
        $output.Close()
    }
    
    Write-Host ""
    Write-Host "Build completed!" -ForegroundColor Green
    Write-Host "Output: $FinalPath" -ForegroundColor Cyan
    
    # 显示文件大小
    $fileSize = (Get-Item $FinalPath).Length
    $fileSizeKB = [math]::Round($fileSize / 1024, 2)
    $fileSizeMB = [math]::Round($fileSize / 1024 / 1024, 2)
    Write-Host "Size: $fileSizeMB MB ($fileSizeKB KB)" -ForegroundColor Cyan
    
} finally {
    # 清理临时目录
    if (Test-Path $TempDir) {
        Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
    }
}
