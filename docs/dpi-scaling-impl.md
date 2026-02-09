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

**Strategy**: rem-based CSS + dynamic root font-size for automatic DPI-aware scaling.

### Key Insight

`screen.width` returns logical resolution (physical ÷ DPI scale). By using the same
`scaleFactor = screen.width / 1920` to scale both the **window size** and the **CSS base font-size**,
the UI layout stays proportional across all resolution × DPI combinations.

### How It Works

1. **CSS**: All pixel values converted to `rem` units (base: 1rem = 14px)
2. **JavaScript**: On load, calculates `scaleFactor = max(0.75, screen.width / 1920)` and sets:
   - `html.style.fontSize = round(14 × scaleFactor) + 'px'` → all rem values scale automatically
   - `window.resizeTo(860 × scaleFactor, 720 × scaleFactor)` → window scales in sync

### Why This Works Unlike Previous Attempts

| Previous approach | Problem | rem approach |
| --- | --- | --- |
| `body.style.zoom` | Changes layout engine, causes overflow | rem doesn't alter layout engine behavior |
| `transform: scale()` | Opposite direction, doesn't affect layout flow | rem is standard CSS sizing — layout flows naturally |
| `screen.deviceXDPI` | Read-only, cannot be set by JavaScript | Completely independent of DPI APIs |
| Three separate CSS files | High maintenance, hard threshold switches | Single CSS, continuous smooth scaling |

### Scaling Examples

scaleFactor = `max(0.75, screen.width / 1920)`

| Screen | DPI | screen.width | scale | font | window(logical) | window(physical) |
| --- | --- | --- | --- | --- | --- | --- |
| 1080p | 100% | 1920 | 1.000 | 14px | 860×720 | 860×720 |
| 1080p | 125% | 1536 | 0.800 | 11px | 688×576 | 860×720 |
| 1080p | 150% | 1280 | 0.750 | 11px | 645×540 | 968×810 |
| 2K | 100% | 2560 | 1.333 | 19px | 1147×960 | 1147×960 |
| 2K | 125% | 2048 | 1.067 | 15px | 918×769 | 1147×961 |
| 4K | 150% | 2560 | 1.333 | 19px | 1147×960 | 1720×1440 |
| 4K | 200% | 1920 | 1.000 | 14px | 860×720 | 1720×1440 |

### Code Changes

**src/setup.hta**:

- All CSS `px` values converted to `rem` (except 1px borders — kept for sharpness)
- Added `html { font-size: 14px; }` as CSS baseline (overridden by JS)
- Kept "💡 按 Ctrl+滚轮 调整文字大小" hint for fine-tuning

**src/ui.js**:

- `scaleFactor` minimum changed from `1` to `0.75` (allows shrinking on DPI-scaled screens)
- Added dynamic root font-size:

  ```javascript
  var scaleFactor = Math.max(0.75, screen.width / 1920);
  var rootFontSize = Math.max(10, Math.round(14 * scaleFactor));
  document.documentElement.style.fontSize = rootFontSize + 'px';
  ```

- Window and CSS now scale together by the same factor

### Compatibility

- `rem` unit: IE 9+ ✓ (HTA uses IE=edge → IE 11 engine)
- No CSS variables, no `calc()` dependency for scaling (only for max-height)
- Ctrl+Wheel still works as an additional fine-tuning mechanism

---

## API Limitations

- `screen.deviceXDPI` - read-only
- `document.execCommand('Zoom')` - not supported in HTA
- `WScript.Shell.SendKeys` - unreliable for Ctrl+Wheel simulation
- `document.body.style.zoom` - affects layout, causes overflow
- `transform: scale()` - opposite direction (shrinks content)

---

## Summary

The rem-based approach solves the DPI scaling problem by leveraging `screen.width` (logical resolution)
to simultaneously scale both window size and CSS content via a single `scaleFactor`. This avoids all
previously attempted approaches' pitfalls while maintaining a single, clean CSS codebase.

Key properties:

- **One formula** covers all resolution × DPI combinations
- **Zero maintenance overhead** — no duplicate CSS files
- **Continuous scaling** — no hard-coded breakpoints
- **Ctrl+Wheel** still available for manual fine-tuning
- **IE 9+ compatible** — `rem` is well-supported in IE=edge mode
