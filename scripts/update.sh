#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m  %s\n' "$*"; }
info() { printf '  \033[34m→\033[0m  %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m  %s\n' "$*"; }

bold "Redline update"
echo ""

# Pull latest (warn if dirty, never force)
cd "$REPO_ROOT"
if ! git diff --quiet || ! git diff --cached --quiet; then
  warn "Working tree is dirty. Skipping git pull. Commit or stash your changes first."
else
  info "Pulling latest changes..."
  git pull --ff-only
  ok "Repository updated"
fi

# Reinstall in case lockfile changed
info "Installing dependencies..."
npm install --prefix "$REPO_ROOT" --silent
ok "Dependencies up to date"

# Rebuild the extension
info "Rebuilding browser extension..."
npm run build --workspace @redline/extension --prefix "$REPO_ROOT" --silent
ok "Extension rebuilt → $REPO_ROOT/extension/dist"

echo ""
bold "Update complete. Two manual steps:"
echo ""
printf '  1. In Chrome, go to chrome://extensions and click the\n'
printf '     refresh icon on the Redline card to pick up the new build.\n'
echo ""
printf '  2. In Claude Code, update the plugin:\n'
printf '     /plugin update redline\n'
echo ""
