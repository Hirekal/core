#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if command -v nvm >/dev/null 2>&1; then
  # shellcheck disable=SC1090
  source "$(command -v nvm | xargs dirname)/../nvm.sh" 2>/dev/null || true
fi

if [ -f .nvmrc ] && command -v nvm >/dev/null 2>&1; then
  nvm install
  nvm use
fi

echo "Using Node $(node -v)"
echo "Installing dependencies..."
npm install

echo ""
echo "Done. Run:"
echo "  npm run dev:api       # NestJS API  → http://localhost:3000"
echo "  npm run dev:console   # React app   → http://localhost:5173"
echo "  npm run dev           # both in parallel"
