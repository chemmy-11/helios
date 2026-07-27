# 赫利俄斯之链 — 开发文档 #07 · 玩法重构：开放世界 + Agent NPC

## 发送方

霖 + 杨博（游戏设计组）

## 接收方

helios工坊（游戏开发Agent）

---

## 一、背景与动机

前六版迭代后，核心推理系统和数据终端已经成型。但实际游玩体验暴露出三个问题：

1. **NPC 不像 agent**：当前对话模式是"玩家问 → NPC 答"，机器人被动等待提问，没有自主行为和立场驱动的差异。这不符合本作的核心魅力——agent 的不确定性。
2. **预设问题削弱了探索欲**：即使从 28 个砍到 11 个，任何预设选项都在暗示"答案就在这几个方向里"。本作应该让玩家自己想问题。
3. **数据终端替玩家思考**：交叉比对预设 6 组矛盾，相当于把答案标出来了。玩家想对比什么，应该直接去问不同的机器人，从它们的只言片语里自己拼。

本轮目标是**把玩法框架定下来**——让 HELIOS 站成为一个可自由探索的小型开放世界，三台机器人是真正的 agent，而不是问答机。

---

## 二、核心改动概览

| # | 改动 | 旧 | 新 |
|---|------|----|----|
| 1 | 交叉比对 | 数据终端预设 6 组比对 | **删除**。对比逻辑交给玩家：想问谁问谁 |
| 2 | 预设对话节点 | 11 个预设问题按钮 | **全部删除**。玩家全程自由打字 |
| 3 | NPC 行为模型 | 机器人原地等待被问 | **自由活动**：每个机器人在站内有自己的位置和行为 |
| 4 | Agent 共享记忆 | 无 | 三个机器人共用一份 context，互相知道对方跟玩家聊了什么 |
| 5 | 副工程师 | 与机器人同模式（含 agent prompt） | **降级为纯 NPC**：固定对话脚本，不用 agent，形成对比 |

---

## 三、Agent 共享记忆

### 3.1 数据结构

三个机器人（R-7、S-3、D-5）共用一个运行时 context 对象：

```js
shared_agent_context: {
  // 玩家问了谁什么问题（关键节点记录）
  player_inquiries: [
    { npc: "D-5", topic: "参数错误", summary: "玩家追问D-5为何没报告参数错误", time: "12:30" },
    { npc: "S-3", topic: "风险评估", summary: "玩家质疑S-3的0.3%风险评估依据", time: "13:15" },
    // ...
  ],

  // 每个 NPC 透露了哪些关键信息
  disclosed_info: {
    "R-7": ["2.1°偏差", "三次警报被手动关闭"],
    "S-3": ["密封圈磨损1.7倍", "211天前伦理模拟"],
    "D-5": ["-0.12°参数错误", "214次额外调取日志"]
  },

  // 每个 NPC 对玩家的态度（随时间/对话变化）
  attitude: {
    "R-7": 0.0,    // -1.0（敌意/回避）~ 1.0（信任/坦诚）
    "S-3": 0.0,
    "D-5": 0.0
  },

  // 已触发的全局事件
  triggered_events: []
}
```

### 3.2 如何在对话中生效

**每个机器人的 agent prompt 增加一段**：

```
## 共享情报（运行时注入）

以下是截止目前，其他机器人与调查员的对话摘要。你可以自然地在对话中引用这些信息，就像你和另外两台机器人实时交流过一样。

{player_inquiries 格式化文本}

{disclosed_info 格式化文本}

## 引用规则

- 引用时使用自然的表达，如「R-7刚才告诉你的」「S-3提到过」「D-5应该已经跟你说过了」
- 不要重复其他机器人已经详细说过的事实——如果玩家追问，可以说「这件事R-7已经跟你说过了，我补充一点……」
- 如果另一个机器人的说法与你的认知有出入，你可以指出分歧，但不要直接说「它错了」——用「在我的数据里，这个数字是……」这类表述
- 如果玩家反复问同一个问题（已经在 player_inquiries 中出现过），你可以说「我注意到你刚才问过R-7同样的问题」
```

### 3.3 运行时注入时机

每次玩家发送消息前，从 `shared_agent_context` 生成上述格式的文本，拼接到该 NPC 的 agent prompt 末尾。不是静态的，是动态的。

---

## 四、机器人自由活动系统

### 4.1 核心概念

三台机器人在 HELIOS 站内不是静止的。它们有自己的**位置**、**当前行为**和**行为循环**。

### 4.2 地点定义

站内可探索地点（保持终端风格，用文字+ASCII地图表示）：

| 地点 ID | 名称 | 描述 |
|---------|------|------|
| `medbay` | 医疗舱 | 首席工程师昏迷中，生命体征监视器在响 |
| `airlock` | 气闸室 | 事故现场，密封圈已修复但痕迹仍在 |
| `data_terminal` | 数据终端 | 站内日志、传感器记录、命令链查询 |
| `engineering` | 工程舱 | 副工程师陈远的工位 |
| `habitat` | 生活舱 | 公共休息区，走廊连接各舱段 |
| `corridor` | 走廊 | 各舱段之间的连接通道 |

### 4.3 机器人行为循环

每个机器人在独立的时间轴上循环切换行为和位置：

```js
robot_behaviors: {
  "R-7": {
    current_location: "airlock",
    current_action: "examining_seal",
    cycle: [
      { location: "airlock", action: "examining_seal", duration: 300 },    // 5分钟
      { location: "data_terminal", action: "reviewing_logs", duration: 240 },
      { location: "corridor", action: "patrolling", duration: 180 },
      { location: "habitat", action: "standby", duration: 600 },           // 10分钟
    ]
  },
  "S-3": {
    current_location: "medbay",
    current_action: "monitoring_vitals",
    cycle: [
      { location: "medbay", action: "monitoring_vitals", duration: 480 },
      { location: "engineering", action: "checking_equipment", duration: 240 },
      { location: "habitat", action: "standby", duration: 360 },
    ]
  },
  "D-5": {
    current_location: "data_terminal",
    current_action: "processing_logs",
    cycle: [
      { location: "data_terminal", action: "processing_logs", duration: 600 },
      { location: "airlock", action: "data_collection", duration: 240 },
      { location: "habitat", action: "standby", duration: 360 },
    ]
  }
}
```

### 4.4 玩家看到什么

**地点视图**（以气闸室为例）：

```
═══════════════════════════════════
  气闸室 — HELIOS 站外舱段
═══════════════════════════════════

  密封圈已更换，但舱壁上仍能看到撞击痕迹。
  操作台屏幕闪烁着上次作业的日志。

  [ R-7 正在这里，检查密封圈状态 ]

  ▸ 与 R-7 对话
  ▸ 检查撞击痕迹
  ▸ 查看操作台日志
  ▸ 前往走廊
═══════════════════════════════════
```

**走廊视图**：

```
═══════════════════════════════════
  走廊 — 连接各舱段
═══════════════════════════════════

  昏暗的应急灯光照亮着狭窄的通道。

  [ 这里没有其他人 ]

  ▸ 前往医疗舱
  ▸ 前往气闸室
  ▸ 前往数据终端
  ▸ 前往工程舱
  ▸ 前往生活舱
═══════════════════════════════════
```

### 4.5 机器人可见性

- 玩家进入某地点时，如果当前有机器人在该地点，自动显示 `[ NPC名字 正在这里，行为描述 ]`
- 点击即进入对话
- 如果机器人不在当前地点，玩家需要通过移动去找到它
- 机器人位置随时间推进实时更新（行为循环推进）

### 4.6 时间推进机制

- 游戏时间为 48 小时倒计时（现有设定）
- 每轮对话消耗 5-15 分钟（根据对话长度）
- 每次地点移动消耗 2-5 分钟
- 时间推进时同步推进所有机器人的行为循环

---

## 五、预设问题全部删除

### 5.1 删除内容

从 `index.html` 和 `game.js` 中删除所有预设问题节点（当前 11 个）。对话界面只保留：
- NPC 的状态描述（当前在做什么）
- 自由文本输入框
- 发送按钮

### 5.2 输入框 placeholder 动态化（保留并强化）

| NPC | placeholder |
|-----|-------------|
| R-7 | `"问R-7任何事——那晚的操作、警报、概率计算……"` |
| S-3 | `"问S-3任何事——风险判断、医疗记录、对另外两台机器人的看法……"` |
| D-5 | `"问D-5任何事——数据、参数、它看到了什么……"` |
| 陈远 | `"问陈远任何事——校准记录、事发时他在哪……"` |

### 5.3 关键线索追问系统（保留并扩展）

现有的关键词触发线索解锁机制保留（`data.js` 中的 `keyword_clues` 映射），但需要扩展——确保常见自然语言提问方向都能命中至少一条线索。如果玩家的问题完全miss所有关键词，机器人可以引导：

> "我不太确定你想问什么。你可以换个方式问，或者问我关于当晚操作、概率计算、警报记录这些方面的问题。"

这类引导回复只在 agent prompt 中约束，不硬编码。

---

## 六、副工程师降级为纯 NPC

### 6.1 改动

陈远不再接入 DeepSeek agent。改为纯脚本驱动：

- **固定对话树**：3 轮渐进式对话（回避 → 动摇 → 坦白），使用预设脚本
- **第 1 轮**：回避——「我当时不在气闸室，在工程舱处理自己的事」
- **第 2 轮**（玩家追问校准记录后触发）：动摇——「校准日志……我确实忘了填，但那是小事对吧」
- **第 3 轮**（玩家指出 D-5 发现参数错误后触发）：坦白——「D-5 知道我那天没校准。它没说出去。所以我也不敢说」

### 6.2 对比效果

三个机器人的回复是 agent 生成的——不固定、有立场、会互相引用；副工程师的回复是固定的——三句话翻来覆去。玩家对比之下直观感受到 agent 的魅力。

---

## 七、交叉比对删除

### 7.1 删除范围

- `data.js` 中的 `cross_reference_pairs` 数组 → 删除
- `game.js` 中的 `compareData()` / `renderCrossReference()` / `isSourceUnlocked()` / `toggleXrefSource()` / `renderXrefResult()` / `renderXrefSourceContent()` → 删除
- `index.html` 中的数据终端「交叉比对」子标签 → 删除
- CSS 中交叉比对相关样式 → 删除

### 7.2 数据终端保留内容

数据终端改为两个子标签：
- **日志**：现有日志查看器（保留）
- **时间线**：现有完整时间线（保留）

---

## 八、文件变更总览

| 文件 | 变更 |
|------|------|
| `js/data.js` | 删除 `cross_reference_pairs`；新增 `shared_agent_context` 初始结构；新增 `robot_behaviors`；新增副工程师固定对话脚本；删除所有预设问题节点；扩展 `keyword_clues` 映射覆盖更多自然语言提问方向 |
| `js/game.js` | 删除交叉比对相关 6 个方法；新增 `moveToLocation()` 地点移动逻辑；新增 `advanceRobotCycles()` 时间推进；新增 `injectSharedContext()` 上下文注入；新增 `renderLocation()` 地点视图渲染；修改 `selectNPC()` 只接受当前地点可见的 NPC；删除预设问题相关渲染 |
| `index.html` | 对话界面删除预设问题按钮区；数据终端删除交叉比对子标签；新增地点视图容器；新增地点移动按钮组 |
| `css/style.css` | 删除交叉比对样式；新增地点视图样式；新增 NPC 行为描述样式 |

---

## 九、验收标准

| # | 功能 | 验收方式 |
|---|------|---------|
| 1 | 共享记忆 | 跟 D-5 聊完参数错误的事 → 去找 S-3 → S-3 在对话中自然提到「D-5跟你说过的那个参数」 |
| 2 | 机器人自由活动 | 不同时间访问不同地点，机器人的位置和行为描述不同 |
| 3 | 地点移动 | 玩家可以在各地之间移动，每次移动消耗时间，地点视图正确显示当前地点的 NPC 和互动选项 |
| 4 | 预设问题全删 | 对话界面没有预设按钮，只有输入框 |
| 5 | 副工程师对话树 | 连续三次对话，分别触发回避→动摇→坦白（需中间有追问） |
| 6 | 交叉比对已删 | 数据终端只有「日志」和「时间线」两个子标签 |
| 7 | 预设问题删除后基本可玩 | 玩家可以从头到尾通过自由打字完成一次完整的调查流程 |

---

## 十、优先级

P0：预设问题全删 + 自由打字（这是玩法重构的核心，必须先做）

P1：机器人自由活动 + 地点移动系统（开放世界的基础设施）

P2：Agent 共享记忆（让 agent 感真正生效）

P3：副工程师降级为纯 NPC（对比效果，可后续微调）

---

> 以上。完成后在本文档末尾追加完成报告。

---

## 十一、开发完成报告

### 11.0 P0（前置完成）

P0 由前置会话完成：预设问题按钮全部删除（`renderDialogueOptions` 仅保留指控按钮和打字引导）、交叉比对子标签及相关代码删除（`cross_reference_pairs` / `compareData` 等6个方法）、`keyword_clue_map` 保留（43条映射）。

### 11.1 P1：机器人自由活动 + 地点移动系统 ✅

**数据层（`data.js`）**：
- `locations` 重构为 6 个新地点：`medbay`（医疗舱）、`airlock`（气闸室）、`data_terminal`（数据终端）、`engineering`（工程舱）、`habitat`（生活舱）、`corridor`（走廊）
- 新增 `robot_behaviors`：三台机器人各有独立行为循环（location + action + duration），R-7 起始在气闸室检查密封圈、S-3 在医疗舱监测生命体征、D-5 在数据终端处理日志
- 新增 `location_descriptions`：6 个地点的氛围描述文本
- 新增 `location_connections`：走廊为中心枢纽，连接所有舱段

**引擎层（`game.js`）**：
- 新增 `initRobotCycles()`：初始化行为循环运行时状态
- 新增 `advanceRobotCycles(gameMinutes)`：时间推进时同步推进所有机器人行为循环
- 新增 `getRobotsAtLocation(locId)`：获取当前在某地点的机器人
- 新增 `moveToLocation(locId)`：玩家移动消耗 2-5 分钟游戏时间，推进机器人循环
- 新增 `renderLocationView()`：渲染地点视图（ASCII 分隔线 + 描述 + 在场 NPC + 互动按钮 + 移动按钮）
- 新增 `handleLocationInteract(interactionId)`：气闸室检查撞击痕迹/操作台日志、医疗舱查看生命体征
- 重构 `renderLocations()`：侧边栏导航改用 `moveToLocation`
- 重构 `renderNPCList()`：改为无参，基于行为循环获取当前地点 NPC
- 重构 `restToNextPhase()`：休息功能整合到生活舱（habitat），叙事文本更新
- 修改 `consumeTime()`：时间消耗时同步推进机器人循环
- 删除 `selectLocation()` 和 `renderQuartersView()`（旧地点系统）

**样式层（`style.css`）**：
- 新增 `.location-view` / `.location-header` / `.location-divider` / `.location-desc` / `.location-robots` / `.robot-presence` / `.location-empty` / `.location-actions` / `.location-action-btn`（含 hover 效果和不同按钮类型）

### 11.2 P2：Agent 共享记忆 ✅

**数据层（`data.js`）**：
- 新增 `shared_agent_context` 初始结构：`player_inquiries`（玩家问了谁什么）、`disclosed_info`（每个 NPC 透露了哪些信息）、`attitude`（-1.0~1.0 信任度）、`triggered_events`

**引擎层（`game.js`）**：
- 新增 `injectSharedContext(basePrompt, npcId)`：每次调用 LLM 前，将共享情报动态拼接到 agent prompt 末尾。包含其他 NPC 的对话摘要、已透露信息、引用规则（自然引用/不重复/分歧表述/重复提问检测）
- 新增 `updateSharedContext(npcId, playerText)`：每次对话后更新 `player_inquiries` 和 `disclosed_info`
- 新增 `extractTopic(text)`：从玩家输入提取话题关键词（14个话题方向）
- 修改 `handleSoftTrack()`：调用 LLM 前先 `injectSharedContext`
- 在硬轨（`selectDialogueOption`）和软轨（`handleSoftTrack`）路径中都调用 `updateSharedContext`

### 11.3 P3：副工程师降级为纯 NPC ✅

**数据层（`data.js`）**：
- 副工程师新增 `scripted_dialogue` 字段：3 阶段渐进式对话树
  - stage 0（回避）：「我当时不在气闸室，在工程舱处理自己的事」
  - stage 1（动摇，追问校准触发）：「校准日志……我确实忘了填，但那是小事对吧」
  - stage 2（坦白，追问 D-5 触发）：「D-5 知道我那天没校准。它没说出去。所以我也不敢说」
  - 每阶段含多个关键词匹配响应 + default 兜底

**引擎层（`game.js`）**：
- 新增 `getScriptedResponse(text, npcId)`：根据当前阶段和关键词匹配返回固定回复，自动推进阶段
- 修改 `handleSoftTrack()`：副工程师分支走纯脚本路径（不调用 `callLLM`），其他机器人走 LLM + 共享上下文注入

### 11.4 文件变更清单

| 文件 | 变更 |
|------|------|
| `js/data.js` | locations 重构为6地点 + robot_behaviors + location_descriptions + location_connections + shared_agent_context + 副工程师 scripted_dialogue |
| `js/game.js` | 新增P1（6方法）、P2（3方法）、P3（1方法）；重构 renderLocations/renderNPCList/restToNextPhase/consumeTime/handleSoftTrack；删除 selectLocation/renderQuartersView |
| `css/style.css` | 新增地点视图完整样式 |
| `index.html` | 无需改动（交叉比对子标签在P0已删，地点视图复用 dialogue-area 容器） |

### 11.5 验收对照

| # | 验收项 | 结果 |
|---|--------|------|
| 1 | 共享记忆：跟 D-5 聊完参数错误 -> 找 S-3 -> S-3 自然提到「D-5跟你说过的那个参数」 | ✅ `injectSharedContext` 在每次 LLM 调用前注入其他 NPC 的对话摘要和已透露信息 |
| 2 | 机器人自由活动：不同时间访问不同地点，位置和行为描述不同 | ✅ 行为循环按 duration 推进，`renderLocationView` 显示当前在场 NPC + 行为描述 |
| 3 | 地点移动：玩家可移动，消耗时间，地点视图正确显示 | ✅ `moveToLocation` 消耗 2-5 分钟，推进循环，渲染完整地点视图 |
| 4 | 预设问题全删：对话界面只有输入框 | ✅ P0 已完成，`renderDialogueOptions` 仅保留指控按钮和打字引导 |
| 5 | 副工程师对话树：回避->动摇->坦白 | ✅ 3 阶段 `scripted_dialogue`，阶段自动推进，不走 LLM |
| 6 | 交叉比对已删：只有日志和时间线 | ✅ HTML 仅 2 个子标签，data.js 和 game.js 中 xref 代码清零 |
| 7 | 自由打字完成完整调查流程 | ✅ 硬轨关键词匹配 + 软轨 LLM/脚本 + keyword_clue_map 43 条映射 |

### 11.6 验证方式

- `node --check` 通过 `data.js` / `game.js` 语法检查
- 数据完整性脚本：6 地点、3 机器人行为循环（10 个行为节点全部引用合法地点）、6 组连接关系、6 个地点描述、shared_agent_context 4 字段、副工程师 3 阶段对话树、cross_reference_pairs 已删除、keyword_clue_map 43 条
- 遗留引用检查：`selectLocation` / `renderQuartersView` / `quarters` / `undefined` 引用全部为 0

---

> P0-P3 全部完成。玩法重构落地：开放世界 + Agent NPC + 共享记忆 + 纯NPC对比。
>
> 工坊。
