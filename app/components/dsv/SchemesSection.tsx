"use client";

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import type { SchemeEntry, TokenEntry } from "@/app/lib/designSystem";

// ── Helpers ────────────────────────────────────────────────────────────────────

function shortLabel(figmaName: string) {
  const parts = figmaName.split("/");
  return parts[parts.length - 1].trim();
}

function pickBg(entries: Array<{ figmaName: string; value: string }>) {
  return (
    entries.find((e) => /background|surface|canvas|base/i.test(e.figmaName))?.value ??
    entries[0]?.value ??
    "#f5f5f5"
  );
}

function pickDot(entries: Array<{ figmaName: string; value: string }>) {
  return (
    entries.find((e) => /accent|primary|brand/i.test(e.figmaName))?.value ??
    entries.find((e) => /foreground|text|heading|on-/i.test(e.figmaName))?.value ??
    entries[1]?.value ??
    "#888888"
  );
}

function toDataScheme(name: string) {
  return name.trim().toLowerCase().replace(/\s*\+\s*/g, "-").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ── Scheme card ────────────────────────────────────────────────────────────────

function SchemeCard({ name, entries }: {
  name: string;
  entries: Array<{ figmaName: string; cssVar?: string; value: string }>;
}) {
  const bg         = pickBg(entries);
  const dot        = pickDot(entries);
  const dataScheme = toDataScheme(name);
  const swatches   = entries.slice(0, 10);

  return (
    <Card className="overflow-hidden">
      {/* Colored banner with dot + swatches */}
      <div className="h-28 relative p-3 flex flex-col justify-end" style={{ background: bg }}>
        <TooltipProvider>
          <div className="flex gap-1 flex-wrap">
            {swatches.map((t, i) => (
              <Tooltip key={t.cssVar ?? `${name}-${i}`}>
                <TooltipTrigger
                  className="w-4 h-4 rounded-full shrink-0 cursor-default block"
                  style={{
                    background: t.value,
                    boxShadow: "0 0 0 1.5px rgba(0,0,0,0.1)",
                  }}
                />
                <TooltipContent>
                  <span className="font-medium">{shortLabel(t.figmaName)}</span>
                  <span className="ml-1.5 opacity-70 font-mono">{t.value}</span>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </div>

      {/* Card body */}
      <CardContent className="pt-3 flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        <code className="text-xs text-muted-foreground font-mono break-all">
          data-scheme=&quot;{dataScheme}&quot;
        </code>
      </CardContent>
    </Card>
  );
}

// ── Fallback: group colorTokens by first path segment ─────────────────────────

function groupByPrefix(tokens: TokenEntry[]): Map<string, TokenEntry[]> {
  const map = new Map<string, TokenEntry[]>();
  for (const t of tokens) {
    const key = t.figmaName.includes("/") ? t.figmaName.split("/")[0].trim() : "Other";
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

  if (schemes && schemes.length > 0) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {schemes.map((s) => (
          <SchemeCard key={`${s.collection}::${s.name}`} name={s.name} entries={s.tokens} />
        ))}
      </div>
    );
  }

  // Fallback
  const groups = groupByPrefix(colorTokens);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {[...groups.entries()].map(([groupName, entries]) => (
        <SchemeCard
          key={groupName}
          name={groupName}
          entries={entries.map((t) => ({ figmaName: t.figmaName, cssVar: t.cssVar, value: t.valueLight }))}
        />
      ))}
    </div>
  );
}
