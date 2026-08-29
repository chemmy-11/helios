# 开发简报 19：移动端"检查更新"修复（v1.7.1）

## 日期
2026-08-29

## 现象
玩家反馈移动端"检查更新"功能不正常。

## 排查

模拟器路线不可用（本机 SDK 无 emulator 包），改为代码级全链路审查。结论：三个缺陷均为 v1.6.2 建立更新机制起就存在，非 v1.7.0 引入。

| # | 缺陷 | 后果 |
|---|---|---|
| 1 | 清单请求 `fetch(raw.githubusercontent.com)` **无超时、单源**。raw.githubusercontent.com 在国内网络常被墙/挂起（对比：LLM 调用有 15s 超时，此处没有） | 手机点"检查更新"→ 请求挂死 → 永无弹窗，表现即"点了没反应" |
| 2 | 更新包下载单源（GitHub Release 直链 objects.githubusercontent.com），国内同样不稳 | 能看到更新提示但下载失败 |
| 3 | 失败/无效路径零反馈：网页版静默 return；按钮无"检查中"态；下载失败只写对话区消息——玩家从抽屉点按钮时对话区不可见 | 各类失败全部表现为"没反应" |

## 修复（js/game.js + scripts/publish-release.sh）

1. **清单多源 + 超时**：`fetchManifest()` 依次尝试 raw 直链 → jsDelivr CDN（`cdn.jsdelivr.net/gh/chemmy-11/helios@master/update/version.json`，国内可达；@master 有最长 12h 缓存故仅作兜底），单源 10s AbortController 超时。
2. **更新包镜像兜底**：`applyUpdate()` 主源失败后尝试 `zipMirrorUrl(version)` = jsDelivr tag 内 `update/update.zip`。要求 tag 指向的提交包含该文件 → `publish-release.sh` 在创建 release 前先 `git add -f update/update.zip` 入库提交。
3. **全程反馈**：手动检查时按钮变"⏳ 检查中…"并禁用（finally 恢复）；新增弹窗类型 `webNoUpdate`（网页版说明）、`updateFailed`（下载失败，含错误详情）、`updateCheckFailed` 增加具体错误信息。

## 验证

`scripts/verify-update-fix.js`（jsdom + mock fetch/Capacitor）11/11：网页版提示、raw 403/超时 → jsDelivr 兜底、全源失败报错、发现新版本弹窗、按钮状态恢复、下载主源失败 → 镜像接管 → next 激活、下载全失败弹窗。`verify-brief18.js` 回归 40/40。

## 备注

- 若设备网络对 GitHub 与 jsDelivr 均不可达，仍会收到明确的失败弹窗（含错误详情），可改走 Releases 页面下载新 APK。
- jsDelivr 镜像依赖"tag 内含 update/update.zip"，v1.7.0 的 tag 不含该文件（机制建立于本版本），镜像源自 v1.7.1 起有效。
