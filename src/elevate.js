/**
 * EGE Installer - 提权执行模块
 * 免管理员模式下：生成 PowerShell 脚本，通过 ShellExecute("runas") 提权执行
 *
 * 依赖: utils.js (EgeUtils), installer.js (Installer), templates.js (Templates)
 */

var Elevate = (function () {
  var fso = EgeUtils.fso;
  var shell = EgeUtils.shell;
  var log = EgeUtils.log;

  /**
   * 将路径转义为 PowerShell 安全的字符串（单引号包裹 + 内部单引号转义）
   */
  function psEscapePath(path) {
    return "'" + path.replace(/'/g, "''") + "'";
  }

  /**
   * 为单个 IDE 生成安装操作的 PowerShell 命令
   */
  function generateIDEInstallCommands(ide, egeLibsPath) {
    var cmds = [];
    var srcInclude = egeLibsPath + "\\include";
    var srcLib = egeLibsPath + "\\lib";

    var skipLibInstall = (ide.type === "codeblocks" && (!ide.includePath || !ide.libPath));

    if (!skipLibInstall) {
      // 头文件
      cmds.push("# 安装头文件到: " + ide.includePath);
      var headerFiles = ["ege.h", "graphics.h"];
      for (var h = 0; h < headerFiles.length; h++) {
        var hSrc = srcInclude + "\\" + headerFiles[h];
        var hDest = ide.includePath + "\\" + headerFiles[h];
        if (fso.FileExists(hSrc)) {
          cmds.push("Copy-Item -LiteralPath " + psEscapePath(hSrc) + " -Destination " + psEscapePath(hDest) + " -Force");
        }
      }

      // ege 子目录
      var egeSubDir = srcInclude + "\\ege";
      if (fso.FolderExists(egeSubDir)) {
        var destEgeDir = ide.includePath + "\\ege";
        cmds.push("if (-not (Test-Path " + psEscapePath(destEgeDir) + ")) { New-Item -ItemType Directory -Path " + psEscapePath(destEgeDir) + " -Force | Out-Null }");
        cmds.push("Copy-Item -LiteralPath " + psEscapePath(egeSubDir) + "\\* -Destination " + psEscapePath(destEgeDir) + " -Recurse -Force");
      }

      // 库文件
      var libDirs = Installer.getLibDirMapping(ide);
      if (libDirs) {
        for (var arch in libDirs) {
          var srcLibDir = srcLib + "\\" + libDirs[arch];
          if (arch !== "default") {
            srcLibDir += "\\" + arch;
          }

          if (!fso.FolderExists(srcLibDir)) continue;

          var destLibDir = ide.libPath;
          if (ide.type.indexOf("vs") >= 0) {
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

          cmds.push("# 安装库文件到: " + destLibDir);
          var libFiles = EgeUtils.getFiles(srcLibDir);
          for (var l = 0; l < libFiles.length; l++) {
            var fileName = fso.GetFileName(libFiles[l]);
            if (!EgeUtils.isValidLibraryFile(fileName)) continue;
            var libDest = destLibDir + "\\" + fileName;
            cmds.push("Copy-Item -LiteralPath " + psEscapePath(libFiles[l]) + " -Destination " + psEscapePath(libDest) + " -Force");
          }
        }
      }
    }

    // CodeBlocks 全局模板
    if (ide.type === "codeblocks") {
      var shareTemplateDir = Templates.getCodeBlocksShareTemplateDir(ide);
      if (shareTemplateDir) {
        var templateSrc = EgeUtils.getTemplatePath("codeblocks");
        if (fso.FolderExists(templateSrc)) {
          cmds.push("# 安装 CodeBlocks 全局模板");
          cmds.push("if (-not (Test-Path " + psEscapePath(shareTemplateDir) + ")) { New-Item -ItemType Directory -Path " + psEscapePath(shareTemplateDir) + " -Force | Out-Null }");
          var tplFiles = EgeUtils.getFiles(templateSrc);
          for (var t = 0; t < tplFiles.length; t++) {
            var tplName = fso.GetFileName(tplFiles[t]);
            var tplDestName = tplName;
            if (tplName.toLowerCase() === "main.cpp") {
              tplDestName = "ege-main.cpp";
            }
            cmds.push("Copy-Item -LiteralPath " + psEscapePath(tplFiles[t]) + " -Destination " + psEscapePath(shareTemplateDir + "\\" + tplDestName) + " -Force");
          }
        }
      }

      // Wizard (CB >= 25.03)
      if (ide.supportsWizard) {
        var wizardBaseDir = Templates.getCodeBlocksWizardDir(ide);
        if (wizardBaseDir) {
          var wizardSrc = EgeUtils.getTemplatePath("codeblocks") + "\\wizard";
          if (fso.FolderExists(wizardSrc)) {
            var destWizDir = wizardBaseDir + "\\ege";
            cmds.push("# 安装 CodeBlocks Projects wizard");
            cmds.push("if (-not (Test-Path " + psEscapePath(destWizDir) + ")) { New-Item -ItemType Directory -Path " + psEscapePath(destWizDir) + " -Force | Out-Null }");
            var wizFiles = ["wizard.script", "logo.png", "wizard.png"];
            for (var w = 0; w < wizFiles.length; w++) {
              var wSrc = wizardSrc + "\\" + wizFiles[w];
              if (fso.FileExists(wSrc)) {
                cmds.push("Copy-Item -LiteralPath " + psEscapePath(wSrc) + " -Destination " + psEscapePath(destWizDir + "\\" + wizFiles[w]) + " -Force");
              }
            }
            var mainCppSrc = EgeUtils.getTemplatePath("codeblocks") + "\\main.cpp";
            if (fso.FileExists(mainCppSrc)) {
              var filesDest = destWizDir + "\\files";
              cmds.push("if (-not (Test-Path " + psEscapePath(filesDest) + ")) { New-Item -ItemType Directory -Path " + psEscapePath(filesDest) + " -Force | Out-Null }");
              cmds.push("Copy-Item -LiteralPath " + psEscapePath(mainCppSrc) + " -Destination " + psEscapePath(filesDest + "\\main.cpp") + " -Force");
            }
          }

          // config.script 修改
          var configScriptPath = wizardBaseDir + "\\config.script";
          if (fso.FileExists(configScriptPath)) {
            var content = EgeUtils.readTextFile(configScriptPath);
            if (content !== null && content.indexOf(Templates.EGE_WIZARD_MARKER) < 0) {
              cmds.push("# 注册 EGE wizard 到 config.script");
              cmds.push("$configPath = " + psEscapePath(configScriptPath));
              cmds.push("$content = [System.IO.File]::ReadAllText($configPath)");
              cmds.push("if ($content -notmatch 'EGE-INSTALLER') {");
              cmds.push("  $backupPath = $configPath + '.ege-backup'");
              cmds.push("  if (-not (Test-Path $backupPath)) { Copy-Item $configPath $backupPath }");
              cmds.push("  $lines = $content -split \"`n\"");
              cmds.push("  $lastIdx = -1");
              cmds.push("  for ($i = 0; $i -lt $lines.Count; $i++) {");
              cmds.push("    if ($lines[$i] -match 'RegisterWizard\\(' -and $lines[$i] -notmatch 'function ') { $lastIdx = $i }");
              cmds.push("  }");
              cmds.push("  if ($lastIdx -ge 0) {");
              cmds.push("    $insertLines = @('', '    // EGE Graphics Engine project wizard', '    if (PLATFORM == PLATFORM_MSW)', '        RegisterWizard(wizProject, _T(\"ege\"), _T(\"EGE project\"), _T(\"2D/3D Graphics\")); // [EGE-INSTALLER]')");
              cmds.push("    $newLines = $lines[0..$lastIdx] + $insertLines + $lines[($lastIdx+1)..($lines.Count-1)]");
              cmds.push("    [System.IO.File]::WriteAllText($configPath, ($newLines -join \"`n\"))");
              cmds.push("  }");
              cmds.push("}");
            }
          }
        }
      }
    }

    // Dev-C++ 模板
    if (ide.type === "devcpp") {
      var devTemplateSrc = EgeUtils.getTemplatePath("devcpp");
      var devDestDir = Templates.getDevCppTemplateDir(ide);
      if (fso.FolderExists(devTemplateSrc) && devDestDir) {
        cmds.push("# 安装 Dev-C++ 项目模板");
        var devTemplateFiles = ["EGE_Graphics.template", "EGE_main_cpp.txt"];
        for (var d = 0; d < devTemplateFiles.length; d++) {
          var dSrc = devTemplateSrc + "\\" + devTemplateFiles[d];
          if (fso.FileExists(dSrc)) {
            cmds.push("Copy-Item -LiteralPath " + psEscapePath(dSrc) + " -Destination " + psEscapePath(devDestDir + "\\" + devTemplateFiles[d]) + " -Force");
          }
        }
        var devIconSrc = devTemplateSrc + "\\ege-template.ico";
        var devIconsDir = Templates.getDevCppIconsDir(ide);
        if (fso.FileExists(devIconSrc) && devIconsDir) {
          cmds.push("Copy-Item -LiteralPath " + psEscapePath(devIconSrc) + " -Destination " + psEscapePath(devIconsDir + "\\ege-template.ico") + " -Force");
        }
      }
    }

    return cmds;
  }

  /**
   * 为单个 IDE 生成卸载操作的 PowerShell 命令
   */
  function generateIDEUninstallCommands(ide) {
    var cmds = [];

    // 删除头文件
    if (ide.includePath) {
      cmds.push("# 从 " + ide.name + " 卸载头文件");
      var headerFiles = ["ege.h", "graphics.h"];
      for (var h = 0; h < headerFiles.length; h++) {
        var hp = ide.includePath + "\\" + headerFiles[h];
        cmds.push("if (Test-Path " + psEscapePath(hp) + ") { Remove-Item -LiteralPath " + psEscapePath(hp) + " -Force }");
      }
      var egeSubDir = ide.includePath + "\\ege";
      cmds.push("if (Test-Path " + psEscapePath(egeSubDir) + ") { Remove-Item -LiteralPath " + psEscapePath(egeSubDir) + " -Recurse -Force }");
    }

    // 删除库文件
    if (ide.libPath) {
      var libDirs = Installer.getLibDirMapping(ide);
      if (libDirs) {
        for (var arch in libDirs) {
          var destLibDir = ide.libPath;
          if (ide.type.indexOf("vs") >= 0) {
            if (arch === "x64") {
              if (fso.FolderExists(ide.libPath + "\\x64")) {
                destLibDir = ide.libPath + "\\x64";
              } else if (fso.FolderExists(ide.libPath + "\\amd64")) {
                destLibDir = ide.libPath + "\\amd64";
              }
            }
          }
          cmds.push("# 从 " + destLibDir + " 删除库文件");
          var libPatterns = ["graphics.lib", "graphicsd.lib", "libgraphics.a"];
          for (var k = 0; k < libPatterns.length; k++) {
            var lp = destLibDir + "\\" + libPatterns[k];
            cmds.push("if (Test-Path " + psEscapePath(lp) + ") { Remove-Item -LiteralPath " + psEscapePath(lp) + " -Force }");
          }
        }
      }
    }

    // CodeBlocks 模板卸载
    if (ide.type === "codeblocks") {
      var shareTemplateDir2 = Templates.getCodeBlocksShareTemplateDir(ide);
      if (shareTemplateDir2) {
        cmds.push("# 卸载 CodeBlocks 全局模板");
        var cbFiles = ["EGE_Project.template", "EGE_Project.cbp", "ege-main.cpp"];
        for (var c = 0; c < cbFiles.length; c++) {
          var cp = shareTemplateDir2 + "\\" + cbFiles[c];
          cmds.push("if (Test-Path " + psEscapePath(cp) + ") { Remove-Item -LiteralPath " + psEscapePath(cp) + " -Force }");
        }
      }
      var wizBaseDir = Templates.getCodeBlocksWizardDir(ide);
      if (wizBaseDir) {
        var egeWizDir = wizBaseDir + "\\ege";
        cmds.push("if (Test-Path " + psEscapePath(egeWizDir) + ") { Remove-Item -LiteralPath " + psEscapePath(egeWizDir) + " -Recurse -Force }");
        var cfgPath = wizBaseDir + "\\config.script";
        cmds.push("if (Test-Path " + psEscapePath(cfgPath) + ") {");
        cmds.push("  $content = [System.IO.File]::ReadAllText(" + psEscapePath(cfgPath) + ")");
        cmds.push("  if ($content -match 'EGE-INSTALLER') {");
        cmds.push("    $lines = $content -split \"`n\"");
        cmds.push("    $newLines = @()");
        cmds.push("    for ($i = 0; $i -lt $lines.Count; $i++) {");
        cmds.push("      if ($lines[$i] -match 'EGE-INSTALLER') {");
        cmds.push("        while ($newLines.Count -gt 0 -and ($newLines[-1].Trim() -eq '' -or $newLines[-1].Trim() -eq '// EGE Graphics Engine project wizard' -or $newLines[-1].Trim() -eq 'if (PLATFORM == PLATFORM_MSW)')) { $newLines = $newLines[0..($newLines.Count-2)] }");
        cmds.push("        continue");
        cmds.push("      }");
        cmds.push("      $newLines += $lines[$i]");
        cmds.push("    }");
        cmds.push("    [System.IO.File]::WriteAllText(" + psEscapePath(cfgPath) + ", ($newLines -join \"`n\"))");
        cmds.push("  }");
        cmds.push("}");
      }
    }

    // Dev-C++ 模板卸载
    if (ide.type === "devcpp") {
      var devDestDir = Templates.getDevCppTemplateDir(ide);
      if (devDestDir) {
        cmds.push("# 卸载 Dev-C++ 项目模板");
        var devFiles = ["EGE_Graphics.template", "EGE_main_cpp.txt"];
        for (var df = 0; df < devFiles.length; df++) {
          var dfp = devDestDir + "\\" + devFiles[df];
          cmds.push("if (Test-Path " + psEscapePath(dfp) + ") { Remove-Item -LiteralPath " + psEscapePath(dfp) + " -Force }");
        }
      }
      var devIconsDir2 = Templates.getDevCppIconsDir(ide);
      if (devIconsDir2) {
        var iconP = devIconsDir2 + "\\ege-template.ico";
        cmds.push("if (Test-Path " + psEscapePath(iconP) + ") { Remove-Item -LiteralPath " + psEscapePath(iconP) + " -Force }");
      }
    }

    return cmds;
  }

  /**
   * 生成完整的 PowerShell 脚本
   */
  function generateScript(selectedIDEs, customLibsPath, mode) {
    var egeLibsPath = customLibsPath || EgeUtils.getEgeLibsPath();
    var isInstall = (mode !== "uninstall");
    var lines = [];

    lines.push("# ============================================================");
    lines.push("# EGE \u56fe\u5f62\u5e93" + (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + "\u811a\u672c");
    lines.push("# \u7531 EGE Installer (No-Admin) \u81ea\u52a8\u751f\u6210");
    lines.push("# \u751f\u6210\u65f6\u95f4: " + new Date().toLocaleString());
    lines.push("# ");
    lines.push("# \u6b64\u811a\u672c\u9700\u8981\u4ee5\u7ba1\u7406\u5458\u6743\u9650\u8fd0\u884c");
    lines.push("# ============================================================");
    lines.push("");
    lines.push("$ErrorActionPreference = 'Stop'");
    lines.push("$successCount = 0");
    lines.push("$failCount = 0");
    lines.push("$results = @()");
    lines.push("");

    for (var i = 0; i < selectedIDEs.length; i++) {
      var ide = selectedIDEs[i];

      if (ide.type === "vs") {
        ide = Installer.resolveVSPaths(ide);
      }

      lines.push("# ------ " + ide.name + " ------");
      lines.push("Write-Host '" + (isInstall ? "\u5b89\u88c5\u5230" : "\u4ece...\u5378\u8f7d") + " " + ide.name.replace(/'/g, "''") + "...' -ForegroundColor Cyan");
      lines.push("try {");

      var cmds = isInstall
        ? generateIDEInstallCommands(ide, egeLibsPath)
        : generateIDEUninstallCommands(ide);

      for (var c = 0; c < cmds.length; c++) {
        lines.push("  " + cmds[c]);
      }

      lines.push("  $successCount++");
      lines.push("  $results += @{ Name = '" + ide.name.replace(/'/g, "''") + "'; Success = $true; Error = '' }");
      lines.push("  Write-Host '  [OK] " + ide.name.replace(/'/g, "''") + " " + (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + "\u6210\u529f' -ForegroundColor Green");
      lines.push("} catch {");
      lines.push("  $failCount++");
      lines.push("  $results += @{ Name = '" + ide.name.replace(/'/g, "''") + "'; Success = $false; Error = $_.Exception.Message }");
      lines.push("  Write-Host \"  [FAIL] " + ide.name.replace(/'/g, "''") + " " + (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + "\u5931\u8d25: $($_.Exception.Message)\" -ForegroundColor Red");
      lines.push("}");
      lines.push("");
    }

    // 写入结果文件
    lines.push("# Write result file");
    lines.push("$resultFile = Join-Path $env:TEMP 'ege-install-result.json'");
    lines.push("$jsonObj = @{");
    lines.push("  success = ($failCount -eq 0)");
    lines.push("  successCount = $successCount");
    lines.push("  failCount = $failCount");
    lines.push("  results = $results");
    lines.push("  timestamp = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')");
    lines.push("}");
    lines.push("$jsonStr = $jsonObj | ConvertTo-Json -Depth 3");
    lines.push("[System.IO.File]::WriteAllText($resultFile, $jsonStr, [System.Text.Encoding]::UTF8)");
    lines.push("");
    lines.push("Write-Host ''");
    lines.push("Write-Host '======================================' -ForegroundColor Cyan");
    lines.push("Write-Host \"" + (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + "\u5b8c\u6210: \u6210\u529f $successCount \u4e2a, \u5931\u8d25 $failCount \u4e2a\" -ForegroundColor $(if ($failCount -eq 0) { 'Green' } else { 'Yellow' })");
    lines.push("Write-Host '======================================' -ForegroundColor Cyan");
    lines.push("Write-Host ''");
    lines.push("Write-Host '\u6b64\u7a97\u53e3\u5c06\u5728 3 \u79d2\u540e\u81ea\u52a8\u5173\u95ed...' -ForegroundColor Gray");
    lines.push("Start-Sleep -Seconds 3");

    return lines.join("\r\n");
  }

  /**
   * 通过提权脚本执行安装/卸载
   */
  function executeViaElevatedScript(selectedIDEs, customLibsPath, mode, progressCallback, completeCallback) {
    EgeUtils.setLogFunc(function (msg, type) {
      if (typeof window.log === "function") {
        window.log(msg, type);
      }
    });

    var isInstall = (mode !== "uninstall");
    var egeLibsPath = customLibsPath || EgeUtils.getEgeLibsPath();

    log("=== " + (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + " EGE\uff08\u63d0\u6743\u6a21\u5f0f\uff09===", "info");
    log("", "");

    if (isInstall && !fso.FolderExists(egeLibsPath)) {
      log("\u627e\u4e0d\u5230 EGE \u5e93\u6587\u4ef6\u76ee\u5f55: " + egeLibsPath, "error");
      completeCallback(false, "\u627e\u4e0d\u5230 EGE \u5e93\u6587\u4ef6\u76ee\u5f55", false, false);
      return;
    }

    for (var v = 0; v < selectedIDEs.length; v++) {
      if (selectedIDEs[v].type === "vs") {
        selectedIDEs[v] = Installer.resolveVSPaths(selectedIDEs[v]);
      }
    }

    log("\u6b63\u5728\u751f\u6210" + (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + "\u811a\u672c...", "info");
    var scriptContent = generateScript(selectedIDEs, egeLibsPath, mode);

    // 检测 Debug 模式：如果存在 .ege-debug 标志文件，显示脚本预览
    var tempDir = shell.ExpandEnvironmentStrings("%TEMP%");
    var debugFlagFile = tempDir + "\\.ege-debug";
    var isDebugMode = false;
    try {
      isDebugMode = fso.FileExists(debugFlagFile);
    } catch (e) { }

    if (isDebugMode) {
      log("", "");
      log("[DEBUG \u6a21\u5f0f] \u811a\u672c\u9884\u89c8\u5df2\u542f\u7528\uff0c\u8bf7\u5ba1\u67e5\u540e\u786e\u8ba4\u6267\u884c", "info");
      
      // 显示脚本预览窗口，并等待用户决策
      if (typeof window.showScriptPreview === "function") {
        window.showScriptPreview(scriptContent, selectedIDEs, egeLibsPath, mode, progressCallback, completeCallback);
        return; // 中止当前流程，由预览窗口的按钮回调继续
      } else {
        log("\u8b66\u544a: \u65e0\u6cd5\u663e\u793a\u811a\u672c\u9884\u89c8\u7a97\u53e3", "error");
      }
    }

    // 继续执行（非 Debug 模式或预览窗口无法显示时）
    continueWithScriptExecution(scriptContent, selectedIDEs, egeLibsPath, mode, progressCallback, completeCallback);
  }

  /**
   * 继续执行脚本（Debug 模式确认后或非 Debug 模式直接调用）
   */
  function continueWithScriptExecution(scriptContent, selectedIDEs, egeLibsPath, mode, progressCallback, completeCallback) {
    var isInstall = (mode !== "uninstall");
    var tempDir = shell.ExpandEnvironmentStrings("%TEMP%");
    
    // 清除旧结果文件
    var resultFile = tempDir + "\\ege-install-result.json";
    try {
      if (fso.FileExists(resultFile)) {
        fso.DeleteFile(resultFile, true);
      }
    } catch (e) { }

    // 将脚本写入临时文件（使用 ADODB.Stream 写入 UTF-8 以支持中文路径和字符）
    var timestamp = new Date().getTime();
    var scriptFile = tempDir + "\\ege-" + mode + "-" + timestamp + ".ps1";
    if (!EgeUtils.writeUtf8File(scriptFile, scriptContent)) {
      log("\u65e0\u6cd5\u5199\u5165\u811a\u672c\u6587\u4ef6: " + scriptFile, "error");
      completeCallback(false, "\u65e0\u6cd5\u5199\u5165\u811a\u672c\u6587\u4ef6", false, false);
      return;
    }
    log("\u811a\u672c\u5df2\u4fdd\u5b58\u5230: " + scriptFile, "info");

    // 通过 ShellExecute("runas") 提权运行
    log("", "");
    log("\u6b63\u5728\u8bf7\u6c42\u7ba1\u7406\u5458\u6743\u9650...", "info");
    log("\u8bf7\u5728 UAC \u5f39\u7a97\u4e2d\u70b9\u51fb\u300c\u662f\u300d\u4ee5\u7ee7\u7eed", "info");
    progressCallback(10, "\u7b49\u5f85\u7ba1\u7406\u5458\u6743\u9650\u786e\u8ba4...");

    try {
      var shellApp = new ActiveXObject("Shell.Application");
      shellApp.ShellExecute(
        "powershell.exe",
        "-ExecutionPolicy Bypass -File \"" + scriptFile + "\"",
        "",
        "runas",
        1  // SW_SHOWNORMAL
      );
    } catch (e) {
      log("", "");
      if (e.message.indexOf("cancelled") >= 0 || e.message.indexOf("\u53d6\u6d88") >= 0 || e.number === -2147023673) {
        log("\u7528\u6237\u53d6\u6d88\u4e86\u7ba1\u7406\u5458\u6743\u9650\u8bf7\u6c42", "info");
        completeCallback(false, "\u7528\u6237\u53d6\u6d88\u4e86\u7ba1\u7406\u5458\u6743\u9650\u8bf7\u6c42", false, false);
      } else {
        log("\u8bf7\u6c42\u7ba1\u7406\u5458\u6743\u9650\u5931\u8d25: " + e.message, "error");
        completeCallback(false, "\u8bf7\u6c42\u7ba1\u7406\u5458\u6743\u9650\u5931\u8d25: " + e.message, false, false);
      }
      try { fso.DeleteFile(scriptFile, true); } catch (e2) { }
      return;
    }

    log("\u7ba1\u7406\u5458\u811a\u672c\u5df2\u542f\u52a8\uff0c\u6b63\u5728\u7b49\u5f85\u6267\u884c\u7ed3\u679c...", "info");
    progressCallback(30, "\u6b63\u5728\u6267\u884c" + (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + "...");

    // 轮询等待结果文件
    var pollCount = 0;
    var maxPollCount = 300;
    var pollTimer = window.setInterval(function () {
      pollCount++;

      if (pollCount > maxPollCount) {
        window.clearInterval(pollTimer);
        log("", "");
        log("\u7b49\u5f85\u8d85\u65f6\uff085 \u5206\u949f\uff09\uff0c\u8bf7\u68c0\u67e5 PowerShell \u7a97\u53e3\u662f\u5426\u4ecd\u5728\u8fd0\u884c", "error");
        completeCallback(false, "\u7b49\u5f85\u8d85\u65f6", false, false);
        try { fso.DeleteFile(scriptFile, true); } catch (e) { }
        return;
      }

      var progress = 30 + Math.min(60, (pollCount / maxPollCount) * 60);
      progressCallback(progress, "\u6b63\u5728\u6267\u884c" + (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + "...(" + pollCount + "s)");

      try {
        if (fso.FileExists(resultFile)) {
          window.clearInterval(pollTimer);

          window.setTimeout(function () {
            var resultContent = null;
            try {
              var rs = fso.OpenTextFile(resultFile, 1, false);
              resultContent = rs.ReadAll();
              rs.Close();
            } catch (e) {
              log("\u8bfb\u53d6\u7ed3\u679c\u6587\u4ef6\u5931\u8d25: " + e.message, "error");
            }

            progressCallback(100, (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + "\u5b8c\u6210");

            if (resultContent) {
              try {
                var result = eval("(" + resultContent + ")");
                log("", "");
                log("======================================", "info");
                log("=== " + (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + "\u6d41\u7a0b\u7ed3\u675f ===", "info");
                log("======================================", "info");
                log("", "");

                if (result.results) {
                  for (var r = 0; r < result.results.length; r++) {
                    var item = result.results[r];
                    if (item.Success) {
                      log("\u2713 " + item.Name + " " + (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + "\u6210\u529f", "success");
                    } else {
                      log("\u2717 " + item.Name + " " + (isInstall ? "\u5b89\u88c5" : "\u5378\u8f7d") + "\u5931\u8d25: " + item.Error, "error");
                    }
                  }
                }

                log("", "");
                log("\u6210\u529f: " + result.successCount + ", \u5931\u8d25: " + result.failCount, result.success ? "success" : "error");

                var codeBlocksInstalled = false;
                var devCppInstalled = false;
                if (isInstall) {
                  for (var ci = 0; ci < selectedIDEs.length; ci++) {
                    if (selectedIDEs[ci].type === "codeblocks") codeBlocksInstalled = true;
                    if (selectedIDEs[ci].type === "devcpp") devCppInstalled = true;
                  }
                }

                completeCallback(result.success, "\u6210\u529f " + result.successCount + " \u4e2a, \u5931\u8d25 " + result.failCount + " \u4e2a", codeBlocksInstalled && result.success, devCppInstalled && result.success);
              } catch (e) {
                log("\u89e3\u6790\u7ed3\u679c\u5931\u8d25: " + e.message, "error");
                log("\u539f\u59cb\u5185\u5bb9: " + resultContent.substring(0, 200), "info");
                completeCallback(false, "\u89e3\u6790\u7ed3\u679c\u5931\u8d25", false, false);
              }
            } else {
              completeCallback(false, "\u65e0\u6cd5\u8bfb\u53d6\u6267\u884c\u7ed3\u679c", false, false);
            }

            try { fso.DeleteFile(resultFile, true); } catch (e) { }
            try { fso.DeleteFile(scriptFile, true); } catch (e) { }
          }, 500);
        }
      } catch (e) { }
    }, 1000);
  }

  /**
   * 导出安装/卸载脚本到桌面
   */
  function exportScript(selectedIDEs, customLibsPath, mode) {
    EgeUtils.setLogFunc(function (msg, type) {
      if (typeof window.log === "function") {
        window.log(msg, type);
      }
    });

    var egeLibsPath = customLibsPath || EgeUtils.getEgeLibsPath();
    var isInstall = (mode !== "uninstall");

    for (var v = 0; v < selectedIDEs.length; v++) {
      if (selectedIDEs[v].type === "vs") {
        selectedIDEs[v] = Installer.resolveVSPaths(selectedIDEs[v]);
      }
    }

    var scriptContent = generateScript(selectedIDEs, egeLibsPath, mode);

    var desktop = shell.SpecialFolders("Desktop");
    var fileName = "ege-" + mode + ".ps1";
    var savePath = desktop + "\\" + fileName;

    var counter = 1;
    while (fso.FileExists(savePath)) {
      fileName = "ege-" + mode + "-" + counter + ".ps1";
      savePath = desktop + "\\" + fileName;
      counter++;
    }

    if (EgeUtils.writeUtf8File(savePath, scriptContent)) {
      log("", "");
      log("\u2713 \u811a\u672c\u5df2\u4fdd\u5b58\u5230\u684c\u9762: " + fileName, "success");
      log("", "");
      log("\u4f7f\u7528\u65b9\u6cd5\uff1a", "info");
      log("  1. \u53f3\u952e\u70b9\u51fb\u684c\u9762\u4e0a\u7684 " + fileName, "info");
      log("  2. \u9009\u62e9\u300c\u4f7f\u7528 PowerShell \u8fd0\u884c\u300d\u6216\u300c\u4ee5\u7ba1\u7406\u5458\u8eab\u4efd\u8fd0\u884c\u300d", "info");
      log("  3. \u5728 UAC \u5f39\u7a97\u4e2d\u70b9\u51fb\u300c\u662f\u300d", "info");
      log("", "");
      log("\u63d0\u793a\uff1a\u60a8\u53ef\u4ee5\u5148\u7528\u6587\u672c\u7f16\u8f91\u5668\u6253\u5f00\u811a\u672c\u67e5\u770b\u5185\u5bb9\uff0c\u786e\u8ba4\u5b89\u5168\u540e\u518d\u6267\u884c", "info");

      alert("\u811a\u672c\u5df2\u4fdd\u5b58\u5230\u684c\u9762:\n\n" + savePath + "\n\n\u60a8\u53ef\u4ee5\u5148\u7528\u6587\u672c\u7f16\u8f91\u5668\u6253\u5f00\u67e5\u770b\u5185\u5bb9\uff0c\u786e\u8ba4\u5b89\u5168\u540e\u53f3\u952e\u4ee5\u7ba1\u7406\u5458\u8eab\u4efd\u8fd0\u884c\u3002");
      return true;
    } else {
      log("\u4fdd\u5b58\u811a\u672c\u5931\u8d25", "error");
      alert("\u4fdd\u5b58\u811a\u672c\u5931\u8d25");
      return false;
    }
  }

  // 公开 API
  return {
    generateScript: generateScript,
    executeViaElevatedScript: executeViaElevatedScript,
    continueWithScriptExecution: continueWithScriptExecution,
    exportScript: exportScript
  };
})();
