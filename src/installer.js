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

  // 获取 Code::Blocks 全局模板目录（安装目录下 share\CodeBlocks\templates）
  function getCodeBlocksShareTemplateDir(ide) {
    try {
      if (!ide || !ide.path) return null;
      var dir = ide.path.replace(/\\+$/, "") + "\\share\\CodeBlocks\\templates";
      if (fso.FolderExists(dir)) return dir;
      return null;
    } catch (e) {
      return null;
    }
  }

  // 获取 Code::Blocks 的用户级 share 模板目录（无需管理员权限）
  // 某些版本会将该目录与全局 share 目录一起作为模板搜索路径。
  function getCodeBlocksUserShareTemplateDir() {
    try {
      var appData = shell.ExpandEnvironmentStrings("%APPDATA%");
      if (!appData) return null;
      return appData + "\\CodeBlocks\\share\\CodeBlocks\\templates";
    } catch (e) {
      return null;
    }
  }

  // IDE 类型到库目录的映射
  var libDirMapping = {
    "vs": function (ide) {
      // VS2017+ 统一使用 msvc 目录（xege-sdk 已合并库文件以减少体积）
      return {
        "x86": "msvc",
        "x64": "msvc"
      };
    },
    "vs-legacy": function (ide) {
      // VS2010 使用独立目录，VS2012-2015 尝试使用 msvc 统一版本
      if (ide.year === "2010") {
        return {
          "x86": "vs2010",
          "x64": "vs2010"
        };
      } else {
        // VS2012-2015 尝试使用 msvc（可能需要 VS2015 Update 3+）
        log("  注意: " + ide.name + " 使用统一的 msvc 库版本，建议升级到 VS2017+", "warning");
        return {
          "x86": "msvc",
          "x64": "msvc"
        };
      }
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

      // 处理架构子目录
      // msvc 使用标准的 x86/x64 子目录，vs2010 使用根目录+amd64
      if (arch !== "default") {
        if (libDirs[arch] === "vs2010") {
          // VS2010 特殊处理：x86 在根目录，x64 在 amd64 子目录
          if (arch === "x64") {
            srcLibDir += "\\amd64";
          }
          // x86 不追加子目录，使用根目录
        } else {
          // msvc 等其他目录使用标准的 arch 子目录
          srcLibDir += "\\" + arch;
        }
      }

      log("  使用库目录: " + srcLibDir + " (" + libDirs[arch] + "/" + arch + ")", "info");

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

    // Code::Blocks 模板目录在不同版本/安装方式下可能不同：
    // 1) 全局模板：<CodeBlocks>\share\CodeBlocks\templates（推荐，File -> New -> From template...）
    // 2) 用户模板：%APPDATA%\CodeBlocks\UserTemplates\...（File -> New from user templates...）
    // 为最大兼容性：优先尝试全局模板，同时也安装一份到用户模板。
    var shareTemplateDir = getCodeBlocksShareTemplateDir(ide);
    var userShareTemplateDir = getCodeBlocksUserShareTemplateDir();
    var appData = shell.ExpandEnvironmentStrings("%APPDATA%");
    var userTemplateDir = appData + "\\CodeBlocks\\UserTemplates\\EGE_Project";

    function copyTemplateToDir(destDir, label) {
      if (!destDir) return false;

      log("  目标模板目录: " + destDir + " (" + label + ")", "info");

      if (!fso.FolderExists(destDir)) {
        if (!createFolder(destDir)) {
          log("  创建模板目录失败: " + destDir, "error");
          return false;
        }
      }

      var hasError = false;
      var copiedCount = 0;

      var templateFiles = getFiles(templateSrc);
      for (var i = 0; i < templateFiles.length; i++) {
        var fileName = fso.GetFileName(templateFiles[i]);

        // 不再使用 main.cpp 作为模板源文件，避免与全局模板目录内其他文件名冲突。
        if (fileName.toLowerCase() === "main.cpp") {
          continue;
        }

        var dest = destDir + "\\" + fileName;
        if (copyFile(templateFiles[i], dest)) {
          log("  复制模板: " + fileName + " -> " + dest, "success");
          copiedCount++;
        } else {
          hasError = true;
        }
      }

      // 复制后验证关键文件是否存在
      var required = ["EGE_Project.template", "EGE_Project.cbp", "ege-main.cpp"];
      for (var r = 0; r < required.length; r++) {
        var reqPath = destDir + "\\" + required[r];
        if (!fso.FileExists(reqPath)) {
          log("  ⚠ 缺少模板文件: " + reqPath, "warning");
          hasError = true;
        }
      }

      if (!hasError && copiedCount > 0) {
        log("  ✓ 项目模板已安装到: " + destDir + " (" + label + ")", "success");
      }

      return !hasError;
    }

    log("安装 Code::Blocks 项目模板...", "info");
    log("  模板源目录: " + templateSrc, "info");

    var anySuccess = false;

    // 先尝试全局模板（需要管理员权限写入 Program Files）
    if (shareTemplateDir) {
      log("  尝试安装到全局模板目录（需要管理员权限）...", "info");
      if (copyTemplateToDir(shareTemplateDir, "全局模板")) {
        anySuccess = true;
      } else {
        log("  ⚠ 安装到全局模板目录失败，将继续安装到用户模板目录", "warning");
      }
    }

    // 安装到用户级 share 模板目录（无需管理员权限，尝试让其出现在“从模板...”列表）
    if (userShareTemplateDir) {
      log("  安装到用户级 share 模板目录（无需管理员权限）...", "info");
      if (copyTemplateToDir(userShareTemplateDir, "用户级 share 模板")) {
        anySuccess = true;
      }
    }

    // 始终安装到用户模板目录（无需管理员权限，更稳）
    log("  安装到用户模板目录（兼容入口：从用户模板新建...）...", "info");
    if (copyTemplateToDir(userTemplateDir, "用户模板")) {
      anySuccess = true;
    }

    return anySuccess;
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
    log("  2. 文件 → 新建 → 从模板...", "info");
    log("  3. 在分类中找到 EGE，选择 EGE_Project", "info");
    log("  4. 若未找到，可尝试：文件 → 从用户模板新建...", "info");
    log("", "");
    log("⚠ 提示：如果模板列表里暂时看不到 EGE_Project，请关闭并重新打开 Code::Blocks 后再试（部分版本需要重启才能刷新模板缓存）。", "warning");
    log("", "");
    log("💡 更多详细说明请点击下方\"查看使用说明\"按钮", "success");
    log("=====================================================", "success");
    log("", "");
  }

  /**
   * 卸载 CodeBlocks 项目模板
   */
  function uninstallCodeBlocksTemplate(ide) {
    var userTemplateDir = getCodeBlocksUserTemplateDir();
    var shareTemplateDir = getCodeBlocksShareTemplateDir(ide);
    var userShareTemplateDir = getCodeBlocksUserShareTemplateDir();

    log("卸载 Code::Blocks 项目模板...", "info");

    // 1) 删除全局模板目录下的文件（如果存在）
    var removedAny = false;
    if (shareTemplateDir && fso.FolderExists(shareTemplateDir)) {
      var files = ["EGE_Project.template", "EGE_Project.cbp", "ege-main.cpp"];
      for (var i = 0; i < files.length; i++) {
        var p = shareTemplateDir + "\\" + files[i];
        try {
          if (fso.FileExists(p)) {
            fso.DeleteFile(p, true);
            log("  ✓ 删除: " + p, "success");
            removedAny = true;
          }
        } catch (e1) {
          log("  ⚠ 删除失败: " + p + " (" + e1.message + ")", "warning");
        }
      }
    }

    // 1.5) 删除用户级 share 模板目录下的文件（如果存在）
    if (userShareTemplateDir && fso.FolderExists(userShareTemplateDir)) {
      var userShareFiles = ["EGE_Project.template", "EGE_Project.cbp", "ege-main.cpp"];
      for (var u = 0; u < userShareFiles.length; u++) {
        var up = userShareTemplateDir + "\\" + userShareFiles[u];
        try {
          if (fso.FileExists(up)) {
            fso.DeleteFile(up, true);
            log("  ✓ 删除: " + up, "success");
            removedAny = true;
          }
        } catch (eU) {
          log("  ⚠ 删除失败: " + up + " (" + eU.message + ")", "warning");
        }
      }
    }

    // 2) 删除用户模板目录（旧逻辑）
    try {
      if (fso.FolderExists(userTemplateDir)) {
        fso.DeleteFolder(userTemplateDir, true);
        log("  ✓ 删除用户模板目录: " + userTemplateDir, "success");
        removedAny = true;
      }
    } catch (e2) {
      log("  ⚠ 删除用户模板目录失败: " + e2.message, "warning");
    }

    if (!removedAny) {
      log("  模板未安装或已删除", "info");
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
          uninstallCodeBlocksTemplate(ide);
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
