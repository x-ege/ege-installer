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
      // 处理 URL 编码
      path = decodeURIComponent(path);
      // 移除开头的 / (URL 格式)
      if (path.charAt(0) === "/") {
        path = path.substr(1);
      }
      // 转换为 Windows 路径格式
      path = path.replace(/\//g, "\\");
      // 使用 FSO 获取父目录（正确移除文件名）
      var dir = fso.GetParentFolderName(path);
      return dir || ".";
    } catch (e) {
      return ".";
    }
  }

  // EGE 库文件源目录（相对于安装器）
  function getEgeLibsPath() {
    var scriptDir = getScriptDir();
    var parentDir = fso.GetParentFolderName(scriptDir);
    var grandParentDir = fso.GetParentFolderName(parentDir);

    // 按优先级尝试多个可能的位置
    var candidatePaths = [
      // 1. 开发环境：项目父目录下的 xege_libs (../xege_libs)
      grandParentDir + "\\xege_libs",
      // 2. 打包后的路径：项目根目录下的 libs
      parentDir + "\\libs",
      // 3. 开发环境备选：直接使用项目根目录下的 libs（如果存在）
      grandParentDir + "\\xege-libs",
      // 4. 同级目录的 libs（兼容某些打包结构）
      scriptDir + "\\..\\libs"
    ];

    for (var i = 0; i < candidatePaths.length; i++) {
      var path = candidatePaths[i];
      try {
        // 规范化路径
        path = fso.GetAbsolutePathName(path);
        if (fso.FolderExists(path) && fso.FolderExists(path + "\\include")) {
          return path;
        }
      } catch (e) {
        // 忽略无效路径
      }
    }

    // 如果都找不到，返回最可能的路径以便显示有意义的错误信息
    return grandParentDir + "\\xege_libs";
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

  // 获取 Code::Blocks 全局 wizard 目录（安装目录下 share\CodeBlocks\templates\wizard）
  function getCodeBlocksWizardDir(ide) {
    try {
      if (!ide || !ide.path) return null;
      var dir = ide.path.replace(/\\+$/, "") + "\\share\\CodeBlocks\\templates\\wizard";
      if (fso.FolderExists(dir)) return dir;
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 读取文本文件内容
   */
  function readTextFile(filePath) {
    try {
      var stream = fso.OpenTextFile(filePath, 1, false);
      var content = stream.ReadAll();
      stream.Close();
      return content;
    } catch (e) {
      return null;
    }
  }

  /**
   * 写入文本文件
   */
  function writeTextFile(filePath, content) {
    try {
      var stream = fso.OpenTextFile(filePath, 2, true);
      stream.Write(content);
      stream.Close();
      return true;
    } catch (e) {
      log("写入文件失败: " + filePath + " (" + e.message + ")", "error");
      return false;
    }
  }

  // EGE wizard 在 config.script 中的注册行标记
  var EGE_WIZARD_MARKER = "// [EGE-INSTALLER]";
  var EGE_WIZARD_REGISTER_LINE = '        RegisterWizard(wizProject, _T("ege"), _T("EGE project"), _T("2D/3D Graphics")); ' + EGE_WIZARD_MARKER;

  /**
   * 在 config.script 中注册 EGE wizard
   * 在 RegisterWizards() 函数的末尾（最后一个 RegisterWizard 调用之后）追加注册行
   */
  function registerEGEWizardInConfig(configScriptPath) {
    if (!fso.FileExists(configScriptPath)) {
      log("  config.script 不存在: " + configScriptPath, "error");
      return false;
    }

    var content = readTextFile(configScriptPath);
    if (content === null) {
      log("  读取 config.script 失败", "error");
      return false;
    }

    // 检查是否已经注册
    if (content.indexOf(EGE_WIZARD_MARKER) >= 0) {
      log("  EGE wizard 已在 config.script 中注册，跳过", "info");
      return true;
    }

    // 策略：在 RegisterWizards() 函数中找到最后一个 RegisterWizard() 调用，在其后追加
    // 查找模式：从后往前找最后一个 RegisterWizard(...); 行
    var lines = content.split("\n");
    var lastRegisterIdx = -1;

    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].replace(/^\s+/, "").replace(/\s+$/, "");
      if (trimmed.indexOf("RegisterWizard(") === 0 || trimmed.indexOf("RegisterWizard(") > 0 && trimmed.indexOf("//") !== 0) {
        // 确认这不是 RegisterWizard 函数定义（function RegisterWizard）
        if (lines[i].indexOf("function ") < 0) {
          lastRegisterIdx = i;
        }
      }
    }

    if (lastRegisterIdx < 0) {
      log("  无法在 config.script 中找到 RegisterWizard 调用", "error");
      return false;
    }

    // 在最后一个 RegisterWizard 之后插入 EGE 注册行
    var newLines = [];
    for (var j = 0; j <= lastRegisterIdx; j++) {
      newLines.push(lines[j]);
    }

    // 添加空行 + EGE 注册
    newLines.push("");
    newLines.push("    // EGE Graphics Engine project wizard");
    newLines.push("    if (PLATFORM == PLATFORM_MSW)");
    newLines.push(EGE_WIZARD_REGISTER_LINE);

    for (var k = lastRegisterIdx + 1; k < lines.length; k++) {
      newLines.push(lines[k]);
    }

    var newContent = newLines.join("\n");

    if (dryRunMode) {
      log("  [DRY-RUN] 将修改 config.script 注册 EGE wizard", "info");
      return true;
    }

    // 备份原文件
    var backupPath = configScriptPath + ".ege-backup";
    if (!fso.FileExists(backupPath)) {
      try {
        fso.CopyFile(configScriptPath, backupPath, false);
        log("  备份 config.script -> " + backupPath, "info");
      } catch (e) {
        log("  备份 config.script 失败: " + e.message, "warning");
      }
    }

    if (writeTextFile(configScriptPath, newContent)) {
      log("  ✓ 已在 config.script 中注册 EGE wizard", "success");
      return true;
    }

    return false;
  }

  /**
   * 从 config.script 中移除 EGE wizard 注册
   */
  function unregisterEGEWizardFromConfig(configScriptPath) {
    if (!fso.FileExists(configScriptPath)) return true;

    var content = readTextFile(configScriptPath);
    if (content === null) return true;

    if (content.indexOf(EGE_WIZARD_MARKER) < 0) {
      return true; // 未注册，无需清理
    }

    var lines = content.split("\n");
    var newLines = [];
    var removedCount = 0;

    for (var i = 0; i < lines.length; i++) {
      // 跳过 EGE 相关的行（注册行 + 上方的注释和 if 语句）
      if (lines[i].indexOf(EGE_WIZARD_MARKER) >= 0) {
        removedCount++;
        // 同时移除前面的 if (PLATFORM == PLATFORM_MSW) 和注释
        while (newLines.length > 0) {
          var prev = newLines[newLines.length - 1].replace(/^\s+/, "").replace(/\s+$/, "");
          if (prev === "" || prev === "// EGE Graphics Engine project wizard" || prev === "if (PLATFORM == PLATFORM_MSW)") {
            newLines.pop();
            removedCount++;
          } else {
            break;
          }
        }
        continue;
      }
      newLines.push(lines[i]);
    }

    if (removedCount > 0) {
      if (writeTextFile(configScriptPath, newLines.join("\n"))) {
        log("  ✓ 已从 config.script 中移除 EGE wizard 注册", "success");
      }
    }

    return true;
  }

  /**
   * 安装 Code::Blocks Projects wizard（仅 CB >= 25.03）
   * 将 wizard 文件复制到全局 wizard 目录，并修改 config.script 注册
   */
  function installCodeBlocksWizard(ide) {
    var wizardSrc = getTemplatePath("codeblocks") + "\\wizard";

    if (!fso.FolderExists(wizardSrc)) {
      log("  wizard 源目录不存在: " + wizardSrc, "warning");
      return false;
    }

    var wizardBaseDir = getCodeBlocksWizardDir(ide);
    if (!wizardBaseDir) {
      log("  Code::Blocks wizard 目录不存在", "warning");
      return false;
    }

    var destWizardDir = wizardBaseDir + "\\ege";
    var configScriptPath = wizardBaseDir + "\\config.script";

    log("  安装 Projects wizard...", "info");
    log("  wizard 源目录: " + wizardSrc, "info");
    log("  wizard 目标目录: " + destWizardDir, "info");

    // 1) 复制 wizard 文件
    if (!fso.FolderExists(destWizardDir)) {
      if (!createFolder(destWizardDir)) {
        log("  创建 wizard 目录失败: " + destWizardDir, "error");
        return false;
      }
    }

    // 复制 wizard.script, logo.png, wizard.png
    var wizardFiles = ["wizard.script", "logo.png", "wizard.png"];
    var hasError = false;
    for (var i = 0; i < wizardFiles.length; i++) {
      var src = wizardSrc + "\\" + wizardFiles[i];
      var dest = destWizardDir + "\\" + wizardFiles[i];
      if (!fso.FileExists(src)) {
        log("  wizard 文件不存在: " + src, "error");
        hasError = true;
        continue;
      }
      if (dryRunMode) {
        log("  [DRY-RUN] 将复制: " + wizardFiles[i] + " -> " + dest, "info");
      } else if (copyFile(src, dest)) {
        log("  复制: " + wizardFiles[i], "success");
      } else {
        hasError = true;
      }
    }

    // 复制模板源文件 main.cpp 到 wizard/files/ 目录
    // 使用 codeblocks 模板目录下的统一 main.cpp（DRY 原则）
    var mainCppSrc = getTemplatePath("codeblocks") + "\\main.cpp";
    var filesDest = destWizardDir + "\\files";
    var mainCppDest = filesDest + "\\main.cpp";

    if (!fso.FolderExists(filesDest)) {
      if (!createFolder(filesDest)) {
        log("  创建 files 目录失败: " + filesDest, "error");
        hasError = true;
      }
    }

    if (!hasError && fso.FileExists(mainCppSrc)) {
      if (dryRunMode) {
        log("  [DRY-RUN] 将复制: main.cpp -> " + mainCppDest, "info");
      } else if (copyFile(mainCppSrc, mainCppDest)) {
        log("  复制: main.cpp -> files/", "success");
      } else {
        hasError = true;
      }
    } else if (!fso.FileExists(mainCppSrc)) {
      log("  模板源文件不存在: " + mainCppSrc, "error");
      hasError = true;
    }

    if (hasError) {
      log("  ⚠ wizard 文件复制过程中出现错误", "warning");
      return false;
    }

    // 2) 修改 config.script 注册 EGE wizard
    if (!fso.FileExists(configScriptPath)) {
      log("  config.script 不存在: " + configScriptPath, "warning");
      log("  wizard 文件已复制，但无法自动注册", "warning");
      return false;
    }

    if (!registerEGEWizardInConfig(configScriptPath)) {
      log("  ⚠ 注册 EGE wizard 到 config.script 失败", "warning");
      return false;
    }

    log("  ✓ Projects wizard 安装成功！新建项目时可在 \"2D/3D Graphics\" 中找到 EGE", "success");
    return true;
  }

  /**
   * 卸载 Code::Blocks Projects wizard
   */
  function uninstallCodeBlocksWizard(ide) {
    var wizardBaseDir = getCodeBlocksWizardDir(ide);

    // 从 config.script 移除注册
    if (wizardBaseDir) {
      var configScriptPath = wizardBaseDir + "\\config.script";
      unregisterEGEWizardFromConfig(configScriptPath);

      // 删除 wizard 文件
      var egeWizardDir = wizardBaseDir + "\\ege";
      if (fso.FolderExists(egeWizardDir)) {
        try {
          fso.DeleteFolder(egeWizardDir, true);
          log("  ✓ 删除 wizard 目录: " + egeWizardDir, "success");
        } catch (e) {
          log("  ⚠ 删除 wizard 目录失败: " + e.message, "warning");
        }
      }

      // 删除备份文件
      var backupPath = configScriptPath + ".ege-backup";
      if (fso.FileExists(backupPath)) {
        try {
          fso.DeleteFile(backupPath, true);
          log("  ✓ 删除 config.script 备份", "success");
        } catch (e) {
          // 忽略
        }
      }
    }

    return true;
  }

  // 获取 Dev-C++ 模板目录
  function getDevCppTemplateDir(ide) {
    try {
      if (!ide || !ide.path) return null;
      var dir = ide.path.replace(/\\+$/, "") + "\\Templates";
      if (fso.FolderExists(dir)) return dir;
      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 安装 Dev-C++ 项目模板
   * 将 .template 文件和源码文件复制到 Dev-C++ 的 Templates 目录
   */
  function installDevCppTemplate(ide) {
    var templateSrc = getTemplatePath("devcpp");

    if (!fso.FolderExists(templateSrc)) {
      log("  模板源目录不存在: " + templateSrc, "warning");
      return true; // 不影响主安装流程
    }

    var destDir = getDevCppTemplateDir(ide);
    if (!destDir) {
      log("  Dev-C++ Templates 目录不存在: " + (ide.path || "(空)") + "\\Templates", "warning");
      log("  跳过项目模板安装", "warning");
      return false;
    }

    log("安装 Dev-C++ 项目模板...", "info");
    log("  模板源目录: " + templateSrc, "info");
    log("  目标目录: " + destDir, "info");

    var hasError = false;
    var copiedCount = 0;

    // 需要复制的模板文件
    var templateFiles = ["EGE_Graphics.template", "EGE_main_cpp.txt"];
    for (var i = 0; i < templateFiles.length; i++) {
      var src = templateSrc + "\\" + templateFiles[i];
      var dest = destDir + "\\" + templateFiles[i];

      if (!fso.FileExists(src)) {
        log("  模板文件不存在: " + src, "error");
        hasError = true;
        continue;
      }

      if (dryRunMode) {
        log("  [DRY-RUN] 将复制: " + templateFiles[i] + " -> " + dest, "info");
        copiedCount++;
      } else if (copyFile(src, dest)) {
        log("  复制: " + templateFiles[i], "success");
        copiedCount++;
      } else {
        hasError = true;
      }
    }

    // 验证
    if (!dryRunMode && !hasError) {
      if (!fso.FileExists(destDir + "\\EGE_Graphics.template")) {
        log("  ⚠ 缺少模板文件: EGE_Graphics.template", "warning");
        hasError = true;
      }
    }

    if (!hasError && copiedCount > 0) {
      log("  ✓ Dev-C++ 项目模板安装成功！", "success");
      log("  新建项目时可在 \"Multimedia\" 分类中找到 \"EGE Graphics\"", "success");
    }

    return !hasError;
  }

  /**
   * 卸载 Dev-C++ 项目模板
   */
  function uninstallDevCppTemplate(ide) {
    var destDir = getDevCppTemplateDir(ide);

    log("卸载 Dev-C++ 项目模板...", "info");

    if (!destDir) {
      log("  Dev-C++ Templates 目录不存在，跳过", "info");
      return true;
    }

    var removedAny = false;
    var filesToRemove = ["EGE_Graphics.template", "EGE_main_cpp.txt"];

    for (var i = 0; i < filesToRemove.length; i++) {
      var filePath = destDir + "\\" + filesToRemove[i];
      try {
        if (fso.FileExists(filePath)) {
          fso.DeleteFile(filePath, true);
          log("  ✓ 删除: " + filePath, "success");
          removedAny = true;
        }
      } catch (e) {
        log("  ⚠ 删除失败: " + filePath + " (" + e.message + ")", "warning");
      }
    }

    if (!removedAny) {
      log("  模板未安装或已删除", "info");
    }

    return true;
  }

  /**
   * 显示 Dev-C++ 使用说明
   */
  function showDevCppUsageGuide(ide) {
    log("", "");
    log("=====================================================", "success");
    log("  ✓ Dev-C++ 项目模板安装成功！", "success");
    log("=====================================================", "success");
    log("", "");
    log("📝 创建 EGE 项目：", "info");
    log("  1. 打开 Dev-C++", "info");
    log("  2. 文件 → 新建 → 项目...", "info");
    log("  3. 选择 \"Multimedia\" 标签页，点击 \"EGE Graphics\"", "info");
    log("  4. 输入项目名称，点击确定", "info");
    log("", "");
    log("⚠ 提示：模板已自动配置所有链接选项，无需手动设置。", "warning");
    log("=====================================================", "success");
    log("", "");
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
   * Dry-run 模式标志
   */
  var dryRunMode = false;

  /**
   * 检查是否为有效的安装目标路径
   * 防止向根目录或无效路径写入文件
   */
  function isValidInstallPath(path) {
    if (!path || path === "") {
      return false;
    }
    // 检查是否为根目录（如 C:\ 或 \）
    if (path.match(/^[A-Za-z]:\\?$/) || path === "\\" || path === "/") {
      return false;
    }
    // 路径长度至少应包含驱动器号和一个目录
    if (path.length < 4) {
      return false;
    }
    return true;
  }

  /**
   * 安装头文件到指定 IDE
   */
  function installHeaders(ide, egeLibsPath) {
    var srcInclude = egeLibsPath + "\\include";
    var destInclude = ide.includePath;

    // 安全检查：验证目标路径有效性
    if (!isValidInstallPath(destInclude)) {
      log("错误: 头文件目标路径无效或为空: [" + (destInclude || "(空)") + "]", "error");
      log("该 IDE 可能未正确配置 include 路径，请检查 IDE 安装", "error");
      return false;
    }

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
        if (dryRunMode) {
          log("  [DRY-RUN] 将复制: " + src + " -> " + dest, "info");
        } else if (copyFile(src, dest)) {
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
      if (dryRunMode) {
        log("  [DRY-RUN] 将复制目录: " + egeSubDir + " -> " + destEgeDir, "info");
      } else if (copyFolder(egeSubDir, destEgeDir)) {
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

      // 安全检查：验证目标路径有效性
      if (!isValidInstallPath(destLibDir)) {
        log("  错误: 库文件目标路径无效或为空: [" + (destLibDir || "(空)") + "]", "error");
        log("  该 IDE 可能未正确配置 lib 路径，请检查 IDE 安装", "error");
        hasError = true;
        continue;
      }

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
        if (dryRunMode) {
          log("  [DRY-RUN] 将复制: " + libFiles[i] + " -> " + dest, "info");
          installedCount++;
        } else if (copyFile(libFiles[i], dest)) {
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

    /**
     * 复制模板文件到目标目录
     * @param {string} destDir - 目标目录
     * @param {string} label - 显示标签
     * @param {boolean} isSharedDir - 是否为多模板共享的扁平目录（全局/用户级 share 模板目录）。
     *   共享目录需要跳过 main.cpp 以避免与其他模板的同名文件冲突。
     *   独立子目录（如 UserTemplates\EGE_Project\）则不存在冲突问题。
     */
    function copyTemplateToDir(destDir, label, isSharedDir) {
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

        // 在共享目录中，把 main.cpp 重命名为 ege-main.cpp（.template FileSet 期望该名称）
        // 在独立子目录中，保持 main.cpp 不变（.cbp 直接引用它）
        var destFileName = fileName;
        if (isSharedDir && fileName.toLowerCase() === "main.cpp") {
          destFileName = "ege-main.cpp";
        }

        var dest = destDir + "\\" + destFileName;
        if (dryRunMode) {
          log("  [DRY-RUN] 将复制模板: " + fileName + " -> " + dest, "info");
          copiedCount++;
        } else if (copyFile(templateFiles[i], dest)) {
          log("  复制模板: " + fileName + " -> " + dest, "success");
          copiedCount++;
        } else {
          hasError = true;
        }
      }

      // 复制后验证关键文件是否存在（DRY-RUN 模式下跳过验证）
      if (!dryRunMode) {
        var required = isSharedDir
          ? ["EGE_Project.template", "EGE_Project.cbp", "ege-main.cpp"]
          : ["EGE_Project.cbp", "main.cpp"];
        for (var r = 0; r < required.length; r++) {
          var reqPath = destDir + "\\" + required[r];
          if (!fso.FileExists(reqPath)) {
            log("  ⚠ 缺少模板文件: " + reqPath, "warning");
            hasError = true;
          }
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
      if (copyTemplateToDir(shareTemplateDir, "全局模板", true)) {
        anySuccess = true;
      } else {
        log("  ⚠ 安装到全局模板目录失败，将继续安装到用户模板目录", "warning");
      }
    }

    // 安装到用户级 share 模板目录（无需管理员权限，尝试让其出现在“从模板...”列表）
    if (userShareTemplateDir) {
      log("  安装到用户级 share 模板目录（无需管理员权限）...", "info");
      if (copyTemplateToDir(userShareTemplateDir, "用户级 share 模板", true)) {
        anySuccess = true;
      }
    }

    // 始终安装到用户模板目录（无需管理员权限，更稳）
    log("  安装到用户模板目录（兼容入口：从用户模板新建...）...", "info");
    if (copyTemplateToDir(userTemplateDir, "用户模板", false)) {
      anySuccess = true;
    }

    // 对于 CB >= 25.03，额外安装 Projects wizard（出现在"新建项目 → 2D/3D Graphics"分类中）
    if (ide.supportsWizard) {
      log("", "");
      log("  检测到 Code::Blocks " + (ide.cbVersion ? ide.cbVersion.major + "." + (ide.cbVersion.minor < 10 ? "0" : "") + ide.cbVersion.minor : "≥25.03") + "，安装 Projects wizard...", "info");
      if (installCodeBlocksWizard(ide)) {
        anySuccess = true;
      } else {
        log("  ⚠ Projects wizard 安装失败（User Template 仍可使用）", "warning");
      }
    } else if (ide.cbVersion) {
      log("  Code::Blocks " + ide.cbVersion.major + "." + (ide.cbVersion.minor < 10 ? "0" : "") + ide.cbVersion.minor + " 版本较旧，跳过 Projects wizard 安装", "info");
    }

    return anySuccess;
  }

  /**
   * 显示 CodeBlocks 使用说明（简化版，详细说明在模态窗口中查看）
   */
  function showCodeBlocksUsageGuide(ide) {
    log("", "");
    log("=====================================================", "success");
    log("  ✓ Code::Blocks 项目模板安装成功！", "success");
    log("=====================================================", "success");
    log("", "");
    log("📝 创建 EGE 项目：", "info");
    if (ide && ide.supportsWizard) {
      log("  方法一（推荐）：", "info");
      log("  1. 打开 Code::Blocks", "info");
      log("  2. 文件 → 新建 → 项目...", "info");
      log("  3. 选择分类 \"2D/3D Graphics\"，点击 \"EGE project\"", "info");
      log("", "");
      log("  方法二（备选）：", "info");
    }
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

    // 3) 卸载 Projects wizard（config.script 注册 + wizard 文件）
    uninstallCodeBlocksWizard(ide);

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
    var headersSkipped = false;
    var libsSkipped = false;

    // Code::Blocks 特殊处理：如果没有自带 MinGW，跳过头文件/库文件安装
    var skipLibInstall = (ide.type === "codeblocks" && (!ide.includePath || !ide.libPath));

    if (skipLibInstall) {
      log("", "");
      log("⚠ 检测到 Code::Blocks 未自带 MinGW 编译器", "warning");
      log("  将只安装项目模板，头文件和库文件需要安装到您实际使用的编译器目录", "warning");
      log("  如果您使用 MSYS2/MinGW-w64，请同时选择安装到对应的 MinGW 条目", "info");
      log("", "");
      headersSkipped = true;
      libsSkipped = true;
    } else {
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
        if (headersSuccess && libsSuccess && !headersSkipped) {
          showCodeBlocksUsageGuide(ide);
        }
      }
    }

    // 为 Dev-C++ 安装项目模板
    if (ide.type === "devcpp") {
      progressCallback(baseProgress + stepProgress * 0.9, "正在安装项目模板...");
      if (!installDevCppTemplate(ide)) {
        log("⚠ 项目模板安装失败（不影响库文件安装）", "warning");
        templateSuccess = false;
      } else {
        log("✓ 项目模板安装成功", "success");
        if (headersSuccess && libsSuccess) {
          showDevCppUsageGuide(ide);
        }
      }
    }

    // Code::Blocks 特殊处理：如果跳过了库安装，整体成功取决于模板安装
    var overallSuccess;
    if (skipLibInstall && ide.type === "codeblocks") {
      overallSuccess = templateSuccess;
    } else {
      overallSuccess = headersSuccess && libsSuccess;
    }

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
    var devCppInstalled = false;

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
          // 记录 Dev-C++ 安装成功
          if (ide.type === "devcpp") {
            devCppInstalled = true;
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
      completeCallback(true, "成功安装到 " + successCount + " 个 IDE", codeBlocksInstalled, devCppInstalled);
    } else if (successCount > 0 && failCount > 0) {
      log("⚠ 部分IDE安装成功，" + failCount + " 个失败，请检查上方日志", "error");
      completeCallback(false, "" + successCount + " 个成功，" + failCount + " 个失败", codeBlocksInstalled, devCppInstalled);
    } else {
      log("❌ 所有安装均失败，请检查日志并重试", "error");
      completeCallback(false, "所有安装均失败，请检查日志", false, false);
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

        // 为 Dev-C++ 卸载项目模板
        if (ide.type === "devcpp") {
          uninstallDevCppTemplate(ide);
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
    copyFolder: copyFolder,
    setDryRunMode: function (enabled) {
      dryRunMode = !!enabled;
      return dryRunMode;
    },
    isDryRunMode: function () {
      return dryRunMode;
    }
  };
})();
