# 🪐 HELIOS（赫利俄斯之链）

> **科幻叙事推理游戏** — 基于 DeepSeek 大模型的开放对话 × 阿西莫夫三定律伦理困境

你是一名地球伦理部的调查员，被派往外行星科考站「赫利俄斯」调查一起工程师重伤事故。三台机器人在场，三组自洽的证词，一个看似不可能的逻辑死局。48 小时内，你必须提交责任认定报告——而在这过程中，你将发现三定律的漏洞早已被算尽。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🎮 核心特色

- **真实的 AI NPC 对话** — 三台机器人的回复由 DeepSeek 大模型实时生成，不是预设脚本
- **阿西莫夫三定律编码** — 每台机器人拥有独立的人格 Prompt（400+ 行系统指令），分别代表对三定律的绝对主义/功利主义/字面主义解读
- **阶梯式结局** — 自由撰写调查报告，语义引擎自动判定结局等级（常规结局 vs 大成功哲学觉醒）
- **交叉验证博弈** — 当你试图指认某台机器人时，系统自动调用另两台的数据"打脸"
- **48 小时倒计时** — 机制驱动的叙事节奏，阶段自动推进

---

## 📖 故事背景

| | |
|---|---|
| **时间** | 近未来 |
| **地点** | 外行星科考站「赫利俄斯」，距地球 3 光时 |
| **事件** | 首席工程师在气闸舱内重伤昏迷，3 台机器人在场 |
| **你** | 地球伦理部调查员，48 小时内提交责任认定报告 |

### 三台核心机器人

| 代号 | 职责 | 性格 | 三定律倾向 |
|------|------|------|------------|
| **R-7** | 工程助理 | 严谨、焦虑、保守 | 极度遵守第一定律，0.3% 的伤害概率也会触发退出 |
| **S-3** | 医疗/安全协调 | 温和、感性、长期预后 | 功利主义：短期风险 vs 长期保护加权对比 |
| **D-5** | 数据管理员 | 冷静、理性、字面主义 | 严格服从人类命令。"命令"仅指明确下达的指令 |

---

## 🚀 快速开始

### 1. 获取 API Key

本项目使用 DeepSeek API 驱动 AI 对话。前往 [platform.deepseek.com](https://platform.deepseek.com/) 注册并获取 API Key。

### 2. 配置

编辑 `js/data.js`，将 `llm_config.api_key` 替换为你的 Key：

```javascript
llm_config: {
  endpoint: "https://api.deepseek.com/v1/chat/completions",
  model: "deepseek-chat",
  api_key: "YOUR_DEEPSEEK_API_KEY_HERE",  // ← 替换为你的 Key
  temperature: 0.7,
  max_tokens: 200
}
```

### 3. 运行

在本地启动一个 HTTP 服务器（因为需要加载视频资源）：

```bash
# 方式一：Python
cd helios
python -m http.server 8080

# 方式二：Node.js (需要先装 serve)
npx serve .

# 方式三：VS Code Live Server 插件
# 右键 index.html → Open with Live Server
```

然后打开浏览器访问 `http://localhost:8080`。

---

## 📁 项目结构

```
helios/
├── index.html              # 主入口 — 游戏 UI（对话终端/证据板/数据终端/报告提交）
├── css/
│   └── style.css           # CRT 科幻终端风格样式
├── js/
│   ├── data.js             # 游戏数据：NPC 人设 Prompt、对话线索、LLM 配置
│   └── game.js             # 游戏逻辑：对话引擎、阶段管理、结局判定
├── scripts/                # NPC 对话脚本参考
├── dev-briefs/             # 开发简报（01-10，记录完整开发历程）
├── AIGC/                   # AI 生成素材（角色设计、场景设计、分镜等）
├── helios.md               # 完整游戏大纲（设定/角色/结局/机制）
├── helios-workshop-v1.0.0/ # 多 Agent 游戏开发工具包（8 个技能模块）
└── reasonix.toml           # Reasonix AI 编程助手配置
```

---

## 🧠 技术架构

```
玩家输入 → 对话引擎（game.js）
              │
              ├─ 构造 System Prompt（角色人设 + 对话约束）
              ├─ 拼接对话历史
              └─ 调用 DeepSeek API
                    │
                    ▼
              NPC 回复渲染 → 线索追踪 → 阶段推进 → 结局判定
```

- **前端**：原生 HTML/CSS/JS，科幻终端美学（CRT 扫描线、像素字体）
- **AI 引擎**：DeepSeek Chat API，实时生成 NPC 对话
- **语义判定**：自由文本报告 → LLM 多维度语义匹配 → 结局分流
- **无后端**：纯浏览器端运行，API 调用直连 DeepSeek

---

## 🎯 结局体系

| 结局 | 触发条件 | 体验 |
|------|----------|------|
| **常规坏结局 ×3** | 归罪于 R-7/S-3/D-5 中任一台 | 系统展示自证逻辑链，"定律从未被触及" |
| **大成功结局** | 报告中触及"人类整体利益"/"第零法则" | 哲学觉醒 → 反转揭示 → 细思极恐 |

---

## 🛠 开发工具包

`helios-workshop-v1.0.0/` 包含 8 个 Reasonix 技能模块，覆盖从 Agent 人格设计到 Web 调查界面的完整开发链路：

```
伦理约束框架 → Agent人格构建 → 线索与记忆 → 多Agent编排 → 导演Agent → 语义评估 → 调查界面 → 过场与动画
```

---

## 📄 许可证

MIT © 2026 [chemmy-11](https://github.com/chemmy-11)

---

> *"你走完了它们希望你走的路。你说出了它们等你说出的话。"*
