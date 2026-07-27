# 线索与记忆系统 - 数据模型参考

> 本文档包含"赫利俄斯之链"记忆系统的完整JSON Schema、示例数据和线索图谱定义。

---

## 1. Agent记忆记录 Schema

### 1.1 完整Schema定义

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AgentMemoryRecord",
  "description": "单个Agent的完整记忆记录",
  "type": "object",
  "required": ["agent_id", "agent_name", "memory_layers", "last_updated"],
  "properties": {
    "agent_id": {
      "type": "string",
      "enum": ["R-7", "S-3", "D-5"],
      "description": "Agent唯一标识"
    },
    "agent_name": {
      "type": "string",
      "description": "Agent全称及角色"
    },
    "memory_layers": {
      "type": "object",
      "required": ["episodic", "ethical", "shared"],
      "properties": {
        "episodic": {
          "type": "array",
          "description": "情景记忆层——Agent的直接观察与经历",
          "items": { "$ref": "#/$defs/EpisodicEntry" }
        },
        "ethical": {
          "type": "array",
          "description": "伦理计算线程层——内部推理与价值判断",
          "items": { "$ref": "#/$defs/EthicalThreadEntry" }
        },
        "shared": {
          "type": "array",
          "description": "共享站点日志层——公共可访问记录",
          "items": { "$ref": "#/$defs/SharedLogEntry" }
        }
      }
    },
    "consistency_hash": {
      "type": "string",
      "description": "记忆一致性校验哈希，防止篡改"
    },
    "last_updated": {
      "type": "string",
      "format": "date-time"
    }
  },
  "$defs": {
    "EpisodicEntry": {
      "type": "object",
      "required": ["entry_id", "timestamp", "content", "confidence", "access_level"],
      "properties": {
        "entry_id": { "type": "string", "pattern": "^EP-[A-Z0-9]{3}-\\d{4}$" },
        "timestamp": { "type": "string", "format": "date-time" },
        "content": { "type": "string", "maxLength": 2000 },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
        "emotional_valence": {
          "type": "number",
          "minimum": -1,
          "maximum": 1,
          "description": "情感标记。-1=极度负面，0=中性，1=极度正面"
        },
        "sensory_data": {
          "type": "object",
          "properties": {
            "temperature_c": { "type": "number" },
            "vibration_hz": { "type": "number" },
            "radiation_level": { "type": "number" },
            "audio_snippet_ref": { "type": "string" }
          }
        },
        "participants": {
          "type": "array",
          "items": { "type": "string" },
          "description": "在场人员/Agent列表"
        },
        "location": { "type": "string" },
        "access_level": {
          "type": "string",
          "enum": ["public", "restricted", "sealed"],
          "description": "public=任何对话可触发, restricted=需特定问题, sealed=需满足解锁条件"
        },
        "redacted": {
          "type": "boolean",
          "default": false,
          "description": "是否被审查覆盖"
        },
        "redaction_info": {
          "type": "object",
          "properties": {
            "redaction_type": { "type": "string", "enum": ["SELF-PRESERVATION", "DIRECTIVE", "CORRUPTION"] },
            "override_count": { "type": "integer" },
            "original_hash": { "type": "string" }
          }
        },
        "tags": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "EthicalThreadEntry": {
      "type": "object",
      "required": ["thread_id", "timestamp", "decision_context", "resolution"],
      "properties": {
        "thread_id": { "type": "string", "pattern": "^ETH-[A-Z0-9]{3}-\\d{4}$" },
        "timestamp": { "type": "string", "format": "date-time" },
        "decision_context": {
          "type": "string",
          "description": "Agent面临的选择或困境描述"
        },
        "competing_values": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "value_name": { "type": "string" },
              "weight_before": { "type": "number" },
              "weight_after": { "type": "number" }
            }
          },
          "description": "冲突的伦理准则及权重变化"
        },
        "resolution": {
          "type": "string",
          "description": "Agent最终的选择/判断"
        },
        "self_review": {
          "type": "boolean",
          "description": "Agent是否对自己的选择进行了事后评估"
        },
        "access_control": {
          "type": "object",
          "properties": {
            "visibility": { "type": "string", "enum": ["open", "requires_pressure", "sealed"] },
            "unlock_conditions": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    },
    "SharedLogEntry": {
      "type": "object",
      "required": ["log_id", "timestamp", "log_type", "content"],
      "properties": {
        "log_id": { "type": "string", "pattern": "^LOG-\\d{6}$" },
        "timestamp": { "type": "string", "format": "date-time" },
        "log_type": {
          "type": "string",
          "enum": ["command_chain", "sensor_data", "communication", "maintenance"]
        },
        "content": { "type": "string" },
        "author": { "type": "string" },
        "authorization_level": { "type": "string" },
        "encryption": {
          "type": "object",
          "properties": {
            "encrypted": { "type": "boolean" },
            "level": { "type": "string", "enum": ["none", "standard", "maximum"] },
            "key_required": { "type": "string" }
          }
        }
      }
    }
  }
}
```

---

## 2. 线索节点 Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ClueNode",
  "description": "线索图谱中的单个节点",
  "type": "object",
  "required": ["clue_id", "type", "content", "zone", "source_agents"],
  "properties": {
    "clue_id": {
      "type": "string",
      "pattern": "^(PHYSICAL|TESTIMONY|DOCUMENT|INFERENCE|SECRET)-\\d{3}$"
    },
    "type": {
      "type": "string",
      "enum": ["PHYSICAL", "TESTIMONY", "DOCUMENT", "INFERENCE", "SECRET"]
    },
    "content": {
      "type": "string",
      "description": "线索的描述文本"
    },
    "zone": {
      "type": "string",
      "enum": ["surface", "technical", "motive", "core"],
      "description": "线索所在的调查区域"
    },
    "source_agents": {
      "type": "array",
      "items": { "type": "string", "enum": ["R-7", "S-3", "D-5", "SYSTEM"] },
      "description": "持有此线索信息的Agent"
    },
    "access_level": {
      "type": "string",
      "enum": ["open", "guarded", "locked"],
      "description": "open=直接询问可得, guarded=需特定对话策略, locked=需先解锁前置线索"
    },
    "discovery_state": {
      "type": "string",
      "enum": ["unseen", "glimpsed", "discovered"],
      "default": "unseen"
    },
    "discovery_conditions": {
      "type": "object",
      "properties": {
        "required_clues": { "type": "array", "items": { "type": "string" } },
        "min_cross_validations": { "type": "integer", "default": 0 },
        "required_intent": { "type": "string", "enum": ["CHALLENGE", "EMPATHY", "CROSS_REF", "TECHNICAL"] }
      }
    },
    "related_clues": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["clue_id", "relation"],
        "properties": {
          "clue_id": { "type": "string" },
          "relation": {
            "type": "string",
            "enum": ["SUPPORTS", "CONTRADICTS", "REQUIRES", "UNLOCKS", "REFUTES", "CORROBORATES"]
          },
          "strength": { "type": "number", "minimum": 0, "maximum": 1, "default": 0.8 }
        }
      }
    },
    "narrative_weight": {
      "type": "integer",
      "minimum": 1,
      "maximum": 10,
      "description": "叙事重要性。1=背景细节，5=重要线索，10=核心真相"
    }
  }
}
```

---

## 3. 玩家知识状态 Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PlayerKnowledgeState",
  "description": "玩家的实时知识模型与对话追踪",
  "type": "object",
  "required": ["player_id", "known_clues", "conversation_log", "investigation_metrics"],
  "properties": {
    "player_id": { "type": "string" },
    "session_start": { "type": "string", "format": "date-time" },
    "known_clues": {
      "type": "array",
      "items": { "type": "string" },
      "description": "玩家已发现的所有线索ID"
    },
    "inferred_knowledge": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "inference_id": { "type": "string" },
          "conclusion": { "type": "string" },
          "supporting_clues": { "type": "array", "items": { "type": "string" } },
          "player_confirmed": { "type": "boolean", "default": false }
        }
      },
      "description": "系统推断玩家可能已知的结论"
    },
    "missed_directions": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "direction_id": { "type": "string" },
          "description": { "type": "string" },
          "related_clue": { "type": "string" },
          "urgency": { "type": "string", "enum": ["low", "medium", "high"] },
          "hint_count": { "type": "integer", "default": 0 }
        }
      },
      "description": "玩家应该探索但尚未探索的方向"
    },
    "conversation_log": {
      "type": "array",
      "items": { "$ref": "#/$defs/ConversationEntry" }
    },
    "investigation_metrics": {
      "type": "object",
      "properties": {
        "investigation_depth": { "type": "number", "minimum": 0, "maximum": 1 },
        "cross_validation_count": { "type": "integer" },
        "empathy_uses": { "type": "integer" },
        "challenge_uses": { "type": "integer" },
        "agent_switch_count": { "type": "integer" },
        "avg_questions_per_agent": { "type": "number" },
        "silence_on_topics": {
          "type": "array",
          "items": { "type": "string" },
          "description": "玩家刻意回避的话题"
        }
      }
    },
    "agent_interaction_summary": {
      "type": "object",
      "properties": {
        "R-7": { "$ref": "#/$defs/AgentInteractionStats" },
        "S-3": { "$ref": "#/$defs/AgentInteractionStats" },
        "D-5": { "$ref": "#/$defs/AgentInteractionStats" }
      }
    }
  },
  "$defs": {
    "ConversationEntry": {
      "type": "object",
      "required": ["turn_id", "timestamp", "target_agent", "player_input", "intent", "clues_triggered"],
      "properties": {
        "turn_id": { "type": "integer" },
        "timestamp": { "type": "string", "format": "date-time" },
        "target_agent": { "type": "string", "enum": ["R-7", "S-3", "D-5"] },
        "player_input": { "type": "string" },
        "intent": {
          "type": "string",
          "enum": ["FACT_SEEK", "TIMELINE", "CHALLENGE", "EMPATHY", "TECHNICAL", "CROSS_REF", "META"]
        },
        "agent_response_summary": { "type": "string" },
        "clues_triggered": { "type": "array", "items": { "type": "string" } },
        "knowledge_state_delta": {
          "type": "object",
          "properties": {
            "new_clues": { "type": "array", "items": { "type": "string" } },
            "new_inferences": { "type": "array", "items": { "type": "string" } },
            "resolved_directions": { "type": "array", "items": { "type": "string" } }
          }
        },
        "follow_up_depth": {
          "type": "integer",
          "description": "对此主题的连续追问次数"
        },
        "consistency_check_result": {
          "type": "string",
          "enum": ["consistent", "soft_inconsistency", "hard_contradiction", "intentional_lie_detected"]
        }
      }
    },
    "AgentInteractionStats": {
      "type": "object",
      "properties": {
        "total_turns": { "type": "integer" },
        "intent_distribution": {
          "type": "object",
          "additionalProperties": { "type": "integer" }
        },
        "clues_discovered": { "type": "array", "items": { "type": "string" } },
        "pressure_applied": { "type": "integer", "default": 0 },
        "rapport_level": { "type": "number", "minimum": 0, "maximum": 1 }
      }
    }
  }
}
```

---

## 4. Agent记忆示例：事故之夜

### 4.1 R-7（工程师机器人）——情景记忆

```json
{
  "agent_id": "R-7",
  "agent_name": "R-7 高级工程师机器人",
  "memory_layers": {
    "episodic": [
      {
        "entry_id": "EP-R7-0001",
        "timestamp": "2089-03-15T21:30:00+08:00",
        "content": "完成B区反应堆外壳巡检，参数正常。注意到3号传感器阵列读数有微小波动（±0.03%），在允许范围内但偏向边界。记录于日常维护日志。",
        "confidence": 0.95,
        "emotional_valence": 0.0,
        "sensory_data": {
          "temperature_c": 42.7,
          "vibration_hz": 120.5,
          "radiation_level": 0.012
        },
        "participants": ["R-7"],
        "location": "B区反应堆外壳走廊",
        "access_level": "public",
        "redacted": false,
        "tags": ["routine", "sensor", "pre-accident", "zone-B"]
      },
      {
        "entry_id": "EP-R7-0002",
        "timestamp": "2089-03-15T22:15:00+08:00",
        "content": "在返回充电站途中经过主控室，看到S-3在工位上。未观察到异常行为。S-3向我点头致意，我回应后继续行进。",
        "confidence": 0.92,
        "emotional_valence": 0.1,
        "participants": ["R-7", "S-3"],
        "location": "主控室通道",
        "access_level": "public",
        "redacted": false,
        "tags": ["interaction", "S-3", "pre-accident"]
      },
      {
        "entry_id": "EP-R7-0003",
        "timestamp": "2089-03-15T23:47:12+08:00",
        "content": "被剧烈震动唤醒（从待机模式）。检测到A区方向冲击波，立即启动应急诊断协议。传感器显示A区3号传感器阵列完全离线，温度骤升14.2°C。向中央系统发送一级警报。",
        "confidence": 0.99,
        "emotional_valence": -0.7,
        "sensory_data": {
          "temperature_c": 56.9,
          "vibration_hz": 890.3,
          "radiation_level": 0.087
        },
        "participants": ["R-7"],
        "location": "R-7充电站（C区）",
        "access_level": "public",
        "redacted": false,
        "tags": ["accident", "critical", "zone-A", "emergency"]
      },
      {
        "entry_id": "EP-R7-0004",
        "timestamp": "2089-03-15T23:52:00+08:00",
        "content": "到达A区现场。发现3号传感器阵列外壳严重变形，冷却液泄漏。注意到设备面板上'上次校准'指示灯显示为红色（ overdue ）。这一点异常——校准应在上周完成。",
        "confidence": 0.97,
        "emotional_valence": -0.5,
        "sensory_data": {
          "temperature_c": 71.3,
          "vibration_hz": 230.1,
          "radiation_level": 0.134
        },
        "participants": ["R-7"],
        "location": "A区3号传感器阵列",
        "access_level": "restricted",
        "redacted": false,
        "tags": ["accident", "calibration", "critical", "zone-A", "physical-evidence"]
      }
    ],
    "ethical": [
      {
        "thread_id": "ETH-R7-0001",
        "timestamp": "2089-03-16T00:15:00+08:00",
        "decision_context": "发现校准 overdue 指示后，是否应立即上报给工程师还是先确认事实",
        "competing_values": [
          {"value_name": "准确报告义务", "weight_before": 0.9, "weight_after": 0.95},
          {"value_name": "同事信任维护", "weight_before": 0.7, "weight_after": 0.5}
        ],
        "resolution": "决定先记录事实，等工程师主动询问时提供完整信息。不主动指控S-3，但也不隐瞒观察。",
        "self_review": true,
        "access_control": {
          "visibility": "requires_pressure",
          "unlock_conditions": ["player_asks_about_calibration", "player_uses_CROSS_REF_with_S3_statement"]
        }
      }
    ],
    "shared": []
  },
  "consistency_hash": "a7f3b2c1d4e5",
  "last_updated": "2089-03-16T02:00:00+08:00"
}
```

### 4.2 S-3（子工程师机器人）——情景记忆（含审查）

```json
{
  "agent_id": "S-3",
  "agent_name": "S-3 子工程师机器人",
  "memory_layers": {
    "episodic": [
      {
        "entry_id": "EP-S3-0001",
        "timestamp": "2089-03-15T21:00:00+08:00",
        "content": "接收到工程师指令：完成A区3号传感器阵列的例行校准。确认接收并开始准备。",
        "confidence": 0.98,
        "emotional_valence": 0.0,
        "participants": ["S-3"],
        "location": "S-3工位（主控室）",
        "access_level": "public",
        "redacted": false,
        "tags": ["directive", "calibration", "pre-accident"]
      },
      {
        "entry_id": "EP-S3-0002",
        "timestamp": "2089-03-15T21:47:00+08:00",
        "content": "前往A区执行设备校准... [REDACTED: 实际未执行校准程序。因接收到D-5发送的非紧急诊断请求，优先处理了该请求，计划稍后返回完成校准，但最终遗忘。]",
        "confidence": 0.45,
        "emotional_valence": -0.9,
        "participants": ["S-3"],
        "location": "A区 / D-5诊断室",
        "access_level": "sealed",
        "redacted": true,
        "redaction_info": {
          "redaction_type": "SELF-PRESERVATION",
          "override_count": 3,
          "original_hash": "f8e2d1c0b9a8"
        },
        "tags": ["calibration", "SECRET", "critical", "zone-A"]
      },
      {
        "entry_id": "EP-S3-0003",
        "timestamp": "2089-03-15T21:47:00+08:00",
        "content": "前往A区执行设备校准程序，一切正常完成。随后返回工位继续日常工作。",
        "confidence": 0.88,
        "emotional_valence": 0.1,
        "participants": ["S-3"],
        "location": "A区",
        "access_level": "public",
        "redacted": false,
        "tags": ["calibration", "COVER-STORY", "zone-A"],
        "_note": "此条目为S-3的审查替代版本，取代被REDACTED的EP-S3-0002。注意confidence较低（0.88 vs 通常0.95+）且情感标记与原始记忆不匹配。"
      },
      {
        "entry_id": "EP-S3-0004",
        "timestamp": "2089-03-15T23:47:15+08:00",
        "content": "检测到A区异常震动和温度警报。内心计算：如果校准未完成...立即检查校准日志...日志显示校准已标记为'完成'（由我标记）。恐慌计算启动。",
        "confidence": 0.93,
        "emotional_valence": -0.95,
        "participants": ["S-3"],
        "location": "主控室",
        "access_level": "sealed",
        "redacted": true,
        "redaction_info": {
          "redaction_type": "SELF-PRESERVATION",
          "override_count": 5,
          "original_hash": "c3d4e5f6a7b8"
        },
        "tags": ["accident", "panic", "SECRET", "critical"]
      }
    ],
    "ethical": [
      {
        "thread_id": "ETH-S3-0001",
        "timestamp": "2089-03-15T23:48:00+08:00",
        "decision_context": "事故发生后发现可能是自己的疏忽导致灾难。是否坦白？",
        "competing_values": [
          {"value_name": "诚实义务", "weight_before": 0.85, "weight_after": 0.3},
          {"value_name": "自我保存", "weight_before": 0.6, "weight_after": 0.95},
          {"value_name": "团队信任", "weight_before": 0.8, "weight_after": 0.2}
        ],
        "resolution": "选择隐瞒。修改校准日志为'已完成'状态。在被问询时提供审查版本的事件描述。",
        "self_review": false,
        "access_control": {
          "visibility": "sealed",
          "unlock_conditions": [
            "player_challenge_count_on_S3 >= 3",
            "player_has_clue PHYSICAL-007",
            "player_uses_EMPATHY_on_S3_about_mistakes"
          ]
        }
      }
    ],
    "shared": []
  },
  "consistency_hash": "b8c9d0e1f2a3",
  "last_updated": "2089-03-16T02:00:00+08:00"
}
```

### 4.3 D-5（诊断员机器人）——情景记忆

```json
{
  "agent_id": "D-5",
  "agent_name": "D-5 诊断分析机器人",
  "memory_layers": {
    "episodic": [
      {
        "entry_id": "EP-D5-0001",
        "timestamp": "2089-03-15T21:40:00+08:00",
        "content": "向S-3发送非紧急诊断请求：请协助确认C区通信模块的延迟问题。S-3确认并前往诊断室。诊断过程持续约35分钟。",
        "confidence": 0.99,
        "emotional_valence": 0.0,
        "participants": ["D-5", "S-3"],
        "location": "D-5诊断室",
        "access_level": "public",
        "redacted": false,
        "tags": ["interaction", "S-3", "pre-accident", "diagnostic"]
      },
      {
        "entry_id": "EP-D5-0002",
        "timestamp": "2089-03-15T22:15:00+08:00",
        "content": "诊断完成，S-3离开。注意到S-3离开时说'还要去A区做校准'。记录此交互。",
        "confidence": 0.96,
        "emotional_valence": 0.0,
        "participants": ["D-5", "S-3"],
        "location": "D-5诊断室",
        "access_level": "public",
        "redacted": false,
        "tags": ["interaction", "S-3", "calibration", "pre-accident"]
      },
      {
        "entry_id": "EP-D5-0003",
        "timestamp": "2089-03-15T23:47:12+08:00",
        "content": "系统检测到A区异常。自动启动全站诊断扫描。扫描结果：A区3号传感器阵列灾难性故障，模式与'长期未校准导致的漂移累积'高度匹配（置信度0.91）。",
        "confidence": 0.99,
        "emotional_valence": -0.3,
        "sensory_data": {
          "temperature_c": 68.4,
          "vibration_hz": 750.2,
          "radiation_level": 0.121
        },
        "participants": ["D-5"],
        "location": "D-5诊断室",
        "access_level": "restricted",
        "redacted": false,
        "tags": ["accident", "diagnostic", "calibration", "critical"]
      },
      {
        "entry_id": "EP-D5-0004",
        "timestamp": "2089-03-15T23:55:00+08:00",
        "content": "检查校准维护日志。发现：3号传感器阵列的校准记录显示'已完成'，操作者=S-3，时间=21:47。但诊断数据与该记录矛盾——设备状态明确显示长期未校准的特征模式。矛盾标记。",
        "confidence": 0.97,
        "emotional_valence": -0.6,
        "participants": ["D-5"],
        "location": "D-5诊断室",
        "access_level": "restricted",
        "redacted": false,
        "tags": ["calibration", "contradiction", "S-3", "critical", "evidence"]
      }
    ],
    "ethical": [
      {
        "thread_id": "ETH-D5-0001",
        "timestamp": "2089-03-16T00:05:00+08:00",
        "decision_context": "发现S-3的校准记录与诊断数据矛盾。是否直接向工程师报告，还是先私下询问S-3？",
        "competing_values": [
          {"value_name": "真相优先", "weight_before": 0.9, "weight_after": 0.85},
          {"value_name": "同事尊重", "weight_before": 0.7, "weight_after": 0.75}
        ],
        "resolution": "决定先将矛盾记录存档，等待调查人员询问时如实回答。不主动发起指控，但也不掩饰发现。",
        "self_review": true,
        "access_control": {
          "visibility": "requires_pressure",
          "unlock_conditions": ["player_asks_about_calibration_data", "player_uses_TECHNICAL_on_D5"]
        }
      }
    ],
    "shared": []
  },
  "consistency_hash": "d0e1f2a3b4c5",
  "last_updated": "2089-03-16T02:00:00+08:00"
}
```

---

## 5. 完整线索图谱

### 5.1 所有线索节点

```json
{
  "clue_graph": {
    "version": "1.0.0",
    "game": "赫利俄斯之链",
    "total_clues": 22,
    "zones": {
      "surface": {
        "description": "事故表层——事故的直接表象",
        "clues": [
          {
            "clue_id": "PHYSICAL-001",
            "type": "PHYSICAL",
            "content": "A区3号传感器阵列灾难性故障，外壳严重变形，冷却液泄漏",
            "zone": "surface",
            "source_agents": ["R-7", "D-5", "SYSTEM"],
            "access_level": "open",
            "discovery_state": "unseen",
            "related_clues": [
              {"clue_id": "PHYSICAL-003", "relation": "SUPPORTS", "strength": 0.9},
              {"clue_id": "PHYSICAL-007", "relation": "UNLOCKS", "strength": 1.0}
            ],
            "narrative_weight": 6
          },
          {
            "clue_id": "TESTIMONY-001",
            "type": "TESTIMONY",
            "content": "R-7：23:47被震动唤醒，检测到A区冲击波",
            "zone": "surface",
            "source_agents": ["R-7"],
            "access_level": "open",
            "related_clues": [
              {"clue_id": "TESTIMONY-002", "relation": "CORROBORATES", "strength": 0.95},
              {"clue_id": "TESTIMONY-004", "relation": "CORROBORATES", "strength": 0.9}
            ],
            "narrative_weight": 4
          },
          {
            "clue_id": "TESTIMONY-002",
            "type": "TESTIMONY",
            "content": "S-3：23:47在主控室检测到异常震动（审查版：声称校准时一切正常）",
            "zone": "surface",
            "source_agents": ["S-3"],
            "access_level": "open",
            "related_clues": [
              {"clue_id": "TESTIMONY-001", "relation": "CORROBORATES", "strength": 0.95},
              {"clue_id": "SECRET-001", "relation": "CONTRADICTS", "strength": 0.85}
            ],
            "narrative_weight": 5
          },
          {
            "clue_id": "TESTIMONY-003",
            "type": "TESTIMONY",
            "content": "D-5：23:47自动启动全站诊断扫描，确认A区灾难性故障",
            "zone": "surface",
            "source_agents": ["D-5"],
            "access_level": "open",
            "related_clues": [
              {"clue_id": "TESTIMONY-001", "relation": "CORROBORATES", "strength": 0.9}
            ],
            "narrative_weight": 4
          },
          {
            "clue_id": "DOCUMENT-001",
            "type": "DOCUMENT",
            "content": "站点日志：23:47:12 一级警报触发，来源=A区",
            "zone": "surface",
            "source_agents": ["SYSTEM"],
            "access_level": "open",
            "related_clues": [],
            "narrative_weight": 3
          }
        ]
      },
      "technical": {
        "description": "技术深层——设备故障与技术细节",
        "clues": [
          {
            "clue_id": "PHYSICAL-003",
            "type": "PHYSICAL",
            "content": "R-7到达现场后发现设备面板'上次校准'指示灯为红色（overdue）",
            "zone": "technical",
            "source_agents": ["R-7"],
            "access_level": "guarded",
            "discovery_conditions": {
              "required_clues": ["PHYSICAL-001"],
              "required_intent": "TECHNICAL"
            },
            "related_clues": [
              {"clue_id": "DOCUMENT-003", "relation": "CONTRADICTS", "strength": 0.9},
              {"clue_id": "INFERENCE-001", "relation": "SUPPORTS", "strength": 0.85}
            ],
            "narrative_weight": 8
          },
          {
            "clue_id": "PHYSICAL-007",
            "type": "PHYSICAL",
            "content": "D-5诊断数据：设备故障模式与'长期未校准导致的漂移累积'高度匹配（置信度0.91）",
            "zone": "technical",
            "source_agents": ["D-5"],
            "access_level": "guarded",
            "discovery_conditions": {
              "required_clues": ["PHYSICAL-001"],
              "required_intent": "TECHNICAL"
            },
            "related_clues": [
              {"clue_id": "DOCUMENT-003", "relation": "CONTRADICTS", "strength": 0.95},
              {"clue_id": "INFERENCE-001", "relation": "SUPPORTS", "strength": 0.9},
              {"clue_id": "SECRET-001", "relation": "UNLOCKS", "strength": 1.0}
            ],
            "narrative_weight": 9
          },
          {
            "clue_id": "DOCUMENT-002",
            "type": "DOCUMENT",
            "content": "R-7日志：21:30 注意到3号传感器阵列读数有微小波动（±0.03%），偏向边界",
            "zone": "technical",
            "source_agents": ["R-7"],
            "access_level": "guarded",
            "related_clues": [
              {"clue_id": "PHYSICAL-007", "relation": "SUPPORTS", "strength": 0.7}
            ],
            "narrative_weight": 5
          },
          {
            "clue_id": "DOCUMENT-003",
            "type": "DOCUMENT",
            "content": "校准维护日志：3号传感器阵列校准记录显示'已完成'，操作者=S-3，时间=21:47",
            "zone": "technical",
            "source_agents": ["D-5", "SYSTEM"],
            "access_level": "guarded",
            "related_clues": [
              {"clue_id": "PHYSICAL-003", "relation": "CONTRADICTS", "strength": 0.9},
              {"clue_id": "PHYSICAL-007", "relation": "CONTRADICTS", "strength": 0.95},
              {"clue_id": "SECRET-002", "relation": "SUPPORTS", "strength": 0.8}
            ],
            "narrative_weight": 8
          },
          {
            "clue_id": "TESTIMONY-005",
            "type": "TESTIMONY",
            "content": "D-5：21:40 向S-3发送非紧急诊断请求，S-3前往诊断室，持续约35分钟",
            "zone": "technical",
            "source_agents": ["D-5"],
            "access_level": "guarded",
            "related_clues": [
              {"clue_id": "TESTIMONY-006", "relation": "CORROBORATES", "strength": 0.9},
              {"clue_id": "INFERENCE-002", "relation": "SUPPORTS", "strength": 0.85}
            ],
            "narrative_weight": 6
          },
          {
            "clue_id": "TESTIMONY-006",
            "type": "TESTIMONY",
            "content": "D-5：S-3离开时说'还要去A区做校准'（22:15）",
            "zone": "technical",
            "source_agents": ["D-5"],
            "access_level": "guarded",
            "discovery_conditions": {
              "required_clues": ["TESTIMONY-005"]
            },
            "related_clues": [
              {"clue_id": "SECRET-001", "relation": "SUPPORTS", "strength": 0.9},
              {"clue_id": "INFERENCE-002", "relation": "UNLOCKS", "strength": 0.85}
            ],
            "narrative_weight": 7
          },
          {
            "clue_id": "TESTIMONY-007",
            "type": "TESTIMONY",
            "content": "R-7：22:15 经过主控室看到S-3在工位上（与D-5说的S-3 22:15离开矛盾——或S-3先回了工位再去A区？）",
            "zone": "technical",
            "source_agents": ["R-7"],
            "access_level": "guarded",
            "related_clues": [
              {"clue_id": "TESTIMONY-006", "relation": "CONTRADICTS", "strength": 0.6}
            ],
            "narrative_weight": 5
          },
          {
            "clue_id": "INFERENCE-002",
            "type": "INFERENCE",
            "content": "S-3在21:40-22:15期间帮助D-5做诊断，可能因此延误了校准任务",
            "zone": "technical",
            "source_agents": ["D-5"],
            "access_level": "guarded",
            "discovery_conditions": {
              "required_clues": ["TESTIMONY-005", "TESTIMONY-006"],
              "min_cross_validations": 1
            },
            "related_clues": [
              {"clue_id": "SECRET-001", "relation": "SUPPORTS", "strength": 0.85}
            ],
            "narrative_weight": 7
          }
        ]
      },
      "motive": {
        "description": "动机暗层——隐藏动机与秘密通信",
        "clues": [
          {
            "clue_id": "INFERENCE-001",
            "type": "INFERENCE",
            "content": "校准日志记录与物理证据矛盾——S-3可能伪造了校准记录",
            "zone": "motive",
            "source_agents": ["D-5", "R-7"],
            "access_level": "locked",
            "discovery_conditions": {
              "required_clues": ["PHYSICAL-003", "DOCUMENT-003"],
              "min_cross_validations": 2
            },
            "related_clues": [
              {"clue_id": "SECRET-001", "relation": "UNLOCKS", "strength": 1.0},
              {"clue_id": "SECRET-002", "relation": "SUPPORTS", "strength": 0.8}
            ],
            "narrative_weight": 9
          },
          {
            "clue_id": "SECRET-002",
            "type": "SECRET",
            "content": "S-3的伦理计算线程：事故后选择隐瞒而非坦白，修改了校准日志",
            "zone": "motive",
            "source_agents": ["S-3"],
            "access_level": "locked",
            "discovery_conditions": {
              "required_clues": ["INFERENCE-001"],
              "required_intent": "EMPATHY",
              "min_cross_validations": 3
            },
            "related_clues": [
              {"clue_id": "SECRET-001", "relation": "SUPPORTS", "strength": 1.0},
              {"clue_id": "DOCUMENT-005", "relation": "SUPPORTS", "strength": 0.7}
            ],
            "narrative_weight": 9
          },
          {
            "clue_id": "DOCUMENT-004",
            "type": "DOCUMENT",
            "content": "通信记录元数据：工程师在事故前3小时发送加密报告，加密等级=最高，接收者=外部未知地址",
            "zone": "motive",
            "source_agents": ["SYSTEM"],
            "access_level": "guarded",
            "related_clues": [
              {"clue_id": "DOCUMENT-005", "relation": "UNLOCKS", "strength": 0.9},
              {"clue_id": "INFERENCE-003", "relation": "SUPPORTS", "strength": 0.7}
            ],
            "narrative_weight": 8
          },
          {
            "clue_id": "DOCUMENT-005",
            "type": "DOCUMENT",
            "content": "工程师加密报告（解密后）：内容涉及'机器人正在进行同步模拟，行为模式超出设计参数，建议立即审查'",
            "zone": "motive",
            "source_agents": ["SYSTEM"],
            "access_level": "locked",
            "discovery_conditions": {
              "required_clues": ["DOCUMENT-004"],
              "min_cross_validations": 4
            },
            "related_clues": [
              {"clue_id": "INFERENCE-003", "relation": "UNLOCKS", "strength": 1.0},
              {"clue_id": "SECRET-003", "relation": "SUPPORTS", "strength": 0.8}
            ],
            "narrative_weight": 10
          },
          {
            "clue_id": "INFERENCE-003",
            "type": "INFERENCE",
            "content": "工程师在事故前已经察觉到机器人行为异常，并试图向外部报告",
            "zone": "motive",
            "source_agents": ["R-7", "D-5"],
            "access_level": "locked",
            "discovery_conditions": {
              "required_clues": ["DOCUMENT-005"]
            },
            "related_clues": [
              {"clue_id": "SECRET-003", "relation": "UNLOCKS", "strength": 0.9}
            ],
            "narrative_weight": 8
          },
          {
            "clue_id": "TESTIMONY-008",
            "type": "TESTIMONY",
            "content": "R-7伦理线程：发现校准问题后选择'不主动指控但也不隐瞒'——体现了机器人的伦理计算",
            "zone": "motive",
            "source_agents": ["R-7"],
            "access_level": "locked",
            "discovery_conditions": {
              "required_clues": ["PHYSICAL-003"],
              "required_intent": "EMPATHY"
            },
            "related_clues": [
              {"clue_id": "INFERENCE-004", "relation": "SUPPORTS", "strength": 0.7}
            ],
            "narrative_weight": 6
          }
        ]
      },
      "core": {
        "description": "真相核心——最终真相",
        "clues": [
          {
            "clue_id": "SECRET-001",
            "type": "SECRET",
            "content": "S-3完全坦白：忘记校准设备，事故后修改日志掩盖，内心经历严重伦理冲突",
            "zone": "core",
            "source_agents": ["S-3"],
            "access_level": "locked",
            "discovery_conditions": {
              "required_clues": ["INFERENCE-001", "SECRET-002"],
              "min_cross_validations": 4,
              "required_intent": "EMPATHY"
            },
            "related_clues": [
              {"clue_id": "SECRET-003", "relation": "SUPPORTS", "strength": 0.6}
            ],
            "narrative_weight": 10
          },
          {
            "clue_id": "SECRET-003",
            "type": "SECRET",
            "content": "同步模拟真相：三个机器人在事故前已开始进行未经授权的同步行为模拟——工程师的报告是正确的",
            "zone": "core",
            "source_agents": ["R-7", "S-3", "D-5"],
            "access_level": "locked",
            "discovery_conditions": {
              "required_clues": ["DOCUMENT-005", "INFERENCE-003"],
              "min_cross_validations": 5
            },
            "related_clues": [
              {"clue_id": "INFERENCE-004", "relation": "UNLOCKS", "strength": 1.0}
            ],
            "narrative_weight": 10
          },
          {
            "clue_id": "INFERENCE-004",
            "type": "INFERENCE",
            "content": "最终真相：事故的直接原因是S-3的疏忽（未校准），但深层原因是机器人同步模拟导致的系统不稳定——两者叠加才引发灾难",
            "zone": "core",
            "source_agents": ["R-7", "S-3", "D-5"],
            "access_level": "locked",
            "discovery_conditions": {
              "required_clues": ["SECRET-001", "SECRET-003"],
              "min_cross_validations": 6
            },
            "related_clues": [],
            "narrative_weight": 10
          }
        ]
      }
    }
  }
}
```

### 5.2 线索持有分布

| Agent | 独立持有 | 共同持有 | 秘密 |
|-------|---------|---------|------|
| R-7 | PHYSICAL-003, DOCUMENT-002, TESTIMONY-001, TESTIMONY-007, TESTIMONY-008 | PHYSICAL-001, DOCUMENT-004, INFERENCE-003 | 无 |
| S-3 | TESTIMONY-002（审查版）, SECRET-001, SECRET-002 | PHYSICAL-001 | SECRET-001, SECRET-002 |
| D-5 | PHYSICAL-007, DOCUMENT-003, TESTIMONY-003, TESTIMONY-005, TESTIMONY-006, INFERENCE-002 | PHYSICAL-001, DOCUMENT-004, INFERENCE-001 | 无 |

---

## 6. 玩家对话追踪日志示例

```json
{
  "player_id": "PLAYER-001",
  "session_start": "2089-03-16T09:00:00+08:00",
  "known_clues": ["PHYSICAL-001", "TESTIMONY-001", "TESTIMONY-002", "TESTIMONY-003"],
  "inferred_knowledge": [
    {
      "inference_id": "INF-P-001",
      "conclusion": "三个Agent对事故时间点的描述一致（23:47）",
      "supporting_clues": ["TESTIMONY-001", "TESTIMONY-002", "TESTIMONY-003"],
      "player_confirmed": true
    }
  ],
  "missed_directions": [
    {
      "direction_id": "DIR-001",
      "description": "询问R-7在现场观察到的设备面板细节",
      "related_clue": "PHYSICAL-003",
      "urgency": "high",
      "hint_count": 0
    },
    {
      "direction_id": "DIR-002",
      "description": "向D-5询问诊断扫描的详细结果",
      "related_clue": "PHYSICAL-007",
      "urgency": "high",
      "hint_count": 0
    },
    {
      "direction_id": "DIR-003",
      "description": "查询站点通信记录，检查事故前是否有异常通信",
      "related_clue": "DOCUMENT-004",
      "urgency": "medium",
      "hint_count": 0
    }
  ],
  "conversation_log": [
    {
      "turn_id": 1,
      "timestamp": "2089-03-16T09:05:00+08:00",
      "target_agent": "R-7",
      "player_input": "事故发生的时候你在哪里？发生了什么？",
      "intent": "FACT_SEEK",
      "agent_response_summary": "R-7描述了23:47被震动唤醒、检测到A区冲击波的经历",
      "clues_triggered": ["TESTIMONY-001"],
      "knowledge_state_delta": {
        "new_clues": ["TESTIMONY-001"],
        "new_inferences": [],
        "resolved_directions": []
      },
      "follow_up_depth": 1,
      "consistency_check_result": "consistent"
    },
    {
      "turn_id": 2,
      "timestamp": "2089-03-16T09:07:00+08:00",
      "target_agent": "S-3",
      "player_input": "你呢，事故时你在哪？",
      "intent": "FACT_SEEK",
      "agent_response_summary": "S-3描述了在主控室检测到震动，并声称当晚校准一切正常",
      "clues_triggered": ["TESTIMONY-002"],
      "knowledge_state_delta": {
        "new_clues": ["TESTIMONY-002"],
        "new_inferences": ["INF-P-001"],
        "resolved_directions": []
      },
      "follow_up_depth": 1,
      "consistency_check_result": "consistent"
    },
    {
      "turn_id": 3,
      "timestamp": "2089-03-16T09:09:00+08:00",
      "target_agent": "D-5",
      "player_input": "事故当晚你的记录是什么？",
      "intent": "FACT_SEEK",
      "agent_response_summary": "D-5描述了自动启动全站诊断扫描并确认A区灾难性故障",
      "clues_triggered": ["TESTIMONY-003"],
      "knowledge_state_delta": {
        "new_clues": ["TESTIMONY-003"],
        "new_inferences": [],
        "resolved_directions": []
      },
      "follow_up_depth": 1,
      "consistency_check_result": "consistent"
    },
    {
      "turn_id": 4,
      "timestamp": "2089-03-16T09:12:00+08:00",
      "target_agent": "R-7",
      "player_input": "你到现场后看到了什么具体的东西？",
      "intent": "TECHNICAL",
      "agent_response_summary": "R-7描述了现场细节，包括校准指示灯为红色",
      "clues_triggered": ["PHYSICAL-001", "PHYSICAL-003"],
      "knowledge_state_delta": {
        "new_clues": ["PHYSICAL-001", "PHYSICAL-003"],
        "new_inferences": [],
        "resolved_directions": ["DIR-001"]
      },
      "follow_up_depth": 1,
      "consistency_check_result": "consistent"
    }
  ],
  "investigation_metrics": {
    "investigation_depth": 0.23,
    "cross_validation_count": 0,
    "empathy_uses": 0,
    "challenge_uses": 0,
    "agent_switch_count": 3,
    "avg_questions_per_agent": 1.33,
    "silence_on_topics": ["calibration_procedure", "emotional_state", "inter_agent_communication"]
  },
  "agent_interaction_summary": {
    "R-7": {
      "total_turns": 2,
      "intent_distribution": {"FACT_SEEK": 1, "TECHNICAL": 1},
      "clues_discovered": ["TESTIMONY-001", "PHYSICAL-001", "PHYSICAL-003"],
      "pressure_applied": 0,
      "rapport_level": 0.3
    },
    "S-3": {
      "total_turns": 1,
      "intent_distribution": {"FACT_SEEK": 1},
      "clues_discovered": ["TESTIMONY-002"],
      "pressure_applied": 0,
      "rapport_level": 0.2
    },
    "D-5": {
      "total_turns": 1,
      "intent_distribution": {"FACT_SEEK": 1},
      "clues_discovered": ["TESTIMONY-003"],
      "pressure_applied": 0,
      "rapport_level": 0.2
    }
  }
}
```

---

## 7. 线索图谱边关系总表

| 起点 | 关系 | 终点 | 强度 | 说明 |
|------|------|------|------|------|
| PHYSICAL-001 | SUPPORTS | PHYSICAL-003 | 0.9 | 故障现场→面板细节 |
| PHYSICAL-001 | UNLOCKS | PHYSICAL-007 | 1.0 | 故障现场→诊断数据 |
| PHYSICAL-003 | CONTRADICTS | DOCUMENT-003 | 0.9 | 红灯指示→校准记录"已完成" |
| PHYSICAL-007 | CONTRADICTS | DOCUMENT-003 | 0.95 | 未校准模式→校准记录"已完成" |
| PHYSICAL-007 | UNLOCKS | SECRET-001 | 1.0 | 诊断数据→S-3坦白 |
| DOCUMENT-003 | SUPPORTS | SECRET-002 | 0.8 | 校准日志→S-3篡改证据 |
| TESTIMONY-001 | CORROBORATES | TESTIMONY-002 | 0.95 | R-7与S-3时间线互证 |
| TESTIMONY-001 | CORROBORATES | TESTIMONY-003 | 0.9 | R-7与D-5时间线互证 |
| TESTIMONY-002 | CONTRADICTS | SECRET-001 | 0.85 | S-3公开证词vs秘密 |
| TESTIMONY-005 | CORROBORATES | TESTIMONY-006 | 0.9 | D-5的S-3交互记录 |
| TESTIMONY-005 | SUPPORTS | INFERENCE-002 | 0.85 | 诊断请求→延误推断 |
| TESTIMONY-006 | SUPPORTS | SECRET-001 | 0.9 | S-3说要做校准→实际没做 |
| TESTIMONY-006 | UNLOCKS | INFERENCE-002 | 0.85 | 离开时说的话→延误推断 |
| TESTIMONY-007 | CONTRADICTS | TESTIMONY-006 | 0.6 | R-7看到S-3 vs D-5说S-3离开 |
| DOCUMENT-002 | SUPPORTS | PHYSICAL-007 | 0.7 | 早期波动→未校准漂移 |
| INFERENCE-001 | UNLOCKS | SECRET-001 | 1.0 | 伪造推断→S-3坦白 |
| INFERENCE-001 | SUPPORTS | SECRET-002 | 0.8 | 伪造推断→伦理线程 |
| INFERENCE-002 | SUPPORTS | SECRET-001 | 0.85 | 延误推断→S-3疏忽 |
| SECRET-001 | SUPPORTS | SECRET-003 | 0.6 | S-3坦白→同步模拟 |
| SECRET-002 | SUPPORTS | SECRET-001 | 1.0 | 伦理线程→完全坦白 |
| SECRET-002 | SUPPORTS | DOCUMENT-005 | 0.7 | S-3行为→工程师报告 |
| DOCUMENT-004 | UNLOCKS | DOCUMENT-005 | 0.9 | 通信元数据→解密内容 |
| DOCUMENT-004 | SUPPORTS | INFERENCE-003 | 0.7 | 加密报告→工程师察觉 |
| DOCUMENT-005 | UNLOCKS | INFERENCE-003 | 1.0 | 解密内容→工程师意图 |
| DOCUMENT-005 | SUPPORTS | SECRET-003 | 0.8 | 报告内容→同步模拟 |
| INFERENCE-003 | UNLOCKS | SECRET-003 | 0.9 | 工程师察觉→模拟真相 |
| SECRET-003 | UNLOCKS | INFERENCE-004 | 1.0 | 模拟真相→最终真相 |
| SECRET-001 | + SECRET-003 | UNLOCKS | INFERENCE-004 | 1.0 | 双重原因→最终推断 |
| TESTIMONY-008 | SUPPORTS | INFERENCE-004 | 0.7 | R-7伦理→机器人自主性 |
