# EGE Installer Project

Installer for [EGE (Easy Graphics Engine)](https://github.com/x-ege/xege) - configures EGE library globally for various IDEs.

## Tech Stack

- **UI**: HTA + JScript
- **Packaging**: NSIS (Nullsoft Scriptable Install System)
- **Supported IDEs**: Visual Studio 2010-2026, MinGW-w64/MSYS2, Dev-C++, Code::Blocks, Red Panda Dev-C++

## Key Files

- `src/setup.hta` - Main installer UI
- `src/detector.js` - IDE detection (registry + vswhere + common paths)
- `src/installer.js` - File copy logic
- `scripts/build.ps1` - Build script (PowerShell)
- `scripts/installer.nsi` - NSIS installer script

## EGE Library Location

Library files in sibling directory `../xege_libs/`:
- `include/` - Headers (ege.h, graphics.h)
- `lib/<compiler>/<arch>/` - Prebuilt libraries

## Development

```powershell
# Run installer
mshta.exe .\src\setup.hta

# Build package
.\scripts\build.ps1
```

## Notes

- Requires admin privileges
- Uses COM objects: `WScript.Shell`, `Scripting.FileSystemObject`
