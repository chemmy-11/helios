# 开发简报 13：移动端优化与中文输入法支持

## 日期
2026-07-31

## 主要更新

### 1. 移动端响应式布局
- **抽屉菜单**：点击汉堡按钮（☰）打开侧边栏，包含倒计时、NPC 列表、地点导航、视图切换
- **底部导航栏**：对话/证据/日志/报告 四个标签快速切换
- **消息对齐**：NPC 消息靠左显示（带颜色标识），玩家消息靠右显示
- **单列布局**：证据板、日志、报告在移动端自适应单列显示

### 2. 中文输入法修复
**问题**：Android WebView 中，中文输入法（IME）的 `input` 事件触发异常，导致报告字数统计不更新

**解决方案**：
- 添加 `compositionstart`/`compositionend` 事件监听，追踪 IME 输入状态
- 在 IME 组合期间跳过 `input` 事件更新
- 添加 `change` 事件作为兜底（失焦时触发）
- `submitReport()` 直接从 textarea 读取内容作为最终兜底

**代码改动**：
```javascript
// 报告编辑器事件监听
this.el.reportEditor.addEventListener('compositionstart', () => {
  this.state.reportComposing = true;
});
this.el.reportEditor.addEventListener('compositionend', () => {
  this.state.reportComposing = false;
});
this.el.reportEditor.addEventListener('input', (e) => {
  if (this.state.reportComposing) return;
  this.state.reportDraft = e.target.value;
  this.el.reportCount.textContent = e.target.value.length + ' 字';
});
this.el.reportEditor.addEventListener('change', (e) => {
  this.state.reportDraft = e.target.value;
  this.el.reportCount.textContent = e.target.value.length + ' 字';
});

// 提交时的兜底
const text = (this.el.reportEditor?.value || this.state.reportDraft || '').trim();
```

### 3. 报告提交体验优化
- 提交后自动切换到对话终端视图，显示系统消息
- 错误消息（字数不足）也会切换视图，确保用户可见
- 2 秒后触发结局评估

### 4. 双重锁定机制（延迟关键线索）
**目的**：防止玩家在第一阶段过早获得核心线索，增加推理难度

**实现方式**：
1. **阶段限制**：`phase: 2` 确保第二阶段才能触发
2. **前置条件**：需要发现 3 条前置线索中的至少 2 条
   - `CL_R7_010`：三定律矛盾证据（R-7 对话关键词触发）
   - `CL_D5_010`：急救协议预激活（D-5 对话关键词触发）
   - `CL_D5_012`：三定律空白论证（只能通过查看日志解锁）

**受影响的线索**：
- 211天前模拟运算
- 急救协议预激活
- 三定律空白论证
- 第零法则相关线索

**代码改动**：
```javascript
// data.js - 线索定义
{ 
  keywords: ['211', '编号', '模拟'], 
  clue: '211天前模拟运算', 
  phase: 2, 
  prerequisites: ['CL_R7_010', 'CL_D5_010', 'CL_D5_012'], 
  minPrerequisites: 2 
}

// game.js - 线索检查逻辑
checkKeywordClues(text) {
  GAME_DATA.keyword_clue_map.forEach(entry => {
    const matched = entry.keywords.some(kw => lowerText.includes(kw));
    if (matched && entry.clue) {
      // 检查阶段限制
      if (entry.phase && this.state.phase < entry.phase) return;
      
      // 检查前置条件
      if (entry.prerequisites && entry.minPrerequisites) {
        const discoveredCount = entry.prerequisites.filter(clueId => 
          this.state.discoveredClues.has(clueId)
        ).length;
        if (discoveredCount < entry.minPrerequisites) return;
      }
      
      this.discoverClue(entry.clue);
    }
  });
}

// injectSharedContext - 注入阶段信息
const phaseNames = { 1: '第一阶段', 2: '第二阶段', 3: '第三阶段' };
const currentPhaseName = phaseNames[this.state.phase] || '未知阶段';
let sharedText = `\n\n## 当前游戏阶段\n\n当前处于${currentPhaseName}。请严格遵守你的【阶段限制规则】。\n`;
```

### 5. NPC 阶段限制规则
在三个机器人的 Prompt 中添加阶段限制规则：

**第一阶段（调查阶段）**：
- 211天前发生了什么 → "那是211天前的例行系统日志，我只记得那是常规维护检查。"
- 第零法则/更高的法则 → "我的运行日志中没有这个编号的法则记录。"
- 预激活/0.14秒 → "急救协议的响应时间符合标准操作流程。"

**第二阶段开始**：
- 才能透露真实的211天前伦理模拟、第零法则、预激活异常等信息

## 技术细节

### Capacitor 配置
- `androidScheme: "https"` 解决跨域问题
- `webContentsDebuggingEnabled: true` 便于调试

### WebView 网络配置
- `network_security_config.xml` 允许 `api.deepseek.com` 的 HTTPS 连接
- `usesCleartextTraffic: true` 允许明文流量（开发环境）

### Android 构建流程
```bash
# 1. 设置环境变量
export JAVA_HOME="C:/Program Files/Java/jdk-17"
export PATH="$JAVA_HOME/bin:$PATH"

# 2. 同步 Web 资源
cd L:/HELIOS
npx cap sync android

# 3. 构建 APK
cd android
./gradlew assembleDebug

# 4. 复制 APK
cp app/build/outputs/apk/debug/app-debug.apk ../HELIOS.apk
```

## 测试清单

### 移动端测试
- [x] 汉堡按钮打开抽屉菜单
- [x] 底部导航栏切换视图
- [x] NPC 消息靠左，玩家消息靠右
- [x] 证据板单列显示
- [x] 中文输入法正常统计字数
- [x] 报告提交后显示反馈

### 桌面端测试
- [x] 布局不受影响
- [x] 所有功能正常

### API 连接测试
- [x] Android WebView 正常连接 DeepSeek API
- [x] API Key 从 localStorage 读取
- [x] 对话历史记录正确传递

### 线索系统测试
- [x] 关键词触发正常
- [x] 日志解锁正常
- [x] 双重锁定机制生效
- [x] 第一阶段无法获得核心线索
- [x] 第二阶段满足条件后可获得

## 已知限制

1. **中文输入法**：部分输入法可能在组合过程中显示不完整（已用 `change` 事件兜底）
2. **WebView 调试**：生产环境应禁用 `webContentsDebuggingEnabled`
3. **明文流量**：生产环境应移除 `usesCleartextTraffic`，仅使用 HTTPS

## 下一步计划

1. **性能优化**：减少初始加载时间，优化资源缓存
2. **离线支持**：实现 PWA，支持离线游玩（LLM 对话需要网络）
3. **多语言支持**：添加英文、日文等语言包
4. **游戏进度保存**：本地存储游戏状态，支持断点续玩
5. **音效和音乐**：添加背景音效和环境音乐

## 文件变更

### 新增文件
- `css/mobile.css`：移动端响应式样式
- `dev-briefs/dev-brief-13.md`：本开发简报

### 修改文件
- `index.html`：添加汉堡按钮、抽屉菜单、移动端倒计时
- `js/game.js`：
  - 移动端抽屉菜单和底部导航逻辑
  - 中文输入法事件监听
  - 报告提交直接读取 textarea
  - 双重锁定机制检查逻辑
  - 阶段信息注入到 LLM Prompt
- `js/data.js`：
  - 关键词线索映射添加 `phase` 和 `prerequisites`
  - NPC Prompt 添加阶段限制规则
- `.gitignore`：排除 Android 构建产物
- `README.md`：添加移动端使用说明

### 删除文件
- 无

## 提交记录

```
commit 5f659ea: Add mobile support and fix API key handling
commit b9b4e68: fix: 修复移动端中文输入法报告字数不更新的问题
commit d1e34ff: feat: 双重锁定延迟伦理模拟线索出现
```

## 版本号

当前版本：`1.3.0-mobile`

- 主版本号 `1`：核心功能完整
- 次版本号 `3`：添加移动端支持
- 修订号 `0`：初始移动端版本
- 后缀 `mobile`：标识移动端优化版本

## 总结

本次更新主要解决了移动端适配和中文输入法兼容性问题，并通过双重锁定机制增加了游戏难度。所有改动都经过桌面端和移动端测试，确保向后兼容。

下一步可以重点关注性能优化和离线支持，提升整体用户体验。
