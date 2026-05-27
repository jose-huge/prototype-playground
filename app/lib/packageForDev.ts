/**
 * packageForDev — client-side zip assembly for component handoff.
 *
 * Assembles Banner.zip containing:
 *   Banner/Banner.tsx
 *   Banner/BannerMobile.tsx    (if variations exist)
 *   Banner/tokens.css          (only CSS custom properties used by the component)
 *   Banner/figma-reference.png (Figma API screenshot, if available)
 *   Banner/README.md
 */

import JSZip from "jszip";
import type { ComponentRecord } from "@/app/components/Playground";
import type { FigmaConfig }    from "@/hooks/useFigmaConfig";

// ── Helpers ───────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Variation filename: BannerMobile.tsx */
export function variationFileName(parentName: string, varName: string): string {
  return `${parentName}${capitalize(varName)}.tsx`;
}

/** Read a built component's source via the local API route. Returns null on failure. */
async function fetchComponentSource(name: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/component-source?name=${encodeURIComponent(name)}`);
    if (!res.ok) return null;
    const data = await res.json() as { source: string };
    return data.source ?? null;
  } catch { return null; }
}

/** Collect all CSS custom property names referenced in source text. */
function extractCssVarNames(source: string): string[] {
  const re = /var\(\s*(-{1,2}[\w-]+)/g;
  const names = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) names.add(m[1]);
  return [...names];
}

/** Resolve token names against the live CSSOM (only works client-side). */
function resolveTokenValues(names: string[]): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = style.getPropertyValue(name).trim();
    if (value) out[name] = value;
  }
  return out;
}

/** Build tokens.css content from a map of { '--prop': 'value' }. */
function buildTokensCss(componentName: string, tokens: Record<string, string>): string {
  if (!Object.keys(tokens).length) return `/* No design tokens detected for ${componentName} */\n`;
  const lines = Object.entries(tokens)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `  ${name}: ${value};`);
  return `/* Tokens used by ${componentName} */\n:root {\n${lines.join("\n")}\n}\n`;
}

/** Fetch a Figma frame as a PNG blob. Returns null on any error. */
async function fetchFigmaScreenshot(
  token: string,
  fileKey: string,
  nodeId: string,
): Promise<Blob | null> {
  try {
    // Figma API requires ':' encoded as %3A in the ids param
    const encodedId = nodeId.replace(":", "%3A");
    const apiUrl = `https://api.figma.com/v1/images/${fileKey}?ids=${encodedId}&format=png&scale=2`;
    const apiRes = await fetch(apiUrl, {
      headers: { "X-Figma-Token": token },
    });
    if (!apiRes.ok) return null;
    const apiData = await apiRes.json() as { images?: Record<string, string | null> };
    // The key may use either ':' or '-' depending on the Figma API version
    const imageUrl =
      apiData.images?.[nodeId] ??
      apiData.images?.[nodeId.replace(":", "-")] ??
      Object.values(apiData.images ?? {}).find(Boolean);
    if (!imageUrl) return null;
    const imgRes = await fetch(imageUrl);
    return imgRes.ok ? imgRes.blob() : null;
  } catch { return null; }
}

/** Format an ISO date string as "21 May 2026". */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

/** Generate README.md content. */
function buildReadme(
  component: ComponentRecord,
  includedFiles: string[],
  figmaFileName: string,
  hasScreenshot: boolean,
): string {
  const dateStr   = formatDate(component.date);
  const frameRef  = component.frame || "(unknown frame)";
  const stack     = component.builtWith;

  const fileLines = includedFiles
    .filter((f) => f !== "README.md")
    .map((f) => {
      if (f === `${component.name}.tsx`) return `- \`${f}\` — main component (desktop)`;
      if (f === "tokens.css")            return `- \`${f}\` — design tokens used by this component`;
      if (f.endsWith(".png"))            return `- \`${f}\` — Figma frame reference`;
      // Variation file
      const rawVarName = f.replace(component.name, "").replace(".tsx", "").toLowerCase();
      const varRecord  = component.variations.find(
        (v) => v.name.toLowerCase() === rawVarName,
      );
      const desc = varRecord?.description ? ` — ${varRecord.description}` : "";
      return `- \`${f}\` — ${rawVarName} variation${desc}`;
    })
    .join("\n");

  const variationsSection =
    component.variations.length > 0
      ? `\n## Variations\n${component.variations
          .map((v) => {
            const desc = v.description ? ` — ${v.description}` : "";
            return `- **${v.name}**${desc}`;
          })
          .join("\n")}\n`
      : "";

  return `# ${component.name}

## Overview
Built from Figma frame: ${frameRef}
Date: ${dateStr}
Stack: ${stack}

## Files
${fileLines}

## Integration notes
- Import \`${component.name}\` from \`./${component.name}\`
- Tokens in \`tokens.css\` should be merged with your project's token file
  or mapped to your existing token names if different
- Built with React functional components and named exports
${variationsSection}
## Figma
File: ${figmaFileName || "(unknown)"}
Frame: ${frameRef}
`;
}

/** Trigger a browser download of a Blob. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface PackageOptions {
  component:    ComponentRecord;
  figmaConfig:  FigmaConfig | null;
  /** Figma node ID for the main frame (needed for screenshot). */
  frameId?:     string;
  figmaFileName?: string;
}

/** What files will be in the zip — computed before any async work. */
export function predictFileList(component: ComponentRecord, hasFrameId: boolean): string[] {
  const files: string[] = [`${component.name}.tsx`];
  for (const v of component.variations) {
    files.push(variationFileName(component.name, v.name));
  }
  files.push("tokens.css");
  if (hasFrameId) files.push("figma-reference.png");
  files.push("README.md");
  return files;
}

/**
 * Assemble and download [ComponentName].zip.
 * Returns the list of files actually included (screenshot may be omitted on fetch failure).
 */
export async function packageForDev(options: PackageOptions): Promise<string[]> {
  const { component, figmaConfig, frameId, figmaFileName = "" } = options;

  const zip    = new JSZip();
  const folder = zip.folder(component.name)!;

  // 1. Collect all source files ──────────────────────────────────────────────
  const sourcePairs: Array<{ filename: string; source: string }> = [];

  const mainSource = await fetchComponentSource(component.name);
  if (mainSource) sourcePairs.push({ filename: `${component.name}.tsx`, source: mainSource });

  for (const v of component.variations) {
    const varFile   = variationFileName(component.name, v.name);
    const varSource = await fetchComponentSource(varFile.replace(".tsx", ""));
    if (varSource) sourcePairs.push({ filename: varFile, source: varSource });
  }

  // 2. Add source files to zip ───────────────────────────────────────────────
  for (const { filename, source } of sourcePairs) {
    folder.file(filename, source);
  }

  // 3. Extract + resolve CSS tokens ─────────────────────────────────────────
  const allSource  = sourcePairs.map((p) => p.source).join("\n");
  const tokenNames = extractCssVarNames(allSource);
  const tokenMap   = resolveTokenValues(tokenNames);
  folder.file("tokens.css", buildTokensCss(component.name, tokenMap));

  // 4. Figma screenshot(s) ───────────────────────────────────────────────────
  let screenshotAdded = false;
  if (frameId && figmaConfig) {
    const blob = await fetchFigmaScreenshot(figmaConfig.token, figmaConfig.fileKey, frameId);
    if (blob) {
      folder.file("figma-reference.png", blob);
      screenshotAdded = true;
    }
  }

  // 5. Build file list for README ────────────────────────────────────────────
  const includedFiles: string[] = sourcePairs.map((p) => p.filename);
  includedFiles.push("tokens.css");
  if (screenshotAdded) includedFiles.push("figma-reference.png");
  includedFiles.push("README.md");

  // 6. README ────────────────────────────────────────────────────────────────
  folder.file(
    "README.md",
    buildReadme(component, includedFiles, figmaFileName, screenshotAdded),
  );

  // 7. Generate and download ─────────────────────────────────────────────────
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, `${component.name}.zip`);

  return includedFiles;
}
