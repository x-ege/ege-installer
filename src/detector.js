/**
 * EGE Installer - IDE Detector Module
 * 用于检测系统中已安装的 IDE 和编译器
 */

var Detector = (function () {
  var shell = new ActiveXObject("WScript.Shell");
  var fso = new ActiveXObject("Scripting.FileSystemObject");

  // Visual Studio 版本配置
  var vsVersions = [
    { name: "Visual Studio 2026", version: "18.0", regKey: "18.0", year: "2026", supported: true },
    { name: "Visual Studio 2022", version: "17.0", regKey: "17.0", year: "2022", supported: true },
    { name: "Visual Studio 2019", version: "16.0", regKey: "16.0", year: "2019", supported: true },
    { name: "Visual Studio 2017", version: "15.0", regKey: "15.0", year: "2017", supported: true },
    { name: "Visual Studio 2015", version: "14.0", regKey: "14.0", year: "2015", supported: false },
    { name: "Visual Studio 2013", version: "12.0", regKey: "12.0", year: "2013", supported: false },
    { name: "Visual Studio 2012", version: "11.0", regKey: "11.0", year: "2012", supported: false },
    { name: "Visual Studio 2010", version: "10.0", regKey: "10.0", year: "2010", supported: true }
  ];

  // MSVC 工具集版本映射 (根据 MSVC 版本号主版本推断对应的 VS 年份)
  // MSVC 目录格式: 14.xx.xxxxx，其中 xx 决定工具集版本
  var msvcToolsetMapping = {
    // 14.4x = v143 (VS2022/VS2026)
    "44": { toolset: "v143", year: "2022", label: "VS2022/2026" },
    "43": { toolset: "v143", year: "2022", label: "VS2022" },
    "42": { toolset: "v143", year: "2022", label: "VS2022" },
    "41": { toolset: "v143", year: "2022", label: "VS2022" },
    "40": { toolset: "v143", year: "2022", label: "VS2022" },
    // 14.3x = v143 (VS2022 早期版本)
    "39": { toolset: "v143", year: "2022", label: "VS2022" },
    "38": { toolset: "v143", year: "2022", label: "VS2022" },
    "37": { toolset: "v143", year: "2022", label: "VS2022" },
    "36": { toolset: "v143", year: "2022", label: "VS2022" },
    "35": { toolset: "v143", year: "2022", label: "VS2022" },
    "34": { toolset: "v143", year: "2022", label: "VS2022" },
    "33": { toolset: "v143", year: "2022", label: "VS2022" },
    "32": { toolset: "v143", year: "2022", label: "VS2022" },
    "31": { toolset: "v143", year: "2022", label: "VS2022" },
    "30": { toolset: "v143", year: "2022", label: "VS2022" },
    // 14.2x = v142 (VS2019)
    "29": { toolset: "v142", year: "2019", label: "VS2019" },
    "28": { toolset: "v142", year: "2019", label: "VS2019" },
    "27": { toolset: "v142", year: "2019", label: "VS2019" },
    "26": { toolset: "v142", year: "2019", label: "VS2019" },
    "25": { toolset: "v142", year: "2019", label: "VS2019" },
    "24": { toolset: "v142", year: "2019", label: "VS2019" },
    "23": { toolset: "v142", year: "2019", label: "VS2019" },
    "22": { toolset: "v142", year: "2019", label: "VS2019" },
    "21": { toolset: "v142", year: "2019", label: "VS2019" },
    "20": { toolset: "v142", year: "2019", label: "VS2019" },
    // 14.1x = v141 (VS2017)
    "19": { toolset: "v141", year: "2017", label: "VS2017" },
    "18": { toolset: "v141", year: "2017", label: "VS2017" },
    "17": { toolset: "v141", year: "2017", label: "VS2017" },
    "16": { toolset: "v141", year: "2017", label: "VS2017" },
    "15": { toolset: "v141", year: "2017", label: "VS2017" },
    "14": { toolset: "v141", year: "2017", label: "VS2017" },
    "13": { toolset: "v141", year: "2017", label: "VS2017" },
    "12": { toolset: "v141", year: "2017", label: "VS2017" },
    "11": { toolset: "v141", year: "2017", label: "VS2017" },
    "10": { toolset: "v141", year: "2017", label: "VS2017" }
  };

  // MinGW 常见安装路径
  var mingwPaths = [
    { name: "MSYS2 MinGW64", paths: ["C:\\msys64\\mingw64", "D:\\msys64\\mingw64"] },
    { name: "MSYS2 MinGW32", paths: ["C:\\msys64\\mingw32", "D:\\msys64\\mingw32"] },
    { name: "MinGW-w64", paths: ["C:\\mingw64", "C:\\mingw-w64", "D:\\mingw64"] },
    { name: "MinGW32", paths: ["C:\\MinGW", "C:\\mingw32", "D:\\MinGW"] }
  ];

  // Red Panda 独立 IDE（使用 MinGW）
  var redPandaPaths = [
    "C:\\Program Files\\RedPanda-Cpp",
    "C:\\Program Files (x86)\\RedPanda-Cpp"
  ];

  // Dev-C++ 常见安装路径（不包括 Red Panda）
  var devCppPaths = [
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

  // CLion 路径（直接安装和 Toolbox 安装）
  var clionBasePaths = [
    // 直接安装版本
    "C:\\Program Files\\JetBrains",
    "C:\\Program Files (x86)\\JetBrains",
    // Toolbox 安装版本 - 使用环境变量展开
    "%LOCALAPPDATA%\\JetBrains\\Toolbox\\apps"
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
   * 获取目录下的所有子目录名
   */
  function getSubDirNames(path) {
    var dirs = [];
    try {
      if (!fso.FolderExists(path)) return dirs;
      var folder = fso.GetFolder(path);
      var subFolders = new Enumerator(folder.SubFolders);
      for (; !subFolders.atEnd(); subFolders.moveNext()) {
        dirs.push({
          name: subFolders.item().Name,
          path: subFolders.item().Path
        });
      }
    } catch (e) { }
    return dirs;
  }

  /**
   * 根据 MSVC 版本号获取工具集信息
   * @param {string} msvcVersion - MSVC 版本号，如 "14.44.34920"
   * @returns {object|null} 工具集信息 { toolset, year, label }
   */
  function getMsvcToolsetInfo(msvcVersion) {
    // 解析版本号 14.xx.xxxxx
    var parts = msvcVersion.split(".");
    if (parts.length < 2) return null;

    var minorVersion = parts[1];
    // 取前两位作为 key
    var key = minorVersion.substring(0, 2);

    var direct = msvcToolsetMapping[key];
    if (direct) return direct;

    // 未知 minor：按区间兜底到最近支持的工具集，避免库目录指向不存在的 vs20xx
    var minor = parseInt(key, 10);
    if (!isNaN(minor)) {
      if (minor >= 30) return msvcToolsetMapping["30"]; // v143 / VS2022
      if (minor >= 20) return msvcToolsetMapping["20"]; // v142 / VS2019
      if (minor >= 10) return msvcToolsetMapping["10"]; // v141 / VS2017
    }

    return null;
  }

  /**
   * 使用 vswhere 检测 Visual Studio 2017+
   * 会扫描每个 VS 实例中安装的所有 MSVC 工具集版本
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

          // 从名称中提取年份（如 "Visual Studio Community 2022"）
          var yearMatch = name.match(/20\d{2}/);
          var vsYear = yearMatch ? yearMatch[0] : "";

          // 如果无法从名称提取，根据版本号推断
          if (!vsYear && version) {
            var majorVersion = parseInt(version.split(".")[0], 10);
            if (majorVersion >= 18) vsYear = "2026";
            else if (majorVersion === 17) vsYear = "2022";
            else if (majorVersion === 16) vsYear = "2019";
            else if (majorVersion === 15) vsYear = "2017";
            else if (majorVersion === 14) vsYear = "2015";
            else if (majorVersion === 12) vsYear = "2013";
            else if (majorVersion === 11) vsYear = "2012";
          }

          // 检查该年份的 VS 是否被 EGE 支持
          var isSupported = true;
          for (var vsIdx = 0; vsIdx < vsVersions.length; vsIdx++) {
            if (vsVersions[vsIdx].year === vsYear) {
              isSupported = vsVersions[vsIdx].supported !== false;
              break;
            }
          }

          if (!pathExists(path)) continue;

          // 扫描 VC\Tools\MSVC 目录下的所有 MSVC 版本
          var msvcBasePath = path + "\\VC\\Tools\\MSVC";
          if (pathExists(msvcBasePath)) {
            var msvcVersions = getSubDirNames(msvcBasePath);

            // VC\Tools\MSVC 存在但没有版本子目录：仍展示该 VS，但禁用安装
            if (!msvcVersions || msvcVersions.length === 0) {
              results.push({
                name: name + " (未安装 C++ 工具集)",
                path: path,
                version: version,
                year: vsYear,
                vsYear: vsYear,
                type: "vs",
                found: false,
                supported: isSupported,
                includePath: "",
                libPath: ""
              });
              continue;
            }

            // 按版本号排序（降序，最新的在前）
            msvcVersions.sort(function (a, b) {
              if (a.name === b.name) return 0;
              return a.name < b.name ? 1 : -1;
            });

            for (var k = 0; k < msvcVersions.length; k++) {
              var msvcVer = msvcVersions[k];
              var toolsetInfo = getMsvcToolsetInfo(msvcVer.name);

              var includePath = msvcVer.path + "\\include";
              var libPath = msvcVer.path + "\\lib";
              var found = pathExists(includePath) && pathExists(libPath);

              // 构建显示名称
              var displayName;
              var effectiveYear;

              if (toolsetInfo) {
                effectiveYear = toolsetInfo.year;
                // 如果工具集年份与 VS 实例年份相同，不显示额外标签
                if (toolsetInfo.year === vsYear) {
                  displayName = name + " (MSVC " + toolsetInfo.toolset + ")";
                } else {
                  displayName = name + " (MSVC " + toolsetInfo.toolset + " - " + toolsetInfo.label + " 工具集)";
                }
              } else {
                // 仍然无法识别工具集版本：保守回退到 VS 实例年份
                effectiveYear = vsYear;
                displayName = name + " (MSVC " + msvcVer.name + ")";
              }

              results.push({
                name: displayName,
                path: path,
                version: version,
                year: effectiveYear,
                vsYear: vsYear,
                type: "vs",
                found: found,
                supported: isSupported,
                msvcVersion: msvcVer.name,
                msvcPath: msvcVer.path,
                toolset: toolsetInfo ? toolsetInfo.toolset : null,
                includePath: found ? includePath : "",
                libPath: found ? libPath : ""
              });
            }
          } else {
            // 没有找到 MSVC 目录，可能是旧版 VS 或不完整安装
            var legacyInclude = path + "\\VC\\include";
            var legacyLib = path + "\\VC\\lib";
            var legacyFound = pathExists(legacyInclude) && pathExists(legacyLib);

            results.push({
              name: name,
              path: path,
              version: version,
              year: vsYear,
              type: "vs",
              found: legacyFound,
              supported: isSupported,
              includePath: legacyFound ? legacyInclude : "",
              libPath: legacyFound ? legacyLib : ""
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
              supported: vs.supported !== false,
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
   * 检测 Red Panda
   */
  function detectRedPanda() {
    var results = [];
    var found = false;
    var foundPath = "";

    for (var i = 0; i < redPandaPaths.length; i++) {
      if (pathExists(redPandaPaths[i])) {
        found = true;
        foundPath = redPandaPaths[i];
        break;
      }
    }

    if (found) {
      // 查找 MinGW 目录
      var mingwDir = foundPath + "\\MinGW64";
      if (!pathExists(mingwDir)) {
        mingwDir = foundPath + "\\MinGW32";
      }

      // 验证 MinGW 目录是否包含有效的 include/lib
      var hasValidMinGW = pathExists(mingwDir + "\\include") && pathExists(mingwDir + "\\lib");

      results.push({
        name: "Red Panda (MinGW)",
        path: foundPath,
        type: "redpanda",
        found: hasValidMinGW,
        includePath: hasValidMinGW ? mingwDir + "\\include" : "",
        libPath: hasValidMinGW ? mingwDir + "\\lib" : ""
      });
    } else {
      results.push({
        name: "Red Panda (MinGW)",
        path: redPandaPaths[0],
        type: "redpanda",
        found: false,
        includePath: "",
        libPath: ""
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

        // 检测模板是否已安装
        var templatesDir = foundPath + "\\Templates";
        var templateInstalled = pathExists(templatesDir + "\\EGE_Graphics.template");

        results.push({
          name: devcpp.name,
          path: foundPath,
          type: "devcpp",
          found: true,
          includePath: mingwDir + "\\include",
          libPath: mingwDir + "\\lib",
          templatesPath: templatesDir,
          templateInstalled: templateInstalled
        });
      } else {
        results.push({
          name: devcpp.name,
          path: devcpp.paths[0],
          type: "devcpp",
          found: false,
          includePath: "",
          libPath: "",
          templatesPath: "",
          templateInstalled: false
        });
      }
    }

    return results;
  }

  /**
   * 获取 Code::Blocks 版本号
   * 通过 codeblocks.exe 的文件版本信息获取
   * @returns {{ major: number, minor: number, versionStr: string } | null}
   */
  function getCodeBlocksVersion(exePath) {
    try {
      if (!exePath || !pathExists(exePath)) return null;
      var ver = fso.GetFileVersion(exePath);
      if (!ver || ver === "") return null;
      // 版本格式: "25.3.0.0" (major.minor.build.revision)
      var parts = ver.split(".");
      if (parts.length < 2) return null;
      return {
        major: parseInt(parts[0], 10),
        minor: parseInt(parts[1], 10),
        versionStr: ver
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * 判断 Code::Blocks 版本是否 >= 25.03
   * 只有 >= 25.03 的版本才支持安装 Projects wizard
   */
  function isCBVersionSupportWizard(ver) {
    if (!ver) return false;
    // 25.03 -> major=25, minor=3
    if (ver.major > 25) return true;
    if (ver.major === 25 && ver.minor >= 3) return true;
    return false;
  }

  /**
   * 检测 Code::Blocks
   */
  function detectCodeBlocks() {
    var results = [];

    // 检测模板是否已安装（全局模板目录 + 旧的用户模板目录）
    var appData = shell.ExpandEnvironmentStrings("%APPDATA%");
    var userTemplateDir = appData + "\\CodeBlocks\\UserTemplates\\EGE_Project";
    var userTemplateInstalled = pathExists(userTemplateDir + "\\EGE_Project.cbp") || pathExists(userTemplateDir + "\\EGE_Project.template");

    // 用户级 share 模板目录（无需管理员权限）
    var userShareTemplatesDir = appData + "\\CodeBlocks\\share\\CodeBlocks\\templates";
    var userShareTemplateInstalled = pathExists(userShareTemplatesDir + "\\EGE_Project.template") || pathExists(userShareTemplatesDir + "\\EGE_Project.cbp");

    for (var i = 0; i < codeBlocksPaths.length; i++) {
      var cb = codeBlocksPaths[i];
      var found = false;
      var foundPath = "";

      var exePath = "";
      var shareTemplatesDir = "";
      var shareTemplateInstalled = false;
      var cbVersion = null;
      var supportsWizard = false;

      for (var j = 0; j < cb.paths.length; j++) {
        var base = cb.paths[j];
        var exe = base.replace(/\\+$/, "") + "\\codeblocks.exe";
        if (pathExists(exe)) {
          found = true;
          foundPath = base;
          exePath = exe;
          break;
        }
      }

      if (found) {
        shareTemplatesDir = foundPath.replace(/\\+$/, "") + "\\share\\CodeBlocks\\templates";
        shareTemplateInstalled = pathExists(shareTemplatesDir + "\\EGE_Project.template") || pathExists(shareTemplatesDir + "\\EGE_Project.cbp");

        // 检测版本
        cbVersion = getCodeBlocksVersion(exePath);
        supportsWizard = isCBVersionSupportWizard(cbVersion);
      }

      var templateInstalled = shareTemplateInstalled || userShareTemplateInstalled || userTemplateInstalled;

      // 检测 wizard 是否已安装
      var wizardDir = found ? (foundPath.replace(/\\+$/, "") + "\\share\\CodeBlocks\\templates\\wizard\\ege") : "";
      var wizardInstalled = wizardDir && pathExists(wizardDir + "\\wizard.script");

      // Code::Blocks 有些安装不带 MinGW，此时 include/lib 不一定存在
      var includePath = found ? (foundPath + "\\MinGW\\include") : "";
      var libPath = found ? (foundPath + "\\MinGW\\lib") : "";
      if (found && !pathExists(includePath)) includePath = "";
      if (found && !pathExists(libPath)) libPath = "";

      // 构建显示名称（附带版本号）
      var displayName = cb.name;
      if (cbVersion) {
        displayName += " " + cbVersion.major + "." + (cbVersion.minor < 10 ? "0" : "") + cbVersion.minor;
      }

      results.push({
        name: displayName,
        path: found ? foundPath : cb.paths[0],
        type: "codeblocks",
        found: found,
        exePath: exePath,
        cbVersion: cbVersion,
        supportsWizard: supportsWizard,
        templatesPath: shareTemplatesDir,
        userShareTemplatesPath: userShareTemplatesDir,
        includePath: includePath,
        libPath: libPath,
        templateInstalled: templateInstalled,
        templateInstalledInShare: shareTemplateInstalled,
        templateInstalledInUserShare: userShareTemplateInstalled,
        templateInstalledInUserDir: userTemplateInstalled,
        wizardInstalled: wizardInstalled
      });
    }

    return results;
  }

  /**
   * 检测 CLion
   */
  function detectCLion() {
    var results = [];

    // 展开环境变量
    function expandEnv(path) {
      return shell.ExpandEnvironmentStrings(path);
    }

    // 获取目录下的所有子目录
    function getSubDirs(path) {
      var dirs = [];
      try {
        if (!fso.FolderExists(path)) return dirs;
        var folder = fso.GetFolder(path);
        var subFolders = new Enumerator(folder.SubFolders);
        for (; !subFolders.atEnd(); subFolders.moveNext()) {
          dirs.push(subFolders.item().Path);
        }
      } catch (e) { }
      return dirs;
    }

    // 检查 CLion 目录中的 MinGW 路径
    function findMinGWInCLion(clionPath) {
      var possiblePaths = [
        clionPath + "\\bin\\mingw",
        clionPath + "\\mingw",
        clionPath + "\\bundled"
      ];

      for (var i = 0; i < possiblePaths.length; i++) {
        if (pathExists(possiblePaths[i] + "\\include") &&
          pathExists(possiblePaths[i] + "\\lib")) {
          return possiblePaths[i];
        }
      }
      return null;
    }

    // 1. 检测 Toolbox 新版安装方式 (%LOCALAPPDATA%\Programs\CLion)
    var toolboxNewPaths = [
      expandEnv("%LOCALAPPDATA%\\Programs")
    ];

    for (var t = 0; t < toolboxNewPaths.length; t++) {
      var programsPath = toolboxNewPaths[t];
      if (!programsPath || !fso.FolderExists(programsPath)) continue;

      var apps = getSubDirs(programsPath);
      for (var a = 0; a < apps.length; a++) {
        var appName = fso.GetFileName(apps[a]).toLowerCase();
        if (appName.indexOf("clion") === 0) {
          var mingwPath = findMinGWInCLion(apps[a]);
          if (mingwPath) {
            results.push({
              name: "CLion (MinGW)",
              path: apps[a],
              type: "clion",
              found: true,
              includePath: mingwPath + "\\include",
              libPath: mingwPath + "\\lib",
              installType: "toolbox-programs"
            });
          }
        }
      }
    }

    // 2. 检测直接安装的 CLion
    var directPaths = [
      "C:\\Program Files\\JetBrains",
      "C:\\Program Files (x86)\\JetBrains",
      expandEnv("%PROGRAMFILES%\\JetBrains"),
      expandEnv("%PROGRAMFILES(X86)%\\JetBrains"),
      "D:\\Program Files\\JetBrains",
      "E:\\Program Files\\JetBrains"
    ];

    for (var i = 0; i < directPaths.length; i++) {
      var jbPath = directPaths[i];
      if (!jbPath || !fso.FolderExists(jbPath)) continue;

      var subDirs = getSubDirs(jbPath);
      for (var j = 0; j < subDirs.length; j++) {
        var dirName = fso.GetFileName(subDirs[j]);
        if (dirName.toLowerCase().indexOf("clion") === 0) {
          var mingwPath2 = findMinGWInCLion(subDirs[j]);
          if (mingwPath2) {
            results.push({
              name: "CLion (MinGW)",
              path: subDirs[j],
              type: "clion",
              found: true,
              includePath: mingwPath2 + "\\include",
              libPath: mingwPath2 + "\\lib",
              installType: "direct"
            });
          }
        }
      }
    }

    // 3. 检测 Toolbox 旧版安装方式 (apps/clion/ch-0/<version>)
    var toolboxOldPaths = [
      expandEnv("%LOCALAPPDATA%\\JetBrains\\Toolbox\\apps"),
      expandEnv("%APPDATA%\\JetBrains\\Toolbox\\apps")
    ];

    for (var tb = 0; tb < toolboxOldPaths.length; tb++) {
      var toolboxPath = toolboxOldPaths[tb];
      if (!toolboxPath || !fso.FolderExists(toolboxPath)) continue;

      var appDirs = getSubDirs(toolboxPath);
      for (var k = 0; k < appDirs.length; k++) {
        var appName2 = fso.GetFileName(appDirs[k]).toLowerCase();
        if (appName2 === "clion" || appName2 === "clion-eap") {
          var channelDirs = getSubDirs(appDirs[k]);
          for (var l = 0; l < channelDirs.length; l++) {
            var versionDirs = getSubDirs(channelDirs[l]);
            for (var m = 0; m < versionDirs.length; m++) {
              var versionPath = versionDirs[m];
              var mingwPath3 = findMinGWInCLion(versionPath);
              if (mingwPath3) {
                results.push({
                  name: "CLion (MinGW)",
                  path: versionPath,
                  type: "clion",
                  found: true,
                  includePath: mingwPath3 + "\\include",
                  libPath: mingwPath3 + "\\lib",
                  installType: "toolbox-apps"
                });
              }
            }
          }
        }
      }
    }

    // 去重：移除路径相同的重复项
    var deduplicated = [];
    for (var r = 0; r < results.length; r++) {
      var isDuplicate = false;
      var pathLower = results[r].path.toLowerCase();

      for (var d = 0; d < deduplicated.length; d++) {
        if (deduplicated[d].path.toLowerCase() === pathLower) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        deduplicated.push(results[r]);
      }
    }

    return deduplicated;
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

    // 检测 Red Panda
    var redPandaResults = detectRedPanda();
    for (var rp = 0; rp < redPandaResults.length; rp++) {
      allIDEs.push(redPandaResults[rp]);
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

    // 检测 CLion
    var clionResults = detectCLion();
    for (var cl = 0; cl < clionResults.length; cl++) {
      allIDEs.push(clionResults[cl]);
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
    detectRedPanda: detectRedPanda,
    detectDevCpp: detectDevCpp,
    detectCodeBlocks: detectCodeBlocks,
    detectCLion: detectCLion,
    pathExists: pathExists
  };
})();
