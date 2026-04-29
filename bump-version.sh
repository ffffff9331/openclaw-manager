#!/bin/bash
# bump-version.sh — 同步版本号到 package.json 和 src-tauri/tauri.conf.json
# 用法: ./bump-version.sh 2.0.6

set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "用法: $0 <版本号>"
  echo "示例: $0 2.0.6"
  exit 1
fi

VERSION="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$SCRIPT_DIR/package.json" ] || [ ! -f "$SCRIPT_DIR/src-tauri/tauri.conf.json" ]; then
  echo "错误: 请在 openclaw-manager 项目根目录运行此脚本"
  exit 1
fi

# 更新 package.json
python3 -c "
import json, sys
with open('$SCRIPT_DIR/package.json') as f:
    d = json.load(f)
d['version'] = '$VERSION'
with open('$SCRIPT_DIR/package.json', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(f'package.json → $VERSION')
"

# 更新 src-tauri/tauri.conf.json
python3 -c "
import json, sys
with open('$SCRIPT_DIR/src-tauri/tauri.conf.json') as f:
    d = json.load(f)
d['version'] = '$VERSION'
with open('$SCRIPT_DIR/src-tauri/tauri.conf.json', 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(f'src-tauri/tauri.conf.json → $VERSION')
"

echo ""
echo "✅ 版本号已同步为 $VERSION"
echo "记得 git commit 和打 tag："
echo "  git add -A && git commit -m 'chore: bump version to $VERSION'"
echo "  git tag v$VERSION"
