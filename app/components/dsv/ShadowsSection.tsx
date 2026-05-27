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
    <div className="flex flex-col gap-1">
      {sortShadows(tokens).map((t) => (
        <div
          key={t.cssVar}
          className="flex items-center gap-4 px-3 rounded-md hover:bg-muted/40 group"
        >
          {/* Live shadow preview on a neutral stage */}
          <div
            className="shrink-0 w-28 flex items-center justify-center rounded-sm"
            style={{ background: "#c8c8c8", padding: "28px 16px" }}
          >
            <div
              className="w-14 h-14 rounded-xl bg-white"
              style={{ boxShadow: t.valueLight }}
            />
          </div>
          <div className="flex flex-col gap-0.5 min-w-0 flex-1 py-3">
            <code className="font-mono text-xs text-foreground">{t.cssVar}</code>
            <span className="text-xs text-muted-foreground">{t.figmaName}</span>
            <code className="font-mono text-[11px] text-muted-foreground/70 truncate hidden lg:block">
              {t.valueLight}
            </code>
          </div>
          <CopyButton value={`var(${t.cssVar})`} />
        </div>
      ))}
    </div>
  );
}
