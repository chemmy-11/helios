# 开发简报 14：去倒计时 + 内容驱动阶段推进 + 存档系统 + 交互体验优化

## 日期
2026-08-01（第一版）→ 2026-08-01（定稿，commit `49a2da6`）

## 版本号

当前版本：**v1.4.0**（commit `49a2da6`，已推送 GitHub `master`）
上一版本：v1.3.1（commit `a73e4cb`）

**发布建议**：release tag 建议 `v1.4.0-mobile`（沿用上一版 `v1.3.0-mobile` 的命名惯例）。APK 附件需手动上传（`HELIOS.apk` 已含全部改动）。

---

## 一、LOG_ETHICS 延迟至 phase3（v1.3.1 已完成）

| 位置 | 改动 |
|---|---|
| `data.js` LOG_ETHICS | `access: 'phase2'` → `access: 'phase3'` |
| 三个机器人 prompt [阶段限制规则] | 第二阶段可承认模拟存在但不得透露核心发现；第三阶段完整解释 |
| `game.js` isLocked/lockLabel | 支持 `phase3` 解锁 + 「阶段三解锁」标签 |
| `game.js` transitionToPhase(3) | 补 `renderLogViewer()` 调用（原遗漏） |

---

## 二、去掉倒计时 → 内容驱动阶段推进（v1.4.0 已完成）

### 阶段转换条件（定稿）

| 阶段 | 触发条件 | 交互 |
|---|---|---|
| P1→P2 | 跟 4 个 NPC（R-7/S-3/D-5/副工程师）都有 ≥1 轮对话 | 住舱出现「休息」按钮；**首次满足时弹窗提醒**（`p1RestReady`） |
| P2→P3 (B) | 对话触及「第零法则/人类整体/修改定律」关键词 | 弹窗确认（`zerothLaw`：进入/继续调查），不自动跳 |
| P2→P3 (C) | 指控 → 回应/自辩 → `canAdvanceToPhase3=true` | 弹窗通知（`accusationDone`/`noAccusation`），玩家去住舱休息 |
| P3→结束 | 玩家提交报告 | 不受任何时间限制 |

### 时间系统移除

- `startGameLoop`/`updateGameTime`/`updateCountdownDisplay`/`getTimeStr`/`consumeTime` 全部移除
- 机器人巡逻（`initRobotCycles`/`advanceRobotCycles`/`getRobotsAtLocation`）移除
- `state` 删除 `gameTime`/`realStart`/`robotCycleState`
- `data.js` `robot_behaviors` 数据被 `robot_locations`（固定位置表）取代：
  - R-7 → airlock（检查密封圈）、S-3 → medbay（监测体征）、D-5 → data_terminal（处理日志）
- 倒计时 UI → 阶段信息（`updatePhaseDisplay`），移动端同步

### 弹窗组件 `showPhasePrompt(type, onClose)`

| type | 场景 | 按钮 |
|---|---|---|
| `zerothLaw` | 第零法则洞察 | 进入下一阶段 / 继续当前调查 |
| `accusationDone` | 指控已回应 | 知道了（关闭后追加「前往住舱休息」提示） |
| `noAccusation` | 不指控任何人 | 知道了（同上） |
| `p1RestReady` | 4 NPC 聊完 | 知道了 |
| `exitConfirm` | 退出前提醒 | 先去存档 / 直接退出 / 取消 |

---

## 三、指控系统（v1.4.0 已完成）

### 门槛（经讨论定稿）

- **10 条线索**解锁指控（`accusationUnlocked`），按钮灰 → 红
- **20 条线索**解锁不指控（`noAccusationUnlocked`）
- 旧档兼容：`restoreState` 加载后按线索数重算两门槛

### 流程

- 指控按钮三分支：已指控（消失+绿字）/ 未解锁（灰 + X/10）/ 可指控（红）
- 不指控按钮：未解锁（灰 + X/20）/ 可指控 / `canAdvanceToPhase3` 后不显示
- `initiateAccusation` 分支：**陈远走 `callLLM(defense_prompt)` 无兜底**；机器人保留交叉验证链
- `finishAccusation`：统一设 `canAdvanceToPhase3` + 弹窗
- `initiateNoAccusation`：正式出口，同样设标志 + 弹窗

### 陈远 defense_prompt（两段式表达）

- `max_tokens` 200 → 500（输出上限放宽）
- 引导两段式：第一段说完停顿 → 等调查员追问 → 补充第二段
- 不设长度下限，LLM 自行判断

---

## 四、事件性消息不推历史（v1.4.0 已完成）

- 新增 `addDirectMessage(text)`：纯 DOM 插入，不写 `conversations`
- 28 处调用点替换：指控/交叉验证/提示/存档/报告/线索发现/洞察等
- `addSystemMessage` 移除；`appendSystemMessage` → `addDirectMessage`（历史重放兜底，旧存档兼容）
- **效果**：切换 NPC 不再重放事件消息；LLM 上下文不受影响（本就不含 system 消息）

---

## 五、输入框（v1.4.0 已完成）

- `<input>` → `<textarea>`（无 placeholder），Enter 发送 / Shift+Enter 换行
- **镜像测量方案**：隐藏 mirror div（复制输入框 computed style）测内容高度，输入框仅在高度变化时于 rAF 设置像素高度——输入瞬间零重排，IME 锚点稳定（解决句中插入跳尾问题；field-sizing 方案因 Chromium bug 弃用）
- IME 组合保护（`composingInput`），组合结束补校准
- `init`/`selectNPC` 初始校准，发送后重置

---

## 六、退出提醒（v1.4.0 已完成）

- **Android 返回键**：`@capacitor/app@6.0.3`（匹配 Capacitor 6，需 `npm install` + `cap sync` 注册；**注意 package.json 在 .gitignore 中，其他环境需手动安装**）
- **浏览器**：`beforeunload` 兜底
- 触发条件：有进度（线索/对话）且未到结局
- 存档面板打开时返回键优先关闭面板

---

## 七、3 存档位系统（v1.4.0 已完成）

### 存档格式

```js
{
  version: 1, timestamp, phase, currentLocation, currentNPC,
  conversations: { npcId: [{role, text, isSystem?}] },
  discoveredClues: [...], visitedNodes: [...], askedQuestions: [...],
  sharedAgentContext: {...},
  accusationCount, accusedNPCs: [...],
  firstAccusationRefuted, noSingleBlameInsight,
  canAdvanceToPhase3, zeroLawTriggered,
  accusationUnlocked, noAccusationUnlocked,
  dataSubTab, reportDraft
}
```

- 存储：`localStorage` `helios_save_0/1/2`；Set ↔ Array 转换
- 加载后全量重渲染 10 个视图 + 按阶段解锁 tab + 线索标记同步
- 旧档兼容：门槛按线索数重算

### 交互

- 侧边栏「💾 存档」按钮 → modal 面板（3 槽：空槽保存 / 占用槽加载/覆盖/删除，均 confirm 确认）
- 移动端抽屉：选 NPC / 选地点后自动收起

---

## 八、其他 UI 调整（v1.4.0 已完成）

- **结局名**：`哲学觉醒` → `第零法则`（endings.success.title）
- **四定律渐隐渐现**：字幕播完后玩家点击屏幕 → 字幕 0.6s 渐隐 + 四定律 0.6s 渐现（交叉过渡，一次性渲染非逐条），10s 防呆兜底
- **住舱改名**：界面「调查员住舱」/ 消息简称「住舱」
- **删除侧边栏抽屉重复导航**（保留顶栏 tabs + 底部导航）
- **报告兜底结局**：`inconclusive`（替代已删的 timeout）
- **48h 文案清除**：`最终报告提交窗口已开放。当你做好准备，即可提交你的调查报告。`

---

## 受影响文件

| 文件 | 状态 |
|---|---|
| `js/data.js` | ✅ 已提交 |
| `js/game.js` | ✅ 已提交 |
| `index.html` | ✅ 已提交 |
| `css/style.css` / `css/mobile.css` | ✅ 已提交 |
| `dev-briefs/dev-brief-14.md` | ✅ 本文件 |
| `package.json`（@capacitor/app） | ⚠️ .gitignore 排除，仅本地，其他环境需手动安装 |

## 后续规划

- 机器人巡逻与深度交互重新设计（`robot_locations` 数据可扩展）
- 多语言支持 / PWA 离线 / 音效
