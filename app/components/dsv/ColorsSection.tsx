"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./shared";
import type { TokenEntry } from "@/app/lib/designSystem";

export function ColorsSection({
  tokens,
  hasDark,
}: {
  tokens: TokenEntry[];
  hasDark: boolean;
}) {
  const [darkMode, setDarkMode] = useState(false);

  if (!tokens.length) return <p className="text-xs text-muted-foreground px-3">No color tokens found.</p>;

  return (
    <div className="flex flex-col gap-4">
      {hasDark && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={darkMode ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => setDarkMode((d) => !d)}
          >
            {darkMode ? <Moon size={12} /> : <Sun size={12} />}
            {darkMode ? "Dark" : "Light"}
          </Button>
          <span className="text-xs text-muted-foreground">Toggle to preview dark mode values</span>
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        {tokens.map((t) => {
          const value  = darkMode && t.valueDark ? t.valueDark : t.valueLight;
          const isHex  = /^#[0-9a-fA-F]{3,8}$/.test(value);
          const isRgba = /^rgba?\(/.test(value);
          return (
            <div
              key={t.cssVar}
              className="flex items-center gap-3 py-1.5 px-3 rounded-md hover:bg-muted/50 group"
            >
              {(isHex || isRgba) ? (
                <div
                  className="shrink-0 w-5 h-5 rounded border border-border"
                  style={{ backgroundColor: value }}
                  title={value}
                />
              ) : (
                <div className="shrink-0 w-5 h-5 rounded border border-border bg-muted" />
              )}
              <code className="font-mono text-xs text-foreground shrink-0">{t.cssVar}</code>
              <span className="flex-1 text-xs text-muted-foreground truncate min-w-0">{t.figmaName}</span>
              <div className="shrink-0 flex justify-end" style={{ width: "calc(10rem + 5ch)" }}>
                <code className="font-mono text-xs text-muted-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{value}</code>
              </div>
              <CopyButton value={`var(${t.cssVar})`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
