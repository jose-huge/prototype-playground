"use client";

import type { TokenSnapshot, TokenCategory } from "@/app/lib/designSystem";

const CATS: TokenCategory[] = ["colors", "typography", "spacing", "radius", "shadows", "animation", "other"];

const MODE_LABELS: Record<string, string> = {
  both:         "Light + dark",
  "light-only": "Light only",
  "dark-only":  "Dark only",
  single:       "Single mode",
};

export function OverviewSection({
  snapshot,
  onNavigate,
}: {
  snapshot: TokenSnapshot;
  onNavigate: (cat: string) => void;
}) {
  const byCategory = (cat: TokenCategory) => snapshot.tokens.filter((t) => t.category === cat);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {CATS.map((cat) => {
          const count = byCategory(cat).length;
          if (!count) return null;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onNavigate(cat)}
              className="flex flex-col gap-0.5 p-3 rounded-lg border border-border hover:bg-muted/50 text-left transition-colors"
            >
              <span className="text-xs font-medium capitalize">{cat} tokens</span>
              <span className="text-xs text-muted-foreground">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Mode: <strong className="text-foreground font-medium">{MODE_LABELS[snapshot.meta.modeStructure] ?? snapshot.meta.modeStructure}</strong></span>
        <span>Total: <strong className="text-foreground font-medium">{snapshot.tokens.length} tokens</strong></span>
        {snapshot.unresolvedTokens?.length > 0 && (
          <span className="text-amber-600">{snapshot.unresolvedTokens.length} unresolved aliases</span>
        )}
      </div>
    </div>
  );
}
