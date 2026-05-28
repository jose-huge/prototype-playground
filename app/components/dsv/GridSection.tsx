"use client";

import { useState, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { lsSet } from "@/lib/branchStorage";
import {
  DEFAULT_GRID,
  GRID_LS_KEY,
  loadGrid,
  type GridConfig,
  type GridBreakpoint,
} from "@/lib/gridConfig";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DraftBreakpoint {
  columns: string;
  margin:  string;
  gutter:  string;
}

interface DraftConfig {
  xl: DraftBreakpoint;
  md: DraftBreakpoint;
  xs: DraftBreakpoint;
}

type BpKey = "xl" | "md" | "xs";
type FieldKey = "columns" | "margin" | "gutter";

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDisplay(bp: GridBreakpoint): DraftBreakpoint {
  return {
    columns: String(bp.columns),
    margin:  String(bp.margin),
    gutter:  String(bp.gutter),
  };
}

function toConfig(draft: DraftConfig): GridConfig {
  const parse = (v: string, fallback: number) => {
    const n = parseInt(v, 10);
    return isNaN(n) || n <= 0 ? fallback : n;
  };
  return {
    xl: { columns: parse(draft.xl.columns, DEFAULT_GRID.xl.columns), margin: parse(draft.xl.margin, DEFAULT_GRID.xl.margin), gutter: parse(draft.xl.gutter, DEFAULT_GRID.xl.gutter) },
    md: { columns: parse(draft.md.columns, DEFAULT_GRID.md.columns), margin: parse(draft.md.margin, DEFAULT_GRID.md.margin), gutter: parse(draft.md.gutter, DEFAULT_GRID.md.gutter) },
    xs: { columns: parse(draft.xs.columns, DEFAULT_GRID.xs.columns), margin: parse(draft.xs.margin, DEFAULT_GRID.xs.margin), gutter: parse(draft.xs.gutter, DEFAULT_GRID.xs.gutter) },
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ColHead({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </span>
  );
}

function ValueCell({ value, unit, editing, onChange }: {
  value: string;
  unit?: string;
  editing: boolean;
  onChange: (v: string) => void;
}) {
  if (!editing) {
    return (
      <span className="font-mono text-xs text-foreground tabular-nums">
        {value}{unit}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-0.5">
      <input
        type="number"
        value={value}
        min={1}
        onChange={(e) => onChange(e.target.value)}
        className="w-14 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground tabular-nums"
      />
      {unit && <span className="font-mono text-[11px] text-muted-foreground">{unit}</span>}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function GridSection() {
  const [grid,    setGrid]    = useState<GridConfig>(DEFAULT_GRID);
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState<DraftConfig>({
    xl: toDisplay(DEFAULT_GRID.xl),
    md: toDisplay(DEFAULT_GRID.md),
    xs: toDisplay(DEFAULT_GRID.xs),
  });
  const [saving, setSaving] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadGrid();
    setGrid(saved);
    setDraft({ xl: toDisplay(saved.xl), md: toDisplay(saved.md), xs: toDisplay(saved.xs) });
  }, []);

  const startEdit = () => {
    setDraft({ xl: toDisplay(grid.xl), md: toDisplay(grid.md), xs: toDisplay(grid.xs) });
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft({ xl: toDisplay(grid.xl), md: toDisplay(grid.md), xs: toDisplay(grid.xs) });
    setEditing(false);
  };

  const saveEdit = async () => {
    setSaving(true);
    const next = toConfig(draft);
    // Persist to localStorage
    lsSet(GRID_LS_KEY, JSON.stringify(next));
    setGrid(next);
    // Write grid.css to disk
    try {
      await fetch("/api/grid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
    } catch { /* non-fatal */ }
    setSaving(false);
    setEditing(false);
  };

  const setField = (bp: BpKey, field: FieldKey, value: string) => {
    setDraft((prev) => ({ ...prev, [bp]: { ...prev[bp], [field]: value } }));
  };

  const BREAKPOINTS: Array<{ key: BpKey; label: string; range: string }> = [
    { key: "xl", label: "XL", range: "≥1280px" },
    { key: "md", label: "MD", range: "≥768px"  },
    { key: "xs", label: "XS", range: "<576px"  },
  ];

  return (
    <div className="flex flex-col gap-4">

      {/* Header row with edit controls */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Breakpoints
        </p>
        {!editing ? (
          <Button variant="ghost" size="sm" onClick={startEdit} className="gap-1.5 h-7 px-2 text-xs text-muted-foreground">
            <Pencil size={12} />
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={cancelEdit} className="gap-1 h-7 px-2 text-xs text-muted-foreground">
              <X size={12} />
              Cancel
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={saving} className="gap-1.5 h-7 px-2 text-xs">
              <Check size={12} />
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-md border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[140px_1fr_1fr_1fr] gap-4 px-4 py-2 bg-muted/40 border-b border-border">
          <ColHead>Breakpoint</ColHead>
          <ColHead>Columns</ColHead>
          <ColHead>Margin</ColHead>
          <ColHead>Gutter</ColHead>
        </div>

        {/* Rows */}
        {BREAKPOINTS.map(({ key, label, range }, i) => (
          <div
            key={key}
            className={`grid grid-cols-[140px_1fr_1fr_1fr] gap-4 px-4 py-3 items-center ${i < BREAKPOINTS.length - 1 ? "border-b border-border" : ""}`}
          >
            {/* Breakpoint label */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-sm font-medium text-foreground">{label}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{range}</span>
            </div>

            {/* Columns */}
            <ValueCell
              value={editing ? draft[key].columns : String(grid[key].columns)}
              editing={editing}
              onChange={(v) => setField(key, "columns", v)}
            />

            {/* Margin */}
            <ValueCell
              value={editing ? draft[key].margin : String(grid[key].margin)}
              unit="px"
              editing={editing}
              onChange={(v) => setField(key, "margin", v)}
            />

            {/* Gutter */}
            <ValueCell
              value={editing ? draft[key].gutter : String(grid[key].gutter)}
              unit="px"
              editing={editing}
              onChange={(v) => setField(key, "gutter", v)}
            />
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground/70">
        These are default grid values — Figma import does not import grids. Adjust them once to match your Figma layout grid, then leave them. Values are injected into every build prompt and saved to{" "}
        <code className="font-mono">styles/grid.css</code>.
      </p>

    </div>
  );
}
