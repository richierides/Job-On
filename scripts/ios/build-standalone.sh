#!/usr/bin/env bash
# A self-contained native app: no Expo Go, development launcher or Metro server.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${HOMETAKING_APPLE_TEAM:?Set HOMETAKING_APPLE_TEAM to your Xcode development team ID}"
entitlements="$(mktemp -t hometaking-entitlements).plist"
trap 'rm -f "$entitlements"' EXIT
cat > "$entitlements" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict/></plist>
PLIST
EXPO_NO_DOTENV=1 xcodebuild \
  -workspace ios/Hometaking.xcworkspace -scheme Hometaking \
  -configuration Release -sdk iphoneos -destination 'generic/platform=iOS' \
  -derivedDataPath "${HOMETAKING_BUILD_DIR:-/tmp/hometaking-native-build}" \
  DEVELOPMENT_TEAM="$HOMETAKING_APPLE_TEAM" CODE_SIGN_STYLE=Automatic \
  CODE_SIGN_ENTITLEMENTS="$entitlements" COMPILER_INDEX_STORE_ENABLE=NO \
  -allowProvisioningUpdates build
