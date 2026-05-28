#!/bin/bash

echo ""
echo "Updating Prototype Playground..."
echo ""

DEST="$HOME/Documents/prototype-playground"

# ── Check folder exists ────────────────────────────────────────────────────────
if [ ! -d "$DEST" ]; then
  echo "Playground folder not found at $DEST"
  echo "Run install.sh first."
  exit 1
fi

# ── Pull latest changes ────────────────────────────────────────────────────────
echo "Pulling latest changes..."
git -C "$DEST" pull

# ── Install any new dependencies ───────────────────────────────────────────────
echo ""
echo "Checking dependencies..."
npm install --prefix "$DEST"

# ── Restart dev server ────────────────────────────────────────────────────────
echo ""
echo "Restarting Prototype Playground..."

# Kill any running dev server on port 3000
lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true

nohup npm run dev --prefix "$DEST" > "$DEST/.dev.log" 2>&1 &

# ── Open browser ──────────────────────────────────────────────────────────────
echo "Waiting for server to start..."
sleep 5
open "http://localhost:3000"

echo ""
echo "✓ Prototype Playground is up to date and running at localhost:3000"
echo ""
