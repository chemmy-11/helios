# 赫利俄斯之链 — 开发文档 #11 · 纯 LLM 对话改造 + Prompt 完善

## 发送方

霖 + 杨博（游戏设计组）

## 接收方

helios工坊（游戏开发Agent）

---

## 一、背景与动机

### 1.1 问题

前序版本（dev-brief-07 至 dev-brief-10）实现了开放世界探索和 Agent NPC 的架构，但对话系统仍然是**硬轨 + 软轨混合模式**：

1. **硬轨优先**：`handlePlayerInput` 先调用 `classifyIntent` 进行关键词匹配，命中预写的 `nodes` 数组中的对话节点，只有没命中时才走 LLM
2. **预写脚本大量存在**：`data.js` 中每个 NPC 都有完整的 `nodes` 数组（R-7: 35行、S-3: 42行、D-5: 44行、副工程师: 23行），以及副工程师的 `scripted_dialogue`（37行渐进式脚本树）
3. **LLM 只是兜底**：DeepSeek API 仅在关键词没匹配时才被调用，且每次调用不带对话历史
4. **体验割裂**：玩家自由打字时，如果关键词命中了预写节点，NPC 的回复会突然变得"太标准"，与 LLM 生成的自然回复风格不一致

核心矛盾：**本作的卖点是"AI NPC 的真实不确定性"，但预写脚本恰恰消灭了这种不确定性。**

### 1.2 目标

- **彻底删除所有预写对话脚本**，所有 NPC 回复完全由 LLM 实时生成
- **完善 4 个 agent_prompt**，增加场景定位、跨角色引用规则、对话行为准则
- **升级 callLLM**，传入最近 10 轮对话历史作为上下文
- **保留线索系统**（`keyword_clue_map` + `checkKeywordClues`）不变——线索发现仍通过关键词触发，但对话内容由 LLM 生成

---

## 二、核心改动

### 2.1 data.js：删除全部预写脚本

| 删除项 | 行数 | 说明 |
|--------|------|------|
| R-7 `nodes` 数组 | 35 行 | 含 3 个主节点 + 多层 follow-up |
| S-3 `nodes` 数组 | 42 行 | 含 4 个主节点 + follow-up + SACRIFICE 节点 |
| D-5 `nodes` 数组 | 44 行 | 含 3 个主节点 + 多层 follow-up + SACRIFICE 节点 |
| 副工程师 `nodes` 数组 | 23 行 | 含 2 个主节点 + follow-up |
| 副工程师 `scripted_dialogue` | 37 行 | 3 阶段渐进式脚本（回避→动摇→坦白） |
| **合计** | **181 行** | |

保留项：
- ✅ 4 个 `agent_prompt`（人格提示词，已大幅扩充）
- ✅ `keyword_clue_map`（关键词→线索映射）
- ✅ `clues` 数组（51 条线索数据）
- ✅ 所有其他游戏数据（结局、过场、位置、时间线等）

### 2.2 game.js：对话引擎重构

| 改动 | 旧 | 新 |
|------|----|----|
| `handlePlayerInput` | 先 `classifyIntent` 关键词匹配 → 命中走硬轨 / 未命中走 `handleSoftTrack` | 直接调用 `handleLLMDialgue` |
| `handleSoftTrack` | 副工程师走 `getScriptedResponse`，其他机器人走 LLM | 重命名为 `handleLLMDialgue`，所有 NPC 统一走 LLM |
| `callLLM` | 只传 system prompt + 当前消息 | 传入 system prompt + 最近 10 轮对话历史 + 当前消息 |
| `getSacrificeText` | 从 `data.nodes` 中查找 SACRIFICE 节点 | 改为硬编码字典（R-7/S-3/D-5 各自的临终台词） |
| `renderDialogueArea` | 引用 `data.nodes[0]?.npc_response` | 改为简单字符串 `"[" + data.npc + "已上线。等待你的提问。]"` |
| LLM 失败兜底 | 调用 `getFallbackResponse` 返回角色化预设文本 | 返回通用提示 `"...[通讯干扰，请稍后重试]..."` |

删除的方法：
- `classifyIntent`（意图分类器）
- `matchKeywords`（关键词匹配）
- `selectDialogueOption`（预设选项处理）
- `getScriptedResponse`（副工程师脚本对话树）
- `getFallbackResponse`（角色化兜底回复）

### 2.3 agent_prompt 完善

4 个 NPC 的 system prompt 均进行了以下增强：

**新增【场景】块**：
- 当前时间和位置
- 调查员身份说明
- 该角色的立场
- 与其他机器人的关系定位

**新增【对话规则】块**（机器人）/ 融入【行为准则】（副工程师）：
- 直接回答问题，不反问或转移话题
- 模糊问题要求澄清
- 重复问题简短确认
- 动机质疑用数据/逻辑回应
- 跨角色引用规则（"如果玩家提到其他机器人..."）

**副工程师特殊处理**：
- 对话规则融入行为准则，增加渐进式坦白逻辑
- 保留"回避→动摇→坦白"的三阶段设计，但由 LLM 根据 prompt 自行演绎，不再依赖硬编码脚本

---

## 三、改动后的对话流程

```
玩家输入
  → handlePlayerInput()
    → handleLLMDialgue(text, npcId)
      → injectSharedContext(agent_prompt, npcId)   // 注入共享记忆
      → callLLM(promptWithContext, npcId, text)    // 传入对话历史
        → DeepSeek API（system + 最近10轮 + 当前消息）
      → appendNPCMessage(response)                  // 渲染回复
      → checkKeywordClues(text)                     // 关键词线索检测
      → updateSharedContext(npcId, text)             // 更新共享记忆
```

---

## 四、保留的系统

以下系统**未改动**，仍正常工作：

- **线索系统**：`keyword_clue_map` + `checkKeywordClues` 仍通过玩家输入关键词触发线索发现
- **共享记忆**：`injectSharedContext` + `updateSharedContext` 仍在每轮对话中注入/更新跨机器人信息
- **话题提取**：`extractTopic` 仍用于将玩家提问分类为话题标签
- **机器人行为循环**：`robot_behaviors` + `advanceRobotCycles` 仍控制机器人在站内移动
- **阶段管理**：48 小时倒计时 + 三阶段转换逻辑不变
- **结局系统**：报告语义匹配 + 结局序列播放不变
- **数据终端**：日志查看、时间线、证据板不变

---

## 五、已知风险与后续计划

| 风险 | 说明 | 缓解方案 |
|------|------|----------|
| LLM 不遵守 prompt 约束 | DeepSeek 可能提前泄露"第零法则"或"2.1°偏差"等应隐藏信息 | 需实际测试后调优 prompt，必要时在 prompt 中加强"绝不能说"的措辞力度 |
| 副工程师坦白节奏失控 | 没有硬编码三阶段脚本后，LLM 可能第一轮就全盘坦白 | prompt 中已加入渐进式逻辑，需测试是否足够 |
| 对话历史 token 消耗 | 最近 10 轮历史会增加 prompt token 数 | 当前 max_tokens=200，必要时可调整 history 轮数或 max_tokens |
| 线索发现依赖关键词 | `checkKeywordClues` 仍用关键词匹配，可能漏掉 LLM 对话中实际涉及的内容 | 后续可考虑用 LLM 判断是否应解锁线索 |

---

## 六、文件改动清单

```
js/data.js    -181 行（删除 nodes + scripted_dialogue）
              +约 60 行（4 个 prompt 扩充）
js/game.js    -约 120 行（删除 5 个方法）
              +约 40 行（handleLLMDialgue + callLLM 历史注入）
dev-briefs/   +dev-brief-11.md（本文档）
```

---

## 七、工坊完成后追加

（此区域由 helios 工坊填写开发完成报告）
