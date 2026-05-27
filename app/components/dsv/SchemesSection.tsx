"use client";

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { SchemeEntry, TokenEntry } from "@/app/lib/designSystem";

// ── Helpers ────────────────────────────────────────────────────────────────────

function shortLabel(figmaName: string) {
  const parts = figmaName.split("/");
  return parts[parts.length - 1].trim();
}

/** Pick the best background + foreground value from a list of swatches */
function pickBgFg(entries: Array<{ figmaName: string; value: string }>) {
  const bg = entries.find((e) =>
    /background|surface|canvas|base/i.test(e.figmaName)
  )?.value ?? entries[0]?.value ?? "#f5f5f5";

  const fg = entries.find((e) =>
    /headline|heading|text|foreground|on-/i.test(e.figmaName)
  )?.value ?? "#111111";

  return { bg, fg };
}

// ── Scheme card ────────────────────────────────────────────────────────────────

function SchemeCard({
  name,
  entries,
}: {
  name: string;
  entries: Array<{ figmaName: string; cssVar?: string; value: string }>;
}) {
  const { bg, fg } = pickBgFg(entries);
  const swatches   = entries.slice(0, 12);

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-3"
      style={{ background: bg }}
    >
      <p
        className="text-xs font-semibold tracking-wide uppercase font-mono truncate"
        style={{ color: fg }}
      >
        {name}
      </p>
      <div className="flex gap-1.5 flex-wrap">
        {swatches.map((t, i) => {
          const isDark = /^#([01][0-9a-fA-F]{5})/.test(bg) && bg !== "#ffffff";
          return (
            <Tooltip key={t.cssVar ?? `${name}-${i}`}>
              <TooltipTrigger
                className="w-5 h-5 rounded-full shrink-0 cursor-default block"
                style={{
                  background: t.value,
                  boxShadow: `0 0 0 1.5px ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.12)"}`,
                }}
              />
              <TooltipContent>
                <span className="font-medium">{shortLabel(t.figmaName)}</span>
                <span className="ml-1.5 opacity-70 font-mono">{t.value}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

// ── Fallback: group colorTokens by first path segment ─────────────────────────

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

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  colorTokens: TokenEntry[];
  schemes?:    SchemeEntry[];
}

export function SchemesSection({ colorTokens, schemes }: Props) {
  if (!colorTokens.length && (!schemes || !schemes.length)) {
    return <p className="text-xs text-muted-foreground">No color tokens found.</p>;
  }

  // ── Primary path: use schemes extracted from Figma variable collection modes ──
  if (schemes && schemes.length > 0) {
    return (
      <TooltipProvider>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {schemes.map((s) => (
            <SchemeCard key={`${s.collection}::${s.name}`} name={s.name} entries={s.tokens} />
          ))}
        </div>
      </TooltipProvider>
    );
  }

  // ── Fallback: group flat color tokens by first Figma path segment ─────────────
  const groups = groupByPrefix(colorTokens);

  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...groups.entries()].map(([groupName, entries]) => (
          <SchemeCard
            key={groupName}
            name={groupName}
            entries={entries.map((t) => ({
              figmaName: t.figmaName,
              cssVar:    t.cssVar,
              value:     t.valueLight,
            }))}
          />
        ))}
      </div>
    </TooltipProvider>
  );
}
