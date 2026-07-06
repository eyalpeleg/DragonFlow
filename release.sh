#!/usr/bin/env bash
# Release flow: bump version, commit, build release artifact, copy to ./distro/
#
# Usage:
#   ./release.sh              # APK for sideload (default)
#   ./release.sh --play       # AAB for Google Play upload
#   ./release.sh -v 1.2.3     # explicit version (still bumps versionCode +1)
#   ./release.sh --play -v 1.2.3
#
# Requires ~/.dragonflow/keystore.env (created during release signing setup).

set -euo pipefail

cd "$(dirname "$0")"

EXPLICIT_VERSION=""
PLAY=0
while [ $# -gt 0 ]; do
  case "$1" in
    -v|--version)
      [ $# -ge 2 ] || { echo "✗ -v requires a value (e.g. -v 1.2.3)" >&2; exit 1; }
      EXPLICIT_VERSION="$2"
      shift 2
      ;;
    --play)
      PLAY=1
      shift
      ;;
    -h|--help)
      sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "✗ Unknown argument: $1" >&2
      echo "Usage: $0 [--play] [-v X.Y.Z]" >&2
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
if [ "$PLAY" -eq 1 ]; then
  step "Building release AAB for Google Play (this takes a few minutes)"
  ARTIFACT_KIND="AAB"
  ARTIFACT_EXT="aab"
  ARTIFACT_SRC="android/app/build/outputs/bundle/release/app-release.aab"
  BUILD_CMD="build:aab"
else
  step "Building release APK (this takes a few minutes)"
  ARTIFACT_KIND="APK"
  ARTIFACT_EXT="apk"
  ARTIFACT_SRC="android/app/build/outputs/apk/release/app-release.apk"
  BUILD_CMD="build:apk"
fi
# shellcheck disable=SC1090
source "$HOME/.dragonflow/keystore.env"
npm run "$BUILD_CMD"

# 6. Copy into ./distro/ (gitignored)
mkdir -p distro
ARTIFACT_DEST="distro/DragonFlow-v${VERSION}.${ARTIFACT_EXT}"
[ -f "$ARTIFACT_SRC" ] || fail "Build finished but $ARTIFACT_KIND not found at $ARTIFACT_SRC"
cp "$ARTIFACT_SRC" "$ARTIFACT_DEST"
ABS_DEST="$(pwd)/$ARTIFACT_DEST"
ok "$ARTIFACT_KIND copied to $ABS_DEST"

# 7. Summary
SIZE=$(ls -lh "$ARTIFACT_DEST" | awk '{print $5}')
printf "\n\033[1;32m=========================================\n"
printf "  DragonFlow v%s ready\n" "$VERSION"
printf "  versionCode: %s\n" "$VCODE"
printf "  artifact:    %s\n" "$ARTIFACT_KIND"
printf "  size:        %s\n" "$SIZE"
printf "  path:        %s\n" "$ABS_DEST"
printf "=========================================\033[0m\n"
if [ "$PLAY" -eq 1 ]; then
  printf "\nNext: upload AAB to Play Console (Internal testing), then 'git push origin %s'.\n" "$BRANCH"
  printf "See docs/release/PLAY_SUBMISSION.md for the full Play upload flow.\n"
else
  printf "\nNext: drag into your family Drive folder, then 'git push origin %s' when ready.\n" "$BRANCH"
fi
