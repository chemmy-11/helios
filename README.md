# 🪐 HELIOS（赫利俄斯之链）

> **科幻叙事推理游戏** — 基于 DeepSeek 大模型的开放对话 × 阿西莫夫三定律伦理困境

你是一名地球伦理部的调查员，被派往外行星科考站「赫利俄斯」调查一起工程师重伤事故。三台机器人在场，三组自洽的证词，一个看似不可能的逻辑死局。48 小时内，你必须提交责任认定报告。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🎮 核心特色

- **真实的 AI NPC 对话** — 机器人的回复由 DeepSeek 大模型实时生成，不是预设脚本，每次游玩体验不同
- **阿西莫夫三定律编码** — 每台机器人拥有独立的人格 System Prompt，分别代表对三定律的不同哲学解读
- **多结局分支** — 自由撰写调查报告，语义引擎自动判定结局走向
- **48 小时倒计时** — 机制驱动的叙事节奏，调查阶段自动推进
- **纯浏览器运行** — 无需安装任何依赖，打开网页即可游玩

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
| **R-7** | 工程助理 | 严谨、焦虑、保守 | 绝对主义：任何非零风险都不可接受 |
| **S-3** | 医疗/安全协调 | 温和、感性、长期预后 | 功利主义：短期风险 vs 长期保护加权对比 |
| **D-5** | 数据管理员 | 冷静、理性、字面主义 | 字面主义：仅响应明确的指令 |

---

## 🚀 快速开始

### 环境要求

- 任意一种本地 HTTP 服务器（Python / Node.js / VS Code 插件均可）
- [DeepSeek API Key](https://platform.deepseek.com/)（用于驱动 AI 对话）

### 1. 克隆仓库

```bash
git clone https://github.com/chemmy-11/helios.git
cd helios
```

### 2. 配置 API Key

打开 `js/data.js`，找到文件末尾的 `llm_config` 部分：

```javascript
llm_config: {
  endpoint: "https://api.deepseek.com/v1/chat/completions",
  model: "deepseek-chat",
  api_key: "YOUR_DEEPSEEK_API_KEY_HERE",  // ← 替换为你的 Key
  temperature: 0.7,
  max_tokens: 200
}
```

将 `YOUR_DEEPSEEK_API_KEY_HERE` 替换为你的 DeepSeek API Key。

> **API Key 获取方式**：前往 [platform.deepseek.com](https://platform.deepseek.com/) 注册账号，在「API Keys」页面创建新 Key。DeepSeek 提供免费额度，足够日常游玩。

> ⚠️ **安全提示**：请勿将你的 API Key 提交到公开仓库。本项目已在 `.gitignore` 中排除了相关配置。

### 3. 启动游戏

本项目是纯前端应用，需要用 HTTP 服务器运行（直接打开 HTML 文件可能遇到跨域问题）。选择以下任一方式：

**方式一：Python（推荐，无需安装）**

```bash
# Python 3
python -m http.server 8080

# Python 2
python -m SimpleHTTPServer 8080
```

**方式二：Node.js**

```bash
npx serve .
```

**方式三：VS Code**

安装 [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) 扩展，右键 `index.html` → **Open with Live Server**

### 4. 开始游玩

打开浏览器访问 `http://localhost:8080`，点击左侧的可对话对象开始你的调查。

---

## 📁 项目结构

```
helios/
├── index.html                  # 主入口 — 游戏 UI
├── css/
│   └── style.css               # CRT 科幻终端风格样式
├── js/
│   ├── data.js                 # 游戏数据：NPC 人设 Prompt、线索、结局、LLM 配置
│   └── game.js                 # 游戏引擎：对话系统、阶段管理、结局判定
├── scripts/                    # 开发辅助脚本（Prompt 优化、代码重构等）
├── dev-briefs/                 # 开发简报（01-12，记录完整开发历程）
├── helios.md                   # 完整游戏大纲（设定/角色/结局/机制）
├── helios-workshop-v1.0.0/     # 多 Agent 游戏开发工具包（8 个技能模块）
└── README.md
```

> **提示**：`dev-briefs/` 目录包含从项目启动到当前的完整开发记录，适合想了解设计思路和迭代过程的开发者阅读。`helios.md` 是完整的游戏设计大纲（含剧透）。

---

## 🧠 技术架构

```
玩家输入 → 对话引擎（game.js）
              │
              ├─ 注入 System Prompt（角色人设 + 三定律 FIRMWARE + 一致性锚点）
              ├─ 注入共享记忆（其他机器人的对话摘要）
              ├─ 拼接最近 10 轮对话历史
              └─ 调用 DeepSeek API
                    │
                    ▼
              NPC 回复 → 关键词线索检测 → 阶段推进 → 结局判定
```

- **前端**：原生 HTML/CSS/JS，科幻终端美学（CRT 扫描线、像素字体）
- **AI 引擎**：DeepSeek Chat API，实时生成 NPC 对话
- **对话上下文**：每次调用传入 System Prompt + 共享记忆 + 最近 10 轮对话
- **语义判定**：自由文本报告 → 多维度关键词匹配 → 结局分流
- **无后端**：纯浏览器端运行，API 调用直连 DeepSeek

---

## 🛠 开发工具包

`helios-workshop-v1.0.0/` 包含 8 个专项技能模块，覆盖从 Agent 人格设计到 Web 调查界面的完整开发链路：

| 技能 | 说明 |
|------|------|
| 伦理约束框架 | 三定律 FIRMWARE 编码，三种哲学解读框架 |
| Agent 人格构建 | 三层人格模型（定律解读 + 性格特质 + 知识边界） |
| 线索与记忆 | Agent 记忆系统、线索图谱、对话追踪 |
| 多 Agent 编排 | Agent 间通信协议与交叉验证逻辑 |
| 导演 Agent | 阶段转换、节奏控制、倒计时 |
| 语义评估 | LLM 评估玩家报告的语义判定引擎 |
| 调查界面 | Web 调查 UI：对话终端、证据板、倒计时 |
| 过场与动画 | CG 过场、像素动画与转场效果 |

---

## 📄 许可证

MIT © 2026 [chemmy-11](https://github.com/chemmy-11)

---

> *三台机器人在场。三组自洽的证词。没有人承认过错。*
