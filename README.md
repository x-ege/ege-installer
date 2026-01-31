# EGE Installer (WIP)

[![GitHub](https://img.shields.io/badge/GitHub-x--ege/xege-blue)](https://github.com/x-ege/xege)

Installer for [EGE (Easy Graphics Engine)](https://github.com/x-ege/xege) - configures EGE library globally for various IDEs.

## Features

- Auto-detect installed IDEs and compilers
- Support Visual Studio, MinGW, Dev-C++, Code::Blocks
- Modern HTA-based GUI installer
- One-click installation

## Supported IDEs

| IDE | Versions | Architecture |
|-----|----------|--------------|
| Visual Studio | 2010-2026 | x86, x64 |
| MinGW-w64 | MSYS2, Standalone | x86, x64 |
| Dev-C++ | Embarcadero, Red Panda | x86, x64 |
| Code::Blocks | Latest | x64 |

## Usage

### Development

```powershell
# Run installer directly
mshta.exe .\src\setup.hta
```

Or press `F5` in VSCode.

### Build Package

```powershell
.\scripts\build.ps1
```

Output: `dist/ege-setup-<version>.exe`

## Project Structure

```
ege-installer/
├── src/
│   ├── setup.hta        # Main UI
│   ├── detector.js      # IDE detection
│   └── installer.js     # Installation logic
├── scripts/
│   └── build.ps1        # Build script
└── .vscode/             # VSCode config
```

## Requirements

- Windows 7+
- 7-Zip (for building)
- EGE library files in `../xege_libs/`

## License

MIT License
