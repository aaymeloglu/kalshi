#!/usr/bin/env bash
#
# serve-with-build.sh — build the Kalshi MCP fork, then start the stdio server.
#
# Intended as the `command` an MCP client (e.g. Claude Code's .mcp.json) points
# at, so the server always runs freshly-built code after a `git pull` without a
# manual `npm run build` step.
#
# CRITICAL: this is a stdio MCP server — stdout carries the JSON-RPC stream and
# MUST stay clean. All build/diagnostic output is redirected to stderr. The
# server process is exec'd so stdio and signals pass through unwrapped.
#
set -uo pipefail

# packages/mcp (this script lives in packages/mcp/scripts/)
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PKG_DIR"

echo "[kalshi-mcp] building fork (output on stderr)…" >&2
if npm run build >&2; then
  echo "[kalshi-mcp] build ok" >&2
else
  echo "[kalshi-mcp] build FAILED — falling back to last built dist if present" >&2
fi

if [ ! -f "$PKG_DIR/dist/cli.js" ]; then
  echo "[kalshi-mcp] no dist/cli.js and build failed — cannot start" >&2
  exit 1
fi

exec node "$PKG_DIR/dist/cli.js" "$@"
