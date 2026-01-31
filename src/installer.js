/**
 * EGE Installer - Installation Module
 * 用于将 EGE 库文件安装到各 IDE
 */

var Installer = (function () {
  var shell = new ActiveXObject("WScript.Shell");
  var fso = new ActiveXObject("Scripting.FileSystemObject");

  // 获取当前脚本所在目录
  function getScriptDir() {
    try {
      // HTA 中获取路径
      var path = location.pathname;
      // 移除文件名，保留目录
      path = path.replace(/\/[^\/]*$/, "");
      // 处理 URL 编码和格式
      path = decodeURIComponent(path);
      // 移除开头的 /
      if (path.charAt(0) === "/") {
        path = path.substr(1);
      }
      // Windows 路径格式
      path = path.replace(/\//g, "\\");
      return path;
    } catch (e) {
      return ".";
    }
  }

  // EGE 库文件源目录（相对于安装器）
  function getEgeLibsPath() {
    var scriptDir = getScriptDir();
    // 向上两级到 ege-installer，再向上一级到 xege_libs
    var parentDir = fso.GetParentFolderName(scriptDir);
    var grandParentDir = fso.GetParentFolderName(parentDir);
    var egeLibsPath = grandParentDir + "\\xege_libs";

    if (!fso.FolderExists(egeLibsPath)) {
      // 尝试打包后的路径（同级目录）
      egeLibsPath = parentDir + "\\libs";
    }

    return egeLibsPath;
  }

  // IDE 类型到库目录的映射
  var libDirMapping = {
    "vs": function (ide) {
      return {
        "x86": "vs" + ide.year,
        "x64": "vs" + ide.year
      };
    },
    "vs-legacy": function (ide) {
      return {
        "x86": "vs" + ide.year,
        "x64": "vs" + ide.year
      };
    },
    "mingw": function (ide) {
      if (ide.name.indexOf("64") >= 0) {
        return { "x64": "mingw64" };
      } else {
        return { "x86": "mingw32" };
      }
    },
    "devcpp": function (ide) {
      return { "default": "devcpp" };
    },
    "codeblocks": function (ide) {
      return { "default": "codeblocks" };
    }
  };

  /**
   * 复制文件
   */
  function copyFile(src, dest, overwrite) {
    try {
      // 确保目标目录存在
      var destDir = fso.GetParentFolderName(dest);
      if (!fso.FolderExists(destDir)) {
        createFolder(destDir);
      }
      fso.CopyFile(src, dest, overwrite !== false);
      return true;
    } catch (e) {
      log("复制文件失败: " + src + " -> " + dest + " (" + e.message + ")", "error");
      return false;
    }
  }

  /**
   * 复制目录
   */
  function copyFolder(src, dest, overwrite) {
    try {
      if (!fso.FolderExists(dest)) {
        createFolder(dest);
      }
      fso.CopyFolder(src, dest, overwrite !== false);
      return true;
    } catch (e) {
      log("复制目录失败: " + src + " -> " + dest + " (" + e.message + ")", "error");
      return false;
    }
  }

  /**
   * 创建目录（递归）
   */
  function createFolder(path) {
    try {
      if (!fso.FolderExists(path)) {
        var parent = fso.GetParentFolderName(path);
        if (parent && !fso.FolderExists(parent)) {
          createFolder(parent);
        }
        fso.CreateFolder(path);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * 获取目录下所有文件
   */
  function getFiles(folderPath) {
    var files = [];
    try {
      var folder = fso.GetFolder(folderPath);
      var fc = new Enumerator(folder.Files);
      for (; !fc.atEnd(); fc.moveNext()) {
        files.push(fc.item().Path);
      }
    } catch (e) { }
    return files;
  }

  /**
   * 获取子目录
   */
  function getSubFolders(folderPath) {
    var folders = [];
    try {
      var folder = fso.GetFolder(folderPath);
      var fc = new Enumerator(folder.SubFolders);
      for (; !fc.atEnd(); fc.moveNext()) {
        folders.push(fc.item().Path);
      }
    } catch (e) { }
    return folders;
  }

  /**
   * 日志函数（由主程序提供）
   */
  var logFunc = function (msg, type) { };
  function log(msg, type) {
    logFunc(msg, type);
  }

  /**
   * 安装头文件到指定 IDE
   */
  function installHeaders(ide, egeLibsPath) {
    var srcInclude = egeLibsPath + "\\include";
    var destInclude = ide.includePath;

    log("安装头文件到: " + destInclude, "info");

    if (!fso.FolderExists(srcInclude)) {
      log("源头文件目录不存在: " + srcInclude, "error");
      return false;
    }

    // 复制主头文件
    var headerFiles = ["ege.h", "graphics.h"];
    for (var i = 0; i < headerFiles.length; i++) {
      var src = srcInclude + "\\" + headerFiles[i];
      var dest = destInclude + "\\" + headerFiles[i];
      if (fso.FileExists(src)) {
        if (copyFile(src, dest)) {
          log("  复制: " + headerFiles[i], "success");
        }
      }
    }

    // 复制 ege 子目录
    var egeSubDir = srcInclude + "\\ege";
    if (fso.FolderExists(egeSubDir)) {
      var destEgeDir = destInclude + "\\ege";
      if (copyFolder(egeSubDir, destEgeDir)) {
        log("  复制: ege\\ 目录", "success");
      }
    }

    return true;
  }

  /**
   * 安装库文件到指定 IDE
   */
  function installLibs(ide, egeLibsPath) {
    var srcLib = egeLibsPath + "\\lib";

    log("安装库文件...", "info");

    // 根据 IDE 类型确定使用哪个库目录
    var mapping = libDirMapping[ide.type];
    if (!mapping) {
      log("不支持的 IDE 类型: " + ide.type, "error");
      return false;
    }

    var libDirs = mapping(ide);

    for (var arch in libDirs) {
      var srcLibDir = srcLib + "\\" + libDirs[arch];

      if (arch !== "default") {
        srcLibDir += "\\" + arch;
      }

      if (!fso.FolderExists(srcLibDir)) {
        log("  库目录不存在: " + srcLibDir, "error");
        continue;
      }

      // 确定目标库目录
      var destLibDir = ide.libPath;
      if (arch === "x64" && ide.type.indexOf("vs") >= 0) {
        // Visual Studio x64 库在不同子目录
        if (fso.FolderExists(ide.libPath + "\\x64")) {
          destLibDir = ide.libPath + "\\x64";
        } else if (fso.FolderExists(ide.libPath + "\\amd64")) {
          destLibDir = ide.libPath + "\\amd64";
        }
      }

      // 复制库文件
      var libFiles = getFiles(srcLibDir);
      for (var i = 0; i < libFiles.length; i++) {
        var fileName = fso.GetFileName(libFiles[i]);
        var dest = destLibDir + "\\" + fileName;
        if (copyFile(libFiles[i], dest)) {
          log("  复制: " + fileName + " -> " + arch, "success");
        }
      }
    }

    return true;
  }

  /**
   * 安装 EGE 到指定 IDE
   */
  function installToIDE(ide, egeLibsPath, progressCallback, currentIndex, totalCount) {
    log("", "");
    log("=== 安装到 " + ide.name + " ===", "info");
    log("路径: " + ide.path, "info");

    var baseProgress = (currentIndex / totalCount) * 100;
    var stepProgress = (1 / totalCount) * 100;

    // 安装头文件
    progressCallback(baseProgress + stepProgress * 0.3, "正在安装头文件到 " + ide.name + "...");
    if (!installHeaders(ide, egeLibsPath)) {
      log("头文件安装失败", "error");
    }

    // 安装库文件
    progressCallback(baseProgress + stepProgress * 0.7, "正在安装库文件到 " + ide.name + "...");
    if (!installLibs(ide, egeLibsPath)) {
      log("库文件安装失败", "error");
    }

    log(ide.name + " 安装完成", "success");
    return true;
  }

  /**
   * 查找 VS 的实际 include/lib 目录
   */
  function resolveVSPaths(ide) {
    if (ide.type !== "vs") return ide;

    // VS 2017+ 的目录结构: VC\Tools\MSVC\<version>\
    var msvcPath = ide.path + "\\VC\\Tools\\MSVC";
    if (fso.FolderExists(msvcPath)) {
      var versions = getSubFolders(msvcPath);
      if (versions.length > 0) {
        // 使用最新版本
        var latestVersion = versions[versions.length - 1];
        ide.includePath = latestVersion + "\\include";
        ide.libPath = latestVersion + "\\lib";

        // 检查 x86/x64 子目录
        if (fso.FolderExists(ide.libPath + "\\x86")) {
          ide.libPathX86 = ide.libPath + "\\x86";
        }
        if (fso.FolderExists(ide.libPath + "\\x64")) {
          ide.libPathX64 = ide.libPath + "\\x64";
        }
      }
    }

    return ide;
  }

  /**
   * 主安装函数
   */
  function install(selectedIDEs, progressCallback, completeCallback) {
    logFunc = function (msg, type) {
      if (typeof log !== "undefined" && window.log) {
        window.log(msg, type);
      }
    };

    var egeLibsPath = getEgeLibsPath();

    log("EGE 库路径: " + egeLibsPath, "info");

    if (!fso.FolderExists(egeLibsPath)) {
      log("找不到 EGE 库文件目录!", "error");
      log("请确保 xege_libs 目录位于正确位置", "error");
      completeCallback(false, "找不到 EGE 库文件目录: " + egeLibsPath);
      return;
    }

    var totalCount = selectedIDEs.length;
    var successCount = 0;
    var failCount = 0;

    for (var i = 0; i < selectedIDEs.length; i++) {
      var ide = selectedIDEs[i];

      // 解析 VS 的实际路径
      if (ide.type === "vs") {
        ide = resolveVSPaths(ide);
      }

      try {
        if (installToIDE(ide, egeLibsPath, progressCallback, i, totalCount)) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (e) {
        log("安装到 " + ide.name + " 时出错: " + e.message, "error");
        failCount++;
      }

      progressCallback(((i + 1) / totalCount) * 100, "已完成 " + (i + 1) + "/" + totalCount);
    }

    log("", "");
    log("=== 安装结束 ===", "info");
    log("成功: " + successCount + ", 失败: " + failCount, successCount > 0 ? "success" : "error");

    if (successCount > 0) {
      completeCallback(true, "成功安装到 " + successCount + " 个 IDE");
    } else {
      completeCallback(false, "所有安装均失败，请检查日志");
    }
  }

  // 公开 API
  return {
    install: install,
    getEgeLibsPath: getEgeLibsPath,
    copyFile: copyFile,
    copyFolder: copyFolder
  };
})();
