# EGE Installer Project Skills

## 项目概述

这是 [xege](https://github.com/x-ege/xege) 图形库的安装器项目，用于将 EGE 库全局配置到用户本地的各种 IDE/编译器环境中。

## 技术栈

- **安装器界面**: HTA (HTML Application) + JScript
- **打包工具**: 7-Zip SFX (自解压)
- **目标平台**: Windows 7/8/10/11
- **支持的 IDE**:
  - Visual Studio 2010, 2012, 2013, 2015, 2017, 2019, 2022, 2026
  - MinGW-w64 (包括 MSYS2)
  - Dev-C++ (Embarcadero/Bloodshed)
  - Code::Blocks
  - Red Panda Dev-C++

## 项目结构

```
ege-installer/
├── .github/
│   ├── copilot-skills.md    # 本文件
│   └── workflows/           # GitHub Actions 工作流
├── .vscode/
│   ├── settings.json        # VSCode 设置
│   ├── tasks.json           # 构建任务
│   └── launch.json          # 调试配置
├── src/
│   ├── setup.hta            # 主安装界面
│   ├── installer.js         # 安装逻辑 (JScript)
│   ├── detector.js          # IDE 检测逻辑
│   └── styles.css           # 界面样式
├── scripts/
│   ├── build.ps1            # 构建脚本
│   └── pack.ps1             # 打包脚本
├── assets/
│   └── logo.png             # 图标资源
├── resource/                # 参考资料
│   └── EasyX_26.1.1.exe     # EasyX 安装器参考
└── README.md
```

## 核心功能

### IDE 检测

通过以下方式检测已安装的 IDE：

1. **Visual Studio**: 读取注册表 `HKLM\SOFTWARE\Microsoft\VisualStudio\<version>` 或使用 vswhere.exe
2. **MinGW**: 检查 `PATH` 环境变量和常见安装路径 (`C:\msys64\`, `C:\mingw64\`)
3. **Dev-C++**: 注册表和常见路径 (`C:\Program Files (x86)\Dev-Cpp\`)
4. **Code::Blocks**: 注册表和常见路径

### 文件安装

- **头文件**: 复制到 IDE 的 `include` 目录
- **库文件**: 复制到 IDE 的 `lib` 目录（区分 x86/x64 和 Debug/Release）

### EGE 库文件位置

库文件位于同级目录 `../xege_libs/`:

- `include/` - 头文件 (ege.h, graphics.h, ege/)
- `lib/<compiler>/<arch>/` - 预编译库文件

## 开发指南

### HTA 开发

HTA 文件是一个 HTML 应用程序，可以使用 `mshta.exe` 运行：

```powershell
mshta.exe "path\to\setup.hta"
```

### JScript 调试

在 HTA 中使用 `WScript.Shell` 和 `Scripting.FileSystemObject` 等 COM 对象进行系统操作。

### 构建打包

使用 7-Zip 创建自解压安装包：

```powershell
.\scripts\build.ps1
```

## 注意事项

- 安装器需要管理员权限运行
- 需要处理 UAC 提权
- 支持静默安装模式
- 安装路径需要转义空格和特殊字符
