#!/usr/bin/env bash
# 一键构建 HELIOS APK
# 用法: bash scripts/build-apk.sh
# 流程: 同步 www → cap copy → gradlew assembleDebug → 复制到根目录 → md5 逐字节验证
set -e
cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-C:/Program Files/Java/jdk-17}"
export PATH="$JAVA_HOME/bin:$PATH"

echo "==> 1/5 同步 www（根目录 → www/）"
# 全新 checkout 环境无 www/（被 .gitignore），先建目录
mkdir -p www
cp index.html www/index.html
cp -r css/. www/css/
cp -r js/. www/js/

echo "==> 2/5 cap sync android"
# sync（非 copy）：会生成 capacitor-cordova-android-plugins 桥接目录，
# 该目录不入库而 settings.gradle include 它 —— 全新环境仅 copy 会导致 gradle 失败
npx cap sync android

echo "==> 3/5 gradle assembleDebug"
(cd android && ./gradlew assembleDebug)

echo "==> 4/5 复制 APK 到根目录"
cp android/app/build/outputs/apk/debug/app-debug.apk HELIOS.apk

echo "==> 5/5 md5 逐字节验证 APK 与源码"
python - <<'PY'
import zipfile, hashlib, sys
h = lambda d: hashlib.md5(d).hexdigest()[:8]
ok = True
try:
    with zipfile.ZipFile('HELIOS.apk') as z:
        for f in ['js/data.js', 'js/game.js', 'index.html', 'css/style.css', 'css/mobile.css', 'js/version.js']:
            src = h(open(f, 'rb').read())
            apk = h(z.read('assets/public/' + f))
            match = src == apk
            ok = ok and match
            print(f"  {f}: {'OK' if match else 'MISMATCH'}")
except KeyError as e:
    print(f"  APK 缺少资源: {e}")
    ok = False
if not ok:
    print("!! APK 与源码不一致，构建未通过")
    sys.exit(1)
print("==> 构建完成: HELIOS.apk")
PY

echo "==> 6/6 生成在线更新包 update.zip"
python - <<'PY'
import zipfile, os
files = ['index.html']
for root, dirs, fs in os.walk('css'):
    for f in fs: files.append(os.path.join(root, f).replace('\\', '/'))
for root, dirs, fs in os.walk('js'):
    for f in fs: files.append(os.path.join(root, f).replace('\\', '/'))
with zipfile.ZipFile('update.zip', 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(f, f)
        print(f"  + {f}")
print("==> update.zip 生成完成")
PY
ls -lh HELIOS.apk update.zip | awk '{print $NF, $5}'
