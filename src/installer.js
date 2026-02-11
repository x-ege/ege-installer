/**
 * EGE Installer - 核心安装/卸载模块
 * 负责头文件/库文件的安装、IDE 安装编排、卸载操作
 *
 * 依赖: utils.js (EgeUtils), templates.js (Templates)
 */

var Installer = (function () {
  var fso = EgeUtils.fso;
  var log = EgeUtils.log;

  // IDE 类型到库目录的映射
  var libDirMapping = {
    "vs": function () {
      return { "x86": "msvc", "x64": "msvc" };
    },
    "vs-legacy": function (ide) {
      log("  警告: " + ide.name + " 已不被支持，请升级到 VS2017+", "warning");
      return { "x86": "msvc", "x64": "msvc" };
    },
    "mingw": function (ide) {
      if (ide.name.indexOf("64") >= 0) {
        return { "x64": "mingw64" };
      } else {
        return { "x86": "mingw32" };
      }
    },
    "redpanda": function () {
      return { "default": "redpanda" };
    },
    "devcpp": function () {
      return { "default": "devcpp" };
    },
    "codeblocks": function () {
      return { "default": "codeblocks" };
    },
    "clion": function () {
      return { "default": "redpanda" };
    }
  };

  /**
   * 获取 IDE 对应的库目录映射（供 Elevate 模块使用）
   */
  function getLibDirMapping(ide) {
    var mapping = libDirMapping[ide.type];
    return mapping ? mapping(ide) : null;
  }

  /**
   * 安装头文件到指定 IDE
   */
  function installHeaders(ide, egeLibsPath) {
    var srcInclude = egeLibsPath + "\\include";
    var destInclude = ide.includePath;

    if (!EgeUtils.isValidInstallPath(destInclude)) {
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
    var isDryRun = EgeUtils.isDryRunMode();

    // 复制主头文件
    var headerFiles = ["ege.h", "graphics.h"];
    for (var i = 0; i < headerFiles.length; i++) {
      var src = srcInclude + "\\" + headerFiles[i];
      var dest = destInclude + "\\" + headerFiles[i];
      if (fso.FileExists(src)) {
        if (isDryRun) {
          log("  [DRY-RUN] 将复制: " + src + " -> " + dest, "info");
        } else if (EgeUtils.copyFile(src, dest)) {
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
      if (isDryRun) {
        log("  [DRY-RUN] 将复制目录: " + egeSubDir + " -> " + destEgeDir, "info");
      } else if (EgeUtils.copyFolder(egeSubDir, destEgeDir)) {
        log("  复制: " + egeSubDir + " -> " + destEgeDir, "success");
      } else {
        hasError = true;
      }
    }

    return !hasError;
  }

  /**
   * 安装库文件到指定 IDE
   */
  function installLibs(ide, egeLibsPath) {
    var srcLib = egeLibsPath + "\\lib";
    var isDryRun = EgeUtils.isDryRunMode();

    log("安装库文件...", "info");

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

      log("  使用库目录: " + srcLibDir + " (" + libDirs[arch] + "/" + arch + ")", "info");

      if (!fso.FolderExists(srcLibDir)) {
        log("  库目录不存在: " + srcLibDir, "error");
        hasError = true;
        continue;
      }

      var destLibDir = ide.libPath;

      if (!EgeUtils.isValidInstallPath(destLibDir)) {
        log("  错误: 库文件目标路径无效或为空: [" + (destLibDir || "(空)") + "]", "error");
        hasError = true;
        continue;
      }

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

      var libFiles = EgeUtils.getFiles(srcLibDir);
      if (libFiles.length === 0) {
        log("  库目录为空: " + srcLibDir, "error");
        hasError = true;
        continue;
      }

      for (var i = 0; i < libFiles.length; i++) {
        var fileName = fso.GetFileName(libFiles[i]);

        if (!EgeUtils.isValidLibraryFile(fileName)) {
          log("  跳过非库文件: " + fileName, "info");
          skippedCount++;
          continue;
        }

        foundAnyLib = true;
        var dest = destLibDir + "\\" + fileName;
        if (isDryRun) {
          log("  [DRY-RUN] 将复制: " + libFiles[i] + " -> " + dest, "info");
          installedCount++;
        } else if (EgeUtils.copyFile(libFiles[i], dest)) {
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

    return !hasError;
  }

  /**
   * 安装 EGE 到指定 IDE（编排头文件、库文件、模板安装）
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

    // Code::Blocks 特殊处理：如果没有自带 MinGW，跳过头文件/库文件
    var skipLibInstall = (ide.type === "codeblocks" && (!ide.includePath || !ide.libPath));

    if (skipLibInstall) {
      log("", "");
      log("⚠ 检测到 Code::Blocks 未自带 MinGW 编译器", "warning");
      log("  将只安装项目模板，头文件和库文件需要安装到您实际使用的编译器目录", "warning");
      log("  如果您使用 MSYS2/MinGW-w64，请同时选择安装到对应的 MinGW 条目", "info");
      log("", "");
      headersSkipped = true;
    } else {
      progressCallback(baseProgress + stepProgress * 0.3, "正在安装头文件到 " + ide.name + "...");
      if (!installHeaders(ide, egeLibsPath)) {
        log("❌ 头文件安装失败", "error");
        headersSuccess = false;
      } else {
        log("✓ 头文件安装成功", "success");
      }

      progressCallback(baseProgress + stepProgress * 0.7, "正在安装库文件到 " + ide.name + "...");
      if (!installLibs(ide, egeLibsPath)) {
        log("❌ 库文件安装失败", "error");
        libsSuccess = false;
      } else {
        log("✓ 库文件安装成功", "success");
      }
    }

    // CodeBlocks 项目模板
    if (ide.type === "codeblocks") {
      progressCallback(baseProgress + stepProgress * 0.9, "正在安装项目模板...");
      if (!Templates.installCodeBlocksTemplate(ide)) {
        log("⚠ 项目模板安装失败（不影响库文件安装）", "warning");
        templateSuccess = false;
      } else {
        log("✓ 项目模板安装成功", "success");
        if (headersSuccess && libsSuccess && !headersSkipped) {
          Templates.showCodeBlocksUsageGuide(ide);
        }
      }
    }

    // Dev-C++ 项目模板
    if (ide.type === "devcpp") {
      progressCallback(baseProgress + stepProgress * 0.9, "正在安装项目模板...");
      var devCppTemplateResult = Templates.installDevCppTemplate(ide);
      if (devCppTemplateResult === "skipped") {
        log("⚠ 项目模板源文件缺失，跳过模板安装", "warning");
        ide.templateInstalled = false;
      } else if (!devCppTemplateResult) {
        log("⚠ 项目模板安装失败（不影响库文件安装）", "warning");
        templateSuccess = false;
        ide.templateInstalled = false;
      } else {
        log("✓ 项目模板安装成功", "success");
        ide.templateInstalled = true;
        if (headersSuccess && libsSuccess) {
          Templates.showDevCppUsageGuide();
        }
      }
    }

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
   */
  function resolveVSPaths(ide) {
    if (ide.msvcPath) return ide;
    if (ide.type !== "vs") return ide;

    var msvcPath = ide.path + "\\VC\\Tools\\MSVC";
    if (fso.FolderExists(msvcPath)) {
      var versions = EgeUtils.getSubFolders(msvcPath);
      if (versions.length > 0) {
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
    EgeUtils.setLogFunc(function (msg, type) {
      if (typeof window.log === "function") {
        window.log(msg, type);
      }
    });

    var egeLibsPath = customLibsPath || EgeUtils.getEgeLibsPath();
    log("EGE 库路径: " + egeLibsPath, "info");

    if (!fso.FolderExists(egeLibsPath)) {
      log("找不到 EGE 库文件目录!", "error");
      log("请确保 xege_libs 目录位于正确位置", "error");
      completeCallback(false, "找不到 EGE 库文件目录: " + egeLibsPath, false, false);
      return;
    }

    var totalCount = selectedIDEs.length;
    var successCount = 0;
    var failCount = 0;
    var codeBlocksInstalled = false;
    var devCppTemplateInstalled = false;

    for (var i = 0; i < selectedIDEs.length; i++) {
      var ide = selectedIDEs[i];

      if (ide.type === "vs") {
        ide = resolveVSPaths(ide);
      }

      try {
        if (installToIDE(ide, egeLibsPath, progressCallback, i, totalCount)) {
          successCount++;
          if (ide.type === "codeblocks") codeBlocksInstalled = true;
          if (ide.type === "devcpp" && ide.templateInstalled === true) devCppTemplateInstalled = true;
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
      completeCallback(true, "成功安装到 " + successCount + " 个 IDE", codeBlocksInstalled, devCppTemplateInstalled);
    } else if (successCount > 0 && failCount > 0) {
      log("⚠ 部分IDE安装成功，" + failCount + " 个失败，请检查上方日志", "error");
      completeCallback(false, "" + successCount + " 个成功，" + failCount + " 个失败", codeBlocksInstalled, devCppTemplateInstalled);
    } else {
      log("❌ 所有安装均失败，请检查日志并重试", "error");
      completeCallback(false, "所有安装均失败，请检查日志", false, false);
    }
  }

  /**
   * 主卸载函数
   */
  function uninstall(selectedIDEs, progressCallback, completeCallback) {
    EgeUtils.setLogFunc(function (msg, type) {
      if (typeof window.log === "function") {
        window.log(msg, type);
      }
    });

    log("=== 开始卸载 EGE ===", "info");
    log("", "");

    var totalCount = selectedIDEs.length;
    var successCount = 0;
    var failCount = 0;

    for (var i = 0; i < selectedIDEs.length; i++) {
      var ide = selectedIDEs[i];

      log("", "");
      log("=== 从 " + ide.name + " 卸载 ===", "info");

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

        var egeSubDir = ide.includePath + "\\ege";
        if (fso.FolderExists(egeSubDir)) {
          fso.DeleteFolder(egeSubDir, true);
          log("  删除目录: " + egeSubDir, "success");
        }

        var mapping = libDirMapping[ide.type];
        if (mapping) {
          var libDirs = mapping(ide);
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

        // CodeBlocks 模板卸载
        if (ide.type === "codeblocks") {
          Templates.uninstallCodeBlocksTemplate(ide);
        }

        // Dev-C++ 模板卸载
        if (ide.type === "devcpp") {
          Templates.uninstallDevCppTemplate(ide);
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
    resolveVSPaths: resolveVSPaths,
    getLibDirMapping: getLibDirMapping
  };
})();
