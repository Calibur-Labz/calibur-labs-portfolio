#!/usr/bin/env bash
#
# Build and release calibur-portfolio on the VPS.
#
# Layout under /var/www/calibur-portfolio:
#   repo/       source rsynced here by GitHub Actions (no git on the server);
#               builds happen here, never served from
#   shared/.env secrets (chmod 600), loaded at build and at runtime
#   releases/   one timestamped, self-contained standalone build per deploy
#   current ->  symlink to the live release (PM2 runs from here)
#
# The live site keeps running from its release while repo/ is rebuilt, so a
# build never takes it down. Only the final PM2 reload briefly restarts it.
#
# Run by GitHub Actions over SSH after it copies the source, or by hand to
# rebuild whatever is in repo/: bash repo/deploy/deploy.sh

set -euo pipefail

# Everything runs inside main(), which bash parses in full before starting.
# Bash otherwise reads scripts as it goes, so a sync landing mid-run could
# execute half of each version of this file.
main() {

APP_NAME="calibur-portfolio"
APP_ROOT="/var/www/calibur-portfolio"
REPO_DIR="$APP_ROOT/repo"
SHARED_ENV="$APP_ROOT/shared/.env"
RELEASES_DIR="$APP_ROOT/releases"
CURRENT_LINK="$APP_ROOT/current"
HEALTH_URL="http://127.0.0.1:3001/"
KEEP_RELEASES=3

log() { printf '\n==> %s\n' "$*"; }

# One deploy at a time, even if someone runs this by hand during a CI deploy.
exec 9>"$APP_ROOT/.deploy.lock"
if ! flock -w 1800 9; then
  echo "Another deploy has held the lock for 30 minutes; giving up." >&2
  exit 1
fi

# Non-interactive SSH sessions don't read ~/.bashrc, so load nvm if Node
# and PM2 were installed through it.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  set +u
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  set -u
fi

command -v node >/dev/null || { echo "node not found on PATH" >&2; exit 1; }
command -v pm2 >/dev/null || { echo "pm2 not found on PATH" >&2; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=9)?0:1)' \
  || { echo "Next.js 16 needs Node >= 20.9 (found $(node -v))" >&2; exit 1; }

[ -f "$SHARED_ENV" ] || { echo "Missing $SHARED_ENV" >&2; exit 1; }

cd "$REPO_DIR"
[ -f package-lock.json ] || { echo "No source in $REPO_DIR — has GitHub Actions synced it?" >&2; exit 1; }
# Written by the workflow before the sync; absent on a hand-copied tree.
if [ -f .deploy-revision ]; then
  log "Building $(cat .deploy-revision)"
else
  log "Building source in $REPO_DIR (no .deploy-revision)"
fi

# next build reads .env from the project root. NEXT_PUBLIC_SITE_URL is
# inlined into the bundle here, so it has to be present at build time.
ln -sfn "$SHARED_ENV" "$REPO_DIR/.env"

log "Installing dependencies"
npm ci --no-audit --no-fund

log "Building"
NODE_OPTIONS=--max-old-space-size=2048 npm run build

[ -f .next/standalone/server.js ] || {
  echo ".next/standalone/server.js not found — is output: \"standalone\" set in next.config.ts?" >&2
  exit 1
}

RELEASE="$RELEASES_DIR/$(date +%Y%m%d%H%M%S)"
log "Assembling release $RELEASE"
mkdir -p "$RELEASE/.next"
cp -a .next/standalone/. "$RELEASE/"
cp -a .next/static "$RELEASE/.next/static"
cp -a public "$RELEASE/public"
# Runtime secrets come from shared/.env via --env-file; don't leave a copy
# (or a dangling symlink) inside the release.
find "$RELEASE" -maxdepth 1 -name '.env*' -exec rm -f {} +

PREVIOUS=""
if [ -L "$CURRENT_LINK" ]; then
  PREVIOUS="$(readlink -f "$CURRENT_LINK")"
fi

# Swap the symlink atomically: rename(2) over the old link, so `current`
# always points at a complete release.
activate() {
  ln -sfn "$1" "$CURRENT_LINK.tmp"
  mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"
}

reload_app() {
  pm2 startOrReload "$REPO_DIR/ecosystem.config.cjs" --only "$APP_NAME" --update-env
}

healthy() {
  local i
  for i in $(seq 1 30); do
    if curl -fsS -o /dev/null --max-time 10 "$HEALTH_URL"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

log "Activating release"
activate "$RELEASE"
reload_app

log "Health check $HEALTH_URL"
if healthy; then
  echo "Healthy."
else
  echo "Health check FAILED for $RELEASE" >&2
  pm2 logs "$APP_NAME" --lines 50 --nostream || true
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    log "Rolling back to $PREVIOUS"
    activate "$PREVIOUS"
    reload_app
    rm -rf "$RELEASE"
    if healthy; then
      echo "Rollback healthy." >&2
    else
      echo "Rollback release is not healthy either — check pm2 logs." >&2
    fi
  else
    echo "No previous release to roll back to." >&2
  fi
  exit 1
fi

pm2 save >/dev/null

log "Pruning old releases (keeping $KEEP_RELEASES)"
ACTIVE="$(readlink -f "$CURRENT_LINK")"
ls -1d "$RELEASES_DIR"/*/ 2>/dev/null | sed 's:/*$::' | sort -r | tail -n +$((KEEP_RELEASES + 1)) |
  while read -r old; do
    [ "$(readlink -f "$old")" = "$ACTIVE" ] && continue
    echo "Removing $old"
    rm -rf "$old"
  done

log "Deployed $(basename "$RELEASE")"

}

main "$@"
exit
