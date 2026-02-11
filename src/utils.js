/**
 * EGE Installer - 共享工具模块
 * 提供 COM 对象、文件操作、路径工具、日志等基础设施
 */

var EgeUtils = (function () {
  var shell = new ActiveXObject("WScript.Shell");
  var fso = new ActiveXObject("Scripting.FileSystemObject");

  // 日志回调（由 UI 层设置）
  var logFunc = function () { };

  function log(msg, type) {
    logFunc(msg, type);
  }

  function setLogFunc(fn) {
    logFunc = fn;
  }

  // Dry-run 模式标志
  var _dryRunMode = false;

  function setDryRunMode(enabled) {
    _dryRunMode = !!enabled;
    return _dryRunMode;
  }

  function isDryRunMode() {
    return _dryRunMode;
  }

  // ---- 路径工具 ----

  function getScriptDir() {
    try {
      var path = location.pathname;
      path = decodeURIComponent(path);
      if (path.charAt(0) === "/") {
        path = path.substr(1);
      }
      path = path.replace(/\//g, "\\");
      var dir = fso.GetParentFolderName(path);
      return dir || ".";
    } catch (e) {
      return ".";
    }
  }

  function getEgeLibsPath() {
    var scriptDir = getScriptDir();
    var parentDir = fso.GetParentFolderName(scriptDir);
    var grandParentDir = fso.GetParentFolderName(parentDir);

    var candidatePaths = [
      grandParentDir + "\\xege_libs",
      parentDir + "\\libs",
      grandParentDir + "\\xege-libs",
      scriptDir + "\\..\\libs"
    ];

    for (var i = 0; i < candidatePaths.length; i++) {
      var path = candidatePaths[i];
      try {
        path = fso.GetAbsolutePathName(path);
        if (fso.FolderExists(path) && fso.FolderExists(path + "\\include")) {
          return path;
        }
      } catch (e) { }
    }

    return grandParentDir + "\\xege_libs";
  }

  function getTemplatePath(ideType) {
    var scriptDir = getScriptDir();
    var parentDir = fso.GetParentFolderName(scriptDir);
    return parentDir + "\\assets\\templates\\" + ideType;
  }

  function getDocsPath() {
    var scriptDir = getScriptDir();
    var parentDir = fso.GetParentFolderName(scriptDir);
    return parentDir + "\\assets\\docs";
  }

  // ---- 文件操作 ----

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

  function copyFile(src, dest, overwrite) {
    try {
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

  /**
   * 使用 ADODB.Stream 写入 UTF-8 BOM 文件（适合 PowerShell 脚本等需要 UTF-8 的场景）
   */
  function writeUtf8File(filePath, content) {
    try {
      var stream = new ActiveXObject("ADODB.Stream");
      stream.Type = 2; // adTypeText
      stream.Charset = "utf-8";
      stream.Open();
      stream.WriteText(content);
      stream.SaveToFile(filePath, 2); // adSaveCreateOverWrite
      stream.Close();
      return true;
    } catch (e) {
      log("写入 UTF-8 文件失败: " + filePath + " (" + e.message + ")", "error");
      return false;
    }
  }

  // ---- 验证工具 ----

  function isValidInstallPath(path) {
    if (!path || path === "") return false;
    if (path.match(/^[A-Za-z]:\\?$/) || path === "\\" || path === "/") return false;
    if (path.length < 4) return false;
    return true;
  }

  function isValidLibraryFile(fileName) {
    var lowerName = fileName.toLowerCase();
    var ext = lowerName.substring(lowerName.lastIndexOf('.'));
    if (ext === '.txt' || ext === '.md' || ext === '.pdf' || ext === '.doc') return false;
    var validExtensions = ['.lib', '.a', '.dll', '.so', '.dylib'];
    for (var i = 0; i < validExtensions.length; i++) {
      if (ext === validExtensions[i]) return true;
    }
    return false;
  }

  // 公开 API
  return {
    shell: shell,
    fso: fso,
    log: log,
    setLogFunc: setLogFunc,
    setDryRunMode: setDryRunMode,
    isDryRunMode: isDryRunMode,
    getScriptDir: getScriptDir,
    getEgeLibsPath: getEgeLibsPath,
    getTemplatePath: getTemplatePath,
    getDocsPath: getDocsPath,
    createFolder: createFolder,
    copyFile: copyFile,
    copyFolder: copyFolder,
    getFiles: getFiles,
    getSubFolders: getSubFolders,
    readTextFile: readTextFile,
    writeTextFile: writeTextFile,
    writeUtf8File: writeUtf8File,
    isValidInstallPath: isValidInstallPath,
    isValidLibraryFile: isValidLibraryFile
  };
})();
