# Dev-C++ 模板文件

此目录包含 Dev-C++ 项目模板文件和相关资源。

## 文件说明

### 模板文件

- **EGE_Graphics.template** - Dev-C++ 项目模板定义文件（INI 格式，ANSI 编码）
- **EGE_main_cpp.txt** - C++ 源代码模板文件（ANSI 编码，英文注释）

### 图标文件

- **ege-template.ico** - 模板图标（4.2KB，32x32 像素）
  - 白色背景
  - 蓝色 "EGE" 文字
  - 传统 BMP DIB 格式（兼容 Dev-C++ 5.11）
  - 由 `scripts/generate-icon.ps1` 自动生成

## 技术要求

### Dev-C++ 5.11 模板规范

1. **编码要求**: 
   - **模板定义文件** (`.template`): 必须使用 **ANSI 编码**（无 BOM）
     - UTF-8 BOM 会导致模板解析失败，不显示在项目列表中
   - **源代码模板** (`.txt`): 使用 **ANSI 编码 + 英文注释**
     - Dev-C++ 5.11 默认使用系统本地编码读取文件
     - 英文注释避免编码问题，通用性更好
     - 如需中文注释，需使用 GBK 编码（仅适用于中文 Windows）

2. **图标要求**: 
   - 图标文件必须 **小于 5KB**
   - 必须使用 **传统 BMP DIB 格式**（不支持 PNG 压缩）
   - 超过 5KB 或使用 PNG 格式会导致 Dev-C++ 崩溃（`Out of system resources` 错误）
   - 推荐大小：4KB 左右
   - 推荐尺寸：32x32 像素

3. **图标位置**:
   - 图标文件必须放在 `Icons\` 目录（不是 `Templates\` 目录）
   - 模板文件中通过文件名引用（如 `Icon=ege-template.ico`）

4. **INI 格式**: 模板文件使用 `ver=1` 格式

   ```ini
   [Template]
   ver=1
   Name=项目名称
   Icon=图标文件名.ico
   Description=项目描述（建议 < 40 字符）
   Category=分类（如 Multimedia、Basic）
   
   [Unit0]
   CppName=文件名.cpp
   Cpp=源代码模板文件名.txt
   
   [Project]
   UnitCount=文件数量
   Type=0  # 0=GUI, 1=Console
   IsCpp=1
   Linker=链接参数
   ```

## 开发说明

### 重新生成图标

如果需要修改图标样式，编辑 `scripts/generate-icon.ps1` 并运行：

```powershell
cd scripts
.\generate-icon.ps1
```

生成的图标会自动保存到 `assets/templates/devcpp/ege-template.ico`。

### 构建时自动生成

运行 `scripts/build.ps1` 时会自动生成图标（如果不存在或需要更新）。

### 安装位置

安装时，这些文件会被复制到：

- **模板文件**: `C:\Program Files (x86)\Dev-Cpp\Templates\`
  - `EGE_Graphics.template`
  - `EGE_main_cpp.txt`
- **图标文件**: `C:\Program Files (x86)\Dev-Cpp\Icons\`
  - `ege-template.ico`

### 卸载处理

卸载时，所有文件（Templates 和 Icons 目录中）会被自动删除。

## 测试

### 验证编码

确保模板文件使用 ANSI 编码：

```powershell
$bytes = [System.IO.File]::ReadAllBytes(".\EGE_Graphics.template") | Select-Object -First 10
($bytes | ForEach-Object { $_.ToString('x2') }) -join ' '
# 应该显示: 5b 54 65 6d... (即 "[Tem...")
# 不应该有: ef bb bf (UTF-8 BOM)
```

### 验证图标大小

```powershell
(Get-Item ".\ege-template.ico").Length / 1KB
# 应该小于 5KB
```

## 参考资料

- Dev-C++ 模板格式：`C:\Program Files (x86)\Dev-Cpp\Templates\*.template`
- Dev-C++ 图标示例：`C:\Program Files (x86)\Dev-Cpp\Icons\*.ico`
