# DPI Scaling Implementation

**Project**: EGE Installer  

---

## Problem

The HTA installer needs to handle different screen resolutions and DPI settings properly. Users expect the window to adapt to screen size and be able to adjust text size conveniently.

**Technical Context**:

- HTA uses IE engine, mshta.exe is DPI-unaware
- Windows DWM automatically stretches DPI-unaware applications
- `screen.width` returns logical resolution (physical resolution ÷ DPI scale)

---

## Attempted Solutions

### 1. CSS transform for DPI compensation

```javascript
container.style.transform = 'scale(' + (1/dpiScale) + ')';
```

**Issue**: `scale(0.667)` makes content smaller, not larger.

### 2. Fixed window + CSS zoom

```javascript
document.body.style.zoom = scaleFactor;
```

**Issue**: Window too small (750×620), content enlarged but window size unchanged.

### 3. Window size based on physical resolution

```javascript
var initWidth = baseWidth * (physicalWidth / 1920);
```

**Issue**: Window enlarged but font size fixed (CSS 14px), appears relatively smaller.

### 4. Zoom buttons (emulating Ctrl+Wheel)

```javascript
window.resizeTo(initialWidth / zoomFactor, initialHeight / zoomFactor);
```

**Issue**: Button click changes physical window size, cannot emulate Ctrl+Wheel behavior.

---

## Root Cause

Testing tool revealed that Ctrl+Wheel modifies:

- ✓ `screen.deviceXDPI`: 96 → 101
- ✓ `deviceXDPI / logicalXDPI` ratio: 1.0 → 0.70
- ✗ `body.style.zoom` and `currentStyle.zoom`: unchanged

**Conclusion**: Ctrl+Wheel modifies `screen.deviceXDPI` (IE's DPI awareness property), which is:

- Read-only property
- Managed by IE engine at system level
- Cannot be modified by JavaScript

---

## Why JavaScript Cannot Solve This

1. `screen.deviceXDPI` is read-only, managed by IE engine
2. CSS `zoom` affects layout causing overflow issues
3. CSS `transform: scale()` doesn't reproduce IE text zoom and causes layout/overflow issues
4. mshta.exe is DPI-unaware, Windows DWM handles stretching automatically

```text
Expected: JavaScript → deviceXDPI → IE Engine → Text Size
Actual:   IE Engine → deviceXDPI (read-only) ← JavaScript (no access)
```

---

## Implementation

**Strategy**: Use native functionality instead of emulation.

### Code Changes

**src/setup.hta**:

- Removed zoom buttons and related CSS (~50 lines)
- Added hint: "💡 按 Ctrl+滚轮 调整文字大小"

**src/ui.js**:

- Simplified window initialization based on logical resolution:

  ```javascript
  var scaleFactor = Math.max(1, screen.width / 1920);
  var initWidth = Math.round(baseWidth * scaleFactor);
  ```

- Removed all failed solution code (transform, zoom, and `getDpiScale()` function)
- Kept minimal resize handler for enforcing minimum window size

### Rationale

- Ctrl+Wheel is IE/HTA native feature (system-level, smooth, no side effects)
- Follows Windows application conventions
- Code is clean and maintainable
- Best user experience

---

## API Limitations

- `screen.deviceXDPI` - read-only
- `document.execCommand('Zoom')` - not supported in HTA
- `WScript.Shell.SendKeys` - unreliable for Ctrl+Wheel simulation
- `document.body.style.zoom` - affects layout, causes overflow
- `transform: scale()` - opposite direction (shrinks content)

---

## Summary

In HTA applications, JavaScript cannot emulate IE engine's text zoom mechanism. The optimal solution is to leverage native platform capabilities (Ctrl+Wheel) rather than attempting workarounds.
