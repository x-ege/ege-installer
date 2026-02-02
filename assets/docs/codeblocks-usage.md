# Code::Blocks EGE 项目使用指南

## 🎉 安装成功

EGE 图形库已成功安装到您的 Code::Blocks！

---

## 📝 创建新的 EGE 项目

### 方法一：使用项目模板（推荐）

1. 打开 Code::Blocks
2. 点击菜单：**文件 → 从用户模板新建...**
3. 在弹出的对话框中选择：**EGE_Project**
4. 输入项目名称和保存位置
5. 点击确定，项目创建完成！

**模板已自动配置好所有链接选项，无需手动设置。**

---

### 方法二：手动配置现有项目

如果您需要在现有项目中使用 EGE，请按以下步骤配置：

#### 1. 打开项目设置

- 右键点击项目名称 → **Build options...**

#### 2. 配置链接器选项

在 **Linker settings** 标签页：

**Link libraries 区域添加：**

```text
graphics
gdiplus
gdi32
imm32
msimg32
ole32
oleaut32
winmm
uuid
```

**Other linker options 区域添加：**

```text
-mwindows
-static
```

#### 3. 保存设置

点击 **OK** 保存所有设置。

---

## 🚀 快速开始示例

创建 `main.cpp` 并输入以下代码：

```cpp
#include <graphics.h>

int main()
{
    // 初始化图形窗口 (640x480)
    initgraph(640, 480, 0);
    
    // 设置窗口标题
    setcaption("EGE Graphics - Hello World");
    
    // 设置背景色为白色
    setbkcolor(WHITE);
    cleardevice();
    
    // 绘制一个蓝色填充圆
    setfillcolor(BLUE);
    fillellipse(320, 200, 100, 100);
    
    // 设置文字颜色并输出
    setcolor(BLACK);
    setfont(24, 0, "微软雅黑");
    outtextxy(220, 350, "Hello, EGE Graphics!");
    
    // 等待用户按键
    getch();
    
    // 关闭图形窗口
    closegraph();
    
    return 0;
}
```

点击 **Build and run** (F9) 即可运行程序！

---

## 📚 更多资源

- **官方网站**: <https://xege.org/>
- **API 文档**: <https://xege.org/man/api/>
- **示例教程**: <https://xege.org/man/tutorial/>
- **GitHub**: <https://github.com/wysaid/xege>

---

## ❓ 常见问题

### Q: 编译时提示找不到 graphics.h？

**A**: 确保已安装到正确的 Code::Blocks，重新运行安装程序。

### Q: 链接时出现 undefined reference 错误？

**A**: 检查链接器设置中是否添加了所有必需的库（见上方配置步骤）。

### Q: 程序运行时闪退？

**A**: 检查是否调用了 `getch()` 等待用户输入，避免窗口立即关闭。

### Q: 如何卸载 EGE？

**A**: 运行安装程序，点击"卸载"按钮即可删除已安装的文件。

---

## 💡 提示

- 使用项目模板可以省去手动配置的麻烦
- 编译前确保项目已正确配置链接选项
- 遇到问题可以访问官方网站查看详细文档

祝您使用愉快！🎨
