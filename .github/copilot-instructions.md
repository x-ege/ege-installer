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

## EGE Location

- xege-sdk: <https://github.com/x-ege/xege-sdk>

Library files in sibling directory `../xege_libs/`:
- `include/` - Headers (ege.h, graphics.h)
- `lib/msvc/` - VS2017-2026 unified library (x64/x86)
- `lib/vs2010/` - VS2010 library
- `lib/mingw64/`, `lib/mingw32/` - MinGW libraries
- `lib/redpanda/`, `lib/devcpp/`, `lib/codeblocks/` - IDE-specific libraries

**Note**: VS2017+ use unified `msvc/` directory for 60% size reduction (binary compatible across v141-v143+ toolsets)

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
