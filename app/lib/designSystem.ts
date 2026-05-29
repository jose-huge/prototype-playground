/**
 * designSystem.ts — Figma design system import: fetch, process, generate.
 *
 * Pure processing module — no fs, no Next.js, no side effects.
 * The API route owns all I/O; this module owns all logic.
 */

// ── Figma API types ────────────────────────────────────────────────────────────

export interface FigmaColor { r: number; g: number; b: number; a: number }

export interface FigmaVariableAlias { type: "VARIABLE_ALIAS"; id: string }

export type FigmaVariableValue =
  | FigmaVariableAlias
  | FigmaColor
  | number
  | string
  | boolean;

export interface FigmaVariable {
  id:                    string;
  name:                  string;       // e.g. "color/brand/primary"
  variableCollectionId:  string;
  resolvedType:          "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  valuesByMode:          Record<string, FigmaVariableValue>;
  remote:                boolean;
  description:           string;
  hiddenFromPublishing:  boolean;
}

export interface FigmaVariableMode {
  modeId: string;
  name:   string;
}

export interface FigmaVariableCollection {
  id:          string;
  name:        string;
  modes:       FigmaVariableMode[];
  variableIds: string[];
  defaultModeId: string;
}

export interface FigmaVariablesResponse {
  status:  number;
  error:   boolean;
  meta: {
    variableCollections: Record<string, FigmaVariableCollection>;
    variables:           Record<string, FigmaVariable>;
  };
}

export interface FigmaStyle {
  key:        string;
  node_id:    string;
  style_type: "FILL" | "TEXT" | "EFFECT" | "GRID";
  name:       string;
  description: string;
}

export interface FigmaStylesResponse {
  meta: { styles: FigmaStyle[] };
}

export interface FigmaNodeFill {
  type:  string;
  color?: FigmaColor;
  opacity?: number;
}

export interface FigmaEffect {
  type:    "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  visible: boolean;
  color?:  FigmaColor;
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}

export interface FigmaNodeDocument {
  type:            string;
  fills?:          FigmaNodeFill[];
  effects?:        FigmaEffect[];
  fontName?:       { family: string; style: string };
  fontSize?:       number;
  lineHeightPx?:   number;
  lineHeightUnit?: string;
  letterSpacing?:  { value: number; unit: string };
  fontWeight?:     number;
}

export interface FigmaNodesResponse {
  nodes: Record<string, { document: FigmaNodeDocument } | null>;
}

// ── Output types ───────────────────────────────────────────────────────────────

export type TokenCategory = "colors" | "typography" | "spacing" | "radius" | "shadows" | "animation" | "other";

export type ModeStructure = "single" | "light-only" | "dark-only" | "both";

/** How modes in a collection were classified. */
export type ModeKind = "theme" | "breakpoint" | "unknown";

/** Info about a multi-mode collection, captured during import. */
export interface CollectionModeInfo {
  collectionId:   string;
  collectionName: string;
  kind:           ModeKind;
  /** Modes in resolved order: largest first for breakpoints, Figma order otherwise. */
  orderedModes:   Array<{ modeId: string; name: string }>;
}

export interface TokenEntry {
  figmaName:   string;
  cssVar:      string;
  category:    TokenCategory;
  valueLight:  string;
  valueDark?:  string;
  /**
   * All resolved mode values for this token, when the collection has >1 mode.
   * Order matches CollectionModeInfo.orderedModes (largest breakpoint first).
   */
  modeValues?: Array<{ modeName: string; modeId: string; value: string }>;
  // For typography from styles
  fromStyle?:  boolean;
  meta?: {
    fontFamily?:    string;
    fontSize?:      string;
    fontWeight?:    string;
    lineHeight?:    string;
    letterSpacing?: string;
  };
}

export interface SchemeSwatch {
  figmaName: string;
  cssVar:    string;
  value:     string;
}

export interface SchemeEntry {
  name:       string;         // e.g. "Light", "Dark"
  collection: string;         // e.g. "Color Schemes"
  tokens:     SchemeSwatch[]; // all resolved color tokens for this mode
}

export interface TokenSnapshot {
  meta: {
    figmaFile:     string;
    importedAt:    string;
    modeStructure: ModeStructure;
  };
  tokens:                TokenEntry[];
  schemes?:              SchemeEntry[]; // one entry per variable-collection mode
  unresolvedTokens:      string[];
  /** Info about every multi-mode collection (≥2 modes), populated during import. */
  multiModeCollections?: CollectionModeInfo[];
}

// ── Name normalisation ─────────────────────────────────────────────────────────

/** / → -  ·  lowercase  ·  trim  ·  collapse repeated hyphens */
export function normalizeName(figmaName: string): string {
  return figmaName
    .trim()
    .toLowerCase()
    .replace(/\//g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toCssVar(figmaName: string): string {
  return `--${normalizeName(figmaName)}`;
}

// ── Color conversion ───────────────────────────────────────────────────────────

export function figmaColorToHex(color: FigmaColor): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  if (color.a < 0.9999) {
    const a = Math.round(color.a * 1000) / 1000;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }
  const hex = [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  return `#${hex}`;
}

/**
 * Known base colors for opacity token inference.
 * Matches substrings in the variable name (longest match wins).
 */
const OPACITY_COLOR_MAP: Array<[string, [number, number, number]]> = [
  ["white",  [255, 255, 255]],
  ["black",  [0,   0,   0  ]],
];

/**
 * Convert a FLOAT opacity variable to an rgba() value.
 * Parses the base color from the variable name using OPACITY_COLOR_MAP.
 * Falls back to rgba(0, 0, 0, value) if no color keyword is found.
 */
function opacityFloatToRgba(value: number, name: string): string {
  const lower = name.toLowerCase();
  for (const [keyword, [r, g, b]] of OPACITY_COLOR_MAP) {
    if (lower.includes(keyword)) {
      return `rgba(${r}, ${g}, ${b}, ${value})`;
    }
  }
  return `rgba(0, 0, 0, ${value})`;
}

/** FLOAT → px if it looks like a size, otherwise raw number string */
function floatToString(value: number, name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("duration") || lower.includes("delay")) {
    return `${Math.round(value)}ms`;
  }
  // Opacity/alpha FLOAT → rgba() combining name-inferred base color + float alpha
  if (lower.includes("opacity") || lower.includes("alpha")) {
    return opacityFloatToRgba(value, name);
  }
  // Everything else that's a round number → assume px
  if (Number.isInteger(value) || value === Math.round(value * 100) / 100) {
    return `${value}px`;
  }
  return String(value);
}

// ── Category detection ─────────────────────────────────────────────────────────

export function categorize(cssVarName: string): TokenCategory {
  // Strip leading -- and get first segment
  const inner   = cssVarName.replace(/^--/, "");
  const segment = inner.split("-")[0];

  if (["color", "colours", "colors"].includes(segment))                      return "colors";
  if (["spacing", "space", "gap", "size"].includes(segment))                  return "spacing";
  if (["radius", "border", "corner", "rounded"].includes(segment))            return "radius";
  if (["font", "typography", "type", "text", "heading", "body"].includes(segment)) return "typography";
  if (["animation", "motion", "duration", "ease", "transition", "timing"].includes(segment)) return "animation";
  // Opacity/alpha tokens are rgba() color values — group them with colors
  if (inner.includes("opacity") || inner.includes("alpha"))                   return "colors";
  return "other";
}

// ── Mode detection ─────────────────────────────────────────────────────────────

const LIGHT_HINTS = ["light", "day", "default", "base", "normal"];
const DARK_HINTS  = ["dark", "night", "dim"];

function modeReadsAs(name: string): "light" | "dark" | "unknown" {
  const lower = name.toLowerCase();
  if (LIGHT_HINTS.some((h) => lower.includes(h))) return "light";
  if (DARK_HINTS.some((h) => lower.includes(h)))  return "dark";
  return "unknown";
}

export function detectModes(collections: FigmaVariableCollection[]): ModeStructure {
  // Flatten all unique mode names across all collections
  const modeNames = new Set<string>();
  for (const col of collections) {
    for (const mode of col.modes) modeNames.add(mode.name);
  }

  if (modeNames.size === 0) return "single";

  const readings = [...modeNames].map(modeReadsAs);
  const hasLight = readings.includes("light");
  const hasDark  = readings.includes("dark");

  if (modeNames.size === 1) return "single";
  if (hasLight && hasDark)  return "both";
  if (hasLight)             return "light-only";
  if (hasDark)              return "dark-only";
  return "single";
}

// ── Multi-mode / breakpoint detection ─────────────────────────────────────────

/** Keywords that signal a mode represents a viewport/screen size. */
const BREAKPOINT_HINTS = [
  "mobile", "phone", "tablet", "desktop", "laptop",
  "compact", "expanded", "wide",
  "xs", "sm", "md", "lg", "xl", "xxl",
  "xsmall", "small", "large", "xlarge", "xxlarge",
  "breakpoint", "viewport", "screen",
  "320", "375", "576", "768", "1024", "1280", "1440", "1920",
];

/**
 * Smallest → Largest ordering for common breakpoint keywords.
 * Higher value = larger screen → placed earlier in the ordered list (index 0 = default/largest).
 */
const BP_SIZE_RANK: Record<string, number> = {
  "320": 0, "375": 0, xs: 0, xsmall: 0,
  "576": 1, sm: 1, small: 1, mobile: 1, phone: 1, compact: 1,
  "768": 2, md: 2, medium: 2, tablet: 2,
  "1024": 3, lg: 3, large: 3, laptop: 3,
  "1280": 4, "1440": 4, xl: 4, xlarge: 4, desktop: 4, expanded: 4,
  "1920": 5, xxl: 5, xxlarge: 5, wide: 5,
};

/**
 * Max-width thresholds per tier.
 * Tier 0 → default (:root, no media query).
 * Tier 1 → @media (max-width: 1279px).
 * Tier 2 → @media (max-width: 575px).
 */
export const BP_MAX_WIDTHS: Array<number | null> = [null, 1279, 575];

/**
 * Classify a collection's modes:
 * - "theme"      → at least one mode name contains a light/dark hint
 * - "breakpoint" → at least one mode name contains a breakpoint-size hint
 * - "unknown"    → neither (documented in design.md only, no CSS generated)
 *
 * Collections with ≤1 mode always return "unknown".
 */
export function detectModeKind(modes: FigmaVariableMode[]): ModeKind {
  if (modes.length <= 1) return "unknown";
  const names = modes.map((m) => m.name.toLowerCase());
  const isTheme = names.some((n) =>
    [...LIGHT_HINTS, ...DARK_HINTS].some((h) => n.includes(h))
  );
  if (isTheme) return "theme";
  const isBp = names.some((n) =>
    BREAKPOINT_HINTS.some((h) => n.includes(h))
  );
  if (isBp) return "breakpoint";
  return "unknown";
}

/**
 * Order breakpoint modes largest → smallest screen size (index 0 = default/largest).
 * Falls back to reverse Figma order if no size keywords match.
 */
export function orderBreakpointModes(
  modes: FigmaVariableMode[],
): Array<{ modeId: string; name: string }> {
  function rank(name: string): number {
    const lower = name.toLowerCase();
    let best = -1;
    for (const [kw, r] of Object.entries(BP_SIZE_RANK)) {
      if (lower.includes(kw) && r > best) best = r;
    }
    return best;
  }
  return [...modes]
    .map((m) => ({ ...m, rank: rank(m.name) }))
    .sort((a, b) => b.rank - a.rank)
    .map(({ modeId, name }) => ({ modeId, name }));
}

// ── Alias resolution ───────────────────────────────────────────────────────────

function isAlias(v: FigmaVariableValue): v is FigmaVariableAlias {
  return typeof v === "object" && v !== null && "type" in v && (v as FigmaVariableAlias).type === "VARIABLE_ALIAS";
}

function isColor(v: FigmaVariableValue): v is FigmaColor {
  return typeof v === "object" && v !== null && "r" in v;
}

/**
 * Resolve a single variable value, following alias chains.
 * Returns null if the chain cannot be resolved (unresolved alias).
 */
export function resolveValue(
  value: FigmaVariableValue,
  modeId: string,
  variables: Record<string, FigmaVariable>,
  depth = 0,
): FigmaVariableValue | null {
  if (depth > 10) return null; // guard against cycles
  if (!isAlias(value)) return value;

  const target = variables[value.id];
  if (!target) return null;

  // Try the same modeId, then fall back to the first available mode
  const resolved =
    target.valuesByMode[modeId] ??
    Object.values(target.valuesByMode)[0];

  if (resolved === undefined) return null;
  return resolveValue(resolved, modeId, variables, depth + 1);
}

// ── Main processor ─────────────────────────────────────────────────────────────

interface ProcessInput {
  variablesResponse: FigmaVariablesResponse | null;
  stylesData:        ProcessedStyle[];
  fileName:          string;
}

export interface ProcessedStyle {
  figmaName: string;
  styleType: "FILL" | "TEXT" | "EFFECT" | "GRID";
  value:     string;
  meta?: TokenEntry["meta"];
}

export function processTokens(input: ProcessInput): TokenSnapshot {
  const { variablesResponse, stylesData, fileName } = input;
  const importedAt      = new Date().toISOString();
  const tokens:          TokenEntry[] = [];
  const unresolvedTokens: string[]   = [];

  // ── Variables ───────────────────────────────────────────────────────────────
  if (variablesResponse && !variablesResponse.error) {
    const { variables, variableCollections } = variablesResponse.meta;
    const collections = Object.values(variableCollections);
    const modeStructure = detectModes(collections);

    // Build a map of collection → { lightModeId, darkModeId }
    type ModeIds = { lightId: string | null; darkId: string | null; defaultId: string };
    const collectionModes = new Map<string, ModeIds>();

    for (const col of collections) {
      let lightId: string | null = null;
      let darkId:  string | null = null;

      for (const mode of col.modes) {
        const reading = modeReadsAs(mode.name);
        if (reading === "light" && !lightId) lightId = mode.modeId;
        if (reading === "dark"  && !darkId)  darkId  = mode.modeId;
      }

      collectionModes.set(col.id, {
        lightId,
        darkId,
        defaultId: col.defaultModeId ?? col.modes[0]?.modeId ?? "",
      });
    }

    // Build multiModeCollections info for every collection with ≥2 modes
    const multiModeCollections: CollectionModeInfo[] = [];
    const collectionKinds = new Map<string, ModeKind>();

    for (const col of collections) {
      const kind = detectModeKind(col.modes);
      collectionKinds.set(col.id, kind);
      if (col.modes.length > 1) {
        const orderedModes =
          kind === "breakpoint"
            ? orderBreakpointModes(col.modes)
            : col.modes.map((m) => ({ modeId: m.modeId, name: m.name }));
        multiModeCollections.push({
          collectionId:   col.id,
          collectionName: col.name,
          kind,
          orderedModes,
        });
      }
    }

    for (const variable of Object.values(variables)) {
      if (variable.remote) continue; // skip remote/library variables
      if (variable.resolvedType === "BOOLEAN") continue; // not useful for CSS

      const cssVar  = toCssVar(variable.name);
      const category = categorize(cssVar);
      const modeIds = collectionModes.get(variable.variableCollectionId);
      if (!modeIds) continue;

      // Determine which modeId to use for the light/default value
      const lightModeId = modeIds.lightId ?? modeIds.defaultId;
      const darkModeId  = modeIds.darkId;

      const rawLight = variable.valuesByMode[lightModeId];
      if (rawLight === undefined) continue;

      const resolvedLight = resolveValue(rawLight, lightModeId, variables);
      if (resolvedLight === null) {
        unresolvedTokens.push(variable.name);
        continue;
      }

      let valueLight: string;
      if (isColor(resolvedLight)) {
        valueLight = figmaColorToHex(resolvedLight as FigmaColor);
      } else if (typeof resolvedLight === "number") {
        valueLight = floatToString(resolvedLight, variable.name);
      } else {
        valueLight = String(resolvedLight);
      }

      let valueDark: string | undefined;
      if (darkModeId) {
        const rawDark = variable.valuesByMode[darkModeId];
        if (rawDark !== undefined) {
          const resolvedDark = resolveValue(rawDark, darkModeId, variables);
          if (resolvedDark !== null) {
            if (isColor(resolvedDark)) {
              valueDark = figmaColorToHex(resolvedDark as FigmaColor);
            } else if (typeof resolvedDark === "number") {
              valueDark = floatToString(resolvedDark, variable.name);
            } else {
              valueDark = String(resolvedDark);
            }
            // Only keep dark value if it differs from light
            if (valueDark === valueLight) valueDark = undefined;
          }
        }
      }

      // For breakpoint collections, capture per-mode values so generateTokensCss
      // can emit @media overrides only for tokens where values actually differ.
      let modeValues: TokenEntry["modeValues"];
      const kind = collectionKinds.get(variable.variableCollectionId);
      if (kind === "breakpoint") {
        const colInfo = multiModeCollections.find(
          (c) => c.collectionId === variable.variableCollectionId,
        );
        if (colInfo && colInfo.orderedModes.length > 1) {
          const vals: Array<{ modeName: string; modeId: string; value: string }> = [];
          for (const mode of colInfo.orderedModes) {
            const raw = variable.valuesByMode[mode.modeId];
            if (raw === undefined) continue;
            const resolved = resolveValue(raw, mode.modeId, variables);
            if (resolved === null) continue;
            let v: string;
            if (isColor(resolved))          v = figmaColorToHex(resolved as FigmaColor);
            else if (typeof resolved === "number") v = floatToString(resolved, variable.name);
            else                            v = String(resolved);
            vals.push({ modeName: mode.name, modeId: mode.modeId, value: v });
          }
          // Only attach modeValues when at least one non-default tier differs
          if (vals.length > 1) {
            const baseVal = vals[0].value;
            if (vals.slice(1).some((v) => v.value !== baseVal)) {
              modeValues = vals;
            }
          }
        }
      }

      tokens.push({ figmaName: variable.name, cssVar, category, valueLight, valueDark, modeValues });
    }

    // ── Styles ─────────────────────────────────────────────────────────────────
    // If variables already provided typography tokens, skip style-based text
    // tokens — they represent the same concepts but with less precision.
    const hasVariableTypography = tokens.some((t) => t.category === "typography" && !t.fromStyle);

    for (const style of stylesData) {
      if (style.styleType === "GRID") continue;
      const cssVar = toCssVar(style.figmaName);

      if (style.styleType === "FILL") {
        tokens.push({
          figmaName: style.figmaName,
          cssVar,
          category: "colors",
          valueLight: style.value,
          fromStyle: true,
        });
      } else if (style.styleType === "TEXT" && !hasVariableTypography) {
        tokens.push({
          figmaName: style.figmaName,
          cssVar,
          category: "typography",
          valueLight: style.value,
          fromStyle: true,
          meta: style.meta,
        });
      } else if (style.styleType === "EFFECT") {
        tokens.push({
          figmaName: style.figmaName,
          cssVar,
          category: "shadows",
          valueLight: style.value,
          fromStyle: true,
        });
      }
    }

    // ── Schemes: extract every mode from every color variable collection ────────
    // This preserves multi-scheme Figma setups (Light / Dark / Brand A / Brand B, etc.)
    const schemes: SchemeEntry[] = [];
    for (const col of collections) {
      const hasColors = col.variableIds.some((id) => {
        const v = variables[id];
        return v && !v.remote && v.resolvedType === "COLOR";
      });
      if (!hasColors) continue;

      for (const mode of col.modes) {
        const modeTokens: SchemeSwatch[] = [];
        for (const varId of col.variableIds) {
          const variable = variables[varId];
          if (!variable || variable.remote || variable.resolvedType !== "COLOR") continue;
          const raw = variable.valuesByMode[mode.modeId];
          if (raw === undefined) continue;
          const resolved = resolveValue(raw, mode.modeId, variables);
          if (resolved === null || !isColor(resolved)) continue;
          modeTokens.push({
            figmaName: variable.name,
            cssVar:    toCssVar(variable.name),
            value:     figmaColorToHex(resolved as FigmaColor),
          });
        }
        if (modeTokens.length > 0) {
          schemes.push({ name: mode.name, collection: col.name, tokens: modeTokens });
        }
      }
    }

    const finalModeStructure = detectModes(collections);
    return {
      meta: { figmaFile: fileName, importedAt, modeStructure: finalModeStructure },
      tokens,
      schemes,
      unresolvedTokens,
      multiModeCollections: multiModeCollections.length > 0 ? multiModeCollections : undefined,
    };
  }

  // No variables — styles only
  for (const style of stylesData) {
    if (style.styleType === "GRID") continue;
    const cssVar = toCssVar(style.figmaName);
    const category: TokenCategory =
      style.styleType === "FILL"   ? "colors"   :
      style.styleType === "EFFECT" ? "shadows"  :
      "typography";
    tokens.push({
      figmaName: style.figmaName,
      cssVar,
      category,
      valueLight: style.value,
      fromStyle: true,
      meta: style.meta,
    });
  }

  return {
    meta: { figmaFile: fileName, importedAt, modeStructure: "single" },
    tokens,
    unresolvedTokens,
  };
}

// ── CSS generators ─────────────────────────────────────────────────────────────

/**
 * Generate styles/schemes.css from the imported SchemeEntry array.
 *
 * Each Figma variable-collection mode becomes a [data-scheme="<name>"] block.
 * The data-scheme value is the normalised mode name (lowercase, hyphenated) so
 * it matches the SCHEME_NAMES list used by SchemeProvider and the scheme picker.
 *
 * Example output:
 *   [data-scheme="light"] {
 *     --background: #ffffff;
 *     --foreground: #1a1a1a;
 *     ...
 *   }
 */
export function generateSchemesCss(snapshot: TokenSnapshot): string {
  const { meta, schemes } = snapshot;
  if (!schemes?.length) {
    return [
      `/* Color schemes — no scheme collections found in Figma file. */`,
      `/* Import a Figma file that contains a variable collection with multiple modes. */`,
      ``,
    ].join("\n");
  }

  const date = new Date(meta.importedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const lines: string[] = [
    `/* Color schemes — generated from Figma: ${meta.figmaFile} */`,
    `/* Imported: ${date} */`,
    `/* Do not edit manually — regenerated on every Figma import. */`,
    ``,
  ];

  for (const scheme of schemes) {
    const dataScheme = normalizeName(scheme.name);
    lines.push(`[data-scheme="${dataScheme}"] {`);
    for (const token of scheme.tokens) {
      lines.push(`  ${token.cssVar}: ${token.value};`);
    }
    lines.push(`}`);
    lines.push(``);
  }

  return lines.join("\n");
}

export function generateTokensCss(snapshot: TokenSnapshot): string {
  const { meta, tokens } = snapshot;
  const date = new Date(meta.importedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const CATEGORY_ORDER: TokenCategory[] = ["colors", "typography", "spacing", "radius", "shadows", "animation", "other"];
  const CATEGORY_LABEL: Record<TokenCategory, string> = {
    colors:     "Colors",
    typography: "Typography",
    spacing:    "Spacing",
    radius:     "Radius",
    shadows:    "Shadows",
    animation:  "Animation",
    other:      "Other",
  };

  function renderGroup(grouped: Map<TokenCategory, TokenEntry[]>, onlyDiff = false): string {
    const lines: string[] = [];
    for (const cat of CATEGORY_ORDER) {
      const entries = grouped.get(cat);
      if (!entries?.length) continue;
      lines.push(`  /* ${CATEGORY_LABEL[cat]} */`);
      for (const t of entries) {
        const val = onlyDiff ? (t.valueDark ?? t.valueLight) : t.valueLight;
        lines.push(`  ${t.cssVar}: ${val};`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  const grouped = new Map<TokenCategory, TokenEntry[]>();
  for (const t of tokens) {
    if (!grouped.has(t.category)) grouped.set(t.category, []);
    grouped.get(t.category)!.push(t);
  }

  const header = [
    `/* Design system tokens */`,
    `/* Generated from Figma: ${meta.figmaFile} */`,
    `/* Imported: ${date} */`,
    ``,
  ].join("\n");

  const { modeStructure } = meta;

  // ── Breakpoint media query blocks (appended regardless of theme structure) ──
  function renderBreakpointBlocks(): string {
    const bpLines: string[] = [];
    for (let tier = 1; tier < BP_MAX_WIDTHS.length; tier++) {
      const maxWidth = BP_MAX_WIDTHS[tier];
      if (maxWidth === null) continue;

      // Tokens that have a modeValues entry at this tier AND that tier differs from tier 0
      const tierTokens = tokens.filter((t) => {
        if (!t.modeValues) return false;
        const base = t.modeValues[0];
        const here = t.modeValues[tier];
        return base && here && here.value !== base.value;
      });
      if (tierTokens.length === 0) continue;

      const tierGrouped = new Map<TokenCategory, TokenEntry[]>();
      for (const t of tierTokens) {
        if (!tierGrouped.has(t.category)) tierGrouped.set(t.category, []);
        tierGrouped.get(t.category)!.push(t);
      }

      bpLines.push(`@media (max-width: ${maxWidth}px) {`);
      bpLines.push(`  :root {`);
      for (const cat of CATEGORY_ORDER) {
        const entries = tierGrouped.get(cat);
        if (!entries?.length) continue;
        bpLines.push(`    /* ${CATEGORY_LABEL[cat]} */`);
        for (const t of entries) {
          bpLines.push(`    ${t.cssVar}: ${t.modeValues![tier].value};`);
        }
        bpLines.push("");
      }
      bpLines.push(`  }`);
      bpLines.push(`}`);
      bpLines.push("");
    }
    return bpLines.join("\n");
  }

  if (modeStructure === "both") {
    // Dark-only: tokens that have a different dark value
    const darkTokens = tokens.filter((t) => t.valueDark !== undefined);
    const darkGrouped = new Map<TokenCategory, TokenEntry[]>();
    for (const t of darkTokens) {
      if (!darkGrouped.has(t.category)) darkGrouped.set(t.category, []);
      darkGrouped.get(t.category)!.push(t);
    }

    return [
      header,
      `:root {`,
      renderGroup(grouped),
      `}`,
      ``,
      `[data-theme="dark"] {`,
      renderGroup(darkGrouped, true),
      `}`,
      ``,
      renderBreakpointBlocks(),
    ].join("\n");
  }

  return [
    header,
    `:root {`,
    renderGroup(grouped),
    `}`,
    ``,
    renderBreakpointBlocks(),
  ].join("\n");
}

// ── Markdown generator ─────────────────────────────────────────────────────────

export function generateDesignMd(snapshot: TokenSnapshot): string {
  const { meta, tokens, unresolvedTokens, multiModeCollections } = snapshot;
  const date = new Date(meta.importedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const counts = {
    colors:     tokens.filter((t) => t.category === "colors").length,
    typography: tokens.filter((t) => t.category === "typography").length,
    spacing:    tokens.filter((t) => t.category === "spacing").length,
    radius:     tokens.filter((t) => t.category === "radius").length,
    shadows:    tokens.filter((t) => t.category === "shadows").length,
    animation:  tokens.filter((t) => t.category === "animation").length,
    other:      tokens.filter((t) => t.category === "other").length,
  };

  const modeLabel: Record<ModeStructure, string> = {
    both:       "Light + dark",
    "light-only": "Light only",
    "dark-only":  "Dark only",
    single:     "Single mode",
  };

  function tableForCategory(cat: TokenCategory): string {
    const entries = tokens.filter((t) => t.category === cat);
    if (!entries.length) return "_None_\n";
    const hasDark = entries.some((t) => t.valueDark);
    const header  = hasDark
      ? `| Token | CSS var | Value | Dark mode value |\n|---|---|---|---|`
      : `| Token | CSS var | Value |\n|---|---|---|`;
    const rows = entries.map((t) =>
      hasDark
        ? `| ${t.figmaName} | \`${t.cssVar}\` | \`${t.valueLight}\` | \`${t.valueDark ?? "—"}\` |`
        : `| ${t.figmaName} | \`${t.cssVar}\` | \`${t.valueLight}\` |`
    );
    return [header, ...rows].join("\n") + "\n";
  }

  // ── Variable modes section ──────────────────────────────────────────────────
  function modesSection(): string[] {
    if (!multiModeCollections?.length) return [];
    const rows = multiModeCollections.map((col) => {
      const kindLabel =
        col.kind === "theme"      ? "Theme (light/dark)" :
        col.kind === "breakpoint" ? "Breakpoint"         : "Unknown";

      // Build mode cells with breakpoint annotations for tier > 0
      const modeCells = col.orderedModes.map((m, i) => {
        if (col.kind !== "breakpoint") return m.name;
        if (i === 0) return `${m.name} (default)`;
        const maxW = BP_MAX_WIDTHS[i];
        return maxW !== null ? `${m.name} (≤${maxW}px)` : m.name;
      });

      return `| ${col.collectionName} | ${kindLabel} | ${modeCells.join(" | ")} |`;
    });

    // Header columns — use widest row's count
    const maxCols = Math.max(...multiModeCollections.map((c) => c.orderedModes.length));
    const modeHeaders = Array.from({ length: maxCols }, (_, i) => `Mode ${i + 1}`).join(" | ");

    return [
      `## Variable modes`,
      `All multi-mode collections detected in this Figma file:`,
      ``,
      `| Collection | Kind | ${modeHeaders} |`,
      `|---|---|${Array.from({ length: maxCols }, () => "---").join("|")}|`,
      ...rows,
      ``,
      `**Kind reference:**`,
      `- **Theme** — modes represent color themes (light/dark); CSS uses \`[data-theme="dark"]\` selector`,
      `- **Breakpoint** — modes represent viewport sizes; CSS uses \`@media (max-width: …)\` overrides in \`generated-tokens.css\``,
      `- **Unknown** — modes could not be classified; documented here only, no CSS generated`,
      ``,
    ];
  }

  const sections = [
    `# Design system`,
    `Generated from Figma · ${meta.figmaFile} · ${date}`,
    ``,
    `## Overview`,
    `- Mode support: ${modeLabel[meta.modeStructure]}`,
    `- ${counts.colors} color tokens`,
    `- ${counts.typography} typography tokens`,
    `- ${counts.spacing} spacing tokens`,
    `- ${counts.radius} radius tokens`,
    `- ${counts.shadows} shadow tokens`,
    `- ${counts.animation} animation tokens`,
    `- ${counts.other} other tokens`,
    ``,
    ...modesSection(),
    `## Color tokens`,
    tableForCategory("colors"),
    `## Typography tokens`,
    tableForCategory("typography"),
    `## Spacing tokens`,
    tableForCategory("spacing"),
    `## Radius tokens`,
    tableForCategory("radius"),
    ...(counts.shadows > 0 ? [`## Shadow tokens`, tableForCategory("shadows")] : []),
    `## Animation tokens`,
    tableForCategory("animation"),
  ];

  if (counts.other > 0) {
    sections.push(`## Other tokens`, tableForCategory("other"));
  }

  if (unresolvedTokens.length > 0) {
    sections.push(
      `## Unresolved tokens`,
      `The following variable aliases could not be resolved. They are excluded from tokens.css.`,
      ``,
      ...unresolvedTokens.map((n) => `- \`${n}\``),
      ``,
    );
  }

  sections.push(
    `## Integration notes`,
    `- Import \`tokens.css\` in your global stylesheet before any component styles`,
    meta.modeStructure === "both"
      ? `- Dark mode uses \`[data-theme="dark"]\` on the root element`
      : `- Single color mode — no dark mode selector needed`,
    `- Opaque color values are hex; semi-transparent colors (including opacity tokens) are rgba()`,
    `- Opacity tokens are rgba() values — apply as background-color, border-color, or color, never as CSS opacity`,
    `- Generated by Prototype Playground · ${date}`,
    ``,
  );

  return sections.join("\n");
}

// ── Style node processing ──────────────────────────────────────────────────────

/** Turn raw Figma node document data into a ProcessedStyle entry */
export function processStyleNode(
  style: FigmaStyle,
  document: FigmaNodeDocument,
): ProcessedStyle | null {
  if (style.style_type === "FILL") {
    const fill = document.fills?.[0];
    if (!fill || fill.type !== "SOLID" || !fill.color) return null;
    const color: FigmaColor = {
      r: fill.color.r,
      g: fill.color.g,
      b: fill.color.b,
      a: fill.opacity ?? fill.color.a ?? 1,
    };
    return { figmaName: style.name, styleType: "FILL", value: figmaColorToHex(color) };
  }

  if (style.style_type === "TEXT") {
    const size   = document.fontSize ? `${document.fontSize}px` : undefined;
    const weight = document.fontWeight ?? (
      document.fontName?.style?.toLowerCase().includes("bold") ? 700 :
      document.fontName?.style?.toLowerCase().includes("light") ? 300 :
      document.fontName?.style?.toLowerCase().includes("medium") ? 500 : 400
    );
    const lh = document.lineHeightPx ? `${Math.round(document.lineHeightPx * 10) / 10}px` : undefined;
    const ls = document.letterSpacing
      ? `${document.letterSpacing.value}${document.letterSpacing.unit === "PERCENT" ? "em" : "px"}`
      : undefined;

    return {
      figmaName:  style.name,
      styleType:  "TEXT",
      value:      size ?? "inherit",
      meta: {
        fontFamily:    document.fontName?.family,
        fontSize:      size,
        fontWeight:    String(weight),
        lineHeight:    lh,
        letterSpacing: ls,
      },
    };
  }

  if (style.style_type === "EFFECT") {
    // Find the first visible drop or inner shadow effect
    const effect = document.effects?.find(
      (e) => (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW") && e.visible !== false
    );
    if (!effect || !effect.color) return null;

    const { r, g, b, a } = effect.color;
    const cr    = Math.round(r * 255);
    const cg    = Math.round(g * 255);
    const cb    = Math.round(b * 255);
    const ca    = Math.round(a * 1000) / 1000;
    const x     = Math.round(effect.offset?.x ?? 0);
    const y     = Math.round(effect.offset?.y ?? 0);
    const blur  = Math.round(effect.radius ?? 0);
    const spread = Math.round(effect.spread ?? 0);
    const inset = effect.type === "INNER_SHADOW" ? "inset " : "";
    const spreadPart = spread !== 0 ? ` ${spread}px` : "";
    const value = `${inset}${x}px ${y}px ${blur}px${spreadPart} rgba(${cr}, ${cg}, ${cb}, ${ca})`;

    return { figmaName: style.name, styleType: "EFFECT", value };
  }

  return null; // GRID — no CSS output
}
