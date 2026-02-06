# Dev-C++ 模板文件

此目录包含 Dev-C++ 项目模板文件和相关资源。**仅支持 64-bit 编译**。

## 文件说明

### 模板文件

- **EGE_Graphics.template** - Dev-C++ 项目模板定义文件（INI 格式，ANSI 编码，64-bit only）
- **EGE_main_cpp.txt** - C++ 源代码模板文件（ANSI 编码，英文注释）

## 编译要求

⚠️ **重要提示**: 此模板仅支持 64-bit 编译模式！

**编译器设置步骤：**

1. 工具 → 编译器选项
2. 设置 → 代码生成 → 架构 = **x86_64**
3. 确保未选择 i686（32-bit 模式已淘汰）

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
- **库文件**: `C:\Program Files (x86)\Dev-Cpp\MinGW64\lib\`
  - `libgraphics.a` (64-bit only)

### 卸载处理

卸载时，所有文件会被自动删除。

## 使用注意事项

1. **架构设置**: 确保 Dev-C++ 设置为 x86_64 架构
2. **编译模式**: 仅支持 64-bit 编译
3. **自动配置**: 模板已包含所有必需的链接参数

## 测试

### 验证编译设置

项目创建后检查编译器架构：

```
工具 → 编译器选项 → 设置 → 代码生成 → 架构
应该显示: x86_64
```

## 参考资料

- Dev-C++ 模板格式：`C:\Program Files (x86)\Dev-Cpp\Templates\*.template`
- Dev-C++ 图标示例：`C:\Program Files (x86)\Dev-Cpp\Icons\*.ico`
