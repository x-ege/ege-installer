# EGE Installer Build Script (NSIS)
# 使用 NSIS 打包 HTA 安装界面
#
# 用法:
#   .\build.ps1                                    # 使用 xege_libs/version.txt 中的版本号
#   .\build.ps1 -Version "1.2.3"                   # 手动指定版本号（覆盖 version.txt）
#   .\build.ps1 -XegeLibsPath "C:\path\to\libs"    # 自定义库路径 (CI)

param(
    [string]$OutputDir = "dist",
    [string]$Version,                              # 可选：手动指定版本（优先级低于 version.txt）
    [string]$ProductVersion,                       # NSIS-compatible version (X.X.X.X)
    [string]$XegeLibsPath                          # 可选：自定义 xege_libs 路径
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$SrcDir = Join-Path $ProjectRoot "src"

# 确定 EGE 库目录
if ($XegeLibsPath) {
    # 处理 Unix 风格路径 (如 /c/Users/...)
    if ($XegeLibsPath -match "^/([a-zA-Z])/") {
        $driveLetter = $matches[1].ToUpper()
        $XegeLibsPath = $XegeLibsPath -replace "^/[a-zA-Z]/", "${driveLetter}:\\"
        $XegeLibsPath = $XegeLibsPath.Replace("/", "\")
    }
    $EgeLibsDir = $XegeLibsPath
} else {
    # 默认路径：项目父目录下的 xege_libs
    $EgeLibsDir = Join-Path (Split-Path -Parent $ProjectRoot) "xege_libs"
}

# 从 xege_libs/version.txt 读取 EGE 库版本号
$VersionSource = "default"
if (-not $Version) {
    $versionFilePath = Join-Path $EgeLibsDir "version.txt"
    if (Test-Path $versionFilePath) {
        try {
            $Version = (Get-Content $versionFilePath -Raw).Trim()
            $VersionSource = "version.txt"
        } catch {
            $Version = "1.0.0"
            $VersionSource = "fallback (version.txt read error)"
        }
    } else {
        $Version = "1.0.0"
        $VersionSource = "fallback (version.txt not found)"
    }
} else {
    $VersionSource = "parameter"
}

$LogFile = Join-Path $ProjectRoot "logs\build.log"

# 初始化日志
New-Item -ItemType Directory -Path (Join-Path $ProjectRoot "logs") -Force | Out-Null
"=== Build started at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File $LogFile

# 如果未提供产品版本，从 Version 中生成
if (-not $ProductVersion) {
    $ProductVersion = $Version -replace "[^0-9.]", "" -replace "\.+", "."
    # 移除前导零
    try {
        $ProductVersion = ($ProductVersion.Split('.') | ForEach-Object { [int]$_ }) -join '.'
    } catch { }
    if ($ProductVersion -notmatch "^\d+\.\d+\.\d+") {
        $ProductVersion = "1.0.0"
    }
    # 确保是 4 段版本号
    $parts = $ProductVersion.Split('.')
    if ($parts.Length -eq 3) {
        $ProductVersion = "$ProductVersion.0"
    } elseif ($parts.Length -lt 3) {
        $ProductVersion = "1.0.0.0"
    }
}

function Log($msg) {
    Write-Host $msg
    $msg | Out-File $LogFile -Append
}

Log "=== EGE Installer Build Script (NSIS) ==="
Log "Project Root: $ProjectRoot"
Log "Source Dir: $SrcDir"
Log "EGE Libs Dir: $EgeLibsDir"
Log "Display Version: $Version (source: $VersionSource)"
Log "Product Version: $ProductVersion"
Log ""

# 检查 NSIS
$nsisPath = $null
$nsisPaths = @(
    "C:\Program Files (x86)\NSIS\makensis.exe",
    "C:\Program Files\NSIS\makensis.exe",
    (Get-Command "makensis.exe" -ErrorAction SilentlyContinue).Source
)

foreach ($path in $nsisPaths) {
    if ($path -and (Test-Path $path)) {
        $nsisPath = $path
        break
    }
}

if (-not $nsisPath) {
    Log "Error: NSIS not found."
    Log ""
    Log "请安装 NSIS："
    Log "  1. 下载: https://nsis.sourceforge.io/Download"
    Log "  2. 或使用 winget: winget install NSIS.NSIS"
    Log "  3. 或使用 scoop: scoop install nsis"
    Log ""
    exit 1
}

Log "Using NSIS: $nsisPath"

# 检查 EGE 库目录
if (-not (Test-Path $EgeLibsDir)) {
    Log "Error: EGE libs directory not found: $EgeLibsDir"
    Log "Please ensure xege_libs is in the parent directory."
    exit 1
}

# 创建输出目录
$OutputPath = Join-Path $ProjectRoot $OutputDir
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath | Out-Null
}

# 创建临时打包目录（在项目内，NSIS 脚本使用相对路径）
$TempDir = Join-Path $ProjectRoot "temp"
if (Test-Path $TempDir) {
    Remove-Item -Recurse -Force $TempDir
}
New-Item -ItemType Directory -Path $TempDir | Out-Null

Log ""
Log "Building package..."
Log "Temp directory: $TempDir"

try {
    # 复制安装程序源文件
    Log "  Copying installer files..."
    $InstallDir = Join-Path $TempDir "installer"
    New-Item -ItemType Directory -Path $InstallDir | Out-Null
    
    Copy-Item "$SrcDir\setup.hta" $InstallDir -Force
    Copy-Item "$SrcDir\detector.js" $InstallDir -Force
    Copy-Item "$SrcDir\installer.js" $InstallDir -Force
    
    # 验证文件
    $htaSize = (Get-Item "$InstallDir\setup.hta").Length
    Log "  setup.hta: $htaSize bytes"
    
    # 复制 EGE 库文件
    Log "  Copying EGE library files..."
    $LibsDir = Join-Path $TempDir "libs"
    New-Item -ItemType Directory -Path $LibsDir | Out-Null
    
    Copy-Item "$EgeLibsDir\include" "$LibsDir\include" -Recurse
    Copy-Item "$EgeLibsDir\lib" "$LibsDir\lib" -Recurse
    
    # 创建版本信息文件
    @"
EGE Installer
Version: $Version
Build Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@ | Out-File -FilePath "$TempDir\version.txt" -Encoding UTF8
    
    # 调用 NSIS 编译
    Log "  Compiling with NSIS..."
    $nsiScript = Join-Path $ScriptDir "installer.nsi"
    
    # 切换到脚本目录执行 NSIS（因为 nsi 文件使用相对路径）
    Push-Location $ScriptDir
    
    try {
        $nsisArgs = @(
            "/DVERSION=$Version",
            "/DPRODUCT_VERSION=$ProductVersion",
            "/V2",
            $nsiScript
        )
        Log "  NSIS arguments: $($nsisArgs -join ' ')"
        $output = & $nsisPath $nsisArgs 2>&1
        $exitCode = $LASTEXITCODE
        
        Log "  NSIS output:"
        $output | ForEach-Object { Log "    $_" }
        
        if ($exitCode -ne 0) {
            throw "NSIS compilation failed with exit code $exitCode"
        }
    } finally {
        Pop-Location
    }
    
    $FinalPath = Join-Path $OutputPath "ege-setup-$Version.exe"
    
    if (-not (Test-Path $FinalPath)) {
        throw "Output file not created: $FinalPath"
    }
    
    Log ""
    Log "Build completed!"
    Log "Output: $FinalPath"
    
    # 显示文件大小
    $fileSize = (Get-Item $FinalPath).Length
    $fileSizeKB = [math]::Round($fileSize / 1024, 2)
    $fileSizeMB = [math]::Round($fileSize / 1024 / 1024, 2)
    Log "Size: $fileSizeMB MB ($fileSizeKB KB)"
    
} catch {
    Log "ERROR: $_"
    throw
} finally {
    # 清理临时目录
    if (Test-Path $TempDir) {
        Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
    }
}
