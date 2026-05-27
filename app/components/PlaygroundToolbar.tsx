"use client";

import { Palette, Image as ImageIcon, AlertTriangle, Plus, Download } from "lucide-react";
import { SCHEME_NAMES, type SchemeName } from "./SchemeContext";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const SCHEME_LABELS: Record<SchemeName | "default", string> = {
  default: "Default",
  white: "White",
  "harvest-light": "Harvest Light",
  "harvest-dark": "Harvest Dark",
  "sage-light": "Sage Light",
  "sage-dark": "Sage Dark",
  "sky-light": "Sky Light",
  "sky-dark": "Sky Dark",
  "rose-light": "Rose Light",
  "rose-dark": "Rose Dark",
  "noir-light": "Noir Light",
  "noir-dark": "Noir Dark",
};

export type ToolbarOption = { value: string; label: string };

type Props = {
  // Scheme — omit entirely to hide the scheme selector (e.g. on figma-build)
  scheme?:           SchemeName | undefined;
  onSchemeChange?:   (scheme: SchemeName | undefined) => void;
  // Background
  background?:          string;
  onBackgroundChange?:  (background: string) => void;
  backgroundOptions?:   ToolbarOption[];
  // Framework + animation badge — shown on figma-build
  framework?:           string;
  animation?:           string[];
  // Original stack — used to show mismatch indicator after stack change
  originalFramework?:   string;
  originalAnimation?:   string[];
  // Variations
  /** Name of the currently-viewed built component — shows variation strip */
  componentName?: string;
  /** Existing variations for this component */
  variations?: Array<{ name: string }>;
  /** Called when user clicks "+ Add variation" */
  onAddVariation?: () => void;
  /** Called when user clicks an existing variation chip */
  onSelectVariation?: (name: string) => void;
  /** Called when user clicks "Package for dev" */
  onPackage?: () => void;
};

const FRAMEWORK_LABELS: Record<string, string> = {
  react:        "React",
  nextjs:       "Next.js",
  vue:          "Vue",
  svelte:       "Svelte",
  angular:      "Angular",
  html:         "HTML / CSS",
  webcomponent: "Web Component",
};

const ANIMATION_SHORT: Record<string, string> = {
  css:    "CSS",
  gsap:   "GSAP",
  framer: "Framer",
};

export default function PlaygroundToolbar({
  scheme,
  onSchemeChange,
  background,
  onBackgroundChange,
  backgroundOptions,
  framework,
  animation,
  originalFramework,
  originalAnimation,
  componentName,
  variations,
  onAddVariation,
  onSelectVariation,
  onPackage,
}: Props) {
  const showScheme      = !!onSchemeChange;
  const showBackground  = !!backgroundOptions?.length && !!onBackgroundChange;
  const showFramework   = !!framework;
  const showVariations  = !!componentName;

  const animLibs = animation?.filter((a) => a !== "none") ?? [];
  const animLabel = animLibs.length
    ? animLibs.map((a) => ANIMATION_SHORT[a] ?? a).join(" + ")
    : null;

  // Mismatch: stack was changed after first build
  const fwMismatch  = !!originalFramework && originalFramework !== framework;
  const aniMismatch = !!originalAnimation &&
    JSON.stringify([...(originalAnimation)].sort()) !== JSON.stringify([...(animation ?? [])].sort());
  const stackMismatch = fwMismatch || aniMismatch;

  const origFwLabel  = originalFramework ? (FRAMEWORK_LABELS[originalFramework] ?? originalFramework) : "";
  const origAniLibs  = originalAnimation?.filter((a) => a !== "none") ?? [];
  const origAniLabel = origAniLibs.map((a) => ANIMATION_SHORT[a] ?? a).join(" + ") || "CSS";
  const origStackLabel = `${origFwLabel} · ${origAniLabel}`;

  // Don't render the toolbar at all if nothing to show
  if (!showScheme && !showBackground && !showFramework && !showVariations) return null;

  return (
    <div
      className="pg-chrome shrink-0 border-b border-border px-6 py-2.5 flex items-center gap-6"
      role="toolbar"
      aria-label="Playground toolbar"
    >
      {showScheme && (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <Palette size={14} />
            Scheme
          </span>
          <Select
            value={scheme ?? "default"}
            onValueChange={(v) => onSchemeChange!(v === "default" ? undefined : (v as SchemeName))}
          >
            <SelectTrigger className="h-8 w-44 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">{SCHEME_LABELS.default}</SelectItem>
              {SCHEME_NAMES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SCHEME_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showBackground && (
        <div className="flex items-center gap-3">
          <label
            htmlFor="playground-background"
            className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground"
          >
            <ImageIcon size={14} />
            Background
          </label>
          <select
            id="playground-background"
            value={background}
            onChange={(e) => onBackgroundChange!(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm text-foreground hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {backgroundOptions!.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ── Framework badge — right-aligned ─────────────────────────────────── */}
      {showFramework && (
        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {stackMismatch ? (
            <TooltipProvider delay={200}>
              <Tooltip>
                <TooltipTrigger render={<span className="flex items-center gap-1.5 font-medium text-foreground cursor-default" />}>
                  <span className="text-muted-foreground line-through text-xs">{origStackLabel}</span>
                  <span>→</span>
                  {FRAMEWORK_LABELS[framework!] ?? framework}
                  {animLabel && <span className="font-normal text-muted-foreground"> · {animLabel}</span>}
                  <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                </TooltipTrigger>
                <TooltipContent>
                  Stack changed mid-session — existing components may not match
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="font-medium text-foreground">
              {FRAMEWORK_LABELS[framework!] ?? framework}
              {animLabel && <span className="font-normal text-muted-foreground"> · {animLabel}</span>}
            </span>
          )}
        </div>
      )}

      {/* ── Variation strip ──────────────────────────────────────────────────── */}
      {showVariations && (
        <div className={cn("flex items-center gap-2", showScheme || showBackground || showFramework ? "ml-auto" : "")}>
          {variations?.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={() => onSelectVariation?.(v.name)}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-accent text-accent-foreground hover:bg-accent/70 transition-colors"
            >
              {v.name}
            </button>
          ))}
          {onAddVariation && (
            <TooltipProvider delay={300}>
              <Tooltip>
                <TooltipTrigger
                  render={<span />}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onAddVariation}
                    className="h-7 gap-1.5 text-xs hover:bg-foreground/[0.07] hover:text-foreground"
                  >
                    <Plus size={11} />
                    Add variation
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Use this when a component looks significantly different at another size or state — like a mobile layout that stacks differently, or a logged-out version with different content. Variations are built as separate components and nested under the parent in the sidebar.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {onPackage && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onPackage}
              className="h-7 gap-1.5 text-xs hover:bg-foreground/[0.12] hover:text-foreground"
            >
              <Download size={11} />
              Package
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
