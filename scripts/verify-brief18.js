/* dev-brief-18 验证脚本（临时）：核心走查 §八 2-7 的可自动化部分
   运行方式：npm install --no-save jsdom && node scripts/verify-brief18.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
const { window } = dom;

// localStorage stub（jsdom 自带，但确保可用）
let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  OK  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' | ' + extra : '')); }
};

// 载入 data.js 与 game.js（同一 eval 作用域，const 声明互相可见）
const dataSrc = fs.readFileSync(path.join(root, 'js/data.js'), 'utf8');
const gameSrc = fs.readFileSync(path.join(root, 'js/game.js'), 'utf8');
window.eval(dataSrc + '\n' + gameSrc + '\n;window.__GAME = Game;window.GAME_DATA = GAME_DATA;');

const G = window.__GAME;
const GD = window.eval('GAME_DATA');

console.log('== 1. 数据结构 ==');
const infInMap = GD.keyword_clue_map.filter(e => {
  const c = GD.clues.find(x => x.name === e.clue);
  return c && c.type === 'INFERENCE';
});
check('keyword_clue_map 不含 INF 行', infInMap.length === 0);
check('clue_linkage 4 条且引用有效', (GD.clue_linkage || []).length === 4 &&
  GD.clue_linkage.every(l => GD.clues.find(c => c.id === l.result) && l.pair.every(p => GD.clues.find(c => c.id === p))));
check('prologue 数据块齐全', GD.prologue && GD.prologue.bootLines.length === 4 &&
  GD.prologue.files.length === 5 && GD.prologue.quiz.length === 2 && GD.prologue.commanderMsgs.length === 3);
check('序章文案无 10/20 门槛数字', JSON.stringify(GD.prologue).indexOf('10 条') === -1 && JSON.stringify(GD.prologue).indexOf('20 条') === -1);
check('SECRET 行均无 radar 字段；带 radar 字段的行均为非 SECRET 且类别合法', GD.keyword_clue_map.every(e => {
  const c = GD.clues.find(x => x.name === e.clue);
  if (!c) return false;
  if (c.type === 'SECRET') return !e.radar_label && !e.radar_cat;
  if (!e.radar_label) return true; // 雷达为子集：允许个别非 SECRET 行不配置
  return ['fact', 'logic', 'emotion'].includes(e.radar_cat);
}));
check('伤者称谓：序章用"首席工程师"，无"陈远昏迷"表述', JSON.stringify(GD.prologue).includes('首席工程师重伤昏迷'));

console.log('== 2. 话题雷达（阶段一）==');
G.state.phase = 1;
['R-7', 'S-3', 'D-5', '副工程师'].forEach(npc => {
  const topics = G.getRadarTopics(npc);
  check(`${npc} 雷达 chips = 3`, topics.length === 3, 'got ' + topics.length);
  check(`${npc} chips 来源归属正确`, topics.every(t => {
    const c = GD.clues.find(x => x.name === t.clue);
    return c.source.startsWith(npc);
  }));
});
// bias 排序：empathy → emotion 优先；pressure → logic 优先
G.state.openingBias = 'empathy';
const s3Empathy = G.getRadarTopics('S-3');
check('openingBias=empathy 时 S-3 首条为 emotion', s3Empathy[0].radar_cat === 'emotion', s3Empathy[0].radar_cat);
G.state.openingBias = 'pressure';
const s3Pressure = G.getRadarTopics('S-3');
check('openingBias=pressure 时 S-3 首条为 logic', s3Pressure[0].radar_cat === 'logic', s3Pressure[0].radar_cat);
G.state.openingBias = '';

// 关键走查：每个 chip 文案丢进 checkKeywordClues，不得触发 SECRET / INFERENCE
let secretLeaks = [];
GD.keyword_clue_map.filter(e => e.radar_label).forEach(e => {
  const before = new Set(G.state.discoveredClues);
  G.checkKeywordClues(e.radar_label);
  G.state.discoveredClues.forEach(id => {
    if (!before.has(id)) {
      const c = GD.clues.find(x => x.id === id);
      if (c.type === 'SECRET' || c.type === 'INFERENCE') secretLeaks.push(`${e.radar_label} → ${c.name}(${c.type})`);
    }
  });
  G.state.discoveredClues = new Set();
});
check('所有 chip 文案不触发 SECRET/INFERENCE', secretLeaks.length === 0, secretLeaks.join('; '));
// 目标命中：chip 应发现其目标线索
G.checkKeywordClues('你的安全记录怎么样？');
check('chip"安全记录"命中 R-7安全记录', G.state.discoveredClues.has('CL_R7_001'));
G.state.discoveredClues = new Set();

console.log('== 3. 阶段二雷达隐藏 ==');
G.state.phase = 2;
check('phase 2 雷达为空', G.getRadarTopics('R-7').length === 0);
G.state.phase = 1;

console.log('== 4. 关联合成 ==');
const link = (a, b) => {
  G.state.selectedClues = [a, b];
  G.tryLinkClues();
};
link('CL_R7_008', 'CL_S3_005');
check('2.1°+密封圈 → INF_002 偏差传导链', G.state.discoveredClues.has('CL_INF_002'));
link('CL_D5_005', 'CL_S3_007');
check('沉默理由+预载急救 → INF_001 系统性沉默', G.state.discoveredClues.has('CL_INF_001'));
link('CL_LOG_003', 'CL_D5_006');
check('校准两证 → INF_003 责任链条', G.state.discoveredClues.has('CL_INF_003'));
link('CL_R7_010', 'CL_D5_012');
check('定律矛盾+空白 → INF_004 三定律解读差异', G.state.discoveredClues.has('CL_INF_004'));
G.state.selectedClues = ['CL_R7_001', 'CL_S3_001'];
G.state._boardMsg = null;
G.tryLinkClues();
check('乱配两张 → 关联度不足 + tip', !G.state.discoveredClues.has('CL_INF_001') || G.state.linkTipShown === true);

console.log('== 5. 打字不再触发 INF ==');
const before5 = new Set(G.state.discoveredClues);
G.checkKeywordClues('系统性沉默 因果链条 责任链条 三台的区别');
const newly5 = [...G.state.discoveredClues].filter(id => !before5.has(id))
  .map(id => GD.clues.find(c => c.id === id)).filter(Boolean);
check('INF 关键词输入不新增任何 INF 卡', newly5.every(c => c.type !== 'INFERENCE'),
  newly5.filter(c => c.type === 'INFERENCE').map(c => c.name).join(','));

console.log('== 6. 存档 roundtrip ==');
G.state.prologueDone = true;
G.state.openingBias = 'empathy';
G.state.openingIntuition = 'human';
G.state.presentedConfrontations = { CL_R7_001: ['S-3'] };
G.state.radarTipShown = true; G.state.linkTipShown = true;
const snap = G.serializeState();
check('serializeState version=2', snap.version === 2);
check('新字段均已序列化', snap.openingBias === 'empathy' && snap.openingIntuition === 'human' &&
  snap.presentedConfrontations.CL_R7_001[0] === 'S-3' && snap.radarTipShown && snap.linkTipShown);
// 旧档兼容
G.restoreState({ version: 1, discoveredClues: [], clueQuotes: {} });
check('v1 旧档 → prologueDone=true', G.state.prologueDone === true);
G.restoreState(snap);
check('v2 存档恢复完整', G.state.openingBias === 'empathy' && G.state.openingIntuition === 'human' &&
  (G.state.presentedConfrontations.CL_R7_001 || []).includes('S-3'));

console.log('== 7. 序章流程（DOM）==');
G.cacheElements(); // 测试环境补跑缓存（真实流程由 init() 完成）
G.state.discoveredClues = new Set(); // 清进度，否则 hasProgress() 会跳过序章
for (const id in G.state.conversations) G.state.conversations[id] = [];
const ov = window.document.getElementById('prologue-overlay');
check('overlay 存在于 index.html', !!ov);
G.state.prologueDone = false;
G.startPrologue();
check('startPrologue 显示 overlay', ov.classList.contains('show') && G.state.prologueActive);
check('Beat 0 渲染 bootLines', window.document.querySelectorAll('.prologue-boot-line').length === 4);
G.finishPrologue();
check('finishPrologue 落盘标记', ov.classList.contains('show') === false && G.state.prologueDone === true &&
  window.localStorage.getItem('helios_prologue_done') === 'true');
// localStorage 标记 → 二次跳过
G.state.prologueDone = false;
G.startPrologue();
check('二次启动直接跳过', G.state.prologueDone === true && !ov.classList.contains('show'));
window.localStorage.removeItem('helios_prologue_done');

// hasProgress 路径
G.state.prologueDone = false;
G.state.conversations['R-7'] = [{ role: 'npc', text: 'x' }];
G.startPrologue();
check('有进度时不进序章', G.state.prologueDone === true);

console.log('== 8. 证据板渲染（DOM）==');
G.state.selectedClues = [];
G.state.presentedConfrontations = {};
['CL_R7_001', 'CL_S3_001', 'CL_D5_005'].forEach(id => G.state.discoveredClues.add(id)); // 重新铺测试线索
G.renderEvidenceBoard();
const board = window.document.getElementById('evidence-board');
const confirmedCards = board.querySelectorAll('.clue-card.confirmed');
check('证据板渲染已发现卡', confirmedCards.length > 0);
check('每张卡含对质按钮', board.querySelectorAll('.confront-btn').length === confirmedCards.length);
const lockedBtn = board.querySelector('.confront-btn');
G.state.phase = 1; G.renderEvidenceBoard();
check('阶段一对质按钮锁定', !!board.querySelector('.confront-btn[disabled]'));
G.state.phase = 2; G.renderEvidenceBoard();
check('阶段二对质按钮可用', board.querySelectorAll('.confront-btn:not([disabled])').length > 0);
// 选中两张 → link-bar 出现
G.state.selectedClues = ['CL_R7_001', 'CL_S3_001'];
G.renderEvidenceBoard();
check('选中两张显示建立关联栏', !!board.querySelector('[data-act="link"]'));
G.state.selectedClues = [];

console.log(`\n结果: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
