; EGE Installer NSIS Script
; 使用 NSIS 打包 HTA 安装界面
; 静默解压并启动 HTA 界面

;--------------------------------
; 基本设置

Name "EGE 图形库安装程序"
OutFile "..\dist\ege-setup-${VERSION}.exe"
Icon "..\assets\ege-icon.ico"  ; 设置安装程序图标
Unicode True
RequestExecutionLevel admin  ; 启动时申请管理员权限
ManifestDPIAware true  ; 声明DPI感知，避免模糊缩放

; 静默安装 - 不显示 NSIS 界面，直接启动 HTA
SilentInstall silent

;--------------------------------
; 版本信息

VIProductVersion "${PRODUCT_VERSION}"
VIAddVersionKey "ProductName" "EGE 图形库安装程序"
VIAddVersionKey "CompanyName" "EGE Project"
VIAddVersionKey "FileDescription" "EGE (Easy Graphics Engine) 安装程序"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright (C) EGE Project"

;--------------------------------
; 安装程序

Section "Main"
    ; 创建临时目录
    GetTempFileName $0
    Delete $0
    CreateDirectory $0
    
    ; 解压安装文件到 installer 子目录
    SetOutPath "$0\installer"
    File /r "..\temp\installer\*.*"
    
    ; 解压库文件到 libs 子目录
    SetOutPath "$0\libs"
    File /r "..\temp\libs\*.*"

    ; 解压资源文件到 assets 子目录（图标/模板/文档等）
    SetOutPath "$0\assets"
    File /r "..\temp\assets\*.*"
    
    ; 解压版本信息到根目录
    SetOutPath $0
    File "..\temp\version.txt"
    
    ; 设置高DPI感知环境变量，让mshta以正确的DPI模式运行
    System::Call 'Kernel32::SetEnvironmentVariable(t "__COMPAT_LAYER", t "~HIGHDPIAWARE")'
    
    ; 启动 HTA 安装界面并等待完成
    ExecWait 'mshta.exe "$0\installer\setup.hta"' $1
    IntCmp $1 0 +3
        SetErrorLevel $1
        Abort "安装程序异常退出 (code: $1)"
    
    ; HTA 关闭后清理临时文件
    SetOutPath $TEMP
    RMDir /r $0
    
SectionEnd
