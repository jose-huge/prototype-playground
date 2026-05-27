"use client";

import { CopyButton, figmaLabel } from "./shared";
import type { TokenEntry } from "@/app/lib/designSystem";

export function TypographySection({ tokens }: { tokens: TokenEntry[] }) {
  if (!tokens.length) return <p className="text-xs text-muted-foreground">No typography tokens found.</p>;

  return (
    <div className="flex flex-col gap-2">
      {tokens.map((t) => {
        const specimen = figmaLabel(t);
        const meta = t.meta;
        const chips: string[] = [];
        if (meta) {
          if (meta.fontSize)                                         chips.push(meta.fontSize);
          if (meta.fontWeight && String(meta.fontWeight) !== "400") chips.push(String(meta.fontWeight));
          if (meta.fontFamily && !/sans/i.test(meta.fontFamily))    chips.push(meta.fontFamily);
          if (meta.lineHeight)                                       chips.push(`lh ${meta.lineHeight}`);
          if (meta.letterSpacing && meta.letterSpacing !== "0")     chips.push(`ls ${meta.letterSpacing}`);
        }
        return (
          <div key={t.cssVar} className="border border-border rounded-lg p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <code className="font-mono text-xs text-foreground">{t.cssVar}</code>
              <span className="text-xs text-muted-foreground">{t.figmaName}</span>
              <CopyButton value={`var(${t.cssVar})`} />
            </div>
            {meta ? (
              <div
                className="overflow-hidden text-ellipsis text-foreground"
                style={{
                  fontFamily:    meta.fontFamily    ?? "inherit",
                  fontSize:      meta.fontSize      ?? "inherit",
                  fontWeight:    meta.fontWeight    ? Number(meta.fontWeight) : undefined,
                  lineHeight:    meta.lineHeight    ?? "normal",
                  letterSpacing: meta.letterSpacing ?? "normal",
                }}
              >
                {specimen}
              </div>
            ) : (
              <div className="text-foreground overflow-hidden" style={{ fontSize: t.valueLight }}>
                {specimen}
              </div>
            )}
            {chips.length > 0 && (
              <p className="text-xs text-muted-foreground">{chips.join(" · ")}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
