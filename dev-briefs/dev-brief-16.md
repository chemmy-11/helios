# 开发简报 16：键盘顶起输入框修复（insets 方案定稿）+ v1.6.3 发布

## 日期
2026-08-02

## 背景

v1.6.2 起 Android 端键盘弹出无法正常顶起输入框（或顶起异常），历经多轮真机排查与修复，最终定位根因并定稿方案，发布 v1.6.3。本简报为完整实施文档，记录排查链、根因、最终方案与全部踩坑教训，供后续维护参考。

---

## 一、问题时间线（为什么会坏）

| 提交 | 时间 | 事件 |
|---|---|---|
| `4abd27c` | 8/1 23:58 | targetSdk 35 → **Android 15 强制 edge-to-edge → `adjustResize` 失效** → 键盘不再顶起（问题起源） |
| `b0058a2` | 8/2 | `captureInput: false`（修复打不出字，根因是 IME 冲突） |
| `b2a7182` | 8/2 | v1.6.1 微信式导航横条（DOM 移动方案，后被证伪） |
| `f159a1d` | 8/2 | v1.6.2 在线更新修复 |
| `aa95442` 起 12 个提交 | 8/2 | insets 方案多轮迭代（见踩坑清单） |
| `f374188` | 8/2 | **根因修复：insets 物理像素 ÷ density 转 CSS 像素** |
| `eeccb26` | 8/2 | v1.6.3 发布（release + APK + update.zip + version.json 全线上） |

核心结论先行：**Android `WindowInsets` 单位是物理像素，注入 CSS 前必须除以 `density`。** 之前所有版本把 `ime - nav`（如 1095 物理 px）直接当 CSS 像素撑开，等于放大 `dpr` 倍（1095px ≈ 1.4 个屏幕高），输入框被顶出屏幕。

---

## 二、最终方案（定稿）

### 2.1 配置（AndroidManifest.xml）

```xml
android:windowSoftInputMode="adjustNothing"
```

`adjustNothing` + insets 监听是自洽组合：视口永不随键盘收缩（100vh 恒定），键盘高度完全由 insets 上报，CSS 手动撑开。真机验证：键盘弹出前后 `innerHeight` 不变（800→796，仅状态栏抖动）。

### 2.2 原生注入（MainActivity.java）

```java
ViewCompat.setOnApplyWindowInsetsListener(findViewById(android.R.id.content), (v, insets) -> {
    int ime = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom;       // 物理像素
    int nav = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom;
    float density = wv.getResources().getDisplayMetrics().density;
    int kbCss = Math.max(0, Math.round((ime - nav) / density));            // ← 关键：转 CSS 像素
    // 注入 --kb-height / --kb-ime / --kb-nav（均 CSS 像素）
});
```

- `kb = ime - nav`：键盘遮挡高度（edge-to-edge 与非 edge-to-edge 两态均自洽）
- 注入脚本还调用 `window.__onKbChange(imeCss, navCss, kbCss)`（JS 端可选消费；当前 game.js 未使用，保留钩子）

### 2.3 CSS 撑开（css/style.css）

```css
#main-layout {
  height: calc(100vh - var(--topbar-h) - var(--status-bar-h, 0px));
  padding-bottom: max(0px, calc(var(--kb-height, 0px) - var(--bottom-nav-h, 0px)));
  transition: padding-bottom 0.15s ease-out;
}
```

**布局数学（为什么贴合）：**

```
无键盘：pad = max(0, 0-52) = 0
        输入区底 = 100vh - 52（height 预留的横条位）= 横条顶 ✓
键盘：  pad = kb - 52
        输入区底 = 100vh - 52 - (kb-52) = 100vh - kb = 键盘顶 ✓ 直接贴合
```

移动端 `#main-layout` 高度为 `calc(100vh - topbar - bottombar - statusbar)`（扣 52 横条位）；桌面无 `--bottom-nav-h` 定义 → fallback 0，不受影响。

### 2.4 底部导航横条

**保持 `position: fixed; bottom: 0` 不动**，键盘弹出时被键盘遮挡（v1.6.1 的"横条移入输入框上方"DOM 方案已废弃——DOM 移动参与 flex 流会挤扁布局，且引入 500ms 恢复竞态）。

---

## 三、踩坑清单（价值最高，务必读）

| # | 坑 | 表现 | 教训 |
|---|---|---|---|
| 1 | **WindowInsets 是物理像素** | 注入 `1095px` 撑开 ≈ 1.4 屏，输入框顶出屏幕 | **Android 原生坐标全是物理像素，进 CSS 前 ÷density**（与 `screen.height` 同坑） |
| 2 | **`screen.height` 是物理像素** | shrink 补偿恒巨大 → pad 恒 0 → 沉底 | 与 `innerHeight`（CSS 像素）比较前须 ÷dpr |
| 3 | **双重偏移**：系统 resize + 手动撑开叠加 | 缝隙 ≈ 键盘高度（半屏） | 先确认视口是否收缩（`adjustNothing` 是否生效），再决定撑开公式；本项目视口不收缩，无需 shrink 补偿 |
| 4 | **Android 15 强制 edge-to-edge** | `adjustResize` 失效，键盘不顶起 | 不要来回切换 opt-out/edge-to-edge（8/2 曾有 11 连改）；insets 方案跨版本自洽 |
| 5 | **JS 执行链不可靠** | 调试条依赖 `setupKeyboard` 死活不显示，但游戏正常 | 游戏 init 内任一步崩溃都会静默跳过后续（无 try/catch）；**调试代码必须独立于 game.js 执行链** |
| 6 | **调试条可见性** | `top:0` 被 edge-to-edge 状态栏盖住 | 放屏幕正中 + 大字号 + 版本号 + **轮询更新**（不依赖事件/回调） |
| 7 | **CAPACITOR Keyboard 插件在 Android 15 不可靠** | keyboardWillShow 事件不触发 | 弃用插件监听，改用原生 insets |
| 8 | **android/ 目录不入 git** | 原生改动无历史、不可回退（e715e66/83337d9 声称改了 opt-out，实际文件里没有） | 已在 `.gitignore` 放开 android/（内部构建产物由 android/.gitignore 过滤），原生层自此有版本基线 |

---

## 四、调试方法沉淀（下次遇到同类问题直接用）

1. **黄条调试**：`index.html` 独立 `<script>` 注入（不依赖 game.js），轮询（800ms）显示 `vh / shCss / kbH`，`setInterval` 兜底一切事件链
2. **数据先行**：真机反馈"顶太高/没贴合"时，先要 `kbH`（注入值）和 `vh`（视口）两个数：
   - `kbH` 明显 > 屏幕高 → 物理像素没转换
   - `vh` 键盘前后不变 → `adjustNothing` 生效（纯 padding 撑开即可）
   - `vh` 明显缩小 → 系统在 resize（需 shrink 补偿或去掉撑开）
3. **version.js 唯一版本源**：调试条带版本号，一眼确认装的 APK 新旧

---

## 五、工程改进

- `.gitignore`：`android/` 整目录忽略 → 细粒度（保留源码，忽略 build/.gradle/local.properties）
- `docs/github-maintenance.md`：补充 git 代理（`127.0.0.1:7897`，push 前需开 Clash）、发布失败恢复流程

---

## 六、发布（v1.6.3，双通道）

按 `scripts/publish-release.sh` 全自动发布：

| 通道 | 内容 | 状态 |
|---|---|---|
| release v1.6.3 | `HELIOS.apk`（6.9MB）+ `update.zip`（65KB） | ✅ |
| 在线更新 | `update/version.json` → 1.6.3（raw CDN 已刷新） | ✅ |
| **native 提醒** | 本次改了 `MainActivity.java` → **必须装新 APK**（在线更新覆盖不了原生代码） | ⚠️ 已提醒 |

---

## 七、版本号

`js/version.js`：`APP_VERSION = '1.6.3'`
