# 赫利俄斯之链 - 开发文档 #08 · 2D 平面版本改造

## 发送方

霖 + 杨博（游戏设计组）

## 接收方

helios工坊（游戏开发Agent）

---

## 一、背景与动机

### 1.1 问题

dev-brief-07 引入了机器人自由活动系统--三台机器人在站内按行为循环移动位置，玩家通过侧边栏文字导航在各地点之间穿梭。但实际体验暴露出两个问题：

1. **空间感缺失**：机器人"在不在当前地点"只能靠一行情境文字告诉玩家，玩家看不到它们在哪、在做什么、移动到了哪里。开放世界的核心魅力是"看到 agent 在世界中活动"，纯文字列表把这种魅力抹掉了。
2. **对话框与开放世界割裂**：当前布局是"左侧导航 + 右侧大对话框"，玩家在一个固定位置打字问机器人，跟"在走廊里走动找机器人"的设定完全脱节。移动变成了机械的菜单点击，没有探索感。

### 1.2 方案

将站点改为 **2D 俯视平面地图**，玩家角色以光标/图标形式在地图上走动，机器人实时可见。对话改为 **位置触发的浮动面板**--走到机器人身边才能对话，离开即结束。

不是从零重写：`data.js` 中的对话脚本、线索系统、关键词映射、结局判定、Agent Prompt 等核心逻辑全部保留；只重构 **视觉层 + 交互层**。

### 1.3 旧版本保留

现有版本（终端导航版）原地保留，不修改。2D 版本部署在 `v2d/` 目录下，拥有独立入口文件 `v2d/index.html`。两版本共享 `js/data.js`（通过相对路径引用），各自拥有独立的 `game.js` 和 `style.css`。

---

## 二、文件结构

```
L:\HELIOS\
├── index.html              ← 旧版入口（终端导航版，保留不动）
├── css/
│   └── style.css           ← 旧版样式（保留不动）
├── js/
│   ├── data.js             ← 共享数据层（两版本共用，不修改）
│   └── game.js             ← 旧版引擎（保留不动）
├── v2d/                    ← ★ 2D 平面版（本轮新建）
│   ├── index.html          ← 2D 版入口
│   ├── style.css           ← 2D 版样式（地图 + 浮动面板）
│   └── game.js             ← 2D 版引擎（地图渲染 + 角色移动 + 对话面板）
├── dev-briefs/
│   └── dev-brief-08.md     ← 本文档
└── ...（其他文件不变）
```

**关键约定**：
- `v2d/game.js` 通过 `../js/data.js` 引用共享数据，**不复制 data.js**
- `v2d/game.js` 复用旧版 `game.js` 中的核心方法逻辑（对话处理、线索系统、结局判定等），通过复制必要方法到新文件实现，不 import 旧版
- 旧版 `index.html` / `css/style.css` / `js/game.js` **一律不动**

---

## 三、2D 站点地图设计

### 3.1 地图布局

站点为俯视平面图，用 CSS Grid 或绝对定位实现。六个地点按以下拓扑排列（走廊为中心枢纽）：

```
┌─────────────────────────────────────────────┐
│                  赫利俄斯站                    │
│                                              │
│   ┌──────────┐         ┌──────────┐         │
│   │  医疗舱   │         │  气闸室   │         │
│   │  medbay  │         │ airlock  │         │
│   └────┬─────┘         └────┬─────┘         │
│        │                    │               │
│        └────────┐  ┌────────┘               │
│                 │  │                        │
│              ┌──┴──┴──┐                     │
│              │  走廊   │                     │
│              │corridor│                     │
│              └──┬──┬──┘                     │
│        ┌────────┘  └────────┐               │
│        │                    │               │
│   ┌────┴─────┐         ┌────┴─────┐         │
│   │  工程舱   │         │ 数据终端  │         │
│   │engineering│        │data_term.│         │
│   └──────────┘         └──────────┘         │
│                                              │
│              ┌──────────┐                   │
│              │  生活舱   │                   │
│              │ habitat  │                   │
│              └──────────┘                   │
└─────────────────────────────────────────────┘
```

### 3.2 地图实现方案

**方案：CSS 绝对定位 + Canvas 背景网格**

- 地图容器：固定宽高比（16:9 或 4:3），居中显示在主视图区
- 背景层：CSS 绘制深色网格线（模拟空间站蓝图），各舱室用半透明色块 + 边框表示
- 舱室块：绝对定位的 `div`，含图标 + 名称，hover 高亮
- 走廊：连接各舱室的通道区域，用较暗的色块表示
- **不用图片资源**，纯 CSS + 等宽字符绘制，保持终端美学一致性

### 3.3 舱室坐标定义

在 `v2d/game.js` 中为每个地点定义屏幕坐标（百分比，便于响应式）：

```js
const MAP_LAYOUT = {
  medbay:        { x: 18, y: 15, w: 22, h: 25, icon: '✚', name: '医疗舱' },
  airlock:       { x: 60, y: 15, w: 22, h: 25, icon: '⬡', name: '气闸室' },
  corridor:      { x: 35, y: 38, w: 30, h: 24, icon: '═', name: '走廊' },
  engineering:   { x: 18, y: 60, w: 22, h: 25, icon: '⚙', name: '工程舱' },
  data_terminal: { x: 60, y: 60, w: 22, h: 25, icon: '▤', name: '数据终端' },
  habitat:       { x: 38, y: 78, w: 24, h: 18, icon: '⌂', name: '生活舱' },
};
```

坐标为相对于地图容器的百分比，`x/y` 为左上角，`w/h` 为宽高。

---

## 四、角色与机器人可视化

### 4.1 玩家角色

- 在地图上显示为 **琥珀色圆点 + 调查员标签**（`◉ 调查员`）
- 玩家移动时圆点平滑过渡到目标位置（CSS transition 0.4s）
- 玩家始终位于"当前地点"的坐标范围内

### 4.2 机器人角色

三台机器人在地图上实时显示位置：

| 机器人 | 图标 | 颜色 | 显示方式 |
|--------|------|------|---------|
| R-7 | `R7` | 青蓝 `#4ecdc4` | 圆形标签 + 当前行为缩写 |
| S-3 | `S3` | 暖白 `#e8a540` | 圆形标签 + 当前行为缩写 |
| D-5 | `D5` | 暗红 `#c0392b` | 圆形标签 + 当前行为缩写 |

- 机器人位置由 `robot_behaviors` 行为循环驱动（复用现有逻辑）
- 机器人移动时标签平滑过渡到新舱室（CSS transition 0.6s）
- 机器人标签下方显示当前行为（如"检查密封圈""监测生命体征"），字体小、颜色暗
- 玩家当前地点内的机器人标签高亮（加边框/发光），非当前地点的机器人标签暗淡

### 4.3 副工程师

陈远固定在工程舱（`engineering`），不移动。显示为灰色方块标签 `陈`。

### 4.4 机器人行为缩写映射

将 `robot_behaviors` 中的 `action` 字段映射为短文本显示在地图上：

```js
const ACTION_SHORT = {
  examining_seal: '查密封圈',
  reviewing_logs: '复查日志',
  patrolling: '巡逻中',
  standby: '待机',
  monitoring_vitals: '监测体征',
  checking_equipment: '查设备',
  processing_logs: '处理日志',
  data_collection: '采集数据',
};
```

---

## 五、交互模型

### 5.1 移动

- **点击地图上的舱室** -> 玩家角色移动到该舱室
- 移动消耗游戏时间（复用现有 `moveToLocation` 逻辑，2-5 分钟/次）
- 移动时机器人行为循环同步推进（复用 `advanceRobotCycles`）
- 只能移动到与当前地点相连的地点（`location_connections` 限制）
- 不可达的舱室显示为暗淡 + 点击无响应（或提示"需要经过走廊"）

### 5.2 对话触发

- 玩家进入某舱室后，如果该舱室有机器人/副工程师，**机器人标签变为可点击状态**（发光/脉冲动画）
- 点击机器人标签 -> 弹出 **浮动对话面板**（右侧滑入或底部弹出）
- 对话面板包含：NPC 头像/名称 + 对话记录区 + 输入框
- 对话期间玩家角色"锁定"在当前舱室，不能移动（或移动即关闭对话）
- 关闭对话面板 -> 回到地图视图

### 5.3 对话面板布局

```
┌──────────────────────────────────┐
│  R-7 · 工程助理机器人        [×]  │  ← 头部：NPC 名称 + 关闭按钮
├──────────────────────────────────┤
│                                  │
│  > R-7: 概率计算显示0.3%...      │  ← 对话记录区（可滚动）
│  > 你: 警报后来怎么了？          │
│  > R-7: 工程师在第17秒...        │
│                                  │
├──────────────────────────────────┤
│  > [输入框]_____________ [发送]  │  ← 输入行
├──────────────────────────────────┤
│  [指控 R-7]                      │  ← 阶段二解锁
└──────────────────────────────────┘
```

- 对话面板以 **overlay** 形式浮在地图上方（不离开地图页面）
- 宽度约 380-420px，高度约 60-70% 视口高度
- 面板从右侧滑入（`translateX` 动画），关闭时滑出
- 对话记录区、输入框样式复用旧版终端美学（等宽字体、琥珀色光标等）

### 5.4 地点互动

气闸室和医疗舱的环境互动保留（检查撞击痕迹、查看操作台、查看生命体征）：

- 进入这些舱室后，地图上显示 **互动点标记**（琥珀色闪烁小图标）
- 点击互动点 -> 在对话面板区域显示第一人称观察文字（复用 `handleLocationInteract` 的文本）
- 消耗游戏时间

### 5.5 数据终端

- 点击地图上的"数据终端"舱室 -> 切换到数据终端视图（日志 + 时间线子标签）
- 数据终端视图以 **全屏覆盖** 或 **大面板** 形式展开，与旧版布局一致
- 关闭数据终端 -> 返回地图视图
- 数据终端内部逻辑（日志查看、时间线渲染）完全复用旧版

### 5.6 生活舱休息

- 进入生活舱后，如果满足阶段跳过条件，显示"休息"按钮
- 点击休息 -> 显示叙事文字 -> 跳转时间 -> 机器人位置刷新
- 逻辑复用 `canRestToNextPhase` + `restToNextPhase`

### 5.7 证据板 / 报告提交

- 通过顶栏 tab 切换（与旧版一致）
- 证据板：全屏视图，展示已发现的线索卡片 + 关联日志
- 报告提交：全屏视图，自由文本编辑器 + 提交
- 两者从地图视图切出，关闭后返回地图

---

## 六、布局架构

### 6.1 整体页面结构

```
┌──────────────────────────────────────────────────┐
│  HELIOS STATION · INVESTIGATION TERMINAL          │  ← 顶栏（复用）
│  倒计时: 32:14:07  │  阶段: 交叉验证  │  [地图] [证据] [终端] [报告]  │
├──────────────────────────────────────────────────┤
│                                                   │
│                                                   │
│              ┌─────────────────────┐              │
│              │                     │              │
│              │     2D 站点地图      │              │  ← 主视图区
│              │   （角色 + 机器人    │              │     （地图视图为默认）
│              │    实时位置可视化）   │              │
│              │                     │              │
│              └─────────────────────┘              │
│                                                   │
│  [当前地点: 走廊]  [可对话: 无人]                  │  ← 底部状态栏（可选）
├──────────────────────────────────────────────────┤
│  > [玩家输入光标]_              （仅对话时可见）   │  ← 输入行（仅对话面板内）
└──────────────────────────────────────────────────┘
```

### 6.2 倒计时位置

倒计时从侧边栏移到 **顶栏中央**，始终可见。侧边栏取消（2D 版不需要文字导航列表）。

### 6.3 视图切换

| 视图 | 触发方式 | 显示方式 |
|------|---------|---------|
| 地图（默认） | 顶栏"地图"tab / 关闭对话面板 | 全屏地图 |
| 对话面板 | 点击地图上的机器人 | 右侧浮动面板（地图仍可见但暗淡） |
| 证据板 | 顶栏"证据"tab | 全屏覆盖 |
| 数据终端 | 顶栏"终端"tab / 点击地图数据终端舱室 | 全屏覆盖 |
| 报告提交 | 顶栏"报告"tab | 全屏覆盖 |
| 结局 | 报告提交 / 超时 | 全屏覆盖 |

---

## 七、视觉风格延续

### 7.1 保持终端美学

2D 版不改变整体视觉基调，仍然是冷感终端风格：

- 深黑背景 `#0a0a0f`
- 等宽字体
- CRT 扫描线效果保留
- 色彩方案不变（琥珀强调、青蓝数据、暗红危险）

### 7.2 地图视觉细节

- 地图背景：深色蓝图风格，网格线 `rgba(78, 205, 196, 0.05)`
- 舱室块：半透明背景 `rgba(17, 24, 32, 0.8)`，边框 `#1e2d3d`
- 当前舱室：边框高亮为青蓝 `#4ecdc4`，微微发光
- 可达舱室：边框 `#2a3f55`，hover 变亮
- 不可达舱室：边框 `#1e2d3d`，整体暗淡 `opacity: 0.4`
- 走廊通道：比舱室更暗的色块，用虚线边框区分
- 角色标签：等宽字体，带圆角背景，颜色按角色设定

### 7.3 动画

| 元素 | 动画 | 时长 |
|------|------|------|
| 玩家移动 | `transition: all 0.4s ease` | 0.4s |
| 机器人移动 | `transition: all 0.6s ease` | 0.6s |
| 可对话机器人 | `animation: pulse-glow 2s infinite` | 脉冲发光 |
| 对话面板滑入 | `transform: translateX(100%) -> 0` | 0.3s |
| 互动点 | `animation: blink 1.5s infinite` | 琥珀闪烁 |

---

## 八、代码复用策略

### 8.1 从旧版 game.js 复用的方法（直接复制到 v2d/game.js）

| 方法 | 用途 | 是否需要修改 |
|------|------|-------------|
| `initConversations()` | 初始化对话记录 | 否 |
| `initRobotCycles()` | 初始化机器人行为循环 | 否 |
| `advanceRobotCycles()` | 推进机器人行为循环 | 否 |
| `getRobotsAtLocation()` | 获取某地点的机器人 | 否 |
| `canRestToNextPhase()` | 判断是否可休息跳阶段 | 否 |
| `selectNPC()` | 选择 NPC 开始对话 | 微调（触发面板而非视图切换） |
| `renderDialogueArea()` | 渲染对话记录 | 否（渲染目标改为面板内容器） |
| `renderDialogueOptions()` | 渲染对话选项/指控按钮 | 微调（容器改为面板内） |
| `handlePlayerInput()` | 处理玩家输入 | 否 |
| `classifyIntent()` | 意图分类器 | 否 |
| `matchKeywords()` | 关键词匹配 | 否 |
| `handleSoftTrack()` | 软轨 LLM 对话 | 否 |
| `getScriptedResponse()` | 副工程师脚本对话 | 否 |
| `injectSharedContext()` | Agent 共享记忆注入 | 否 |
| `updateSharedContext()` | 更新共享记忆 | 否 |
| `extractTopic()` | 提取话题关键词 | 否 |
| `callLLM()` | 调用 DeepSeek API | 否 |
| `getFallbackResponse()` | 降级回复 | 否 |
| `appendPlayerMessage()` | 追加玩家消息 | 微调（目标容器改） |
| `appendNPCMessage()` | 追加 NPC 消息 | 微调（目标容器改） |
| `showTypingIndicator()` | 打字指示器 | 微调（目标容器改） |
| `removeTypingIndicator()` | 移除打字指示器 | 否 |
| `discoverClue()` | 发现线索 | 否 |
| `checkKeywordClues()` | 关键词线索检查 | 否 |
| `renderEvidenceBoard()` | 渲染证据板 | 否 |
| `renderClueRelated()` | 线索关联渲染 | 否 |
| `renderLogViewer()` | 渲染日志查看器 | 否 |
| `renderTimeline()` | 渲染时间线 | 否 |
| `switchDataSubTab()` | 数据终端子标签切换 | 否 |
| `initiateAccusation()` | 发起指控 | 否 |
| `submitReport()` | 提交报告 | 否 |
| `evaluateReport()` | 报告评估 | 否 |
| `triggerEnding()` | 触发结局 | 否 |
| `getSacrificeText()` | 牺牲遗言 | 否 |
| `renderSacrificeChoice()` | 格式化选择 | 否 |
| `showSuccessCredits()` | 成功结局字幕 | 否 |
| `playCutscene()` | 过场动画 | 否 |
| `consumeTime()` | 消耗游戏时间 | 否 |
| `getTimeStr()` | 时间格式化 | 否 |
| `escape()` | HTML 转义 | 否 |
| `startGameLoop()` | 游戏主循环 | 否 |
| `updateGameTime()` | 更新游戏时间 | 否 |
| `updateCountdownDisplay()` | 更新倒计时显示 | 否 |
| `checkPhaseTransition()` | 检查阶段转换 | 否 |
| `transitionToPhase()` | 阶段转换 | 微调（不需 accusePanel） |
| `showPhaseTransition()` | 阶段过渡动画 | 否 |
| `unlockView()` | 解锁视图 | 否 |
| `showFirstTimeGuide()` | 首次对话引导 | 微调（容器改） |
| `updateInputPlaceholder()` | 更新输入提示 | 否 |

### 8.2 需要重写的方法

| 方法 | 原因 |
|------|------|
| `init()` | 初始化流程不同（渲染地图而非导航列表） |
| `cacheElements()` | DOM 结构不同 |
| `bindEvents()` | 事件绑定不同（地图点击 vs 导航列表点击） |
| `moveToLocation()` | 改为地图上角色移动 + 视觉反馈 |
| `renderLocationView()` | 改为渲染地图视图 |
| `renderLocations()` | 改为渲染地图舱室（不再有侧边栏导航） |
| `renderNPCList()` | 取消（NPC 在地图上直接可见） |
| `renderTerminalHeader()` | 取消或改为对话面板头部 |
| `switchView()` | 视图切换逻辑不同（地图/面板/全屏覆盖） |
| `handleLocationInteract()` | 交互触发改为地图上的互动点 |
| `restToNextPhase()` | 触发方式改为生活舱内的按钮 |

### 8.3 新增的方法

| 方法 | 用途 |
|------|------|
| `renderMap()` | 渲染 2D 地图（舱室 + 通道 + 角色） |
| `renderRobotsOnMap()` | 在地图上渲染机器人位置 + 行为标签 |
| `renderPlayerOnMap()` | 在地图上渲染玩家位置 |
| `movePlayerTo(locId)` | 玩家角色移动动画 + 时间消耗 + 机器人循环推进 |
| `openDialoguePanel(npcId)` | 打开浮动对话面板 |
| `closeDialoguePanel()` | 关闭浮动对话面板 |
| `renderInteractPoints()` | 在当前舱室渲染互动点标记 |
| `updateMapHighlights()` | 更新舱室高亮（可达/不可达/当前） |

---

## 九、index.html 结构

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>HELIOS STATION · 2D</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

<!-- CRT 扫描线 -->
<div id="crt-overlay"></div>

<!-- 顶栏 -->
<header id="top-bar">
  <div class="logo">HELIOS STATION</div>
  <div class="countdown-box">
    <span class="countdown-label">TIME</span>
    <span class="countdown-time" id="countdown-time">48:00:00</span>
  </div>
  <div class="phase-indicator">...</div>
  <div class="view-tabs">
    <button class="tab-btn active" data-view="map">地图</button>
    <button class="tab-btn locked" data-view="evidence">证据板</button>
    <button class="tab-btn" data-view="logs">数据终端</button>
    <button class="tab-btn locked" data-view="report">报告提交</button>
  </div>
</header>

<!-- 主视图 -->
<div id="main-view">
  <!-- 地图视图（默认） -->
  <section id="v-map" class="view active">
    <div id="map-container">
      <!-- 舱室、角色、机器人由 JS 渲染 -->
    </div>
    <div id="map-status">
      <!-- 当前地点 / 可对话对象 状态提示 -->
    </div>
  </section>

  <!-- 证据板（全屏覆盖） -->
  <section id="v-evidence" class="view">...</section>

  <!-- 数据终端（全屏覆盖） -->
  <section id="v-logs" class="view">...</section>

  <!-- 报告提交（全屏覆盖） -->
  <section id="v-report" class="view">...</section>
</div>

<!-- 浮动对话面板（overlay） -->
<div id="dialogue-panel" class="hidden">
  <div class="dialogue-panel-header">
    <span id="dp-npc-name"></span>
    <button id="dp-close">[×]</button>
  </div>
  <div class="dialogue-panel-body" id="dp-messages"></div>
  <div class="dialogue-panel-options" id="dp-options"></div>
  <div class="dialogue-panel-input">
    <span class="input-prompt">&gt;</span>
    <input type="text" id="dp-input" autocomplete="off">
    <button id="dp-send">发送</button>
  </div>
</div>

<!-- 阶段过渡 / 过场 / 结局覆盖层 -->
<div id="phase-transition"></div>
<div id="cutscene-overlay"></div>
<div id="ending-screen"></div>

<!-- 共享数据 + 2D 引擎 -->
<script src="../js/data.js"></script>
<script src="game.js"></script>
</body>
</html>
```

**注意**：2D 版不包含开场 CG 覆盖层（`#cg-overlay`）。CG 播放逻辑改为：可选地在 `init()` 前检查 `video/CUTSCENE_ARRIVAL.mp4` 是否存在，存在则播放，不存在直接进入。如需保留 CG，可后续补入。

---

## 十、数据层不变项

以下 `data.js` 中的数据结构 **2D 版直接复用，不修改**：

- `dialogue` - 对话脚本 + Agent Prompt
- `keyword_clue_map` - 关键词线索映射
- `clues` - 线索数据
- `logs` - 日志数据
- `timeline_events` - 时间线事件
- `cross_validation` - 交叉验证逻辑
- `endings` - 结局数据
- `cutscenes` - 过场动画数据
- `locations` - 地点定义（id/name/icon/desc）
- `robot_behaviors` - 机器人行为循环
- `location_descriptions` - 地点描述文本
- `location_connections` - 地点连接关系
- `shared_agent_context` - Agent 共享记忆初始结构
- `semantic_keywords` - 语义匹配关键词
- `time_config` - 时间配置
- `llm_config` - DeepSeek API 配置

唯一新增数据：`MAP_LAYOUT` 坐标定义和 `ACTION_SHORT` 行为缩写映射，写在 `v2d/game.js` 中（不修改 data.js）。

---

## 十一、验收标准

| # | 功能 | 验收方式 |
|---|------|---------|
| 1 | 旧版本不受影响 | 打开 `index.html`（旧版入口），游戏正常运行，与改造前完全一致 |
| 2 | 2D 版独立入口 | 打开 `v2d/index.html`，显示 2D 地图视图，6 个舱室可见 |
| 3 | 玩家移动 | 点击相邻舱室，玩家角色移动到该舱室，消耗游戏时间，倒计时减少 |
| 4 | 机器人可见 | 三台机器人 + 副工程师在地图上可见，位置随行为循环实时变化 |
| 5 | 机器人行为标签 | 机器人下方显示当前行为缩写（如"查密封圈""待机"） |
| 6 | 对话触发 | 点击同舱室内的机器人，浮动对话面板从右侧滑入 |
| 7 | 对话功能 | 在对话面板中自由打字提问，机器人正常回复（硬轨关键词 + 软轨 DeepSeek/降级） |
| 8 | 对话关闭 | 点击 [×] 或移动到其他舱室，对话面板关闭 |
| 9 | 共享记忆 | 跟 D-5 聊完参数错误 -> 去找 S-3 -> S-3 在对话中引用 D-5 透露的信息 |
| 10 | 互动点 | 气闸室显示"检查撞击痕迹""查看操作台"互动点，点击显示观察文字 |
| 11 | 数据终端 | 点击数据终端舱室或顶栏 tab，进入数据终端视图（日志 + 时间线） |
| 12 | 证据板/报告 | 顶栏切换到证据板/报告提交视图，功能正常 |
| 13 | 休息跳阶段 | 进入生活舱，满足条件后显示休息按钮，点击跳到下一阶段 |
| 14 | 阶段过渡 | 阶段一->二->三正常过渡，证据板/报告 tab 依次解锁 |
| 15 | 结局触发 | 提交报告触发对应结局（大成功/坏结局/超时），结局序列正常播放 |
| 16 | 终端美学 | 整体视觉保持深色背景 + 等宽字体 + CRT 扫描线 + 琥珀/青蓝配色 |

---

## 十二、优先级

**P0（核心，必须完成）**：
- 地图渲染 + 玩家移动
- 机器人在地图上实时显示
- 浮动对话面板 + 对话功能
- 旧版本不受影响

**P1（重要，应完成）**：
- 地点互动点（气闸室/医疗舱）
- 数据终端入口
- 阶段过渡 + 休息跳阶段
- 证据板 / 报告提交视图

**P2（锦上添花，可后续迭代）**：
- 机器人移动动画平滑度优化
- 地图视觉细节打磨（蓝图风格、通道渲染）
- 开场 CG 接入
- 响应式适配

---

## 十三、技术注意事项

1. **不修改 `js/data.js`**：2D 版通过 `../js/data.js` 引用，如需新增数据（`MAP_LAYOUT`、`ACTION_SHORT`），写在 `v2d/game.js` 中。

2. **不修改旧版文件**：`index.html`、`css/style.css`、`js/game.js` 保持原样。如果之前修复的 `renderLocations` bug 需要同步到旧版，那是独立操作，与本轮无关。

3. **CSS 独立**：`v2d/style.css` 从零编写，不 import 旧版 `css/style.css`。设计 token（颜色变量、字体）在 `v2d/style.css` 的 `:root` 中重新声明，保持一致。

4. **file:// 协议兼容**：2D 版同样需要支持 `file://` 直接打开。不使用 fetch 加载外部文件，所有数据通过 `<script>` 标签加载。

5. **DeepSeek API Key**：`data.js` 中的 `llm_config` 已包含 API Key，2D 版直接复用，无需额外配置。

6. **地图性能**：机器人位置更新通过 CSS `transition` 实现，不用 JS 动画循环。只在 `consumeTime` / `moveToLocation` 时更新机器人 DOM 位置。

---

> 以上。旧版本保留，2D 版以独立目录部署。数据层完全复用，只重构视觉层和交互层。
>
> 工坊可以开工了。
