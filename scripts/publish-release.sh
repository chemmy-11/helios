#!/usr/bin/env bash
# 发布新版本：构建 → 创建 GitHub release → 上传 APK + update.zip → 更新 update/version.json → 推送
# 用法: bash scripts/publish-release.sh "更新内容第一行|第二行|..."（changelog 用 | 分隔行）
set -e
cd "$(dirname "$0")/.."

# 1. 版本号（从 js/version.js 读取）
VERSION=$(grep "const APP_VERSION" js/version.js | sed "s/.*'\(.*\)'.*/\1/")
echo "==> 发布版本: v$VERSION"

# 2. 构建（含 update.zip）
bash scripts/build-apk.sh

# 3. 获取 GitHub token（git credential）
TOKEN=$(printf "protocol=https\nhost=github.com\n\n" | git credential fill 2>/dev/null | grep '^password=' | cut -d= -f2-)
if [ -z "$TOKEN" ]; then echo "!! 无法获取 GitHub 凭据"; exit 1; fi

# 4. changelog
CHANGELOG="${1:-新版本 v$VERSION 已发布，包含新的内容与修复。}"
CHANGELOG_BODY=$(echo "$CHANGELOG" | sed 's/|/\n/g')
TAG="v$VERSION"

# 5. 创建 release（已发布状态）
python - "$TOKEN" "$TAG" "$CHANGELOG_BODY" <<'PY'
import json, sys, urllib.request
token, tag, body = sys.argv[1], sys.argv[2], sys.argv[3]
req = urllib.request.Request(
    'https://api.github.com/repos/chemmy-11/helios/releases',
    data=json.dumps({"tag_name": tag, "name": "HELIOS " + tag, "body": body, "draft": False}).encode(),
    headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"},
    method='POST')
try:
    resp = urllib.request.urlopen(req)
    d = json.load(resp)
    print("release id:", d["id"], "| tag:", d["tag_name"])
    open('.reasonix/publish-rel-id.txt', 'w').write(str(d["id"]))
except urllib.error.HTTPError as e:
    print("!! 创建 release 失败:", e.code, e.read().decode()[:300])
    sys.exit(1)
PY

# 6. 上传 asset（APK + update.zip）
RELEASE_ID=$(cat .reasonix/publish-rel-id.txt)
upload_asset() {
  local file=$1 name=$2
  python - "$TOKEN" "$RELEASE_ID" "$file" "$name" <<'PY'
import json, sys, urllib.request, os
token, rid, path, name = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
data = open(path, 'rb').read()
req = urllib.request.Request(
    f'https://uploads.github.com/repos/chemmy-11/helios/releases/{rid}/assets?name={name}',
    data=data,
    headers={"Authorization": "Bearer " + token, "Content-Type": "application/octet-stream"},
    method='POST')
try:
    d = json.load(urllib.request.urlopen(req))
    print("  asset:", d["name"], d["size"], "bytes")
except urllib.error.HTTPError as e:
    print(f"!! 上传 {name} 失败:", e.code, e.read().decode()[:200])
    sys.exit(1)
PY
}
echo "==> 上传 assets"
upload_asset HELIOS.apk HELIOS.apk
upload_asset update.zip update.zip

# 7. 更新 update/version.json（指向 release 的 zip 下载地址）
python - "$VERSION" "$TAG" "$CHANGELOG_BODY" <<'PY'
import json, sys
sys.stdout.reconfigure(encoding='utf-8')  # Windows 控制台 GBK 无法打印 emoji，强制 UTF-8
version, tag, changelog = sys.argv[1], sys.argv[2], sys.argv[3]
manifest = {
    "version": version,
    "url": f"https://github.com/chemmy-11/helios/releases/download/{tag}/update.zip",
    "required": False,
    "changelog": changelog
}
with open('update/version.json', 'w', encoding='utf-8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print("==> update/version.json 已更新:", json.dumps(manifest, ensure_ascii=False))
PY

# 8. 提交并推送 version.json
git add update/version.json
git commit -m "chore: 发布 v$VERSION 更新清单" || echo "（无 version.json 变更，跳过提交）"
git push origin master

# 9. 清理
rm -f .reasonix/publish-rel-id.txt
echo "==> 发布完成: v$VERSION（APK + update.zip + 更新清单已上线）"
