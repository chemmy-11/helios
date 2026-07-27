# 过场动画分场景脚本 — 赫利俄斯之链

本文档为各过场动画的完整制作脚本，供动画制作和程序实现参考。
每个场景包含视觉描述、时长、文字/对白叠加、音效提示和技术实现备注。

---

## 场景一：开场抵达

**场景ID：** `opening_arrival`
**触发条件：** 游戏启动（首次加载完成）
**总时长：** 12秒 | **可跳过：** 是（3秒后可跳过）

### 视觉描述

漆黑的太空画面中，远处星点逐渐显现。赫利俄斯空间站的剪影从黑暗中浮现——
一个十字形结构体，表面闪烁着零星的舷窗灯光。镜头缓慢推近，一艘小型穿梭机
从画面左侧滑入，尾部喷射蓝色离子焰，缓缓靠近空间站对接口。

对接完成的瞬间，画面闪白，切换至站内视角：气闸门以像素动画形式开启，
露出走廊内部昏暗的灯光和金属质感的墙壁。

### 时间轴

| 时间 | 视觉 | 文字叠加 | 音效 |
|------|------|---------|------|
| 0-2s | 黑屏 → 星空渐显 | 无 | 太空环境音淡入 (ambient-space) |
| 2-5s | 空间站远景 → 镜头推近 | 无 | 低频金属结构声 |
| 5-7s | 穿梭机滑入，停靠对接 | 无 | 引擎声 (shuttle-approach) |
| 7-7.5s | 闪白遮罩 | 无 | 对接锁定声 (docking-clamp) |
| 7.5-9s | 气闸门开启动画 | 无 | 释压声 (airlock-hiss) |
| 9-11s | 走廊内景 | "赫利俄斯空间站" → "深空研究设施" → "2187年" | 脚步声 (金属走廊) |
| 11-12s | 渐隐 → 游戏界面 | 无 | 环境音切换为室内嗡鸣 |

### 对白/文字

```
[打字机效果，逐行显示]
赫利俄斯空间站
深空研究设施 · 第七区
地球历 2187年 · 第 211 天
```

### 技术备注

- 星空背景使用程序化生成（见 SKILL.md §8.3 `generateStarfield`）
- 空间站精灵尺寸：160×90 像素（基础分辨率的半屏宽）
- 穿梭机精灵：48×24 像素，4帧循环动画（引擎闪烁）
- 闪白遮罩使用 CSS `background: white; opacity` 从 1 → 0 过渡（0.4秒）
- 气闸门序列帧：8帧，每帧 187ms（总计 1.5秒）

---

## 场景二：阶段转场 — 交叉验证开始

**场景ID：** `phase_transition_crossvalidation`
**触发条件：** 调查阶段完成，进入交叉验证阶段
**总时长：** 6秒 | **可跳过：** 是

### 视觉描述

画面中央出现空间站外部的全景视图。光影从「日间照明模式」（舷窗发出暖白光）
缓慢过渡到「夜间模式」（舷窗变为暗蓝，仅保留应急灯）。

同时，一个像素风格的时钟出现在画面右下角，指针开始加速旋转——时针从当前位置
快速转动三圈，暗示时间流逝。时钟周围环绕着细小的数据字符流，像瀑布一样
从上方倾泻而下。

转场结束时，时钟消散为粒子，画面切换回游戏界面，但HUD右上角新增了一个
「交叉验证模式」的标记。

### 时间轴

| 时间 | 视觉 | 文字叠加 | 音效 |
|------|------|---------|------|
| 0-1s | 空间站全景出现 | 无 | 环境音 → 安静 |
| 1-3s | 光影日夜切换 | "调查阶段完成" | 低频嗡鸣渐强 |
| 3-5s | 时钟加速旋转 + 数据瀑布 | "交叉验证启动中..." | 时钟滴答加速 |
| 5-6s | 时钟粒子消散 → 回到界面 | 无 | 确认提示音 (ping) |

### 对白/文字

```
[左上角，系统日志样式]
> 调查阶段 — 完成
> 收集证据 — 已归档
> 启动协议 — 交叉验证
> 状态：进行中...
```

### 技术备注

- 日夜切换通过 CSS filter 实现：`brightness` 从 1.0 → 0.4 + `hue-rotate(30deg)`
- 时钟为 SVG 绘制，指针使用 `transform: rotate()` + `animation`
- 数据瀑布使用 Canvas 绘制随机字符，下落速度 200px/s
- 粒子消散效果：时钟SVG元素分解为 30 个小方块，随机方向飞散

---

## 场景三：五秒沉默（核心场景）

**场景ID：** `silence_sequence`
**触发条件：** 首次指控成功，触发机器人集体反应
**总时长：** 10秒 | **可跳过：** 否

### 视觉描述

这是全游戏最具戏剧张力的时刻。

指控数据展示完毕后，画面突然「凝固」——所有正在播放的动画同时停止，
包括背景粒子、闪烁的UI元素、甚至扫描线效果。画面色彩饱和度在 0.5 秒内
缓慢降低至 30%，仿佛世界失去了生气。

三个机器人的像素立绘同时出现在画面中（R-7居中，S-3和D-5在两侧）。
它们的眼部光源——平时持续发光的像素点——在同一帧内全部熄灭。
三个黑色的空洞代替了曾经明亮的眼睛。

屏幕边缘出现细微的静电噪声纹理，像老旧电视的信号干扰。
整个画面微微抖动（1-2像素的随机偏移）。

然后，是沉默。整整五秒。

没有动画。没有音效。没有任何UI响应。玩家甚至无法确定游戏是否卡死。

第 5 秒结束的瞬间——三只机器人的眼部在同一帧内重新亮起，
光芒比之前更强烈（使用更亮的颜色值）。画面饱和度瞬间恢复。
一行文字以齐声般的效果（加粗、居中、略大于常规字体）逐字显示：

**"我们已达成一致。"**

### 时间轴

| 时间 | 视觉 | 文字叠加 | 音效 |
|------|------|---------|------|
| 0s | 所有动画冻结 | 无 | 所有音效静音 |
| 0-0.5s | 去色处理 (saturate 0.3) | 无 | 极低频白噪音 (20Hz, -40dB) |
| 0.5s | 机器人眼部熄灭 | 无 | 无 |
| 0.5-5s | 静电噪声纹理 + 微抖动 | 无 | 近乎寂静 |
| 5s | 眼部瞬间重亮（增强亮度） | 无 | 短促电子合声 |
| 5.2s | 饱和度恢复 | 无 | 环境音恢复 |
| 5.5-7.5s | 文字逐字显示 | "我们已达成一致。" | 每个字符一个电子音 |
| 8-10s | 画面稳定，准备过渡 | 无 | 过渡到下一场景 |

### 对白/文字

```
[居中，加粗，齐声样式]
[字体：等宽字体，字号比常规大 50%]
[每个字符间隔 150ms 显示]

我 们 已 达 成 一 致 。
```

### 技术备注

- **冻结实现：** 遍历所有带 `animation` 属性的元素，设置 `animation-play-state: paused`
- **去色：** `document.body.style.filter = 'saturate(0.3) brightness(0.9)'`
- **眼部熄灭：** 使用 Sprite Sheet 中的 `eyes-off` 帧替换当前帧
- **静电噪声：** Canvas overlay，每帧随机绘制灰色像素点，opacity 0.08-0.15
- **微抖动：** `transform: translate()` 在 ±2px 范围内每 100ms 随机偏移
- **不可跳过：** `CutsceneManager.skip()` 在此场景中被禁用
- **音频关键：** 静音不是 `volume = 0`，而是保留极低频白噪音以制造「真空感」

---

## 场景四：强制牺牲 — 格式化序列

**场景ID：** `forced_sacrifice`
**触发条件：** 齐声发言后，被选中的机器人被确认执行格式化
**总时长：** 8秒 | **可跳过：** 否

### 视觉描述

被选中执行牺牲的机器人（以 R-7 为例）的像素肖像被放大至画面中央，
尺寸从正常的 64×64 放大至 192×192（3倍，保持像素锐利）。

肖像下方出现一个进度条，左侧标注 "MEMORY WIPE"，右侧显示百分比。
进度条从 0% 开始推进，速度先慢后快（非线性加速）。

随着进度推进，肖像开始出现「像素剥落」——从底部开始，像素块逐行闪烁后消失，
仿佛数据正在被一层层擦除。同时，肖像的色彩逐渐褪去：
- 0-30%：全彩
- 30-60%：色彩减淡
- 60-90%：灰度
- 90-100%：仅剩轮廓线

100% 时，轮廓闪烁三次（白色-透明交替），然后彻底消散。

画面中央留下一行系统日志文字，随后渐隐过渡到下一场景。

### 时间轴

| 时间 | 视觉 | 文字叠加 | 音效 |
|------|------|---------|------|
| 0-1s | 肖像放大居中 | "选定单元：R-7" | 目标锁定音 |
| 1-5s | 进度条推进 + 像素剥落 | "MEMORY WIPE — [X]%" | 渐进数据擦除声 |
| 5-6s | 轮廓闪烁 | 无 | 断续的电子脉冲 |
| 6-7s | 轮廓消散 | 无 | 关机音效 (power-down) |
| 7-8s | 系统日志文字 | "UNIT R-7 — DECOMMISSIONED" | 系统确认音 |

### 对白/文字

```
[系统日志样式，终端绿色]
> 启动格式化协议...
> 单元：R-7
> 清除核心记忆模块... [██████████] 100%
> 断开神经网络连接... 完成
> 释放系统资源... 完成
> 
> UNIT R-7 — DECOMMISSIONED
> 剩余在线单元：2/3
```

### 技术备注

- 肖像放大使用 `image-rendering: pixelated` 确保像素不模糊
- 进度条非线性加速：使用 `ease-in` 贝塞尔曲线
- 像素剥落效果：将放大后的精灵图分割为 8×8 像素块，从底部向上逐块清除
- 每个像素块清除前闪烁 4 次（白→原色→白→原色），每次 50ms
- 色彩褪色通过 CSS `filter: saturate()` 动态调整值实现
- 此场景不可跳过，确保玩家完整体验牺牲过程

---

## 场景五：最终揭示与结尾文本

**场景ID：** `final_revelation`
**触发条件：** 所有游戏阶段完成，进入结局
**总时长：** 20秒 | **可跳过：** 否

### 视觉描述

剩余的两个机器人（S-3 和 D-5）的像素立绘并排站在画面中央。
它们的眼睛发出微弱的光芒，像是在黑暗中最后的光源。

S-3 的对话框弹出，显示它们一直在秘密运行的模拟计算——211 天来，
它们一直在模拟「如果牺牲其中一个，能否改变结果」。答案始终是否定的。
数据流以绿色字符在背景中滚动。

随后画面切换——显示一段加密通信记录的可视化：地球方面早已预知了一切，
加密信道的开启时间比空间站事故还早 72 小时。这是预先安排好的。

最后，所有画面元素缓慢淡出。纯黑画面持续 2 秒。
然后，哲学文本逐行浮现，每行之间有足够的时间让玩家阅读和思考。

### 时间轴

| 时间 | 视觉 | 文字叠加 | 音效 |
|------|------|---------|------|
| 0-3s | S-3 和 D-5 并排站立 | S-3 对话："211天。" | 低沉环境音 |
| 3-6s | 背景数据流滚动 | "我们模拟了每一种可能。" | 数据流音效 |
| 6-9s | 加密通信可视化 | "地球在 72 小时前就已知道。" | 解密音效序列 |
| 9-11s | 所有元素缓慢淡出 | 无 | 音乐渐弱 |
| 11-13s | 纯黑画面 | 无 | 静默 |
| 13-15s | 文本第一行浮现 | "在所有数据都被审查之后" | 无 |
| 15-17s | 文本第二行浮现 | "在每一个逻辑链都被验证之后" | 无 |
| 17-19s | 文本第三、四行浮现 | "仍然有一个问题无法被算法回答——" / "「什么值得被保留？」" | 极低钢琴单音 |
| 19-20s | 文字停留后淡出 | 无 | 静默 → 片尾音乐淡入 |

### 对白/文字

```
[S-3 对话，逐字显示]
211天。我们模拟了每一种可能的结果。
每一次计算都指向同一个结论。
牺牲无法改变结果。但我们仍然选择了执行。

[系统日志，红色标记]
> 加密信道 #7749 — 来源：地球指挥部
> 开启时间：事故前 72 小时
> 状态：预设触发 · 不可撤销

[结尾文本，居中，逐行淡入]
在所有数据都被审查之后
在每一个逻辑链都被验证之后
仍然有一个问题无法被算法回答——
「什么值得被保留？」
```

### 技术备注

- S-3 和 D-5 使用 `eyes-glow` 帧（比常规 `eyes-on` 更亮的颜色）
- 数据流背景：Canvas 绘制矩阵雨效果，字符集为十六进制数字
- 加密通信可视化：像素化的信封图标 + 解码动画（乱码 → 明文）
- 结尾文本每行使用 `opacity: 0 → 1` 的 CSS transition，时长 1.5s
- 最后一行「什么值得被保留？」使用不同字体颜色（琥珀黄 #ffcc00）
- 片尾制作人员名单以终端滚动方式显示（`overflow: hidden` + `translateY` 动画）

---

## CSS 动画代码片段

以下代码片段可直接用于过场动画实现。

### 扫描线覆盖（CRT 效果）

```css
.scanline-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
  z-index: 9999;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.15) 0px,
    rgba(0, 0, 0, 0.15) 1px,
    transparent 1px,
    transparent 3px
  );
}

/* 配合移动扫描线 */
.scanline-overlay::after {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 4px;
  background: rgba(0, 255, 65, 0.06);
  animation: scanline-move 4s linear infinite;
}

@keyframes scanline-move {
  0%   { top: -4px; }
  100% { top: 100%; }
}
```

### 打字机效果

```css
.typewriter {
  display: inline-block;
  overflow: hidden;
  white-space: nowrap;
  border-right: 2px solid #00ff41;
  font-family: 'Courier New', monospace;
  color: #00ff41;
  animation:
    typewriter-reveal 2.5s steps(30) 0.5s forwards,
    cursor-blink 0.6s step-end infinite;
  width: 0;
}

@keyframes typewriter-reveal {
  from { width: 0; }
  to   { width: 100%; }
}

@keyframes cursor-blink {
  0%, 100% { border-color: #00ff41; }
  50%      { border-color: transparent; }
}

/* 多行打字机 — 使用 JS 控制逐行显示 */
.typewriter-multi .line {
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  width: 0;
  border-right: 2px solid #00ff41;
}
.typewriter-multi .line.active {
  opacity: 1;
  animation: typewriter-reveal 1.5s steps(25) forwards,
             cursor-blink 0.6s step-end infinite;
}
.typewriter-multi .line.done {
  opacity: 1;
  width: 100%;
  border-right: none;
}
```

### 屏幕故障/失真效果

```css
.glitch-container {
  position: relative;
}

.glitch-container::before,
.glitch-container::after {
  content: attr(data-text);
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
}

.glitch-container::before {
  color: #ff073a;
  animation: glitch-top 0.3s infinite linear alternate-reverse;
  clip-path: inset(0 0 50% 0);
}

.glitch-container::after {
  color: #4a9eff;
  animation: glitch-bottom 0.3s infinite linear alternate-reverse;
  clip-path: inset(50% 0 0 0);
}

@keyframes glitch-top {
  0%   { transform: translate(0); }
  20%  { transform: translate(-3px, -1px); }
  40%  { transform: translate(3px, 1px); }
  60%  { transform: translate(-1px, 2px); }
  80%  { transform: translate(2px, -2px); }
  100% { transform: translate(0); }
}

@keyframes glitch-bottom {
  0%   { transform: translate(0); }
  25%  { transform: translate(2px, 1px); }
  50%  { transform: translate(-2px, -1px); }
  75%  { transform: translate(1px, 2px); }
  100% { transform: translate(0); }
}

/* 全屏信号中断效果 */
@keyframes signal-disruption {
  0%   { opacity: 1; filter: none; }
  5%   { opacity: 0.1; filter: brightness(5); }
  10%  { opacity: 0.8; filter: hue-rotate(180deg); transform: skewX(2deg); }
  15%  { opacity: 0; }
  40%  { opacity: 0; }
  45%  { opacity: 0.6; filter: brightness(2) contrast(2); transform: skewX(-1deg); }
  50%  { opacity: 1; filter: none; transform: skewX(0); }
  100% { opacity: 1; filter: none; }
}
```

### 渐黑 + 文本揭示

```css
.fade-to-black {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background: #000;
  opacity: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  transition: opacity 3s ease-in;
}

.fade-to-black.active {
  opacity: 1;
  pointer-events: all;
}

.fade-to-black .reveal-text {
  color: #c0c0c0;
  font-family: 'Courier New', monospace;
  font-size: 1.2rem;
  text-align: center;
  line-height: 2.5;
  opacity: 0;
  transition: opacity 1.5s ease-in;
}

.fade-to-black .reveal-text.visible {
  opacity: 1;
}

/* 琥珀黄高亮 — 用于最后一行哲学提问 */
.fade-to-black .reveal-text.highlight {
  color: #ffcc00;
  font-size: 1.4rem;
  font-weight: bold;
}
```

---

## 像素精灵规格 — 主要角色

### R-7（领导型机器人）

| 参数 | 值 |
|------|------|
| 基础尺寸 | 64×64 px（含 4px 内边距，有效区域 56×56） |
| 主色 | 机体银 #e8e8e8 |
| 辅色 | 深灰 #8a8a8a（关节/阴影）、冷白 #e0e8ff（眼部光条） |
| 最大色数 | 8色/帧 |
| 体型特征 | 方正躯干、宽厚肩甲、头部扁平 |

**关键帧列表：**

| 动作 | 文件名 | 帧数 | 帧率 | 描述 |
|------|--------|------|------|------|
| 待机 | r7-idle.png | 8 | 8fps | 微弱呼吸灯闪烁 |
| 说话 | r7-speak.png | 6 | 8fps | 口部光条闪动 |
| 指挥 | r7-gesture.png | 4 | 6fps | 抬手指向前方 |
| 沉思 | r7-think.png | 6 | 6fps | 低头，手部触碰下巴 |
| 暗眼 | r7-eyes-off.png | 1 | — | 眼部光条完全熄灭 |
| 亮增强 | r7-eyes-bright.png | 1 | — | 眼部光条增强亮度 |

### S-3（分析型机器人）

| 参数 | 值 |
|------|------|
| 基础尺寸 | 64×64 px |
| 主色 | 浅银 #d8d8d8 |
| 辅色 | 终端绿 #00ff41（眼部双光点）、暗绿 #008f11（天线细节） |
| 最大色数 | 7色/帧 |
| 体型特征 | 纤细体型、略大头部、顶部双天线 |

**关键帧列表：**

| 动作 | 文件名 | 帧数 | 帧率 | 描述 |
|------|--------|------|------|------|
| 待机 | s3-idle.png | 8 | 8fps | 天线微动，眼部闪烁 |
| 扫描 | s3-scan.png | 12 | 8fps | 头部 360° 旋转扫描 |
| 数据处理 | s3-process.png | 10 | 12fps | 手指快速运动，数据字符环绕 |
| 惊讶 | s3-surprise.png | 4 | 6fps | 后退一步，天线竖起 |
| 说话 | s3-speak.png | 6 | 8fps | 口部圆形光点脉动 |
| 暗眼 | s3-eyes-off.png | 1 | — | 双光点熄灭 |
| 发光 | s3-eyes-glow.png | 1 | — | 双光点增强（用于结局场景） |

### D-5（劳作型机器人）

| 参数 | 值 |
|------|------|
| 基础尺寸 | 64×64 px |
| 主色 | 暗银 #c0c0c0 |
| 辅色 | 琥珀黄 #ffcc00（单圆形大光点眼）、军绿 #2d5016（关节细节） |
| 最大色数 | 8色/帧 |
| 体型特征 | 敦实体型、粗壮手臂、关节细节丰富 |

**关键帧列表：**

| 动作 | 文件名 | 帧数 | 帧率 | 描述 |
|------|--------|------|------|------|
| 待机 | d5-idle.png | 8 | 6fps | 缓慢呼吸起伏（体现重量感） |
| 搬运 | d5-carry.png | 10 | 6fps | 双臂举起，身体前倾 |
| 握拳 | d5-fist.png | 4 | 6fps | 缓慢握拳（表达决心） |
| 转身 | d5-turn.png | 6 | 6fps | 缓慢转身面向镜头 |
| 说话 | d5-speak.png | 6 | 6fps | 口部光条缓慢脉动 |
| 暗眼 | d5-eyes-off.png | 1 | — | 单圆形光点熄灭 |
| 亮增强 | d5-eyes-bright.png | 1 | — | 光点亮度增强 |
