/**
 * EGE Installer - 模板管理模块
 * 负责 Code::Blocks 和 Dev-C++ 的项目模板/wizard 安装与卸载
 *
 * 依赖: utils.js (EgeUtils)
 */

var Templates = (function () {
  var fso = EgeUtils.fso;
  var shell = EgeUtils.shell;
  var log = EgeUtils.log;

  // EGE wizard 在 config.script 中的注册行标记
  var EGE_WIZARD_MARKER = "// [EGE-INSTALLER]";
  var EGE_WIZARD_REGISTER_LINE = '        RegisterWizard(wizProject, _T("ege"), _T("EGE project"), _T("2D/3D Graphics")); ' + EGE_WIZARD_MARKER;

  // ========== 路径辅助 ==========

  function getCodeBlocksUserTemplateDir() {
    var appData = shell.ExpandEnvironmentStrings("%APPDATA%");
    return appData + "\\CodeBlocks\\UserTemplates\\EGE_Project";
  }

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

  function getCodeBlocksUserShareTemplateDir() {
    try {
      var appData = shell.ExpandEnvironmentStrings("%APPDATA%");
      if (!appData) return null;
      return appData + "\\CodeBlocks\\share\\CodeBlocks\\templates";
    } catch (e) {
      return null;
    }
  }

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

  function getDevCppIconsDir(ide) {
    try {
      if (!ide || !ide.path) return null;
      var dir = ide.path.replace(/\\+$/, "") + "\\Icons";
      if (fso.FolderExists(dir)) return dir;
      return null;
    } catch (e) {
      return null;
    }
  }

  // ========== config.script 注册 ==========

  function registerEGEWizardInConfig(configScriptPath) {
    if (!fso.FileExists(configScriptPath)) {
      log("  config.script 不存在: " + configScriptPath, "error");
      return false;
    }

    var content = EgeUtils.readTextFile(configScriptPath);
    if (content === null) {
      log("  读取 config.script 失败", "error");
      return false;
    }

    if (content.indexOf(EGE_WIZARD_MARKER) >= 0) {
      log("  EGE wizard 已在 config.script 中注册，跳过", "info");
      return true;
    }

    var lines = content.split("\n");
    var lastRegisterIdx = -1;

    for (var i = 0; i < lines.length; i++) {
      var trimmed = lines[i].replace(/^\s+/, "").replace(/\s+$/, "");
      if (trimmed.indexOf("RegisterWizard(") === 0 || trimmed.indexOf("RegisterWizard(") > 0 && trimmed.indexOf("//") !== 0) {
        if (lines[i].indexOf("function ") < 0) {
          lastRegisterIdx = i;
        }
      }
    }

    if (lastRegisterIdx < 0) {
      log("  无法在 config.script 中找到 RegisterWizard 调用", "error");
      return false;
    }

    var newLines = [];
    for (var j = 0; j <= lastRegisterIdx; j++) {
      newLines.push(lines[j]);
    }

    newLines.push("");
    newLines.push("    // EGE Graphics Engine project wizard");
    newLines.push("    if (PLATFORM == PLATFORM_MSW)");
    newLines.push(EGE_WIZARD_REGISTER_LINE);

    for (var k = lastRegisterIdx + 1; k < lines.length; k++) {
      newLines.push(lines[k]);
    }

    var newContent = newLines.join("\n");

    if (EgeUtils.isDryRunMode()) {
      log("  [DRY-RUN] 将修改 config.script 注册 EGE wizard", "info");
      return true;
    }

    var backupPath = configScriptPath + ".ege-backup";
    if (!fso.FileExists(backupPath)) {
      try {
        fso.CopyFile(configScriptPath, backupPath, false);
        log("  备份 config.script -> " + backupPath, "info");
      } catch (e) {
        log("  备份 config.script 失败: " + e.message, "warning");
      }
    }

    if (EgeUtils.writeTextFile(configScriptPath, newContent)) {
      log("  ✓ 已在 config.script 中注册 EGE wizard", "success");
      return true;
    }

    return false;
  }

  function unregisterEGEWizardFromConfig(configScriptPath) {
    if (!fso.FileExists(configScriptPath)) return true;

    var content = EgeUtils.readTextFile(configScriptPath);
    if (content === null) return true;

    if (content.indexOf(EGE_WIZARD_MARKER) < 0) {
      return true;
    }

    var lines = content.split("\n");
    var newLines = [];
    var removedCount = 0;

    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf(EGE_WIZARD_MARKER) >= 0) {
        removedCount++;
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
      if (EgeUtils.writeTextFile(configScriptPath, newLines.join("\n"))) {
        log("  ✓ 已从 config.script 中移除 EGE wizard 注册", "success");
      }
    }

    return true;
  }

  // ========== Code::Blocks Wizard ==========

  function installCodeBlocksWizard(ide) {
    var wizardSrc = EgeUtils.getTemplatePath("codeblocks") + "\\wizard";

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
      if (!EgeUtils.createFolder(destWizardDir)) {
        log("  创建 wizard 目录失败: " + destWizardDir, "error");
        return false;
      }
    }

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
      if (EgeUtils.isDryRunMode()) {
        log("  [DRY-RUN] 将复制: " + wizardFiles[i] + " -> " + dest, "info");
      } else if (EgeUtils.copyFile(src, dest)) {
        log("  复制: " + wizardFiles[i], "success");
      } else {
        hasError = true;
      }
    }

    // 复制 main.cpp -> wizard/files/
    var mainCppSrc = EgeUtils.getTemplatePath("codeblocks") + "\\main.cpp";
    var filesDest = destWizardDir + "\\files";
    var mainCppDest = filesDest + "\\main.cpp";

    if (!fso.FolderExists(filesDest)) {
      if (!EgeUtils.createFolder(filesDest)) {
        log("  创建 files 目录失败: " + filesDest, "error");
        hasError = true;
      }
    }

    if (!hasError && fso.FileExists(mainCppSrc)) {
      if (EgeUtils.isDryRunMode()) {
        log("  [DRY-RUN] 将复制: main.cpp -> " + mainCppDest, "info");
      } else if (EgeUtils.copyFile(mainCppSrc, mainCppDest)) {
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

    // 2) 注册 wizard
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

  function uninstallCodeBlocksWizard(ide) {
    var wizardBaseDir = getCodeBlocksWizardDir(ide);

    if (wizardBaseDir) {
      var configScriptPath = wizardBaseDir + "\\config.script";
      unregisterEGEWizardFromConfig(configScriptPath);

      var egeWizardDir = wizardBaseDir + "\\ege";
      if (fso.FolderExists(egeWizardDir)) {
        try {
          fso.DeleteFolder(egeWizardDir, true);
          log("  ✓ 删除 wizard 目录: " + egeWizardDir, "success");
        } catch (e) {
          log("  ⚠ 删除 wizard 目录失败: " + e.message, "warning");
        }
      }

      var backupPath = configScriptPath + ".ege-backup";
      if (fso.FileExists(backupPath)) {
        try {
          fso.DeleteFile(backupPath, true);
          log("  ✓ 删除 config.script 备份", "success");
        } catch (e) { }
      }
    }

    return true;
  }

  // ========== Code::Blocks 项目模板 ==========

  function installCodeBlocksTemplate(ide) {
    var templateSrc = EgeUtils.getTemplatePath("codeblocks");

    if (!fso.FolderExists(templateSrc)) {
      log("  模板目录不存在: " + templateSrc, "warning");
      return true;
    }

    var shareTemplateDir = getCodeBlocksShareTemplateDir(ide);
    var userShareTemplateDir = getCodeBlocksUserShareTemplateDir();
    var appData = shell.ExpandEnvironmentStrings("%APPDATA%");
    var userTemplateDir = appData + "\\CodeBlocks\\UserTemplates\\EGE_Project";

    /**
     * 复制模板文件到目标目录
     * @param {boolean} isSharedDir - 共享目录中 main.cpp 需重命名为 ege-main.cpp
     */
    function copyTemplateToDir(destDir, label, isSharedDir) {
      if (!destDir) return false;

      log("  目标模板目录: " + destDir + " (" + label + ")", "info");

      if (!fso.FolderExists(destDir)) {
        if (!EgeUtils.createFolder(destDir)) {
          log("  创建模板目录失败: " + destDir, "error");
          return false;
        }
      }

      var hasError = false;
      var copiedCount = 0;
      var templateFiles = EgeUtils.getFiles(templateSrc);

      for (var i = 0; i < templateFiles.length; i++) {
        var fileName = fso.GetFileName(templateFiles[i]);
        var destFileName = fileName;
        if (isSharedDir && fileName.toLowerCase() === "main.cpp") {
          destFileName = "ege-main.cpp";
        }

        var dest = destDir + "\\" + destFileName;
        if (EgeUtils.isDryRunMode()) {
          log("  [DRY-RUN] 将复制模板: " + fileName + " -> " + dest, "info");
          copiedCount++;
        } else if (EgeUtils.copyFile(templateFiles[i], dest)) {
          log("  复制模板: " + fileName + " -> " + dest, "success");
          copiedCount++;
        } else {
          hasError = true;
        }
      }

      if (!EgeUtils.isDryRunMode()) {
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

    if (shareTemplateDir) {
      log("  尝试安装到全局模板目录（需要管理员权限）...", "info");
      if (copyTemplateToDir(shareTemplateDir, "全局模板", true)) {
        anySuccess = true;
      } else {
        log("  ⚠ 安装到全局模板目录失败，将继续安装到用户模板目录", "warning");
      }
    }

    if (userShareTemplateDir) {
      log("  安装到用户级 share 模板目录（无需管理员权限）...", "info");
      if (copyTemplateToDir(userShareTemplateDir, "用户级 share 模板", true)) {
        anySuccess = true;
      }
    }

    log("  安装到用户模板目录（兼容入口：从用户模板新建...）...", "info");
    if (copyTemplateToDir(userTemplateDir, "用户模板", false)) {
      anySuccess = true;
    }

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

  function uninstallCodeBlocksTemplate(ide) {
    var userTemplateDir = getCodeBlocksUserTemplateDir();
    var shareTemplateDir = getCodeBlocksShareTemplateDir(ide);
    var userShareTemplateDir = getCodeBlocksUserShareTemplateDir();

    log("卸载 Code::Blocks 项目模板...", "info");

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

    try {
      if (fso.FolderExists(userTemplateDir)) {
        fso.DeleteFolder(userTemplateDir, true);
        log("  ✓ 删除用户模板目录: " + userTemplateDir, "success");
        removedAny = true;
      }
    } catch (e2) {
      log("  ⚠ 删除用户模板目录失败: " + e2.message, "warning");
    }

    uninstallCodeBlocksWizard(ide);

    if (!removedAny) {
      log("  模板未安装或已删除", "info");
    }

    return true;
  }

  // ========== Code::Blocks 使用说明 ==========

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

  // ========== Dev-C++ 项目模板 ==========

  function installDevCppTemplate(ide) {
    var templateSrc = EgeUtils.getTemplatePath("devcpp");

    if (!fso.FolderExists(templateSrc)) {
      log("  模板源目录不存在: " + templateSrc, "warning");
      return "skipped";
    }

    var destDir = getDevCppTemplateDir(ide);
    if (!destDir) {
      log("  Dev-C++ Templates 目录不存在: " + (ide.path || "(空)") + "\\Templates", "warning");
      log("  跳过项目模板安装", "warning");
      return false;
    }

    log("安装 Dev-C++ 项目模板...", "info");
    log("  模板源目录: " + templateSrc, "info");
    log("  模板目标目录: " + destDir, "info");

    var hasError = false;
    var copiedCount = 0;

    // 复制图标
    var iconsDir = getDevCppIconsDir(ide);
    if (iconsDir) {
      var iconSrc = templateSrc + "\\ege-template.ico";
      var iconDest = iconsDir + "\\ege-template.ico";

      if (fso.FileExists(iconSrc)) {
        if (EgeUtils.isDryRunMode()) {
          log("  [DRY-RUN] 将复制图标: ege-template.ico -> Icons\\", "info");
          copiedCount++;
        } else if (EgeUtils.copyFile(iconSrc, iconDest)) {
          log("  复制图标: ege-template.ico -> Icons\\", "success");
          copiedCount++;
        } else {
          hasError = true;
        }
      } else {
        log("  图标文件不存在: " + iconSrc, "warning");
      }
    } else {
      log("  Dev-C++ Icons 目录不存在，跳过图标安装", "warning");
    }

    // 复制模板文件
    var templateFiles = ["EGE_Graphics.template", "EGE_main_cpp.txt"];
    for (var i = 0; i < templateFiles.length; i++) {
      var src = templateSrc + "\\" + templateFiles[i];
      var dest = destDir + "\\" + templateFiles[i];

      if (!fso.FileExists(src)) {
        log("  模板文件不存在: " + src, "error");
        hasError = true;
        continue;
      }

      if (EgeUtils.isDryRunMode()) {
        log("  [DRY-RUN] 将复制: " + templateFiles[i] + " -> " + dest, "info");
        copiedCount++;
      } else if (EgeUtils.copyFile(src, dest)) {
        log("  复制: " + templateFiles[i], "success");
        copiedCount++;
      } else {
        hasError = true;
      }
    }

    // 验证
    if (!EgeUtils.isDryRunMode() && !hasError) {
      var requiredFiles = ["EGE_Graphics.template", "EGE_main_cpp.txt"];
      for (var v = 0; v < requiredFiles.length; v++) {
        if (!fso.FileExists(destDir + "\\" + requiredFiles[v])) {
          log("  ⚠ 缺少模板文件: " + requiredFiles[v], "warning");
          hasError = true;
        }
      }
    }

    if (!hasError && copiedCount > 0) {
      log("  ✓ Dev-C++ 项目模板安装成功！", "success");
      log("  新建项目时可在 \"Multimedia\" 分类中找到 \"EGE Graphics\"", "success");
    }

    return !hasError;
  }

  function uninstallDevCppTemplate(ide) {
    var destDir = getDevCppTemplateDir(ide);

    log("卸载 Dev-C++ 项目模板...", "info");

    if (!destDir) {
      log("  Dev-C++ Templates 目录不存在，跳过", "info");
      return true;
    }

    var removedAny = false;

    var templateFiles = ["EGE_Graphics.template", "EGE_main_cpp.txt"];
    for (var i = 0; i < templateFiles.length; i++) {
      var filePath = destDir + "\\" + templateFiles[i];
      try {
        if (fso.FileExists(filePath)) {
          fso.DeleteFile(filePath, true);
          log("  ✓ 删除模板: " + templateFiles[i], "success");
          removedAny = true;
        }
      } catch (e) {
        log("  ⚠ 删除失败: " + filePath + " (" + e.message + ")", "warning");
      }
    }

    var iconsDir = getDevCppIconsDir(ide);
    if (iconsDir) {
      var iconPath = iconsDir + "\\ege-template.ico";
      try {
        if (fso.FileExists(iconPath)) {
          fso.DeleteFile(iconPath, true);
          log("  ✓ 删除图标: ege-template.ico", "success");
          removedAny = true;
        }
      } catch (e) {
        log("  ⚠ 删除图标失败: " + iconPath + " (" + e.message + ")", "warning");
      }
    }

    if (!removedAny) {
      log("  模板未安装或已删除", "info");
    }

    return true;
  }

  function showDevCppUsageGuide() {
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
    log("⚙️ 编译设置：", "warning");
    log("  ⚠ 重要：请确保使用 64-bit 编译模式！", "warning");
    log("  • 工具 → 编译器选项 → 设置 → 代码生成 → 架构 = x86_64", "warning");
    log("  • 32-bit 模式已淘汰，本模板仅支持 64-bit 编译", "warning");
    log("", "");
    log("✅ 模板已自动配置所有链接选项，无需手动设置。", "info");
    log("=====================================================", "success");
    log("", "");
  }

  // 公开 API
  return {
    // 路径
    getCodeBlocksUserTemplateDir: getCodeBlocksUserTemplateDir,
    getCodeBlocksShareTemplateDir: getCodeBlocksShareTemplateDir,
    getCodeBlocksUserShareTemplateDir: getCodeBlocksUserShareTemplateDir,
    getCodeBlocksWizardDir: getCodeBlocksWizardDir,
    getDevCppTemplateDir: getDevCppTemplateDir,
    getDevCppIconsDir: getDevCppIconsDir,
    // CodeBlocks
    installCodeBlocksTemplate: installCodeBlocksTemplate,
    uninstallCodeBlocksTemplate: uninstallCodeBlocksTemplate,
    installCodeBlocksWizard: installCodeBlocksWizard,
    uninstallCodeBlocksWizard: uninstallCodeBlocksWizard,
    showCodeBlocksUsageGuide: showCodeBlocksUsageGuide,
    // config.script
    registerEGEWizardInConfig: registerEGEWizardInConfig,
    unregisterEGEWizardFromConfig: unregisterEGEWizardFromConfig,
    EGE_WIZARD_MARKER: EGE_WIZARD_MARKER,
    // Dev-C++
    installDevCppTemplate: installDevCppTemplate,
    uninstallDevCppTemplate: uninstallDevCppTemplate,
    showDevCppUsageGuide: showDevCppUsageGuide
  };
})();
