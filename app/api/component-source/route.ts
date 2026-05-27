/**
 * /api/component-source — read a built component's source from the filesystem.
 *
 * Used by BuildPanel's "Add breakpoint" mode to inject the existing component
 * code into the breakpoint prompt.
 *
 * GET /api/component-source?name=HeroSection
 * → { source: string, filePath: string }
 * → 400 if name is missing or contains unsafe characters
 * → 404 if no matching file is found
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Directories to search, in priority order
const SEARCH_DIRS = ["components", "app/components", "src/components"];
// Extensions to try, in priority order
const EXTENSIONS  = [".tsx", ".ts", ".jsx", ".js"];

// Only allow names that are safe filesystem identifiers
const SAFE_NAME_RE = /^[A-Za-z0-9_-]+$/;

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");

  if (!name) {
    return NextResponse.json({ error: "Missing required query param: name" }, { status: 400 });
  }

  if (!SAFE_NAME_RE.test(name)) {
    return NextResponse.json(
      { error: `Invalid component name "${name}" — use only letters, numbers, hyphens, and underscores` },
      { status: 400 }
    );
  }

  const root = process.cwd();

  for (const dir of SEARCH_DIRS) {
    for (const ext of EXTENSIONS) {
      const filePath = path.join(root, dir, `${name}${ext}`);
      if (fs.existsSync(filePath)) {
        try {
          const source = fs.readFileSync(filePath, "utf8");
          return NextResponse.json({ source, filePath });
        } catch {
          return NextResponse.json(
            { error: `Found ${filePath} but could not read it` },
            { status: 500 }
          );
        }
      }
    }
  }

  return NextResponse.json(
    { error: `Component "${name}" not found — searched ${SEARCH_DIRS.join(", ")}` },
    { status: 404 }
  );
}
