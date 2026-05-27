"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./shared";
import type { TokenEntry } from "@/app/lib/designSystem";

function AnimDot({ duration, easing }: { duration: string; easing: string }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    setActive(false);
    const t = setTimeout(() => setActive(true), 50);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="flex-1 h-4 relative overflow-hidden rounded">
      <div
        className="absolute top-0 left-0 w-3 h-3 rounded-full bg-primary mt-0.5"
        style={{
          transform:  active ? "translateX(calc(100% * 8))" : "translateX(0)",
          transition: active ? `transform ${duration} ${easing}` : "none",
        }}
      />
    </div>
  );
}

export function AnimationSection({ tokens }: { tokens: TokenEntry[] }) {
  if (!tokens.length) return <p className="text-xs text-muted-foreground">No animation tokens found.</p>;

  const [tick, setTick] = useState(0);
  const triggerAll = useCallback(() => setTick((n) => n + 1), []);

  return (
    <div className="flex flex-col gap-1">
      <div className="mb-3">
        <Button size="sm" variant="outline" onClick={triggerAll}>Play all</Button>
      </div>
      {tokens.map((t) => {
        const isDuration = t.cssVar.includes("duration") || t.cssVar.includes("delay");
        const isEase     = t.cssVar.includes("ease") || t.cssVar.includes("timing") || t.cssVar.includes("bezier");
        return (
          <div key={t.cssVar} className="flex items-center gap-3 py-1.5 px-3 rounded-md hover:bg-muted/50 group">
            <code className="font-mono text-xs text-foreground w-56 shrink-0">{t.cssVar}</code>
            <code className="font-mono text-xs text-muted-foreground w-32 shrink-0">{t.valueLight}</code>
            {isDuration && (
              <AnimDot key={`${t.cssVar}-${tick}`} duration={t.valueLight} easing="linear" />
            )}
            {isEase && !isDuration && (
              <AnimDot key={`${t.cssVar}-${tick}`} duration="400ms" easing={t.valueLight} />
            )}
            <CopyButton value={`var(${t.cssVar})`} />
          </div>
        );
      })}
    </div>
  );
}
