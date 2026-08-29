/* dev-brief-19 验证脚本：移动端"检查更新"修复走查
   运行方式：npm install --no-save jsdom && node scripts/verify-update-fix.js */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { runScripts: 'outside-only', url: 'http://localhost/' });
const { window } = dom;

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  OK  ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? ' | ' + extra : '')); }
};

const dataSrc = fs.readFileSync(path.join(root, 'js/data.js'), 'utf8');
const gameSrc = fs.readFileSync(path.join(root, 'js/game.js'), 'utf8');
window.eval(dataSrc + '\n' + gameSrc + '\n;window.__GAME = Game;');
const G = window.__G = window.__GAME;
const doc = window.document;
G.cacheElements();

console.log('== 1. 网页版：手动检查 → 明确提示（原为静默无响应）==');
G.checkForUpdates(true);
check('webNoUpdate 弹窗出现', doc.getElementById('phase-prompt-overlay').classList.contains('show'));
check('弹窗标题正确', doc.getElementById('phase-prompt-title').textContent.includes('网页版'));
G.hidePhasePrompt();

console.log('== 2. fetchManifest 多源兜底 ==');
const manifest = { version: '9.9.9', url: 'https://github.com/x/update.zip', changelog: 'x' };
// 场景 A：raw 被拒（403）→ jsDelivr 成功
window.fetch = async (url) => {
  if (url.includes('raw.githubusercontent.com')) return { ok: false, status: 403 };
  if (url.includes('cdn.jsdelivr.net')) return { ok: true, status: 200, json: async () => manifest };
  throw new Error('unexpected url ' + url);
};
G.fetchManifest().then(async (m) => {
  check('raw 失败 → jsDelivr 兜底成功', m.version === '9.9.9');

  // 场景 B：raw 挂起（模拟被墙）→ 应在 10s 超时后走 jsDelivr。
  // 用 AbortError 立即抛出模拟超时结果，验证路径相同（真实定时器等待过长，不在测试中实等）
  window.fetch = async (url, opts) => {
    if (url.includes('raw.githubusercontent.com')) {
      const e = new Error('The operation was aborted');
      e.name = 'AbortError';
      throw e;
    }
    if (url.includes('cdn.jsdelivr.net')) return { ok: true, status: 200, json: async () => manifest };
    throw new Error('unexpected url ' + url);
  };
  const m2 = await G.fetchManifest();
  check('raw 超时(AbortError) → jsDelivr 兜底成功', m2.version === '9.9.9');

  // 场景 C：全源失败 → 抛错
  window.fetch = async () => ({ ok: false, status: 500 });
  let threw = false;
  await G.fetchManifest().catch(() => { threw = true; });
  check('全源失败 → 抛错（进入 updateCheckFailed）', threw);

  console.log('== 3. 原生环境：检查更新全链路（mock Capacitor）==');
  // 恢复正常 fetch（场景 C 留下了全失败版本）
  window.fetch = async (url) => {
    if (url.includes('cdn.jsdelivr.net') || url.includes('raw.githubusercontent.com'))
      return { ok: true, status: 200, json: async () => manifest };
    throw new Error('unexpected url ' + url);
  };
  let downloadedUrls = [];
  window.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      CapacitorUpdater: {
        download: async (opts) => {
          downloadedUrls.push(opts.url);
          if (opts.url.includes('github.com')) throw new Error('network unreachable'); // 主源失败
          return { id: 'bundle-1' };
        },
        next: async (o) => { G._nextCalled = o.id; },
        notifyAppReady: async () => {}
      }
    }
  };
  G.state.updateManifest = manifest;
  await G.checkForUpdates(true);
  check('发现新版本弹窗', doc.getElementById('phase-prompt-title').textContent.includes('发现新版本'));
  check('按钮反馈恢复（检查中… → 原文案）', doc.getElementById('update-btn').textContent.includes('检查更新'));
  G.hidePhasePrompt();

  console.log('== 4. 下载镜像兜底 ==');
  await G.applyUpdate(manifest);
  check('主源失败 → 镜像被尝试', downloadedUrls.length === 2 && downloadedUrls[1].includes('cdn.jsdelivr.net'),
    JSON.stringify(downloadedUrls));
  check('镜像 URL 指向 tag 内 update/update.zip', downloadedUrls[1] === 'https://cdn.jsdelivr.net/gh/chemmy-11/helios@v9.9.9/update/update.zip');
  check('下载成功 → next 激活 + updateDone 弹窗', G._nextCalled === 'bundle-1' &&
    doc.getElementById('phase-prompt-title').textContent.includes('更新已下载'));
  G.hidePhasePrompt();

  // 场景 D：下载全失败 → updateFailed 弹窗（原为对话区消息，抽屉下不可见）
  window.Capacitor.Plugins.CapacitorUpdater.download = async () => { throw new Error('timeout'); };
  await G.applyUpdate(manifest);
  check('下载全失败 → updateFailed 弹窗可见', doc.getElementById('phase-prompt-overlay').classList.contains('show') &&
    doc.getElementById('phase-prompt-title').textContent.includes('更新下载失败'));

  console.log(`\n结果: ${pass} pass / ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}).catch(e => { console.error('测试异常:', e); process.exit(1); });
