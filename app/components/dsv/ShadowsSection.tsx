"use client";

import { CopyButton } from "./shared";
import type { TokenEntry } from "@/app/lib/designSystem";

const SIZE_ORDER = ["xxsmall", "xsmall", "small", "medium", "large", "xlarge", "xxlarge"];

function sortShadows(tokens: TokenEntry[]) {
  return [...tokens].sort((a, b) => {
    const ai = SIZE_ORDER.indexOf(a.figmaName.toLowerCase());
    const bi = SIZE_ORDER.indexOf(b.figmaName.toLowerCase());
    if (ai === -1 && bi === -1) return a.figmaName.localeCompare(b.figmaName);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export function ShadowsSection({ tokens }: { tokens: TokenEntry[] }) {
  if (!tokens.length) return <p className="text-xs text-muted-foreground">No shadow tokens found.</p>;

  return (
    <div className="flex flex-row gap-6 flex-wrap">
      {sortShadows(tokens).map((t) => (
        <div key={t.cssVar} className="flex flex-col items-start gap-3 group">
          {/* Shadow preview card */}
          <div
            className="w-32 h-32 rounded-2xl bg-background"
            style={{ boxShadow: t.valueLight }}
          />
          {/* CSS var + copy */}
          <div className="flex items-center gap-1">
            <code className="font-mono text-xs bg-muted px-2 py-0.5 rounded text-foreground">
              {t.cssVar}
            </code>
            <CopyButton value={`var(${t.cssVar})`} />
          </div>
          {/* Value */}
          <span className="text-xs text-muted-foreground leading-snug max-w-[8rem] break-words block">
            {t.valueLight}
          </span>
        </div>
      ))}
    </div>
  );
}
