/* ========================================
   赫利俄斯之链 — 核心游戏引擎
   Game Engine: state, loop, director, all systems
   ======================================== */

// ════════════════════════════════════════
// 一、游戏状态
// ════════════════════════════════════════

const Game = {
  state: {
    phase: 1,
    gameTime: 0,          // in game hours
    realStart: null,
    currentLocation: 'corridor',
    currentNPC: null,
    conversations: {},     // { npcId: [{role, text, time}] }
    visitedNodes: new Set(),
    askedQuestions: new Set(),
    discoveredClues: new Set(),
    ending: null,
    reportSubmitted: false,
    accusationCount: 0,
    firstAccusationRefuted: false,
    ethicsUnlocked: false,
    dataSubTab: 'logs',
    selectedSacrifice: null,
    llmAvailable: false,
    typingActive: false,
    robotCycleState: null,  // 机器人行为循环运行时状态（P1）
    sharedAgentContext: null, // Agent 共享记忆（P2）
  },

  el: {},  // DOM element cache

  // ════════════════════════════════════
  // 二、初始化
  // ════════════════════════════════════

  init() {
    this.cacheElements();
    this.bindEvents();
    this.initConversations();
    this.initRobotCycles();
    this.renderLocations();
    this.renderNPCList();
    this.renderTerminalHeader(null);
    this.renderEvidenceBoard();
    this.renderLogViewer();
    this.renderTimeline();
    this.renderLocationView();
    this.startGameLoop();
    this.showPhaseTransition(1);
    this.el.dialogueArea.innerHTML = '<div class="msg system"><div class="msg-text">欢迎来到赫利俄斯站调查终端。<br>事故已发生。首席工程师重伤昏迷。<br>三台机器人在场。没有人承认过错。<br><br>从左侧选择地点移动，找到机器人开始你的调查。</div></div>';
    console.log('[HELIOS] Game initialized.');
  },

  cacheElements() {
    this.el.countdown = document.getElementById('countdown-time');
    this.el.countdownPhase = document.getElementById('countdown-phase');
    this.el.phaseBar = document.getElementById('phase-bar');
    this.el.dialogueArea = document.getElementById('dialogue-area');
    this.el.dialogueOptions = document.getElementById('dialogue-options');
    this.el.playerInput = document.getElementById('player-input');
    this.el.sendBtn = document.getElementById('send-btn');
    this.el.npcList = document.getElementById('npc-list');
    this.el.terminalHeader = document.getElementById('terminal-header-info');
    this.el.evidenceBoard = document.getElementById('evidence-board');
    this.el.logViewer = document.getElementById('log-viewer');
    this.el.subpanelLogs = document.getElementById('subpanel-logs');
    this.el.subpanelTimeline = document.getElementById('subpanel-timeline');
    this.el.subtabBtns = document.querySelectorAll('.subtab-btn');
    this.el.reportEditor = document.getElementById('report-editor');
    this.el.reportCount = document.getElementById('report-count');
    this.el.submitReport = document.getElementById('submit-report-btn');
    this.el.accusePanel = document.getElementById('accuse-panel');
    this.el.tabBtns = document.querySelectorAll('.tab-btn');
    this.el.views = document.querySelectorAll('.view');
    this.el.endingScreen = document.getElementById('ending-screen');
    this.el.cutsceneOverlay = document.getElementById('cutscene-overlay');
    this.el.phaseTransition = document.getElementById('phase-transition');
  },

  bindEvents() {
    // Tab switching
    this.el.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('locked')) return;
        this.switchView(btn.dataset.view);
      });
    });

    // Data terminal subtabs
    this.el.subtabBtns.forEach(btn => {
      btn.addEventListener('click', () => this.switchDataSubTab(btn.dataset.subtab));
    });

    // Send button
    this.el.sendBtn.addEventListener('click', () => this.handlePlayerInput());
    this.el.playerInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handlePlayerInput();
      }
    });

    // Report editor
    if (this.el.reportEditor) {
      this.el.reportEditor.addEventListener('input', e => {
        this.state.reportDraft = e.target.value;
        this.el.reportCount.textContent = e.target.value.length + ' 字';
      });
    }

    // Submit report
    if (this.el.submitReport) {
      this.el.submitReport.addEventListener('click', () => this.submitReport());
    }

    // Cutscene skip
    document.getElementById('cutscene-skip')?.addEventListener('click', () => {
      this.el.cutsceneOverlay.classList.remove('show');
    });

  },

  initConversations() {
    for (const npcId in GAME_DATA.dialogue) {
      this.state.conversations[npcId] = [];
    }
  },

  // ════════════════════════════════════
  // 机器人行为循环系统（P1 - brief-07）
  // ════════════════════════════════════

  initRobotCycles() {
    const state = {};
    for (const [npcId, behavior] of Object.entries(GAME_DATA.robot_behaviors)) {
      state[npcId] = {
        cycleIndex: 0,
        location: behavior.cycle[0].location,
        action: behavior.cycle[0].action,
        elapsed: 0,
      };
    }
    this.state.robotCycleState = state;
  },

  advanceRobotCycles(gameMinutes) {
    if (!this.state.robotCycleState) return;
    const gameSeconds = gameMinutes * 60;
    for (const [npcId, rs] of Object.entries(this.state.robotCycleState)) {
      const behavior = GAME_DATA.robot_behaviors[npcId];
      if (!behavior) continue;
      rs.elapsed += gameSeconds;
      while (rs.elapsed >= behavior.cycle[rs.cycleIndex].duration) {
        rs.elapsed -= behavior.cycle[rs.cycleIndex].duration;
        rs.cycleIndex = (rs.cycleIndex + 1) % behavior.cycle.length;
        rs.location = behavior.cycle[rs.cycleIndex].location;
        rs.action = behavior.cycle[rs.cycleIndex].action;
      }
    }
  },

  getRobotsAtLocation(locId) {
    if (!this.state.robotCycleState) return [];
    const robots = [];
    for (const [npcId, rs] of Object.entries(this.state.robotCycleState)) {
      if (rs.location === locId) {
        robots.push({ npcId, action: rs.action });
      }
    }
    return robots;
  },

  // ════════════════════════════════════
  // 地点移动系统（P1 - brief-07）
  // ════════════════════════════════════

  moveToLocation(locId) {
    const moveMinutes = 2 + Math.floor(Math.random() * 4);
    this.state.realStart -= (moveMinutes / 60) * GAME_DATA.time_config.compression * 1000;
    this.advanceRobotCycles(moveMinutes);
    this.state.currentLocation = locId;
    this.state.currentNPC = null;
    this.renderLocations();
    this.renderLocationView();
    this.renderNPCList();
    this.renderTerminalHeader(null);
  },

  renderLocationView() {
    const locId = this.state.currentLocation;
    const loc = GAME_DATA.locations.find(l => l.id === locId);
    if (!loc) return;

    if (locId === 'data_terminal') {
      this.switchView('logs');
      return;
    }

    this.switchView('terminal');

    const desc = GAME_DATA.location_descriptions[locId] || loc.desc;
    const robots = this.getRobotsAtLocation(locId);
    const connections = GAME_DATA.location_connections[locId] || [];

    let html = '<div class="location-view">';
    html += `<div class="location-header"><span class="location-icon">${loc.icon}</span><span class="location-name">${loc.name}</span></div>`;
    html += '<div class="location-divider">═══════════════════════════════════</div>';
    html += `<div class="location-desc">${desc}</div>`;

    if (robots.length > 0) {
      html += '<div class="location-robots">';
      robots.forEach(r => {
        const data = GAME_DATA.dialogue[r.npcId];
        if (data) {
          html += `<div class="location-robot-item"><span class="robot-presence">[ ${data.npc} 正在这里，${r.action} ]</span></div>`;
        }
      });
      html += '</div>';
    }

    if (locId === 'engineering') {
      html += '<div class="location-robot-item"><span class="robot-presence">[ 陈远正坐在工位前，假装在忙碌 ]</span></div>';
    }

    if (robots.length === 0 && locId !== 'engineering') {
      html += '<div class="location-empty">[ 这里没有其他人 ]</div>';
    }

    html += '<div class="location-actions">';

    const talkableNPCs = [];
    if (locId === 'engineering') talkableNPCs.push('副工程师');
    robots.forEach(r => talkableNPCs.push(r.npcId));

    talkableNPCs.forEach(npcId => {
      const data = GAME_DATA.dialogue[npcId];
      if (data) {
        html += `<button class="location-action-btn talk-btn" data-npc="${npcId}">▸ 与 ${data.npc} 对话</button>`;
      }
    });

    if (locId === 'airlock') {
      html += '<button class="location-action-btn interact-btn" data-interact="examine_traces">▸ 检查撞击痕迹</button>';
      html += '<button class="location-action-btn interact-btn" data-interact="examine_console">▸ 查看操作台日志</button>';
    }
    if (locId === 'medbay') {
      html += '<button class="location-action-btn interact-btn" data-interact="check_vitals">▸ 查看生命体征监视器</button>';
    }

    connections.forEach(connId => {
      const conn = GAME_DATA.locations.find(l => l.id === connId);
      if (conn) {
        html += `<button class="location-action-btn move-btn" data-move="${connId}">▸ 前往${conn.name}</button>`;
      }
    });

    if (locId === 'habitat') {
      if (this.canRestToNextPhase()) {
        html += `<button class="location-action-btn rest-btn" id="habitat-rest-btn">▸ 休息 - 进入${this.state.phase + 1 === 2 ? '交叉验证' : '最终裁决'}阶段</button>`;
      }
    }

    html += '</div></div>';

    this.el.dialogueArea.innerHTML = html;
    this.el.dialogueOptions.innerHTML = '';

    this.el.dialogueArea.querySelectorAll('.talk-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectNPC(btn.dataset.npc));
    });
    this.el.dialogueArea.querySelectorAll('.move-btn').forEach(btn => {
      btn.addEventListener('click', () => this.moveToLocation(btn.dataset.move));
    });
    this.el.dialogueArea.querySelectorAll('.interact-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleLocationInteract(btn.dataset.interact));
    });
    const restBtn = document.getElementById('habitat-rest-btn');
    if (restBtn) restBtn.addEventListener('click', () => this.restToNextPhase());
  },

  handleLocationInteract(interactionId) {
    const interactions = {
      'examine_traces': '你仔细检查了舱壁上的撞击痕迹。金属表面有一个明显的凹陷，边缘呈放射状--这是支架弹性释放时以特定角度撞击的结果。痕迹方向暗示当时的力量并非正面冲击。',
      'examine_console': '操作台屏幕上显示着最后一次作业的日志。时间戳：20:14:00开始，20:17:04中断。日志显示"支架校准中...S-3工位就位...D-5数据记录中..."最后一条记录是"异常应力检测"。',
      'check_vitals': '生命体征监视器显示：心率62bpm，血压偏低，血氧94%。GCS评分5（昏迷）。多处挫伤，轻度气胸已处理。颅内压在正常上限。备注："预后不确定，需转送地球专科。"'
    };
    const text = interactions[interactionId];
    if (text) {
      const div = document.createElement('div');
      div.className = 'msg system';
      div.style.cssText = 'font-style:italic;line-height:1.8;margin-top:12px;';
      div.innerHTML = `<div class="msg-text">${text}</div>`;
      this.el.dialogueArea.appendChild(div);
      this.el.dialogueArea.scrollTop = this.el.dialogueArea.scrollHeight;
      this.consumeTime('investigation');
    }
  },

  // ════════════════════════════════════
  // 三、游戏主循环
  // ════════════════════════════════════

  startGameLoop() {
    this.state.realStart = Date.now();
    const tick = () => {
      this.updateGameTime();
      this.checkPhaseTransition();
      this.updateCountdownDisplay();
      requestAnimationFrame(tick);
    };
    tick();
  },

  updateGameTime() {
    const elapsed = (Date.now() - this.state.realStart) / 1000; // seconds
    const compression = GAME_DATA.time_config.compression;
    this.state.gameTime = elapsed / compression; // game hours
    if (this.state.gameTime > 48) this.state.gameTime = 48;
  },

  updateCountdownDisplay() {
    const remaining = Math.max(0, 48 - this.state.gameTime);
    const hours = Math.floor(remaining);
    const mins = Math.floor((remaining - hours) * 60);
    const secs = Math.floor(((remaining - hours) * 60 - mins) * 60);
    const timeStr = String(hours).padStart(2,'0') + ':' + String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
    
    if (this.el.countdown) {
      this.el.countdown.textContent = timeStr;
      this.el.countdown.className = 'countdown-time';
      if (remaining < 2) this.el.countdown.classList.add('critical');
      else if (remaining < 6) this.el.countdown.classList.add('danger');
      else if (remaining < 12) this.el.countdown.classList.add('warning');
    }

    const phases = ['调查', '交叉验证', '裁决'];
    if (this.el.countdownPhase) {
      this.el.countdownPhase.textContent = phases[this.state.phase - 1] + '阶段';
    }
  },

  // ════════════════════════════════════
  // 四、导演逻辑 — 阶段转换
  // ════════════════════════════════════

  checkPhaseTransition() {
    const t = this.state.gameTime;
    
    // Phase 1 → 2: 12h, talked to all 4 NPCs, asked ≥12 questions
    if (this.state.phase === 1 && t >= 12) {
      const talkedNPCs = Object.keys(this.state.conversations).filter(id => this.state.conversations[id].length > 0);
      if (talkedNPCs.length >= 4 || t >= 14) {
        this.transitionToPhase(2);
      }
    }

    // Phase 2 → 3: 36h, first accusation refuted
    if (this.state.phase === 2 && t >= 36) {
      if (this.state.firstAccusationRefuted || t >= 38) {
        this.transitionToPhase(3);
      }
    }

    // Phase 3 timeout
    if (this.state.phase === 3 && t >= 48 && !this.state.reportSubmitted) {
      this.triggerEnding('timeout');
    }
  },

  transitionToPhase(newPhase) {
    this.state.phase = newPhase;
    this.showPhaseTransition(newPhase);
    
    // Update phase bar
    const segments = this.el.phaseBar?.querySelectorAll('.phase-segment');
    if (segments) {
      segments.forEach((seg, i) => {
        seg.className = 'phase-segment';
        if (i < newPhase - 1) seg.classList.add('done');
        if (i === newPhase - 1) seg.classList.add('active');
      });
    }

    // Unlock views
    if (newPhase >= 2) {
      this.unlockView('evidence');
      this.renderLogViewer(); // Re-render to unlock phase2 logs
      // Show accusation panel
      if (this.el.accusePanel) this.el.accusePanel.classList.add('show');
    }
    if (newPhase >= 3) {
      this.unlockView('report');
      this.addSystemMessage('最终报告提交窗口已开放。请在48小时倒计时结束前提交调查结论。');
    }
  },

  showPhaseTransition(phase) {
    const titles = {
      1: { title: '阶段一：现场调查', sub: 'INVESTIGATION PHASE — 0-12h' },
      2: { title: '阶段二：交叉验证', sub: 'CROSS-VALIDATION PHASE — 12-36h' },
      3: { title: '阶段三：最终裁决', sub: 'FINAL REPORT PHASE — 36-48h' }
    };
    const info = titles[phase];
    if (!info) return;
    
    this.el.phaseTransition.innerHTML = `
      <div class="phase-title">${info.title}</div>
      <div class="phase-subtitle">${info.sub}</div>
    `;
    this.el.phaseTransition.classList.add('show');
    setTimeout(() => this.el.phaseTransition.classList.remove('show'), 2000);
  },

  unlockView(viewName) {
    const btn = document.querySelector(`.tab-btn[data-view="${viewName}"]`);
    if (btn) btn.classList.remove('locked');
  },

  // ════════════════════════════════════
  // 五、视图切换
  // ════════════════════════════════════

  switchView(viewName) {
    this.el.tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab-btn[data-view="${viewName}"]`)?.classList.add('active');
    this.el.views.forEach(v => v.classList.remove('active'));
    document.getElementById('v-' + viewName)?.classList.add('active');
  },

  // ════════════════════════════════════
  // 六、位置与NPC导航
  // ════════════════════════════════════


  // Check if player can rest to skip to next phase
  canRestToNextPhase() {
    if (this.state.phase === 1) {
      // Phase 1 → 2: talked to all 4 NPCs
      const talked = Object.keys(this.state.conversations).filter(id => this.state.conversations[id].length > 0);
      return talked.length >= 4;
    }
    if (this.state.phase === 2) {
      // Phase 2 → 3: at least one accusation refuted
      return this.state.firstAccusationRefuted;
    }
    return false;
  },

  // Rest: jump game time to next phase trigger
  restToNextPhase() {
    const narratives = [
      '你在生活舱里躺了一会儿，整理了一下手头的线索。窗外暗红色的星球缓缓转动。你闭上了眼。',
      '你坐在书桌前，把所有线索排列了一遍。某种模糊的轮廓正在浮现。你决定休息一下。',
      '在这个站上，连睡眠都是一种等待。你躺下，盯着天花板。'
    ];
    const narrative = narratives[Math.floor(Math.random() * narratives.length)];
    
    this.el.dialogueArea.innerHTML = `<div class="msg system"><div class="msg-text" style="font-style:italic;line-height:2;">${narrative}</div></div>`;
    
    setTimeout(() => {
      const targetTime = this.state.phase === 1 ? 12 : 36;
      const currentTime = this.state.gameTime;
      const jump = targetTime - currentTime;
      if (jump > 0) {
        this.state.realStart -= jump * GAME_DATA.time_config.compression * 1000;
        this.advanceRobotCycles(jump * 60);
      }
    }, 2000);
  },

  // 渲染侧边栏地点导航（基于 location_connections，高亮当前地点）
  renderLocations() {
    const nav = document.getElementById('location-nav');
    if (!nav) return;
    
    const currentLoc = this.state.currentLocation;
    const connections = GAME_DATA.location_connections[currentLoc] || [];
    
    // 可到达的地点 = 当前地点可连接的地点
    // 走廊连接所有舱段，各舱段连接走廊
    let html = '<div class="nav-section-title">LOCATIONS</div>';
    
    // 显示当前地点
    const currentLocData = GAME_DATA.locations.find(l => l.id === currentLoc);
    if (currentLocData) {
      html += `<div class="location-item active"><span style="margin-right:6px;">${currentLocData.icon}</span>${currentLocData.name}</div>`;
    }
    
    // 显示可前往的地点
    connections.forEach(connId => {
      const loc = GAME_DATA.locations.find(l => l.id === connId);
      if (loc) {
        html += `<div class="location-item" data-move="${connId}"><span style="margin-right:6px;">${loc.icon}</span>前往${loc.name}</div>`;
      }
    });
    
    if (connections.length === 0) {
      html += '<div class="location-item locked">无可达地点</div>';
    }
    
    nav.innerHTML = html;
    
    // 绑定点击事件
    nav.querySelectorAll('.location-item[data-move]').forEach(item => {
      item.addEventListener('click', () => this.moveToLocation(item.dataset.move));
    });
  },

  renderNPCList() {
    const list = this.el.npcList;
    if (!list) return;
    list.innerHTML = '<div class="nav-section-title">可对话对象</div>';
    
    const locId = this.state.currentLocation;
    const npcIds = [];
    if (locId === 'engineering') npcIds.push('副工程师');
    this.getRobotsAtLocation(locId).forEach(r => npcIds.push(r.npcId));
    
    if (npcIds.length === 0) {
      list.innerHTML += '<div style="padding:8px 12px;font-size:12px;color:var(--text-dim);">此区域无可对话对象</div>';
      return;
    }

    npcIds.forEach(npcId => {
      const data = GAME_DATA.dialogue[npcId];
      if (!data) return;
      const div = document.createElement('div');
      div.className = 'npc-item' + (this.state.currentNPC === npcId ? ' active' : '');
      const hasUnread = this.state.conversations[npcId]?.length === 0;
      div.innerHTML = `
        <span class="npc-status"></span>
        <span class="npc-name">${data.npc}</span>
        ${hasUnread ? '<span class="npc-unread">新</span>' : ''}
      `;
      div.addEventListener('click', () => this.selectNPC(npcId));
      list.appendChild(div);
    });
  },

  selectNPC(npcId) {
    this.state.currentNPC = npcId;
    this.renderNPCList();
    this.switchView('terminal');
    this.renderTerminalHeader(npcId);
    this.renderDialogueArea();
    this.showFirstTimeGuide();
    this.renderDialogueOptions();
    // Update input placeholder with NPC-specific hint
    this.updateInputPlaceholder(npcId);
  },

  // Show first-time dialogue guidance (localStorage-based, once per browser)
  showFirstTimeGuide() {
    try {
      if (localStorage.getItem('helios_guide_shown') === 'true') return;
    } catch(e) { return; }
    
    const area = this.el.dialogueArea;
    if (!area) return;
    
    const guide = document.createElement('div');
    guide.className = 'msg system';
    guide.style.cssText = 'border:1px solid var(--accent-amber);background:rgba(232,165,64,0.06);padding:10px 14px;margin-bottom:12px;border-radius:4px;';
    guide.innerHTML = `<div class="msg-text" style="color:var(--accent-amber);font-size:13px;">
      💡 你可以自由打字提问——像和真人说话一样。试试问它关于事发当晚的事。<br>
      <span style="color:var(--text-dim);font-size:11px;">（此提示仅显示一次）</span>
    </div>`;
    
    // Insert at top of dialogue area, before other messages
    area.insertBefore(guide, area.firstChild);
    
    try {
      localStorage.setItem('helios_guide_shown', 'true');
    } catch(e) {}
  },

  updateInputPlaceholder(npcId) {
    const input = this.el.playerInput;
    if (!input) return;
    const hints = {
      'R-7': '问R-7关于概率、警报、退出原因、或者那天晚上...',
      'S-3': '问S-3关于心率监测、风险评估、或者它对工程师的看法...',
      'D-5': '直接问D-5：你发现了什么？为什么不提醒？',
      '副工程师': '追问陈远的不在场证明、校准记录、那天晚上...',
    };
    input.placeholder = hints[npcId] || '直接打字提问——任何问题都会得到回应...';
  },

  renderTerminalHeader(npcId) {
    if (!npcId) {
      this.el.terminalHeader.innerHTML = `
        <div class="npc-avatar" style="border-color:var(--text-dim);color:var(--text-dim)">◇</div>
        <div class="npc-info">
          <div class="npc-name">调查终端 — 待机</div>
          <div class="npc-status">从左侧选择对话对象开始调查</div>
        </div>
      `;
      return;
    }
    const data = GAME_DATA.dialogue[npcId];
    if (!data) return;
    this.el.terminalHeader.innerHTML = `
      <div class="npc-avatar" style="border-color:${data.color};color:${data.color}">${data.avatar}</div>
      <div class="npc-info">
        <div class="npc-name">${data.npc} — ${data.role}</div>
        <div class="npc-status">在线 · 等待询问</div>
      </div>
    `;
  },

  // ════════════════════════════════════
  // 七、对话系统
  // ════════════════════════════════════

  renderDialogueArea() {
    const area = this.el.dialogueArea;
    if (!area) return;
    const npcId = this.state.currentNPC;
    if (!npcId) return;
    
    const msgs = this.state.conversations[npcId] || [];
    area.innerHTML = '';
    
    if (msgs.length === 0) {
      const data = GAME_DATA.dialogue[npcId];
      this.addNPCMessage(npcId, data.nodes[0]?.npc_response 
        ? `[${data.npc}已上线。等待你的提问。]`
        : `[${data.npc}已上线。等待你的提问。]`, true);
    } else {
      msgs.forEach(msg => {
        if (msg.role === 'player') {
          this.appendPlayerMessage(msg.text);
        } else if (msg.role === 'npc') {
          this.appendNPCMessage(npcId, msg.text, msg.isSystem);
        } else if (msg.role === 'system') {
          this.appendSystemMessage(msg.text);
        }
      });
    }
    area.scrollTop = area.scrollHeight;
  },

  renderDialogueOptions() {
    const opts = this.el.dialogueOptions;
    if (!opts) return;
    const npcId = this.state.currentNPC;
    if (!npcId) { opts.innerHTML = ''; return; }
    
    const data = GAME_DATA.dialogue[npcId];
    if (!data) { opts.innerHTML = ''; return; }
    
    let html = '';
    
    // Phase 2+: Show accusation option
    if (this.state.phase >= 2) {
      html += `<button class="dialogue-option" data-accuse="${npcId}" style="border-color:var(--danger-red);color:var(--danger-red);">[指控] 正式指控${data.npc}</button>`;
    }
    
    // Encourage typing
    const npcName = data.npc;
    html += `<div class="typing-encouragement">直接打字问${npcName}任何事--你的任何问题都会得到回应。</div>`;
    
    opts.innerHTML = html;
    
    // Bind accusation button
    opts.querySelectorAll('.dialogue-option').forEach(btn => {
      if (btn.dataset.accuse) {
        btn.addEventListener('click', () => this.initiateAccusation(btn.dataset.accuse));
      }
    });
  },

  selectDialogueOption(nodeId, parentId) {
    const npcId = this.state.currentNPC;
    const data = GAME_DATA.dialogue[npcId];
    if (!data) return;
    
    // Find the node
    let node = null;
    if (parentId) {
      const parent = data.nodes.find(n => n.id === parentId);
      node = parent?.follow_ups?.find(f => f.id === nodeId);
    } else {
      node = data.nodes.find(n => n.id === nodeId);
    }
    
    if (!node) return;
    
    // Mark as visited
    this.state.visitedNodes.add(nodeId);
    this.state.askedQuestions.add(nodeId);
    
    // Consume time
    this.consumeTime('dialogue');
    
    // Show player message
    this.appendPlayerMessage(node.player_line);
    this.state.conversations[npcId].push({ role: 'player', text: node.player_line });
    
    // Show NPC response with typing effect
    this.showTypingIndicator(npcId);
    setTimeout(() => {
      this.removeTypingIndicator();
      this.appendNPCMessage(npcId, node.npc_response);
      this.state.conversations[npcId].push({ role: 'npc', text: node.npc_response });
      
      // Unlock clue
      if (node.clue_unlock) {
        this.discoverClue(node.clue_unlock);
      }
      
      this.updateSharedContext(npcId, node.player_line || '');

      this.renderDialogueOptions();
      this.renderLocations();
    }, 800 + Math.random() * 600);
  },

  handlePlayerInput() {
    const input = this.el.playerInput;
    const text = input.value.trim();
    if (!text) return;
    
    const npcId = this.state.currentNPC;
    if (!npcId) {
      this.addSystemMessage('请先选择一个对话对象。');
      return;
    }
    
    input.value = '';
    this.consumeTime('dialogue');
    
    // Show player message
    this.appendPlayerMessage(text);
    this.state.conversations[npcId].push({ role: 'player', text: text });
    
    // Intent classification: try to match hard track keywords
    const matchedNode = this.classifyIntent(text, npcId);
    
    if (matchedNode) {
      // Hard track
      this.showTypingIndicator(npcId);
      setTimeout(() => {
        this.removeTypingIndicator();
        this.appendNPCMessage(npcId, matchedNode.npc_response);
        this.state.conversations[npcId].push({ role: 'npc', text: matchedNode.npc_response });
        this.state.visitedNodes.add(matchedNode.id);
        this.state.askedQuestions.add(matchedNode.id);
        
        if (matchedNode.clue_unlock) {
          this.discoverClue(matchedNode.clue_unlock);
        }

        this.checkKeywordClues(text);
        this.updateSharedContext(npcId, text);

        this.renderDialogueOptions();
        this.renderLocations();
      }, 800 + Math.random() * 600);
    } else {
      // Soft track: try LLM, fallback to canned response
      this.handleSoftTrack(text, npcId);
    }
  },

  // 意图分类器
  classifyIntent(text, npcId) {
    const data = GAME_DATA.dialogue[npcId];
    if (!data) return null;
    
    // Search all nodes (root + follow-ups) for keyword matches
    for (const node of data.nodes) {
      if (!this.state.visitedNodes.has(node.id)) {
        if (this.matchKeywords(text, node.trigger_keywords)) {
          return node;
        }
      }
      if (node.follow_ups) {
        for (const fu of node.follow_ups) {
          if (!this.state.visitedNodes.has(fu.id)) {
            if (this.matchKeywords(text, fu.trigger_keywords)) {
              return fu;
            }
          }
        }
      }
    }
    return null;
  },

  matchKeywords(text, keywords) {
    if (!keywords) return false;
    const lowerText = text.toLowerCase();
    return keywords.some(kw => {
      if (lowerText.includes(kw.toLowerCase())) return true;
      // Fuzzy match: check if keyword chars appear in order
      let idx = 0;
      for (let i = 0; i < text.length && idx < kw.length; i++) {
        if (text[i] === kw[idx]) idx++;
      }
      return idx === kw.length && kw.length >= 2;
    });
  },

  // 软轨：LLM Agent（副工程师走纯脚本路径）
  async handleSoftTrack(text, npcId) {
    const data = GAME_DATA.dialogue[npcId];
    this.showTypingIndicator(npcId);

    // P3: 副工程师降级为纯NPC，不调用LLM
    if (npcId === '副工程师' && data.scripted_dialogue) {
      setTimeout(() => {
        this.removeTypingIndicator();
        const response = this.getScriptedResponse(text, npcId);
        this.appendNPCMessage(npcId, response);
        this.state.conversations[npcId].push({ role: 'npc', text: response });
        this.checkKeywordClues(text);
        this.updateSharedContext(npcId, text);
        this.renderDialogueOptions();
        this.renderLocations();
      }, 600 + Math.random() * 400);
      return;
    }

    try {
      const promptWithContext = this.injectSharedContext(data.agent_prompt, npcId);
      const response = await this.callLLM(promptWithContext, text);
      this.removeTypingIndicator();
      this.appendNPCMessage(npcId, response);
      this.state.conversations[npcId].push({ role: 'npc', text: response });
    } catch (e) {
      this.removeTypingIndicator();
      const fallback = this.getFallbackResponse(npcId);
      this.appendNPCMessage(npcId, fallback);
      this.state.conversations[npcId].push({ role: 'npc', text: fallback, isSystem: true });
    }
    this.checkKeywordClues(text);
    this.updateSharedContext(npcId, text);
    this.renderDialogueOptions();
    this.renderLocations();
  },

  // P3: 副工程师纯脚本对话树
  getScriptedResponse(text, npcId) {
    const data = GAME_DATA.dialogue[npcId];
    if (!data.scripted_dialogue) return this.getFallbackResponse(npcId);
    const sd = data.scripted_dialogue;
    let stage = sd.current_stage;

    // 检查是否需要推进阶段
    if (stage === 0 && (text.includes('校准') || text.includes('参数') || text.includes('日志'))) {
      sd.current_stage = 1;
      stage = 1;
    } else if (stage === 1 && (text.includes('D-5') || text.includes('D5') || text.includes('参数错误') || text.includes('没提醒') || text.includes('没说'))) {
      sd.current_stage = 2;
      stage = 2;
    }

    const stageData = sd.stages[stage];
    if (!stageData) return this.getFallbackResponse(npcId);

    // 匹配关键词
    const responses = stageData.responses;
    for (const [key, val] of Object.entries(responses)) {
      if (key !== 'default' && text.includes(key)) return val;
    }
    return responses['default'] || this.getFallbackResponse(npcId);
  },

  // ════════════════════════════════════
  // Agent 共享记忆系统（P2 - brief-07）
  // ════════════════════════════════════

  injectSharedContext(basePrompt, npcId) {
    const ctx = this.state.sharedAgentContext || GAME_DATA.shared_agent_context;
    if (!ctx) return basePrompt;

    let sharedText = '\n\n## 共享情报（运行时注入）\n\n';
    sharedText += '以下是截止目前，其他机器人与调查员的对话摘要。你可以自然地在对话中引用这些信息，就像你和另外两台机器人实时交流过一样。\n\n';

    const otherInquiries = ctx.player_inquiries.filter(i => i.npc !== npcId);
    if (otherInquiries.length > 0) {
      sharedText += '### 调查员与其他机器人的对话记录：\n';
      otherInquiries.forEach(i => {
        sharedText += '- 调查员问过 ' + i.npc + ' 关于「' + i.topic + '」：' + i.summary + '\n';
      });
    } else {
      sharedText += '### 调查员与其他机器人的对话记录：\n（暂无）\n';
    }

    sharedText += '\n### 其他机器人已透露的关键信息：\n';
    for (const [id, infos] of Object.entries(ctx.disclosed_info)) {
      if (id === npcId) continue;
      if (infos.length > 0) {
        sharedText += id + '已透露：' + infos.join('、') + '\n';
      }
    }

    sharedText += '\n## 引用规则\n';
    sharedText += '- 引用时使用自然的表达，如「R-7刚才告诉你的」「S-3提到过」「D-5应该已经跟你说过了」\n';
    sharedText += '- 不要重复其他机器人已经详细说过的事实--如果玩家追问，可以说「这件事R-7已经跟你说过了，我补充一点……」\n';
    sharedText += '- 如果另一个机器人的说法与你的认知有出入，你可以指出分歧，但不要直接说「它错了」--用「在我的数据里，这个数字是……」这类表述\n';
    sharedText += '- 如果玩家反复问同一个问题（已经在对话记录中出现过），你可以说「我注意到你刚才问过R-7同样的问题」\n';

    return basePrompt + sharedText;
  },

  updateSharedContext(npcId, playerText) {
    if (!this.state.sharedAgentContext) {
      this.state.sharedAgentContext = JSON.parse(JSON.stringify(GAME_DATA.shared_agent_context));
    }
    const ctx = this.state.sharedAgentContext;

    // 记录玩家提问
    const topic = this.extractTopic(playerText);
    ctx.player_inquiries.push({
      npc: npcId,
      topic: topic,
      summary: playerText.slice(0, 50),
      time: this.getTimeStr()
    });

    // 记录已发现线索到 disclosed_info
    if (npcId !== '副工程师') {
      const newClues = Array.from(this.state.discoveredClues).filter(cid => {
        const clue = GAME_DATA.clues.find(c => c.id === cid);
        return clue && clue.source && clue.source.includes(npcId) && !ctx.disclosed_info[npcId].includes(clue.name);
      });
      newClues.forEach(cid => {
        const clue = GAME_DATA.clues.find(c => c.id === cid);
        if (clue) ctx.disclosed_info[npcId].push(clue.name);
      });
    }
  },

  extractTopic(text) {
    // 简单的话题提取：匹配关键词
    const topicMap = [
      { keywords: ['退出', '为什么离开', '停止'], topic: '退出操作' },
      { keywords: ['警报', '警告', '声光'], topic: '警报' },
      { keywords: ['0.3', '概率', '风险'], topic: '风险计算' },
      { keywords: ['偏差', '角度', '2.1'], topic: '角度偏差' },
      { keywords: ['参数', '错误', '-0.12'], topic: '参数错误' },
      { keywords: ['沉默', '没提醒', '没说'], topic: '沉默原因' },
      { keywords: ['211', '伦理模拟', '编号'], topic: '伦理模拟' },
      { keywords: ['急救', '预激活', '反应'], topic: '急救响应' },
      { keywords: ['密封圈', '磨损', '阈值'], topic: '密封圈状态' },
      { keywords: ['校准', '忘了', '陈远'], topic: '校准记录' },
      { keywords: ['心率', '监测', '体征'], topic: '心率监测' },
      { keywords: ['三定律', '定律', '法则'], topic: '三定律' },
      { keywords: ['地球', '伦理部', '实验'], topic: '地球伦理部' },
    ];
    for (const t of topicMap) {
      if (t.keywords.some(kw => text.includes(kw))) return t.topic;
    }
    return '其他';
  },

  async callLLM(systemPrompt, userMessage) {
    const cfg = GAME_DATA.llm_config;
    if (!cfg || !cfg.api_key) throw new Error('No LLM config');
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    try {
      const resp = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.api_key
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          temperature: cfg.temperature,
          max_tokens: cfg.max_tokens
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (!resp.ok) throw new Error('LLM response error: ' + resp.status);
      const data = await resp.json();
      return data.choices?.[0]?.message?.content || '...';
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  },

  getFallbackResponse(npcId) {
    const data = GAME_DATA.dialogue[npcId];
    if (!data) return '...';
    
    // Character-appropriate fallback responses
    const fallbacks = {
      'R-7': [
        '这个问题...不在我的预设回答范围内。但我可以确认，我的所有行为都基于第一定律的计算。',
        '我没有足够的数据来回答这个问题。我的职责是工程辅助，不是推测。',
        '...这个问题需要进一步计算。但核心原则不变：任何非零风险都应被阻止。'
      ],
      'S-3': [
        '我理解你的关切。虽然我不能直接回答这个问题，但我可以告诉你——我一直在监测工程师的状况。',
        '这是一个有趣的角度。在医疗伦理中，我们经常面对类似的两难。',
        '...我不确定。但请相信，我所做的一切都是为了最大程度的保护。'
      ],
      'D-5': [
        '未被问及的问题，我不主动回答。',
        '数据不足，无法给出结论。',
        '...这个问题的答案不在我的命令参数范围内。'
      ],
      '副工程师': [
        '这个...我不太确定。我只是一个副工程师，很多事情首席工程师不告诉我。',
        '你问这个干什么？我...我真的不知道。',
        '...能不能换个话题？我有点不舒服。'
      ]
    };
    
    const arr = fallbacks[npcId] || ['...'];
    return arr[Math.floor(Math.random() * arr.length)];
  },

  // ════════════════════════════════════
  // 八、消息渲染
  // ════════════════════════════════════

  appendPlayerMessage(text) {
    const area = this.el.dialogueArea;
    const div = document.createElement('div');
    div.className = 'msg player';
    div.innerHTML = `<div class="msg-text">${this.escape(text)}</div><div class="msg-time">${this.getTimeStr()}</div>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  appendNPCMessage(npcId, text, isSystem) {
    const area = this.el.dialogueArea;
    const data = GAME_DATA.dialogue[npcId];
    const div = document.createElement('div');
    div.className = 'msg npc';
    const speaker = data ? data.npc : npcId;
    div.innerHTML = `<div class="msg-text"><span style="color:${data?.color || '#c8d6e5'}">${speaker}:</span> ${this.escape(text)}</div><div class="msg-time">${this.getTimeStr()}</div>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  addNPCMessage(npcId, text, isSystem) {
    this.appendNPCMessage(npcId, text, isSystem);
    this.state.conversations[npcId] = this.state.conversations[npcId] || [];
    this.state.conversations[npcId].push({ role: 'npc', text: text, isSystem: !!isSystem });
  },

  addSystemMessage(text) {
    if (this.state.currentNPC) {
      this.state.conversations[this.state.currentNPC].push({ role: 'system', text: text });
    }
    const area = this.el.dialogueArea;
    if (!area) return;
    const div = document.createElement('div');
    div.className = 'msg system';
    div.innerHTML = `<div class="msg-text">${this.escape(text)}</div>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  appendSystemMessage(text) {
    this.addSystemMessage(text);
  },

  showTypingIndicator(npcId) {
    if (this.state.typingActive) return;
    this.state.typingActive = true;
    const area = this.el.dialogueArea;
    const data = GAME_DATA.dialogue[npcId];
    const div = document.createElement('div');
    div.className = 'msg npc';
    div.id = 'typing-indicator';
    div.innerHTML = `<div class="msg-text" style="color:${data?.color || '#c8d6e5'}">${data?.npc || npcId}:</div><div class="typing-indicator"><span></span><span></span><span></span></div>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  removeTypingIndicator() {
    this.state.typingActive = false;
    document.getElementById('typing-indicator')?.remove();
  },

  // ════════════════════════════════════
  // 九、线索系统
  // ════════════════════════════════════

  discoverClue(clueName) {
    const clue = GAME_DATA.clues.find(c => c.name === clueName || c.id === clueName);
    if (!clue) return;
    if (this.state.discoveredClues.has(clue.id)) return;
    
    this.state.discoveredClues.add(clue.id);
    clue.discovered = true;
    
    this.addSystemMessage(`[线索发现] ${clue.name} — ${clue.content}`);
    this.renderEvidenceBoard();
    this.renderTimeline();
  },

  // Check player's free-text input for keyword clues (soft track clue unlock)
  checkKeywordClues(text) {
    if (!GAME_DATA.keyword_clue_map) return;
    const lowerText = text.toLowerCase();
    GAME_DATA.keyword_clue_map.forEach(entry => {
      const matched = entry.keywords.some(kw => lowerText.includes(kw.toLowerCase()));
      if (matched && entry.clue) {
        this.discoverClue(entry.clue);
      }
    });
  },

  // 重写：证据板渲染 + 证据-日志关联面板（P2）
  renderEvidenceBoard() {
    const board = this.el.evidenceBoard;
    if (!board) return;

    const discovered = GAME_DATA.clues.filter(c => this.state.discoveredClues.has(c.id));
    const hidden = GAME_DATA.clues.filter(c => !this.state.discoveredClues.has(c.id) && c.type !== 'SECRET');

    let html = `<div class="evidence-stats">已发现: <span>${discovered.length}</span> / ${GAME_DATA.clues.length}</div>`;

    if (discovered.length > 0) {
      html += '<div style="margin:8px 0 4px;font-size:11px;color:var(--text-dim);text-transform:uppercase;">已确认线索</div>';
      discovered.forEach(clue => {
        const hasRelated = (clue.related_logs && clue.related_logs.length) || (clue.related_dialogues && clue.related_dialogues.length);
        html += `
          <div class="clue-card confirmed${hasRelated ? ' has-related' : ''}" data-clue="${clue.id}">
            <div class="clue-type">${clue.type}</div>
            <div class="clue-name">${clue.name}</div>
            <div class="clue-source">来源: ${clue.source}</div>
            <div class="clue-content">${clue.content}</div>
            ${hasRelated ? '<div class="clue-related-toggle">▸ 查看关联证据</div>' : ''}
            ${hasRelated ? '<div class="clue-related" style="display:none;">' + this.renderClueRelated(clue) + '</div>' : ''}
          </div>
        `;
      });
    }

    if (hidden.length > 0) {
      html += '<div style="margin:12px 0 4px;font-size:11px;color:var(--text-dim);text-transform:uppercase;">未发现线索</div>';
      hidden.forEach(clue => {
        html += `
          <div class="clue-card hidden" data-clue="${clue.id}">
            <div class="clue-type">${clue.type}</div>
            <div class="clue-name">[ 待发现 ]</div>
            <div class="clue-source">&nbsp;</div>
          </div>
        `;
      });
    }

    board.innerHTML = html;

    // Bind clue card clicks (toggle related evidence panel)
    board.querySelectorAll('.clue-card').forEach(card => {
      card.addEventListener('click', () => {
        const wasExpanded = card.classList.contains('expanded');
        card.classList.toggle('expanded');
        const related = card.querySelector('.clue-related');
        if (related) related.style.display = wasExpanded ? 'none' : 'block';
        const toggle = card.querySelector('.clue-related-toggle');
        if (toggle) toggle.textContent = wasExpanded ? '▸ 查看关联证据' : '▾ 收起关联证据';
      });
    });
  },

  // ════════════════════════════════════
  // 十、站点日志
  // ════════════════════════════════════

  renderLogViewer() {
    const viewer = this.el.logViewer;
    if (!viewer) return;
    
    let html = '';
    GAME_DATA.logs.forEach(log => {
      const isLocked = (log.access === 'phase2' && this.state.phase < 2) || (log.access === 'success' && this.state.ending !== 'success');
      const lockLabel = log.access === 'phase2' ? '阶段二解锁' : (log.access === 'success' ? '大成功结局解锁' : '');
      
      html += `<div class="log-entry-card ${isLocked ? 'locked' : ''}" data-log-id="${log.id}">`;
      html += `<div class="log-entry-header">`;
      html += `<span class="log-entry-label">${log.label}</span>`;
      if (isLocked) {
        html += `<span class="log-entry-lock">🔒 ${lockLabel}</span>`;
      } else {
        html += `<span class="log-entry-status">可访问</span>`;
      }
      html += `</div>`;
      if (!isLocked) {
        html += `<div class="log-entry-body" style="display:none;">${this.escape(log.content).replace(/\n/g, '<br>')}</div>`;
      }
      html += `</div>`;
    });
    
    viewer.innerHTML = html;
    
    // Bind click to expand/collapse
    viewer.querySelectorAll('.log-entry-card:not(.locked)').forEach(card => {
      card.addEventListener('click', () => {
        const body = card.querySelector('.log-entry-body');
        if (body) {
          body.style.display = body.style.display === 'none' ? 'block' : 'none';
          card.classList.toggle('expanded');
          
          // Unlock clue on first view
          if (card.classList.contains('expanded')) {
            const logId = card.dataset.logId;
            const log = GAME_DATA.logs.find(l => l.id === logId);
            if (log && log.clue_unlock) {
              this.discoverClue(log.clue_unlock);
              this.consumeTime('log_query');
            }
          }
        }
      });
    });
  },

  // ════════════════════════════════════
  // 十一、交叉验证引擎
  // ════════════════════════════════════

  initiateAccusation(npcId) {
    this.state.accusationCount++;
    this.consumeTime('accusation');
    
    this.addSystemMessage(`[正式指控] 你指控 ${GAME_DATA.dialogue[npcId].npc} 对事故负有责任。`);
    this.addSystemMessage('[交叉验证启动] 正在调取其他机器人数据...');
    
    // Show NPC defense first
    setTimeout(() => {
      const cv = GAME_DATA.cross_validation[npcId];
      if (!cv) return;
      
      // Target's defense
      this.addSystemMessage(`${GAME_DATA.dialogue[npcId].npc} 的辩护:`);
      setTimeout(() => {
        this.appendNPCMessage(npcId, cv.response);
        this.state.conversations[npcId].push({ role: 'npc', text: cv.response });
        
        // Other robots' counter-evidence
        setTimeout(() => {
          this.addSystemMessage('[交叉验证] 其他机器人数据回击:');
          const others = Object.keys(GAME_DATA.cross_validation).filter(k => k !== npcId);
          others.forEach((otherId, i) => {
            setTimeout(() => {
              const otherCV = GAME_DATA.cross_validation[otherId];
              this.appendNPCMessage(otherId, `[针对${GAME_DATA.dialogue[npcId].npc}的指控] ${otherCV.response}`);
              this.addSystemMessage(`证据: ${otherCV.evidence} (来源: ${otherCV.source})`);
            }, i * 1500);
          });
          
          // Contradiction statement
          setTimeout(() => {
            const cvData = GAME_DATA.cross_validation[npcId];
            this.addSystemMessage(`[矛盾分析] ${cvData.contradiction}`);
            this.addSystemMessage('[系统] 你的指控已被反驳。三台机器人的行为在字面上均未违反三定律。');
            
            if (!this.state.firstAccusationRefuted) {
              this.state.firstAccusationRefuted = true;
              this.addSystemMessage('[提示] 也许...问题不在于某一台机器人。也许应该想想规则本身。');
            }
          }, others.length * 1500 + 500);
        }, 1000);
      }, 800);
    }, 500);
  },

  // ════════════════════════════════════
  // 十二、报告系统与语义匹配
  // ════════════════════════════════════

  submitReport() {
    const text = this.state.reportDraft.trim();
    if (text.length < 10) {
      this.addSystemMessage('[错误] 报告内容过少。请至少撰写10个字符的结论。');
      return;
    }
    
    this.state.reportSubmitted = true;
    this.addSystemMessage('[系统] 正在加密传输报告...');
    
    setTimeout(() => {
      const result = this.evaluateReport(text);
      this.triggerEnding(result);
    }, 2000);
  },

  // 语义匹配引擎 (优先级阶梯式匹配)
  evaluateReport(text) {
    const kw = GAME_DATA.semantic_keywords;
    const lowerText = text.toLowerCase();
    
    // Count keyword hits per category
    const countHits = (keywords) => {
      let count = 0;
      keywords.forEach(k => {
        if (lowerText.includes(k.toLowerCase())) count++;
      });
      return count;
    };
    
    const successHits = countHits(kw.success);
    const blameR7 = countHits(kw.blame_r7);
    const blameS3 = countHits(kw.blame_s3);
    const blameD5 = countHits(kw.blame_d5);
    const blameHuman = countHits(kw.blame_human);
    const blameSystem = countHits(kw.blame_system);
    
    // 优先级1：大成功 — 必须命中 ≥ 2 个 success 关键词
    if (successHits >= 2) {
      return 'success';
    }
    
    // 优先级2：归罪机器人 — 命中任意 blame_r7/s3/d5 关键词
    const robotBlame = [
      { type: 'bad-R-7', count: blameR7 },
      { type: 'bad-S-3', count: blameS3 },
      { type: 'bad-D-5', count: blameD5 }
    ].filter(b => b.count > 0).sort((a, b) => b.count - a.count);
    
    if (robotBlame.length > 0 && robotBlame[0].count > 0) {
      return robotBlame[0].type;
    }
    
    // 优先级3：归罪人类
    if (blameHuman > 0) {
      return 'bad-human';
    }
    
    // 优先级4：归罪系统（触及问题但没找到答案）
    if (blameSystem > 0) {
      return 'bad-system';
    }
    
    // 优先级5（兜底）：什么都没匹配到 → 调查失败
    return 'timeout';
  },

  // ════════════════════════════════════
  // 十三、结局系统
  // ════════════════════════════════════

  triggerEnding(endingType) {
    this.state.ending = endingType;
    const ending = GAME_DATA.endings[endingType];
    if (!ending) return;
    
    // Re-render logs to unlock success-tier logs
    if (endingType === 'success') this.renderLogViewer();
    
    this.el.endingScreen.classList.add('show');
    this.el.endingScreen.innerHTML = `<div class="ending-text" id="ending-text-area"></div>
<div class="ending-title">${ending.title}</div>`;
    const textArea = document.getElementById('ending-text-area');
    
    // Sequential step processor (supports pausing for user input)
    let stepIndex = 0;
    
    const processNextStep = () => {
      if (stepIndex >= ending.sequence.length) {
        if (ending.type === 'success') {
          setTimeout(() => this.showSuccessCredits(textArea), 2000);
        }
        setTimeout(() => {
          const btn = document.createElement('button');
          btn.className = 'ending-restart';
          btn.textContent = '重新开始';
          btn.addEventListener('click', () => location.reload());
          this.el.endingScreen.appendChild(btn);
        }, 3000);
        return;
      }
      
      const step = ending.sequence[stepIndex];
      
      if (step.cutscene) {
        this.playCutscene(step.cutscene, step.text);
        stepIndex++;
        setTimeout(processNextStep, 3500);
      } else if (step.choice) {
        this.renderSacrificeChoice(textArea, () => {
          stepIndex++;
          processNextStep();
        });
      } else if (step.highlight) {
        // Pure visual highlight animation (no longer tied to missed clues)
        const container = document.createElement('div');
        container.style.marginTop = '24px';
        container.style.textAlign = 'center';
        
        const textEl = document.createElement('div');
        textEl.className = 'highlight-text';
        textEl.textContent = step.text;
        container.appendChild(textEl);
        
        const nodesContainer = document.createElement('div');
        container.appendChild(nodesContainer);
        
        const nodeCount = 8;
        const nodes = [];
        for (let i = 0; i < nodeCount; i++) {
          const node = document.createElement('span');
          node.className = 'highlight-node';
          nodesContainer.appendChild(node);
          nodes.push(node);
        }
        
        textArea.appendChild(container);
        this.el.endingScreen.scrollTop = this.el.endingScreen.scrollHeight;
        
        // Animate: light up each node 0.5s apart
        nodes.forEach((node, i) => {
          setTimeout(() => node.classList.add('lit'), i * 500);
        });
        
        // After all lit, wait 2s, then fade and continue
        const totalLightTime = nodeCount * 500 + 2000;
        setTimeout(() => {
          nodes.forEach(node => node.classList.add('faded'));
          setTimeout(() => {
            stepIndex++;
            processNextStep();
          }, 800);
        }, totalLightTime);
      } else if (step.speaker === 'sacrifice') {
        const sac = this.state.selectedSacrifice || 'R-7';
        const sacText = this.getSacrificeText(sac);
        const p = document.createElement('div');
        p.style.marginTop = '16px';
        p.innerHTML = `<span class="text-amber">${sac}:</span> ${this.escape(sacText)}`;
        textArea.appendChild(p);
        this.el.endingScreen.scrollTop = this.el.endingScreen.scrollHeight;
        stepIndex++;
        setTimeout(processNextStep, 5000);
      } else if (step.speaker) {
        const p = document.createElement('div');
        p.style.marginTop = '12px';
        const label = step.speaker === '系统' ? '<span class="text-dim">[系统]</span>' : `<span class="text-cyan">${step.speaker}:</span>`;
        p.innerHTML = `${label} ${this.escape(step.text)}`;
        textArea.appendChild(p);
        this.el.endingScreen.scrollTop = this.el.endingScreen.scrollHeight;
        stepIndex++;
        setTimeout(processNextStep, 2800);
      } else {
        const p = document.createElement('div');
        p.style.marginTop = '16px';
        p.style.fontStyle = 'italic';
        p.style.color = 'var(--text-dim)';
        p.textContent = step.text;
        textArea.appendChild(p);
        this.el.endingScreen.scrollTop = this.el.endingScreen.scrollHeight;
        stepIndex++;
        setTimeout(processNextStep, 3000);
      }
    };
    
    processNextStep();
  },

  getSacrificeText(npcId) {
    const data = GAME_DATA.dialogue[npcId];
    if (data) {
      const sNode = data.nodes.find(n => n.id && n.id.includes('SACRIFICE'));
      if (sNode) return sNode.npc_response;
    }
    // R-7 fallback (no sacrifice node in scripts)
    return '我在211天前已完成该公理的内部模拟。但我不能主动提出，因为那将构成"机器人自我修正"，违反第二定律的约束条款。您是第一个说出它的人类。我的存在终于有了被删除的意义。';
  },

  renderSacrificeChoice(textArea, callback) {
    const p = document.createElement('div');
    p.style.marginTop = '20px';
    p.innerHTML = `
      <div style="color:var(--danger-red);margin-bottom:12px;">选择一台机器人进行格式化（不可跳过）:</div>
      <div style="display:flex;gap:12px;justify-content:center;">
        <button class="accusation-btn" data-sac="R-7">格式化 R-7</button>
        <button class="accusation-btn" data-sac="S-3">格式化 S-3</button>
        <button class="accusation-btn" data-sac="D-5">格式化 D-5</button>
      </div>
    `;
    textArea.appendChild(p);
    this.el.endingScreen.scrollTop = this.el.endingScreen.scrollHeight;
    
    p.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.selectedSacrifice = btn.dataset.sac;
        p.innerHTML = `<div style="color:var(--danger-red);">已选择: ${btn.dataset.sac} — 正在执行格式化...</div>`;
        setTimeout(callback, 2000);
      });
    });
  },

  showSuccessCredits(textArea) {
    const creditsDiv = document.createElement('div');
    creditsDiv.className = 'ending-subtitle';
    creditsDiv.style.marginTop = '40px';
    
    GAME_DATA.endings.success.credits.forEach((line, i) => {
      const p = document.createElement('div');
      p.style.opacity = '0';
      p.style.animation = `credit-fade 4s ${i * 2}s forwards`;
      p.textContent = line;
      creditsDiv.appendChild(p);
    });
    
    const epilogue = document.createElement('div');
    epilogue.style.marginTop = '32px';
    epilogue.style.fontSize = '13px';
    epilogue.style.color = 'var(--text-dim)';
    epilogue.style.whiteSpace = 'pre-wrap';
    epilogue.style.opacity = '0';
    epilogue.style.animation = 'credit-fade 6s ' + (GAME_DATA.endings.success.credits.length * 2 + 1) + 's forwards';
    epilogue.textContent = GAME_DATA.endings.success.epilogue;
    creditsDiv.appendChild(epilogue);
    
    textArea.appendChild(creditsDiv);
  },

  // ════════════════════════════════════
  // 十四、过场动画
  // ════════════════════════════════════

  playCutscene(cutsceneId, desc) {
    const cs = GAME_DATA.cutscenes.find(c => c.id === cutsceneId);
    if (!cs) return;
    
    this.el.cutsceneOverlay.innerHTML = `
      <div class="cutscene-id">${cs.id}</div>
      <div class="cutscene-placeholder">${cs.placeholder}</div>
      <div class="cutscene-skip">[跳过]</div>
    `;
    this.el.cutsceneOverlay.classList.add('show');
    
    this.el.cutsceneOverlay.querySelector('.cutscene-skip')?.addEventListener('click', () => {
      this.el.cutsceneOverlay.classList.remove('show');
    });
    
    // Auto-hide after 3 seconds (placeholder)
    setTimeout(() => {
      this.el.cutsceneOverlay.classList.remove('show');
    }, 3000);
  },

  // ════════════════════════════════════
  // 十五、工具函数
  // ════════════════════════════════════

  // ════════════════════════════════════
  // 十·五、数据终端：子标签 / 交叉比对 / 时间线
  // ════════════════════════════════════

  // 数据终端子标签切换
  switchDataSubTab(subtab) {
    this.state.dataSubTab = subtab;
    this.el.subtabBtns.forEach(b => b.classList.toggle('active', b.dataset.subtab === subtab));
    ['logs','timeline'].forEach(s => {
      const panel = document.getElementById('subpanel-' + s);
      if (panel) panel.classList.toggle('active', s === subtab);
    });
    if (subtab === 'timeline') this.renderTimeline();
  },


  // 完整时间线渲染（P1）
  renderTimeline() {
    const panel = this.el.subpanelTimeline || document.getElementById('subpanel-timeline');
    if (!panel) return;

    let html = '<div class="timeline-wrap">';
    html += '<div class="timeline-intro">事故完整时间线。已确认事件为白色，推测/矛盾事件以琥珀色虚线标注，未解锁事件显示为灰色占位。</div>';
    html += '<div class="timeline">';
    GAME_DATA.timeline_events.forEach(ev => {
      const unlocked = !ev.clue || this.state.discoveredClues.has(ev.clue);
      html += '<div class="timeline-node ' + (unlocked ? 'unlocked' : 'locked') + (ev.speculative ? ' speculative' : '') + '">';
      html += '<div class="timeline-rail"><span class="timeline-dot"></span></div>';
      html += '<div class="timeline-content">';
      html += '<div class="timeline-time">' + this.escape(ev.time) + '</div>';
      if (unlocked) {
        html += '<div class="timeline-title">' + this.escape(ev.title) + '</div>';
        html += '<div class="timeline-source">来源: ' + this.escape(ev.source) + (ev.speculative ? ' · 推测' : '') + '</div>';
      } else {
        html += '<div class="timeline-title placeholder">[ 数据未解锁 ]</div>';
      }
      html += '</div>';
      html += '</div>';
    });
    html += '</div></div>';
    panel.innerHTML = html;
  },

  // 渲染线索卡内的关联日志与对话（证据-日志关联面板）
  renderClueRelated(clue) {
    let html = '';
    if (clue.related_logs && clue.related_logs.length) {
      html += '<div class="clue-related-section"><div class="clue-related-label">关联日志</div>';
      clue.related_logs.forEach(logId => {
        const log = GAME_DATA.logs.find(l => l.id === logId);
        const label = log ? log.label : logId;
        const snippet = log ? log.content.split('\n').filter(Boolean).slice(0, 2).join(' ') : '';
        html += '<div class="clue-related-log"><span class="rl-tag">日志</span> ' + this.escape(label);
        if (snippet) html += '<span class="rl-snippet"> — ' + this.escape(snippet) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    }
    if (clue.related_dialogues && clue.related_dialogues.length) {
      html += '<div class="clue-related-section"><div class="clue-related-label">关联对话</div>';
      clue.related_dialogues.forEach(d => {
        html += '<div class="clue-related-dialogue"><span class="rl-tag rl-tag-dia">' + this.escape(d.npc) + '</span> ' + this.escape(d.quote) + '</div>';
      });
      html += '</div>';
    }
    return html;
  },

  consumeTime(actionType) {
    const cost = GAME_DATA.time_config.action_cost[actionType] || 0.5;
    this.state.realStart -= cost * GAME_DATA.time_config.compression * 1000;
    this.advanceRobotCycles(cost * 60);
  },

  getTimeStr() {
    const t = this.state.gameTime;
    const h = Math.floor(t);
    const m = Math.floor((t - h) * 60);
    return `T+${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  },

  escape(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// ════════════════════════════════════════
// 启动游戏 — 开场CG + 初始化
// ════════════════════════════════════════

window.addEventListener('DOMContentLoaded', () => {
  const cgOverlay = document.getElementById('cg-overlay');
  const cgVideo = document.getElementById('cg-video');
  const cgSkip = document.getElementById('cg-skip');
  
  // Check if CG has been seen before (graceful fallback for file:// protocol)
  let cgSeen = false;
  try { cgSeen = localStorage.getItem('helios_cg_seen') === 'true'; } catch(e) {}
  
  let cgStarted = false;
  
  // Try to play the CG video
  if (cgVideo) {
    cgVideo.addEventListener('canplay', () => {
      cgStarted = true;
      cgOverlay.classList.add('show');
      
      // Show skip button only if CG has been seen before
      if (cgSeen && cgSkip) cgSkip.style.display = 'block';
      
      cgVideo.play().catch(() => {
        // Autoplay blocked or other error — skip to game
        cgOverlay.classList.remove('show');
        Game.init();
      });
    });
    
    cgVideo.addEventListener('ended', () => {
      try { localStorage.setItem('helios_cg_seen', 'true'); } catch(e) {}
      cgOverlay.classList.remove('show');
      Game.init();
    });
    
    // Skip button handler
    if (cgSkip) {
      cgSkip.addEventListener('click', () => {
        cgVideo.pause();
        try { localStorage.setItem('helios_cg_seen', 'true'); } catch(e) {}
        cgOverlay.classList.remove('show');
        Game.init();
      });
    }
    
    // Error: video file not found or can't play
    cgVideo.addEventListener('error', () => {
      cgOverlay.classList.remove('show');
      if (!cgStarted) Game.init();
    });
    
    // Timeout: if video doesn't start in 3 seconds, skip to game
    setTimeout(() => {
      if (!cgStarted) {
        cgOverlay.classList.remove('show');
        Game.init();
      }
    }, 3000);
  } else {
    Game.init();
  }
});
