/**
 * Shared grid config types, defaults, and localStorage helpers.
 * Imported by both GridSection (Design Variables) and BuildPanel (prompt injection).
 */

import { lsGet } from "@/lib/branchStorage";

export interface GridBreakpoint {
  columns: number;
  margin:  number; // px
  gutter:  number; // px
}

export interface GridConfig {
  xl: GridBreakpoint;
  md: GridBreakpoint;
  xs: GridBreakpoint;
}

export const DEFAULT_GRID: GridConfig = {
  xl: { columns: 12, margin: 40, gutter: 24 },
  md: { columns: 12, margin: 40, gutter: 24 },
  xs: { columns: 4,  margin: 24, gutter: 24 },
};

export const GRID_LS_KEY = "playground_grid";

/** Read grid config from branch-namespaced localStorage, falling back to defaults. */
export function loadGrid(): GridConfig {
  try {
    const raw = lsGet(GRID_LS_KEY);
    if (!raw) return DEFAULT_GRID;
    return JSON.parse(raw) as GridConfig;
  } catch {
    return DEFAULT_GRID;
  }
}

/** Format grid config as the build-prompt injection block. */
export function gridPromptBlock(g: GridConfig): string {
  return [
    "Grid system:",
    `XL (≥1280px): ${g.xl.columns} columns, ${g.xl.margin}px margin, ${g.xl.gutter}px gutter`,
    `MD (≥768px):  ${g.md.columns} columns, ${g.md.margin}px margin, ${g.md.gutter}px gutter`,
    `XS (<768px):  ${g.xs.columns} columns, ${g.xs.margin}px margin, ${g.xs.gutter}px gutter`,
    "",
    "Use these grid values for layout decisions. Never hardcode layout values that conflict with this grid.",
  ].join("\n");
}
