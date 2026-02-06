/**
 * EGE Graphics Project
 *
 * EGE (Easy Graphics Engine) - https://xege.org/
 * A simple graphics library for beginners
 */

#include <graphics.h>

int main()
{
    // Initialize graphics window (640x480)
    initgraph(640, 480, 0);

    // Set window title
    setcaption("EGE Graphics - Hello World");

    // Set background color to white
    setbkcolor(WHITE);
    cleardevice();

    // Draw a blue filled circle
    setfillcolor(BLUE);
    fillellipse(320, 200, 100, 100);

    // Draw text message
    setcolor(BLACK);
    setfont(24, 0, "Consolas");
    outtextxy(200, 350, "Hello, EGE Graphics!");

    // Wait for key press
    getch();

    // Close graphics window
    closegraph();

    return 0;
}
