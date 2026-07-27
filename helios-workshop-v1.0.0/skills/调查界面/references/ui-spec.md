# UI 详细规范（references/ui-spec.md）

本文档为《赫利俄斯之链》调查界面的完整设计规范，包含 CSS 设计令牌、
组件线框图、动画定义、响应式策略、无障碍要求及可运行的最小原型代码。

---

## 1. CSS 设计令牌（Design Tokens）

### 1.1 色彩系统

```css
:root {
  /* 背景层次 */
  --bg-base:        #0A0E14;    /* 最底层背景 */
  --bg-surface:     #111820;    /* 面板/卡片背景 */
  --bg-elevated:    #1A2332;    /* 高亮/hover 背景 */
  --bg-overlay:     rgba(0, 0, 0, 0.6);  /* 遮罩层 */

  /* 语义色 */
  --color-primary:  #00FF96;    /* 终端绿 — 主文字、确认状态 */
  --color-info:     #00BFFF;    /* 信息蓝 — 链接、标签 */
  --color-warning:  #FFB800;    /* 警告黄 — 争议、注意 */
  --color-danger:   #FF0044;    /* 危险红 — 错误、紧急 */
  --color-accent:   #C084FC;    /* 紫色 — 伦理线程专用 */
  --color-pink:     #FF69B4;    /* 粉色 — 医疗舱标识 */

  /* 文字 */
  --text-primary:   #E0E8F0;    /* 主要文字 */
  --text-secondary: #8899AA;    /* 次要文字、时间戳 */
  --text-muted:     #556677;    /* 弱化文字、禁用状态 */
  --text-terminal:  #00FF96;    /* 终端输入/输出 */

  /* 边框 */
  --border-default: #1E2D3D;    /* 默认边框 */
  --border-hover:   #2A3F55;    /* hover 边框 */
  --border-focus:   rgba(0, 255, 150, 0.27);  /* 聚焦边框 */
  --border-active:  #00FF96;    /* 激活/选中边框 */

  /* 辉光阴影 */
  --glow-green:     0 0 8px rgba(0, 255, 150, 0.3);
  --glow-blue:      0 0 8px rgba(0, 191, 255, 0.3);
  --glow-red:       0 0 12px rgba(255, 0, 68, 0.4);
  --glow-yellow:    0 0 8px rgba(255, 184, 0, 0.3);
}
```

### 1.2 字体

```css
:root {
  --font-mono:    'JetBrains Mono', 'Fira Code', 'Noto Sans Mono CJK SC',
                  'Courier New', monospace;
  --font-display: 'Orbitron', 'Rajdhani', sans-serif;
  --font-size-xs:   11px;
  --font-size-sm:   13px;
  --font-size-base: 14px;
  --font-size-md:   16px;
  --font-size-lg:   18px;
  --font-size-xl:   24px;
  --font-size-2xl:  32px;
  --line-height-body:    1.6;
  --line-height-heading: 1.2;
  --letter-spacing-body:    0.5px;
  --letter-spacing-heading: 2px;
}
```

### 1.3 间距与尺寸

```css
:root {
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  16px;
  --space-lg:  24px;
  --space-xl:  32px;
  --space-2xl: 48px;

  --sidebar-width:       220px;
  --sidebar-collapsed:    48px;
  --topbar-height:        48px;
  --input-height:         44px;
  --border-radius:         4px;
  --border-radius-lg:      8px;
}
```

### 1.4 动画时长

```css
:root {
  --duration-fast:    100ms;
  --duration-normal:  200ms;
  --duration-slow:    400ms;
  --duration-phase:   1500ms;
  --ease-default:     cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce:      cubic-bezier(0.68, -0.55, 0.27, 1.55);
}
```

---

## 2. 组件线框图（ASCII Wireframes）

### 2.1 主调查视图（完整布局）

```
+================================================================+
| [☀] 赫利俄斯之链  | ██░░ 阶段1 | [📋证据] [📄日志] [📝报告🔒]|
+================================================================+
|            |                                                    |
|  ┌──────┐  |  ┌──────────────────────────────────────────────┐  |
|  │倒计时│  |  │ TAB: [HELIOS-7] [MEDICA] [FORGE-3] [+]      │  |
|  │31:22 │  |  ├──────────────────────────────────────────────┤  |
|  │ :07  │  |  │                                              │  |
|  └──────┘  |  │  [🤖] 欢迎，调查员。请提出你的问题。       │  |
|            |  │       [03:14:22]                              │  |
|  ┌──────┐  |  │                                              │  |
|  │ 位置 │  |  │                    请调出事故当晚的传感器 [你]│  |
|  │      │  |  │                              [03:14:45]      │  |
|  │ ●气闸│  |  │                                              │  |
|  │ ○医疗│  |  │  [🤖] 正在检索... ● ● ●                     │  |
|  │ ○终端│  |  │                                              │  |
|  │ ○副工│  |  ├──────────────────────────────────────────────┤  |
|  └──────┘  |  │ > [输入你的问题...]                   [▶]    │  |
|            |  └──────────────────────────────────────────────┘  |
|            |                                    ┌───────────┐   |
|            |                                    │ ● ● ● 跟进│   |
|            |                                    │   ● ●     │   |
|            |                                    └───────────┘   |
+================================================================+
```

### 2.2 证据板视图

```
+================================================================+
| 证据板         已收集: 7/15 | 确认: 3 | 争议: 2 | 隐藏: 5      |
+================================================================+
|                    [搜索线索...] [筛选 ▼]                       |
|                                                                |
|     ╭─────────╮          ╭──────────╮                          |
|     │通讯记录 │──因果────│异常信号  │                          |
|     │ ● 已确认│          │ ● 争议中 │                          |
|     ╰────┬────╯          ╰─────┬────╯                          |
|          │                      │                               |
|          │关联              时间矛盾                             |
|          │                      │                               |
|     ╭────┴────╮          ╭─────┴────╮                          |
|     │HELIOS-7 │──指令────│时间线矛盾│                          |
|     │ ● 已确认│          │ ● 争议中 │                          |
|     ╰─────────╯          ╰──────────╯                          |
|                                                                |
+================================================================+
| ▾ 选中线索: 通讯记录                                           |
|   描述: 事故前12分钟的加密通讯片段，内容部分损坏               |
|   来源: HELIOS-7 终端查询 | 可信度: 高 | 关联: 异常信号        |
+================================================================+
```

### 2.3 站点日志查看器

```
+================================================================+
| 赫利俄斯站 - 中央日志系统 v4.7.2 | 访问级别: 调查员（只读）   |
+================================================================+
| 搜索: [__________] 类别: [全部 ▼] 时间: [起始___] ~ [结束___]  |
|                                                                |
| ┌──────────────────────────────────────────────────────────────┐│
| │[2087-03-15 03:14:22] [CMD]  指令链更新: 副工程师权限 → L3   ││
| │[2087-03-15 03:18:07] [SENSOR]  B-7区段气压 ↓0.3kPa 自动补偿││
| │[2087-03-15 03:21:44] [MED]   药物分发记录 ██████ 需L4权限  ││
| │[2087-03-15 03:22:01] [SYS]   系统自检完成: 全绿            ││
| │[2087-03-15 03:25:11] [COMM]  外部通讯中断 → 原因待查       ││
| │[2087-03-15 03:28:33] [SENSOR] 反应堆温度波动 ±2.1°C        ││
| │[2087-03-15 03:31:07] [CMD]   紧急协议 α-7 预加载           ││
| │[2087-03-15 03:35:19] [MED]   生物特征扫描异常 ████ 需L4    ││
| └──────────────────────────────────────────────────────────────┘│
| 共 47 条记录 | 页: [< 1 2 3 >]                                  |
+================================================================+
```

### 2.4 报告提交界面

```
+================================================================+
| 调查报告                                      自动保存 ✓ 03:41  |
+================================================================+
| ▾ 引导问题（点击插入编辑器）:                                   |
|   ▸ 你认为事故的直接原因是什么？                                |
|   ▸ 哪些代理的行为存在异常？                                    |
|   ▸ 你的结论基于哪些关键证据？                                  |
|                                                                |
| ┌──────────────────────────────────────────────────────────────┐|
| │ > 根据我对各代理终端的查询和站点日志的分析，我认为事故的     │|
| │   直接原因是...                                              │|
| │                                                              │|
| │ > 关键证据引用: [通讯记录#003] [传感器数据#007]              │|
| │                                                              │|
| │                                                              │|
| └──────────────────────────────────────────────────────────────┘|
| 字数: 142 | 关联线索: 2 条 [+ 添加引用]                         |
|                                                                |
|                     ╭═══════════════════╗                        |
|                     ║  提交报告 ▶       ║                        |
|                     ╰═══════════════════╝                        |
+================================================================+
```

---

## 3. 动画规范

### 3.1 阶段过渡动画

阶段切换为游戏中最重要的视觉事件，需要制造仪式感：

```
时间轴:
0ms     - 倒计时数字冻结，颜色渐变至白色 (200ms, ease-out)
200ms   - 全屏暗化至 50% 亮度 (200ms, ease-in)
400ms   - 过渡标题淡入: "阶段 X: 名称 → 阶段 Y: 名称" (300ms)
700ms   - 标题停留 (300ms)
1000ms  - 标题淡出 (200ms)
1200ms  - 全屏亮度恢复 (200ms)
1400ms  - 新解锁元素依次点亮 (每个100ms, 最多3个)
```

CSS 关键帧：

```css
@keyframes phase-transition {
  0%   { opacity: 1; filter: brightness(1); }
  15%  { opacity: 1; filter: brightness(1.5); }
  30%  { opacity: 1; filter: brightness(0.5); }
  50%  { opacity: 1; filter: brightness(0.5); }
  70%  { opacity: 1; filter: brightness(0.5); }
  85%  { opacity: 1; filter: brightness(1); }
  100% { opacity: 1; filter: brightness(1); }
}
```

### 3.2 打字指示器

代理"思考"时的三点脉动动画：

```css
@keyframes typing-pulse {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50%      { opacity: 1.0; transform: scale(1.2); }
}

.typing-indicator span {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  animation: typing-pulse 1.2s ease-in-out infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}
```

### 3.3 线索揭示动画

当新线索被发现并添加到证据板时：

```css
@keyframes clue-reveal {
  0%   { opacity: 0; transform: scale(0.3); filter: blur(8px); }
  60%  { opacity: 1; transform: scale(1.1); filter: blur(0); }
  100% { opacity: 1; transform: scale(1.0); filter: blur(0); }
}

.clue-node.revealed {
  animation: clue-reveal 0.6s var(--ease-bounce) forwards;
}
```

连接线揭示（延迟于节点之后）：

```css
@keyframes edge-draw {
  from { stroke-dashoffset: 100; }
  to   { stroke-dashoffset: 0; }
}

.clue-edge.revealed {
  stroke-dasharray: 100;
  animation: edge-draw 0.8s var(--ease-default) 0.3s forwards;
}
```

### 3.4 倒计时紧迫效果

各紧迫等级的 CSS 动画：

```css
/* 等级2: 12-24小时 — 缓慢闪烁 */
@keyframes countdown-warn {
  0%, 90%, 100% { opacity: 1; }
  95%           { opacity: 0.5; }
}
.countdown.warning {
  color: var(--color-warning);
  animation: countdown-warn 5s ease infinite;
}

/* 等级3: 6-12小时 — 持续脉动 */
@keyframes countdown-pulse {
  0%, 100% { text-shadow: 0 0 4px rgba(255, 107, 0, 0.3); }
  50%      { text-shadow: 0 0 16px rgba(255, 107, 0, 0.7); }
}
.countdown.urgent {
  color: #FF6B00;
  animation: countdown-pulse 2s ease infinite;
}

/* 等级4: 2-6小时 — 快速脉动 + 放大 */
@keyframes countdown-critical {
  0%, 100% { text-shadow: 0 0 8px rgba(255, 0, 68, 0.4); transform: scale(1); }
  50%      { text-shadow: 0 0 24px rgba(255, 0, 68, 0.8); transform: scale(1.05); }
}
.countdown.critical {
  color: var(--color-danger);
  animation: countdown-critical 1s ease infinite;
}

/* 等级5: <2小时 — 全屏边缘红色脉冲 */
@keyframes screen-edge-warning {
  0%, 100% { box-shadow: inset 0 0 40px rgba(255, 0, 68, 0.0); }
  50%      { box-shadow: inset 0 0 80px rgba(255, 0, 68, 0.15); }
}
.countdown.emergency ~ .main-view {
  animation: screen-edge-warning 2s ease infinite;
}
```

### 3.5 CRT 扫描线效果

全局扫描线叠加层（可选，通过 toggle 开关控制）：

```css
.scanlines::after {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.03) 2px,
    rgba(0, 0, 0, 0.03) 4px
  );
  z-index: 9999;
}
```

---

## 4. 响应式设计

### 4.1 断点策略

| 断点           | 宽度范围        | 布局调整                       |
|----------------|-----------------|--------------------------------|
| Desktop        | ≥ 1200px        | 完整布局，侧边栏展开           |
| Laptop         | 960-1199px      | 侧边栏可折叠，主区域自适应     |
| Tablet         | 768-959px       | 侧边栏折叠为图标，顶栏精简     |
| Mobile         | < 768px         | 单列布局，底部导航栏           |

### 4.2 适配规则

**桌面端（≥ 1200px）**：
- 侧边栏完全展开，显示文字标签
- 证据板与对话终端可同时可见（分屏模式，可选）
- 未探索跟进节点图完整显示

**笔记本端（960-1199px）**：
- 侧边栏默认折叠为图标模式，hover 展开
- 主视图区域自适应宽度

**平板端（768-959px）**：
- 侧边栏折叠，底部添加快速位置切换栏
- 顶栏精简：隐藏游戏名称，仅显示 Logo 图标
- 证据板节点图缩小，改为可滚动的列表备选视图

**移动端（< 768px）**：
- 完全单列布局
- 底部 Tab 栏替代侧边栏导航
- 对话终端全屏，证据板为独立页面
- 倒计时器移至顶部状态栏
- 节点图隐藏，仅保留列表视图

### 4.3 触屏适配

- 所有可点击元素最小触控区域 44×44px
- 节点图支持双指缩放和单指平移
- 长按替代右键菜单
- 滑动切换代理标签页
- 下拉刷新日志列表

---

## 5. 无障碍设计（Accessibility）

### 5.1 键盘导航

完整的键盘操作映射：

| 快捷键          | 操作                             |
|-----------------|----------------------------------|
| `Ctrl+1`        | 切换到对话终端                   |
| `Ctrl+2`        | 切换到证据板                     |
| `Ctrl+3`        | 切换到站点日志                   |
| `Ctrl+4`        | 切换到报告提交（需已解锁）       |
| `Tab`           | 在可聚焦元素间循环               |
| `Enter`         | 发送消息 / 确认选择              |
| `Escape`        | 关闭面板 / 取消操作              |
| `↑` / `↓`       | 在消息历史中浏览 / 列表项导航    |
| `Alt+1~4`       | 快速切换位置                     |
| `Ctrl+F`        | 打开搜索（日志/对话内搜索）      |
| `?`             | 显示快捷键帮助面板               |

### 5.2 ARIA 标注

所有交互元素需添加适当的 ARIA 属性：

```html
<!-- 对话区域 -->
<div role="log" aria-live="polite" aria-label="与 HELIOS-7 的对话">
  <div role="article" aria-label="HELIOS-7 说">
    欢迎，调查员。
  </div>
</div>

<!-- 倒计时 -->
<div role="timer" aria-label="剩余调查时间" aria-live="assertive">
  31:22:07
</div>

<!-- 证据板 -->
<div role="application" aria-label="证据关系图">
  <div role="button" aria-label="线索: 通讯记录, 状态: 已确认"
       tabindex="0">
  </div>
</div>

<!-- 导航 -->
<nav role="navigation" aria-label="位置导航">
  <button aria-current="true" aria-label="当前位置: 气闸室">
    气闸室
  </button>
</nav>
```

### 5.3 屏幕阅读器支持

- 新消息到达时通过 `aria-live="polite"` 通知
- 倒计时进入新的紧迫等级时通过 `aria-live="assertive"` 通知
- 阶段过渡时播报阶段名称变更
- 线索发现时播报线索名称
- 所有图标按钮同时提供文字标签（视觉上可隐藏，通过 `.sr-only` 类）

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

### 5.4 色彩无障碍

- 所有色彩状态同时提供非色彩指示（图标、文字标签、边框样式）
- 已确认线索：绿色 + 实线边框 + ✓ 图标
- 争议线索：黄色 + 虚线边框 + ? 图标
- 隐藏线索：灰色 + 点线边框 + ○ 图标
- 对比度：所有文字与背景对比度 ≥ 4.5:1（WCAG AA）

---

## 6. 最小可运行原型

以下为对话终端界面的最小完整实现，单文件 HTML，可直接在浏览器中打开运行：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>赫利俄斯之链 — 调查终端</title>
<style>
  :root {
    --bg-base: #0A0E14;
    --bg-surface: #111820;
    --bg-elevated: #1A2332;
    --color-primary: #00FF96;
    --color-info: #00BFFF;
    --color-warning: #FFB800;
    --color-danger: #FF0044;
    --text-primary: #E0E8F0;
    --text-secondary: #8899AA;
    --border-default: #1E2D3D;
    --font-mono: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
    --glow-green: 0 0 8px rgba(0,255,150,0.3);
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 14px;
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  body::after {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: repeating-linear-gradient(
      0deg, transparent, transparent 2px,
      rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px
    );
    z-index: 9999;
  }
  .topbar {
    height: 48px;
    background: var(--bg-surface);
    border-bottom: 1px solid var(--border-default);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 16px;
    flex-shrink: 0;
  }
  .topbar .logo {
    color: var(--color-primary);
    font-size: 16px;
    text-shadow: var(--glow-green);
    letter-spacing: 2px;
  }
  .topbar .phase {
    color: var(--color-info);
    font-size: 13px;
    margin-left: auto;
  }
  .topbar .countdown {
    color: var(--color-primary);
    font-size: 15px;
    text-shadow: var(--glow-green);
    font-variant-numeric: tabular-nums;
  }
  .chat-area {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    scroll-behavior: smooth;
  }
  .chat-area::-webkit-scrollbar { width: 4px; }
  .chat-area::-webkit-scrollbar-track { background: var(--bg-base); }
  .chat-area::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 2px; }
  .message {
    display: flex;
    gap: 10px;
    max-width: 75%;
    animation: msg-in 0.3s ease forwards;
  }
  @keyframes msg-in {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .message.agent { align-self: flex-start; }
  .message.player { align-self: flex-end; flex-direction: row-reverse; }
  .msg-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
  }
  .agent .msg-avatar {
    background: rgba(0,191,255,0.15);
    border: 1px solid var(--color-info);
    color: var(--color-info);
  }
  .player .msg-avatar {
    background: rgba(0,255,150,0.1);
    border: 1px solid var(--color-primary);
    color: var(--color-primary);
  }
  .msg-content {
    background: var(--bg-surface);
    border: 1px solid var(--border-default);
    border-radius: 4px;
    padding: 10px 14px;
    line-height: 1.6;
  }
  .agent .msg-content { border-color: rgba(0,191,255,0.2); }
  .player .msg-content {
    background: var(--bg-elevated);
    border-color: rgba(0,255,150,0.2);
    color: var(--color-primary);
  }
  .msg-time {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 4px;
  }
  .typing {
    display: flex;
    gap: 4px;
    padding: 12px 14px;
    align-self: flex-start;
    margin-left: 42px;
  }
  .typing span {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--color-info);
    animation: pulse 1.2s ease-in-out infinite;
  }
  .typing span:nth-child(2) { animation-delay: 0.2s; }
  .typing span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse {
    0%,100% { opacity: 0.2; }
    50% { opacity: 1; }
  }
  .input-bar {
    height: 56px;
    background: var(--bg-surface);
    border-top: 1px solid var(--border-default);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 12px;
    flex-shrink: 0;
  }
  .input-bar .prompt {
    color: var(--color-primary);
    font-size: 16px;
    text-shadow: var(--glow-green);
  }
  .input-bar input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-family: var(--font-mono);
    font-size: 14px;
    caret-color: var(--color-primary);
  }
  .input-bar input::placeholder { color: var(--text-secondary); }
  .input-bar button {
    background: transparent;
    border: 1px solid var(--color-primary);
    color: var(--color-primary);
    font-family: var(--font-mono);
    font-size: 14px;
    padding: 6px 16px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .input-bar button:hover {
    background: rgba(0,255,150,0.1);
    box-shadow: var(--glow-green);
  }
  .input-bar button:disabled {
    opacity: 0.3;
    cursor: default;
    box-shadow: none;
  }
</style>
</head>
<body>
  <div class="topbar">
    <span class="logo">☀ 赫利俄斯之链</span>
    <span class="phase">阶段 1/3 — 调查</span>
    <span class="countdown" id="timer">31:22:07</span>
  </div>
  <div class="chat-area" id="chat">
    <div class="message agent">
      <div class="msg-avatar">H7</div>
      <div>
        <div class="msg-content">欢迎，调查员。我是 HELIOS-7，空间站管理代理。<br>我的日志对你开放。有什么需要了解的？</div>
        <div class="msg-time">03:14:22</div>
      </div>
    </div>
  </div>
  <div class="input-bar">
    <span class="prompt">&gt;</span>
    <input id="input" type="text" placeholder="输入你的问题..." autocomplete="off">
    <button id="sendBtn" onclick="sendMsg()">发送 ▶</button>
  </div>
<script>
const chat = document.getElementById('chat');
const input = document.getElementById('input');
const sendBtn = document.getElementById('sendBtn');
const timerEl = document.getElementById('timer');

// 简易倒计时（演示用，每秒减1游戏分钟）
let totalSec = 112927; // 31:22:07
setInterval(() => {
  if (totalSec <= 0) return;
  totalSec--;
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  timerEl.textContent = `${h}:${m}:${s}`;
}, 1000);

// 代理自动回复池
const replies = [
  '我正在检索相关日志...请稍候。',
  '这条记录似乎被加密了。你需要更高权限才能查看完整内容。',
  '根据我的分析，事故当晚有三次异常的指令链变更。',
  '传感器数据显示B-7区段在03:18出现气压波动，原因尚未确认。',
  '我建议你查阅医疗舱的药物分发记录，那里可能有重要线索。',
  '请注意，副工程师在事故前两小时获得了Level-3权限提升。这不寻常。',
];

function getTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function addMsg(text, type) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  const avatar = type === 'agent' ? 'H7' : '▸';
  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div>
      <div class="msg-content">${text}</div>
      <div class="msg-time">${getTime()}</div>
    </div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function showTyping() {
  const el = document.createElement('div');
  el.className = 'typing';
  el.id = 'typingIndicator';
  el.innerHTML = '<span></span><span></span><span></span>';
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

function hideTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function sendMsg() {
  const text = input.value.trim();
  if (!text) return;
  addMsg(text, 'player');
  input.value = '';
  sendBtn.disabled = true;
  showTyping();
  const delay = 1200 + Math.random() * 1800;
  setTimeout(() => {
    hideTyping();
    const reply = replies[Math.floor(Math.random() * replies.length)];
    addMsg(reply, 'agent');
    sendBtn.disabled = false;
    input.focus();
  }, delay);
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMsg();
  }
});
</script>
</body>
</html>
```

---

以上为《赫利俄斯之链》调查界面的完整设计规范。实现时应优先完成对话终端
与倒计时器核心功能，再逐步添加证据板、日志查看器与报告提交等模块。
视觉风格的一致性（终端美学、色彩系统、扫描线效果）应贯穿开发全程。
