#!/bin/bash

echo ""
echo "Setting up Prototype Playground..."
echo ""

# ── Check Node.js ──────────────────────────────────────────────────────────────
if ! command -v node &> /dev/null; then
  echo "Node.js is required. Opening nodejs.org..."
  open "https://nodejs.org"
  echo ""
  echo "Install Node.js, then double-click install.sh again to continue."
  exit 1
fi

echo "✓ Node.js $(node -v)"

# ── Check Git ──────────────────────────────────────────────────────────────────
if ! command -v git &> /dev/null; then
  echo "Git is required. Opening download page..."
  open "https://git-scm.com/download/mac"
  echo ""
  echo "Install Git, then double-click install.sh again to continue."
  exit 1
fi

echo "✓ Git $(git --version | awk '{print $3}')"

# ── Clone or update ────────────────────────────────────────────────────────────
DEST="$HOME/Documents/prototype-playground"

if [ -d "$DEST" ]; then
  echo ""
  echo "Folder already exists — pulling latest changes..."
  git -C "$DEST" pull
else
  echo ""
  echo "Downloading Prototype Playground..."
  git clone https://github.com/jose-huge/prototype-playground.git "$DEST"
fi

# ── Install dependencies ───────────────────────────────────────────────────────
echo ""
echo "Installing dependencies (this takes about 30–60 seconds)..."
npm install --prefix "$DEST"

# ── Check port 3000 ───────────────────────────────────────────────────────────
if lsof -ti tcp:3000 &> /dev/null; then
  echo ""
  echo "Port 3000 is already in use — another playground may already be running."
  echo "Open http://localhost:3000?reset=true in your browser or close the other instance first."
  exit 0
fi

# ── Start dev server ───────────────────────────────────────────────────────────
echo ""
echo "Starting Prototype Playground..."
nohup npm run dev --prefix "$DEST" > "$DEST/.dev.log" 2>&1 &

# ── Open browser ──────────────────────────────────────────────────────────────
echo "Waiting for server to start..."
sleep 5
open "http://localhost:3000?reset=true"

echo ""
echo "✓ Prototype Playground is running at localhost:3000"
echo ""
