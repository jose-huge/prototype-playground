"use client";

import { useState, useEffect } from "react";
import { loadGrid, gridPromptBlock } from "@/lib/gridConfig";
import {
  Clipboard,
  ClipboardCheck,
  FileCode2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { getComponentSource, getVariationContext } from "@/app/lib/figmaMcp";
import type { SelectedFrame } from "./FramePicker";

// ── Constants ──────────────────────────────────────────────────────────────────

const FRAMEWORK_LABELS: Record<string, string> = {
  react:        "React (TypeScript, functional components, named export)",
  nextjs:       "Next.js (TypeScript, App Router, functional components, named export)",
  vue:          "Vue 3 (Composition API, single file component, named export)",
  svelte:       "Svelte 5 (single file component, named export)",
  angular:      "Angular (TypeScript, standalone component, named export)",
  html:         "semantic HTML and CSS (no framework, no build step)",
  webcomponent: "a native Web Component (custom element, no framework)",
};

// Keyed by sorted lib keys joined with "+" e.g. "css+gsap"
const ANIMATION_INSTRUCTIONS: Record<string, string> = {
  "css":          "Use CSS transitions and keyframe animations only. No JS animation libraries.",
  "gsap":         "Use GSAP for animations. Import from 'gsap'.",
  "framer":       "Use Framer Motion for animations. Import from 'framer-motion'.",
  "css+gsap":     "Use CSS transitions for simple animations. Use GSAP (import from 'gsap') for complex sequences and scroll animations.",
  "css+framer":   "Use CSS transitions for simple animations. Use Framer Motion (import from 'framer-motion') for component animations.",
  "framer+gsap":  "Use GSAP (import from 'gsap') for timeline and scroll animations. Use Framer Motion (import from 'framer-motion') for component-level animations.",
};

function getAnimationInstruction(animation?: string[]): string | undefined {
  if (!animation) return undefined;
  const libs = animation.filter((a) => a !== "none").sort();
  return libs.length ? ANIMATION_INSTRUCTIONS[libs.join("+")] : undefined;
}

function buildDefaultPrompt(framework?: string, animation?: string[]): string {
  const fw  = framework ? (FRAMEWORK_LABELS[framework] ?? framework) : FRAMEWORK_LABELS.react;
  const ani = getAnimationInstruction(animation);
  return [
    `Build this component in ${fw} using the existing design system tokens.`,
    `Match the Figma frame as closely as possible — layout, spacing, typography, and colors should reflect the design exactly.`,
    `Read the Figma frame data below and set: export const defaultScheme = "{scheme}" as const; using the scheme that matches the frame.`,
    `Opacity tokens (e.g. var(--opacity-white-10)) are rgba() color values — apply them as background-color, border-color, or color. Never use them as a CSS opacity property on an element.`,
    ...(ani ? [`\n${ani}`] : []),
  ].join("\n");
}

function buildComponentHeader(
  framework: string,
  animation: string[],
  frameName: string,
  parentName?: string,
): string {
  const fwShort: Record<string, string> = { react: "React", nextjs: "Next.js", vue: "Vue", svelte: "Svelte", angular: "Angular", html: "HTML / CSS", webcomponent: "Web Component" };
  const aniShort: Record<string, string> = { css: "CSS", gsap: "GSAP", framer: "Framer" };
  const aniPart = animation.filter(a => a !== "none").map(a => aniShort[a] ?? a).join(" + ") || "CSS";
  const stackStr = `${fwShort[framework] ?? framework} · ${aniPart}`;
  const frameStr = parentName ? `${parentName} / ${frameName}` : frameName;
  const date = new Date().toISOString().split("T")[0];
  const isVue = framework === "vue" || framework === "svelte";
  if (isVue) {
    return `<!-- ─────────────────────────────────────────────
  Built with: ${stackStr}
  Figma frame: ${frameStr}
  Date: ${date}
  Stack changes after this build do not affect this file.
───────────────────────────────────────────── -->`;
  }
  return [
    "// ─────────────────────────────────────────────",
    `// Built with: ${stackStr}`,
    `// Figma frame: ${frameStr}`,
    `// Date: ${date}`,
    "// Stack changes after this build do not affect this file.",
    "// ─────────────────────────────────────────────",
  ].join("\n");
}

// ── Types ──────────────────────────────────────────────────────────────────────

type BuildStatus = "idle" | "copied" | "error";

interface Props {
  /** The frame + MCP context selected in the FramePicker */
  selection: SelectedFrame | null;
  /** True while the MCP context is being fetched for a newly selected frame */
  isLoading?: boolean;
  /** Called when the user triggers a new-component build. frameName now included. */
  onBuild: (frameId: string, frameName: string) => void;
  /** Output framework from Settings (e.g. "react", "vue") — defaults to react */
  framework?: string;
  /** Animation libraries from Settings — multi-select array e.g. ["css", "gsap"] */
  animation?: string[];
  /** When set, BuildPanel is in variation mode — shows variation prompt instead of default prompt */
  variationContext?: {
    parentName: string;
    variationName: string;
    description?: string;
  } | null;
  /** Called after user successfully copies a variation build context */
  onVariationAdd?: () => void;
}

// ── Styled textarea ────────────────────────────────────────────────────────────

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "w-full min-h-0 rounded-lg border border-input bg-transparent px-2.5 py-2",
        "text-sm text-foreground placeholder:text-muted-foreground",
        "resize-none outline-none transition-colors",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

// ── Build panel ────────────────────────────────────────────────────────────────

export default function BuildPanel({
  selection,
  isLoading = false,
  onBuild,
  framework,
  animation,
  variationContext,
  onVariationAdd,
}: Props) {
  // Banner shown only when framework has never been explicitly saved (prop is undefined)
  const stackConfigured = framework !== undefined;
  // ── New-component state ──────────────────────────────────────────────────────
  const [prompt,      setPrompt]      = useState(() => buildDefaultPrompt(framework, animation));
  const [status,      setStatus]      = useState<BuildStatus>("idle");
  const [showContext, setShowContext]  = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);

  // ── Variation state ───────────────────────────────────────────────────────────
  const [varPrompt,   setVarPrompt]   = useState("");
  const [varLoading,  setVarLoading]  = useState(false);
  const [varError,    setVarError]    = useState<string | null>(null);

  const isVariationMode = !!variationContext;

  // ── Reset state when selection changes ──────────────────────────────────────
  useEffect(() => {
    setStatus("idle");
    setErrorMsg(null);
    setShowContext(false);
    setPrompt(buildDefaultPrompt(framework, animation));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection?.frame.id]);

  // ── Load variation prompt when variationContext + selection change ────────────
  useEffect(() => {
    if (!variationContext || !selection) return;
    setVarLoading(true);
    setVarError(null);
    setVarPrompt("");
    getVariationContext(
      variationContext.parentName,
      variationContext.variationName,
      variationContext.description ?? "",
      selection.mcpContext
    )
      .then((ctx) => setVarPrompt(ctx))
      .catch((err: unknown) => {
        setVarError(err instanceof Error ? err.message : "Could not assemble variation context");
      })
      .finally(() => setVarLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variationContext?.parentName, variationContext?.variationName, selection?.frame.id]);

  // ── Payload assembly ─────────────────────────────────────────────────────────
  const assemblePayload = (): string => {
    const header = buildComponentHeader(
      framework ?? "react",
      animation ?? ["css"],
      selection?.frame.name ?? "",
      selection?.frame.parentName,
    );
    const headerInstruction = `Add this exact comment block at the very top of the output file, before any imports:\n\`\`\`\n${header}\n\`\`\``;
    const noVerifyInstruction = `Do not open a browser, navigate to a preview URL, or take screenshots to verify the result — the playground renders the component automatically. Stop once the component file and its CSS module are written.`;
    const gridBlock = gridPromptBlock(loadGrid());
    return [prompt.trim(), "", headerInstruction, "", noVerifyInstruction, "", "---", "", gridBlock, "", "---", "", selection?.mcpContext ?? ""].join("\n");
  };

  // ── Clipboard helper ─────────────────────────────────────────────────────────
  const copyToClipboard = (text: string): boolean => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.cssText = "position:fixed;top:-9999px;left:-9999px;opacity:0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  };

  // ── Build handlers ───────────────────────────────────────────────────────────
  const handleBuild = async () => {
    if (!selection) return;
    const payload = assemblePayload();
    let ok = false;
    try {
      await navigator.clipboard.writeText(payload);
      ok = true;
    } catch {
      ok = copyToClipboard(payload);
    }
    if (ok) {
      setStatus("copied");
      setErrorMsg(null);
      onBuild(selection.frame.id, selection.frame.name);
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setErrorMsg("Could not copy to clipboard — try focusing the window first.");
      setStatus("error");
    }
  };

  const handleVariationBuild = async () => {
    if (!selection || !varPrompt.trim()) return;
    let ok = false;
    try {
      await navigator.clipboard.writeText(varPrompt);
      ok = true;
    } catch {
      ok = copyToClipboard(varPrompt);
    }
    if (ok) {
      setStatus("copied");
      setErrorMsg(null);
      onVariationAdd?.();
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setErrorMsg("Could not copy to clipboard — try focusing the window first.");
      setStatus("error");
    }
  };

  // Re-seed prompt when framework or animation changes in Settings
  useEffect(() => {
    setPrompt(buildDefaultPrompt(framework, animation));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [framework, animation]);

  const handleResetPrompt = () => setPrompt(buildDefaultPrompt(framework, animation));

  // ── Loading state (no previous selection yet) ────────────────────────────────
  if (isLoading && !selection) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <div className="shrink-0 border-b border-border px-6 py-4 flex flex-col gap-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
        <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="flex flex-col gap-5 p-6 h-full border-r border-border">
              <Skeleton className="h-4 w-16 rounded" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-3 w-3/4 rounded" />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full bg-muted/20 flex items-center justify-center">
              <Skeleton className="w-4/5 h-4/5 rounded-lg" />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        <div className="shrink-0 px-6 py-4 border-t border-border">
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!selection) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3 text-center max-w-xs">
          <div className="rounded-full bg-muted p-3">
            <FileCode2 size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No frame selected</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Pick a frame from the Figma panel in the sidebar to start building.
          </p>
        </div>
      </div>
    );
  }

  const { frame } = selection;
  const payload   = assemblePayload();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header strip ────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        {isVariationMode ? (
          <p className="text-sm font-semibold leading-tight truncate">
            <span className="text-muted-foreground font-normal">Variation: </span>
            {variationContext!.parentName} → {variationContext!.variationName}
          </p>
        ) : (
          <p className="text-sm font-semibold leading-tight truncate">
            <span className="text-muted-foreground font-normal">
              {"Selected "}
              {frame.type === "COMPONENT" ? "Component:" : "Frame:"}
              {frame.parentName ? ` ↳ ${frame.parentName} ·` : ""}
              {" "}
            </span>
            {frame.name}
          </p>
        )}
      </div>

      {/* ── Two-column resizable body ────────────────────────────────────────── */}
      <ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">

        {/* Left — Prompt / Variation controls */}
        <ResizablePanel defaultSize={40} minSize={20}>
          <div className="flex flex-col gap-5 p-6 h-full overflow-y-auto border-r border-border">

            {isVariationMode ? (
              <>
                {/* Variation header */}
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Building variation</p>
                  <p className="text-sm font-medium text-foreground">
                    {variationContext!.parentName}
                    <span className="text-muted-foreground"> → </span>
                    {variationContext!.variationName}
                  </p>
                  {frame && (
                    <p className="text-xs text-muted-foreground truncate">
                      Figma frame: {frame.name}
                    </p>
                  )}
                </div>

                {/* Loading */}
                {varLoading && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 size={12} className="animate-spin" />
                    Assembling variation context…
                  </div>
                )}

                {/* Error */}
                {varError && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive">
                    <AlertCircle size={12} className="mt-0.5 shrink-0" />
                    <p className="text-xs">{varError}</p>
                  </div>
                )}

                {/* Assembled prompt (editable) */}
                {varPrompt && !varError && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-foreground">Prompt</label>
                    <Textarea
                      rows={14}
                      value={varPrompt}
                      onChange={(e) => setVarPrompt(e.target.value)}
                      aria-label="Variation prompt"
                    />
                    <p className="text-xs text-muted-foreground">
                      Parent source + Figma context included. Edit freely before copying.
                    </p>
                  </div>
                )}

                {/* Context preview */}
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
                    onClick={() => setShowContext((v) => !v)}
                  >
                    {showContext ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {showContext ? "Hide" : "Preview"} Figma context
                  </button>
                  {showContext && (
                    <pre className={cn(
                      "rounded-lg border border-border bg-muted/40 px-3 py-2.5",
                      "text-xs text-muted-foreground font-mono leading-relaxed",
                      "overflow-auto max-h-48 whitespace-pre-wrap break-words"
                    )}>
                      {selection.mcpContext}
                    </pre>
                  )}
                </div>

                {/* Error */}
                {errorMsg && (
                  <p role="alert" className="text-xs text-destructive">{errorMsg}</p>
                )}
              </>
            ) : (
              /* NORMAL NEW-COMPONENT mode */
              <>
                {/* Stack not configured banner */}
                {!stackConfigured && (
                  <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    <AlertCircle size={12} className="mt-0.5 shrink-0 text-amber-500" />
                    <span>Stack not configured — defaulting to React. Update in <strong className="text-foreground">Settings</strong>.</span>
                  </div>
                )}

                {/* Prompt editor */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      Prompt
                    </label>
                    {prompt !== buildDefaultPrompt(framework, animation) && (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={handleResetPrompt}
                      >
                        <RotateCcw size={11} />
                        Reset to default
                      </button>
                    )}
                  </div>
                  <Textarea
                    rows={12}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={buildDefaultPrompt(framework, animation)}
                    aria-label="Build prompt"
                  />
                  <p className="text-xs text-muted-foreground">
                    The Figma frame context is appended automatically below this prompt.
                  </p>
                </div>

                {/* Context preview — collapsible */}
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
                    onClick={() => setShowContext((v) => !v)}
                  >
                    {showContext ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {showContext ? "Hide" : "Preview"} Figma context
                  </button>
                  {showContext && (
                    <pre className={cn(
                      "rounded-lg border border-border bg-muted/40 px-3 py-2.5",
                      "text-xs text-muted-foreground font-mono leading-relaxed",
                      "overflow-auto max-h-48 whitespace-pre-wrap break-words"
                    )}>
                      {selection.mcpContext}
                    </pre>
                  )}
                </div>

                {/* Shared error */}
                {errorMsg && (
                  <p role="alert" className="text-xs text-destructive">
                    {errorMsg}
                  </p>
                )}
              </>
            )}
          </div>
        </ResizablePanel>

        {/* Drag handle */}
        <ResizableHandle withHandle />

        {/* Right — Preview */}
        <ResizablePanel defaultSize={60} minSize={40}>
          <div className="h-full bg-muted/20 flex items-center justify-center overflow-hidden">
            {isLoading ? (
              <Skeleton className="w-4/5 h-4/5 rounded-lg" />
            ) : frame.thumbnailUrl ? (
              <img
                src={frame.thumbnailUrl}
                alt={frame.name}
                className="w-full h-full object-contain p-4"
              />
            ) : (
              <span className="text-5xl font-medium text-muted-foreground/30 uppercase select-none">
                {frame.name.charAt(0)}
              </span>
            )}
          </div>
        </ResizablePanel>

      </ResizablePanelGroup>

      {/* ── Action bar — full width, pinned bottom ───────────────────────────── */}
      <div className="shrink-0 flex flex-col gap-2 px-6 py-4 border-t border-border">
        {isVariationMode ? (
          <Button
            size="default"
            className="w-full gap-2"
            onClick={handleVariationBuild}
            disabled={isLoading || status === "copied" || !varPrompt.trim() || varLoading}
          >
            {status === "copied" ? (
              <><ClipboardCheck size={15} />Copied — paste into Claude Code</>
            ) : (
              <><Clipboard size={15} />Copy variation context</>
            )}
          </Button>
        ) : (
          <Button
            size="default"
            className="w-full gap-2"
            onClick={handleBuild}
            disabled={isLoading || status === "copied" || !prompt.trim()}
          >
            {status === "copied" ? (
              <><ClipboardCheck size={15} />Copied — paste into Claude Code</>
            ) : (
              <><Clipboard size={15} />Copy build context</>
            )}
          </Button>
        )}

        {status === "copied" && (
          <p className="text-xs text-center text-muted-foreground">
            {isVariationMode ? "Variation context" : "Prompt + Figma context"} copied.{" "}
            <span className="text-foreground font-medium">
              Paste it into Claude Code
            </span>{" "}
            to build the component.
          </p>
        )}

        {status === "idle" && !isVariationMode && (
          <p className="text-xs text-center text-muted-foreground">
            {payload.length.toLocaleString()} characters ·{" "}
            {selection.mcpContext.split("\n").length} context lines
          </p>
        )}
      </div>
    </div>
  );
}
