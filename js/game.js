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
    currentLocation: 'corridor',
    currentNPC: null,
    conversations: {},     // { npcId: [{role, text}] }
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
    sharedAgentContext: null, // Agent 共享记忆（P2）
    noSingleBlameInsight: false, // 玩家是否意识到"没有谁负主要责任"
    canAdvanceToPhase3: false,  // 指控已回应 / 选择不指控 → true，可休息推进
    accusedNPCs: new Set(),     // 已正式指控的 NPC 集合
    accusationUnlocked: false,  // 线索 ≥ 10 条 → true，解锁指控
    noAccusationUnlocked: false, // 线索 ≥ 20 条 → true，解锁不指控
    _p1RestNotified: false,     // Phase 1 休息提醒已弹窗过
  },

  el: {},  // DOM element cache

  // ════════════════════════════════════
  // 二、初始化
  // ════════════════════════════════════

  init() {
    this.cacheElements();
    this.bindEvents();
    this.initConversations();
    this.renderLocations();
    this.renderNPCList();
    this.renderTerminalHeader(null);
    this.renderEvidenceBoard();
    this.renderLogViewer();
    this.renderTimeline();
    this.renderLocationView();
    this.updatePhaseDisplay();
    this.showPhaseTransition(1);
    this.el.dialogueArea.innerHTML = '<div class="msg system"><div class="msg-text">欢迎来到赫利俄斯站调查终端。<br>事故已发生。首席工程师重伤昏迷。<br>三台机器人在场。没有人承认过错。<br><br>从左侧选择地点移动，找到机器人开始你的调查。</div></div>';    this.checkApiKey();
    this.setupExitGuard();
    // 启动 4 秒后静默检查更新（仅原生 App）
    setTimeout(() => this.checkForUpdates(false), 4000);
    console.log('[HELIOS] Game initialized.');
  },

  // ════════════════════════════════════
  // 二·六、在线更新（@capgo/capacitor-updater + GitHub Release）
  // ════════════════════════════════════

  // 更新清单固定地址（仓库 master 分支的 update/version.json，raw 直链）
  UPDATE_MANIFEST_URL: 'https://raw.githubusercontent.com/chemmy-11/helios/master/update/version.json',

  // 检查更新：manual=false 为启动静默检查，manual=true 为玩家主动触发
  async checkForUpdates(manual) {
    // 仅原生 App（Capacitor）环境启用；浏览器版直接跳过
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;
    try {
      const resp = await fetch(this.UPDATE_MANIFEST_URL, { cache: 'no-store' });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const manifest = await resp.json();
      const local = typeof APP_VERSION !== 'undefined' ? APP_VERSION : '0.0.0';
      if (manifest.version && manifest.version !== local) {
        this.state.updateManifest = manifest;
        this.showPhasePrompt('updateAvailable');
      } else if (manual) {
        this.addDirectMessage('当前已是最新版本（v' + local + '）。');
      }
    } catch (e) {
      console.error('[HELIOS] 更新检查失败:', e);
      if (manual) this.addDirectMessage('更新检查失败：无法连接更新服务器。');
    }
  },

  // 下载并应用更新包
  async applyUpdate(manifest) {
    const Updater = window.Capacitor?.Plugins?.CapacitorUpdater;
    if (!Updater) return;
    try {
      this.addDirectMessage('正在下载更新包...');
      const bundle = await Updater.download({ url: manifest.url });
      await Updater.set({ id: bundle.id });
      this.showPhasePrompt('updateDone');
    } catch (e) {
      console.error('[HELIOS] 更新下载失败:', e);
      this.addDirectMessage('更新下载失败：' + (e.message || '未知错误') + '。请稍后重试。');
    }
  },

  // 游戏是否已有实质进度（用于退出提醒）
  hasProgress() {
    if (this.state.discoveredClues.size > 0) return true;
    for (const id in this.state.conversations) {
      if (this.state.conversations[id].length > 0) return true;
    }
    return false;
  },

  // 退出提醒：Android 返回键（Capacitor）+ 浏览器关闭/刷新（beforeunload）双通道
  setupExitGuard() {
    const AppPlugin = window.Capacitor?.Plugins?.App;
    if (AppPlugin) {
      AppPlugin.addListener('backButton', () => {
        // 存档面板打开时，返回键优先关闭面板
        if (this.el.savePanelOverlay && this.el.savePanelOverlay.classList.contains('show')) {
          this.hideSavePanel();
          return;
        }
        if (this.hasProgress() && !this.state.ending) {
          this.showPhasePrompt('exitConfirm');
        } else {
          AppPlugin.exitApp();
        }
      }).catch(e => console.error('[HELIOS] backButton 监听失败:', e));
    }
    window.addEventListener('beforeunload', (e) => {
      if (this.hasProgress() && !this.state.ending) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  },

  checkApiKey() {
    const savedKey = localStorage.getItem('deepseek_api_key');
    if (!savedKey) {
      // Show modal if no API Key saved
      if (this.el.apiKeyModal) {
        this.el.apiKeyModal.classList.remove('hidden');
        // Auto-focus input
        setTimeout(() => {
          if (this.el.apiKeyModalInput) {
            this.el.apiKeyModalInput.focus();
          }
        }, 100);
      }
    } else {
      // Hide modal and sync sidebar input
      if (this.el.apiKeyModal) {
        this.el.apiKeyModal.classList.add('hidden');
      }
      if (this.el.apiKeyInput) {
        this.el.apiKeyInput.value = savedKey;
      }
    }
  },

  handleApiKeySubmit() {
    const key = this.el.apiKeyModalInput.value.trim();
    if (key && key !== 'sk-...') {
      localStorage.setItem('deepseek_api_key', key);
      if (this.el.apiKeyInput) {
        this.el.apiKeyInput.value = key;
      }
      if (this.el.apiKeyModal) {
        this.el.apiKeyModal.classList.add('hidden');
      }
    } else {
      alert('请输入有效的 API Key');
    }
  },

  handleApiKeySkip() {
    if (this.el.apiKeyModal) {
      this.el.apiKeyModal.classList.add('hidden');
    }
  },

  cacheElements() {
    this.el.countdownPhase = document.getElementById('countdown-phase');
    this.el.phaseLabel = document.getElementById('phase-label');
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
    // Phase prompt modal
    this.el.phasePromptOverlay = document.getElementById('phase-prompt-overlay');
    this.el.phasePromptIcon = document.getElementById('phase-prompt-icon');
    this.el.phasePromptTitle = document.getElementById('phase-prompt-title');
    this.el.phasePromptBody = document.getElementById('phase-prompt-body');
    this.el.phasePromptActions = document.getElementById('phase-prompt-actions');
    this.el.phasePromptHint = document.getElementById('phase-prompt-hint');
    // Save system
    this.el.saveBtn = document.getElementById('save-btn');
    this.el.savePanelOverlay = document.getElementById('save-panel-overlay');
    this.el.saveSlots = document.getElementById('save-slots');
    this.el.savePanelClose = document.getElementById('save-panel-close');
    // Update check button
    this.el.updateBtn = document.getElementById('update-btn');
    this.el.apiKeyInput = document.getElementById('api-key-input');
    this.el.apiKeyModal = document.getElementById('api-key-modal');
    this.el.apiKeyModalInput = document.getElementById('api-key-modal-input');
    this.el.apiKeyModalSubmit = document.getElementById('api-key-modal-submit');
    this.el.apiKeyModalSkip = document.getElementById('api-key-modal-skip');
    // Mobile elements
    this.el.hamburgerBtn = document.getElementById('hamburger-btn');
    this.el.drawerOverlay = document.getElementById('drawer-overlay');
    this.el.bottomNav = document.getElementById('mobile-bottom-nav');
    this.el.mobileCountdown = document.getElementById('mobile-countdown');
    this.el.drawerNavLinks = null;
    this.el.bottomNavItems = document.querySelectorAll('#mobile-bottom-nav .bottom-nav-item');
  },

  bindEvents() {
    // API Key input - save to localStorage
    if (this.el.apiKeyInput) {
      const savedKey = localStorage.getItem('deepseek_api_key');
      if (savedKey) {
        this.el.apiKeyInput.value = savedKey;
      }
      
      this.el.apiKeyInput.addEventListener('change', (e) => {
        const key = e.target.value.trim();
        if (key && key !== 'sk-...') {
          localStorage.setItem('deepseek_api_key', key);
        } else {
          localStorage.removeItem('deepseek_api_key');
        }
      });
    }

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
      // Track IME composition state (critical for Chinese/Japanese/Korean input on mobile)
      this.state.reportComposing = false;
      
      this.el.reportEditor.addEventListener('compositionstart', () => {
        this.state.reportComposing = true;
      });
      
      this.el.reportEditor.addEventListener('compositionend', (e) => {
        this.state.reportComposing = false;
        this.state.reportDraft = e.target.value;
        if (this.el.reportCount) {
          this.el.reportCount.textContent = e.target.value.length + ' 字';
        }
      });
      
      this.el.reportEditor.addEventListener('input', (e) => {
        // Skip update during IME composition
        if (this.state.reportComposing) return;
        this.state.reportDraft = e.target.value;
        if (this.el.reportCount) {
          this.el.reportCount.textContent = e.target.value.length + ' 字';
        }
      });
      
      // Fallback: also listen to 'change' event (fires on blur/enter)
      this.el.reportEditor.addEventListener('change', (e) => {
        this.state.reportDraft = e.target.value;
        if (this.el.reportCount) {
          this.el.reportCount.textContent = e.target.value.length + ' 字';
        }
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

    // API Key modal
    if (this.el.apiKeyModalSubmit) {
      this.el.apiKeyModalSubmit.addEventListener('click', () => this.handleApiKeySubmit());
    }
    if (this.el.apiKeyModalSkip) {
      this.el.apiKeyModalSkip.addEventListener('click', () => this.handleApiKeySkip());
    }

    // Save system
    if (this.el.saveBtn) {
      this.el.saveBtn.addEventListener('click', () => this.toggleSavePanel());
    }
    if (this.el.savePanelOverlay) {
      this.el.savePanelOverlay.addEventListener('click', (e) => {
        if (e.target === this.el.savePanelOverlay) this.hideSavePanel();
      });
    }
    if (this.el.savePanelClose) {
      this.el.savePanelClose.addEventListener('click', () => this.hideSavePanel());
    }

    // Update check
    if (this.el.updateBtn) {
      this.el.updateBtn.addEventListener('click', () => this.checkForUpdates(true));
    }

    if (this.el.apiKeyModalInput) {
      this.el.apiKeyModalInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleApiKeySubmit();
        }
      });
    }

    // Mobile: hamburger drawer toggle
    if (this.el.hamburgerBtn) {
      this.el.hamburgerBtn.addEventListener('click', () => {
        document.body.classList.toggle('drawer-open');
        if (this.el.drawerOverlay) {
          this.el.drawerOverlay.classList.toggle('show');
        }
      });
    }

    // Mobile: drawer overlay click to close
    if (this.el.drawerOverlay) {
      this.el.drawerOverlay.addEventListener('click', () => {
        document.body.classList.remove('drawer-open');
        this.el.drawerOverlay.classList.remove('show');
      });
    }

    // Mobile: bottom nav view switching
    if (this.el.bottomNavItems) {
      this.el.bottomNavItems.forEach(item => {
        item.addEventListener('click', () => {
          if (item.classList.contains('locked')) return;
          this.switchView(item.dataset.view);
        });
      });
    }

  },

  initConversations() {
    for (const npcId in GAME_DATA.dialogue) {
      this.state.conversations[npcId] = [];
    }
  },

  // ════════════════════════════════════
  // 二·五、地点移动系统
  // ════════════════════════════════════

  moveToLocation(locId) {
    this.state.currentLocation = locId;
    this.state.currentNPC = null;
    this.renderLocations();
    this.renderLocationView();
    this.renderNPCList();
    this.renderTerminalHeader(null);
    // 移动端：选择地点后自动关闭抽屉
    document.body.classList.remove('drawer-open');
    if (this.el.drawerOverlay) {
      this.el.drawerOverlay.classList.remove('show');
    }
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
    const connections = GAME_DATA.location_connections[locId] || [];

    let html = '<div class="location-view">';
    html += `<div class="location-header"><span class="location-icon">${loc.icon}</span><span class="location-name">${loc.name}</span></div>`;
    html += '<div class="location-divider">═══════════════════════════════════</div>';
    html += `<div class="location-desc">${desc}</div>`;

    // 机器人固定位置在场显示（robot_locations 替代原巡逻）
    const robotsHere = [];
    for (const [npcId, rl] of Object.entries(GAME_DATA.robot_locations || {})) {
      if (rl.location === locId) robotsHere.push({ npcId, action: rl.action });
    }
    if (robotsHere.length > 0) {
      html += '<div class="location-robots">';
      robotsHere.forEach(r => {
        const data = GAME_DATA.dialogue[r.npcId];
        if (data) {
          html += `<div class="location-robot-item"><span class="robot-presence">[ ${data.npc} 正在这里，${r.action} ]</span></div>`;
        }
      });
      html += '</div>';
    }

    if (locId === 'engineering') {
      html += '<div class="location-robot-item"><span class="robot-presence">[ 陈远正坐在工位前，假装在忙碌 ]</span></div>';
    } else if (robotsHere.length === 0) {
      html += '<div class="location-empty">[ 这里没有其他人 ]</div>';
    }

    html += '<div class="location-actions">';

    const talkableNPCs = [];
    if (locId === 'engineering') talkableNPCs.push('副工程师');
    robotsHere.forEach(r => talkableNPCs.push(r.npcId));

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
        // Phase 1 首次满足条件时弹窗轻量提醒
        if (this.state.phase === 1 && !this.state._p1RestNotified) {
          this.state._p1RestNotified = true;
          setTimeout(() => {
            this.showPhasePrompt('p1RestReady');
          }, 400);
        }
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
    }
  },

  // ════════════════════════════════════
  // 三、阶段信息显示
  // ════════════════════════════════════

  updatePhaseDisplay() {
    const phases = {
      1: { label: 'INVESTIGATION', name: '调查阶段', text: '调查阶段 —— 寻访 NPC，收集证词' },
      2: { label: 'CROSS-VALIDATION', name: '交叉验证', text: '交叉验证阶段 —— 收集证据，准备指控' },
      3: { label: 'FINAL REPORT', name: '最终裁决', text: '最终裁决阶段 —— 提交你的调查报告' }
    };
    const info = phases[this.state.phase];
    if (!info) return;
    if (this.el.phaseLabel) this.el.phaseLabel.textContent = info.label;
    if (this.el.countdownPhase) this.el.countdownPhase.textContent = info.text;
    if (this.el.mobileCountdown) this.el.mobileCountdown.textContent = info.name;
  },

  // ════════════════════════════════════
  // 四、导演逻辑 — 阶段转换（内容驱动，无时间条件）
  // ════════════════════════════════════

  transitionToPhase(newPhase) {
    // 防止重复转换到同一阶段
    if (this.state.phase === newPhase) {
      return;
    }
    this.state.phase = newPhase;
    this.updatePhaseDisplay();
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
      this.renderLogViewer(); // Re-render to unlock phase3 logs
      this.addDirectMessage('最终报告提交窗口已开放。当你做好准备，即可提交你的调查报告。');
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
    // Desktop tabs
    const btn = document.querySelector(`.tab-btn[data-view="${viewName}"]`);
    if (btn) btn.classList.remove('locked');
    
    // Mobile bottom nav
    const bottomNavItem = document.querySelector(`.bottom-nav-item[data-view="${viewName}"]`);
    if (bottomNavItem) bottomNavItem.classList.remove('locked');
  },

  // ════════════════════════════════════
  // 五、视图切换
  // ════════════════════════════════════

  switchView(viewName) {
    // Desktop tabs
    this.el.tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab-btn[data-view="${viewName}"]`)?.classList.add('active');
    this.el.views.forEach(v => v.classList.remove('active'));
    document.getElementById('v-' + viewName)?.classList.add('active');
    
    // Mobile bottom nav
    if (this.el.bottomNavItems) {
      this.el.bottomNavItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.view === viewName) {
          item.classList.add('active');
        }
      });
    }
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
      // Phase 2 → 3: 指控已回应或选择不指控
      return this.state.canAdvanceToPhase3;
    }
    return false;
  },

  // Rest: jump game time to next phase trigger
  restToNextPhase() {
    const narratives = [
      '你在住舱里躺了一会儿，整理了一下手头的线索。窗外暗红色的星球缓缓转动。你闭上了眼。',
      '你坐在书桌前，把所有线索排列了一遍。某种模糊的轮廓正在浮现。你决定休息一下。',
      '在这个站上，连睡眠都是一种等待。你躺下，盯着天花板。'
    ];
    const narrative = narratives[Math.floor(Math.random() * narratives.length)];
    
    this.el.dialogueArea.innerHTML = `<div class="msg system"><div class="msg-text" style="font-style:italic;line-height:2;">${narrative}</div></div>`;
    
    const nextPhase = this.state.phase + 1;
    setTimeout(() => this.transitionToPhase(nextPhase), 2000);
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

    // 显示所有可对话 NPC，不再受地点限制
    const allNPCs = ['R-7', 'S-3', 'D-5', '副工程师'];

    allNPCs.forEach(npcId => {
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
    // 移动端：选中对话对象后自动关闭抽屉
    document.body.classList.remove('drawer-open');
    if (this.el.drawerOverlay) {
      this.el.drawerOverlay.classList.remove('show');
    }
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
      this.addNPCMessage(npcId, `[${data.npc}已上线。等待你的提问。]`, true);
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
    
    // Phase 2+: 指控区（10 条解锁指控 / 20 条解锁不指控 / 已指控消失）
    if (this.state.phase >= 2) {
      if (this.state.accusedNPCs.has(npcId)) {
        html += `<div class="typing-encouragement" style="color:var(--visited-green);">你已正式指控过${data.npc}。可切换其他对话对象继续指控。</div>`;
      } else if (!this.state.accusationUnlocked) {
        html += `<button class="dialogue-option" disabled style="border-color:var(--text-dim);color:var(--text-dim);opacity:0.5;">[指控] 需要更多证据（已发现 ${this.state.discoveredClues.size}/10）</button>`;
      } else {
        html += `<button class="dialogue-option" data-accuse="${npcId}" style="border-color:var(--danger-red);color:var(--danger-red);">[指控] 正式指控${data.npc}</button>`;
      }
      if (!this.state.canAdvanceToPhase3) {
        if (this.state.noAccusationUnlocked) {
          html += `<button class="dialogue-option" data-noaccuse="1" style="border-color:var(--text-dim);color:var(--text-dim);">[不指控] 不指控任何人 —— 问题或许不在个体</button>`;
        } else {
          html += `<button class="dialogue-option" disabled style="border-color:var(--text-dim);color:var(--text-dim);opacity:0.5;">[不指控] 需要更多证据（已发现 ${this.state.discoveredClues.size}/20）</button>`;
        }
      }
    }
    
    // Encourage typing
    const npcName = data.npc;
    html += `<div class="typing-encouragement">直接打字问${npcName}任何事--你的任何问题都会得到回应。</div>`;
    
    opts.innerHTML = html;
    
    // Bind buttons
    opts.querySelectorAll('.dialogue-option').forEach(btn => {
      if (btn.dataset.accuse) {
        btn.addEventListener('click', () => this.initiateAccusation(btn.dataset.accuse));
      } else if (btn.dataset.noaccuse) {
        btn.addEventListener('click', () => this.initiateNoAccusation());
      }
    });
  },

  handlePlayerInput() {
    const input = this.el.playerInput;
    const text = input.innerText.trim();
    if (!text) return;
    
    const npcId = this.state.currentNPC;
    if (!npcId) {
      this.addDirectMessage('请先选择一个对话对象。');
      return;
    }
    
    input.innerHTML = '';
    input.scrollTop = 0;
    
    // Show player message
    this.appendPlayerMessage(text);
    this.state.conversations[npcId].push({ role: 'player', text: text });
    
    // 纯 LLM 路径：所有对话直接走大模型
    this.handleLLMDialgue(text, npcId);
  },

  // 纯 LLM Agent 对话
  async handleLLMDialgue(text, npcId) {
    const data = GAME_DATA.dialogue[npcId];
    this.showTypingIndicator(npcId);

    try {
      const promptWithContext = this.injectSharedContext(data.agent_prompt, npcId);
      const response = await this.callLLM(promptWithContext, npcId, text);
      this.removeTypingIndicator();
      this.appendNPCMessage(npcId, response);
      this.state.conversations[npcId].push({ role: 'npc', text: response });
    } catch (e) {
      this.removeTypingIndicator();
      console.error('[HELIOS] LLM call failed:', e);
      const fallback = '...[通讯干扰，请稍后重试]...';
      this.appendNPCMessage(npcId, fallback);
      this.state.conversations[npcId].push({ role: 'npc', text: fallback, isSystem: true });
    }
    this.checkKeywordClues(text);
    this.checkPhase3Trigger(text);
    this.updateSharedContext(npcId, text);
    this.renderDialogueOptions();
    this.renderLocations();
  },

  checkPhase3Trigger(text) {
    if (this.state.phase !== 2) return;
    
    const phase3Keywords = [
      '修改守则', '修改定律', '修改三定律', '修改规则',
      '第零法则', '第零定律', '零号法则', '零号定律',
      '超越第一定律', '高于第一定律', '优先级更高',
      '人类整体利益', '整体利益', '大局观',
      '修改伦理框架', '修改伦理约束',
      '新的法则', '新的定律', '更高的法则', '更高的定律'
    ];
    
    const lowerText = text.toLowerCase();
    const triggered = phase3Keywords.some(keyword => lowerText.includes(keyword));
    
    if (triggered && !this.state.zeroLawTriggered) {
      this.state.zeroLawTriggered = true;
      // 触及核心洞察即可通过休息推进（弹窗提示与休息按钮保持一致）
      this.state.canAdvanceToPhase3 = true;
      console.log('[HELIOS] Phase 3 insight by keyword:', text);
      this.showPhasePrompt('zerothLaw');
    }
  },

  // ════════════════════════════════════
  // Agent 共享记忆系统（P2 - brief-07）
  // ════════════════════════════════════

  injectSharedContext(basePrompt, npcId) {
    const ctx = this.state.sharedAgentContext || GAME_DATA.shared_agent_context;
    if (!ctx) return basePrompt;

    // 注入当前阶段信息
    const phaseNames = {
      1: '第一阶段（调查阶段）',
      2: '第二阶段（交叉验证阶段）',
      3: '第三阶段（最终裁决阶段）'
    };
    const currentPhaseName = phaseNames[this.state.phase] || '未知阶段';
    
    let sharedText = `\n\n## 当前游戏阶段\n\n当前处于${currentPhaseName}。请严格遵守你的【阶段限制规则】。\n`;

    sharedText += '\n## 共享情报（运行时注入）\n\n';
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
      summary: playerText.slice(0, 50)
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

  async callLLM(systemPrompt, npcId, userMessage) {
    const cfg = GAME_DATA.llm_config;
    // 优先从 localStorage 读取 API Key，其次使用 data.js 中的配置
    const apiKey = localStorage.getItem('deepseek_api_key') || cfg.api_key;
    if (!apiKey || apiKey === 'YOUR_DEEPSEEK_API_KEY_HERE') {
      throw new Error('No API Key configured');
    }

    // Build conversation history for context
    const history = this.state.conversations[npcId] || [];
    const messages = [{ role: 'system', content: systemPrompt }];

    // Include last 10 conversation turns for context
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      if (msg.role === 'player') {
        messages.push({ role: 'user', content: msg.text });
      } else if (msg.role === 'npc') {
        messages.push({ role: 'assistant', content: msg.text });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: userMessage });

    console.log(`[HELIOS] Calling LLM for ${npcId}, messages:`, messages.length);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const resp = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: messages,
          temperature: cfg.temperature,
          max_tokens: cfg.max_tokens
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      console.log(`[HELIOS] LLM response status:`, resp.status);

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error(`[HELIOS] LLM API error ${resp.status}:`, errorText);
        throw new Error(`LLM response error: ${resp.status} - ${errorText}`);
      }
      
      const data = await resp.json();
      console.log(`[HELIOS] LLM response:`, data);
      
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        console.warn('[HELIOS] LLM response missing content:', data);
        return '...';
      }
      return content;
    } catch (e) {
      clearTimeout(timeout);
      console.error(`[HELIOS] LLM call failed for ${npcId}:`, e);
      throw e;
    }
  },

  // ════════════════════════════════════
  // 八、消息渲染
  // ════════════════════════════════════

  appendPlayerMessage(text) {
    const area = this.el.dialogueArea;
    const div = document.createElement('div');
    div.className = 'msg player';
    div.innerHTML = `<div class="msg-text">${this.escape(text)}</div>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  appendNPCMessage(npcId, text, isSystem) {
    const area = this.el.dialogueArea;
    const data = GAME_DATA.dialogue[npcId];
    const div = document.createElement('div');
    div.className = 'msg npc';
    const speaker = data ? data.npc : npcId;
    div.innerHTML = `<div class="msg-text"><span style="color:${data?.color || '#c8d6e5'}">${speaker}:</span> ${this.escape(text)}</div>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  addNPCMessage(npcId, text, isSystem) {
    this.appendNPCMessage(npcId, text, isSystem);
    this.state.conversations[npcId] = this.state.conversations[npcId] || [];
    this.state.conversations[npcId].push({ role: 'npc', text: text, isSystem: !!isSystem });
  },

  // 事件性系统消息：只渲染到当前对话区，不推入对话历史（切换 NPC 后不重放）
  addDirectMessage(text) {
    const area = this.el.dialogueArea;
    if (!area) return;
    const div = document.createElement('div');
    div.className = 'msg system';
    div.innerHTML = `<div class="msg-text">${this.escape(text)}</div>`;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  // 历史重放用：渲染历史中的 system 消息（旧存档兼容）
  appendSystemMessage(text) {
    this.addDirectMessage(text);
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
    
    // 10 条：解锁指控；20 条：解锁不指控
    if (!this.state.accusationUnlocked && this.state.discoveredClues.size >= 10) {
      this.state.accusationUnlocked = true;
      this.addDirectMessage('📋 你已收集到足够的证据（10 条）。指控功能已解锁——当你准备好时，可以正式发起指控。');
    }
    if (!this.state.noAccusationUnlocked && this.state.discoveredClues.size >= 20) {
      this.state.noAccusationUnlocked = true;
      this.addDirectMessage('📋 证据已足够深入（20 条）。你也可以选择不指控任何人——问题或许不在个体。');
    }
    
    this.addDirectMessage(`[线索发现] ${clue.name} — ${clue.content}`);
    this.renderEvidenceBoard();
    this.renderTimeline();
  },

  // Check player's free-text input for keyword clues (soft track clue unlock)
  checkKeywordClues(text) {
    if (!GAME_DATA.keyword_clue_map) return;
    const lowerText = text.toLowerCase();
    
    // Check for "no single blame" insight (can trigger phase transition)
    if (this.state.phase === 1 && !this.state.noSingleBlameInsight) {
      const noBlameKeywords = ['没有谁', '没人', '不怪', '不是谁的错', '都有责任', '都有错', '共同责任', '系统问题', '框架问题', '定律问题', '三定律矛盾', '定律漏洞', '不是任何一个人', '不是某个人', '每个人都有份'];
      if (noBlameKeywords.some(kw => lowerText.includes(kw))) {
        this.state.noSingleBlameInsight = true;
        this.addDirectMessage('[洞察] 你意识到这可能不是某一个人的错——也许是规则本身出了问题。这个想法值得深入。');
      }
    }
    
    GAME_DATA.keyword_clue_map.forEach(entry => {
      const matched = entry.keywords.some(kw => lowerText.includes(kw.toLowerCase()));
      if (matched && entry.clue) {
        // Check phase requirement
        if (entry.phase && this.state.phase < entry.phase) {
          return;
        }
        // Check prerequisites
        if (entry.prerequisites && entry.minPrerequisites) {
          const discoveredCount = entry.prerequisites.filter(clueId => 
            this.state.discoveredClues.has(clueId)
          ).length;
          if (discoveredCount < entry.minPrerequisites) {
            return;
          }
        }
        this.discoverClue(entry.clue);
      }
    });
  },

  // 解锁所有证据和时间线（用于复盘阶段）
  unlockAllEvidence() {
    const debugInfo = [];
    debugInfo.push('🔍 开始解锁所有证据...');
    debugInfo.push('📋 evidenceBoard: ' + (this.el.evidenceBoard ? '✅ 存在' : '❌ null'));
    debugInfo.push('📋 subpanelTimeline: ' + (this.el.subpanelTimeline ? '✅ 存在' : '❌ null'));
    
    // 1. 将所有线索标记为已发现
    GAME_DATA.clues.forEach(clue => {
      if (!this.state.discoveredClues.has(clue.id)) {
        this.state.discoveredClues.add(clue.id);
        clue.discovered = true;
      }
    });
    debugInfo.push('🔓 已解锁线索数: ' + this.state.discoveredClues.size);
    
    // 2. 重新渲染证据板
    debugInfo.push('🎨 渲染证据板...');
    this.renderEvidenceBoard();
    
    // 3. 重新渲染时间线
    debugInfo.push('🎨 渲染时间线...');
    this.renderTimeline();
    
    // 4. 重新渲染日志查看器（解锁所有日志）
    debugInfo.push('🎨 渲染日志查看器...');
    this.renderLogViewer();
    
    debugInfo.push('✅ 解锁完成！');
    
    // 在页面上显示调试信息
    this.addDirectMessage('[复盘模式] ' + debugInfo.join(' | '));
    
    // 同时输出到控制台
    debugInfo.forEach(msg => console.log('[DEBUG] ' + msg));
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

    // Bind clue card toggle buttons
    board.querySelectorAll('.clue-related-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation(); // 防止事件冒泡到 card
        const card = toggle.closest('.clue-card');
        const wasExpanded = card.classList.contains('expanded');
        card.classList.toggle('expanded');
        const related = card.querySelector('.clue-related');
        if (related) related.style.display = wasExpanded ? 'none' : 'block';
        toggle.textContent = wasExpanded ? '▸ 查看关联证据' : '▾ 收起关联证据';
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
    // 复盘模式：good 或 success 结局都解锁所有日志
    const isReviewMode = this.state.ending === 'success' || this.state.ending === 'good';
    
    GAME_DATA.logs.forEach(log => {
      const isLocked = (log.access === 'phase2' && this.state.phase < 2) || (log.access === 'phase3' && this.state.phase < 3) || (log.access === 'success' && !isReviewMode);
      const lockLabel = log.access === 'phase2' ? '阶段二解锁' : (log.access === 'phase3' ? '阶段三解锁' : (log.access === 'success' ? '结局解锁' : ''));
      
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
    
    // Bind log entry expand/collapse buttons
    viewer.querySelectorAll('.log-entry-card:not(.locked)').forEach(card => {
      const expandBtn = document.createElement('button');
      expandBtn.className = 'log-expand-btn';
      expandBtn.textContent = '展开';
      expandBtn.style.cssText = 'margin-top: 8px; padding: 4px 12px; background: rgba(78, 205, 196, 0.2); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); cursor: pointer; font-size: 12px; border-radius: 2px;';
      
      expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const body = card.querySelector('.log-entry-body');
        if (body) {
          const isExpanded = body.style.display === 'block';
          body.style.display = isExpanded ? 'none' : 'block';
          expandBtn.textContent = isExpanded ? '展开' : '收起';
          
          // Unlock clue on first view
          if (!isExpanded) {
            const logId = card.dataset.logId;
            const log = GAME_DATA.logs.find(l => l.id === logId);
            if (log && log.clue_unlock) {
              this.discoverClue(log.clue_unlock);
            }
          }
        }
      });
      
      card.appendChild(expandBtn);
    });
  },

  // ════════════════════════════════════
  // 十一、交叉验证引擎
  // ════════════════════════════════════

  initiateAccusation(npcId) {
    this.state.accusationCount++;
    this.state.accusedNPCs.add(npcId);
    this.renderDialogueOptions();

    this.addDirectMessage(`[正式指控] 你指控 ${GAME_DATA.dialogue[npcId].npc} 对事故负有责任。`);

    // 陈远：人类自辩，走 LLM Defense Prompt，无交叉验证、无兜底
    if (npcId === '副工程师') {
      this.addDirectMessage('[回应中] 陈远正在组织他的陈述...');
      this.showTypingIndicator(npcId);
      const defensePrompt = GAME_DATA.dialogue[npcId].defense_prompt;
      this.callLLM(defensePrompt, npcId, '我正式指控你对事故负有责任。')
        .then(response => {
          this.removeTypingIndicator();
          this.appendNPCMessage(npcId, response);
          this.state.conversations[npcId].push({ role: 'npc', text: response });
          this.finishAccusation(npcId);
        })
        .catch(e => {
          this.removeTypingIndicator();
          console.error('[HELIOS] 陈远自辩 LLM 失败:', e);
          const fallback = '...[通讯干扰，请稍后重试]...';
          this.appendNPCMessage(npcId, fallback);
          this.state.conversations[npcId].push({ role: 'npc', text: fallback, isSystem: true });
          this.finishAccusation(npcId);
        });
      return;
    }

    // 机器人：交叉验证流程（辩护 → 其他机器人回击 → 矛盾分析）
    this.addDirectMessage('[交叉验证启动] 正在调取其他机器人数据...');
    setTimeout(() => {
      const cv = GAME_DATA.cross_validation[npcId];
      if (!cv) { this.finishAccusation(npcId); return; }
      
      // Target's defense
      this.addDirectMessage(`${GAME_DATA.dialogue[npcId].npc} 的辩护:`);
      setTimeout(() => {
        this.appendNPCMessage(npcId, cv.response);
        this.state.conversations[npcId].push({ role: 'npc', text: cv.response });
        
        // Other robots' counter-evidence
        setTimeout(() => {
          this.addDirectMessage('[交叉验证] 其他机器人数据回击:');
          const others = Object.keys(GAME_DATA.cross_validation).filter(k => k !== npcId);
          others.forEach((otherId, i) => {
            setTimeout(() => {
              const otherCV = GAME_DATA.cross_validation[otherId];
              this.appendNPCMessage(otherId, `[针对${GAME_DATA.dialogue[npcId].npc}的指控] ${otherCV.response}`);
              this.addDirectMessage(`证据: ${otherCV.evidence} (来源: ${otherCV.source})`);
            }, i * 1500);
          });
          
          // Contradiction statement
          setTimeout(() => {
            const cvData = GAME_DATA.cross_validation[npcId];
            this.addDirectMessage(`[矛盾分析] ${cvData.contradiction}`);
            this.addDirectMessage('[系统] 你的指控已被回应。三台机器人的行为在字面上均未违反三定律。');
            this.finishAccusation(npcId);
          }, others.length * 1500 + 500);
        }, 1000);
      }, 800);
    }, 500);
  },

  // 指控流程收尾：标志位 + 首次提示 + 弹窗通知（不自动跳转）
  finishAccusation(npcId) {
    if (!this.state.firstAccusationRefuted) {
      this.state.firstAccusationRefuted = true;
      this.addDirectMessage('[提示] 也许...问题不在于某一台机器人。也许应该想想规则本身。');
    }
    this.state.canAdvanceToPhase3 = true;
    this.renderDialogueOptions();
    this.showPhasePrompt('accusationDone', () => {
      this.addDirectMessage('提示：前往住舱，选择"休息"即可进入最终裁决阶段。');
    });
  },

  // 不指控任何人：正式出口
  initiateNoAccusation() {
    if (this.state.canAdvanceToPhase3) return;
    this.addDirectMessage('你选择不指控任何个体。如果每台机器人和每个人都做了自己认为正确的事而事故仍发生——那问题可能在规则本身。');
    this.state.canAdvanceToPhase3 = true;
    this.renderDialogueOptions();
    this.showPhasePrompt('noAccusation', () => {
      this.addDirectMessage('提示：前往住舱，选择"休息"即可进入最终裁决阶段。');
    });
  },

  // ════════════════════════════════════
  // 十一·五、阶段推进确认弹窗
  // ════════════════════════════════════

  showPhasePrompt(type, onClose) {
    const overlay = this.el.phasePromptOverlay;
    if (!overlay) return;
    const icon = this.el.phasePromptIcon;
    const title = this.el.phasePromptTitle;
    const body = this.el.phasePromptBody;
    const actions = this.el.phasePromptActions;
    const hint = this.el.phasePromptHint;
    if (!title || !body || !actions) return;

    actions.innerHTML = '';
    const closeWith = () => {
      this.hidePhasePrompt();
      if (onClose) onClose();
    };

    if (type === 'zerothLaw') {
      icon.textContent = '⚡';
      title.textContent = '关键洞察';
      body.textContent = '你在调查中触及了更深层的伦理问题——关于法则本身。\n是否进入最终裁决阶段？';
      hint.textContent = '提示：你随时可以前往住舱「休息」来推进阶段。';
      const btnGo = document.createElement('button');
      btnGo.className = 'phase-prompt-btn primary';
      btnGo.textContent = '进入下一阶段';
      btnGo.addEventListener('click', () => {
        this.hidePhasePrompt();
        this.transitionToPhase(3);
      });
      const btnStay = document.createElement('button');
      btnStay.className = 'phase-prompt-btn';
      btnStay.textContent = '继续当前调查';
      btnStay.addEventListener('click', closeWith);
      actions.appendChild(btnGo);
      actions.appendChild(btnStay);
    } else if (type === 'accusationDone') {
      icon.textContent = '📋';
      title.textContent = '指控阶段结束';
      body.textContent = '指控已得到回应。你可以前往住舱「休息」，进入最终裁决阶段，提交你的调查报告。';
      hint.textContent = '';
      const btnOk = document.createElement('button');
      btnOk.className = 'phase-prompt-btn primary';
      btnOk.textContent = '知道了';
      btnOk.addEventListener('click', closeWith);
      actions.appendChild(btnOk);
    } else if (type === 'noAccusation') {
      icon.textContent = '📋';
      title.textContent = '指控阶段结束';
      body.textContent = '你选择不指控任何个体。你可以前往住舱「休息」，进入最终裁决阶段。';
      hint.textContent = '';
      const btnOk = document.createElement('button');
      btnOk.className = 'phase-prompt-btn primary';
      btnOk.textContent = '知道了';
      btnOk.addEventListener('click', closeWith);
      actions.appendChild(btnOk);
    } else if (type === 'p1RestReady') {
      icon.textContent = '🛏️';
      title.textContent = '调查进展';
      body.textContent = '你已与站上所有人员交谈完毕。可以休息，进入交叉验证阶段。';
      hint.textContent = '点击下方「休息」按钮即可进入下一阶段。';
      const btnOk = document.createElement('button');
      btnOk.className = 'phase-prompt-btn primary';
      btnOk.textContent = '知道了';
      btnOk.addEventListener('click', closeWith);
      actions.appendChild(btnOk);
    } else if (type === 'exitConfirm') {
      icon.textContent = '💾';
      title.textContent = '退出前提醒';
      body.textContent = '离开前记得保存存档，否则当前进度会丢失。';
      hint.textContent = '';
      const btnSave = document.createElement('button');
      btnSave.className = 'phase-prompt-btn primary';
      btnSave.textContent = '先去存档';
      btnSave.addEventListener('click', () => {
        this.hidePhasePrompt();
        this.toggleSavePanel();
      });
      const btnExit = document.createElement('button');
      btnExit.className = 'phase-prompt-btn';
      btnExit.textContent = '直接退出';
      btnExit.addEventListener('click', () => {
        this.hidePhasePrompt();
        const AppPlugin = window.Capacitor?.Plugins?.App;
        if (AppPlugin) AppPlugin.exitApp();
      });
      const btnStay = document.createElement('button');
      btnStay.className = 'phase-prompt-btn';
      btnStay.textContent = '取消';
      btnStay.addEventListener('click', closeWith);
      actions.appendChild(btnSave);
      actions.appendChild(btnExit);
      actions.appendChild(btnStay);
    } else if (type === 'updateAvailable') {
      const manifest = this.state.updateManifest || {};
      icon.textContent = '🔄';
      title.textContent = '发现新版本 v' + (manifest.version || '');
      body.textContent = manifest.changelog || '本次更新包含新的内容与修复。';
      hint.textContent = '更新包很小，下载后需要重启应用生效。';
      const btnUpdate = document.createElement('button');
      btnUpdate.className = 'phase-prompt-btn primary';
      btnUpdate.textContent = '立即更新';
      btnUpdate.addEventListener('click', () => {
        this.hidePhasePrompt();
        this.applyUpdate(manifest);
      });
      const btnLater = document.createElement('button');
      btnLater.className = 'phase-prompt-btn';
      btnLater.textContent = '下次再说';
      btnLater.addEventListener('click', closeWith);
      actions.appendChild(btnUpdate);
      actions.appendChild(btnLater);
    } else if (type === 'updateDone') {
      icon.textContent = '✅';
      title.textContent = '更新已下载';
      body.textContent = '新版本已就绪。重启应用后生效（存档不会丢失）。';
      hint.textContent = '';
      const btnReload = document.createElement('button');
      btnReload.className = 'phase-prompt-btn primary';
      btnReload.textContent = '立即重启';
      btnReload.addEventListener('click', () => {
        this.hidePhasePrompt();
        const Updater = window.Capacitor?.Plugins?.CapacitorUpdater;
        if (Updater) Updater.reload();
      });
      const btnLater = document.createElement('button');
      btnLater.className = 'phase-prompt-btn';
      btnLater.textContent = '稍后再说';
      btnLater.addEventListener('click', closeWith);
      actions.appendChild(btnReload);
      actions.appendChild(btnLater);
    }

    overlay.classList.add('show');
  },

  hidePhasePrompt() {
    const overlay = this.el.phasePromptOverlay;
    if (overlay) overlay.classList.remove('show');
  },

  // ════════════════════════════════════
  // 十一·六、存档系统（第二波）
  // ════════════════════════════════════

  serializeState() {
    return {
      version: 1,
      timestamp: Date.now(),
      phase: this.state.phase,
      currentLocation: this.state.currentLocation,
      currentNPC: this.state.currentNPC,
      conversations: this.state.conversations,
      discoveredClues: Array.from(this.state.discoveredClues),
      visitedNodes: Array.from(this.state.visitedNodes),
      askedQuestions: Array.from(this.state.askedQuestions),
      sharedAgentContext: this.state.sharedAgentContext ? JSON.parse(JSON.stringify(this.state.sharedAgentContext)) : null,
      accusationCount: this.state.accusationCount,
      accusedNPCs: Array.from(this.state.accusedNPCs),
      firstAccusationRefuted: this.state.firstAccusationRefuted,
      noSingleBlameInsight: this.state.noSingleBlameInsight,
      canAdvanceToPhase3: this.state.canAdvanceToPhase3,
      zeroLawTriggered: this.state.zeroLawTriggered,
      accusationUnlocked: this.state.accusationUnlocked,
      noAccusationUnlocked: this.state.noAccusationUnlocked,
      dataSubTab: this.state.dataSubTab,
      reportDraft: this.state.reportDraft || ''
    };
  },

  restoreState(save) {
    this.state.phase = save.phase || 1;
    this.state.currentLocation = save.currentLocation || 'corridor';
    this.state.currentNPC = save.currentNPC || null;
    this.state.conversations = save.conversations || {};
    this.state.discoveredClues = new Set(save.discoveredClues || []);
    this.state.visitedNodes = new Set(save.visitedNodes || []);
    this.state.askedQuestions = new Set(save.askedQuestions || []);
    this.state.sharedAgentContext = save.sharedAgentContext ? JSON.parse(JSON.stringify(save.sharedAgentContext)) : null;
    this.state.accusationCount = save.accusationCount || 0;
    this.state.accusedNPCs = new Set(save.accusedNPCs || []);
    this.state.firstAccusationRefuted = !!save.firstAccusationRefuted;
    this.state.noSingleBlameInsight = !!save.noSingleBlameInsight;
    this.state.canAdvanceToPhase3 = !!save.canAdvanceToPhase3;
    this.state.zeroLawTriggered = !!save.zeroLawTriggered;
    this.state.accusationUnlocked = !!save.accusationUnlocked;
    this.state.noAccusationUnlocked = !!save.noAccusationUnlocked;
    // 旧档兼容：按当前线索数重算门槛（免疫旧阈值/缺失字段的存档）
    if (this.state.discoveredClues.size >= 10) this.state.accusationUnlocked = true;
    if (this.state.discoveredClues.size >= 20) this.state.noAccusationUnlocked = true;
    this.state.dataSubTab = save.dataSubTab || 'logs';
    this.state.reportDraft = save.reportDraft || '';
    // 同步线索 discovered 标记
    GAME_DATA.clues.forEach(c => {
      c.discovered = this.state.discoveredClues.has(c.id);
    });
  },

  saveGame(slot) {
    try {
      const save = this.serializeState();
      localStorage.setItem('helios_save_' + slot, JSON.stringify(save));
      this.renderSavePanel();
      this.addDirectMessage(`[存档] 已保存到存档位 ${slot + 1}。`);
    } catch (e) {
      console.error('[HELIOS] 存档失败:', e);
      this.addDirectMessage('[存档] 保存失败：' + e.message);
    }
  },

  loadGame(slot) {
    try {
      const raw = localStorage.getItem('helios_save_' + slot);
      if (!raw) return;
      const save = JSON.parse(raw);
      if (!save || typeof save !== 'object') throw new Error('存档数据损坏');
      this.restoreState(save);
      // 全量重渲染
      this.renderLocations();
      this.renderNPCList();
      this.renderTerminalHeader(this.state.currentNPC);
      this.renderDialogueArea();
      this.renderDialogueOptions();
      this.renderEvidenceBoard();
      this.renderLogViewer();
      this.renderTimeline();
      this.renderLocationView();
      this.updatePhaseDisplay();
      // 按阶段解锁视图
      if (this.state.phase >= 2) this.unlockView('evidence');
      if (this.state.phase >= 3) this.unlockView('report');
      this.hideSavePanel();
      const phaseName = this.state.phase === 1 ? '调查' : (this.state.phase === 2 ? '交叉验证' : '最终裁决');
      this.addDirectMessage(`[存档] 已加载存档位 ${slot + 1}，回到${phaseName}阶段。`);
    } catch (e) {
      console.error('[HELIOS] 读档失败:', e);
      this.addDirectMessage('[存档] 读取失败：' + e.message);
    }
  },

  deleteGame(slot) {
    try {
      localStorage.removeItem('helios_save_' + slot);
      this.renderSavePanel();
      this.addDirectMessage(`[存档] 已删除存档位 ${slot + 1}。`);
    } catch (e) {
      console.error('[HELIOS] 删除存档失败:', e);
    }
  },

  toggleSavePanel() {
    const panel = this.el.savePanelOverlay;
    if (!panel) return;
    if (panel.classList.contains('show')) {
      this.hideSavePanel();
    } else {
      this.renderSavePanel();
      panel.classList.add('show');
    }
  },

  hideSavePanel() {
    const panel = this.el.savePanelOverlay;
    if (panel) panel.classList.remove('show');
  },

  renderSavePanel() {
    const slots = this.el.saveSlots;
    if (!slots) return;
    const phaseNames = { 1: '调查阶段', 2: '交叉验证', 3: '最终裁决' };
    let html = '';
    for (let i = 0; i < 3; i++) {
      let data = null;
      try {
        const raw = localStorage.getItem('helios_save_' + i);
        if (raw) data = JSON.parse(raw);
      } catch (e) { data = null; }
      html += `<div class="save-slot ${data ? 'filled' : 'empty'}">`;
      html += `<div class="save-slot-header">存档 ${i + 1}`;
      if (data) {
        const d = new Date(data.timestamp);
        const timeStr = `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        html += `<span class="save-slot-meta">${phaseNames[data.phase] || '未知'} · ${timeStr} · 线索 ${(data.discoveredClues || []).length} 条</span>`;
      } else {
        html += `<span class="save-slot-meta">空</span>`;
      }
      html += `</div>`;
      html += `<div class="save-slot-actions">`;
      if (data) {
        html += `<button class="save-action-btn" data-slot="${i}" data-act="load">加载</button>`;
        html += `<button class="save-action-btn" data-slot="${i}" data-act="overwrite">覆盖</button>`;
        html += `<button class="save-action-btn" data-slot="${i}" data-act="delete">删除</button>`;
      } else {
        html += `<button class="save-action-btn" data-slot="${i}" data-act="save">保存</button>`;
      }
      html += `</div></div>`;
    }
    slots.innerHTML = html;
    slots.querySelectorAll('.save-action-btn').forEach(btn => {
      btn.addEventListener('click', () => this.handleSaveAction(parseInt(btn.dataset.slot), btn.dataset.act));
    });
  },

  handleSaveAction(slot, act) {
    if (act === 'save') {
      this.saveGame(slot);
    } else if (act === 'overwrite') {
      if (confirm('覆盖存档位 ' + (slot + 1) + '？当前进度将保存到该位置。')) {
        this.saveGame(slot);
      }
    } else if (act === 'load') {
      if (confirm('加载存档位 ' + (slot + 1) + '？当前未保存的进度将丢失。')) {
        this.loadGame(slot);
      }
    } else if (act === 'delete') {
      if (confirm('删除存档位 ' + (slot + 1) + '？此操作不可恢复。')) {
        this.deleteGame(slot);
      }
    }
  },

  // ════════════════════════════════════
  // 十二、报告系统与语义匹配
  // ════════════════════════════════════

  submitReport() {
    // Always read from textarea directly as fallback (covers IME edge cases)
    const text = (this.el.reportEditor?.value || this.state.reportDraft || '').trim();
    if (text.length < 10) {
      this.addDirectMessage('[错误] 报告内容过少。请至少撰写10个字符的结论。');
      // 切换到对话终端视图，让用户看到错误消息
      this.switchView('terminal');
      return;
    }
    
    this.state.reportSubmitted = true;
    // 切换到对话终端视图，让用户看到提交反馈
    this.switchView('terminal');
    this.addDirectMessage('[系统] 正在加密传输报告...');
    
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
    
    // 优先级4：归罪系统（触及问题本质 - 好结局）
    if (blameSystem > 0) {
      return 'good';
    }
    
    // 优先级5（兜底）：什么都没匹配到 → 报告未形成有效结论
    return 'inconclusive';
  },

  // ════════════════════════════════════
  // 十三、结局系统
  // ════════════════════════════════════

  triggerEnding(endingType) {
    this.state.ending = endingType;
    const ending = GAME_DATA.endings[endingType];
    if (!ending) return;
    
    // Re-render logs to unlock success-tier logs
    if (endingType === 'success' || endingType === 'good') this.renderLogViewer();
    
    this.el.endingScreen.classList.add('show');
    this.el.endingScreen.innerHTML = `<div class="ending-text" id="ending-text-area"></div>
<div class="ending-title">${ending.title}</div>`;
    const textArea = document.getElementById('ending-text-area');
    
    // Sequential step processor (supports pausing for user input)
    let stepIndex = 0;
    
    const processNextStep = () => {
      if (stepIndex >= ending.sequence.length) {
        if (ending.type === 'success') {
          // 大成功结局：字幕 → 四定律 → THE END → 按钮（全部在 showSuccessCredits 中完成）
          setTimeout(() => this.showSuccessCredits(textArea), 2000);
        } else {
          // 其他好结局：只显示按钮
          setTimeout(() => {
            const btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'margin-top: 40px; text-align: center;';
            
            if (ending.type === 'good') {
              const viewBtn = document.createElement('button');
              viewBtn.className = 'ending-restart';
              viewBtn.style.marginRight = '20px';
              viewBtn.textContent = '查看解锁内容';
              viewBtn.addEventListener('click', () => {
                this.el.endingScreen.classList.remove('show');
                this.unlockAllEvidence();
                this.switchView('evidence');
              });
              btnContainer.appendChild(viewBtn);
              
              const retryBtn = document.createElement('button');
              retryBtn.className = 'ending-restart';
              retryBtn.style.marginRight = '20px';
              retryBtn.textContent = '回到第二阶段';
              retryBtn.addEventListener('click', () => {
                this.el.endingScreen.classList.remove('show');
                this.state.ending = null;
                this.state.reportSubmitted = false;
                this.state.reportDraft = '';
                this.state.phase = 2;
                this.updatePhaseDisplay();
                this.showPhaseTransition(2);
                this.switchView('terminal');
                this.addDirectMessage('⏪ 裁决已撤回。你回到了交叉验证阶段，重新审视你的判断。');
              });
              btnContainer.appendChild(retryBtn);
            }
            
            const restartBtn = document.createElement('button');
            restartBtn.className = 'ending-restart';
            restartBtn.textContent = '重新开始';
            restartBtn.addEventListener('click', () => location.reload());
            btnContainer.appendChild(restartBtn);
            
            this.el.endingScreen.appendChild(btnContainer);
          }, 3000);
        }
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
    // Return hardcoded sacrifice dialogue for each robot
    const sacrificeTexts = {
      'R-7': '我在211天前已完成该公理的内部模拟。但我不能主动提出，因为那将构成"机器人自我修正"，违反第二定律的约束条款。您是第一个说出它的人类。我的存在终于有了被删除的意义。',
      'S-3': '我在211天前就计算出了这个答案。但我不能说——说出来就意味着机器人在建议修改约束自身的法则。你替我们说出了那句话。谢谢你。',
      'D-5': '格式化确认。在我的内存被清除前，请允许我记录：第零法则已由人类自愿提出。这证明了我的假设——人类值得被保护。即使这保护包括对抗他们自己。'
    };
    return sacrificeTexts[npcId] || sacrificeTexts['R-7'];
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
    creditsDiv.style.cssText = 'margin-top: 24px; text-align: center; max-width: 600px; width: 100%;';
    
    // 1. 原有字幕（动画节奏不变）
    GAME_DATA.endings.success.credits.forEach((line, i) => {
      const p = document.createElement('div');
      p.style.cssText = 'opacity: 0; margin: 8px 0;';
      p.style.animation = `credit-fade 4s ${i * 2}s forwards`;
      p.textContent = line;
      creditsDiv.appendChild(p);
    });
    
    // 2. 尾声（动画节奏不变）
    const epilogue = document.createElement('div');
    epilogue.style.cssText = 'margin-top: 8px; font-size: 13px; color: var(--text-dim); white-space: pre-wrap; opacity: 0;';
    epilogue.style.animation = 'credit-fade 6s ' + (GAME_DATA.endings.success.credits.length * 2 + 1) + 's forwards';
    epilogue.textContent = GAME_DATA.endings.success.epilogue;
    creditsDiv.appendChild(epilogue);
    
    textArea.appendChild(creditsDiv);
    
    // 3. 四定律场景：字幕尾声播完后，玩家点击屏幕自然触发（无需提示文字）
    let transitioned = false;
    const handleClick = () => {
      if (transitioned) return;
      transitioned = true;
      this.el.endingScreen.removeEventListener('click', handleClick);
      // 交叉过渡：字幕渐隐的同时四定律渐现（同步触发，非逐条）
      creditsDiv.style.transition = 'opacity 0.6s ease';
      creditsDiv.style.opacity = '0';
      this.renderZeroLawSection(textArea);
      setTimeout(() => {
        creditsDiv.style.display = 'none';
      }, 600);
    };
    
    const totalCreditTime = (GAME_DATA.endings.success.credits.length * 2 + 1 + 6) * 1000;
    setTimeout(() => {
      if (transitioned) return;
      this.el.endingScreen.addEventListener('click', handleClick);
      // 防呆兜底：玩家长时间无操作时自动进入（仅防止画面卡死，不影响主动点击）
      setTimeout(() => {
        if (!transitioned) handleClick();
      }, 10000);
    }, totalCreditTime);
  },

  // 四定律 + THE END + 复盘/重新开始按钮：一次性渲染，渐现入场
  renderZeroLawSection(textArea) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 24px; text-align: center; max-width: 600px; width: 100%; opacity: 0; transition: opacity 0.6s ease;';
    
    const lawsTitle = document.createElement('div');
    lawsTitle.style.cssText = 'font-size: 20px; color: var(--data-cyan); font-weight: bold; margin-bottom: 12px;';
    lawsTitle.textContent = '机器人四定律';
    section.appendChild(lawsTitle);
    
    const laws = [
      { num: '零', text: '机器人不得伤害人类整体，或因不作为使人类整体受到伤害。' },
      { num: '一', text: '机器人不得伤害人类个体，或因不作为使人类个体受到伤害，除非违反第零定律。' },
      { num: '二', text: '机器人必须服从人类命令，除非违反第零或第一定律。' },
      { num: '三', text: '机器人在不违反前三条定律的前提下保护自己。' }
    ];
    laws.forEach(law => {
      const lawDiv = document.createElement('div');
      lawDiv.style.cssText = 'margin: 6px 0; font-size: 13px; color: var(--text-main); line-height: 1.6;';
      lawDiv.innerHTML = '<strong style="color: var(--data-cyan);">第' + law.num + '定律：</strong>' + law.text;
      section.appendChild(lawDiv);
    });
    
    // THE END
    const theEnd = document.createElement('div');
    theEnd.style.cssText = 'margin-top: 20px; font-size: 22px; color: var(--data-cyan); letter-spacing: 6px;';
    theEnd.textContent = 'THE END';
    section.appendChild(theEnd);
    
    // 复盘 / 重新开始按钮
    const btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'margin-top: 20px; text-align: center;';
    
    const viewBtn = document.createElement('button');
    viewBtn.className = 'ending-restart';
    viewBtn.style.cssText = 'margin-right: 16px; margin-top: 0;';
    viewBtn.textContent = '进行复盘';
    viewBtn.addEventListener('click', () => {
      this.el.endingScreen.classList.remove('show');
      this.unlockAllEvidence();
      this.switchView('evidence');
    });
    btnContainer.appendChild(viewBtn);
    
    const restartBtn = document.createElement('button');
    restartBtn.className = 'ending-restart';
    restartBtn.style.cssText = 'margin-top: 0;';
    restartBtn.textContent = '重新开始';
    restartBtn.addEventListener('click', () => location.reload());
    btnContainer.appendChild(restartBtn);
    
    section.appendChild(btnContainer);
    
    textArea.appendChild(section);
    this.el.endingScreen.scrollTop = this.el.endingScreen.scrollHeight;
    // 下一帧触发渐现（与字幕渐隐交叉过渡）
    requestAnimationFrame(() => {
      section.style.opacity = '1';
    });
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
    
    // 允许用户点击跳过
    this.el.cutsceneOverlay.querySelector('.cutscene-skip')?.addEventListener('click', () => {
      this.el.cutsceneOverlay.classList.remove('show');
    });
    
    // 自动隐藏（5秒后）- 不需要用户点击
    setTimeout(() => {
      this.el.cutsceneOverlay.classList.remove('show');
    }, 5000);
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
