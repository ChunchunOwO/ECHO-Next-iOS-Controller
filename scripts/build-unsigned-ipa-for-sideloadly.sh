#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS because iOS builds require Xcode." >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild not found. Install Xcode from the App Store first." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node not found. Install Node.js first." >&2
  exit 1
fi

echo "Installing JavaScript dependencies..."
if [[ -f package-lock.json ]]; then
  npm ci
else
  npm install
fi

echo "Generating iOS native project..."
npx expo prebuild --platform ios --clean

if command -v pod >/dev/null 2>&1; then
  echo "Installing CocoaPods dependencies..."
  (cd ios && pod install)
else
  echo "CocoaPods not found. Expo may have installed pods during prebuild; continuing." >&2
fi

WORKSPACE="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
PROJECT="$(find ios -maxdepth 1 -name '*.xcodeproj' -print -quit)"
BUILD_DIR="$ROOT_DIR/build/ios-unsigned"
PAYLOAD_DIR="$BUILD_DIR/Payload"
IPA_PATH="$BUILD_DIR/ECHO-iPhone-unsigned.ipa"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

if [[ -n "${WORKSPACE:-}" ]]; then
  LIST_JSON="$(xcodebuild -workspace "$WORKSPACE" -list -json)"
  BUILD_TARGET_ARGS=(-workspace "$WORKSPACE")
else
  if [[ -z "${PROJECT:-}" ]]; then
    echo "Could not find an Xcode workspace or project under ios/." >&2
    exit 1
  fi
  LIST_JSON="$(xcodebuild -project "$PROJECT" -list -json)"
  BUILD_TARGET_ARGS=(-project "$PROJECT")
fi

SCHEME="$(LIST_JSON="$LIST_JSON" node <<'NODE'
const fs = require('fs');

const list = JSON.parse(process.env.LIST_JSON || '{}');
const appConfig = JSON.parse(fs.readFileSync('app.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const schemes = (list.workspace || list.project || {}).schemes || [];
const preferredNames = [
  appConfig.expo?.name,
  appConfig.expo?.slug,
  pkg.name,
].filter(Boolean);

const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const preferred = new Set(preferredNames.flatMap((name) => {
  const normalized = normalize(name);
  return [normalized, normalized.replace(/ios$/, '')].filter(Boolean);
}));

const ignored = /^(pods-|pods$)|hermes|react|rct|yoga|folly|boost|glog|fmt|asyncstorage|codegen|dependencies|expo/i;
const usableSchemes = schemes.filter((scheme) => !ignored.test(scheme));
const selected =
  usableSchemes.find((scheme) => preferred.has(normalize(scheme))) ||
  usableSchemes.find((scheme) => preferredNames.some((name) => normalize(scheme).includes(normalize(name)))) ||
  usableSchemes[0] ||
  schemes[0] ||
  '';

console.log(selected);
NODE
)"

if [[ -z "$SCHEME" ]]; then
  echo "Could not detect an Xcode scheme." >&2
  exit 1
fi

echo "Building unsigned iphoneos app with scheme: $SCHEME"
xcodebuild \
  "${BUILD_TARGET_ARGS[@]}" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath "$BUILD_DIR/DerivedData" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build

PRODUCTS_DIR="$BUILD_DIR/DerivedData/Build/Products"
APP_PATH="$(find "$PRODUCTS_DIR" -type d -name '*.app' -not -path '*/Payload/*' -print -quit 2>/dev/null || true)"
if [[ -z "$APP_PATH" ]]; then
  echo "Could not find built .app output." >&2
  echo "Available Xcode products under $PRODUCTS_DIR:" >&2
  find "$PRODUCTS_DIR" -maxdepth 3 -print >&2 2>/dev/null || true
  exit 1
fi

mkdir -p "$PAYLOAD_DIR"
cp -R "$APP_PATH" "$PAYLOAD_DIR/"
(cd "$BUILD_DIR" && /usr/bin/zip -qry "$IPA_PATH" Payload)

echo
echo "Unsigned IPA created:"
echo "$IPA_PATH"
echo
echo "Install path:"
echo "1. Open Sideloadly on Windows or macOS."
echo "2. Select this IPA."
echo "3. Sign/install with a free Apple ID."
echo "4. On iPhone, trust the Apple ID profile in Settings > General > VPN & Device Management."
echo
echo "Free Apple ID signing usually expires after 7 days."
