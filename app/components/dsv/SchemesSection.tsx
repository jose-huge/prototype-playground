"use client";

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { TokenEntry } from "@/app/lib/designSystem";

/** Group color tokens by their first Figma path segment. */
function groupByPrefix(tokens: TokenEntry[]): Map<string, TokenEntry[]> {
  const map = new Map<string, TokenEntry[]>();
  for (const t of tokens) {
    const key = t.figmaName.includes("/")
      ? t.figmaName.split("/")[0].trim()
      : "Other";
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  return map;
}

function shortLabel(figmaName: string) {
  const parts = figmaName.split("/");
  return parts[parts.length - 1].trim();
}

export function SchemesSection({ colorTokens }: { colorTokens: TokenEntry[] }) {
  if (!colorTokens.length) {
    return <p className="text-xs text-muted-foreground">No color tokens found.</p>;
  }

  const groups = groupByPrefix(colorTokens);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...groups.entries()].map(([groupName, entries]) => {
          // Use the background token for the card bg, if present
          const bgEntry = entries.find((e) =>
            e.figmaName.toLowerCase().includes("background")
          );
          const fgEntry = entries.find((e) =>
            e.figmaName.toLowerCase().includes("headline") ||
            e.figmaName.toLowerCase().includes("text")
          );
          const bg  = bgEntry?.valueLight ?? "#f5f5f5";
          const fg  = fgEntry?.valueLight ?? "#111111";
          const isDark = /^#([0-1][0-9a-fA-F]{5}|0{6})/.test(bg) && bg !== "#ffffff";

          // Show up to 8 swatches
          const swatches = entries.slice(0, 8);

          return (
            <div
              key={groupName}
              className="rounded-lg p-4 flex flex-col gap-3"
              style={{ background: bg }}
            >
              <p
                className="text-xs font-semibold tracking-wide uppercase font-mono truncate"
                style={{ color: fg }}
              >
                {groupName}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {swatches.map((t) => (
                  <Tooltip key={t.cssVar}>
                    <TooltipTrigger
                      className="w-5 h-5 rounded-full shrink-0 cursor-default block"
                      style={{
                        background: t.valueLight,
                        boxShadow: `0 0 0 1.5px ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
                      }}
                    />
                    <TooltipContent>
                      <span className="font-medium">{shortLabel(t.figmaName)}</span>
                      <span className="ml-1.5 opacity-70 font-mono">{t.valueLight}</span>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
