"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogBody, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Monitor,
  Layout,
  Settings,
  Tablet,
  Smartphone,
  Navigation,
  MousePointerClick,
  BookOpen,
  Plug,
  Unplug,
  CheckCircle2,
  FileCode2,
  // icons used for built-component auto-matching
  AlignLeft,
  Bell,
  ChevronRight,
  CreditCard,
  Flag,
  FormInput,
  Heading,
  Image,
  List,
  ListOrdered,
  MessageSquare,
  PanelTop,
  Rows3,
  Search,
  SlidersHorizontal,
  Star,
  Tag,
  ToggleLeft,
  Type,
  User,
  VideoIcon,
} from "lucide-react";
import playgroundStyles from "./Playground.module.css";
import { ButtonGroup } from "@/components/ui/button-group";
import { Button } from "@/components/ui/button";
import DesignMdView from "./DesignMdView";
import PlaygroundToolbar from "./PlaygroundToolbar";
import { SchemeProvider, type SchemeName } from "./SchemeContext";
import FigmaConfigPanel from "./FigmaConfigPanel";
import FramePicker, { type SelectedFrame } from "./FramePicker";
import BuildPanel from "./BuildPanel";
import { useFigmaConfig } from "@/hooks/useFigmaConfig";
import { FigmaConfigProvider } from "@/hooks/FigmaConfigProvider";
import { Badge } from "@/components/ui/badge";
import PackageModal from "./PackageModal";


import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import {
  ContextMenuRoot,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";

type View = "desktop" | "playground";

type Props = {
  view: View;
  onNavigate: (view: View) => void;
  /** When true, open the Settings dialog as soon as the playground mounts. */
  openSettings?: boolean;
};

type NavItem = {
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
  navigatesTo?: View;
};

// ── Built-component icon picker ───────────────────────────────────────────────
// Maps component name keywords → a relevant lucide icon. Checked in order;
// first match wins. Falls back to FileCode2 if nothing matches.
type LucideIcon = React.ComponentType<{ size?: number; className?: string }>;
const COMPONENT_ICON_RULES: Array<{ keywords: string[]; icon: LucideIcon }> = [
  { keywords: ["banner", "hero", "header"],        icon: PanelTop },
  { keywords: ["nav", "navbar", "navigation", "menu"], icon: Navigation },
  { keywords: ["card", "tile"],                    icon: CreditCard },
  { keywords: ["chip", "tag", "badge", "label", "pill"], icon: Tag },
  { keywords: ["list", "grid", "feed", "items"],   icon: List },
  { keywords: ["table", "row", "rows"],            icon: Rows3 },
  { keywords: ["form", "input", "field"],          icon: FormInput },
  { keywords: ["search"],                          icon: Search },
  { keywords: ["toggle", "switch"],                icon: ToggleLeft },
  { keywords: ["slider", "filter", "control"],     icon: SlidersHorizontal },
  { keywords: ["alert", "notification", "toast"],  icon: Bell },
  { keywords: ["modal", "dialog", "drawer"],       icon: MessageSquare },
  { keywords: ["video", "film", "player", "reel"],    icon: VideoIcon },
  { keywords: ["image", "photo", "media", "picture"], icon: Image },
  { keywords: ["avatar", "user", "profile"],       icon: User },
  { keywords: ["heading", "title", "text", "body", "copy"], icon: Type },
  { keywords: ["section", "layout", "panel"],      icon: Layout },
  { keywords: ["step", "breadcrumb", "progress"],  icon: ChevronRight },
  { keywords: ["rating", "star", "review"],        icon: Star },
  { keywords: ["flag", "ribbon", "promo"],         icon: Flag },
  { keywords: ["ordered", "numbered"],             icon: ListOrdered },
  { keywords: ["cta", "calltoaction", "action"],   icon: MousePointerClick },
];

function iconForComponent(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const rule of COMPONENT_ICON_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) return rule.icon;
  }
  return FileCode2;
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Variations data model ─────────────────────────────────────────────────────

export interface VariationRecord {
  name: string;            // lowercased + trimmed
  description?: string;
  frame: string;           // Figma frame name
  builtWith: string;       // "React · CSS"
  date: string;            // ISO date
}

export interface ComponentRecord {
  name: string;            // e.g. "Chip"
  frame: string;           // Figma frame name
  frameId?: string;        // Figma node ID — used for screenshot in Package for dev
  builtWith: string;
  date: string;
  status: 'current' | 'done';
  variations: VariationRecord[];
}

const COMPONENTS_STORAGE_KEY = "playground_components";

function loadStoredComponents(): ComponentRecord[] {
  try {
    const raw = localStorage.getItem(COMPONENTS_STORAGE_KEY);
    if (!raw) return [];
    const stored = JSON.parse(raw) as ComponentRecord[];
    // Migrate 1: existing records without status default to 'done'
    // Migrate 2: normalise names to PascalCase so they always match disk filenames
    return stored.map((c) => ({
      ...c,
      name:   toPascalCase(c.name),
      status: c.status ?? 'done',
    }));
  } catch { return []; }
}

function saveStoredComponents(cs: ComponentRecord[]): void {
  try { localStorage.setItem(COMPONENTS_STORAGE_KEY, JSON.stringify(cs)); } catch {}
}

/**
 * Convert any string to PascalCase so the component name stored in
 * builtComponentsList always matches the disk filename that /api/components
 * generates (which is the PascalCase .tsx basename).
 *
 * Examples:
 *   "tagline"          → "Tagline"
 *   "cta-component-01" → "CtaComponent01"
 *   "hero section"     → "HeroSection"
 *   "Fig Cards"        → "FigCards"
 *   "MyComponent"      → "MyComponent"  (already correct, untouched)
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase()) // delimiters → uppercase next char
    .replace(/^(.)/, (c: string) => c.toUpperCase());           // capitalise first char
}

// ── ComponentPreview ──────────────────────────────────────────────────────────
// Wraps the preview iframe with a skeleton loading state and retry logic.
// On mount it calls /api/components to ensure the preview page exists, then
// shows the iframe. The skeleton is shown while waiting for the API call and
// while the iframe is loading. If the iframe returns a 404 (Next.js page not
// compiled yet) it retries up to 5 times with 1 s delays before showing an error.

function PreviewSkeleton({ viewport }: { viewport: string }) {
  return (
    <div
      style={{
        width: viewport,
        height: "100%",
        flexShrink: 0,
        background: "#1a1a1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
      }}
    >
      {/* Shimmer blocks mimicking a generic component layout */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "min(480px, 80%)" }}>
        <div style={shimmer({ width: "35%",  height: "12px", borderRadius: "4px" })} />
        <div style={shimmer({ width: "100%", height: "48px", borderRadius: "8px" })} />
        <div style={shimmer({ width: "80%",  height: "12px", borderRadius: "4px" })} />
        <div style={shimmer({ width: "60%",  height: "12px", borderRadius: "4px" })} />
        <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
          <div style={shimmer({ width: "96px", height: "36px", borderRadius: "6px" })} />
          <div style={shimmer({ width: "80px", height: "36px", borderRadius: "6px" })} />
        </div>
      </div>
    </div>
  );
}

/** Returns an inline style object with a looping shimmer animation. */
function shimmer(base: React.CSSProperties): React.CSSProperties {
  return {
    ...base,
    background: "linear-gradient(90deg, #2a2a2a 25%, #333 50%, #2a2a2a 75%)",
    backgroundSize: "200% 100%",
    animation: "pg-shimmer 1.4s ease-in-out infinite",
  };
}

function ComponentPreview({ name, viewport, scheme }: {
  name:     string;
  viewport: string;
  scheme?:  string;
}) {
  const [iframeKey,   setIframeKey]   = useState(0);
  const [ready,       setReady]       = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [errored,     setErrored]     = useState(false);
  const retriesRef  = useRef(0);
  const MAX_RETRIES = 5;

  const src = `/preview/component/${encodeURIComponent(name)}${scheme ? `?scheme=${scheme}` : ""}`;

  // On every new component name: hit /api/components first so the page.tsx
  // is written to disk, then show the iframe.
  useEffect(() => {
    retriesRef.current = 0;
    setReady(false);
    setIframeLoaded(false);
    setErrored(false);
    fetch("/api/components").finally(() => setReady(true));
  }, [name]);

  // Reset loaded state when iframeKey changes (retry)
  useEffect(() => {
    setIframeLoaded(false);
  }, [iframeKey]);

  // Detect 404 from the iframe by inspecting the loaded document title.
  const handleLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    try {
      const title = (e.currentTarget.contentDocument?.title ?? "").toLowerCase();
      const is404 = title.includes("404") || title.includes("not found");
      if (is404 && retriesRef.current < MAX_RETRIES) {
        retriesRef.current += 1;
        setTimeout(() => setIframeKey((k) => k + 1), 1000);
        return;
      } else if (is404) {
        setErrored(true);
        return;
      }
    } catch {
      // cross-origin — treat as ok
    }
    setIframeLoaded(true);
  };

  if (errored) return (
    <div className="flex-1 flex items-center justify-center gap-2" style={{ background: "#1a1a1a" }}>
      <span className="text-xs text-muted-foreground">Preview not available — try refreshing.</span>
      <button className="text-xs text-primary underline" onClick={() => { retriesRef.current = 0; setErrored(false); setIframeKey((k) => k + 1); }}>Retry</button>
    </div>
  );

  const showSkeleton = !ready || !iframeLoaded;

  return (
    <div style={{ position: "relative", width: viewport, height: "100%", flexShrink: 0 }}>
      {/* Skeleton — shown until iframe is fully loaded */}
      {showSkeleton && (
        <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          <PreviewSkeleton viewport={viewport} />
        </div>
      )}
      {/* Iframe — rendered even while skeleton shows so it loads in background */}
      {ready && (
        <iframe
          key={`${name}-${viewport}-${iframeKey}`}
          src={src}
          onLoad={handleLoad}
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
            opacity: iframeLoaded ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
          title={name}
        />
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

const NAV_PROTOTYPES: NavItem[] = [];

const NAV_COMPONENTS: NavItem[] = [];

const NAV_DESIGN_SYSTEM: NavItem[] = [
  { label: "Design Variables", icon: BookOpen },
];

function NavGroup({
  label,
  items,
  isItemActive,
  onSelect,
}: {
  label: string;
  items: NavItem[];
  isItemActive: (item: NavItem) => boolean;
  onSelect: (item: NavItem) => void;
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="uppercase tracking-wider text-[10px]">
        {label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  isActive={isItemActive(item)}
                  disabled={item.disabled}
                  onClick={() => onSelect(item)}
                  className="gap-2.5"
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

type Viewport = "desktop" | "tablet" | "mobile";

const VIEWPORT_WIDTH: Record<Viewport, string> = {
  desktop: "100%",
  tablet: "801px",
  mobile: "400px",
};

const DEFAULT_PROJECT_NAME = "My Project";
const DEFAULT_LOGO = "/huge-logo.png";

export type FrameworkKey  = "react" | "nextjs" | "vue" | "svelte" | "angular" | "html" | "webcomponent";
export type AnimationKey  = "none"  | "css" | "gsap" | "framer";

const FRAMEWORK_OPTIONS: { value: FrameworkKey; label: string }[] = [
  { value: "react",        label: "React"          },
  { value: "nextjs",       label: "Next.js"        },
  { value: "vue",          label: "Vue"            },
  { value: "svelte",       label: "Svelte"         },
  { value: "angular",      label: "Angular"        },
  { value: "html",         label: "HTML / CSS"     },
  { value: "webcomponent", label: "Web Component"  },
];

const ANIMATION_OPTIONS: { value: AnimationKey; label: string }[] = [
  { value: "css",    label: "CSS"           },
  { value: "gsap",   label: "GSAP"          },
  { value: "framer", label: "Framer Motion" },
];

function toggleAnimation(current: AnimationKey[], key: AnimationKey): AnimationKey[] {
  const without = current.filter((k) => k !== "none" && k !== key);
  if (current.includes(key)) {
    // Don't allow deselecting the last item
    return without.length ? without : current;
  }
  if (without.length >= 2) return current; // max 2 selections
  return [...without, key];
}

function PlaygroundInner({ view, onNavigate, openSettings: openSettingsOnMount }: Props) {
  const [localItem, setLocalItem] = useState("Design Variables");
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [schemeOverride, setSchemeOverride] = useState<SchemeName | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [figmaConfigOpen, setFigmaConfigOpen] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<SelectedFrame | null>(null);
  const [frameLoading,  setFrameLoading]  = useState(false);
  const [builtFrameIds, setBuiltFrameIds] = useState<Set<string>>(new Set());
  // Filesystem + localStorage backed component list
  const [builtComponentsList, setBuiltComponentsList] = useState<ComponentRecord[]>([]);

  // DONE section collapse state
  const [doneOpen, setDoneOpen] = useState(false);

  // Frame switch warning (triggered when selecting a new frame while CURRENT exists)
  const [switchFrameWarningOpen, setSwitchFrameWarningOpen] = useState(false);
  const [pendingFrameSelection, setPendingFrameSelection] = useState<SelectedFrame | null>(null);


  // Variation modal state
  const [variationModalOpen,    setVariationModalOpen]    = useState(false);
  const [variationTargetName,   setVariationTargetName]   = useState<string>("");
  const [variationNameInput,    setVariationNameInput]    = useState("");
  const [variationDescInput,    setVariationDescInput]    = useState("");
  const [pendingVariation,      setPendingVariation]      = useState<{
    parentName:    string;
    variationName: string;
    description?:  string;
  } | null>(null);

  // Package-for-dev modal
  const [packageModalOpen, setPackageModalOpen] = useState(false);

  const [projectName, setProjectName] = useState(DEFAULT_PROJECT_NAME);
  const { config, isConnected, clearConfig } = useFigmaConfig();
  const [draftName, setDraftName] = useState(DEFAULT_PROJECT_NAME);
  const [logoSrc, setLogoSrc] = useState(DEFAULT_LOGO);
  const [draftLogoSrc, setDraftLogoSrc] = useState(DEFAULT_LOGO);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [framework,      setFramework]      = useState<FrameworkKey>("react");
  const [animation,      setAnimation]      = useState<AnimationKey[]>(["css"]);
  const [draftFramework, setDraftFramework] = useState<FrameworkKey>("react");
  const [draftAnimation, setDraftAnimation] = useState<AnimationKey[]>(["css"]);
  // Original stack — recorded on first build, never changed after that
  const [originalFramework, setOriginalFramework] = useState<FrameworkKey | null>(null);
  const [originalAnimation, setOriginalAnimation] = useState<AnimationKey[] | null>(null);
  // Warning modal when stack changes after first build
  const [stackWarningOpen, setStackWarningOpen] = useState(false);

  // Load persisted settings from localStorage on mount
  useEffect(() => {
    const savedName = localStorage.getItem("playground-project-name");
    if (savedName) { setProjectName(savedName); setDraftName(savedName); }
    const savedLogo = localStorage.getItem("playground-logo");
    if (savedLogo) { setLogoSrc(savedLogo); setDraftLogoSrc(savedLogo); }
    const savedFw = localStorage.getItem("playground_framework") as FrameworkKey | null;
    if (savedFw) { setFramework(savedFw); setDraftFramework(savedFw); }
    try {
      const raw = localStorage.getItem("playground_animation");
      const parsed = raw ? (JSON.parse(raw) as AnimationKey[]) : ["css"];
      const valid = (Array.isArray(parsed) && parsed.length > 0 ? parsed : ["css"]) as AnimationKey[];
      setAnimation(valid);
      setDraftAnimation(valid);
    } catch {
      // unparseable — fall back to css
    }
    // Original stack (set on first build)
    const savedOrigFw = localStorage.getItem("playground_original_framework") as FrameworkKey | null;
    if (savedOrigFw) setOriginalFramework(savedOrigFw);
    try {
      const rawOrig = localStorage.getItem("playground_original_animation");
      if (rawOrig) setOriginalAnimation(JSON.parse(rawOrig) as AnimationKey[]);
    } catch { /* ignore */ }
  }, []);

  // Scan /components/ for built component files and sync the barrel.
  // Returns the discovered names so callers can react (e.g. navigate to a new one).
  const refreshComponents = (): Promise<string[]> =>
    fetch("/api/components")
      .then((r) => r.json())
      .then((data: { components: Array<{ componentName: string }> }) => {
        const diskNames = data.components.map((c) => c.componentName);
        setBuiltComponentsList((prev) => {
          // Case-insensitive lookup: Figma frame names are often lowercase ("tagline")
          // but disk files are PascalCase ("Tagline"). Match them by lowercased key so
          // the disk entry inherits the existing metadata instead of creating a duplicate.
          const prevMapLower = new Map(prev.map((c) => [c.name.toLowerCase(), c]));
          // Disk-based components — use PascalCase name from disk, keep existing metadata
          const diskEntries = diskNames.map((name) => {
            const existing = prevMapLower.get(name.toLowerCase());
            return existing ? { ...existing, name } : {
              name,
              frame: "",
              builtWith: "",
              date: "",
              status: 'done' as const,
              variations: [],
            };
          });
          // Preserve manually-tracked items that don't exist on disk
          const diskLower = new Set(diskNames.map((n) => n.toLowerCase()));
          const manualEntries = prev.filter((c) => !diskLower.has(c.name.toLowerCase()));
          const merged = [...diskEntries, ...manualEntries];
          saveStoredComponents(merged);
          return merged;
        });
        return diskNames;
      })
      .catch(() => []);

  // Poll every 3 s — auto-discovers components as soon as they land on disk.
  // On mount, clear ALL playground localStorage keys so every fresh clone
  // starts with no project data — connection, tokens, components, settings.
  useEffect(() => {
    // Component/build state
    localStorage.removeItem("playground_built_components");
    localStorage.removeItem(COMPONENTS_STORAGE_KEY);
    // Project identity
    localStorage.removeItem("playground-project-name");
    localStorage.removeItem("playground-logo");
    // Framework / animation settings
    localStorage.removeItem("playground_framework");
    localStorage.removeItem("playground_animation");
    localStorage.removeItem("playground_original_framework");
    localStorage.removeItem("playground_original_animation");
    // Figma connection (token + file key stored client-side)
    localStorage.removeItem("figma-token");
    localStorage.removeItem("figma-file-key");
    localStorage.removeItem("figma-file-name");
    localStorage.removeItem("figma_token");
    localStorage.removeItem("figma_fileKey");
    localStorage.removeItem("figma_fileName");
    const stored = loadStoredComponents();
    if (stored.length > 0) setBuiltComponentsList(stored);
    refreshComponents();
    const id = setInterval(refreshComponents, 3000);
    // Auto-open settings when launched from "Get Started"
    if (openSettingsOnMount) setSettingsOpen(true);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle "View reference page" navigation from DesignSystemImport modal
  useEffect(() => {
    const handler = (e: Event) => {
      const item = (e as CustomEvent<string>).detail;
      setLocalItem(item);
      setFigmaConfigOpen(false);
      onNavigate("playground");
    };
    window.addEventListener("playground:navigate", handler);
    return () => window.removeEventListener("playground:navigate", handler);
  }, [onNavigate]);

  const handleLogoFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // SVGs are already small — store directly
      if (file.type === "image/svg+xml") {
        setDraftLogoSrc(dataUrl);
        return;
      }
      // Raster images: downscale to max 256px so the data URL stays well under localStorage limits
      const img = document.createElement("img");
      img.onload = () => {
        const MAX = 256;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setDraftLogoSrc(canvas.toDataURL("image/png"));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleMarkDone = (name: string) => {
    setBuiltComponentsList((prev) => {
      const updated = prev.map((c) => c.name === name ? { ...c, status: 'done' as const } : c);
      saveStoredComponents(updated);
      return updated;
    });
  };

  const handleMoveBack = (name: string) => {
    // Set the target to 'current' — no auto-demotion of other current items.
    // Demoting the existing current item caused a "swap" where Done stayed the
    // same size (item moved out, existing current moved in).
    setBuiltComponentsList((prev) => {
      const updated = prev.map((c) =>
        c.name === name ? { ...c, status: 'current' as const } : c
      );
      saveStoredComponents(updated);
      return updated;
    });
  };


  const commitSettings = () => {
    const name = draftName.trim() || DEFAULT_PROJECT_NAME;
    setProjectName(name);
    setDraftName(name);
    localStorage.setItem("playground-project-name", name);
    setLogoSrc(draftLogoSrc);
    if (draftLogoSrc === DEFAULT_LOGO) {
      localStorage.removeItem("playground-logo");
    } else {
      try {
        localStorage.setItem("playground-logo", draftLogoSrc);
      } catch (e) {
        console.warn("Could not persist logo to localStorage (quota exceeded?):", e);
      }
    }
    setFramework(draftFramework);
    localStorage.setItem("playground_framework", draftFramework);
    setAnimation(draftAnimation);
    localStorage.setItem("playground_animation", JSON.stringify(draftAnimation));
    setSettingsOpen(false);
    setStackWarningOpen(false);
  };

  const saveSettings = () => {
    // If at least one component has been built and the stack is changing, warn first
    const stackChanged =
      draftFramework !== framework ||
      JSON.stringify([...draftAnimation].sort()) !== JSON.stringify([...animation].sort());
    if (originalFramework !== null && stackChanged) {
      setStackWarningOpen(true);
      return;
    }
    commitSettings();
  };

  // Helper: human-readable stack label e.g. "React · CSS + GSAP"
  const stackLabel = (fw: FrameworkKey, ani: AnimationKey[]) => {
    const fwLabels: Record<string, string> = { react: "React", nextjs: "Next.js", vue: "Vue", svelte: "Svelte", angular: "Angular", html: "HTML / CSS", webcomponent: "Web Component" };
    const aniShort: Record<string, string> = { css: "CSS", gsap: "GSAP", framer: "Framer" };
    const aniPart = ani.filter(a => a !== "none").map(a => aniShort[a] ?? a).join(" + ") || "CSS";
    return `${fwLabels[fw] ?? fw} · ${aniPart}`;
  };

  const openSettings = () => {
    setDraftName(projectName);
    setDraftLogoSrc(logoSrc);
    setDraftFramework(framework);
    setDraftAnimation([...animation]);
    setSettingsOpen(true);
  };

  const handleAddVariationConfirm = () => {
    if (!variationNameInput.trim()) return;
    setPendingVariation({
      parentName:    variationTargetName,
      variationName: variationNameInput.trim().toLowerCase(),
      description:   variationDescInput.trim() || undefined,
    });
    setVariationModalOpen(false);
    // Navigate to figma-build so user can pick a frame
    setLocalItem("figma-build");
    onNavigate("playground");
  };

  // The component currently shown in the toolbar (used by PackageModal)
  const toolbarBuiltEntry = (() => {
    const builtName = localItem.startsWith("built:") ? localItem.replace("built:", "") : null;
    return builtName ? builtComponentsList.find((c) => c.name === builtName) ?? null : null;
  })();

  const isItemActive = (item: NavItem): boolean => {
    if (item.navigatesTo !== undefined) {
      // Navigation items reflect the parent view state.
      return view === item.navigatesTo;
    }
    return localItem === item.label;
  };

  const handleSelect = (item: NavItem) => {
    if (item.navigatesTo !== undefined) {
      setLocalItem(""); // clear any built: selection so it doesn't stay highlighted
      onNavigate(item.navigatesTo);
    } else {
      setLocalItem(item.label);
      onNavigate("playground");
    }
  };

  const headerTitle =
    localItem.startsWith("built:") ? localItem.replace("built:", "") :
    localItem;

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <SidebarProvider
        style={
          {
            "--sidebar-width": "200px",
            "--sidebar-width-icon": "3rem",
            "--sidebar": "oklch(0.145 0 0)",
            "--sidebar-foreground": "oklch(0.985 0 0)",
            "--sidebar-accent": "oklch(0.22 0 0)",
            "--sidebar-accent-foreground": "oklch(0.985 0 0)",
            "--sidebar-border": "oklch(1 0 0 / 10%)",
            "--sidebar-primary": "oklch(0.922 0 0)",
            "--sidebar-primary-foreground": "oklch(0.205 0 0)",
            "--sidebar-ring": "oklch(0.556 0 0)",
            minHeight: 0,
            height: "100%",
          } as React.CSSProperties
        }
        className="min-h-0"
      >
        <Sidebar collapsible="none">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  onClick={() => onNavigate("desktop")}
                  className="cursor-pointer"
                >
                  <div className="flex aspect-square size-8 items-center justify-center bg-white overflow-hidden shrink-0" style={{ borderRadius: 4 }}>
                    {logoSrc ? (
                      <img
                        src={logoSrc}
                        alt={projectName}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-[10px] font-bold text-black leading-none select-none">
                        {projectName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col leading-none gap-1">
                    <span className="font-semibold text-sm leading-none">{projectName}</span>
                    <span className="text-xs text-muted-foreground leading-none">Prototype Playground</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <FramePicker
              onFrameSelect={(sel) => {
                // Only warn when switching away from a frame whose own component
                // is in-progress (status 'current') and hasn't had a build copied yet.
                // Matching any 'current' component (e.g. Banner while on a different
                // frame) is wrong — that component is no longer the active work.
                const activeFrameName = toPascalCase(
                  selectedFrame?.frame.parentName ?? selectedFrame?.frame.name ?? ""
                );
                const activeComp = builtComponentsList.find(
                  (c) => c.name.toLowerCase() === activeFrameName.toLowerCase()
                );
                const activeFrameBuilt = selectedFrame
                  ? builtFrameIds.has(selectedFrame.frame.id)
                  : false;
                if (activeComp?.status === 'current' && !activeFrameBuilt) {
                  setPendingFrameSelection(sel);
                  setSwitchFrameWarningOpen(true);
                  return;
                }
                setSelectedFrame(sel);
                setFrameLoading(false);
                setLocalItem("figma-build");
                onNavigate("playground");
              }}
              onFrameLoading={() => {
                setFrameLoading(true);
                setLocalItem("figma-build");
                onNavigate("playground");
              }}
              onFrameLoadDone={() => setFrameLoading(false)}
              selectedFrameId={selectedFrame?.frame.id ?? null}
              builtFrameIds={builtFrameIds}
              onOpenConfig={() => setFigmaConfigOpen(true)}
            />
            <NavGroup
              label="Prototypes"
              items={NAV_PROTOTYPES}
              isItemActive={isItemActive}
              onSelect={handleSelect}
            />

            {/* ── CURRENT ──────────────────────────────────────────────────── */}
            {(() => {
              const currentComps = builtComponentsList.filter((c) => c.status === 'current');
              // Static items that haven't been moved to done (or current)
              const staticItems = NAV_COMPONENTS.filter(
                (item) => !builtComponentsList.some((c) => c.name === item.label)
              );
              return (
                <SidebarGroup>
                  <SidebarGroupLabel className="uppercase tracking-wider text-[10px]">
                    Current
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>

                      {/* ── Current items (status=current) — Claude-built or static nav items ── */}
                      {currentComps.map((currentComp) => {
                        // A static nav item moved to current routes to its simulator view
                        const staticNavMatch = NAV_COMPONENTS.find((n) => n.label === currentComp.name);
                        const isActiveItem = staticNavMatch
                          ? isItemActive(staticNavMatch)
                          : localItem === `built:${currentComp.name}`;
                        const handleCurrentClick = () => {
                          if (staticNavMatch) {
                            handleSelect(staticNavMatch);
                          } else {
                            setLocalItem(`built:${currentComp.name}`);
                            onNavigate("playground");
                          }
                        };
                        return (
                          <ContextMenuRoot key={currentComp.name}>
                            <ContextMenuTrigger render={<SidebarMenuItem />}>
                              <SidebarMenuButton
                                isActive={isActiveItem}
                                className="gap-2.5"
                                onClick={handleCurrentClick}
                              >
                                {(() => { const I = iconForComponent(currentComp.name); return <I size={16} className="shrink-0" />; })()}
                                <span className="truncate">{currentComp.name}</span>
                              </SidebarMenuButton>
                              {currentComp.variations.length > 0 && (
                                <SidebarMenuSub>
                                  {currentComp.variations.map((v) => {
                                    const varCap = v.name.charAt(0).toUpperCase() + v.name.slice(1);
                                    const varKey = `built:${currentComp.name}${varCap}`;
                                    return (
                                      <SidebarMenuSubItem key={v.name}>
                                        <SidebarMenuSubButton
                                          isActive={localItem === varKey}
                                          onClick={() => { setLocalItem(varKey); onNavigate("playground"); }}
                                        >
                                          <span className="text-muted-foreground/50 mr-0.5 select-none">└</span>
                                          {v.name}
                                        </SidebarMenuSubButton>
                                      </SidebarMenuSubItem>
                                    );
                                  })}
                                </SidebarMenuSub>
                              )}
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem onClick={() => handleMarkDone(currentComp.name)}>
                                Move to done
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenuRoot>
                        );
                      })}

                      {/* ── Static component simulators — right-click to move to done ── */}
                      {staticItems.map((item) => {
                        const Icon = item.icon;
                        return (
                          <ContextMenuRoot key={item.label}>
                            <ContextMenuTrigger render={<SidebarMenuItem />}>
                              <SidebarMenuButton
                                isActive={isItemActive(item)}
                                disabled={item.disabled}
                                onClick={() => handleSelect(item)}
                                className="gap-2.5"
                              >
                                <Icon size={16} />
                                <span>{item.label}</span>
                              </SidebarMenuButton>
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem onClick={() => {
                                setBuiltComponentsList((prev) => {
                                  const already = prev.some((c) => c.name === item.label);
                                  const updated = already
                                    ? prev.map((c) => c.name === item.label ? { ...c, status: 'done' as const } : c)
                                    : [...prev, { name: item.label, frame: "", builtWith: "", date: new Date().toISOString().split("T")[0], status: 'done' as const, variations: [] }];
                                  saveStoredComponents(updated);
                                  return updated;
                                });
                              }}>
                                Move to done
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenuRoot>
                        );
                      })}

                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })()}

            {/* ── DONE ─────────────────────────────────────────────────────── */}
            {(() => {
              const doneItems = builtComponentsList.filter((c) => c.status === 'done');
              if (doneItems.length === 0) return null;
              return (
                <Collapsible open={doneOpen} onOpenChange={setDoneOpen}>
                  <SidebarGroup>
                    <SidebarGroupLabel className="uppercase tracking-wider text-[10px]">
                      <CollapsibleTrigger
                        nativeButton={false}
                        render={
                          <div className="flex w-full items-center gap-1.5 cursor-pointer hover:text-sidebar-foreground transition-colors" />
                        }
                      >
                        <ChevronRight
                          size={11}
                          className={cn(
                            "transition-transform duration-200 shrink-0",
                            doneOpen && "rotate-90"
                          )}
                        />
                        Done ({doneItems.length})
                      </CollapsibleTrigger>
                    </SidebarGroupLabel>
                    <CollapsiblePanel>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {doneItems.map((c) => {
                            const navMatch = NAV_COMPONENTS.find((n) => n.label === c.name);
                            const ItemIcon = navMatch ? navMatch.icon : iconForComponent(c.name);
                            const isActive = navMatch ? isItemActive(navMatch) : localItem === `built:${c.name}`;
                            const handleClick = () => {
                              if (navMatch) {
                                handleSelect(navMatch);
                              } else {
                                setLocalItem(`built:${c.name}`);
                                onNavigate("playground");
                              }
                            };
                            return (
                              <ContextMenuRoot key={c.name}>
                                <ContextMenuTrigger render={<SidebarMenuItem />}>
                                  <SidebarMenuButton
                                    isActive={isActive}
                                    className="gap-2.5"
                                    onClick={handleClick}
                                  >
                                    <span className="shrink-0 w-2 h-2 rounded-full bg-green-500" />
                                    <ItemIcon size={16} className="shrink-0" />
                                    <span className="truncate">{c.name}</span>
                                  </SidebarMenuButton>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  <ContextMenuItem onClick={() => handleMoveBack(c.name)}>
                                    Move to current
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenuRoot>
                            );
                          })}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsiblePanel>
                  </SidebarGroup>
                </Collapsible>
              );
            })()}

            <NavGroup
              label="Design System"
              items={NAV_DESIGN_SYSTEM}
              isItemActive={isItemActive}
              onSelect={handleSelect}
            />
            <div style={{ marginTop: "auto" }}>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton className="gap-2.5" onClick={openSettings}>
                        <Settings size={16} />
                        <span>Settings</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
          </SidebarContent>
        </Sidebar>

        <main className="flex flex-1 flex-col min-w-0 overflow-hidden bg-background">
          <div className={cn("pg-chrome shrink-0 border-b border-border px-6 py-4 flex items-center gap-4", localItem === "Design Variables" && "hidden")}>
            <div className="flex-1">
              <h2 className="text-foreground" style={{ fontSize: "24px", fontWeight: 600, lineHeight: 1, letterSpacing: "-0.01em" }}>
                {headerTitle}
              </h2>
              <div className="mt-1.5 flex items-center gap-2">
                {(() => {
                  const fwLabels: Record<string, string> = { react: "React", nextjs: "Next.js", vue: "Vue", svelte: "Svelte", angular: "Angular", html: "HTML / CSS", webcomponent: "Web Component" };
                  const aniShort: Record<string, string> = { css: "CSS", gsap: "GSAP", framer: "Framer" };
                  const aniLibs = animation.filter((a) => a !== "none").map((a) => aniShort[a] ?? a);
                  return (
                    <>
                      <Badge variant="secondary">{fwLabels[framework] ?? framework}</Badge>
                      {aniLibs.map((a) => <Badge key={a} variant="secondary">{a}</Badge>)}
                    </>
                  );
                })()}
              </div>
            </div>
            {localItem.startsWith("built:") && (
              <ButtonGroup aria-label="Viewport size">
                <Button
                  variant={viewport === "desktop" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewport("desktop")}
                >
                  <Monitor size={14} />
                </Button>
                <Button
                  variant={viewport === "tablet" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewport("tablet")}
                >
                  <Tablet size={14} />
                </Button>
                <Button
                  variant={viewport === "mobile" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewport("mobile")}
                >
                  <Smartphone size={14} />
                </Button>
              </ButtonGroup>
            )}

          </div>

          {(() => {
            if (localItem === "Design Variables") return null;

            const isFigmaBuild = localItem === "figma-build" && view === "playground";
            const builtName    = localItem.startsWith("built:") ? localItem.replace("built:", "") : null;
            const builtEntry   = builtName ? builtComponentsList.find((c) => c.name === builtName) : null;

            return (
              <PlaygroundToolbar
                scheme={!isFigmaBuild ? schemeOverride : undefined}
                onSchemeChange={!isFigmaBuild ? setSchemeOverride : undefined}
                framework={isFigmaBuild ? framework : undefined}
                animation={isFigmaBuild ? animation : undefined}
                originalFramework={isFigmaBuild ? (originalFramework ?? undefined) : undefined}
                originalAnimation={isFigmaBuild ? (originalAnimation ?? undefined) : undefined}
                componentName={builtEntry?.name}
                variations={builtEntry?.variations}
                onAddVariation={builtEntry ? () => {
                  setVariationTargetName(builtEntry.name);
                  setVariationNameInput("");
                  setVariationDescInput("");
                  setVariationModalOpen(true);
                } : undefined}
                onSelectVariation={(varName) => {
                  if (!builtEntry) return;
                  const varCap = varName.charAt(0).toUpperCase() + varName.slice(1);
                  setLocalItem(`built:${builtEntry.name}${varCap}`);
                  onNavigate("playground");
                }}
                onPackage={builtEntry ? () => setPackageModalOpen(true) : undefined}
              />
            );
          })()}

          {localItem.startsWith("built:") ? (
            <div
              className="flex-1 min-h-0 h-full overflow-hidden"
              style={{ display: "flex", justifyContent: "center", background: "#1a1a1a" }}
            >
              <ComponentPreview
                name={localItem.replace("built:", "")}
                viewport={VIEWPORT_WIDTH[viewport]}
                scheme={schemeOverride}
              />
            </div>
          ) : localItem === "Design Variables" ? (
            <DesignMdView />
          ) : localItem === "figma-build" ? (
            <BuildPanel
              selection={selectedFrame}
              isLoading={frameLoading}
              onBuild={(frameId) => {
                setBuiltFrameIds((prev) => new Set([...prev, frameId]));
                // Normalise to PascalCase immediately so the stored name always
                // matches the disk filename that /api/components will generate.
                const rawName = selectedFrame?.frame.parentName ?? selectedFrame?.frame.name ?? "";
                const name = toPascalCase(rawName);
                const frame = selectedFrame?.frame.name ?? "";
                const builtWith = stackLabel(framework, animation);
                const date = new Date().toISOString().split("T")[0];
                if (name) {
                  setBuiltComponentsList((prev) => {
                    // Case-insensitive lookup so pre-existing lowercase entries are updated
                    const existing = prev.find((c) => c.name.toLowerCase() === name.toLowerCase());
                    const updated = existing
                      ? prev.map((c) =>
                          c.name.toLowerCase() === name.toLowerCase()
                            ? { ...c, name, frame, frameId, builtWith, date }
                            : c
                        )
                      : [...prev, { name, frame, frameId, builtWith, date, status: 'current' as const, variations: [] }];
                    saveStoredComponents(updated);
                    return updated;
                  });
                }
                if (originalFramework === null) {
                  setOriginalFramework(framework);
                  setOriginalAnimation([...animation]);
                  localStorage.setItem("playground_original_framework", framework);
                  localStorage.setItem("playground_original_animation", JSON.stringify(animation));
                }
              }}
              onVariationAdd={() => {
                if (!pendingVariation || !selectedFrame) return;
                const varRecord: VariationRecord = {
                  name:        pendingVariation.variationName,
                  description: pendingVariation.description,
                  frame:       selectedFrame.frame.name,
                  builtWith:   stackLabel(framework, animation),
                  date:        new Date().toISOString().split("T")[0],
                };
                setBuiltComponentsList((prev) => {
                  const updated = prev.map((c) =>
                    c.name === pendingVariation.parentName
                      ? {
                          ...c,
                          variations: [
                            ...c.variations.filter((v) => v.name !== varRecord.name),
                            varRecord,
                          ],
                        }
                      : c
                  );
                  saveStoredComponents(updated);
                  return updated;
                });
                setPendingVariation(null);
              }}
              variationContext={pendingVariation}
              framework={framework}
              animation={animation}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center overflow-auto p-8">
              <div
                className={cn(
                  "flex w-full max-w-2xl items-center justify-center",
                  "rounded-lg border-2 border-dashed border-border",
                  "px-8 py-20"
                )}
              >
                <p className="text-sm text-muted-foreground">
                  Components will appear here.
                </p>
              </div>
            </div>
          )}
        </main>
      </SidebarProvider>

      {/* ── Figma config panel ── */}
      <FigmaConfigPanel
        open={figmaConfigOpen}
        onOpenChange={setFigmaConfigOpen}
        onConnected={() => {}}
        builtCount={builtComponentsList.length}
      />

      {/* ── Package for dev modal ── */}
      <PackageModal
        open={packageModalOpen}
        onOpenChange={setPackageModalOpen}
        component={toolbarBuiltEntry}
        frameId={toolbarBuiltEntry?.frameId}
        figmaConfig={config}
        figmaFileName={config?.fileName ?? ""}
        onMarkDone={() => {
          if (toolbarBuiltEntry) handleMarkDone(toolbarBuiltEntry.name);
        }}
      />

      {/* ── Stack change warning ── */}
      <Dialog open={stackWarningOpen} onOpenChange={setStackWarningOpen}>
        <DialogContent className="pg-chrome max-w-sm">
          <DialogHeader>
            <DialogTitle>Change stack?</DialogTitle>
            <DialogDescription>
              Changing your stack will affect future builds only.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="py-3">
            <p className="text-sm text-muted-foreground">
              Components already built in this session used{" "}
              <span className="font-medium text-foreground">
                {stackLabel(framework, animation)}
              </span>
              . Changing now means new components won&apos;t match existing ones.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setStackWarningOpen(false);
              setDraftFramework(framework);
              setDraftAnimation([...animation]);
            }}>
              Cancel
            </Button>
            <Button onClick={commitSettings}>Change anyway</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Settings modal ── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="pg-chrome">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
          </DialogHeader>

          <DialogBody className="gap-5">
            {/* Project name */}
            <Field>
              <FieldLabel htmlFor="project-name">Project name</FieldLabel>
              <Input
                id="project-name"
                value={draftName}
                onChange={e => setDraftName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveSettings()}
                placeholder={DEFAULT_PROJECT_NAME}
                autoFocus
              />
            </Field>

            {/* Logo upload */}
            <Field>
              <FieldLabel>Logo</FieldLabel>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleLogoFile(file);
                }}
                className="h-20 flex items-center justify-center cursor-pointer rounded-lg border border-dashed border-border bg-muted p-3 transition-colors hover:border-foreground/40"
              >
                {draftLogoSrc ? (
                  <img
                    src={draftLogoSrc}
                    alt="Logo preview"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">No logo</span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleLogoFile(file);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center justify-between">
                <FieldDescription>Click or drag to replace</FieldDescription>
                {draftLogoSrc && draftLogoSrc !== DEFAULT_LOGO && (
                  <button
                    onClick={() => setDraftLogoSrc(DEFAULT_LOGO)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Reset to default
                  </button>
                )}
              </div>
            </Field>

            <Separator />

            {/* Code output */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <FieldLabel>Code output</FieldLabel>
                {(!framework && !animation) && (
                  <FieldDescription className="italic">
                    Set your stack before building your first component
                  </FieldDescription>
                )}
              </div>
              {/* Framework */}
              <Field>
                <FieldLabel htmlFor="output-framework">Output framework</FieldLabel>
                <Select
                  value={draftFramework}
                  onValueChange={(v) => setDraftFramework(v as FrameworkKey)}
                >
                  <SelectTrigger id="output-framework" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FRAMEWORK_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {/* Animation */}
              <Field>
                <FieldLabel>Animation library</FieldLabel>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {ANIMATION_OPTIONS.map((o) => {
                    const active = draftAnimation.includes(o.value as AnimationKey);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setDraftAnimation(toggleAnimation(draftAnimation, o.value as AnimationKey))}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-full border transition-colors",
                          active
                            ? "bg-accent text-accent-foreground border-accent"
                            : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
            </div>

            <Separator />

            {/* Figma connection */}
            <Field>
              <FieldLabel>Figma</FieldLabel>
              {isConnected && config ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 size={14} className="shrink-0 text-green-500" />
                    <span className="text-sm truncate">{config.fileName || config.fileKey}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => clearConfig()}
                  >
                    <Unplug size={13} />
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => { setSettingsOpen(false); setFigmaConfigOpen(true); }}
                >
                  <Plug size={13} />
                  Connect Figma file
                </Button>
              )}
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={saveSettings}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Switch frame warning ── */}
      {(() => {
        // Resolve name from the frame that was active when the warning was triggered
        const activeFrameName = toPascalCase(
          selectedFrame?.frame.parentName ?? selectedFrame?.frame.name ?? ""
        );
        const activeComp = builtComponentsList.find(
          (c) => c.name.toLowerCase() === activeFrameName.toLowerCase()
        );
        return (
          <Dialog open={switchFrameWarningOpen} onOpenChange={setSwitchFrameWarningOpen}>
            <DialogContent className="pg-chrome max-w-sm">
              <DialogHeader>
                <DialogTitle>Start a new build?</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <DialogDescription>
                  <strong>{activeComp?.name ?? activeFrameName}</strong> is in progress. You can keep working on it later — switching frames will load the new frame into the build panel.
                </DialogDescription>
              </DialogBody>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setSwitchFrameWarningOpen(false);
                  setPendingFrameSelection(null);
                }}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  if (pendingFrameSelection) {
                    setSelectedFrame(pendingFrameSelection);
                    setFrameLoading(false);
                    setLocalItem("figma-build");
                    onNavigate("playground");
                  }
                  setSwitchFrameWarningOpen(false);
                  setPendingFrameSelection(null);
                }}>
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* ── Variation modal ── */}
      <Dialog open={variationModalOpen} onOpenChange={setVariationModalOpen}>
        <DialogContent className="pg-chrome max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a variation</DialogTitle>
            <DialogDescription>
              Give this variation a name and describe what makes it different. Then pick a Figma frame to build from.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="variation-name"
                className="text-xs font-medium text-muted-foreground uppercase tracking-widest"
              >
                Name
              </label>
              <Input
                id="variation-name"
                value={variationNameInput}
                onChange={(e) => setVariationNameInput(e.target.value)}
                placeholder="mobile"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && variationNameInput.trim()) handleAddVariationConfirm();
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="variation-desc"
                className="text-xs font-medium text-muted-foreground uppercase tracking-widest"
              >
                Describe what&apos;s different{" "}
                <span className="normal-case font-normal text-muted-foreground/60">(optional)</span>
              </label>
              <textarea
                id="variation-desc"
                value={variationDescInput}
                onChange={(e) => setVariationDescInput(e.target.value)}
                rows={3}
                placeholder="Stacks vertically, single column, CTA full width"
                className={cn(
                  "w-full rounded-lg border border-input bg-transparent px-2.5 py-2",
                  "text-sm text-foreground placeholder:text-muted-foreground",
                  "resize-none outline-none transition-colors",
                  "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                )}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Then select a Figma frame in the frame picker.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVariationModalOpen(false)}>Cancel</Button>
            <Button
              onClick={handleAddVariationConfirm}
              disabled={!variationNameInput.trim()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Playground(props: Props) {
  return (
    <FigmaConfigProvider>
      <PlaygroundInner {...props} />
    </FigmaConfigProvider>
  );
}
