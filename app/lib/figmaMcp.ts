/**
 * figmaMcp.ts — Figma API + MCP context integration layer
 *
 * SECURITY: The Figma personal access token is sourced from localStorage only.
 * It is passed directly to the Figma REST API in the X-Figma-Token header.
 * It is never logged, never stored server-side, and never sent anywhere except:
 *   1. https://api.figma.com  (official Figma REST API)
 * The MCP server (https://mcp.figma.com/mcp) uses the MCP protocol which cannot
 * be spoken directly from a browser. Context is instead fetched via the Figma
 * REST API and formatted to match what Claude Code would receive from the MCP tool.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FigmaFrame {
  id: string;
  name: string;
  /** For COMPONENT variants inside a COMPONENT_SET, this is the set's name (e.g. "Banner") */
  parentName?: string;
  page: string;
  type: "FRAME" | "COMPONENT";
  thumbnailUrl?: string;
}

export interface FigmaFileInfo {
  name: string;
  lastModified: string;
  version: string;
}

export type FigmaApiError =
  | { code: "UNAUTHORIZED"; message: string }
  | { code: "FORBIDDEN"; message: string }
  | { code: "NETWORK"; message: string }
  | { code: "UNKNOWN"; message: string };

export class FigmaError extends Error {
  constructor(public readonly error: FigmaApiError) {
    super(error.message);
    this.name = "FigmaError";
  }
}

// ── Internal fetch wrapper ─────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 15_000;
// Figma's image export API cold-renders frames on the first request, which can
// take 30+ seconds for large files. Use a longer timeout for those calls only.
const IMAGE_FETCH_TIMEOUT_MS = 45_000;

async function figmaFetch(
  path: string,
  token: string,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`https://api.figma.com/v1${path}`, {
      headers: { "X-Figma-Token": token },
      signal: controller.signal,
    });
  } catch (err) {
    // AbortError means we timed out; any other error is a network failure
    const isTimeout = err instanceof Error && err.name === "AbortError";
    throw new FigmaError({
      code: "NETWORK",
      message: isTimeout
        ? "Request timed out — check your connection and try again"
        : "Could not reach Figma, check your connection",
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new FigmaError({ code: "UNAUTHORIZED", message: "Token invalid or expired" });
    }
    if (res.status === 403) {
      throw new FigmaError({ code: "FORBIDDEN", message: "No access to this file" });
    }
    throw new FigmaError({
      code: "UNKNOWN",
      message: `Figma API error ${res.status}: ${res.statusText}`,
    });
  }

  return res;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Validates the token and returns basic file info.
 * Used by FigmaConfigPanel to verify a connection before saving.
 */
export async function validateConnection(
  fileKey: string,
  token: string
): Promise<FigmaFileInfo> {
  try {
    const res = await figmaFetch(`/files/${fileKey}?depth=1`, token);
    const data = await res.json();
    return {
      name: data.name as string,
      lastModified: data.lastModified as string,
      version: data.version as string,
    };
  } catch (err) {
    if (err instanceof FigmaError) throw err;
    throw new FigmaError({
      code: "NETWORK",
      message: "Could not reach Figma, check your connection",
    });
  }
}

/**
 * Fetches all FRAME and COMPONENT nodes from a Figma file,
 * grouped by page name.
 */
type RawNode = { id: string; name: string; type: string; children?: RawNode[] };

/**
 * Walks top-level nodes on a page and collects FRAME / COMPONENT nodes,
 * including those nested one level inside SECTION or COMPONENT_SET containers.
 */
function collectFrames(
  topChildren: RawNode[],
  pageName: string,
  out: FigmaFrame[]
): void {
  for (const node of topChildren) {
    if (node.type === "FRAME" || node.type === "COMPONENT") {
      out.push({ id: node.id, name: node.name, page: pageName, type: node.type as "FRAME" | "COMPONENT" });
    } else if (node.type === "SECTION" || node.type === "COMPONENT_SET") {
      // Walk one level into sections / component sets
      for (const child of node.children ?? []) {
        if (child.type === "FRAME" || child.type === "COMPONENT") {
          out.push({
            id: child.id,
            name: child.name,
            // For COMPONENT_SET children, record the set name so callers can
            // resolve the actual component file name (e.g. "Banner" not "Size=XL")
            parentName: node.type === "COMPONENT_SET" ? node.name : undefined,
            page: pageName,
            type: child.type as "FRAME" | "COMPONENT",
          });
        }
      }
    }
  }
}

export async function getFrames(
  fileKey: string,
  token: string
): Promise<FigmaFrame[]> {
  try {
    // depth=3 exposes: document → page → (section|frame|component_set) → frame|component
    const res = await figmaFetch(`/files/${fileKey}?depth=3`, token);
    const data = await res.json();

    const frames: FigmaFrame[] = [];
    const pages: Array<{ name: string; children: RawNode[] }> =
      data?.document?.children ?? [];

    for (const page of pages) {
      collectFrames(page.children ?? [], page.name, frames);
    }

    return frames;
  } catch (err) {
    if (err instanceof FigmaError) throw err;
    throw new FigmaError({
      code: "NETWORK",
      message: "Could not reach Figma, check your connection",
    });
  }
}

/**
 * Fetches thumbnail URLs for a batch of node IDs.
 * Returns a map of nodeId → imageUrl.
 *
 * Performance notes:
 *  - format=jpg  : JPEG compresses 5–10× smaller than PNG for rendered frames,
 *                  and Figma generates them significantly faster.
 *  - scale=0.5   : Half-resolution cuts render work by ~75%; plenty sharp for
 *                  sidebar thumbnails (40×40 px display size).
 *  - BATCH_SIZE=20: Smaller batches avoid backing up Figma's render queue so
 *                  the first batch returns while later ones are still rendering.
 */
export async function getThumbnails(
  fileKey: string,
  nodeIds: string[],
  token: string
): Promise<Record<string, string>> {
  if (nodeIds.length === 0) return {};

  const BATCH_SIZE = 20;
  const result: Record<string, string> = {};

  for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
    const batch = nodeIds.slice(i, i + BATCH_SIZE);
    const ids = batch.join(",");

    try {
      const res = await figmaFetch(
        `/images/${fileKey}?ids=${encodeURIComponent(ids)}&format=jpg&scale=0.5`,
        token,
        IMAGE_FETCH_TIMEOUT_MS,
      );
      const data = await res.json();
      const images = (data.images ?? {}) as Record<string, string | null>;
      for (const [id, url] of Object.entries(images)) {
        if (url) result[id] = url;
      }
    } catch {
      // Thumbnail failures are non-fatal — caller shows placeholder
    }
  }

  return result;
}

// ── MCP context trimmer ────────────────────────────────────────────────────────

/**
 * Keys that are always stripped — they add no value when building a component.
 */
const STRIP_KEYS = new Set([
  // Internal Figma metadata
  "pluginData",
  "sharedPluginData",
  "exportSettings",
  "documentationLinks",
  "variantGroupProperties",
  "layoutVersion",              // internal versioning number
  "componentPropertyDefinitions",

  // Prototype / animation (not needed for static builds)
  "reactions",
  "transitionNodeID",
  "transitionDuration",
  "transitionEasing",
  "transitionPreserveAspectRatio",
  "scrollBehavior",
  "overrides",                  // instance override tracking — verbose, not actionable
  "styleOverrideTable",         // text-run style lookup table — redundant with inline data

  // Geometry path data — SVG path strings, large and not useful for building
  "fillGeometry",
  "strokeGeometry",

  // absoluteRenderBounds is a visual crop box; absoluteBoundingBox has the real size
  "absoluteRenderBounds",

  // Redundant / low-signal font metadata
  "fontPostScriptName",
  "fontVersion",
  "hangingPunctuation",
  "hangingList",
  "leadingTrim",
  "textTruncation",
  "textAutoResize",
  "textDecoration",             // strip if stripped by default-value rule below
]);

/**
 * Keys whose value is a known Figma default — strip them to cut noise.
 * Format: key → default value (=== comparison).
 */
const DEFAULT_VALUES: Record<string, unknown> = {
  blendMode:          "NORMAL",
  opacity:            1,
  isMask:             false,
  isMaskOutline:      false,
  clipsContent:       false,
  locked:             false,
  visible:            true,       // only keep visible:false (hidden nodes)
  preserveRatio:      false,
  layoutGrow:         0,
  layoutAlign:        "INHERIT",
  layoutPositioning:  "AUTO",
  cornerSmoothing:    0,
  strokeWeight:       1,          // default stroke weight when no strokes present
  strokeAlign:        "INSIDE",
  textDecoration:     "NONE",
  textCase:           "ORIGINAL",
  listSpacing:        0,
  indentationLevel:   0,
  paragraphIndent:    0,
  paragraphSpacing:   0,
  italic:             false,
  // padding zeros — strip when all are 0; handled per-key below
  paddingLeft:        0,
  paddingRight:       0,
  paddingTop:         0,
  paddingBottom:      0,
  itemReverseZIndex:  false,
  strokesIncludedInLayout: false,
};

/**
 * Matches full UUID-v4 strings — Figma uses these as style/component keys.
 * Node IDs ("123:456") are NOT matched and are preserved.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isEmptyValue(val: unknown): boolean {
  if (val === null || val === undefined) return true;
  if (val === "") return true;
  if (Array.isArray(val) && val.length === 0) return true;
  if (
    val !== null &&
    typeof val === "object" &&
    !Array.isArray(val) &&
    Object.keys(val as object).length === 0
  )
    return true;
  return false;
}

/**
 * Recursively trims a Figma node tree, removing noise while preserving
 * everything Claude needs to accurately build the component.
 *
 * Strips:
 *  - null / undefined / "" / [] / {} values (at any depth)
 *  - Keys in STRIP_KEYS (metadata, path geometry, redundant font fields)
 *  - Keys whose value matches Figma's known defaults (blendMode:NORMAL, opacity:1, etc.)
 *  - `remote: false` and `description: ""`
 *  - UUID-v4 strings (style/component keys — actual values already appear inline)
 */
function trimNode(node: unknown): unknown {
  if (Array.isArray(node)) {
    const arr = (node as unknown[]).map(trimNode).filter((v) => !isEmptyValue(v));
    return arr.length ? arr : undefined;
  }

  if (node !== null && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(obj)) {
      // Always-noisy keys
      if (STRIP_KEYS.has(k)) continue;

      // Default values — strip when they match Figma's default
      if (k in DEFAULT_VALUES && DEFAULT_VALUES[k] === v) continue;

      // remote: false is the default and adds nothing
      if (k === "remote" && v === false) continue;

      // Empty descriptions carry no information
      if (k === "description" && v === "") continue;

      // UUID strings are style/component keys — actual values already
      // appear in fills, strokes, and typography style blocks
      if (typeof v === "string" && UUID_RE.test(v)) continue;

      const trimmed = trimNode(v);
      if (!isEmptyValue(trimmed)) {
        result[k] = trimmed;
      }
    }

    return Object.keys(result).length ? result : undefined;
  }

  return node;
}

/**
 * Fetches full design context for a single node via the Figma REST API
 * and formats it as structured text — equivalent to what the Figma MCP
 * tool returns when invoked from Claude Code.
 *
 * Note: The native MCP server (https://mcp.figma.com/mcp) uses the MCP
 * protocol which cannot be called directly from a browser. This function
 * replicates the output format using REST endpoints.
 */
export async function getMcpContext(
  fileKey: string,
  nodeId: string,
  token: string
): Promise<string> {
  try {
    const [nodesRes, imagesRes] = await Promise.allSettled([
      figmaFetch(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&depth=5`, token),
      figmaFetch(
        `/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=jpg&scale=1`,
        token
      ),
    ]);

    let nodeData: unknown = null;
    if (nodesRes.status === "fulfilled") {
      const json = await nodesRes.value.json();
      nodeData = json?.nodes?.[nodeId] ?? null;
    }

    let imageUrl: string | null = null;
    if (imagesRes.status === "fulfilled") {
      const json = await imagesRes.value.json();
      imageUrl = json?.images?.[nodeId] ?? null;
    }

    // ── Trim the node tree ─────────────────────────────────────────────────────
    const rawJson    = JSON.stringify(nodeData, null, 2);
    const trimmed    = trimNode(nodeData);
    const trimmedJson = JSON.stringify(trimmed, null, 2);

    const rawChars     = rawJson.length;
    const trimmedChars = trimmedJson.length;
    const savedPct     = Math.round((1 - trimmedChars / rawChars) * 100);

    // Format as structured MCP-style context
    const lines: string[] = [
      `## Figma Node Context`,
      `**File key:** ${fileKey}`,
      `**Node ID:** ${nodeId}`,
      imageUrl ? `**Preview:** ${imageUrl}` : "",
      `**Context size:** ${rawChars.toLocaleString()} → ${trimmedChars.toLocaleString()} chars (${savedPct}% reduction)`,
      ``,
      `### Node tree`,
      `\`\`\`json`,
      trimmedJson,
      `\`\`\``,
    ];

    return lines.filter((l) => l !== "").join("\n");
  } catch (err) {
    if (err instanceof FigmaError) throw err;
    throw new FigmaError({
      code: "NETWORK",
      message: "Could not reach Figma, check your connection",
    });
  }
}

/**
 * Reads a built component's source code from the filesystem via the local API route.
 * Used in "Add breakpoint" mode to inject EXISTING_COMPONENT_CODE into the prompt.
 *
 * Searches: components/, app/components/, src/components/ (server-side, in that order).
 * Throws with a user-visible message if the file cannot be found.
 */
export async function getComponentSource(componentName: string): Promise<string> {
  const res = await fetch(
    `/api/component-source?name=${encodeURIComponent(componentName)}`
  );
  if (!res.ok) {
    const data = await res.json() as { error?: string };
    throw new Error(
      data.error ?? "Could not read component source — make sure it's been built first"
    );
  }
  const data = await res.json() as { source: string };
  return data.source;
}

/**
 * Extracts a Figma file key from a Figma file URL.
 * Handles: /design/:key/, /file/:key/, and bare keys.
 */
export function extractFileKey(input: string): string | null {
  // Already a bare key (no slashes, no protocol)
  if (/^[A-Za-z0-9_-]+$/.test(input.trim())) return input.trim();

  const match = input.match(/figma\.com\/(?:design|file)\/([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

/**
 * Assembles the full variation prompt by reading the parent component source
 * and combining with the variation prompt template.
 * The returned string is the complete copy payload (prompt + source + MCP context).
 */
export async function getVariationContext(
  parentComponentName: string,
  variationName: string,
  description: string,
  figmaMcpContext: string
): Promise<string> {
  const source = await getComponentSource(parentComponentName);
  const varCap = variationName.charAt(0).toUpperCase() + variationName.slice(1);

  const lines = [
    `This is a variation of an existing component.`,
    ``,
    `Parent component: ${parentComponentName}`,
    `Variation name: ${variationName}`,
    ...(description.trim() ? [`What's different: ${description.trim()}`, ``] : [``]),
    `Here is the parent component source for reference:`,
    `\`\`\``,
    source,
    `\`\`\``,
    ``,
    `Using the Figma frame below as reference, build the ${variationName} variation. Keep the same component structure and token usage as the parent where possible. Adapt only what the Figma frame shows as different.`,
    ``,
    `Export as a named export: ${parentComponentName}${varCap}`,
    `e.g. ${parentComponentName}${varCap}`,
    ``,
    `---`,
    ``,
    figmaMcpContext,
  ];

  return lines.join("\n");
}
