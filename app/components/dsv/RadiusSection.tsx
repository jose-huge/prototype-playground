"use client";

import { CopyButton } from "./shared";
import type { TokenEntry } from "@/app/lib/designSystem";

const parsePixels = (v: string) => parseFloat(v.replace("px", "")) || 0;

export function RadiusSection({ tokens }: { tokens: TokenEntry[] }) {
  if (!tokens.length) return <p className="text-xs text-muted-foreground">No radius tokens found.</p>;

  const sorted = [...tokens].sort((a, b) => parsePixels(a.valueLight) - parsePixels(b.valueLight));

  return (
    <div className="flex flex-wrap gap-6 px-3">
      {sorted.map((t) => (
        <div key={t.cssVar} className="flex flex-col items-center gap-2">
          <div
            className="w-[77px] h-[102px] border-2 border-border bg-muted/40"
            style={{ borderRadius: t.valueLight }}
          />
          <div className="text-center">
            <code className="block font-mono text-xs text-foreground">{t.cssVar}</code>
            <span className="text-xs text-muted-foreground">{t.valueLight}</span>
          </div>
          <CopyButton value={`var(${t.cssVar})`} />
        </div>
      ))}
    </div>
  );
}
