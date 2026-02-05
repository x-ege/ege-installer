/**
 * EGE Graphics Project
 *
 * EGE (Easy Graphics Engine) - https://xege.org/
 * 这是一个 EGE 图形库的示例程序。
 */

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
    setfont(24, 0, "Consolas");
    outtextxy(200, 350, "Hello, EGE Graphics!");

    // 等待用户按键
    getch();

    // 关闭图形窗口
    closegraph();

    return 0;
}
