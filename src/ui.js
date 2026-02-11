/**
 * EGE Installer - UI Module
 * 用户界面交互逻辑
 */

// 日志辅助函数（使用 setup.hta 中定义的 writeLog）
function uiLog(message) {
  if (typeof writeLog === 'function') {
    writeLog("[UI] " + message);
  }
}

uiLog("UI 模块加载开始");

/**
 * 窗口 + CSS 联动缩放策略：基于 rem 单位
 *
 * screen.width 返回逻辑分辨率（物理分辨率 ÷ DPI 缩放比）
 * 利用这一特性，用 screen.width/1920 同时缩放窗口大小和 CSS 基准字号
 * 使得在任意分辨率 × DPI 组合下，UI 布局始终保持等比
 *
 * CSS 使用 rem 单位，1rem = html font-size（默认 14px）
 * JS 动态设置 html font-size = 14px × scaleFactor
 *
 * 示例（scaleFactor = max(0.75, screen.width / 1920)）：
 * - 1080p@100% (sw=1920): scale=1.0, font=14px, win=860×720
 * - 1080p@125% (sw=1536): scale=0.8, font=11px, win=688×576
 * - 1080p@150% (sw=1280): scale=0.75, font=11px, win=645×540
 * - 2K@100%   (sw=2560): scale=1.33, font=19px, win=1147×960
 * - 4K@150%   (sw=2560): scale=1.33, font=19px, win=1147×960
 * - 4K@200%   (sw=1920): scale=1.0, font=14px, win=860×720
 */
uiLog("开始窗口初始化...");
try {
  uiLog("屏幕尺寸: " + screen.width + "x" + screen.height);

  var baseWidth = 860;
  var baseHeight = 720;

  // 根据逻辑分辨率计算缩放因子（最低 0.75，防止极小屏幕下 UI 不可用）
  var scaleFactor = Math.max(0.75, screen.width / 1920);

  // 设置 rem 基准字号：CSS 全部使用 rem 单位，随此值等比缩放
  var rootFontSize = Math.max(10, Math.round(14 * scaleFactor));
  document.documentElement.style.fontSize = rootFontSize + 'px';
  uiLog("Root font-size: " + rootFontSize + "px (scaleFactor=" + scaleFactor.toFixed(3) + ")");

  // 窗口逻辑尺寸 = 基准 × 缩放因子
  var initWidth = Math.round(baseWidth * scaleFactor);
  var initHeight = Math.round(baseHeight * scaleFactor);

  // 确保不超过屏幕 95%
  if (initWidth > screen.availWidth * 0.95) {
    initWidth = Math.round(screen.availWidth * 0.9);
  }
  if (initHeight > screen.availHeight * 0.95) {
    initHeight = Math.round(screen.availHeight * 0.9);
  }

  uiLog("窗口尺寸: " + initWidth + "x" + initHeight);
  window.resizeTo(initWidth, initHeight);
  window.moveTo(Math.round((screen.width - initWidth) / 2), Math.round((screen.height - initHeight) / 2));
  uiLog("窗口初始化完成");

  // 支持 resize 但限制最小尺寸 (Windows 7 兼容版本)
  var minWidth = initWidth / 2;
  var minHeight = initHeight / 2;
  var resizeTimer = null;

  // Windows 7 兼容：使用 window.onresize 而不是 document.body.onresize
  window.onresize = function () {
    // 使用 setTimeout 避免频繁触发
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(function () {
      try {
        // Windows 7 兼容：使用 document.body.clientWidth/Height
        var currentWidth = document.body.clientWidth;
        var currentHeight = document.body.clientHeight;

        // 如果窗口小于最小尺寸，调整回最小尺寸
        if (currentWidth < minWidth || currentHeight < minHeight) {
          var newWidth = currentWidth < minWidth ? minWidth : currentWidth;
          var newHeight = currentHeight < minHeight ? minHeight : currentHeight;
          window.resizeTo(newWidth, newHeight);
        }
      } catch (e) {
        uiLog("resize error: " + e.message);
      }
    }, 50);
  };

} catch (e) {
  uiLog("ERROR in window setup: " + e.message);
  // 尝试使用默认尺寸
  try {
    window.resizeTo(860, 720);
    window.moveTo((screen.width - 860) / 2, (screen.height - 720) / 2);
  } catch (e2) {
    uiLog("ERROR in fallback resize: " + e2.message);
  }
}

// 检查脚本加载
uiLog("检查模块加载...");
if (typeof Detector === 'undefined' || typeof Installer === 'undefined') {
  uiLog("ERROR: 模块未加载");
  document.getElementById('ideList').innerHTML =
    '<div class="empty-message"><p style="color:#dc2626;">加载错误：无法加载检测或安装模块</p></div>';
} else {
  uiLog("模块加载成功");
  // 设置 dry-run 模式（如果在 setup.hta 中检测到标志）
  if (typeof dryRunMode !== 'undefined' && dryRunMode) {
    uiLog("设置 dry-run 模式");
    EgeUtils.setDryRunMode(true);
  }
  // No-Admin 模式提示（自动检测到非管理员权限时）
  if (typeof noAdminMode !== 'undefined' && noAdminMode) {
    uiLog("非管理员权限，安装/卸载将通过 UAC 提权执行");
    var introEl = document.querySelector('.intro');
    if (introEl) {
      introEl.innerHTML += '<p style="color:#2563eb; margin-top:0.5rem;">🔒 当前以普通用户运行，安装/卸载时将弹出 UAC 权限确认窗口。您也可以选择「导出脚本」自行检查后手动执行。</p>';
    }
  }
  // 立即启动检测（不延迟，让用户尽快看到进度）
  uiLog("启动 IDE 检测...");
  detectAllIDEs();
}

/**
 * 检测日志
 */
function detectionLog(message, type) {
  var logEl = document.getElementById('detectionLog');
  if (logEl) {
    var className = type ? 'log-line ' + type : 'log-line';
    logEl.innerHTML += '<div class="' + className + '">' + message + '</div>';
    logEl.scrollTop = logEl.scrollHeight;
  }
}

/**
 * 更新检测进度
 */
function updateDetectionProgress(percent, message) {
  var progressBar = document.getElementById('detectionProgressBar');
  var statusEl = document.getElementById('detectionStatus');
  if (progressBar) {
    progressBar.style.width = percent + '%';
  }
  if (statusEl && message) {
    statusEl.innerText = message;
  }
}

/**
 * 异步检测所有IDE（拆分任务避免界面卡死）
 */
function detectAllIDEs() {
  var allIDEs = [];
  var detectionSteps = [
    {
      name: 'MinGW',
      func: function () { return Detector.detectMinGW(); }
    },
    {
      name: 'Red Panda',
      func: function () { return Detector.detectRedPanda ? Detector.detectRedPanda() : []; }
    },
    {
      name: 'Dev-C++',
      func: function () { return Detector.detectDevCpp ? Detector.detectDevCpp() : []; }
    },
    {
      name: 'Code::Blocks',
      func: function () { return Detector.detectCodeBlocks ? Detector.detectCodeBlocks() : []; }
    },
    {
      name: 'CLion',
      func: function () { return Detector.detectCLion ? Detector.detectCLion() : []; }
    },
    {
      name: 'Visual Studio',
      func: function () { return Detector.detectVS ? Detector.detectVS() : []; }
    }
  ];

  var currentStep = 0;
  var totalSteps = detectionSteps.length;

  function runNextStep() {
    if (currentStep >= totalSteps) {
      // 所有检测完成，处理结果
      finishDetection(allIDEs);
      return;
    }

    var step = detectionSteps[currentStep];
    var progress = (currentStep / totalSteps) * 100;

    // 先更新 UI
    updateDetectionProgress(progress, '正在检测 ' + step.name + '...');
    detectionLog('检测 ' + step.name + '...', 'info');

    // 使用两层 setTimeout 确保 UI 先渲染再执行检测
    window.setTimeout(function () {
      window.setTimeout(function () {
        try {
          var results = step.func();
          if (results && results.length > 0) {
            var foundCount = 0;
            for (var i = 0; i < results.length; i++) {
              allIDEs.push(results[i]);
              if (results[i].found) foundCount++;
            }
            detectionLog('  找到 ' + foundCount + ' 个 ' + step.name, foundCount > 0 ? 'success' : '');
          } else {
            detectionLog('  未找到 ' + step.name, '');
          }
        } catch (e) {
          detectionLog('  检测 ' + step.name + ' 出错: ' + e.message, 'error');
        }

        currentStep++;
        // 继续下一步
        window.setTimeout(runNextStep, 100);
      }, 100);
    }, 50);
  }

  // 开始检测 - 立即显示日志，然后异步开始
  detectionLog('开始检测已安装的开发环境...', 'info');
  updateDetectionProgress(0, '准备开始检测...');

  // 使用 setTimeout 让初始日志先渲染
  window.setTimeout(function () {
    runNextStep();
  }, 50);
}

/**
 * 获取 IDE/编译器的官网下载页面（尽量使用稳定的落地页）
 * @param {object} ide
 * @returns {string} url
 */
function getOfficialDownloadUrl(ide) {
  if (!ide) return '';

  var type = (ide.type || '').toLowerCase();
  var name = (ide.name || '').toLowerCase();

  if (type === 'codeblocks') {
    return 'https://www.codeblocks.org/downloads/binaries/';
  }
  if (type === 'devcpp') {
    // 两种 Dev-C++：Embarcadero 官方版 vs Orwell/旧版（SourceForge）
    if (name.indexOf('embarcadero') >= 0) {
      return 'https://www.embarcadero.com/free-tools/dev-cpp';
    }
    return 'https://sourceforge.net/projects/orwelldevcpp/';
  }
  if (type === 'redpanda') {
    // Red Panda C++ 官方下载页（作者站点，包含镜像）
    return 'http://royqh.net/redpandacpp/download/';
  }
  if (type === 'vs' || type === 'vs-legacy') {
    // Visual Studio / MSVC 下载中心
    return 'https://visualstudio.microsoft.com/zh-hans/downloads/';
  }
  if (type === 'clion') {
    return 'https://www.jetbrains.com/clion/download/';
  }
  if (type === 'mingw') {
    // 对 MinGW 家族给一个相对“官方”的入口：MSYS2
    //（MinGW-w64 项目本身不提供统一安装包，MSYS2 是最常用的发行方式）
    if (name.indexOf('msys2') >= 0) {
      return 'https://www.msys2.org/';
    }
    return 'https://www.msys2.org/';
  }

  return '';
}

/**
 * 打开官网下载页
 */
function openOfficialDownloadPage(index, isFound) {
  var ide = isFound ? detectedIDEs[index] : notFoundIDEs[index];
  if (!ide) return;

  var url = getOfficialDownloadUrl(ide);
  if (!url) return;

  try {
    openUrl(url);
  } catch (e) {
    alert('无法打开链接：' + e.message + '\n\n请手动访问：\n' + url);
  }
}

/**
 * 完成检测，处理结果
 */
function finishDetection(allIDEs) {
  updateDetectionProgress(100, '检测完成');
  detectionLog('检测完成，正在整理结果...', 'success');

  // 如果完全没有检测到任何 VS/MSVC 记录，则追加一个“未检测到 MSVC”的占位项
  // 目的：给用户一个明确入口可直达官网下载页面
  var hasAnyMsvcRecord = false;
  for (var t = 0; t < allIDEs.length; t++) {
    var item = allIDEs[t];
    if (!item) continue;
    if (item.type === 'vs' || item.type === 'vs-legacy') {
      hasAnyMsvcRecord = true;
      break;
    }
  }
  if (!hasAnyMsvcRecord) {
    allIDEs.push({
      name: 'Microsoft Visual Studio (MSVC)',
      path: '未安装',
      type: 'vs',
      found: false,
      supported: true,
      includePath: '',
      libPath: '',
      isPlaceholder: true
    });
    // 自动展开“未检测到的环境”，避免用户错过下载入口
    notFoundExpanded = true;
  }

  // 分离已检测到和未检测到的
  detectedIDEs = [];
  notFoundIDEs = [];

  for (var i = 0; i < allIDEs.length; i++) {
    var ide = allIDEs[i];
    // 检查是否已安装EGE
    ide.egeInstalled = checkEgeInstalled(ide);

    if (ide.found) {
      detectedIDEs.push(ide);
    } else {
      notFoundIDEs.push(ide);
    }
  }

  // 去重：移除父子目录关系的重复项
  detectedIDEs = deduplicateIDEs(detectedIDEs);

  detectionLog('找到 ' + detectedIDEs.length + ' 个已安装的开发环境', detectedIDEs.length > 0 ? 'success' : '');

  // 延迟一点再渲染，让用户看到完成消息
  window.setTimeout(function () {
    renderIDEList();
  }, 300);
}

/**
 * 去除IDE列表中的重复项（主要是父子目录关系）
 * 策略：保留更具体的路径（子目录），移除模糊的路径（父目录）
 */
function deduplicateIDEs(ides) {
  if (ides.length <= 1) return ides;

  // 首先规范化所有路径（移除尾部反斜杠，统一大小写）
  for (var n = 0; n < ides.length; n++) {
    if (ides[n].path) {
      ides[n].path = ides[n].path.replace(/\\+$/, ''); // 移除尾部的反斜杠
    }
  }

  var toRemove = [];

  // 标记需要移除的项
  for (var i = 0; i < ides.length; i++) {
    var ide1 = ides[i];
    var path1 = ide1.path.toLowerCase();

    for (var j = 0; j < ides.length; j++) {
      if (i === j) continue;

      var ide2 = ides[j];
      var path2 = ide2.path.toLowerCase();

      // 如果 path1 是 path2 的父目录，标记移除 path1（保留更具体的子目录）
      if (path2.indexOf(path1 + '\\') === 0) {
        if (toRemove.indexOf(i) === -1) {
          toRemove.push(i);
        }
      }
    }
  }

  // 移除标记的项
  var deduplicated = [];
  for (var k = 0; k < ides.length; k++) {
    if (toRemove.indexOf(k) === -1) {
      deduplicated.push(ides[k]);
    }
  }

  return deduplicated;
}

/**
 * 检查IDE是否已安装EGE
 * 对于 MinGW 系列 IDE，除检查 <prefix>/include 外，
 * 还会扫描 GCC sysroot 路径 <prefix>/<target-triple>/include/
 * （Red Panda 等发行版将 EGE 内置于 sysroot 中）
 */
function checkEgeInstalled(ide) {
  if (!ide.found) return false;

  // Code::Blocks 特殊处理：如果没有自带 MinGW，则检查模板/wizard 是否已安装
  if (ide.type === 'codeblocks' && !ide.includePath) {
    return !!(ide.templateInstalled || ide.wizardInstalled);
  }

  if (!ide.includePath) return false;
  try {
    // 标准检查：includePath 下的 graphics.h
    if (fso.FileExists(ide.includePath + '\\graphics.h')) return true;

    // 对 MinGW 系列 IDE，额外检查 GCC sysroot 路径
    // 目录结构示例：mingw64/x86_64-w64-mingw32/include/graphics.h
    var mingwTypes = { 'redpanda': 1, 'mingw': 1, 'devcpp': 1, 'clion': 1 };
    if (mingwTypes[ide.type]) {
      var mingwRoot = fso.GetParentFolderName(ide.includePath);
      if (mingwRoot && fso.FolderExists(mingwRoot)) {
        var subDirs = new Enumerator(fso.GetFolder(mingwRoot).SubFolders);
        for (; !subDirs.atEnd(); subDirs.moveNext()) {
          var sysrootInclude = subDirs.item().Path + '\\include';
          if (fso.FolderExists(sysrootInclude) &&
            fso.FileExists(sysrootInclude + '\\graphics.h')) {
            return true;
          }
        }
      }
    }

    return false;
  } catch (e) {
    return false;
  }
}

/**
 * 渲染IDE列表
 */
function renderIDEList() {
  var listEl = document.getElementById('ideList');

  if (detectedIDEs.length === 0) {
    listEl.innerHTML = '<div class="empty-message">' +
      '<p>未检测到任何已安装的开发环境</p>' +
      '<p style="font-size:0.857rem;">请先安装 Visual Studio、MinGW 或 Red Panda C++ 等开发工具</p></div>';
  } else {
    var html = '';
    for (var i = 0; i < detectedIDEs.length; i++) {
      html += renderIDEItem(detectedIDEs[i], i, true);
    }
    listEl.innerHTML = html;
  }

  // 渲染未检测到的
  if (notFoundIDEs.length > 0) {
    document.getElementById('notFoundSection').className = 'toggle-section';
    var notFoundHtml = '';
    for (var j = 0; j < notFoundIDEs.length; j++) {
      notFoundHtml += renderIDEItem(notFoundIDEs[j], j, false);
    }
    document.getElementById('notFoundList').innerHTML = notFoundHtml;

    // 根据 notFoundExpanded 同步 UI 状态
    var btn = document.getElementById('notFoundSection').getElementsByTagName('button')[0];
    var list = document.getElementById('notFoundList');
    if (notFoundExpanded) {
      btn.innerText = '▼ 隐藏未检测到的环境';
      list.style.display = 'block';
    } else {
      btn.innerText = '▶ 显示未检测到的环境';
      list.style.display = 'none';
    }
  }

  updateStatus();
}

/**
 * 渲染单个IDE项
 */
function renderIDEItem(ide, index, isFound) {
  var statusClass, statusText;
  var prefix = isFound ? 'found' : 'notfound';

  if (!ide.found) {
    statusClass = 'not-found';
    statusText = '未找到';
  } else if (ide.egeInstalled) {
    statusClass = 'installed';
    statusText = '已安装';
  } else {
    statusClass = 'not-installed';
    statusText = '未安装';
  }

  // 检查是否为不支持的 VS 版本
  var isUnsupportedVS = ide.type && (ide.type === 'vs' || ide.type === 'vs-legacy') && ide.supported === false;

  // 检查是否有使用说明（CodeBlocks、Dev-C++、Red Panda、MSVC）
  // 注意：不支持的 VS 版本不显示使用说明，避免误导用户
  var hasUsageGuide = ide.type === 'codeblocks' || ide.type === 'devcpp' || ide.type === 'redpanda' ||
    ((ide.type === 'vs' || ide.type === 'vs-legacy') && ide.supported !== false);

  var html = '<div class="ide-item" id="' + prefix + '_' + index + '">';
  html += '<div class="ide-info">';
  // Code::Blocks 无编译器警告标识
  var cbNoCompiler = ide.type === 'codeblocks' && ide.found && (!ide.includePath || !ide.libPath);
  html += '<div class="ide-name">' + ide.name;
  if (cbNoCompiler) {
    html += '<span class="cb-warning-icon" title="此 Code::Blocks 未自带编译器，将只安装项目模板">无编译器</span>';
  }
  html += '</div>';
  // 对于有 msvcPath 的项（不同工具集），显示完整工具集路径；否则显示 IDE 路径
  var displayPath = ide.msvcPath || ide.path || '未安装';
  html += '<div class="ide-path">' + displayPath + '</div>';
  html += '</div>';

  // 状态显示：未安装时显示状态标签，已安装时不显示
  if (!ide.egeInstalled || !ide.found) {
    html += '<span class="ide-status ' + statusClass + '">' + statusText + '</span>';
  }

  html += '<div class="ide-actions">';

  // 使用说明按钮（CodeBlocks、Dev-C++、Red Panda 始终显示，无论是否安装）
  if (hasUsageGuide) {
    html += '<button class="btn btn-guide" onclick="showUsageGuide(' + index + ', ' + isFound + ')">使用说明</button>';
  }

  if (isUnsupportedVS) {
    // 不支持的 VS 版本：显示 "安装说明" 按钮
    html += '<button class="btn btn-guide" onclick="showUnsupportedVSGuide()">安装说明</button>';
  } else {
    // 支持的版本：显示安装/重新安装和卸载按钮
    var installDisabled = !ide.found ? 'disabled' : '';
    var installBtnText = (ide.egeInstalled && ide.found) ? '重新安装' : '安装';
    var installBtnTitle = (ide.egeInstalled && ide.found) ? '点击可重新安装 EGE 库' : '安装 EGE 库到此开发环境';

    html += '<button class="btn btn-install" onclick="doInstall(' + index + ', ' + isFound + ')" ' + installDisabled + ' title="' + installBtnTitle + '">' + installBtnText + '</button>';

    // 卸载按钮：只在已安装时显示
    if (ide.egeInstalled && ide.found) {
      html += '<button class="btn btn-uninstall" onclick="doUninstall(' + index + ', ' + isFound + ')">卸载</button>';
    }
  }

  // 打开目录按钮（只有找到的IDE才显示）
  if (ide.found && ide.path) {
    html += '<button class="btn btn-open" onclick="openFolder(' + index + ', ' + isFound + ')">打开目录</button>';
  }

  // 官网下载按钮：即使未检测到，也允许跳转（放在最后，显得低调）
  var officialUrl = getOfficialDownloadUrl(ide);
  if (officialUrl) {
    html += '<button class="btn btn-site" onclick="openOfficialDownloadPage(' + index + ', ' + isFound + ')">官网</button>';
  }

  html += '</div>';
  html += '</div>';

  return html;
}

/**
 * 切换显示未检测到的环境
 */
function toggleNotFound() {
  notFoundExpanded = !notFoundExpanded;
  var btn = document.getElementById('notFoundSection').getElementsByTagName('button')[0];
  var list = document.getElementById('notFoundList');

  if (notFoundExpanded) {
    btn.innerText = '▼ 隐藏未检测到的环境';
    list.style.display = 'block';
  } else {
    btn.innerText = '▶ 显示未检测到的环境';
    list.style.display = 'none';
  }
}

/**
 * 检查是否是内置EGE的IDE（仅 Red Panda）
 */
function isBuiltinEgeIDE(ide) {
  var name = ide.name.toLowerCase();
  return name.indexOf('red panda') >= 0 ||
    name.indexOf('redpanda') >= 0;
}

/**
 * 获取内置EGE IDE的提示信息
 */
function getBuiltinEgeWarning(ide, isInstall) {
  var ideName = 'Red Panda C++';
  if (isInstall) {
    return ideName + ' 已内置 EGE 图形库，通常无需手动安装。\n\n' +
      '手动安装会将最新版 EGE 添加到编译器的标准搜索路径，优先于内置版本。\n\n' +
      '确定要继续安装吗？';
  } else {
    return '这将移除您手动安装的 EGE 库文件。\n\n' +
      '卸载后，' + ideName + ' 将恢复使用其内置的 EGE 版本，不会影响正常使用。\n\n' +
      '确定要继续卸载吗？';
  }
}

/**
 * 检查 Code::Blocks 安装前的特殊情况
 * 返回 true 表示可以继续，false 表示用户取消
 */
function checkCodeBlocksInstallWarning(ide) {
  // Code::Blocks 无编译器的特殊处理
  if (ide.type === 'codeblocks' && (!ide.includePath || !ide.libPath)) {
    // 检测是否有可用的 MinGW
    var mingw64Found = false;
    var mingw32Found = false;
    var mingwNames = [];

    for (var i = 0; i < detectedIDEs.length; i++) {
      var item = detectedIDEs[i];
      if (item.type === 'mingw' && item.found) {
        mingwNames.push(item.name);
        if (item.name.toLowerCase().indexOf('mingw64') >= 0) {
          mingw64Found = true;
        } else if (item.name.toLowerCase().indexOf('mingw32') >= 0) {
          mingw32Found = true;
        }
      }
    }

    var msg = '⚠️ Code::Blocks 无编译器检测\n\n';
    msg += '此 Code::Blocks 未自带 MinGW 编译器。\n';
    msg += '本次安装将只能配置项目模板，无法安装 EGE 库文件。\n\n';

    if (mingw64Found || mingw32Found) {
      msg += '✅ 检测到以下编译器：\n';
      for (var j = 0; j < mingwNames.length; j++) {
        msg += '   • ' + mingwNames[j] + '\n';
      }
      msg += '\n📌 强烈建议同时勾选这些编译器进行安装！\n';
      msg += '   （批量安装：按住 Ctrl 点击编译器的"安装"按钮）\n\n';
    } else {
      msg += '❌ 未检测到独立的 MinGW 编译器\n\n';
      msg += '💡 解决方案：\n';
      msg += '   1. 安装 MSYS2 MinGW-w64（推荐）\n';
      msg += '   2. 在 Code::Blocks 中配置外部编译器路径\n';
      msg += '   3. 重新运行本安装程序，选择对应的 MinGW 进行安装\n\n';
    }

    msg += '确定要继续吗？';

    return confirm(msg);
  }
  return true;
}

/**
 * 执行安装
 */
var pendingClionInstall = null;

function doInstall(index, isFound) {
  var ide = isFound ? detectedIDEs[index] : notFoundIDEs[index];
  if (!ide || !ide.found) return;

  // 如果已安装，弹出重新安装确认
  if (ide.egeInstalled) {
    var confirmMsg = '检测到 ' + ide.name + ' 已安装 EGE 库。\n\n';
    confirmMsg += '重新安装将覆盖现有文件，是否继续？';
    if (!confirm(confirmMsg)) {
      return; // 用户取消
    }
  }

  // CLion: 先显示插件推荐弹窗
  if (ide.type === 'clion') {
    pendingClionInstall = { index: index, isFound: isFound };
    showClionPluginModal();
    return;
  }

  proceedWithInstall(index, isFound);
}

/**
 * 继续执行安装（CLion 插件确认后或非 CLion IDE 直接调用）
 */
function proceedWithInstall(index, isFound) {
  var ide = isFound ? detectedIDEs[index] : notFoundIDEs[index];
  if (!ide || !ide.found) return;

  // Code::Blocks 特殊检查
  if (!checkCodeBlocksInstallWarning(ide)) {
    return; // 用户取消
  }

  // 对于内置EGE的IDE，显示额外提示
  if (isBuiltinEgeIDE(ide)) {
    var confirmed = confirm(getBuiltinEgeWarning(ide, true));
    if (!confirmed) return;
  }

  showModal('正在安装到 ' + ide.name + '...');

  // No-Admin 模式：使用提权脚本执行安装
  if (typeof noAdminMode !== 'undefined' && noAdminMode) {
    // 显示导出脚本按钮
    document.getElementById('modalExportBtn').style.display = 'inline-block';
    document.getElementById('modalExportBtn').onclick = function () {
      Elevate.exportScript([ide], libsPath, 'install');
    };

    window.setTimeout(function () {
      try {
        Elevate.executeViaElevatedScript([ide], libsPath, 'install', updateModalProgress, function (success, message, showCodeBlocksGuide, showDevCppGuide) {
          if (success) {
            modalLog('安装完成！', 'success');
            ide.egeInstalled = true;
          } else {
            modalLog('安装失败: ' + message, 'error');
          }

          // 显示使用说明按钮（与正常模式相同的逻辑）
          if (showCodeBlocksGuide && success) {
            document.getElementById('modalGuideBtn').style.display = 'inline-block';
            document.getElementById('modalGuideBtn').onclick = function () { showCodeBlocksGuideModal(); };
          }
          if (showDevCppGuide && success) {
            document.getElementById('modalGuideBtn').style.display = 'inline-block';
            document.getElementById('modalGuideBtn').onclick = function () { showDevCppGuideModal(); };
          }
          var isRedPanda = ide.type === 'redpanda';
          if (isRedPanda && success) {
            document.getElementById('modalGuideBtn').style.display = 'inline-block';
            document.getElementById('modalGuideBtn').onclick = function () { showRedPandaGuideModal(); };
          }
          var isMsvc = ide.type === 'vs' || ide.type === 'vs-legacy';
          if (isMsvc && success) {
            document.getElementById('modalGuideBtn').style.display = 'inline-block';
            document.getElementById('modalGuideBtn').onclick = function () { showMsvcGuideModal(); };
          }

          enableModalClose();
          renderIDEList();
        });
      } catch (e) {
        modalLog('安装出错: ' + e.message, 'error');
        enableModalClose();
      }
    }, 100);
    return;
  }

  // 正常 Admin 模式
  window.setTimeout(function () {
    try {
      Installer.install([ide], updateModalProgress, function (success, message, showCodeBlocksGuide, showDevCppGuide) {
        if (success) {
          modalLog('安装完成！', 'success');
          ide.egeInstalled = true;
        } else {
          modalLog('安装失败: ' + message, 'error');
        }

        // 如果是 CodeBlocks 安装成功，显示"查看使用说明"按钮
        if (showCodeBlocksGuide && success) {
          document.getElementById('modalGuideBtn').style.display = 'inline-block';
          document.getElementById('modalGuideBtn').onclick = function () { showCodeBlocksGuideModal(); };
          modalLog('', '');
          modalLog('💡 提示：可以点击下方的"查看使用说明"按钮查看详细使用指南', 'info');
        }

        // 如果是 Dev-C++ 安装成功，显示"查看使用说明"按钮
        if (showDevCppGuide && success) {
          document.getElementById('modalGuideBtn').style.display = 'inline-block';
          document.getElementById('modalGuideBtn').onclick = function () { showDevCppGuideModal(); };
          modalLog('', '');
          modalLog('💡 提示：可以点击下方的"查看使用说明"按钮查看详细使用指南', 'info');
        }

        // 如果是 Red Panda 安装成功，显示"查看使用说明"按钮
        var isRedPanda = ide.type === 'redpanda';
        if (isRedPanda && success) {
          document.getElementById('modalGuideBtn').style.display = 'inline-block';
          document.getElementById('modalGuideBtn').onclick = function () { showRedPandaGuideModal(); };
          modalLog('', '');
          modalLog('💡 提示：可以点击下方的"查看使用说明"按钮查看详细使用指南', 'info');
        }

        // 如果是 MSVC/Visual Studio 安装成功，显示"查看使用说明"按钮
        var isMsvc = ide.type === 'vs' || ide.type === 'vs-legacy';
        if (isMsvc && success) {
          document.getElementById('modalGuideBtn').style.display = 'inline-block';
          document.getElementById('modalGuideBtn').onclick = function () { showMsvcGuideModal(); };
          modalLog('', '');
          modalLog('💡 提示：可以点击下方的"查看使用说明"按钮查看详细使用指南', 'info');
        }

        enableModalClose();
        renderIDEList();
      }, libsPath);
    } catch (e) {
      modalLog('安装出错: ' + e.message, 'error');
      enableModalClose();
    }
  }, 100);
}

/**
 * 显示 CLion 插件推荐窗口
 */
function showClionPluginModal() {
  document.getElementById('clionPluginModal').className = 'modal-overlay show';
}

/**
 * 关闭 CLion 插件推荐窗口
 */
function closeClionPluginModal() {
  document.getElementById('clionPluginModal').className = 'modal-overlay';
  pendingClionInstall = null;
}

/**
 * 用户确认继续安装 CLion
 */
function confirmClionInstall() {
  document.getElementById('clionPluginModal').className = 'modal-overlay';
  if (pendingClionInstall) {
    var info = pendingClionInstall;
    pendingClionInstall = null;
    proceedWithInstall(info.index, info.isFound);
  }
}

/**
 * 打开 CLion 插件页面
 */
function openClionPluginPage() {
  try {
    openUrl('https://plugins.jetbrains.com/plugin/28785-xege-creator/');
  } catch (e) {
    alert('无法打开浏览器\n\n请手动访问: https://plugins.jetbrains.com/plugin/28785-xege-creator/');
  }
}

/**
 * 执行卸载
 */
function doUninstall(index, isFound) {
  var ide = isFound ? detectedIDEs[index] : notFoundIDEs[index];
  if (!ide || !ide.found || !ide.egeInstalled) return;

  // 对于内置EGE的IDE，显示特殊提示
  if (isBuiltinEgeIDE(ide)) {
    var confirmed = confirm(getBuiltinEgeWarning(ide, false));
    if (!confirmed) return;
  } else {
    var confirmed = confirm('确定要从 ' + ide.name + ' 卸载 EGE 库吗？');
    if (!confirmed) return;
  }

  showModal('正在从 ' + ide.name + ' 卸载...');

  // No-Admin 模式：使用提权脚本执行卸载
  if (typeof noAdminMode !== 'undefined' && noAdminMode) {
    // 显示导出脚本按钮
    document.getElementById('modalExportBtn').style.display = 'inline-block';
    document.getElementById('modalExportBtn').onclick = function () {
      Elevate.exportScript([ide], libsPath, 'uninstall');
    };

    window.setTimeout(function () {
      try {
        Elevate.executeViaElevatedScript([ide], libsPath, 'uninstall', updateModalProgress, function (success, message) {
          if (success) {
            modalLog('卸载完成！', 'success');
            ide.egeInstalled = false;
          } else {
            modalLog('卸载失败: ' + message, 'error');
          }
          enableModalClose();
          renderIDEList();
        });
      } catch (e) {
        modalLog('卸载出错: ' + e.message, 'error');
        enableModalClose();
      }
    }, 100);
    return;
  }

  window.setTimeout(function () {
    try {
      uninstallFromIDE(ide, function (success, message) {
        if (success) {
          modalLog('卸载完成！', 'success');
          ide.egeInstalled = false;
        } else {
          modalLog('卸载失败: ' + message, 'error');
        }
        enableModalClose();
        renderIDEList();
      });
    } catch (e) {
      modalLog('卸载出错: ' + e.message, 'error');
      enableModalClose();
    }
  }, 100);
}

/**
 * 卸载EGE
 */
function uninstallFromIDE(ide, callback) {
  try {
    Installer.uninstall(
      [ide],
      function (progress, message) {
        updateModalProgress(progress, message);
      },
      function (success, message) {
        if (success) {
          modalLog('', '');
          modalLog('========================================', 'success');
          modalLog('  ✓ 卸载成功！', 'success');
          modalLog('========================================', 'success');
          callback(true, message);
        } else {
          callback(false, message);
        }
      }
    );
  } catch (e) {
    modalLog('卸载出错: ' + e.message, 'error');
    callback(false, e.message);
  }
}

/**
 * 显示模态框
 */
function showModal(title) {
  document.getElementById('modalTitle').innerText = title;
  document.getElementById('modalLog').innerHTML = '';
  document.getElementById('modalProgress').style.width = '0%';
  document.getElementById('modalCloseBtn').disabled = true;
  document.getElementById('modalGuideBtn').style.display = 'none'; // 隐藏使用说明按钮
  document.getElementById('modalExportBtn').style.display = 'none'; // 隐藏导出脚本按钮
  document.getElementById('operationModal').className = 'modal-overlay show';
}

/**
 * 关闭模态框
 */
function closeModal() {
  document.getElementById('operationModal').className = 'modal-overlay';
}

/**
 * 显示 CodeBlocks 使用说明窗口
 */
function showCodeBlocksGuideModal() {
  // 显示 CodeBlocks 说明窗口（不关闭安装日志）
  document.getElementById('codeBlocksGuideModal').className = 'modal-overlay show';
}

/**
 * 从安装日志窗口打开使用说明
 */
function openGuideFromModal() {
  showCodeBlocksGuideModal();
}

/**
 *  关闭 CodeBlocks 使用说明窗口
 */
function closeCodeBlocksGuide() {
  document.getElementById('codeBlocksGuideModal').className = 'modal-overlay';
}

/**
 * 打开 Code::Blocks 完整使用文档
 */
function openCodeBlocksFullDocs() {
  try {
    // 跳转到 GitHub 上的文档链接
    shell.Run('https://github.com/x-ege/ege-installer/blob/main/assets/docs/codeblocks-usage.md');
  } catch (e) {
    alert('无法打开浏览器：' + e.message + '\n\n请手动访问：\nhttps://github.com/x-ege/ege-installer/blob/main/assets/docs/codeblocks-usage.md');
  }
}

/**
 * 显示 Dev-C++ 使用说明窗口
 */
function showDevCppGuideModal() {
  document.getElementById('devCppGuideModal').className = 'modal-overlay show';
}

/**
 * 打开 Dev-C++ 完整使用文档
 */
function openDevCppFullDocs() {
  try {
    // 跳转到 GitHub 上的文档链接
    shell.Run('https://github.com/x-ege/ege-installer/blob/main/assets/docs/devcpp-usage.md');
  } catch (e) {
    alert('无法打开浏览器：' + e.message + '\n\n请手动访问：\nhttps://github.com/x-ege/ege-installer/blob/main/assets/docs/devcpp-usage.md');
  }
}

/**
 * 关闭 Dev-C++ 使用说明窗口
 */
function closeDevCppGuide() {
  document.getElementById('devCppGuideModal').className = 'modal-overlay';
}

/**
 * 显示 Red Panda 使用说明窗口
 */
function showRedPandaGuideModal() {
  document.getElementById('redPandaGuideModal').className = 'modal-overlay show';
}

/**
 * 关闭 Red Panda 使用说明窗口
 */
function closeRedPandaGuide() {
  document.getElementById('redPandaGuideModal').className = 'modal-overlay';
}

/**
 * 显示 MSVC/Visual Studio 使用说明窗口
 */
function showMsvcGuideModal() {
  document.getElementById('msvcGuideModal').className = 'modal-overlay show';
}

/**
 * 关闭 MSVC/Visual Studio 使用说明窗口
 */
function closeMsvcGuide() {
  document.getElementById('msvcGuideModal').className = 'modal-overlay';
}

/**
 * 打开 MSVC 完整使用文档
 */
function openMsvcFullDocs() {
  try {
    shell.Run('https://github.com/x-ege/ege-installer/blob/main/assets/docs/msvc-usage.md');
  } catch (e) {
    alert('无法打开浏览器：' + e.message + '\n\n请手动访问：\nhttps://github.com/x-ege/ege-installer/blob/main/assets/docs/msvc-usage.md');
  }
}

/**
 * 显示不支持的 VS 版本安装说明
 */
function showUnsupportedVSGuide() {
  document.getElementById('unsupportedVSGuideModal').className = 'modal-overlay show';
}

/**
 * 关闭不支持的 VS 版本安装说明窗口
 */
function closeUnsupportedVSGuide() {
  document.getElementById('unsupportedVSGuideModal').className = 'modal-overlay';
}

/**
 * 打开 EGE 官网安装页面
 */
function openEgeInstallPage() {
  try {
    shell.Run('https://xege.org/install_and_config');
  } catch (e) {
    alert('无法打开浏览器，请手动访问: https://xege.org/install_and_config');
  }
}

/**
 * 启用模态框关闭按钮
 */
function enableModalClose() {
  document.getElementById('modalCloseBtn').disabled = false;
}

/**
 * 更新模态框进度
 */
function updateModalProgress(percent, message) {
  document.getElementById('modalProgress').style.width = percent + '%';
  if (message) {
    document.getElementById('modalTitle').innerText = message;
  }
}

/**
 * 模态框日志
 */
function modalLog(message, type) {
  var logArea = document.getElementById('modalLog');
  var className = type || '';
  logArea.innerHTML += '<div class="' + className + '">' + message + '</div>';
  logArea.scrollTop = logArea.scrollHeight;
}

/**
 * 全局log函数（供Installer模块使用）
 */
function log(message, type) {
  modalLog(message, type);
}

/**
 * 打开IDE安装目录
 */
function openFolder(index, isFound) {
  var ide = isFound ? detectedIDEs[index] : notFoundIDEs[index];
  if (!ide) return;

  // 优先使用 msvcPath（对于 VS 显示工具集路径），否则使用 path
  var targetPath = ide.msvcPath || ide.path;
  if (!targetPath) return;

  try {
    // 使用 explorer.exe 打开目录
    shell.Run('explorer.exe "' + targetPath + '"');
  } catch (e) {
    alert('无法打开目录: ' + e.message);
  }
}

/**
 * 扫描MinGW - 让用户选择目录并递归查找MinGW安装
 */
function scanForMinGW() {
  try {
    var shellApp = new ActiveXObject("Shell.Application");
    var folder = shellApp.BrowseForFolder(0, "选择要扫描的目录（将递归搜索 MinGW 安装）", 0x0051, "");

    if (!folder) return; // 用户取消

    var folderPath = folder.Self.Path;

    // 显示扫描进度模态框
    showScanModal(folderPath);

    // 使用setTimeout让UI更新
    window.setTimeout(function () {
      var foundMinGWs = [];
      scanDirectoryAsync(folderPath, foundMinGWs, 0, 7, function () {
        // 扫描完成回调
        finishScan(foundMinGWs);
      });
    }, 100);

  } catch (e) {
    alert('扫描出错: ' + e.message);
    updateStatus();
  }
}

/**
 * 显示扫描模态框
 */
function showScanModal(folderPath) {
  // 重置扫描计数器和取消标志
  scanDirCount = 0;
  lastUpdateCount = 0;
  scanCancelled = false;

  showModal('正在扫描 MinGW 安装...');
  modalLog('扫描目录: ' + folderPath, 'info');
  modalLog('这可能需要几分钟时间，请耐心等待...', 'info');
  updateModalProgress(0, '正在扫描: ' + folderPath);

  // 显示取消按钮（替换原来的完成按钮）
  var closeBtn = document.getElementById('modalCloseBtn');
  closeBtn.innerText = '取消';
  closeBtn.disabled = false;
  closeBtn.onclick = function () { cancelScan(); };
}

/**
 * 取消扫描
 */
function cancelScan() {
  if (scanCancelled) return; // 避免重复取消

  scanCancelled = true;
  modalLog('', '');
  modalLog('用户已取消扫描', 'info');
  updateModalProgress(100, '已取消');

  // 恢复完成按钮
  var closeBtn = document.getElementById('modalCloseBtn');
  closeBtn.innerText = '完成';
  closeBtn.disabled = false;
  closeBtn.onclick = function () { closeModal(); };
}

/**
 * 完成扫描
 */
function finishScan(foundMinGWs) {
  updateModalProgress(100, scanCancelled ? '已取消' : '扫描完成');
  modalLog('总共扫描了 ' + scanDirCount + ' 个目录', 'info');

  if (scanCancelled) {
    modalLog('扫描已取消', 'info');
  }

  if (foundMinGWs.length > 0) {
    // 添加找到的MinGW到检测列表
    var addedCount = 0;
    for (var i = 0; i < foundMinGWs.length; i++) {
      var mingw = foundMinGWs[i];
      var mingwPathLower = mingw.path.toLowerCase();

      // 检查是否已存在或与已有IDE有父子目录关系
      var shouldSkip = false;
      for (var j = 0; j < detectedIDEs.length; j++) {
        var existingPath = detectedIDEs[j].path.toLowerCase();
        var existingInclude = (detectedIDEs[j].includePath || '').toLowerCase();

        // 跳过完全相同的路径
        if (existingPath === mingwPathLower) {
          shouldSkip = true;
          break;
        }

        // 跳过是已有IDE子目录的情况（如 RedPanda-Cpp\mingw64）
        if (mingwPathLower.indexOf(existingPath + '\\') === 0) {
          shouldSkip = true;
          break;
        }

        // 跳过已有IDE的includePath包含此MinGW的情况
        if (existingInclude && existingInclude.indexOf(mingwPathLower) === 0) {
          shouldSkip = true;
          break;
        }
      }

      if (!shouldSkip) {
        mingw.egeInstalled = checkEgeInstalled(mingw);
        detectedIDEs.push(mingw);
        addedCount++;
        modalLog('添加: ' + mingw.name + ' - ' + mingw.path, 'success');
      } else {
        modalLog('跳过重复: ' + mingw.path, 'info');
      }
    }

    modalLog('扫描完成！新增 ' + addedCount + ' 个 MinGW 安装', 'success');
    renderIDEList();
  } else {
    modalLog('未找到 MinGW 安装', 'info');
    modalLog('提示：MinGW 目录应包含 bin\\gcc.exe', 'info');
  }

  updateStatus();

  // 恢复完成按钮
  var closeBtn = document.getElementById('modalCloseBtn');
  closeBtn.innerText = '完成';
  closeBtn.disabled = false;
  closeBtn.onclick = function () { closeModal(); };
}

// 扫描计数器（用于减少UI更新频率）
var scanDirCount = 0;
var lastUpdateCount = 0;
var UPDATE_INTERVAL = 100; // 每扫描100个目录更新一次UI
var scanCancelled = false; // 扫描取消标志

/**
 * 异步递归扫描目录查找MinGW（优化版：减少UI更新频率）
 */
function scanDirectoryAsync(path, results, depth, maxDepth, callback) {
  // 检查是否已取消
  if (scanCancelled) {
    callback();
    return;
  }

  if (depth > maxDepth) {
    callback();
    return;
  }

  try {
    var folder = fso.GetFolder(path);
    scanDirCount++;

    // 只在扫描一定数量目录后才更新UI（大幅减少UI更新频率）
    if (scanDirCount - lastUpdateCount >= UPDATE_INTERVAL) {
      var progress = Math.min(95, (depth / maxDepth) * 90);
      updateModalProgress(progress, '扫描中: ' + path.substring(0, 60) + '...');
      modalLog('已扫描 ' + scanDirCount + ' 个目录...', 'info');
      lastUpdateCount = scanDirCount;
    }

    // 检查当前目录是否是MinGW
    if (isMinGWDirectory(path)) {
      var is64bit = path.toLowerCase().indexOf('64') >= 0 ||
        path.toLowerCase().indexOf('x64') >= 0;
      results.push({
        name: 'MinGW' + (is64bit ? '-w64' : '32') + ' (扫描发现)',
        path: path,
        type: 'mingw',
        found: true,
        includePath: path + '\\include',
        libPath: path + '\\lib'
      });
      modalLog('找到 MinGW: ' + path, 'success');
      callback();
      return; // 找到后不再递归此目录
    }

    // 获取子目录列表
    var subDirsToScan = [];
    var subFolders = new Enumerator(folder.SubFolders);
    for (; !subFolders.atEnd(); subFolders.moveNext()) {
      var subPath = subFolders.item().Path;
      var subName = fso.GetFileName(subPath).toLowerCase();

      // 跳过一些目录以提高性能
      if (subName === 'windows' || subName === '$recycle.bin' ||
        subName === 'system volume information' || subName.charAt(0) === '.') {
        continue;
      }

      // 优先扫描可能有MinGW或IDE的目录
      var isRelevantPath =
        subName.indexOf('mingw') >= 0 ||
        subName.indexOf('msys') >= 0 ||
        subName.indexOf('gcc') >= 0 ||
        subName.indexOf('tdm') >= 0 ||
        subName.indexOf('clion') >= 0 ||
        subName.indexOf('jetbrains') >= 0 ||
        subName.indexOf('redpanda') >= 0 ||
        subName.indexOf('devcpp') >= 0 ||
        subName.indexOf('dev-cpp') >= 0 ||
        subName.indexOf('codeblocks') >= 0 ||
        subName === 'program files' ||
        subName === 'program files (x86)' ||
        subName === 'programs' ||
        subName === 'appdata' ||
        subName === 'local';

      if (isRelevantPath || depth < 3) {
        subDirsToScan.push(subPath);
      }
    }

    // 异步递归扫描子目录
    var currentIndex = 0;
    function scanNextSubDir() {
      // 检查是否已取消
      if (scanCancelled) {
        callback();
        return;
      }

      if (currentIndex >= subDirsToScan.length) {
        callback();
        return;
      }

      var subPath = subDirsToScan[currentIndex];
      currentIndex++;

      // 使用 setTimeout 避免阻塞
      window.setTimeout(function () {
        scanDirectoryAsync(subPath, results, depth + 1, maxDepth, scanNextSubDir);
      }, 10);
    }

    scanNextSubDir();

  } catch (e) {
    // 忽略权限错误等
    callback();
  }
}

/**
 * 同步扫描目录（保留原函数供其他地方使用）
 */
function scanDirectory(path, results, depth, maxDepth) {
  if (depth > maxDepth) return;

  try {
    var folder = fso.GetFolder(path);

    // 检查当前目录是否是MinGW
    if (isMinGWDirectory(path)) {
      var is64bit = path.toLowerCase().indexOf('64') >= 0 ||
        path.toLowerCase().indexOf('x64') >= 0;
      results.push({
        name: 'MinGW' + (is64bit ? '-w64' : '32') + ' (扫描发现)',
        path: path,
        type: 'mingw',
        found: true,
        includePath: path + '\\include',
        libPath: path + '\\lib'
      });
      return; // 找到后不再递归此目录
    }

    // 递归子目录
    var subFolders = new Enumerator(folder.SubFolders);
    for (; !subFolders.atEnd(); subFolders.moveNext()) {
      var subPath = subFolders.item().Path;
      var subName = fso.GetFileName(subPath).toLowerCase();

      // 跳过一些目录以提高性能
      if (subName === 'windows' || subName === '$recycle.bin' ||
        subName === 'system volume information' || subName.charAt(0) === '.') {
        continue;
      }

      // 优先扫描可能有MinGW或IDE的目录（扩展关键词列表）
      var isRelevantPath =
        subName.indexOf('mingw') >= 0 ||
        subName.indexOf('msys') >= 0 ||
        subName.indexOf('gcc') >= 0 ||
        subName.indexOf('tdm') >= 0 ||
        subName.indexOf('clion') >= 0 ||
        subName.indexOf('jetbrains') >= 0 ||
        subName.indexOf('redpanda') >= 0 ||
        subName.indexOf('devcpp') >= 0 ||
        subName.indexOf('dev-cpp') >= 0 ||
        subName.indexOf('codeblocks') >= 0 ||
        subName === 'program files' ||
        subName === 'program files (x86)' ||
        subName === 'programs' ||  // Toolbox 安装路径
        subName === 'appdata' ||   // 用户应用数据
        subName === 'local';       // AppData\Local

      if (isRelevantPath) {
        // 关键路径继续深入扫描
        scanDirectory(subPath, results, depth + 1, maxDepth);
      } else if (depth < 3) {
        // 前三层扫描所有目录（增加覆盖范围）
        scanDirectory(subPath, results, depth + 1, maxDepth);
      }
    }
  } catch (e) {
    // 忽略权限错误等
  }
}

/**
 * 检查目录是否是MinGW安装
 */
function isMinGWDirectory(path) {
  try {
    var binPath = path + '\\bin';
    if (!fso.FolderExists(binPath)) return false;

    // 检查是否有gcc或g++
    var hasGcc = fso.FileExists(binPath + '\\gcc.exe') ||
      fso.FileExists(binPath + '\\g++.exe');

    // 检查是否有include和lib目录
    var hasInclude = fso.FolderExists(path + '\\include');
    var hasLib = fso.FolderExists(path + '\\lib');

    return hasGcc && hasInclude && hasLib;
  } catch (e) {
    return false;
  }
}

/**
 * 刷新页面（重新开始检测）
 */
function refreshPage() {
  location.reload();
}

/**
 * 显示使用说明（统一入口）
 */
function showUsageGuide(index, isFound) {
  var ide = isFound ? detectedIDEs[index] : notFoundIDEs[index];
  if (!ide) return;

  var type = ide.type;

  // CodeBlocks 显示详细的使用指南窗口
  if (type === 'codeblocks') {
    showCodeBlocksGuideModal();
    return;
  }

  // Dev-C++ 显示详细的使用指南窗口
  if (type === 'devcpp') {
    showDevCppGuideModal();
    return;
  }

  // Red Panda 显示简化说明
  if (type === 'redpanda') {
    showRedPandaGuideModal();
    return;
  }

  // MSVC/Visual Studio 显示使用说明
  if (type === 'vs' || type === 'vs-legacy') {
    showMsvcGuideModal();
    return;
  }
}

/**
 * 查看安装说明（根据IDE类型显示不同内容）
 */
function showInstallGuide(index, isFound) {
  var ide = isFound ? detectedIDEs[index] : notFoundIDEs[index];
  if (!ide) return;

  var type = ide.type;

  // CodeBlocks 直接显示详细的使用指南窗口
  if (type === 'codeblocks') {
    showCodeBlocksGuideModal();
    return;
  }

  // Dev-C++ 显示详细的使用指南窗口
  if (type === 'devcpp') {
    showDevCppGuideModal();
    return;
  }

  // Red Panda 显示详细的使用指南窗口
  if (type === 'redpanda') {
    showRedPandaGuideModal();
    return;
  }

  var bodyHtml;
  var linkerFlags = '-lgraphics -lgdiplus -lgdi32 -limm32 -lmsimg32 -lole32 -loleaut32 -lwinmm -luuid -mwindows -static';

  if (type === 'vs' || type === 'vs-legacy') {
    bodyHtml = '<p style="color:#059669; font-weight:500;">\u2714 已完成安装</p>' +
      '<p>Visual Studio 项目中可以直接使用：</p>' +
      '<div class="guide-command-box">#include &lt;graphics.h&gt;</div>' +
      '<p>无需额外配置编译选项。</p>';
  } else {
    // mingw, clion, devcpp 等需要手动配置链接选项的环境
    bodyHtml = '<p style="color:#059669; font-weight:500;">\u2714 已完成安装</p>' +
      '<p>仍需在编译时添加以下链接选项：</p>' +
      '<div class="guide-command-wrapper">' +
      '<div class="guide-command-box" id="linkerFlagsBox">' + linkerFlags + '</div>' +
      '<button class="btn-copy" onclick="copyLinkerFlags()">复制</button>' +
      '</div>' +
      '<p>详细说明请访问 <a href="javascript:void(0)" class="guide-link" ' +
      'onclick="openUrl(\'https://xege.org/install_and_config\'); return false;">' +
      'https://xege.org/install_and_config</a></p>';
  }

  document.getElementById('installGuideTitle').innerText = ide.name + ' - 安装说明';
  document.getElementById('installGuideBody').innerHTML = bodyHtml;
  document.getElementById('installGuideModal').className = 'modal-overlay show';
}

/**
 * 关闭安装说明模态框
 */
function closeInstallGuide() {
  document.getElementById('installGuideModal').className = 'modal-overlay';
}

/**
 * 复制链接选项到剪贴板
 */
function copyLinkerFlags() {
  var flags = '-lgraphics -lgdiplus -luuid -lmsimg32 -lgdi32 -limm32 -lole32 -loleaut32 -lwinmm';
  try {
    window.clipboardData.setData('Text', flags);
    var btn = event.target;
    btn.innerText = '已复制';
    btn.className = 'btn-copy copied';
    window.setTimeout(function () {
      btn.innerText = '复制';
      btn.className = 'btn-copy';
    }, 2000);
  } catch (e) {
    alert('复制失败，请手动选择文本复制');
  }
}

/**
 * 更新状态栏
 */
function updateStatus() {
  var installedCount = 0;
  for (var i = 0; i < detectedIDEs.length; i++) {
    if (detectedIDEs[i].egeInstalled) installedCount++;
  }
  document.getElementById('statusText').innerText =
    '检测到 ' + detectedIDEs.length + ' 个开发环境，' + installedCount + ' 个已安装 EGE';
}

/**
 * 处理模态框背景点击事件（点击灰色区域关闭）
 */
function handleModalOverlayClick(event, modalId) {
  // 只有点击灰色背景区域（overlay本身）时才关闭，点击模态框内容区域不关闭
  if (event.target.id === modalId) {
    // 根据不同的模态框调用对应的关闭函数
    if (modalId === 'codeBlocksGuideModal') {
      closeCodeBlocksGuide();
    } else if (modalId === 'devCppGuideModal') {
      closeDevCppGuide();
    } else if (modalId === 'redPandaGuideModal') {
      closeRedPandaGuide();
    } else if (modalId === 'msvcGuideModal') {
      closeMsvcGuide();
    } else if (modalId === 'unsupportedVSGuideModal') {
      closeUnsupportedVSGuide();
    } else if (modalId === 'installGuideModal') {
      closeInstallGuide();
    } else if (modalId === 'clionPluginModal') {
      closeClionPluginModal();
    } else if (modalId === 'operationModal') {
      // operationModal 只有在完成后才能关闭（按钮未禁用时）
      var closeBtn = document.getElementById('modalCloseBtn');
      if (closeBtn && !closeBtn.disabled) {
        closeModal();
      }
    }
  }
}

/**
 * 全局键盘事件处理 - 支持 ESC 键关闭模态窗口
 */
document.onkeydown = function (event) {
  event = event || window.event;

  // 检测 ESC 键（keyCode 27）
  if (event.keyCode === 27) {
    // 查找当前显示的模态窗口
    var modals = [
      { id: 'codeBlocksGuideModal', close: closeCodeBlocksGuide },
      { id: 'devCppGuideModal', close: closeDevCppGuide },
      { id: 'redPandaGuideModal', close: closeRedPandaGuide },
      { id: 'msvcGuideModal', close: closeMsvcGuide },
      { id: 'unsupportedVSGuideModal', close: closeUnsupportedVSGuide },
      { id: 'installGuideModal', close: closeInstallGuide },
      { id: 'clionPluginModal', close: closeClionPluginModal },
      { id: 'scriptPreviewModal', close: closeScriptPreview },
      {
        id: 'operationModal', close: function () {
          // 操作进度窗口只有在完成后才能关闭
          var closeBtn = document.getElementById('modalCloseBtn');
          if (closeBtn && !closeBtn.disabled) {
            closeModal();
          }
        }
      }
    ];

    // 遍历所有模态窗口，找到显示的那个并关闭
    for (var i = 0; i < modals.length; i++) {
      var modal = document.getElementById(modals[i].id);
      if (modal && modal.className.indexOf('show') >= 0) {
        modals[i].close();
        break; // 只关闭第一个找到的
      }
    }
  }
};

/**
 * ========== Debug 模式：脚本预览功能 ==========
 */

// 全局变量：保存脚本预览的上下文
var scriptPreviewContext = null;

/**
 * 显示脚本预览窗口（Debug 模式专用）
 */
function showScriptPreview(scriptContent, selectedIDEs, egeLibsPath, mode, progressCallback, completeCallback) {
  // 保存上下文供后续使用
  scriptPreviewContext = {
    scriptContent: scriptContent,
    selectedIDEs: selectedIDEs,
    egeLibsPath: egeLibsPath,
    mode: mode,
    progressCallback: progressCallback,
    completeCallback: completeCallback
  };

  // 显示脚本内容
  document.getElementById('scriptPreviewContent').innerText = scriptContent;
  document.getElementById('scriptPreviewTitle').innerText =
    'PowerShell 脚本预览 (Debug 模式) - ' + (mode === 'install' ? '安装' : '卸载');

  // 显示模态窗口
  document.getElementById('scriptPreviewModal').className = 'modal-overlay show';
}

/**
 * 用户确认执行脚本
 */
function confirmScriptExecution() {
  if (!scriptPreviewContext) return;

  // 先保存上下文（closeScriptPreview 会清空它）
  var context = scriptPreviewContext;
  
  // 关闭预览窗口（不触发取消回调）
  document.getElementById('scriptPreviewModal').className = 'modal-overlay';
  scriptPreviewContext = null;

  // 调用 Elevate 模块继续执行（跳过 Debug 检测）
  if (typeof Elevate !== 'undefined' && typeof Elevate.continueWithScriptExecution === 'function') {
    Elevate.continueWithScriptExecution(
      context.scriptContent,
      context.selectedIDEs,
      context.egeLibsPath,
      context.mode,
      context.progressCallback,
      context.completeCallback
    );
  }
}

/**
 * 从预览窗口导出脚本
 */
function exportScriptFromPreview() {
  if (!scriptPreviewContext) return;

  // 先保存上下文
  var context = scriptPreviewContext;
  
  // 关闭预览窗口（不触发取消回调）
  document.getElementById('scriptPreviewModal').className = 'modal-overlay';
  scriptPreviewContext = null;

  // 调用 Elevate.exportScript
  if (typeof Elevate !== 'undefined' && typeof Elevate.exportScript === 'function') {
    Elevate.exportScript(
      context.selectedIDEs,
      context.egeLibsPath,
      context.mode
    );
  }
}

/**
 * 关闭脚本预览窗口（取消操作）
 */
function closeScriptPreview() {
  document.getElementById('scriptPreviewModal').className = 'modal-overlay';

  // 如果取消了操作，通知完成回调
  if (scriptPreviewContext && scriptPreviewContext.completeCallback) {
    scriptPreviewContext.completeCallback(false, '用户取消了操作', false, false);
  }

  scriptPreviewContext = null;
}
