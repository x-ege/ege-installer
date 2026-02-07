# 修复 Code::Blocks "Can't find compiler executable" 错误

## 问题原因

Code::Blocks 中有多个编译器配置，但 "GNU GCC MSYS MinGW64 Compiler" 的路径未正确配置。

## 解决方案（3 种方法，任选一种）

### 方法 1：使用正确配置的默认编译器（推荐）

1. 打开 Code::Blocks
2. 点击菜单：**Settings → Compiler...**
3. 在 **Selected compiler** 下拉列表中，选择 **GNU GCC Compiler**（不要选 MSYS 那个）
4. 点击 **Toolchain executables** 标签页
5. 点击 **Auto-detect** 按钮（应该会自动检测到 `C:\Program Files\CodeBlocks\MinGW`）
6. 验证路径是否正确：`C:\Program Files\CodeBlocks\MinGW`
7. 点击 **Set as default** 按钮，将此编译器设为默认
8. 点击 **OK** 保存

**重新创建 EGE 项目时，选择 "GNU GCC Compiler"。**

---

### 方法 2：修复 MSYS MinGW64 编译器配置

如果你确实需要使用 "GNU GCC MSYS MinGW64 Compiler"：

1. 打开 Code::Blocks
2. **Settings → Compiler...**
3. 选择 **GNU GCC MSYS MinGW64 Compiler**
4. 点击 **Toolchain executables** 标签页
5. 手动设置 **Compiler's installation directory** 为：
   - 如果你有 MSYS2：`C:\msys64\mingw64`
   - 或使用 Code::Blocks 自带：`C:\Program Files\CodeBlocks\MinGW`
6. 点击 **Auto-detect** 让它自动填充其他项
7. 验证编译器文件名（gcc.exe、g++.exe 等）
8. 点击 **OK** 保存

---

### 方法 3：删除有问题的编译器配置

1. 打开 Code::Blocks
2. **Settings → Compiler...**
3. 选择 **GNU GCC MSYS MinGW64 Compiler**
4. 点击编译器列表上方的 **Copy** 按钮（如果你想保留配置）
5. 或直接点击 **Reset defaults** 重置所有编译器配置
6. 点击 **OK**

---

## 修复后测试

1. 关闭并重新打开 Code::Blocks
2. **文件 → 新建 → 项目**
3. 选择 **2D/3D Graphics → EGE project**
4. 在编译器选择页面，选择 **GNU GCC Compiler**（已正确配置的那个）
5. 完成创建，应该不会再出现错误

---

## 此 PR 包含的改进

以下改进已在此 Pull Request 中实现：

1. ✅ 修复了向导脚本的警告问题（手动添加 `-Wall` 而不是调用 `WarningsOn()`）
2. ✅ 移除了编译器过滤器限制（从 `gcc*` 改为 `*`），允许选择任何已配置的编译器
3. ✅ 更新了使用手册，增加了编译器配置说明
4. ✅ 创建了编译器配置检查工具

下次构建安装包时，这些改进会自动包含。

---

## 快速检查命令

运行以下命令检查编译器配置：

```powershell
.\scripts\check-codeblocks-compiler.ps1
```
