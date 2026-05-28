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

## What you need before starting

Two things need to be installed on your computer:

- **Node.js** — download from [nodejs.org](https://nodejs.org) (click the LTS version)
- **Claude Code** — follow the install guide at [claude.ai/code](https://claude.ai/code)

The install script will check for these and open the download page automatically if either is missing.

---

## What this is

Prototype Playground connects your Figma file to Claude Code so you can build, preview, and iterate on components without writing code. When you're done, package the component for your dev team in one click.

---

## Your first session

After the playground opens in your browser, follow these steps to get everything connected and build your first component.

### 1. Open Claude Code
Open the Claude Code app. Click **Open folder** and navigate to:
```
Documents → prototype-playground
```
This points Claude Code at the playground so it can read and write your components.

### 2. Introduce Claude Code to the project
In the Claude Code chat, paste this message:
> "I'm working in Prototype Playground. Read the README and familiarise yourself with the project structure before we start building."

Claude Code will read the codebase and get up to speed. Wait for it to confirm before moving on.

### 3. Set up your project in the playground
Go back to your browser at `localhost:3000`. Click **Settings** in the bottom left and:
- Set your project name
- Choose your output framework (React, Vue, etc.)
- Choose your animation library

### 4. Connect your Figma file
Still in Settings, click **Figma connection** and:
- Paste your Figma file URL
- Paste your Figma personal access token (generate one at figma.com/settings → Personal access tokens)
- Click **Connect**

### 5. Import your design system
Once connected, click **Import from Figma**. This pulls all your design tokens — colors, typography, spacing, radius, shadows, and motion — and generates your Design Variables page. Takes about 20 seconds.

### 6. Browse your Figma frames
Click **Browse** in the sidebar. Your Figma file's frames appear in a list. Click the one you want to build.

### 7. Copy build context
The build panel shows your selected frame and a prompt. Click **Copy build context** — this copies everything Claude Code needs: the prompt and your Figma frame data.

### 8. Paste into Claude Code
Switch to Claude Code and paste. Claude builds the component and it appears in the playground preview automatically.

### 9. Refine
Review the component in the playground. If anything needs adjusting, tell Claude Code directly:
> "Make the button full width on mobile"
> "The heading font size is too large, match the Figma frame"
> "Add a hover state to the card"

Keep going until it matches the design.

### 10. Add variations (optional)
If the component looks significantly different on mobile or in another state, click **+ Add variation** in the toolbar. Name it, select the Figma frame for that variation, and copy build context again.

### 11. Package for dev
When the component is ready, click **Package for dev** in the toolbar. Review what's included and click **Download zip**. The zip contains the component file, any variations, design tokens, and a README for your dev team.

---

## Keeping your project separate from the template

When you start a real project, create a content branch so your Figma content, tokens, and built components stay local and never affect the shared template:

Tell Claude Code:
> "Create a content branch for my project called [your project name]"

Work on this branch. Your content stays on your machine. The template stays clean for everyone else.

---

## Getting updates to the playground

When the playground gets improved, tell Claude Code:
> "Pull the latest playground updates into my project"

---

## Warnings during npm install

You may see messages like `deprecated`, `vulnerabilities`, or `packages looking for funding` during install. These are normal and won't affect anything. Ignore them.

---

## Something went wrong?

Open Claude Code and describe what happened. It has full context of the playground and will walk you through the fix.
