#!/usr/bin/env bash
# 提交前自检：语法 + 关键残留引用 + APK 一致性
# 用法: bash scripts/check.sh（退出码 0 = 全部通过）
cd "$(dirname "$0")/.."
fail=0

echo "==> 1/3 语法检查"
node --check js/data.js || fail=1
node --check js/game.js || fail=1
[ $fail -eq 0 ] && echo "  OK"

echo "==> 2/3 关键残留引用检查（已移除/过时的符号）"
PATTERN='addSystemMessage(|gameTime|realStart|robotCycleState|advanceRobotCycles|getRobotsAtLocation|initRobotCycles|consumeTime|getTimeStr|updateCountdownDisplay|startGameLoop|checkPhaseTransition|drawer-nav|哲学觉醒|robot_behaviors'
if grep -rn "$PATTERN" js/data.js js/game.js index.html css/ 2>/dev/null; then
  echo "  !! 发现残留，请清理"
  fail=1
else
  echo "  无残留 OK"
fi

echo "==> 3/3 APK 与源码一致性（HELIOS.apk 存在时）"
if [ -f HELIOS.apk ]; then
  python - <<'PY'
import zipfile, hashlib, sys
h = lambda d: hashlib.md5(d).hexdigest()[:8]
ok = True
try:
    with zipfile.ZipFile('HELIOS.apk') as z:
        for f in ['js/data.js', 'js/game.js', 'index.html', 'css/style.css', 'css/mobile.css']:
            if h(open(f, 'rb').read()) != h(z.read('assets/public/' + f)):
                print(f"  {f}: MISMATCH")
                ok = False
except KeyError:
    print("  APK 缺少资源文件")
    ok = False
sys.exit(0 if ok else 1)
PY
  [ $? -eq 0 ] || fail=1
else
  echo "  无 APK，跳过（改代码后建议先跑 scripts/build-apk.sh）"
fi

if [ $fail -eq 0 ]; then
  echo "==> 全部通过 ✓"
else
  echo "==> 存在问题 ✗"
fi
exit $fail
