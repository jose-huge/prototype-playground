/**
 * POST /api/grid — write updated grid values to styles/grid.css
 */

import { NextResponse } from "next/server";
import fs   from "fs";
import path from "path";
import type { GridConfig } from "@/lib/gridConfig";

const GRID_CSS = path.join(process.cwd(), "styles", "grid.css");

export async function POST(req: Request) {
  try {
    const g = await req.json() as GridConfig;

    const css = [
      `/* Grid system — adjust to match your Figma layout grid */`,
      `:root {`,
      `  --grid-xl-columns: ${g.xl.columns};`,
      `  --grid-xl-margin: ${g.xl.margin}px;`,
      `  --grid-xl-gutter: ${g.xl.gutter}px;`,
      ``,
      `  --grid-md-columns: ${g.md.columns};`,
      `  --grid-md-margin: ${g.md.margin}px;`,
      `  --grid-md-gutter: ${g.md.gutter}px;`,
      ``,
      `  --grid-xs-columns: ${g.xs.columns};`,
      `  --grid-xs-margin: ${g.xs.margin}px;`,
      `  --grid-xs-gutter: ${g.xs.gutter}px;`,
      `}`,
    ].join("\n");

    fs.writeFileSync(GRID_CSS, css, "utf8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
