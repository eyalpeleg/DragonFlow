#!/usr/bin/env bash
# Release flow: bump version, commit, build release APK, copy to ./distro/
#
# Usage:
#   ./release.sh              # bumps patch (1.0.1 -> 1.0.2) + versionCode +1
#   ./release.sh -v 1.2.3     # sets explicit version, still bumps versionCode +1
#
# Requires ~/.dragonflow/keystore.env (created during release signing setup).

set -euo pipefail

cd "$(dirname "$0")"

EXPLICIT_VERSION=""
while [ $# -gt 0 ]; do
  case "$1" in
    -v|--version)
      [ $# -ge 2 ] || { echo "✗ -v requires a value (e.g. -v 1.2.3)" >&2; exit 1; }
      EXPLICIT_VERSION="$2"
      shift 2
      ;;
    -h|--help)
      sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "✗ Unknown argument: $1" >&2
      echo "Usage: $0 [-v X.Y.Z]" >&2
      exit 1
      ;;
  esac
done

if [ -n "$EXPLICIT_VERSION" ]; then
  echo "$EXPLICIT_VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$' \
    || { echo "✗ Version must be X.Y.Z (got: $EXPLICIT_VERSION)" >&2; exit 1; }
fi

step() { printf "\n\033[1;34m→ %s\033[0m\n" "$1"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$1"; }
fail() { printf "\033[1;31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

# 1. Sanity checks
[ -f "$HOME/.dragonflow/keystore.env" ] || fail "Missing ~/.dragonflow/keystore.env"
[ -z "$(git status --porcelain)" ] || fail "Working tree is dirty. Commit or stash first."

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" != "main" ] || fail "Refusing to release from main. Switch to develop."

# 2. Bump version in app.json (buildTimestamp is set by app.config.ts at prebuild)
step "Bumping version"
READ=$(node -e "
const fs = require('fs');
const p = './app.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const explicit = process.argv[1] || '';
const cur = j.expo.version;
let next;
if (explicit) {
  next = explicit;
} else {
  const [maj, min, pat] = cur.split('.').map(Number);
  next = \`\${maj}.\${min}.\${pat + 1}\`;
}
j.expo.version = next;
j.expo.android.versionCode = (j.expo.android.versionCode || 0) + 1;
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
console.log(next + ':' + j.expo.android.versionCode);
" "$EXPLICIT_VERSION")

VERSION="${READ%%:*}"
VCODE="${READ##*:}"
ok "v$VERSION  (versionCode $VCODE)"

# 3. Pre-commit checks (mirrors /precommit skill: tsc + eslint + jest)
step "TypeScript"
npx tsc --noEmit
ok "TypeScript clean"

step "ESLint"
npx eslint app/ src/
ok "ESLint clean"

step "Jest"
npm test --silent -- --passWithNoTests
ok "Tests passed"

# 4. Commit
step "Committing version bump"
git add app.json
git commit -m "chore(release): bump to v$VERSION (versionCode $VCODE)"
ok "Committed $(git rev-parse --short HEAD)"

# 5. Build
step "Building release APK (this takes a few minutes)"
# shellcheck disable=SC1090
source "$HOME/.dragonflow/keystore.env"
npm run build:apk

# 6. Copy into ./distro/ (gitignored)
APK_SRC="android/app/build/outputs/apk/release/app-release.apk"
mkdir -p distro
APK_DEST="distro/DragonFlow-v${VERSION}.apk"
[ -f "$APK_SRC" ] || fail "Build finished but APK not found at $APK_SRC"
cp "$APK_SRC" "$APK_DEST"
ABS_DEST="$(pwd)/$APK_DEST"
ok "APK copied to $ABS_DEST"

# 7. Summary
SIZE=$(ls -lh "$APK_DEST" | awk '{print $5}')
printf "\n\033[1;32m=========================================\n"
printf "  DragonFlow v%s ready\n" "$VERSION"
printf "  versionCode: %s\n" "$VCODE"
printf "  size:        %s\n" "$SIZE"
printf "  path:        %s\n" "$ABS_DEST"
printf "=========================================\033[0m\n"
printf "\nNext: drag into your family Drive folder, then 'git push origin %s' when ready.\n" "$BRANCH"
