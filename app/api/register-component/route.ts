/**
 * /api/register-component — append a built component to the barrel file.
 *
 * Called by the playground's onBuild handler once a component has been copied.
 * Adds `export { ComponentName } from "./ComponentName";` to
 * `components/index.ts` so the built-preview page can import it by name.
 *
 * POST /api/register-component
 * Body: { name: "Banner" }
 * → 200 { ok: true, status: "registered" | "already_registered" | "file_not_found" }
 * → 400 if name is missing or unsafe
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SAFE_NAME_RE = /^[A-Z][A-Za-z0-9]*$/;
const BARREL_PATH  = path.join(process.cwd(), "components", "index.ts");

export async function POST(req: NextRequest) {
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { name } = body;

  if (!name) {
    return NextResponse.json({ error: "Missing field: name" }, { status: 400 });
  }
  if (!SAFE_NAME_RE.test(name)) {
    return NextResponse.json(
      { error: `Invalid component name "${name}" — must start with an uppercase letter and contain only letters and numbers` },
      { status: 400 },
    );
  }

  // Check that the component file actually exists (may not yet if Claude Code hasn't run)
  const componentFile = path.join(process.cwd(), "components", `${name}.tsx`);
  if (!fs.existsSync(componentFile)) {
    return NextResponse.json({ ok: true, status: "file_not_found" });
  }

  // Read or create the barrel
  let barrel = fs.existsSync(BARREL_PATH) ? fs.readFileSync(BARREL_PATH, "utf8") : "";

  // Check if already registered
  const exportLine = `export { ${name} } from "./${name}";`;
  if (barrel.includes(exportLine)) {
    return NextResponse.json({ ok: true, status: "already_registered" });
  }

  // Check whether the component file exports `defaultScheme` — if so, re-export
  // it with an alias so the preview/built page can resolve it by name.
  const componentSrc = fs.readFileSync(componentFile, "utf8");
  const hasDefaultScheme = /export\s+const\s+defaultScheme\s*=/.test(componentSrc);

  // Build the export line — include the aliased scheme when present
  const line = hasDefaultScheme
    ? `export { ${name}, defaultScheme as ${name}DefaultScheme } from "./${name}";`
    : `export { ${name} } from "./${name}";`;

  // Append export
  if (!barrel.endsWith("\n")) barrel += "\n";
  barrel += `${line}\n`;
  fs.writeFileSync(BARREL_PATH, barrel, "utf8");

  return NextResponse.json({ ok: true, status: "registered" });
}
