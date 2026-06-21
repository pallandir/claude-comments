#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m  %s\n' "$*"; }
info() { printf '  \033[34m→\033[0m  %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m  %s\n' "$*"; }
fail() { printf '\n\033[31mError:\033[0m %s\n\n' "$*" >&2; exit 1; }

bold "Redline setup"
echo ""

# Check Node >= 20
NODE_MAJOR="$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1)" || true
if [[ -z "$NODE_MAJOR" ]]; then
  fail "Node.js not found. Install Node 20 or newer from https://nodejs.org"
fi
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  fail "Node $NODE_MAJOR found, but Redline requires Node 20+. Run 'nvm use' or install a newer version."
fi
ok "Node v$(node --version | sed 's/v//')"

# Install dependencies
info "Installing dependencies..."
npm install --prefix "$REPO_ROOT" --silent
ok "Dependencies installed"

# Build the extension
info "Building browser extension..."
npm run build --workspace @redline/extension --prefix "$REPO_ROOT" --silent
ok "Extension built → $REPO_ROOT/extension/dist"

# Optional: register the MCP server via the claude CLI
if command -v claude &>/dev/null; then
  echo ""
  read -r -p "  Register the MCP server with the Claude CLI now? (y/N) " REGISTER
  if [[ "${REGISTER,,}" == "y" ]]; then
    claude mcp add redline -- npx -y @redline/mcp-server
    ok "MCP server registered (claude mcp add)"
  else
    info "Skipped CLI registration. Use the plugin path in Claude Code instead (see next steps)."
  fi
else
  info "claude CLI not found on PATH. Use the plugin path in Claude Code to register the MCP server."
fi

# Print next steps
echo ""
bold "Setup complete. Two steps left:"
echo ""
printf '  1. Load the extension in Chrome:\n'
printf '     chrome://extensions  →  Developer mode  →  Load unpacked\n'
printf '     →  %s\n' "$REPO_ROOT/extension/dist"
echo ""
printf '  2. In Claude Code, install the plugin (MCP server + /redline skill):\n'
printf '     /plugin marketplace add pallandir/redline\n'
printf '     /plugin install redline@redline\n'
echo ""
printf '  Then open your frontend, click the Redline toolbar icon, copy the\n'
printf '  "/redline <id>" string from the toolbar, and paste it into Claude Code.\n'
echo ""
