"use client";

import { TokenRow } from "./shared";
import type { TokenEntry } from "@/app/lib/designSystem";

export function OtherSection({ tokens }: { tokens: TokenEntry[] }) {
  if (!tokens.length) return <p className="text-xs text-muted-foreground">No other tokens found.</p>;
  return (
    <div className="flex flex-col gap-0.5">
      {tokens.map((t) => <TokenRow key={t.cssVar} token={t} />)}
    </div>
  );
}
