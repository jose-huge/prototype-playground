"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { getDesignTokens } from "@/app/actions/design-tokens";
import type { TokenSnapshot, TokenCategory } from "@/app/lib/designSystem";

// ── Lazy-loaded section chunks ─────────────────────────────────────────────────
// Each section is a separate module — Next.js compiles them on demand,
// not upfront, keeping the initial page compile fast.

const SectionSkeleton = () => (
  <div className="flex flex-col gap-2 py-2">
    {[1, 2, 3].map((i) => (
      <div key={i} className="h-8 rounded-md bg-muted animate-pulse" />
    ))}
  </div>
);

const OverviewSection  = dynamic(() => import("./dsv/OverviewSection" ).then((m) => ({ default: m.OverviewSection  })), { ssr: false, loading: SectionSkeleton });
const SchemesSection   = dynamic(() => import("./dsv/SchemesSection"  ).then((m) => ({ default: m.SchemesSection   })), { ssr: false, loading: SectionSkeleton });
const ColorsSection    = dynamic(() => import("./dsv/ColorsSection"   ).then((m) => ({ default: m.ColorsSection    })), { ssr: false, loading: SectionSkeleton });
const TypographySection= dynamic(() => import("./dsv/TypographySection").then((m) => ({ default: m.TypographySection})), { ssr: false, loading: SectionSkeleton });
const SpacingSection   = dynamic(() => import("./dsv/SpacingSection"  ).then((m) => ({ default: m.SpacingSection   })), { ssr: false, loading: SectionSkeleton });
const RadiusSection    = dynamic(() => import("./dsv/RadiusSection"   ).then((m) => ({ default: m.RadiusSection    })), { ssr: false, loading: SectionSkeleton });
const ShadowsSection   = dynamic(() => import("./dsv/ShadowsSection"  ).then((m) => ({ default: m.ShadowsSection   })), { ssr: false, loading: SectionSkeleton });
const AnimationSection = dynamic(() => import("./dsv/AnimationSection").then((m) => ({ default: m.AnimationSection  })), { ssr: false, loading: SectionSkeleton });
const OtherSection     = dynamic(() => import("./dsv/OtherSection"    ).then((m) => ({ default: m.OtherSection     })), { ssr: false, loading: SectionSkeleton });

// ── Section config ─────────────────────────────────────────────────────────────

type SectionId = TokenCategory | "overview" | "schemes";

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: "overview",   label: "Overview"   },
  { id: "schemes",    label: "Schemes"    },
  { id: "colors",     label: "Colors"     },
  { id: "typography", label: "Typography" },
  { id: "spacing",    label: "Spacing"    },
  { id: "radius",     label: "Radius"     },
  { id: "shadows",    label: "Shadows"    },
  { id: "animation",  label: "Animation"  },
  { id: "other",      label: "Other"      },
];

// ── Shell states ───────────────────────────────────────────────────────────────

function BuildingState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8 py-16">
      <Spinner className="size-6 text-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">Building your design system…</p>
        <p className="text-xs text-muted-foreground mt-1">
          Pulling variables, color schemes, typography, and tokens from your Figma file.
          This takes about 10–20 seconds.
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8 py-16">
      <Download size={28} className="text-muted-foreground/40" />
      <div>
        <p className="text-sm font-medium text-foreground">No design system imported yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Open Settings, connect your Figma file, then click <strong>Import from Figma</strong>.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("playground:navigate", { detail: "Settings" }))
        }
      >
        Open Settings
      </Button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  isImporting?: boolean;
}

export default function DesignMdView({ isImporting = false }: Props) {
  const [snapshot,    setSnapshot]    = useState<TokenSnapshot | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [activeTab,   setActiveTab]   = useState<SectionId>("overview");
  const scrollRef   = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const prevImporting = useRef(isImporting);

  async function load() {
    setError(null);
    try {
      const data = await getDesignTokens();
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setInitLoading(false);
    }
  }

  // Read snapshot from disk on mount
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-read the moment import finishes (true → false transition)
  useEffect(() => {
    if (prevImporting.current === true && !isImporting) {
      setInitLoading(true);
      load();
    }
    prevImporting.current = isImporting;
  }, [isImporting]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollTo = (id: SectionId) => {
    setActiveTab(id);
    const el = sectionRefs.current[id];
    const container = scrollRef.current;
    if (el && container) {
      container.scrollTo({ top: el.offsetTop - 8, behavior: "smooth" });
    }
  };

  // ── Loading / error / empty states ────────────────────────────────────────

  if (isImporting)  return <BuildingState />;

  if (initLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner className="size-4 text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-8">
        <p className="text-sm text-destructive">Failed to load design system</p>
        <p className="text-xs text-muted-foreground">{error}</p>
        <Button size="sm" variant="outline" className="gap-1.5 mt-2" onClick={() => { setInitLoading(true); load(); }}>
          <RotateCcw size={12} /> Retry
        </Button>
      </div>
    );
  }

  if (!snapshot) return <EmptyState />;

  // ── Populated view ────────────────────────────────────────────────────────

  const byCategory = (cat: TokenCategory) => snapshot.tokens.filter((t) => t.category === cat);
  const hasDark    = snapshot.meta.modeStructure === "both" || snapshot.meta.modeStructure === "dark-only";
  const date       = new Date(snapshot.meta.importedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  const visibleSections = SECTIONS.filter((s) => {
    if (s.id === "overview" || s.id === "schemes") return true;
    return byCategory(s.id as TokenCategory).length > 0;
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Sticky header + tabs ────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border bg-background">
        <div className="px-6 pt-4 pb-0 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold leading-tight">Design Variables</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {snapshot.meta.figmaFile} · {date}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 shrink-0"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("playground:navigate", { detail: "Settings" }))
            }
          >
            <Download size={12} />
            Re-import
          </Button>
        </div>

        {/* Tab bar */}
        <nav className="flex px-6 mt-3 overflow-x-auto" aria-label="Design system sections">
          {visibleSections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollTo(s.id)}
              className={cn(
                "px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors",
                activeTab === s.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 flex flex-col gap-0 max-w-4xl">

          {/* Overview */}
          <section ref={(el) => { sectionRefs.current["overview"] = el; }} className="pb-10">
            <h5 className="text-sm font-medium text-foreground mb-6">Overview</h5>
            <OverviewSection snapshot={snapshot} onNavigate={(id) => scrollTo(id as SectionId)} />
          </section>
          <Separator className="mb-10" />

          {/* Schemes */}
          <section ref={(el) => { sectionRefs.current["schemes"] = el; }} className="pb-10">
            <h5 className="text-sm font-medium text-foreground mb-6">Schemes</h5>
            <SchemesSection colorTokens={byCategory("colors")} />
          </section>
          <Separator className="mb-10" />

          {/* Colors */}
          {byCategory("colors").length > 0 && (
            <>
              <section ref={(el) => { sectionRefs.current["colors"] = el; }} className="pb-10">
                <h5 className="text-sm font-medium text-foreground mb-6">Colors</h5>
                <ColorsSection tokens={byCategory("colors")} hasDark={hasDark} />
              </section>
              <Separator className="mb-10" />
            </>
          )}

          {/* Typography */}
          {byCategory("typography").length > 0 && (
            <>
              <section ref={(el) => { sectionRefs.current["typography"] = el; }} className="pb-10">
                <h5 className="text-sm font-medium text-foreground mb-6">Typography</h5>
                <TypographySection tokens={byCategory("typography")} />
              </section>
              <Separator className="mb-10" />
            </>
          )}

          {/* Spacing */}
          {byCategory("spacing").length > 0 && (
            <>
              <section ref={(el) => { sectionRefs.current["spacing"] = el; }} className="pb-10">
                <h5 className="text-sm font-medium text-foreground mb-6">Spacing</h5>
                <SpacingSection tokens={byCategory("spacing")} />
              </section>
              <Separator className="mb-10" />
            </>
          )}

          {/* Radius */}
          {byCategory("radius").length > 0 && (
            <>
              <section ref={(el) => { sectionRefs.current["radius"] = el; }} className="pb-10">
                <h5 className="text-sm font-medium text-foreground mb-6">Border Radius</h5>
                <RadiusSection tokens={byCategory("radius")} />
              </section>
              <Separator className="mb-10" />
            </>
          )}

          {/* Shadows */}
          {byCategory("shadows").length > 0 && (
            <>
              <section ref={(el) => { sectionRefs.current["shadows"] = el; }} className="pb-10">
                <h5 className="text-sm font-medium text-foreground mb-6">Shadows</h5>
                <ShadowsSection tokens={byCategory("shadows")} />
              </section>
              <Separator className="mb-10" />
            </>
          )}

          {/* Animation */}
          {byCategory("animation").length > 0 && (
            <>
              <section ref={(el) => { sectionRefs.current["animation"] = el; }} className="pb-10">
                <h5 className="text-sm font-medium text-foreground mb-6">Animation</h5>
                <AnimationSection tokens={byCategory("animation")} />
              </section>
              <Separator className="mb-10" />
            </>
          )}

          {/* Other */}
          {byCategory("other").length > 0 && (
            <section ref={(el) => { sectionRefs.current["other"] = el; }} className="pb-10">
              <h5 className="text-sm font-medium text-foreground mb-6">Other</h5>
              <OtherSection tokens={byCategory("other")} />
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
