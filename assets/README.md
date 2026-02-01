# Assets 资源目录

本目录包含项目使用的图标和图像资源。

## 文件说明

- `egelogo.jpg` - EGE 项目原始 Logo（来自 xege 项目）
- `ege-icon.ico` - 安装程序图标（多尺寸 ICO 格式）
  - 包含尺寸：256x256, 128x128, 64x64, 48x48, 32x32, 16x16
  - 用于 NSIS 安装程序的图标

## 图标转换

如需重新生成图标，运行：

```powershell
cd scripts
.\convert-to-icon.ps1
```

此脚本会将 `egelogo.jpg` 转换为多尺寸的 `ege-icon.ico` 文件。
