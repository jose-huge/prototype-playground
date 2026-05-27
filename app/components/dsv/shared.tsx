"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { TokenEntry } from "@/app/lib/designSystem";

/**
 * Returns the last path segment of a Figma token name, lowercased and
 * hyphenated — e.g. "Typography/Display/Display LG" → "display-lg".
 * Use this as the default specimen / label text in any section.
 */
export function figmaLabel(token: TokenEntry): string {
  const last = token.figmaName.split("/").pop() ?? token.figmaName;
  return last.trim().toLowerCase().replace(/\s+/g, "-");
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="ml-auto shrink-0 p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
      title={`Copy ${value}`}
      aria-label={`Copy ${value}`}
    >
      {copied ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
    </button>
  );
}

export function TokenRow({ token, darkMode }: { token: TokenEntry; darkMode?: boolean }) {
  const value = darkMode && token.valueDark ? token.valueDark : token.valueLight;
  return (
    <div className="flex items-center gap-3 py-1.5 px-3 rounded-md hover:bg-muted/50 group">
      <code className="font-mono text-xs text-foreground shrink-0">{token.cssVar}</code>
      <span className="flex-1 text-xs text-muted-foreground truncate min-w-0">{token.figmaName}</span>
      <code className="font-mono text-xs text-muted-foreground shrink-0">{value}</code>
      <CopyButton value={`var(${token.cssVar})`} />
    </div>
  );
}
