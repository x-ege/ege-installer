# EGE Installer 开发环境准备脚本
# 用法: .\scripts\setup.ps1 [-Auto] [-SkipNsisCheck]

param(
    [switch]$Auto,           # 自动模式，不需要用户确认
    [switch]$SkipNsisCheck,  # 跳过 NSIS 检查
    [string]$XegeLibsPath    # 自定义 xege_libs 路径
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# 默认目录路径
if (-not $XegeLibsPath) {
    $XegeLibsPath = Join-Path (Split-Path -Parent $ProjectRoot) "xege_libs"
}

$XegeSdkRepo = "https://github.com/x-ege/xege-sdk.git"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EGE Installer 开发环境准备" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "项目目录: $ProjectRoot"
Write-Host "EGE 库目录: $XegeLibsPath"
Write-Host ""

# ========================================
# 检查 Git
# ========================================
function Test-GitAvailable {
    try {
        $null = git --version 2>&1
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

# ========================================
# 检查 NSIS
# ========================================
function Test-NsisAvailable {
    $nsisPaths = @(
        "C:\Program Files (x86)\NSIS\makensis.exe",
        "C:\Program Files\NSIS\makensis.exe",
        (Get-Command "makensis.exe" -ErrorAction SilentlyContinue).Source
    )
    
    foreach ($path in $nsisPaths) {
        if ($path -and (Test-Path $path)) {
            return $path
        }
    }
    return $null
}

# ========================================
# 检查 xege_libs 目录
# ========================================
function Test-XegeLibsValid {
    param([string]$Path)
    
    if (-not (Test-Path $Path)) {
        return $false
    }
    
    $requiredDirs = @("include", "lib")
    foreach ($dir in $requiredDirs) {
        if (-not (Test-Path (Join-Path $Path $dir))) {
            return $false
        }
    }
    return $true
}

# ========================================
# 主逻辑
# ========================================

$allPassed = $true

# 1. 检查 xege_libs
Write-Host "[1/2] 检查 EGE 库目录..." -ForegroundColor Yellow

if (Test-XegeLibsValid $XegeLibsPath) {
    Write-Host "  ✓ EGE 库目录已存在且有效" -ForegroundColor Green
    
    # 显示目录内容
    $includeCount = (Get-ChildItem -Path "$XegeLibsPath\include" -File -Recurse).Count
    $libDirs = Get-ChildItem -Path "$XegeLibsPath\lib" -Directory
    Write-Host "    - include: $includeCount 个头文件"
    Write-Host "    - lib: $($libDirs.Name -join ', ')"
    
} elseif (Test-Path $XegeLibsPath) {
    Write-Host "  ⚠ 目录存在但结构不完整: $XegeLibsPath" -ForegroundColor Yellow
    $allPassed = $false
    
} else {
    Write-Host "  ✗ EGE 库目录不存在: $XegeLibsPath" -ForegroundColor Red
    Write-Host ""
    
    # 检查 Git
    if (-not (Test-GitAvailable)) {
        Write-Host "  错误: 未找到 Git，无法自动克隆" -ForegroundColor Red
        Write-Host "  请手动下载: $XegeSdkRepo" -ForegroundColor Yellow
        $allPassed = $false
    } else {
        $shouldClone = $false
        
        if ($Auto) {
            $shouldClone = $true
            Write-Host "  自动模式: 将从 GitHub 克隆 xege-sdk..." -ForegroundColor Cyan
        } else {
            Write-Host "  是否从 GitHub 克隆 xege-sdk？" -ForegroundColor Cyan
            Write-Host "  仓库地址: $XegeSdkRepo" -ForegroundColor Gray
            Write-Host ""
            $response = Read-Host "  输入 [y/N]"
            $shouldClone = $response -match "^[yY]"
        }
        
        if ($shouldClone) {
            Write-Host ""
            Write-Host "  正在克隆 xege-sdk..." -ForegroundColor Cyan
            
            try {
                git clone $XegeSdkRepo $XegeLibsPath 2>&1
                
                if ($LASTEXITCODE -eq 0 -and (Test-XegeLibsValid $XegeLibsPath)) {
                    Write-Host "  ✓ xege-sdk 克隆成功" -ForegroundColor Green
                } else {
                    throw "克隆完成但目录结构验证失败"
                }
            } catch {
                Write-Host "  ✗ 克隆失败: $_" -ForegroundColor Red
                $allPassed = $false
            }
        } else {
            Write-Host "  跳过克隆，请手动准备 EGE 库文件" -ForegroundColor Yellow
            $allPassed = $false
        }
    }
}

Write-Host ""

# 2. 检查 NSIS
if (-not $SkipNsisCheck) {
    Write-Host "[2/2] 检查 NSIS..." -ForegroundColor Yellow
    
    $nsisPath = Test-NsisAvailable
    if ($nsisPath) {
        Write-Host "  ✓ NSIS 已安装: $nsisPath" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ NSIS 未安装 (仅构建时需要)" -ForegroundColor Yellow
        Write-Host "    安装方法:" -ForegroundColor Gray
        Write-Host "      - 下载: https://nsis.sourceforge.io/Download" -ForegroundColor Gray
        Write-Host "      - winget: winget install NSIS.NSIS" -ForegroundColor Gray
        Write-Host "      - scoop: scoop install nsis" -ForegroundColor Gray
    }
} else {
    Write-Host "[2/2] 跳过 NSIS 检查" -ForegroundColor Gray
}

Write-Host ""

# ========================================
# 总结
# ========================================
Write-Host "========================================" -ForegroundColor Cyan

if ($allPassed) {
    Write-Host "  ✓ 开发环境准备完成！" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Cyan
    Write-Host "  运行安装程序:  mshta.exe .\src\setup.hta"
    Write-Host "  构建安装包:    .\scripts\build.ps1"
    Write-Host ""
    exit 0
} else {
    Write-Host "  ⚠ 部分检查未通过" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "请解决上述问题后重试。" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
