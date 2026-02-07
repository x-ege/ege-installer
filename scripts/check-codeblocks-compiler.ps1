# Code::Blocks 编译器配置检查脚本
# 用于诊断和修复 "Can't find compiler executable" 错误

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Code::Blocks 编译器配置检查工具" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Code::Blocks 安装
$cbPath = "C:\Program Files\CodeBlocks"
if (-not (Test-Path $cbPath)) {
    Write-Host "❌ 未找到 Code::Blocks 安装目录: $cbPath" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Code::Blocks 安装目录: $cbPath" -ForegroundColor Green

# 检查自带的 MinGW
$mingwPath = "$cbPath\MinGW"
if (Test-Path $mingwPath) {
    Write-Host "✓ 找到 Code::Blocks 自带 MinGW: $mingwPath" -ForegroundColor Green
    
    # 检查编译器可执行文件
    $gccPath = "$mingwPath\bin\gcc.exe"
    $gppPath = "$mingwPath\bin\g++.exe"
    
    if (Test-Path $gccPath) {
        Write-Host "  ✓ gcc.exe 存在" -ForegroundColor Green
        $gccVersion = & $gccPath --version 2>$null | Select-Object -First 1
        if ($gccVersion) {
            Write-Host "    版本: $gccVersion" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ❌ gcc.exe 不存在" -ForegroundColor Red
    }
    
    if (Test-Path $gppPath) {
        Write-Host "  ✓ g++.exe 存在" -ForegroundColor Green
    } else {
        Write-Host "  ❌ g++.exe 不存在" -ForegroundColor Red
    }
} else {
    Write-Host "❌ 未找到 Code::Blocks 自带 MinGW" -ForegroundColor Red
}

Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "解决方案：" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "如果创建 EGE 项目时出现 'Can't find compiler executable' 错误：" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. 打开 Code::Blocks" -ForegroundColor White
Write-Host "2. Settings → Compiler..." -ForegroundColor White
Write-Host "3. 选择编译器：GNU GCC Compiler" -ForegroundColor White
Write-Host "4. 点击 'Toolchain executables' 标签页" -ForegroundColor White
Write-Host "5. 点击 'Auto-detect' 按钮" -ForegroundColor White
Write-Host "6. 或手动设置路径为：$mingwPath" -ForegroundColor White
Write-Host "7. 验证编译器文件名：" -ForegroundColor White
Write-Host "   - C compiler: gcc.exe" -ForegroundColor Gray
Write-Host "   - C++ compiler: g++.exe" -ForegroundColor Gray
Write-Host "8. 点击 OK 保存" -ForegroundColor White
Write-Host ""
Write-Host "然后重新创建 EGE 项目即可。" -ForegroundColor Green
Write-Host ""

# 检查 EGE 向导是否已安装
$egeWizardPath = "$cbPath\share\CodeBlocks\templates\wizard\ege"
if (Test-Path $egeWizardPath) {
    Write-Host "✓ EGE 项目向导已安装: $egeWizardPath" -ForegroundColor Green
} else {
    Write-Host "❌ EGE 项目向导未安装" -ForegroundColor Red
}

Write-Host ""
