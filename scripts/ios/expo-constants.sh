#!/usr/bin/env bash
# Equivalent to Expo SDK 54 get-app-config-ios.sh, with quoted project paths.
set -eo pipefail
PROJECT_ROOT="${PODS_ROOT}/../.."
EXPO_CONSTANTS_PACKAGE_DIR="${PROJECT_ROOT}/node_modules/expo-constants"
case "${BUNDLE_FORMAT}" in
  shallow) RESOURCE_DEST="${CONFIGURATION_BUILD_DIR}/EXConstants.bundle" ;;
  deep) RESOURCE_DEST="${CONFIGURATION_BUILD_DIR}/EXConstants.bundle/Contents/Resources" ;;
  *) echo "Unsupported bundle format: ${BUNDLE_FORMAT}" >&2; exit 1 ;;
esac
mkdir -p "${RESOURCE_DEST}"
cd "${PROJECT_ROOT}"
"${EXPO_CONSTANTS_PACKAGE_DIR}/scripts/with-node.sh" "${EXPO_CONSTANTS_PACKAGE_DIR}/scripts/getAppConfig.js" "${PROJECT_ROOT}" "${RESOURCE_DEST}"
