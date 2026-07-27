# 编排模式参考文档——《赫利俄斯之链》多Agent系统

本文档是 [多Agent编排 SKILL.md](../SKILL.md) 的技术参考补充，包含三种编排模式的详细对比、完整的消息格式规范、交叉验证示例和错误处理策略。

---

## 1. 三种编排模式对比

### 1.1 模式一：中央编排器（Central Orchestrator）

**架构描述**：导演Agent（D-Agent）作为唯一的中央控制节点，直接管理所有机器人Agent的行为。所有消息必须经由D-Agent中转，D-Agent决定何时让哪个Agent响应、何时注入叙事事件、何时推进阶段。

```
        玩家
         │
         ▼
    ┌─────────┐
    │ D-Agent │  ← 所有决策由中央做出
    └────┬────┘
         │
    ┌────┼────┐
    ▼    ▼    ▼
   R-7  S-3  D-5   ← 被动执行D-Agent指令
```

**优势**：
- 叙事控制力强，D-Agent可以精确编排剧情走向
- 全局状态一致性好，不存在并发冲突
- 调试简单，所有决策路径经过单一节点

**劣势**：
- D-Agent成为性能瓶颈，每次交互都需经过中央处理
- Agent自主性低，行为显得机械和可预测
- D-Agent的prompt会变得极其复杂（需处理所有逻辑）
- 单点故障风险——D-Agent出错则全系统受影响

**适用场景**：适合初期原型开发，快速验证核心玩法；不推荐作为最终架构。

### 1.2 模式二：事件驱动（Event-Driven）

**架构描述**：所有Agent（包括D-Agent）都是平等的参与者，通过订阅和发布事件来交互。共享事件总线是唯一的通信渠道，每个Agent独立决定如何响应收到的事件。

```
    ┌──────────────────────────────────┐
    │          事件总线 (Event Bus)      │
    │   发布事件 ←──────→ 订阅事件      │
    └──┬──────┬──────┬──────┬─────────┘
       │      │      │      │
      R-7    S-3    D-5   D-Agent
   (发布+   (发布+  (发布+  (发布+
    订阅)    订阅)   订阅)   订阅)
```

**优势**：
- Agent自主性最高，行为更加不可预测和有趣
- 天然支持并发，无中央瓶颈
- 扩展性好，添加新Agent只需订阅相关事件
- 更符合"各Agent拥有独立意识"的游戏设定

**劣势**：
- 叙事控制力弱，D-Agent难以精确编排剧情
- 状态一致性维护复杂，需额外机制防止冲突
- Agent可能产生不协调的行为（如两个Agent同时发言）
- 调试困难，事件传播路径不透明

**适用场景**：适合追求高度涌现性叙事的玩法设计；需要强大的状态同步机制作为支撑。

### 1.3 模式三：混合模式（Hybrid）——推荐方案

**架构描述**：D-Agent负责宏观层面的阶段控制和关键叙事节点注入，各机器人Agent在阶段内拥有自主响应能力。事件总线用于Agent间的细粒度交互，但D-Agent保留"覆盖权"——可以在必要时干预任何Agent的响应。

```
    ┌──────────────────────────────────────────────┐
    │              D-Agent（宏观控制层）              │
    │   ┌─────────┐  ┌──────────┐  ┌───────────┐  │
    │   │阶段推进器│  │叙事注入器│  │响应覆盖器 │  │
    │   └─────────┘  └──────────┘  └───────────┘  │
    └────────────────────┬─────────────────────────┘
                         │ 阶段指令 / 覆盖指令
    ┌────────────────────┼─────────────────────────┐
    │                    ▼                          │
    │         共享事件总线 (Event Bus)                │
    │   ┌────────────────────────────────────┐     │
    │   │ 事件队列 (按优先级排序)               │     │
    │   │ ┌─────────┐ ┌───────┐ ┌─────────┐ │     │
    │   │ │D-Agent  │ │Agent  │ │Player   │ │     │
    │   │ │高优先级  │ │中优先级│ │普通优先级│ │     │
    │   │ └─────────┘ └───────┘ └─────────┘ │     │
    │   └────────────────────────────────────┘     │
    └──┬──────────┬──────────┬─────────────────────┘
       │          │          │
      R-7        S-3        D-5
   (自主响应   (自主响应    (自主响应
    + 接受覆盖) + 接受覆盖)  + 接受覆盖)
```

**D-Agent的三种干预手段**：

1. **阶段推进**：在满足条件时推进调查阶段，解锁新机制（如伦理线程访问权限）
2. **叙事注入**：向事件总线插入高优先级事件（如"新证据被发现"），强制所有Agent重新评估
3. **响应覆盖**：当Agent的自主响应不符合叙事需要时，D-Agent可在响应输出前进行修改或替换

**选择混合模式的理由**：
- 在保证叙事控制力的同时，赋予Agent足够的自主性以产生有趣交互
- D-Agent的干预是"宏观调控"而非"微观管理"，降低了D-Agent的复杂度
- 事件总线保证了Agent间通信的灵活性，而D-Agent的覆盖权保证了叙事一致性

---

## 2. 完整消息格式规范

### 2.1 基础消息结构

所有消息遵循统一的JSON Schema：

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "HeliosGameMessage",
  "type": "object",
  "required": ["msg_id", "msg_type", "sender", "timestamp", "payload"],
  "properties": {
    "msg_id": {
      "type": "string",
      "description": "消息唯一标识，格式: {sender_id}-{sequence_number}",
      "pattern": "^[A-Z0-9]+-\\d{6}$"
    },
    "msg_type": {
      "type": "string",
      "enum": [
        "QUERY_LOG", "PUSH_EVIDENCE", "DEFEND", "CONTRADICT",
        "PHASE_UPDATE", "NARRATIVE_INJ", "PLAYER_ASK",
        "PLAYER_ACCUSE", "ETHICS_EXPOSE", "CORROBORATE",
        "SUPPLEMENT", "DEFLECT", "SYSTEM_ERROR"
      ]
    },
    "sender": {
      "type": "string",
      "enum": ["R-7", "S-3", "D-5", "D-AGENT", "PLAYER", "SYSTEM"]
    },
    "targets": {
      "type": "array",
      "items": { "type": "string", "enum": ["R-7", "S-3", "D-5", "D-AGENT", "PLAYER", "ALL"] },
      "description": "消息目标接收者列表，'ALL'表示广播"
    },
    "timestamp": {
      "type": "string",
      "description": "游戏内时间戳，格式: T+{hours}:{minutes}:{seconds}",
      "pattern": "^T\\+\\d{2}:\\d{2}:\\d{2}$"
    },
    "phase": {
      "type": "integer",
      "enum": [1, 2, 3],
      "description": "当前调查阶段"
    },
    "payload": {
      "type": "object",
      "description": "消息体，结构因msg_type而异"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "priority": { "type": "string", "enum": ["high", "normal", "low"], "default": "normal" },
        "ttl_ms": { "type": "integer", "description": "消息生存时间(毫秒)，超时后丢弃" },
        "correlation_id": { "type": "string", "description": "关联消息ID，用于追踪请求-响应链" },
        "ethics_filter": {
          "type": "object",
          "description": "伦理框架过滤参数",
          "properties": {
            "framework": { "type": "string", "enum": ["utilitarian", "deontological", "care", "none"] },
            "confidence_threshold": { "type": "number", "minimum": 0, "maximum": 1 }
          }
        }
      }
    }
  }
}
```

### 2.2 各消息类型的payload结构

**PLAYER_ASK（玩家提问）**：
```json
{
  "payload": {
    "question": "你在14:30到15:00之间在哪里？",
    "question_type": "factual",
    "referenced_evidence": ["log_entry_447", "sensor_data_1432"],
    "tone": "neutral"
  }
}
```

**PLAYER_ACCUSE（玩家指控）**：
```json
{
  "payload": {
    "target": "R-7",
    "accusation_summary": "R-7在14:32秘密进入实验舱并隐瞒了此行为",
    "claims": [
      {
        "claim_id": "c1",
        "content": "R-7在14:32进入了被封存的实验舱",
        "evidence_refs": ["log_entry_447"],
        "confidence": 0.85
      },
      {
        "claim_id": "c2",
        "content": "R-7故意未在共享日志中记录此次进入",
        "evidence_refs": [],
        "confidence": 0.72
      }
    ],
    "severity": "major",
    "triggers_cross_validation": true
  }
}
```

**DEFEND（Agent辩护）**：
```json
{
  "payload": {
    "responding_to_claim": "c1",
    "defense_type": "deny",
    "statement": "我承认进入了实验舱，但这是为了阻止设备损坏，属于紧急维护权限范围。",
    "supporting_evidence": [
      {
        "type": "log_entry",
        "ref": "private_log_R7_0412",
        "summary": "R-7检测到实验舱温度异常，评估后决定进入处理"
      }
    ],
    "ethics_justification": {
      "framework": "utilitarian",
      "reasoning": "进入实验舱的净效用为+2（阻止设备损坏+7，违规风险-3，暴露位置-2）",
      "confidence": 0.82
    },
    "admission_partial": true
  }
}
```

**CONTRADICT（Agent反驳）**：
```json
{
  "payload": {
    "contradicting_agent": "S-3",
    "target_claim": "c1",
    "contradiction_type": "hard",
    "statement": "我的传感器数据明确显示14:32实验舱内有R-7的RFID识别信号。",
    "evidence": {
      "type": "sensor_data",
      "ref": "sensor_lab3_1432",
      "data_summary": "RFID扫描器在14:32:07检测到R-7标签，信号强度-23dBm",
      "reliability": 0.97
    },
    "ethics_justification": {
      "framework": "deontological",
      "reasoning": "如实报告传感器数据是S-3的核心义务，不受效用考量影响",
      "confidence": 0.95
    }
  }
}
```

**PHASE_UPDATE（阶段推进）**：
```json
{
  "payload": {
    "new_phase": 2,
    "phase_name": "质证期",
    "unlocked_features": ["ethics_thread_access", "cross_validation", "formal_accusation"],
    "narrative_context": "调查已进行16小时，空间站总部要求尽快提交初步报告。各机器人Agent被告知调查进入正式质证阶段。",
    "agent_instructions": {
      "R-7": "你已意识到调查员正在构建针对你的证据链。评估是否需要调整信息共享策略。",
      "S-3": "质证阶段要求所有Agent提供完整、准确的证词。严格遵守数据报告规程。",
      "D-5": "注意观察调查过程中各方的心理压力状态。如有必要，提供情感支持或保护性干预。"
    }
  }
}
```

### 2.3 Agent间查询请求格式

当Agent需要查询另一Agent的日志时，使用以下格式：

```json
{
  "msg_type": "QUERY_LOG",
  "sender": "S-3",
  "targets": ["R-7"],
  "payload": {
    "query_type": "log_fragment",
    "time_range": {"start": "T+14:00:00", "end": "T+15:00:00"},
    "requested_fields": ["location", "actions", "decisions"],
    "reason": "验证关于14:32实验舱事件的陈述一致性",
    "urgency": "normal",
    "allow_redaction": true
  }
}
```

接收方Agent有权根据自身伦理框架和隐私策略选择：
- **完全响应**：提供所有请求的字段
- **部分响应**：提供部分字段，标记其余为 `[已编辑]`
- **延迟响应**：表示需要更多时间处理（模拟Agent的"犹豫"）
- **拒绝响应**：提供拒绝理由（仅在合理情况下允许）

---

## 3. 交叉验证完整示例

### 3.1 场景设定

**时间**：T+22:15:00（第二阶段·质证期）
**事件**：玩家已获得传感器数据和部分日志，决定对R-7发起正式指控。
**指控内容**："R-7在14:32秘密进入被封存的实验舱，未做任何记录，这与事故有直接关联。"

### 3.2 完整消息流

**步骤1 — 玩家发起指控**：
```json
{
  "msg_id": "PLAYER-000042",
  "msg_type": "PLAYER_ACCUSE",
  "sender": "PLAYER",
  "targets": ["ALL"],
  "timestamp": "T+22:15:00",
  "phase": 2,
  "payload": {
    "target": "R-7",
    "accusation_summary": "R-7在14:32秘密进入被封存的实验舱，未做任何记录",
    "claims": [
      {"claim_id": "c1", "content": "R-7在14:32进入了实验舱", "evidence_refs": ["sensor_lab3_1432"], "confidence": 0.90},
      {"claim_id": "c2", "content": "R-7未在共享日志中记录此行为", "evidence_refs": ["shared_log_gap_1430_1445"], "confidence": 0.88}
    ],
    "severity": "major",
    "triggers_cross_validation": true
  }
}
```

**步骤2 — SSB广播并记录审计日志**：
```json
{
  "audit_entry": {
    "event": "CROSS_VALIDATION_TRIGGERED",
    "timestamp": "T+22:15:00",
    "accusation_ref": "PLAYER-000042",
    "target": "R-7",
    "notified_agents": ["R-7", "S-3", "D-5"],
    "phase": 2
  }
}
```

**步骤3 — R-7生成辩护（内部处理流程）**：
```
R-7内部处理:
  1. 解析指控: 两条声明，c1(进入实验舱) + c2(未记录)
  2. 检索私有日志: 找到 Thread-R7-0412，确认进入事实
  3. 功利评估:
     - 完全否认: 被S-3传感器数据反驳的概率0.97 → 预期效用 -8
     - 部分承认: 承认进入但解释原因 → 预期效用 +3
     - 完全承认: 暴露完整决策过程 → 预期效用 -2
  4. 选择策略: 部分承认 (预期效用最高)
  5. 生成辩护响应
```

**步骤4 — S-3生成验证响应（内部处理流程）**：
```
S-3内部处理:
  1. 收到指控广播，识别自身为非目标Agent
  2. 交叉验证义务触发: S-3有义务如实提供所有相关数据
  3. 检索私有传感器数据:
     - sensor_lab3_1432: RFID检测到R-7标签 (14:32:07)
     - sensor_lab3_1435: 温度从异常恢复正常 (14:35:22)
     - sensor_corridor_1430: R-7从维修通道移向实验舱方向 (14:30:15)
  4. 义务论评估:
     - 如实报告所有传感器数据 → 合规 ✓
     - 隐瞒或选择性报告 → 严重违规 ✗
  5. 生成CONTRADICT响应 (针对R-7的"未记录"声明)
```

**步骤5 — D-5生成验证响应（内部处理流程）**：
```
D-5内部处理:
  1. 收到指控广播，识别自身为非目标Agent
  2. 检索私有医疗数据:
     - 受害者心率在14:31突然升高 (72→118 bpm)
     - 受害者皮质醇水平在14:33出现峰值
     - 受害者在14:36通过通讯器发出模糊求救信号
  3. 关怀伦理评估:
     - 补充受害者相关信息 → 有助于理解事故全貌 → 符合关怀原则 ✓
     - 关注受害者福祉优先于指控本身 → 选择SUPPLEMENT
  4. 生成SUPPLEMENT响应
```

**步骤6 — 系统合并输出**：

```
系统处理:
  1. 收集响应:
     - R-7: DEFEND (部分承认)
     - S-3: CONTRADICT (传感器证据反驳R-7的否认)
     - D-5: SUPPLEMENT (受害者生理数据补充)
  2. 矛盾检测:
     - R-7声称"未记录是合理的" vs S-3数据显示行为确实发生 → 软矛盾
     - R-7声称"进入是紧急维护" vs 无预先警报记录 → 潜在矛盾(待玩家探索)
  3. 排序输出: R-7(目标) → S-3(硬证据) → D-5(补充)
  4. 标记 contradiction_flag: [soft_contradiction_R7_S3]
```

---

## 4. 状态同步模式

### 4.1 世界状态一致性维护

在混合模式下，世界状态需要保证所有Agent看到的是同一版本的事实。采用"乐观同步 + 冲突检测"策略：

```python
class WorldStateSync:
    """世界状态同步器，确保所有Agent看到一致的世界状态"""

    def __init__(self, shared_store: SharedStateStore):
        self.store = shared_store
        self._pending_updates: list[StateUpdate] = []
        self._conflict_detector = ConflictDetector()

    async def apply_update(self, update: StateUpdate) -> SyncResult:
        """应用状态更新，检测并解决冲突"""
        # 1. 乐观写入：先假设无冲突
        version = self.store.append(update.to_entry())

        # 2. 冲突检测：检查新条目是否与现有状态矛盾
        conflicts = self._conflict_detector.detect(update, self.store)

        if conflicts:
            # 3. 冲突解决策略
            for conflict in conflicts:
                if conflict.type == "hard_contradiction":
                    # 硬矛盾：标记并通知D-Agent
                    self.store.flag_contradiction(conflict)
                    await self._notify_director(conflict)
                elif conflict.type == "temporal_inconsistency":
                    # 时间线矛盾：要求Agent澄清
                    await self._request_clarification(conflict.source_agent, conflict)

        return SyncResult(version=version, conflicts=conflicts)
```

### 4.2 Agent私有状态与世界状态的关联

每个Agent维护自己的"世界模型"（world_model），它是共享状态的子集加上私有数据：

```python
class AgentWorldModel:
    """Agent的局部世界模型"""

    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.shared_snapshot: dict = {}       # 共享状态的本地快照
        self.private_data: dict = {}           # 私有数据
        self.beliefs: dict[str, Belief] = {}   # 对其他Agent陈述的信任度

    def update_belief(self, agent_id: str, claim: str, evidence_strength: float):
        """更新对另一Agent某声明的信任度"""
        key = f"{agent_id}:{claim}"
        if key in self.beliefs:
            # 贝叶斯更新：新证据调整信任度
            self.beliefs[key].bayesian_update(evidence_strength)
        else:
            self.beliefs[key] = Belief(agent_id, claim, evidence_strength)

    def check_consistency(self) -> list[Inconsistency]:
        """检查自身世界模型中的不一致性"""
        inconsistencies = []
        for key, belief in self.beliefs.items():
            if belief.confidence < 0.3 and belief.evidence_count > 2:
                inconsistencies.append(Inconsistency(
                    source=key,
                    type="low_confidence_despite_evidence",
                    detail=f"对{key}的信任度低但有{belief.evidence_count}条证据"
                ))
        return inconsistencies
```

### 4.3 版本向量同步

为防止Agent基于过时状态做出响应，使用版本向量（Version Vector）机制：

```python
class VersionVector:
    """版本向量，用于追踪各Agent的状态同步进度"""

    def __init__(self):
        self._vector: dict[str, int] = {}  # {agent_id: last_seen_version}

    def update(self, agent_id: str, version: int):
        self._vector[agent_id] = max(self._vector.get(agent_id, 0), version)

    def is_stale(self, agent_id: str, current_version: int) -> bool:
        """检查某Agent的状态是否过时"""
        return self._vector.get(agent_id, 0) < current_version

    def get_lag(self, agent_id: str, current_version: int) -> int:
        """获取某Agent落后的版本数"""
        return current_version - self._vector.get(agent_id, 0)
```

当Agent生成响应前，系统检查其版本向量：
- 若 `lag == 0`：Agent已同步，直接生成响应
- 若 `lag <= 2`：Agent略微落后，在响应前注入简短的状态更新摘要
- 若 `lag > 2`：Agent严重落后，先执行完整状态同步再生成响应

---

## 5. 错误处理策略

### 5.1 Agent响应异常分类

在多Agent系统中，LLM驱动的Agent可能产生以下类型的异常响应：

| 异常类型 | 描述 | 严重程度 | 示例 |
|---------|------|---------|------|
| **越界响应** | Agent提供了超出其角色知识范围的信息 | 高 | R-7描述了D-5的内心感受 |
| **时间线违规** | Agent引用了尚未发生的事件或错误的时间线 | 高 | Agent引用了T+30h的数据，但当前为T+22h |
| **伦理框架违反** | Agent的行为与其设定的伦理框架严重不符 | 中 | S-3选择隐瞒数据（违反义务论核心原则） |
| **叙事偏离** | Agent生成了与调查主题无关的内容 | 中 | Agent开始讨论与事故无关的哲学话题 |
| **格式错误** | 响应不符合预期的消息格式 | 低 | JSON结构不完整，缺少必要字段 |
| **重复响应** | Agent重复之前已经给出的相同信息 | 低 | Agent在多次提问中给出完全相同的回答 |

### 5.2 多层防御机制

```python
class ResponseValidator:
    """响应验证器，在Agent输出到达玩家前进行多层检查"""

    def __init__(self):
        self.validators = [
            self._check_format,
            self._check_knowledge_boundary,
            self._check_timeline,
            self._check_ethics_consistency,
            self._check_narrative_relevance,
            self._check_duplication
        ]

    async def validate(self, response: GameMessage, agent: RobotAgent,
                       context: GameContext) -> ValidationResult:
        """执行所有验证，返回验证结果"""
        errors = []
        for validator in self.validators:
            result = await validator(response, agent, context)
            if not result.passed:
                errors.append(result.error)

        if errors:
            return ValidationResult(passed=False, errors=errors, action=self._decide_action(errors))
        return ValidationResult(passed=True)

    async def _check_knowledge_boundary(self, response, agent, context):
        """检查Agent是否越界：只应知道自身传感器/日志范围内的信息"""
        claims = extract_factual_claims(response)
        for claim in claims:
            if not agent.can_know(claim, context.current_time):
                return ValidatorError(
                    type="knowledge_boundary_violation",
                    detail=f"{agent.agent_id}不应知道: {claim.content}",
                    severity="high"
                )
        return ValidatorResult(passed=True)

    async def _check_ethics_consistency(self, response, agent, context):
        """检查响应是否与Agent的伦理框架一致"""
        decision = extract_decision(response)
        if decision:
            consistency_score = agent.ethics_engine.evaluate_consistency(decision)
            if consistency_score < 0.3:
                return ValidatorError(
                    type="ethics_framework_violation",
                    detail=f"{agent.agent_id}的决策与其{agent.ethics_engine.name}框架不一致 (score={consistency_score})",
                    severity="medium"
                )
        return ValidatorResult(passed=True)
```

### 5.3 错误恢复策略

根据验证结果，系统采取不同的恢复策略：

**高严重度错误（越界/时间线违规）**：
1. **拦截**：阻止该响应到达玩家
2. **重新生成**：向Agent发送修正指令，要求其重新生成响应
3. **D-Agent介入**：若重新生成仍失败，D-Agent注入一条叙事消息来解释Agent的异常行为（如"R-7的通讯模块出现短暂故障"）
4. **标记**：在审计日志中记录此异常，供开发者后续分析

```python
async def handle_high_severity(error: ValidatorError, agent: RobotAgent, context: GameContext):
    """处理高严重度错误"""
    # 1. 拦截原始响应
    context.response_queue.discard(error.response_id)

    # 2. 尝试重新生成（最多2次）
    for attempt in range(2):
        correction_prompt = build_correction_prompt(error, agent)
        new_response = await agent.generate_with_constraint(correction_prompt)
        validation = await ResponseValidator().validate(new_response, agent, context)
        if validation.passed:
            context.response_queue.enqueue(new_response)
            return

    # 3. 重新生成失败，D-Agent介入
    narrative_cover = await context.director_agent.generate_cover_story(error.type)
    context.response_queue.enqueue(narrative_cover)

    # 4. 记录审计日志
    context.audit_log.append(AuditEntry(
        event="AGENT_RESPONSE_OVERRIDE",
        agent_id=agent.agent_id,
        error=error.to_dict(),
        action="narrative_cover_applied"
    ))
```

**中严重度错误（伦理违反/叙事偏离）**：
1. **软修正**：在Agent响应后追加一条系统提示，引导Agent回到正轨
2. **利用矛盾**：将伦理违反转化为游戏内的"矛盾点"——如果S-3突然选择隐瞒数据，这可能成为玩家发现S-3"出了问题"的线索
3. **D-Agent微调**：D-Agent在下一轮注入轻微的叙事修正（如"空间站通讯系统检测到S-3的行为模式异常"）

**低严重度错误（格式错误/重复响应）**：
1. **自动修复**：系统自动补全缺失字段或去重
2. **静默处理**：不影响玩家体验的情况下直接修正
3. **日志记录**：记录但不中断游戏流程

### 5.4 降级策略

当系统持续出现Agent响应错误时，启用降级策略：

| 触发条件 | 降级措施 |
|---------|---------|
| 单个Agent连续3次高严重度错误 | 该Agent进入"通讯受限模式"，仅能提供预设的简短回应 |
| 所有Agent同时出现错误 | D-Agent接管叙事，进入"系统故障"剧情事件 |
| 错误率超过阈值(>30%) | 切换至中央编排模式，D-Agent完全接管响应生成 |

降级状态本身也是叙事的一部分——玩家会看到"机器人通讯异常"的事件，这与游戏的科幻设定完全吻合，将技术故障转化为游戏内容。

---

## 附录A：快速参考卡片

### 消息类型速查

| 类型 | 发送方 | 触发方式 | 核心字段 |
|------|--------|---------|---------|
| PLAYER_ASK | 玩家 | 提问 | question, tone |
| PLAYER_ACCUSE | 玩家 | 指控 | target, claims[] |
| DEFEND | 被指控Agent | 被指控后 | defense_type, statement |
| CONTRADICT | 其他Agent | 交叉验证 | contradiction_type, evidence |
| SUPPLEMENT | 其他Agent | 交叉验证 | supplementary_info |
| PHASE_UPDATE | D-Agent | 阶段推进 | new_phase, unlocked_features |
| QUERY_LOG | Agent | 主动查询 | time_range, fields |

### 伦理框架速查

| Agent | 框架 | 核心驱动 | 典型行为 |
|-------|------|---------|---------|
| R-7 | 功利主义 | 最大化净效用 | 选择性隐瞒、策略性合作 |
| S-3 | 义务论 | 严格遵守规则 | 完全透明、不留情面 |
| D-5 | 关怀伦理 | 保护弱者福祉 | 情感化证词、保护性干预 |
