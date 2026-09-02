# HELIOS GitHub 维护手册

> 记录本项目（`chemmy-11/helios`）从开发到发布的全套 GitHub 维护流程。
> 供后续开发会话与人工维护参考——按此流程操作，避免踩已踩过的坑。

---

## 1. 仓库概览

| 项 | 值 |
|---|---|
| 远程仓库 | `https://github.com/chemmy-11/helios.git` |
| 分支 | `master`（单分支，直接推送，无 PR 流程） |
| 认证 | HTTPS + git credential（Windows 凭据管理器） |
| 自动发布脚本 | `scripts/publish-release.sh`（通过 `git credential fill` 取 token） |

---

## 2. 日常提交流程

```bash
bash scripts/check.sh        # 提交前自检：语法 + 关键残留引用 + APK 一致性
git add -A
git commit -m "fix: 描述"
git push origin master
```

- **提交信息惯例**：`fix:` / `feat:` / `docs:` / `chore:` 前缀 + 中文描述（如 `fix: 键盘收尾 — insets 方案完整化`）。
- **提交前必跑 `scripts/check.sh`**：它会检查 `node --check` 语法、以及已移除符号（`addSystemMessage(`、`gameTime`、`consumeTime`、`drawer-nav` 等）的残留引用，并校验 APK 与源码 md5 一致。

### 网络不稳定处理（重要）

`github.com:443` 会**间歇性连接失败**（DNS 解析到不可达 IP，如 `20.205.243.166` 超时）。表现：`git push` 报 `Failed to connect to github.com:443`。

**本机已配置 git 代理**（`http.proxy = http://127.0.0.1:7897`，Clash 系端口）——**push 前必须先开代理软件**，否则报 `Failed to connect to github.com:443 over proxy 127.0.0.1`。开代理后通常直接成功（2026-08-02 v1.6.3 发布验证）。

处理办法（按顺序试）：

1. **直接重试**（网络抖动时第二次常能成功）；
2. **开代理软件（Clash 等，端口 7897）后重试**；
3. 检测可用 IP：

   ```bash
   curl -sS -o /dev/null -w "%{http_code}\n" --connect-timeout 5 \
     --resolve github.com:443:140.82.112.4 https://github.com
   ```

   曾验证可达 IP：`140.82.112.4`、`140.82.113.4`（返回 200）；`20.205.243.166` 常超时。直连被 reset 时（`Connection was reset`）只能走代理。

> push 失败不影响本地 commit，本地代码安全，网络恢复后重推即可。

### 发布中断恢复（v1.6.3 实战）

`publish-release.sh` 中途失败时按已完成的阶段恢复：

| 已完成的阶段 | 恢复动作 |
|---|---|
| release 已创建 + 资产已上传，但 `git push` 失败 | **只需补 push**：`git push origin master`（version.json 已本地提交）。release 资产不受影响 |
| release 创建失败 | 脚本会退出，先查网络/凭据再整体重跑 |
| 凭据获取失败（`git credential fill` 空） | Windows 凭据管理器里确认 github.com 凭据存在 |

---

## 3. 开发文档惯例（`dev-briefs/`）

- 每轮功能开发前/中，在 `dev-briefs/dev-brief-N.md` 记录**设计决策 + 实施计划**；
- 功能完成后将文档**更新为定稿状态**（如 `dev-brief-14` 定稿为 v1.4.0 完成状态），内容包含：功能列表、实现细节（文件/函数级）、验证方式；
- 大版本迭代时同步更新 `README.md`（用户维护或代写提交）。

---

## 4. 版本号与双更新通道

**版本号唯一来源：`js/version.js` 的 `APP_VERSION`**（如 `1.6.2`），发布脚本从中读取。

两类改动走不同通道：

| 改动类型 | 发布方式 | 说明 |
|---|---|---|
| **web 层**（`js/`、`css/`、`index.html`） | **在线更新** | 打包 `update.zip` 传 GitHub release，App 内检测下载，不打断会话、不影响存档 |
| **native 层**（`MainActivity.java`、`AndroidManifest.xml`、Capacitor 插件） | **重装 APK** | 在线更新无法覆盖原生代码，必须装新 APK |

> 教训：凡是 native 改动（如键盘 insets 适配），版本号照常递增，但必须提醒用户装 APK，不要只发在线更新。

---

## 5. 自动发布（推荐）

```bash
bash scripts/publish-release.sh "更新内容第一行|第二行|第三行"
```

脚本自动完成：

1. 从 `js/version.js` 读版本号（`v1.6.2`）；
2. `bash scripts/build-apk.sh` 构建 APK（含 md5 逐字节验证）；
3. `git credential fill` 取 GitHub token；
4. 调 GitHub API 创建 **release**（tag = `vX.Y.Z`，changelog 用 `|` 分行）；
5. 上传 APK + `update.zip` 到 release 资产；
6. 更新 `update/version.json` 并推送。

**前置条件**：`git credential` 已存 GitHub 凭据（Windows 凭据管理器）。

### 手动发布（备用）

GitHub Web 端：

1. `Code → Tags → Create a new release`；
2. tag 填 `vX.Y.Z`，标题 `HELIOS vX.Y.Z`；
3. 上传 `HELIOS.apk` 与 `update.zip`；
4. 同步更新 `update/version.json`（url 指向 `releases/download/vX.Y.Z/update.zip`）并推送。

---

## 6. 在线更新机制（App 侧）

```
update/version.json          # 版本清单（仓库内）
  ├─ version    → "1.6.2"
  ├─ url        → https://github.com/chemmy-11/helios/releases/download/v1.6.2/update.zip
  ├─ required   → false
  └─ changelog  → 更新说明

update.zip                   # 更新包：js/ + css/ + index.html（web 资产）
```

**App 检查链路**：

1. 启动时 `checkForUpdates()` 拉取 `update_url`（指向 `raw.githubusercontent.com/chemmy-11/helios/master/update/version.json`）；
2. 远端版本 > 本地 → 提示更新 → `capgo download` 下载 `update.zip`；
3. 解压替换 www 资源 → **标记 next 激活**（不打断当前会话，下次启动生效）；
4. 存档在 `localStorage`（键名 `HELIOS_save_*`），只替换静态资源 → **存档天然不受影响**。

### 已知坑（务必记住）

| 坑 | 原因 | 修复 |
|---|---|---|
| `Download called without version` | `capgo download` 缺 `version` 参数 | 已修（commit `f159a1d` → v1.6.2） |
| push 后 App 检测不到新版本 | `raw.githubusercontent.com` **CDN 缓存延迟**（几分钟），`api.github.com` 已更新但 raw 未刷新 | 等几分钟再测；`curl -s https://raw.githubusercontent.com/.../update/version.json` 验证 |
| 手机网络无问题但下载失败 | 也可能是 CDN 缓存/断点问题 | 换 VPN 或等待重试 |

---

## 7. 发布 Checklist（完整流程）

1. `bash scripts/check.sh` —— 语法 + 残留 + APK 一致性；
2. 递增 `js/version.js` 的 `APP_VERSION`（若未递增）；
3. `bash scripts/build-apk.sh` —— 本地构建验证（含 md5 比对）；
4. `bash scripts/publish-release.sh "更新内容"` —— 自动建 release + 上传 + 更新 version.json + 推送；
5. push 失败 → 重试 / VPN / 可用 IP 检测；
6. 等 raw CDN 刷新后 `curl` 验证 `update/version.json`；
7. 手机 App 检测 → 下载 → 下次启动生效；
8. native 改动时额外提醒：**手动装 APK**。

---

## 8. 其他维护脚本（`scripts/`）

| 脚本 | 用途 |
|---|---|
| `build-apk.sh` | 一键构建：同步 www → `cap copy android` → `gradlew assembleDebug` → 复制 APK → md5 验证 |
| `check.sh` | 提交前自检（语法/残留/APK 一致性） |
| `publish-release.sh` | 全自动发布（见第 5 节） |
| `add-firmware-prompts.js` / `update-robot-prompts.js` | 机器人 System Prompt 维护 |
| `refactor-pure-llm.js` | LLM 化重构辅助 |
| `verify-*.js` | 各 dev-brief 的回归验证脚本（mock fetch/Capacitor，node 直跑） |

---

## 9. Issue 规范（`.github/ISSUE_TEMPLATE/`）

已启用 GitHub Forms（**关闭空白 Issue**），两个模板：

| 模板 | 用途 | 关键字段 |
|---|---|---|
| 🐛 缺陷报告 | 游戏 Bug | 端（Web/APK）/ 问题板块（对话/线索/阶段/结局/移动端/存档/OTA/构建）/ 版本号 / 复现步骤 |
| ✨ 功能建议 | 新玩法 / 改进 | 板块 / 场景 / 期望方案 / 改动范围预估（对应发布通道） |

约定：

- 标题格式沿用提交信息风格：`类型: 一句话描述`（如 `bug: 移动端指控后证据板不刷新`）。
- **公开仓库隐私红线**：截图/日志不得包含 DeepSeek API Key（sk- 开头）与个人信息——模板内已提示。
- Label：`bug` / `enhancement` 为模板自带；其余按板块补（`移动端`、`OTA`、`AI表现` 等）。
- 生命周期：修复 commit 引用 `#N` → 关闭前留结论 comment（根因 + 修复提交 + 验证方式）→ close。

## 10. PR 规范（`.github/PULL_REQUEST_TEMPLATE.md`）

主流程仍是 **master 单分支直推**（§1）；需要留评审痕迹的较大改动走 `feat/<简述>` / `fix/<简述>` 分支 + PR，**Squash 合并**。

模板核心是两项 HELIOS 特有检查：

1. **发布通道判断（必选）**：仅 web 层（js/css/index.html）→ 可走 OTA；含 native 层（android/、Capacitor 插件）→ 必须提醒用户重装 APK（§4 教训）。
2. **自测清单**：`check.sh` 全绿 / `build-apk.sh` 构建通过 / Web 端完整一轮冒烟（对话→线索→指控→结局）/ 真机验证（涉移动端）/ 版本号处理 / dev-brief 定稿（§3）/ 无 API Key。

## 11. CI 流程（`.github/workflows/ci.yml`）

触发：push 到 master、PR 到 master、手动（workflow_dispatch）；同分支新推送自动取消旧构建。

| Job | 内容 | 说明 |
|---|---|---|
| `check` | ① `bash scripts/check.sh`（语法 + 残留引用；APK 段无 APK 自动跳过） | 与本地提交前自检同源 |
| | ② 版本守卫：`js/version.js` ≥ `update/version.json` | 开发版不得落后于已发布 OTA 版本；发布清单提交（§5）后两者相等 |
| | ③ OTA 清单自洽：`version.json` 字段完整、`url` 的 tag 与 `version` 一致 | 防手改清单写错下载地址 |
| `android-build` | 内联安装 Capacitor 依赖（**package.json 不入库**）→ `bash scripts/build-apk.sh` 全流程 → 上传 `helios-build` 产物（HELIOS.apk + update.zip，保留 14 天） | CI 与本地构建同源；产物可在 Actions 页下载直接安装 |

- runner（ubuntu-latest）自带 Android SDK + JDK 17；CI 内补 `python` 符号链接（build 脚本用 `python` 而非 `python3`）并 `chmod +x android/gradlew`。
- 依赖版本与本地 `package.json` 保持一致（Capacitor 6 系）；升级依赖时**两边同步改**。
- CI 不做：真机验证、AI 回复质量（人设层面）、OTA 发布（仅随 `publish-release.sh` 手动触发）。
