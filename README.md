# Prototype Playground
A blank starter for designers to build components from Figma using Claude Code.

---

## Quickstart

**Mac** — paste this into Terminal (Cmd + Space → type Terminal → hit enter):
```bash
curl -fsSL https://raw.githubusercontent.com/jose-huge/prototype-playground/main/install.sh | bash
```

**Windows** — paste this into PowerShell:
```powershell
irm https://raw.githubusercontent.com/jose-huge/prototype-playground/main/install.ps1 | iex
```

The script installs everything and opens the playground automatically.
For future updates run `update.sh` (Mac) or `update.bat` (Windows) from the playground folder.

Prefer to do it manually? [Download install.sh](install.sh) or [install.bat](install.bat) and double-click.

---

## What this is

Prototype Playground connects your Figma file to Claude Code so you can build, preview, and iterate on components without writing code. When you're done, package the component for your dev team in one click.

---

## First time setup

You'll need two things installed before you start:

- **Node.js** — download from [nodejs.org](https://nodejs.org) (click the LTS version)
- **Claude Code** — follow the install guide at [claude.ai/code](https://claude.ai/code)

If you're not sure whether you have these, open Terminal and ask Claude Code — it will check for you.

---

## Manual setup

Only needed if the quickstart script doesn't work.

**Step 1 — Open Terminal**
Press `Cmd + Space`, type `Terminal`, hit enter.

**Step 2 — Go to your Desktop**
```bash
cd ~/Desktop
```

**Step 3 — Download the playground**
```bash
git clone https://github.com/jose-huge/prototype-playground.git
```

**Step 4 — Go into the folder**
```bash
cd prototype-playground
```

**Step 5 — Install dependencies**
```bash
npm install
```
This takes about 30–60 seconds. You'll see a lot of text — that's normal.

**Step 6 — Start it up**
```bash
npm run dev
```

**Step 7 — Open in your browser**
Go to [http://localhost:3000](http://localhost:3000)

You should see the blank playground. If something goes wrong at any step, open Claude Code and paste the error — it will fix it for you.

---

## How it works

1. **Connect your Figma file** — go to Settings, paste your Figma file URL and access token
2. **Import your design system** — Settings → Import design system → generates tokens, design docs, and the Design Variables page automatically
3. **Browse frames** — click Browse in the sidebar, pick a frame from your Figma file
4. **Copy build context** — click the button to copy the prompt + Figma context
5. **Paste into Claude Code** — Claude builds the component and it appears in the playground instantly
6. **Refine** — prompt Claude to adjust until it matches the design
7. **Add variations** — use "+ Add variation" in the toolbar for mobile or other versions
8. **Package for dev** — when done, click "Package for dev" in the toolbar to download a zip with everything dev needs

---

## Keeping your project separate from the template

When you start a real project, create a content branch so your Figma content, tokens, and built components never get pushed back to the shared template:

```bash
git checkout -b content/your-project-name
```

Work on this branch. Your content stays local and separate from the template.

If you're not sure how to do this, tell Claude Code:
> "Create a content branch for my project called [project name]"

---

## Getting updates to the playground

When the playground template gets improved, pull the latest changes into your project:

```bash
git checkout main
git pull
git checkout content/your-project-name
git merge main
```

Or just tell Claude Code:
> "Pull the latest playground updates into my project"

---

## Warnings during npm install

You may see messages like `deprecated`, `vulnerabilities`, or `packages looking for funding` during `npm install`. These are normal and won't affect anything. Ignore them.

---

## Questions

If anything breaks or you're not sure what to do, open Claude Code and describe what happened. It has full context of the playground and will walk you through the fix.
