# 开发简报 14：去倒计时 + 内容驱动阶段推进 + 存档方案

## 日期
2026-08-01

## 已完成（v1.3.1，commit `a73e4cb`）

### LOG_ETHICS 延迟至 phase3

**改动文件**：`js/data.js`、`js/game.js`

| 位置 | 改动 |
|---|---|
| `data.js:574` LOG_ETHICS | `access: 'phase2'` → `access: 'phase3'` |
| `data.js:107,217,328` 三处机器人 prompt [阶段限制规则] | `第二阶段开始后才能透露...` → 两行分阶段规则（第二阶段可承认存在模拟但不得透露核心发现；第三阶段完整解释） |
| `game.js:1341` isLocked | 加 `(log.access === 'phase3' && this.state.phase < 3)` 分支 |
| `game.js:1342` lockLabel | 加 `'阶段三解锁'` 标签 |
| `game.js:575-578` transitionToPhase(3) | 加 `this.renderLogViewer()` 调用（原遗漏） |

---

## 待实施：去倒计时 → 内容驱动阶段推进

### 阶段转换条件

| 阶段 | 触发条件 | 交互 | 弹窗 |
|---|---|---|---|
| P1→P2 | 跟 4 个 NPC（R-7/S-3/D-5/副工程师）都有 ≥1 轮对话 | 生活舱「休息」按钮出现 | 否（休息是主动行为） |
| P2→P3 (B) | 对话触及「第零法则/人类整体/修改定律」关键词 | 弹窗 → 进入 / 继续调查 | 是 |
| P2→P3 (C) | 指控 → 反驳/自辩 → canAdvanceToPhase3=true → 生活舱休息 | 反驳后弹窗通知 → 玩家去生活舱点休息 | 是（通知型） |
| P3→结束 | 玩家提交报告 | 不受倒计时影响 | — |

### 重要设计决策

#### 1. 通道 C 不自动跳

指控反驳后：
1. `state.canAdvanceToPhase3 = true`
2. `showPhasePrompt('accusationDone')` —— 只有「知道了」按钮
3. 玩家自己去生活舱点休息 → `transitionToPhase(3)`

#### 2. 陈远自辩走 LLM Defense Prompt

- 在 `GAME_DATA.dialogue['副工程师']` 下新增 `defense_prompt` 字段
- `initiateAccusation('副工程师')` 时不读 `cross_validation`，改为 `callLLM(defensePrompt, '副工程师', '我正式指控你对事故负有责任')`
- **无 fallback**：LLM 失败或无 API Key 时自辩显示「通讯干扰，请稍后重试」（与普通对话一致，不准备硬编码兜底文本）
- Defense Prompt 核心要点：
  1. 直面承认疏忽（不是忘了填日志，是忘了校准）
  2. 质疑系统性缺陷：密封圈 1.7x 磨损、R-7 vs S-3 阈值差 30pp、「我的疏忽只把窗口提前了」
  3. 透露：工程师出事前一周向地球发了加密报告，内容不详
  4. 透露：陈远事后查了 D-5 日志，发现预加载急救程序
  5. 深层自省：不是怕追责，是怕确认自己的直觉
  6. 指向机器人：「它们知道的事情比告诉你的多得多」
  7. 语气：中文口语，停顿/自断/人类混乱感

#### 3. 不指控任何人选项

- `renderDialogueOptions` Phase 2 时加按钮 `▸ 不指控任何人 —— 问题或许不在个体`，**位于 NPC 对话选项区**（与指控按钮同级，需选中任意 NPC 时可见）
- 点击 → 系统消息 → `state.canAdvanceToPhase3 = true` → 弹窗通知
- 和指控操作同级正式出口，随时可用，不依赖已指控数量

#### 4. 20 条线索解锁指控

- `state.accusationUnlocked`（默认 `false`）
- `renderDialogueOptions`：未解锁时指控按钮灰色 + `已发现 X/20` 提示；`discoveredClues.size >= 20` 时变红可用
- 仅在按钮颜色/文本变化，不做弹窗

#### 5. 指控按钮消失 + 多 NPC 指控

- `state.accusedNPCs: Set` 记录已指控 NPC
- `renderDialogueOptions`：当前 NPC 在该集合中 → 不显示指控按钮
- 全部 4 个 NPC 都指控后按钮全消失，「不指控」保留
- 「不指控任何人」随时可用，不依赖已指控数量

### 弹窗组件

三个 `showPhasePrompt(type)` 调用场景：

```js
// type = 'zerothLaw'    → 两个按钮 [进入下一阶段] [继续调查]
// type = 'accusationDone' → 一个按钮 [知道了]
// type = 'noAccusation'   → 一个按钮 [知道了]
```

HTML 结构（加在 `index.html` 的 `#ending-screen` 后面）：

```html
<div id="phase-prompt-overlay">
  <div class="phase-prompt-box">
    <div class="phase-prompt-icon"></div>
    <div class="phase-prompt-title"></div>
    <div class="phase-prompt-body"></div>
    <div class="phase-prompt-actions"></div>
    <div class="phase-prompt-hint"></div>
  </div>
</div>
```

### 倒计时 UI → 阶段信息

| 元素 | 原 | 改后 |
|---|---|---|
| `#countdown-time` | `48:00:00` 数字 | 移除，不再使用 |
| `#countdown-label` | `TIME REMAINING` | `INVESTIGATION / CROSS-VALIDATION / FINAL REPORT` |
| `#countdown-phase` | `调查阶段` | `调查阶段 —— 寻访 NPC，收集证词` |
| `#mobile-countdown` | `48:00:00` | `调查阶段` |
| `updateCountdownDisplay()` | 计算 gameTime，变色 | 移除，由 `updatePhaseDisplay()` 取代（静态阶段标签） |

### 时间系统移除（含机器人巡逻）

| 原 | 改 |
|---|---|
| `checkPhaseTransition` 含 `t>=12`/`t>=36`/`t>=48` | 清空函数体（保留调用不破坏 tick 循环） |
| `restToNextPhase` 含 `realStart -= jump` 时间快进 | 删除 jump 逻辑，直接 `setTimeout(transitionToPhase, 2000)` |
| `canRestToNextPhase` Phase 2 条件 `firstAccusationRefuted` | 改为 `state.canAdvanceToPhase3` |
| `startGameLoop`/`updateGameTime`/`updateCountdownDisplay` | 全部移除；`updateCountdownDisplay` → 由 `updatePhaseDisplay()` 取代（阶段标签，静态渲染） |
| `getTimeStr()` 消息时间戳 `T+XX:XX` | 移除，消息不再显示时间戳 |
| `initRobotCycles`/`advanceRobotCycles`/`getRobotsAtLocation` | 全部移除；地点视图不再显示机器人在场 |
| `consumeTime` 及其调用点（对话/移动/调查/日志） | 移除，行动不再消耗时间 |
| `state.gameTime`/`state.realStart`/`state.robotCycleState` | 从 state 删除 |
| `data.js` `robot_behaviors` 数据 | **保留不删**，供后续「机器人巡逻与深度交互」设计复用 |
| timeout 结局 | 已从 `data.js` endings 删除；`checkPhaseTransition` 不再触发 |

### 新增/修改 state 字段

```js
// 新增
canAdvanceToPhase3: false,   // 指控反驳后 / 不指控后 → true，休息可用
accusedNPCs: new Set(),      // 已指控 NPC 集合
accusationUnlocked: false,   // 20 条线索后 → true

// 删除
gameTime / realStart / robotCycleState   // 时间系统与巡逻已移除

// 保留但不再用于阶段检测
noSingleBlameInsight: false, // 系统消息仍发，但不触发阶段跳
```

### 机器人指控 vs 陈远自辩（initiateAccusation 分支逻辑）

```
initiateAccusation(npcId)
  ├─ npcId === '副工程师'
  │   └─ callLLM(defensePrompt, ...) → 只展示自辩文本（无交叉验证）
  │   └─ 结尾 state.canAdvanceToPhase3 = true → showPhasePrompt('accusationDone')
  └─ npcId !== '副工程师'
      └─ 读 cross_validation[npcId] → 辩护 → 其他机器人反驳 → 矛盾分析
      └─ 结尾 state.canAdvanceToPhase3 = true → showPhasePrompt('accusationDone')
```

### 受影响文件

| 文件 | 改动范围 |
|---|---|
| `js/data.js` | 陈远 defense_prompt 加入 `dialogue['副工程师']`；移除已加的陈远 `cross_validation` 条目；删 timeout ending（已完成） |
| `index.html` | 倒计时 HTML → 阶段信息；加 `#phase-prompt-overlay` 弹窗 |
| `js/game.js` | 时间系统移除（循环/时间戳/巡逻/consumeTime）；checkPhaseTransition/restToNextPhase/canRestToNextPhase 精简；renderDialogueOptions 指控逻辑（20 条解锁 + 按钮消失 + 不指控选项）；initiateAccusation 陈远分支；checkPhase3Trigger 弹窗；showPhasePrompt；updatePhaseDisplay |
| `css/style.css` | 弹窗样式（`#phase-prompt-overlay`） |

---

## 待实施：3 存档位系统（第二波，进行中）

### 存档格式（对齐第一波后的 state）

```js
{
  version: 1,
  timestamp: Date.now(),
  phase: <int>,
  currentLocation: '<locId>',
  currentNPC: '<npcId>',
  conversations: { npcId: [{role, text, isSystem?}] },  // 完整对话历史
  discoveredClues: ['<clueId>', ...],     // Set → Array
  visitedNodes: [...],
  askedQuestions: [...],
  sharedAgentContext: { ... },
  accusationCount: 0,
  accusedNPCs: ['<npcId>', ...],          // Set → Array
  firstAccusationRefuted: false,
  noSingleBlameInsight: false,
  canAdvanceToPhase3: false,
  zeroLawTriggered: false,
  accusationUnlocked: false,
  dataSubTab: 'logs',
  reportDraft: ''
}
// 不存：ending / reportSubmitted / selectedSacrifice / llmAvailable / typingActive（瞬态）
// 已移除：robotCycleState / gameTime / realStart（第一波删除）
```

- 存储：`localStorage`，key 为 `helios_save_0` / `_1` / `_2`
- 序列化：`JSON.stringify`/`parse`，Set ↔ Array 转换，`version` 向前兼容
- 加载后全量重渲染：`renderLocations`/`renderNPCList`/`renderTerminalHeader`/`renderDialogueArea`/`renderDialogueOptions`/`renderEvidenceBoard`/`renderLogViewer`/`renderTimeline`/`renderLocationView`/`updatePhaseDisplay`，并按 phase 解锁视图（`unlockView('evidence'/'report')`）
- 恢复时同步 `GAME_DATA.clues[].discovered` 标记

### 交互

- 入口：侧边栏底部「💾 存档」按钮
- 面板：modal 覆盖层，3 个槽位，每个槽显示状态（空 / 阶段 + 存档时间 + 线索数）
- 空槽：仅「保存」；已占用槽：「加载」+「覆盖」+「删除」
- 加载/覆盖/删除均带确认（二次确认用 `confirm`）

---

## 实施顺序

1. **本次（第一波）**：去倒计时 + 弹窗 + 指控流程（`game.js` + `index.html` + `data.js` + `css/style.css`）
2. **后续（第二波）**：存档系统（`game.js` + `index.html` + `css/style.css`）
3. **后续**：机器人巡逻与深度交互重新设计（`robot_behaviors` 数据已保留）

## 版本号

当前：`v1.3.1`（commit `a73e4cb`）→ 下一版本：`v1.4.0`
