/**
 * /api/figma-config — persist Figma credentials to a local JSON file.
 *
 * This lets the playground survive browser-context resets (e.g. Claude Code
 * preview restarts) without the user having to re-enter their token each time.
 *
 * Storage: .figma-config.json at the project root (gitignored).
 * The token is stored locally only — never sent to any external service.
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), ".figma-config.json");

interface FigmaConfig {
  token:    string;
  fileKey:  string;
  fileName: string;
}

function readConfig(): FigmaConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as FigmaConfig;
  } catch {
    return null;
  }
}

// GET — return saved config (or empty object if none)
export async function GET() {
  const config = readConfig();
  return NextResponse.json(config ?? {});
}

// POST — save config to disk
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FigmaConfig;
    if (!body.token || !body.fileKey) {
      return NextResponse.json({ error: "token and fileKey are required" }, { status: 400 });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(body, null, 2), "utf8");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}

// DELETE — remove saved config
export async function DELETE() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      fs.unlinkSync(CONFIG_PATH);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete config" }, { status: 500 });
  }
}
