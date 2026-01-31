/**
 * EGE Installer - IDE Detector Module
 * 用于检测系统中已安装的 IDE 和编译器
 */

var Detector = (function () {
  var shell = new ActiveXObject("WScript.Shell");
  var fso = new ActiveXObject("Scripting.FileSystemObject");

  // Visual Studio 版本配置
  var vsVersions = [
    { name: "Visual Studio 2026", version: "17.0", regKey: "17.0", year: "2026" },
    { name: "Visual Studio 2022", version: "17.0", regKey: "17.0", year: "2022" },
    { name: "Visual Studio 2019", version: "16.0", regKey: "16.0", year: "2019" },
    { name: "Visual Studio 2017", version: "15.0", regKey: "15.0", year: "2017" },
    { name: "Visual Studio 2015", version: "14.0", regKey: "14.0", year: "2015" },
    { name: "Visual Studio 2013", version: "12.0", regKey: "12.0", year: "2013" },
    { name: "Visual Studio 2012", version: "11.0", regKey: "11.0", year: "2012" },
    { name: "Visual Studio 2010", version: "10.0", regKey: "10.0", year: "2010" }
  ];

  // MinGW 常见安装路径
  var mingwPaths = [
    { name: "MSYS2 MinGW64", paths: ["C:\\msys64\\mingw64", "D:\\msys64\\mingw64"] },
    { name: "MSYS2 MinGW32", paths: ["C:\\msys64\\mingw32", "D:\\msys64\\mingw32"] },
    { name: "MinGW-w64", paths: ["C:\\mingw64", "C:\\mingw-w64", "D:\\mingw64"] },
    { name: "MinGW32", paths: ["C:\\MinGW", "C:\\mingw32", "D:\\MinGW"] }
  ];

  // Dev-C++ 常见安装路径
  var devCppPaths = [
    {
      name: "Red Panda Dev-C++", paths: [
        "C:\\Program Files\\RedPanda-Cpp",
        "C:\\Program Files (x86)\\RedPanda-Cpp"
      ]
    },
    {
      name: "Embarcadero Dev-C++", paths: [
        "C:\\Program Files (x86)\\Embarcadero\\Dev-Cpp",
        "C:\\Program Files\\Embarcadero\\Dev-Cpp"
      ]
    },
    {
      name: "Dev-C++", paths: [
        "C:\\Program Files (x86)\\Dev-Cpp",
        "C:\\Program Files\\Dev-Cpp"
      ]
    }
  ];

  // Code::Blocks 路径
  var codeBlocksPaths = [
    {
      name: "Code::Blocks", paths: [
        "C:\\Program Files\\CodeBlocks",
        "C:\\Program Files (x86)\\CodeBlocks"
      ]
    }
  ];

  /**
   * 读取注册表值
   */
  function readRegistry(key) {
    try {
      return shell.RegRead(key);
    } catch (e) {
      return null;
    }
  }

  /**
   * 检查路径是否存在
   */
  function pathExists(path) {
    try {
      return fso.FolderExists(path) || fso.FileExists(path);
    } catch (e) {
      return false;
    }
  }

  /**
   * 使用 vswhere 检测 Visual Studio 2017+
   */
  function detectVSWithVswhere() {
    var results = [];
    var vswherePaths = [
      "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe",
      "C:\\Program Files\\Microsoft Visual Studio\\Installer\\vswhere.exe"
    ];

    var vswherePath = null;
    for (var i = 0; i < vswherePaths.length; i++) {
      if (pathExists(vswherePaths[i])) {
        vswherePath = vswherePaths[i];
        break;
      }
    }

    if (!vswherePath) return results;

    try {
      var exec = shell.Exec('"' + vswherePath + '" -all -legacy -format json');
      var output = "";
      while (!exec.StdOut.AtEndOfStream) {
        output += exec.StdOut.ReadLine() + "\n";
      }

      // 简单解析 JSON（JScript 不支持 JSON.parse）
      var matches = output.match(/"installationPath"\s*:\s*"([^"]+)"/g);
      var versionMatches = output.match(/"installationVersion"\s*:\s*"([^"]+)"/g);
      var nameMatches = output.match(/"displayName"\s*:\s*"([^"]+)"/g);

      if (matches) {
        for (var j = 0; j < matches.length; j++) {
          var path = matches[j].replace(/"installationPath"\s*:\s*"/, "").replace(/"/, "");
          path = path.replace(/\\\\/g, "\\");

          var version = versionMatches && versionMatches[j] ?
            versionMatches[j].replace(/"installationVersion"\s*:\s*"/, "").replace(/"/, "") : "";

          var name = nameMatches && nameMatches[j] ?
            nameMatches[j].replace(/"displayName"\s*:\s*"/, "").replace(/"/, "") : "Visual Studio";

          if (pathExists(path)) {
            results.push({
              name: name,
              path: path,
              version: version,
              type: "vs",
              found: true,
              includePath: path + "\\VC\\Tools\\MSVC",
              libPath: path + "\\VC\\Tools\\MSVC"
            });
          }
        }
      }
    } catch (e) {
      // vswhere failed, fall back to registry detection
    }

    return results;
  }

  /**
   * 通过注册表检测旧版 Visual Studio
   */
  function detectVSFromRegistry() {
    var results = [];

    for (var i = 0; i < vsVersions.length; i++) {
      var vs = vsVersions[i];
      var regPaths = [
        "HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\" + vs.regKey + "\\InstallDir",
        "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\VisualStudio\\" + vs.regKey + "\\InstallDir",
        "HKCU\\SOFTWARE\\Microsoft\\VisualStudio\\" + vs.regKey + "\\InstallDir"
      ];

      for (var j = 0; j < regPaths.length; j++) {
        var installDir = readRegistry(regPaths[j]);
        if (installDir) {
          // 转换为 VC 目录
          var vcPath = installDir.replace(/\\Common7\\IDE\\?$/, "\\VC");
          if (pathExists(vcPath)) {
            results.push({
              name: vs.name,
              path: vcPath,
              version: vs.version,
              year: vs.year,
              type: "vs-legacy",
              found: true,
              includePath: vcPath + "\\include",
              libPath: vcPath + "\\lib"
            });
            break;
          }
        }
      }
    }

    return results;
  }

  /**
   * 检测 MinGW 安装
   */
  function detectMinGW() {
    var results = [];

    for (var i = 0; i < mingwPaths.length; i++) {
      var mingw = mingwPaths[i];
      var found = false;
      var foundPath = "";

      for (var j = 0; j < mingw.paths.length; j++) {
        if (pathExists(mingw.paths[j])) {
          found = true;
          foundPath = mingw.paths[j];
          break;
        }
      }

      results.push({
        name: mingw.name,
        path: found ? foundPath : mingw.paths[0],
        type: "mingw",
        found: found,
        includePath: found ? foundPath + "\\include" : "",
        libPath: found ? foundPath + "\\lib" : ""
      });
    }

    return results;
  }

  /**
   * 检测 Dev-C++
   */
  function detectDevCpp() {
    var results = [];

    for (var i = 0; i < devCppPaths.length; i++) {
      var devcpp = devCppPaths[i];
      var found = false;
      var foundPath = "";

      for (var j = 0; j < devcpp.paths.length; j++) {
        if (pathExists(devcpp.paths[j])) {
          found = true;
          foundPath = devcpp.paths[j];
          break;
        }
      }

      if (found) {
        // 查找 MinGW 目录
        var mingwDir = foundPath + "\\MinGW64";
        if (!pathExists(mingwDir)) {
          mingwDir = foundPath + "\\MinGW32";
        }
        if (!pathExists(mingwDir)) {
          mingwDir = foundPath + "\\TDM-GCC-64";
        }

        results.push({
          name: devcpp.name,
          path: foundPath,
          type: "devcpp",
          found: true,
          includePath: mingwDir + "\\include",
          libPath: mingwDir + "\\lib"
        });
      } else {
        results.push({
          name: devcpp.name,
          path: devcpp.paths[0],
          type: "devcpp",
          found: false,
          includePath: "",
          libPath: ""
        });
      }
    }

    return results;
  }

  /**
   * 检测 Code::Blocks
   */
  function detectCodeBlocks() {
    var results = [];

    for (var i = 0; i < codeBlocksPaths.length; i++) {
      var cb = codeBlocksPaths[i];
      var found = false;
      var foundPath = "";

      for (var j = 0; j < cb.paths.length; j++) {
        if (pathExists(cb.paths[j])) {
          found = true;
          foundPath = cb.paths[j];
          break;
        }
      }

      results.push({
        name: cb.name,
        path: found ? foundPath : cb.paths[0],
        type: "codeblocks",
        found: found,
        includePath: found ? foundPath + "\\MinGW\\include" : "",
        libPath: found ? foundPath + "\\MinGW\\lib" : ""
      });
    }

    return results;
  }

  /**
   * 检测所有 IDE
   */
  function detectAll() {
    var allIDEs = [];

    // 检测 Visual Studio (新版用 vswhere，旧版用注册表)
    var vsResults = detectVSWithVswhere();
    var vsLegacyResults = detectVSFromRegistry();

    // 合并去重
    for (var i = 0; i < vsResults.length; i++) {
      allIDEs.push(vsResults[i]);
    }
    for (var j = 0; j < vsLegacyResults.length; j++) {
      var legacy = vsLegacyResults[j];
      var exists = false;
      for (var k = 0; k < allIDEs.length; k++) {
        if (allIDEs[k].path.toLowerCase() === legacy.path.toLowerCase()) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        allIDEs.push(legacy);
      }
    }

    // 检测 MinGW
    var mingwResults = detectMinGW();
    for (var m = 0; m < mingwResults.length; m++) {
      allIDEs.push(mingwResults[m]);
    }

    // 检测 Dev-C++
    var devCppResults = detectDevCpp();
    for (var d = 0; d < devCppResults.length; d++) {
      allIDEs.push(devCppResults[d]);
    }

    // 检测 Code::Blocks
    var cbResults = detectCodeBlocks();
    for (var c = 0; c < cbResults.length; c++) {
      allIDEs.push(cbResults[c]);
    }

    return allIDEs;
  }

  // 公开 API
  return {
    detectAll: detectAll,
    detectVS: function () {
      return detectVSWithVswhere().concat(detectVSFromRegistry());
    },
    detectMinGW: detectMinGW,
    detectDevCpp: detectDevCpp,
    detectCodeBlocks: detectCodeBlocks,
    pathExists: pathExists
  };
})();
