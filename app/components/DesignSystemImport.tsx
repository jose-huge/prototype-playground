"use client";

import { Download } from "lucide-react";
import { Button }   from "@/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  isConnected:    boolean;
  builtCount?:    number;
  lastImport:     string | null;
  onStartImport:  () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatLastImport(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DesignSystemImport({
  isConnected,
  builtCount = 0,
  lastImport,
  onStartImport,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Button
          size="sm"
          variant="default"
          onClick={onStartImport}
          disabled={!isConnected}
          className="gap-1.5"
        >
          <Download size={13} />
          Import from Figma
        </Button>
        <span className="text-xs text-muted-foreground">
          {lastImport
            ? `Last imported: ${formatLastImport(lastImport)}`
            : "Last imported: never"}
        </span>
      </div>

      {!isConnected && (
        <p className="text-xs text-muted-foreground">
          Connect a Figma file above to enable import.
        </p>
      )}

      {isConnected && builtCount > 0 && lastImport && (
        <p className="text-xs text-muted-foreground">
          Re-importing will update tokens.css. Already-built components will not be changed — they use the stack they were built with.
        </p>
      )}

      {isConnected && !lastImport && (
        <p className="text-xs text-muted-foreground">
          Once imported, tokens.css, design.md, and the reference page will be generated automatically.
        </p>
      )}
    </div>
  );
}
