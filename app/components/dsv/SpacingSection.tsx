"use client";

import { CopyButton } from "./shared";
import type { TokenEntry } from "@/app/lib/designSystem";

const parsePixels = (v: string) => parseFloat(v.replace("px", "")) || 0;

export function SpacingSection({ tokens }: { tokens: TokenEntry[] }) {
  if (!tokens.length) return <p className="text-xs text-muted-foreground">No spacing tokens found.</p>;

  const sorted = [...tokens].sort((a, b) => parsePixels(a.valueLight) - parsePixels(b.valueLight));
  const max    = Math.max(...sorted.map((t) => parsePixels(t.valueLight)), 1);

  return (
    <div className="flex flex-col gap-0.5">
      {sorted.map((t) => {
        const pct = Math.min((parsePixels(t.valueLight) / max) * 100, 100);
        return (
          <div key={t.cssVar} className="flex items-center gap-3 py-1.5 px-3 rounded-md hover:bg-muted/50 group">
            <code className="font-mono text-xs text-foreground w-48 shrink-0">{t.cssVar}</code>
            <code className="font-mono text-xs text-muted-foreground w-14 shrink-0">{t.valueLight}</code>
            <div className="flex-1 h-2 rounded-sm bg-muted overflow-hidden">
              <div className="h-full rounded-sm bg-primary/60" style={{ width: `${pct}%` }} />
            </div>
            <CopyButton value={`var(${t.cssVar})`} />
          </div>
        );
      })}
    </div>
  );
}
