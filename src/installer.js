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

  // 获取模板目录路径
  function getTemplatePath(ideType) {
    var scriptDir = getScriptDir();
    var parentDir = fso.GetParentFolderName(scriptDir);
    return parentDir + "\\assets\\templates\\" + ideType;
  }

  // 获取文档目录路径
  function getDocsPath() {
    var scriptDir = getScriptDir();
    var parentDir = fso.GetParentFolderName(scriptDir);
    return parentDir + "\\assets\\docs";
  }

  // 获取 CodeBlocks 用户模板目录
  function getCodeBlocksUserTemplateDir() {
    var appData = shell.ExpandEnvironmentStrings("%APPDATA%");
    return appData + "\\CodeBlocks\\UserTemplates\\EGE_Project";
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
    "redpanda": function (ide) {
      // Red Panda 使用专用的 redpanda 目录
      return { "default": "redpanda" };
    },
    "devcpp": function (ide) {
      // 其他 Dev-C++ 版本
      return { "default": "devcpp" };
    },
    "codeblocks": function (ide) {
      return { "default": "codeblocks" };
    },
    "clion": function (ide) {
      // CLion 使用与 Red Panda 相同的库版本
      return { "default": "redpanda" };
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

    var hasError = false;

    // 复制主头文件
    var headerFiles = ["ege.h", "graphics.h"];
    for (var i = 0; i < headerFiles.length; i++) {
      var src = srcInclude + "\\" + headerFiles[i];
      var dest = destInclude + "\\" + headerFiles[i];
      if (fso.FileExists(src)) {
        if (copyFile(src, dest)) {
          log("  复制: " + src + " -> " + dest, "success");
        } else {
          hasError = true;
        }
      } else {
        log("  源文件不存在: " + src, "error");
        hasError = true;
      }
    }

    // 复制 ege 子目录
    var egeSubDir = srcInclude + "\\ege";
    if (fso.FolderExists(egeSubDir)) {
      var destEgeDir = destInclude + "\\ege";
      if (copyFolder(egeSubDir, destEgeDir)) {
        log("  复制: " + egeSubDir + " -> " + destEgeDir, "success");
      } else {
        hasError = true;
      }
    }

    return !hasError;
  }

  /**
   * 检查文件是否是有效的库文件
   */
  function isValidLibraryFile(fileName) {
    var lowerName = fileName.toLowerCase();
    var ext = lowerName.substring(lowerName.lastIndexOf('.'));

    // 允许的库文件扩展名
    var validExtensions = ['.lib', '.a', '.dll', '.so', '.dylib'];

    // 不允许的文件（说明文档等）
    if (ext === '.txt' || ext === '.md' || ext === '.pdf' || ext === '.doc') {
      return false;
    }

    // 检查是否在允许的扩展名列表中
    for (var i = 0; i < validExtensions.length; i++) {
      if (ext === validExtensions[i]) {
        return true;
      }
    }

    return false;
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
    var hasError = false;
    var foundAnyLib = false;
    var installedCount = 0;
    var skippedCount = 0;

    for (var arch in libDirs) {
      var srcLibDir = srcLib + "\\" + libDirs[arch];

      if (arch !== "default") {
        srcLibDir += "\\" + arch;
      }

      log("  使用库目录: " + srcLibDir + " (" + libDirs[arch] + ")", "info");

      if (!fso.FolderExists(srcLibDir)) {
        log("  库目录不存在: " + srcLibDir, "error");
        hasError = true;
        continue;
      }

      // 确定目标库目录
      var destLibDir = ide.libPath;
      if (ide.type.indexOf("vs") >= 0) {
        // Visual Studio libs 通常按架构在子目录
        if (arch === "x86" && fso.FolderExists(ide.libPath + "\\x86")) {
          destLibDir = ide.libPath + "\\x86";
        } else if (arch === "x64") {
          if (fso.FolderExists(ide.libPath + "\\x64")) {
            destLibDir = ide.libPath + "\\x64";
          } else if (fso.FolderExists(ide.libPath + "\\amd64")) {
            destLibDir = ide.libPath + "\\amd64";
          }
        }
      }

      // 复制库文件
      var libFiles = getFiles(srcLibDir);
      if (libFiles.length === 0) {
        log("  库目录为空: " + srcLibDir, "error");
        hasError = true;
        continue;
      }

      for (var i = 0; i < libFiles.length; i++) {
        var fileName = fso.GetFileName(libFiles[i]);

        // 过滤非库文件
        if (!isValidLibraryFile(fileName)) {
          log("  跳过非库文件: " + fileName, "info");
          skippedCount++;
          continue;
        }

        foundAnyLib = true;
        var dest = destLibDir + "\\" + fileName;
        if (copyFile(libFiles[i], dest)) {
          log("  复制: " + fileName, "success");
          installedCount++;
        } else {
          log("  复制失败: " + fileName, "error");
          hasError = true;
        }
      }
    }

    if (installedCount > 0) {
      log("  成功安装 " + installedCount + " 个库文件" + (skippedCount > 0 ? "，跳过 " + skippedCount + " 个非库文件" : ""), "success");
    }

    if (!foundAnyLib) {
      log("  未找到有效的库文件", "error");
      return false;
    }

    if (hasError) {
      log("  库文件安装过程中出现错误", "error");
      return false;
    }

    return true;
  }

  /**
   * 安装 CodeBlocks 项目模板
   */
  function installCodeBlocksTemplate(ide) {
    var templateSrc = getTemplatePath("codeblocks");

    if (!fso.FolderExists(templateSrc)) {
      log("  模板目录不存在: " + templateSrc, "warning");
      return true; // 不影响主安装流程
    }

    // 获取用户的 CodeBlocks 配置目录
    var appData = shell.ExpandEnvironmentStrings("%APPDATA%");
    var userTemplateDir = appData + "\\CodeBlocks\\UserTemplates\\EGE_Project";

    log("安装 CodeBlocks 项目模板...", "info");

    // 创建目标目录
    if (!createFolder(userTemplateDir)) {
      log("  创建模板目录失败: " + userTemplateDir, "error");
      return false;
    }

    var hasError = false;

    // 复制模板文件
    var templateFiles = getFiles(templateSrc);
    for (var i = 0; i < templateFiles.length; i++) {
      var fileName = fso.GetFileName(templateFiles[i]);
      var dest = userTemplateDir + "\\" + fileName;
      if (copyFile(templateFiles[i], dest)) {
        log("  复制模板: " + fileName + " -> " + dest, "success");
      } else {
        hasError = true;
      }
    }

    if (!hasError) {
      log("  项目模板已安装到: " + userTemplateDir, "success");
    }

    return !hasError;
  }

  /**
   * 显示 CodeBlocks 使用说明（简化版，详细说明在模态窗口中查看）
   */
  function showCodeBlocksUsageGuide() {
    log("", "");
    log("=====================================================", "success");
    log("  ✓ Code::Blocks 项目模板安装成功！", "success");
    log("=====================================================", "success");
    log("", "");
    log("📝 创建 EGE 项目：", "info");
    log("  1. 打开 Code::Blocks", "info");
    log("  2. 文件 → 从用户模板新建...", "info");
    log("  3. 选择 EGE_Project 模板", "info");
    log("", "");
    log("💡 更多详细说明请点击下方\"查看使用说明\"按钮", "success");
    log("=====================================================", "success");
    log("", "");
  }

  /**
   * 卸载 CodeBlocks 项目模板
   */
  function uninstallCodeBlocksTemplate() {
    var userTemplateDir = getCodeBlocksUserTemplateDir();

    log("卸载 CodeBlocks 项目模板...", "info");

    if (!fso.FolderExists(userTemplateDir)) {
      log("  模板未安装或已删除", "info");
      return true;
    }

    try {
      fso.DeleteFolder(userTemplateDir, true);
      log("  ✓ 项目模板已卸载: " + userTemplateDir, "success");
      return true;
    } catch (e) {
      log("  卸载模板失败: " + e.message, "error");
      return false;
    }
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
    var headersSuccess = true;
    var libsSuccess = true;
    var templateSuccess = true;

    // 安装头文件
    progressCallback(baseProgress + stepProgress * 0.3, "正在安装头文件到 " + ide.name + "...");
    if (!installHeaders(ide, egeLibsPath)) {
      log("❌ 头文件安装失败", "error");
      headersSuccess = false;
    } else {
      log("✓ 头文件安装成功", "success");
    }

    // 安装库文件
    progressCallback(baseProgress + stepProgress * 0.7, "正在安装库文件到 " + ide.name + "...");
    if (!installLibs(ide, egeLibsPath)) {
      log("❌ 库文件安装失败", "error");
      libsSuccess = false;
    } else {
      log("✓ 库文件安装成功", "success");
    }

    // 为 CodeBlocks 安装项目模板
    if (ide.type === "codeblocks") {
      progressCallback(baseProgress + stepProgress * 0.9, "正在安装项目模板...");
      if (!installCodeBlocksTemplate(ide)) {
        log("⚠ 项目模板安装失败（不影响库文件安装）", "warning");
        templateSuccess = false;
      } else {
        log("✓ 项目模板安装成功", "success");
        // 只在库文件也安装成功时显示使用说明
        if (headersSuccess && libsSuccess) {
          showCodeBlocksUsageGuide();
        }
      }
    }

    var overallSuccess = headersSuccess && libsSuccess;

    if (overallSuccess) {
      log("", "");
      log("✓ " + ide.name + " 安装完成", "success");
    } else {
      log("", "");
      log("❌ " + ide.name + " 安装失败，请查看上方错误信息", "error");
    }

    return overallSuccess;
  }

  /**
   * 查找 VS 的实际 include/lib 目录
   * 对于新版检测器（已包含 msvcPath），直接使用已解析的路径
   * 对于旧版结构或 vs-legacy，仍需解析
   */
  function resolveVSPaths(ide) {
    // 如果已经有 msvcPath，说明是新版检测器返回的结果，路径已正确设置
    if (ide.msvcPath) {
      return ide;
    }

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
      }
    }

    return ide;
  }

  /**
   * 主安装函数
   */
  function install(selectedIDEs, progressCallback, completeCallback, customLibsPath) {
    logFunc = function (msg, type) {
      if (typeof log !== "undefined" && window.log) {
        window.log(msg, type);
      }
    };

    // 优先使用传入的 libsPath，否则自动检测
    var egeLibsPath = customLibsPath || getEgeLibsPath();

    log("EGE 库路径: " + egeLibsPath, "info");

    if (!fso.FolderExists(egeLibsPath)) {
      log("找不到 EGE 库文件目录!", "error");
      log("请确保 xege_libs 目录位于正确位置", "error");
      completeCallback(false, "找不到 EGE 库文件目录: " + egeLibsPath, false);
      return;
    }

    var totalCount = selectedIDEs.length;
    var successCount = 0;
    var failCount = 0;
    var codeBlocksInstalled = false;

    for (var i = 0; i < selectedIDEs.length; i++) {
      var ide = selectedIDEs[i];

      // 解析 VS 的实际路径
      if (ide.type === "vs") {
        ide = resolveVSPaths(ide);
      }

      try {
        if (installToIDE(ide, egeLibsPath, progressCallback, i, totalCount)) {
          successCount++;
          // 记录 CodeBlocks 安装成功
          if (ide.type === "codeblocks") {
            codeBlocksInstalled = true;
          }
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
    log("======================================", "info");
    log("=== 安装流程结束 ===", "info");
    log("======================================", "info");
    log("", "");
    log("📊 安装统计：", "info");
    log("  • 成功：" + successCount + " 个", successCount > 0 ? "success" : "info");
    log("  • 失败：" + failCount + " 个", failCount > 0 ? "error" : "info");
    log("", "");

    if (successCount > 0 && failCount === 0) {
      log("🎉 所有IDE安装成功！", "success");
      completeCallback(true, "成功安装到 " + successCount + " 个 IDE", codeBlocksInstalled);
    } else if (successCount > 0 && failCount > 0) {
      log("⚠ 部分IDE安装成功，" + failCount + " 个失败，请检查上方日志", "error");
      completeCallback(false, "" + successCount + " 个成功，" + failCount + " 个失败", codeBlocksInstalled);
    } else {
      log("❌ 所有安装均失败，请检查日志并重试", "error");
      completeCallback(false, "所有安装均失败，请检查日志", false);
    }
  }

  /**
   * 主卸载函数
   */
  function uninstall(selectedIDEs, progressCallback, completeCallback) {
    logFunc = function (msg, type) {
      if (typeof log !== "undefined" && window.log) {
        window.log(msg, type);
      }
    };

    log("=== 开始卸载 EGE ===", "info");
    log("", "");

    var totalCount = selectedIDEs.length;
    var successCount = 0;
    var failCount = 0;

    for (var i = 0; i < selectedIDEs.length; i++) {
      var ide = selectedIDEs[i];

      log("", "");
      log("=== 从 " + ide.name + " 卸载 ===", "info");

      var ideSuccess = true;

      // 卸载头文件
      progressCallback((i / totalCount) * 100, "正在卸载 " + ide.name + "...");

      try {
        var headerFiles = ["ege.h", "graphics.h"];
        for (var j = 0; j < headerFiles.length; j++) {
          var headerPath = ide.includePath + "\\" + headerFiles[j];
          if (fso.FileExists(headerPath)) {
            fso.DeleteFile(headerPath, true);
            log("  删除头文件: " + headerPath, "success");
          }
        }

        // 删除 ege 子目录
        var egeSubDir = ide.includePath + "\\ege";
        if (fso.FolderExists(egeSubDir)) {
          fso.DeleteFolder(egeSubDir, true);
          log("  删除目录: " + egeSubDir, "success");
        }

        // 卸载库文件（根据 IDE 类型）
        var mapping = libDirMapping[ide.type];
        if (mapping) {
          var libDirs = mapping(ide);
          for (var arch in libDirs) {
            var destLibDir = ide.libPath;
            if (arch === "x64" && ide.type.indexOf("vs") >= 0) {
              if (fso.FolderExists(ide.libPath + "\\x64")) {
                destLibDir = ide.libPath + "\\x64";
              } else if (fso.FolderExists(ide.libPath + "\\amd64")) {
                destLibDir = ide.libPath + "\\amd64";
              }
            }

            // 删除 graphics.lib/libgraphics.a
            var libPatterns = ["graphics.lib", "graphicsd.lib", "libgraphics.a"];
            for (var k = 0; k < libPatterns.length; k++) {
              var libPath = destLibDir + "\\" + libPatterns[k];
              if (fso.FileExists(libPath)) {
                fso.DeleteFile(libPath, true);
                log("  删除库文件: " + libPath, "success");
              }
            }
          }
        }

        // 为 CodeBlocks 卸载项目模板
        if (ide.type === "codeblocks") {
          uninstallCodeBlocksTemplate();
        }

        log(ide.name + " 卸载完成", "success");
        successCount++;
      } catch (e) {
        log("从 " + ide.name + " 卸载时出错: " + e.message, "error");
        failCount++;
      }

      progressCallback(((i + 1) / totalCount) * 100, "已完成 " + (i + 1) + "/" + totalCount);
    }

    log("", "");
    log("=== 卸载结束 ===", "info");
    log("成功: " + successCount + ", 失败: " + failCount, successCount > 0 ? "success" : "error");

    if (successCount > 0) {
      completeCallback(true, "成功从 " + successCount + " 个 IDE 卸载");
    } else {
      completeCallback(false, "所有卸载均失败，请检查日志");
    }
  }

  // 公开 API
  return {
    install: install,
    uninstall: uninstall,
    getEgeLibsPath: getEgeLibsPath,
    getCodeBlocksUserTemplateDir: getCodeBlocksUserTemplateDir,
    copyFile: copyFile,
    copyFolder: copyFolder
  };
})();
