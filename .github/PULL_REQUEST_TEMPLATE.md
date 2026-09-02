> 主流程：master 单分支直推（见 docs/github-maintenance.md §1）。
> 需要留评审痕迹的较大改动走 `feat/<简述>` / `fix/<简述>` 分支 + 本模板，**Squash 合并**保持历史「一条提交 = 一个完整改动」。

## 关联

<!-- dev-brief-N（如有）/ Issue #N -->

Closes #

## 改动内容

<!-- 分条列出关键改动，写清根因（fix 类）与设计决策（feat 类） -->

-

## 发布通道判断（必选一项）

<!-- 见维护手册 §4：web 层改动可走 OTA 在线更新；native 层必须重装 APK -->

- [ ] 仅 web 层（js/ css/ index.html）→ 可走 OTA（update.zip）
- [ ] 含 native 层（android/、Capacitor 插件）→ 必须提醒用户重装 APK

## 自测清单

- [ ] `bash scripts/check.sh` 全绿（语法 + 残留引用 + APK 一致性）
- [ ] `bash scripts/build-apk.sh` 构建通过，md5 逐字节校验 OK
- [ ] Web 端冒烟通过（完整跑一轮：对话 → 收集线索 → 指控/报告 → 结局）
- [ ] Android 真机验证通过（涉及移动端布局/键盘时，注明机型）
- [ ] 版本号已按约定处理：开发中 `js/version.js` 递增；正式发布走 `scripts/publish-release.sh`（自动同步 update/version.json）
- [ ] dev-brief 已定稿（涉及功能开发时）
- [ ] 代码与正文中无 API Key / 个人信息（公开仓库）

## 风险与影响面

<!-- 可能影响的板块；存档兼容性（localStorage 键名/结构变化需特别说明） -->
