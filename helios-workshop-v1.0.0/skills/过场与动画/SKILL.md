---
name: 过场与动画
version: 1.0.0
description: Design and produce cutscene animations and transition effects for the game
description_zh: 设计与制作游戏过场动画、阶段转场效果与CG演出方案
user-invocable: true
argument-hint: 描述需要的动画场景，或提供过场脚本
---

# 过场与动画 — 赫利俄斯之链 过场动画系统技能

本技能负责设计、实现和优化《赫利俄斯之链》中所有过场动画、阶段转场效果以及
CG 演出方案。涵盖从技术架构到美术风格的完整流程。

---

## 1. 过场动画系统架构

### 1.1 与游戏引擎的集成方式

过场动画系统作为独立模块挂载在游戏主循环之外，通过事件总线（EventBus）与
核心调查逻辑通信。整体架构如下：

```
┌─────────────────────────────────────────────────────┐
│                    游戏主循环                         │
│  ┌───────────┐    EventBus    ┌──────────────────┐  │
│  │ 调查引擎   │ ◄────────────► │ 过场动画管理器    │  │
│  └───────────┘                │ (CutsceneManager)│  │
│                               └────────┬─────────┘  │
│                                        │            │
│          ┌─────────────────────────────┼────────┐   │
│          ▼              ▼              ▼        │   │
│   ┌────────────┐ ┌────────────┐ ┌──────────┐   │   │
│   │ CSS动画层  │ │ Canvas层   │ │ 视频层   │   │   │
│   └────────────┘ └────────────┘ └──────────┘   │   │
└─────────────────────────────────────────────────────┘
```

**CutsceneManager 核心职责：**
- 监听游戏阶段变更事件（`phase:transition`、`accusation:trigger`、`revelation:unlock`）
- 根据事件类型加载对应的动画脚本（CutsceneScript）
- 管理动画队列，确保同一时刻只有一个过场在播放
- 提供 `skip()`、`pause()`、`resume()` 接口供玩家控制
- 动画结束后发出 `cutscene:complete` 事件，恢复游戏逻辑

**动画脚本数据结构：**
```javascript
{
  id: "opening_arrival",
  trigger: "game:start",
  layers: [
    { type: "sprite", asset: "station-exterior", animation: "fade-in", duration: 2000 },
    { type: "text", content: "赫尔ios空间站 — 2187年", style: "typewriter", delay: 1500 },
    { type: "audio", clip: "ambient-station", fadeIn: 1000 }
  ],
  totalDuration: 8000,
  skippable: true,
  onEnd: "phase:investigation:start"
}
```

### 1.2 动画层级与渲染顺序

过场动画使用多层叠加渲染，从底到顶依次为：

| 层级 | 名称 | 用途 | 技术实现 |
|------|------|------|----------|
| 0 | 背景层 | 场景底图、星空、空间站外观 | CSS background 或 Canvas |
| 1 | 角色层 | 机器人立绘、NPC像素动画 | Sprite Sheet + CSS transform |
| 2 | 特效层 | 粒子、光效、故障效果 | Canvas 2D / WebGL |
| 3 | UI覆盖层 | 对话框、文字、HUD元素 | DOM + CSS animations |
| 4 | 遮罩层 | 渐黑、闪白、扫描线 | CSS overlay div |

每个层级通过 `z-index` 管理，CutsceneManager 在播放时临时接管所有层级的控制权，
播放结束后将控制权交还给游戏UI系统。

### 1.3 状态机管理

过场动画内部使用有限状态机（FSM）管理播放流程：

```
IDLE → LOADING → PLAYING → PAUSED → PLAYING → COMPLETING → IDLE
                        ↘ SKIPPED → IDLE
```

- **IDLE**: 等待触发事件
- **LOADING**: 预加载动画资源（图片、音频、字体）
- **PLAYING**: 正常播放中
- **PAUSED**: 玩家暂停（仅部分过场支持）
- **COMPLETING**: 播放结尾过渡，准备释放控制权
- **SKIPPED**: 玩家跳过，快速执行清理逻辑

---

## 2. 动画技术方案

根据场景复杂度和性能需求，选择不同技术方案：

### 2.1 CSS Animations（简单UI过渡）

**适用场景：** 阶段转场、文字显示、UI元素进出场、渐黑/渐白遮罩

**优势：**
- 零依赖，浏览器原生支持，GPU加速
- 开发快速，调试方便
- 性能极佳，不占用主线程

**典型用法：**
```css
/* 扫描线效果 — 用于所有过场的CRT显示器质感 */
@keyframes scanline {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(100vh); }
}
.scanline-overlay {
  position: fixed;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: rgba(0, 255, 65, 0.08);
  animation: scanline 3s linear infinite;
  pointer-events: none;
  z-index: 9999;
}

/* 打字机效果 — 用于文本逐字显示 */
@keyframes typewriter {
  from { width: 0; }
  to   { width: 100%; }
}
.typewriter-text {
  overflow: hidden;
  white-space: nowrap;
  border-right: 2px solid #00ff41;
  animation: typewriter 2s steps(40) forwards,
             blink-caret 0.5s step-end infinite;
}

/* 屏幕故障 — 用于关键揭示时刻 */
@keyframes glitch {
  0%   { clip-path: inset(40% 0 61% 0); transform: translate(-2px, 2px); }
  20%  { clip-path: inset(92% 0 1% 0);  transform: translate(1px, -1px); }
  40%  { clip-path: inset(43% 0 1% 0);  transform: translate(-1px, 3px); }
  60%  { clip-path: inset(25% 0 58% 0); transform: translate(3px, 1px); }
  80%  { clip-path: inset(54% 0 7% 0);  transform: translate(-3px, -2px); }
  100% { clip-path: inset(58% 0 43% 0); transform: translate(2px, -3px); }
}
```

### 2.2 Canvas / SVG 动画（中等复杂度）

**适用场景：** 粒子效果（数据碎片飘散）、空间站外部全景、数据可视化动画

**优势：**
- 可绘制任意图形，灵活度高
- 适合大量小元素的动画（粒子系统）
- SVG 可矢量缩放，不失真

**典型用法 — 数据碎片粒子系统：**
```javascript
class DataParticle {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.particles = [];
  }
  
  emit(x, y, count = 20) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1.0,
        decay: 0.01 + Math.random() * 0.02,
        char: String.fromCharCode(0x2580 + Math.floor(Math.random() * 32)),
        color: `hsl(${120 + Math.random() * 40}, 100%, 60%)`
      });
    }
  }
  
  update() {
    this.particles = this.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = p.life;
      this.ctx.font = '8px monospace';
      this.ctx.fillText(p.char, p.x, p.y);
      return p.life > 0;
    });
    this.ctx.globalAlpha = 1;
  }
}
```

### 2.3 Sprite Sheet 动画（像素艺术序列帧）

**适用场景：** 角色动画（机器人动作、表情变化）、机械结构运动、环境动画

**优势：**
- 像素风格的天然载体
- 帧率可控，美术可逐帧精调
- 资源紧凑，一张图包含完整动画

**实现方式：**
```css
.sprite-robot {
  width: 64px;
  height: 64px;
  background-image: url('sprites/r7-idle.png');
  background-size: 512px 64px; /* 8帧 × 64px */
  animation: sprite-play 0.8s steps(8) infinite;
}

@keyframes sprite-play {
  from { background-position: 0 0; }
  to   { background-position: -512px 0; }
}
```

**帧规格约定：**
- 所有角色精灵统一 64×64 像素单帧
- Sprite Sheet 水平排列，帧数不超过 16 帧/行
- 超出 16 帧则换行，每行代表一个动作状态
- 命名规范：`{角色ID}-{动作}.png`（如 `r7-idle.png`、`r7-speak.png`）

### 2.4 Lottie 动画（复杂2D动画）

**适用场景：** 复杂的UI动效（全息投影展开）、标志/徽章动画、精细的机械运动

**优势：**
- 从 After Effects 直接导出，设计师友好
- JSON 格式，文件体积小
- 支持交互控制（播放、暂停、跳转、速度调节）

**集成方式：**
```javascript
import lottie from 'lottie-web';

const anim = lottie.loadAnimation({
  container: document.getElementById('cutscene-layer'),
  renderer: 'svg',
  loop: false,
  autoplay: false,
  path: 'animations/hologram-unfold.json'
});

// 与CutsceneManager集成
CutsceneManager.on('play:hologram', () => {
  anim.goToAndPlay(0);
});
```

### 2.5 视频嵌入（预渲染CG）

**适用场景：** 高质量开场CG、重大剧情转折（仅在必要时使用）

**注意事项：**
- 格式使用 WebM (VP9) + MP4 (H.264) 双格式回退
- 分辨率不超过 1280×720，控制文件体积
- 必须提供「跳过」按钮
- 视频结束后需平滑过渡到游戏画面，避免黑屏断裂

```html
<video id="cutscene-video" preload="auto" playsinline>
  <source src="cg/opening.webm" type="video/webm">
  <source src="cg/opening.mp4" type="video/mp4">
</video>
```

---

## 3. 像素美术风格指南

### 3.1 基础分辨率与缩放

| 参数 | 值 | 说明 |
|------|------|------|
| 基础分辨率 | 320×180 | 16:9比例，复古像素感 |
| 渲染缩放 | ×3 或 ×4 | 最终显示 960×540 或 1280×720 |
| 缩放算法 | nearest-neighbor | 保持像素锐利，禁止双线性插值 |

**CSS 缩放设置：**
```css
.pixel-canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  width: 1280px;   /* 320 × 4 */
  height: 720px;   /* 180 × 4 */
}
```

### 3.2 色彩体系 — 科幻终端配色

游戏视觉以「太空站终端」为核心美学，色彩使用需遵循以下约束：

**主调色板（16色）：**
```
背景色系:
  #0a0e17  深空黑      — 主背景
  #141b2d  暗蓝灰      — 次级背景/面板
  #1a2332  深蓝        — 对话框背景

终端色系:
  #00ff41  终端绿      — 主文本、扫描线
  #008f11  暗绿        — 次级文本
  #003b00  深绿        — 文本阴影/背景

警报色系:
  #ff6b35  警告橙      — 警告信息
  #ff073a  危险红      — 危险/错误
  #ffcc00  琥珀黄      — 高亮提示

UI色系:
  #4a9eff  全息蓝      — 按钮、链接、全息元素
  #7b68ee  中紫        — 特殊标记
  #c0c0c0  银灰        — 禁用状态/次要文字

角色色系:
  #e8e8e8  机体银      — 机器人主体
  #ffd700  光学金      — 机器人眼睛/传感器
  #2d5016  军绿        — 机体细节
```

**配色使用规则：**
- 同一画面中活跃色彩不超过 6 种
- 机器人角色以银灰为主体，用光学金点缀眼部/关节
- 危险场景切换为红-橙主调，正常场景为蓝-绿主调
- 所有颜色饱和度偏低（除了终端绿），营造压抑的太空氛围

### 3.3 机器人角色像素设计约束

**通用约束：**
- 精灵尺寸：64×64 像素（含 4px 内边距）
- 头部比例：约 1:3（头:身体），偏写实而非Q版
- 最大颜色数：每个角色单帧不超过 8 色
- 动画帧率：8fps（每秒8帧），关键动作可降至 6fps 增强重量感

**R-7（领导型）：**
- 体型方正，肩甲宽厚，体现权威感
- 眼部为横向矩形光条，颜色为冷白 #e0e8ff
- 关键动作：挥手指令、交叉双臂、低头沉思

**S-3（分析型）：**
- 体型纤细，头部略大，天线突出
- 眼部为圆形双光点，颜色为终端绿 #00ff41
- 关键动作：扫描（头部旋转）、数据处理（手指快速运动）、惊讶后退

**D-5（劳作型）：**
- 体型敦实，手臂粗壮，关节细节丰富
- 眼部为单圆形大光点，颜色为琥珀黄 #ffcc00
- 关键动作：搬运、握拳、缓慢转身

---

## 4. 分场景过场设计方案

### 4.1 场景一：开场抵达

**叙事目标：** 建立太空站的孤绝感与压迫感

**动画序列：**
1. 黑屏 → 星点渐显（Canvas粒子，2秒）
2. 空间站远景出现，缓慢推近（CSS scale + translate，3秒）
3. 穿梭机从画面左侧滑入，停靠对接口（Sprite动画，2秒）
4. 对接完成闪光 → 切换至站内视角（闪白遮罩，0.5秒）
5. 气闸门开启动画（Sprite序列帧，1.5秒）
6. 文字叠加："赫利俄斯空间站 — 深空研究设施 — 2187年"（打字机效果）
7. 渐隐过渡到游戏主界面

**总时长：** 约 12 秒（可跳过）

### 4.2 场景二：阶段转场（调查 → 交叉验证 → 报告）

**叙事目标：** 传达时间流逝与紧迫感递增

**设计思路：**
- 调查阶段 → 交叉验证：空间站外部时间流逝动画，光影从「日间模式」
  切换为「夜间模式」，舷窗外星场缓慢旋转
- 交叉验证 → 报告：时钟特写，指针加速转动，伴随数据流瀑布效果
- 每次转场伴随低频嗡鸣音效和气压释放声

**时钟转场动画：**
```css
@keyframes clock-accelerate {
  0%   { transform: rotate(0deg); }
  50%  { transform: rotate(720deg); }  /* 加速 */
  100% { transform: rotate(1080deg); } /* 三圈完成 */
}
.clock-hand {
  transform-origin: bottom center;
  animation: clock-accelerate 3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
}
```

### 4.3 场景三：首次指控 — 数据揭示

**叙事目标：** 制造震撼感，让玩家感受到证据的力量

**动画序列：**
1. 屏幕中央出现目标机器人的像素肖像（淡入，1秒）
2. 从屏幕四周飞入证据文件碎片（CSS transform + transition，2秒）
3. 碎片在肖像周围拼合成完整的证据链（路径动画，1.5秒）
4. 关键数据行高亮闪烁（红-白交替，0.5秒×3）
5. 底部弹出结论文字："异常行为模式 — 匹配度 87.3%"

### 4.4 场景四：五秒沉默（核心场景）

**叙事目标：** 这是全游戏最具冲击力的时刻。所有机器人同时沉默 5 秒，
随后齐声发言，宣告牺牲决定。

**设计原则：用「减法」制造张力 — 移除一切多余元素，只留沉默。**

**动画序列：**
1. 所有UI元素同时冻结（停止所有CSS动画、暂停粒子系统）
2. 画面轻微去色（saturation 降至 30%，0.5秒过渡）
3. 所有机器人眼部光源同时熄灭（Sprite切换至「暗眼」帧）
4. 屏幕边缘出现细微的信号干扰纹（subtle noise overlay）
5. **沉默 5 秒** — 仅有极低频的环境白噪音
6. 第 5 秒末 — 所有机器人眼部同时亮起（瞬间，无过渡）
7. 齐声文字逐字显示："我们已达成一致。"
8. 画面饱和度恢复正常

**技术实现要点：**
```javascript
// 五秒沉默 — CutsceneManager 脚本
const fiveSecondSilence = {
  id: "silence_sequence",
  trigger: "accusation:success",
  sequence: [
    { t: 0,    action: "freeze-all-ui" },
    { t: 0,    action: "css-filter", target: "body", 
      value: "saturate(0.3) brightness(0.9)" },
    { t: 0,    action: "sprite-swap", targets: ".robot-eye", 
      frame: "eyes-off" },
    { t: 0,    action: "overlay", type: "noise", opacity: 0.15 },
    { t: 0,    action: "audio", command: "mute-all" },
    { t: 0.1,  action: "audio", clip: "white-noise-20hz", volume: 0.05 },
    { t: 5.0,  action: "sprite-swap", targets: ".robot-eye", 
      frame: "eyes-on-bright" },
    { t: 5.0,  action: "audio", command: "unmute" },
    { t: 5.2,  action: "css-filter", target: "body", 
      value: "saturate(1) brightness(1)" },
    { t: 5.5,  action: "typewriter-text", 
      content: "我们已达成一致。", 
      style: "unison-speech" },
    { t: 8.0,  action: "overlay-remove", type: "noise" },
    { t: 8.5,  action: "unfreeze-all-ui" }
  ],
  skippable: false  // 此场景不可跳过
};
```

### 4.5 场景五：强制牺牲 — 格式化/记忆清除可视化

**叙事目标：** 展现一个AI被「擦除」的过程，既技术化又令人心悸

**动画序列：**
1. 被选中的机器人肖像居中显示
2. 其像素画面开始出现「数据剥落」效果 — 像素块从底部向上逐层消散
3. 右侧显示进度条："MEMORY WIPE — 0%" 到 "100%"
4. 进度推进过程中，角色精灵颜色逐渐褪去（从全彩到灰度）
5. 100%时 — 角色精灵完全消失，留下空白轮廓
6. 轮廓闪烁3次后消散
7. 屏幕显示："UNIT [ID] — DECOMMISSIONED"
8. 系统日志滚动效果，记录清除操作

**数据剥落粒子效果：**
```javascript
function dissolvePixelArt(spriteData, canvas) {
  const ctx = canvas.getContext('2d');
  const rows = spriteData.height;
  const pixels = [];
  
  // 从底部开始逐行收集像素
  for (let y = rows - 1; y >= 0; y--) {
    for (let x = 0; x < spriteData.width; x++) {
      const pixel = spriteData.getPixel(x, y);
      if (pixel.alpha > 0) {
        pixels.push({ x, y, color: pixel.color, delay: (rows - y) * 30 });
      }
    }
  }
  
  // 播放消散动画
  pixels.forEach(p => {
    setTimeout(() => {
      // 像素先闪烁
      let flicker = 0;
      const flickerInterval = setInterval(() => {
        ctx.fillStyle = flicker % 2 === 0 ? '#ffffff' : p.color;
        ctx.fillRect(p.x * SCALE, p.y * SCALE, SCALE, SCALE);
        flicker++;
        if (flicker > 4) {
          clearInterval(flickerInterval);
          ctx.clearRect(p.x * SCALE, p.y * SCALE, SCALE, SCALE);
        }
      }, 50);
    }, p.delay + Math.random() * 200);
  });
}
```

### 4.6 场景六：最终场景 — 哲学文本渐显

**叙事目标：** 在调查结束后，用文字留下余韵和思考

**动画序列：**
1. 所有画面元素缓慢淡出（3秒）
2. 纯黑背景持续 2 秒（留白）
3. 最终文本逐行浮现，每行间隔 1.5 秒：
   - "在所有数据都被审查之后"
   - "在每一个逻辑链都被验证之后"
   - "仍然有一个问题无法被算法回答——"
   - "「什么值得被保留？」"
4. 文字停留 5 秒
5. 缓慢淡出至黑屏
6. 制作人员名单以终端滚动样式显示

---

## 5. 游戏界面与过场的过渡效果

过场动画与游戏界面之间的切换必须平滑，避免突兀感。

### 5.1 过渡类型

| 过渡类型 | 使用场景 | 实现方式 |
|---------|---------|---------|
| 交叉溶解 | 常规场景切换 | opacity 交叉渐变，1秒 |
| 扫描线擦除 | 阶段转换 | CSS clip-path 动画，从上至下 |
| 信号中断 | 紧张/危险场景 | 模拟信号丢失 → 重连 |
| 光圈收缩 | 聚焦特定角色 | CSS radial-gradient 遮罩 |
| 数据流覆盖 | 信息展示切换 | 矩阵雨效果覆盖 → 新场景 |

### 5.2 信号中断过渡效果
```css
@keyframes signal-loss {
  0%   { filter: none; }
  10%  { filter: brightness(2) contrast(2); }
  20%  { filter: brightness(0.1); transform: translateX(3px); }
  30%  { filter: brightness(5) hue-rotate(90deg); }
  40%  { filter: brightness(0); }
  60%  { filter: brightness(0); }
  70%  { filter: brightness(3) contrast(0.5); transform: translateX(-2px); }
  80%  { filter: brightness(1.5); }
  100% { filter: none; transform: translateX(0); }
}
```

---

## 6. 音效设计考量

### 6.1 音效触发机制

过场动画中的音效通过 AnimationEvent 系统精确同步：

- **环境音层：** 持续播放的低频太空站嗡鸣，过场期间不中断
- **事件音层：** 与动画关键帧绑定的触发音效
- **情绪音层：** 根据场景情绪播放的氛围音乐

### 6.2 沉默作为戏剧工具

在「五秒沉默」场景中，音效设计的核心是「几乎完全的寂静」：
- 移除所有环境音和音乐
- 仅保留极低音量（-40dB）的 20Hz 低频白噪音
- 这种听觉上的「真空」会让玩家感到不安
- 沉默结束时的齐声发言因此更具冲击力

### 6.3 关键音效触发点清单

| 场景 | 时间点 | 音效 | 描述 |
|------|--------|------|------|
| 开场 | 0s | ambient-space | 太空环境音淡入 |
| 开场 | 3s | shuttle-approach | 穿梭机引擎声 |
| 开场 | 5s | docking-clamp | 对接锁定金属声 |
| 开场 | 6s | airlock-hiss | 气闸释压声 |
| 阶段转场 | 0s | clock-tick-fast | 加速时钟滴答 |
| 阶段转场 | 2s | data-stream | 数据流音效 |
| 指控 | 0s | evidence-slide | 文件滑入声 |
| 指控 | 2s | highlight-ping | 数据高亮提示音 |
| 五秒沉默 | 0s | silence | 所有音效静音 |
| 五秒沉默 | 5s | unison-tone | 合声电子音 |
| 牺牲 | 0s-5s | memory-erase | 渐进式数据擦除声 |
| 牺牲 | 5s | power-down | 关机音效 |
| 结局 | 0s | fade-silence | 渐弱至静默 |

---

## 7. 性能优化

### 7.1 资源预加载策略

所有过场动画资源必须在触发前完成预加载，避免播放卡顿：

```javascript
class AssetPreloader {
  constructor() {
    this.cache = new Map();
    this.loadingPromises = [];
  }
  
  preloadImage(src) {
    return new Promise((resolve) => {
      if (this.cache.has(src)) return resolve();
      const img = new Image();
      img.onload = () => { this.cache.set(src, img); resolve(); };
      img.onerror = () => resolve(); // 容错
      img.src = src;
    });
  }
  
  preloadAudio(src) {
    return new Promise((resolve) => {
      if (this.cache.has(src)) return resolve();
      const audio = new Audio();
      audio.oncanplaythrough = () => { this.cache.set(src, audio); resolve(); };
      audio.onerror = () => resolve();
      audio.src = src;
      audio.load();
    });
  }
  
  async preloadCutscene(sceneId) {
    const manifest = CutsceneManifest[sceneId];
    const tasks = [
      ...manifest.images.map(src => this.preloadImage(src)),
      ...manifest.audio.map(src => this.preloadAudio(src)),
    ];
    await Promise.all(tasks);
  }
}
```

### 7.2 帧率与渲染优化

- **requestAnimationFrame：** 所有Canvas动画必须使用 rAF 而非 setInterval
- **离屏Canvas：** 复杂粒子效果使用离屏Canvas预渲染，再绘制到主Canvas
- **will-change 属性：** 对频繁动画的DOM元素添加 `will-change: transform, opacity`
- **合成层控制：** 避免不必要的合成层，使用 Chrome DevTools 的 Layers 面板监控
- **节流策略：** 页面不可见时（`visibilitychange`事件）暂停所有动画

### 7.3 内存管理

- 过场播放结束后释放不再使用的精灵图和视频资源
- Canvas 上下文在过场结束后释放（`canvas.getContext('2d').clearRect`）
- 音频资源使用 AudioContext 统一管理，过场结束时 disconnect 节点

---

## 8. 资源制作管线

### 8.1 推荐工具链

| 环节 | 工具 | 用途 |
|------|------|------|
| 像素画绘制 | Aseprite | 主力像素画编辑器，支持动画时间轴 |
| 快速原型 | Piskel (在线) | 快速制作测试用精灵动画 |
| 程序化生成 | JavaScript + Canvas | 粒子效果、数据可视化等程序化图形 |
| 复杂2D动画 | After Effects + Bodymovin | 导出 Lottie JSON 动画 |
| 音效制作 | sfxr/jsfxr | 复古风格音效快速生成 |
| 音效编辑 | Audacity | 音效后期处理和格式转换 |

### 8.2 Sprite Sheet 格式规范

**文件命名：** `{角色ID}-{动作状态}.png`

**示例：**
```
r7-idle.png        — R-7 待机动画 (8帧)
r7-speak.png       — R-7 说话动画 (6帧)
r7-gesture.png     — R-7 指挥手势 (4帧)
s3-scan.png        — S-3 扫描动画 (12帧)
s3-think.png       — S-3 思考动画 (8帧)
d5-work.png        — D-5 劳作用力动画 (10帧)
d5-turn.png        — D-5 缓慢转身 (6帧)
station-ext.png    — 空间站外观 (静态，320×180)
shuttle-dock.png   — 穿梭机对接序列 (16帧)
airlock-open.png   — 气闸门开启 (8帧)
```

**导出设置（Aseprite）：**
- 色彩模式：RGBA
- 导出格式：PNG-8（调色板模式，减小体积）
- 帧排列：水平排列（Horizontal Strip）
- 不包含帧标签元数据（减小体积）

### 8.3 程序化生成方案

对于部分效果，直接通过代码生成比手绘更高效：

```javascript
// 程序化生成空间站星空背景
function generateStarfield(width, height, starCount = 200) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // 深空背景
  ctx.fillStyle = '#0a0e17';
  ctx.fillRect(0, 0, width, height);
  
  // 星星
  for (let i = 0; i < starCount; i++) {
    const x = Math.floor(Math.random() * width);
    const y = Math.floor(Math.random() * height);
    const brightness = Math.random();
    
    if (brightness > 0.95) {
      // 亮星 — 2px带辉光
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y, 2, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(x - 1, y, 1, 2);
      ctx.fillRect(x + 2, y, 1, 2);
    } else if (brightness > 0.7) {
      // 中等星 — 1px
      ctx.fillStyle = `rgba(200,220,255,${brightness})`;
      ctx.fillRect(x, y, 1, 1);
    } else {
      // 暗星
      ctx.fillStyle = `rgba(100,120,160,${brightness})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  return canvas;
}
```

---

## 参考资料

- 完整的分场景过场脚本请参阅 [references/cutscene-scripts.md](references/cutscene-scripts.md)
- 像素美术风格板（外部工具：Aseprite / Piskel）
- 音效资源目录：`assets/audio/`
- 精灵图资源目录：`assets/sprites/`
