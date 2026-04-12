#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

npm install
npm run build
npm run tauri build -- --bundles app

APP_PATH="src-tauri/target/release/bundle/macos/OpenClawManager.app"
DMG_DIR="src-tauri/target/release/bundle/dmg"
DMG_SCRIPT="${DMG_DIR}/bundle_dmg.sh"
DMG_NAME="OpenClawManager_1.1.1_aarch64.dmg"

if [ ! -d "$APP_PATH" ]; then
  echo "未找到 .app 产物: $APP_PATH" >&2
  exit 1
fi

if [ ! -f "$DMG_SCRIPT" ]; then
  echo "未找到 DMG 打包脚本: $DMG_SCRIPT" >&2
  echo "提示：请先至少运行一次 'npm run tauri build' 或安装生成 bundle 工具链。" >&2
  exit 1
fi

mkdir -p "$DMG_DIR"
rm -f "$DMG_DIR/$DMG_NAME"

bash "$DMG_SCRIPT" --skip-jenkins "$DMG_DIR/$DMG_NAME" "$APP_PATH"

echo "发布完成："
ls -lh "$APP_PATH" "$DMG_DIR/$DMG_NAME"
