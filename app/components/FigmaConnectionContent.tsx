"use client";

import { useState, useEffect, useRef } from "react";
import {
  Eye, EyeOff, Loader2, Plug, CheckCircle2, AlertCircle,
  Circle, Download, RotateCcw,
} from "lucide-react";
import { Button }      from "@/components/ui/button";
import { Input }       from "@/components/ui/input";
import { Separator }   from "@/components/ui/separator";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { validateConnection, extractFileKey, FigmaError } from "@/app/lib/figmaMcp";
import { useFigmaConfig } from "@/hooks/useFigmaConfig";
import { type ProgressEvent, type StepStatus } from "@/app/api/design-system/route";

// ── Types ──────────────────────────────────────────────────────────────────────

type ConnectStatus = "idle" | "connecting" | "success" | "error";

export interface FigmaConnectionContentProps {
  onConnected?:       () => void;
  onImportingChange?: (importing: boolean) => void;
  builtCount?:        number;
  /** Called when the form wants to navigate somewhere after an action. */
  onNavigate?:        (destination: string) => void;
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

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")    return <CheckCircle2 size={14} className="text-green-500 shrink-0" />;
  if (status === "running") return <Loader2     size={14} className="animate-spin text-primary shrink-0" />;
  if (status === "error")   return <AlertCircle size={14} className="text-destructive shrink-0" />;
  return <Circle size={14} className="text-muted-foreground/40 shrink-0" />;
}

// ── Component ──────────────────────────────────────────────────────────────────
// Single-view form: connection fields always visible, import checklist expands
// inline below the Import button as steps arrive — no content replacement.

export function FigmaConnectionContent({
  onConnected,
  onImportingChange,
  builtCount = 0,
  onNavigate,
}: FigmaConnectionContentProps) {
  const { config, isConnected, saveConfig, clearConfig } = useFigmaConfig();

  // ── Connection state ───────────────────────────────────────────────────────
  const [fileUrl,       setFileUrl]       = useState(() => config?.fileKey ? `https://www.figma.com/design/${config.fileKey}/` : "");
  const [token,         setToken]         = useState(() => config?.token ?? "");
  const [showToken,     setShowToken]     = useState(false);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>("idle");
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);

  // ── Import state ───────────────────────────────────────────────────────────
  const [steps,      setSteps]      = useState<ProgressEvent[]>([]);
  const [importing,  setImporting]  = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/design-system")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?._importedAt) setLastImport(data._importedAt as string); })
      .catch(() => {});
  }, []);

  // ── Connect / Disconnect ───────────────────────────────────────────────────
  const handleConnect = async () => {
    setConnectStatus("connecting");
    setErrorMsg(null);
    setConnectedName(null);

    const fileKey = extractFileKey(fileUrl.trim());
    if (!fileKey) {
      setErrorMsg("Enter a valid Figma file URL or file key");
      setConnectStatus("error");
      return;
    }
    if (!token.trim()) {
      setErrorMsg("Enter a Figma personal access token");
      setConnectStatus("error");
      return;
    }
    try {
      const info = await validateConnection(fileKey, token.trim());
      await saveConfig({ token: token.trim(), fileKey, fileName: info.name });
      setConnectedName(info.name);
      setConnectStatus("success");
      onConnected?.();
    } catch (err) {
      const msg = err instanceof FigmaError
        ? err.error.message
        : "Could not reach Figma — check your connection";
      setErrorMsg(msg);
      setConnectStatus("error");
    }
  };

  const handleDisconnect = () => {
    clearConfig();
    setFileUrl("");
    setToken("");
    setConnectStatus("idle");
    setErrorMsg(null);
    setConnectedName(null);
  };

  // ── Import ─────────────────────────────────────────────────────────────────
  const startImport = async () => {
    setSteps([]);
    setImporting(true);
    onImportingChange?.(true);
    setImportDone(false);
    setFatalError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/design-system", { method: "POST", signal: controller.signal });
      if (!res.body) throw new Error("No response stream");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as ProgressEvent;
            setSteps((prev) => {
              const idx = prev.findIndex((s) => s.step === event.step);
              if (idx === -1) return [...prev, event];
              const next = [...prev]; next[idx] = event; return next;
            });
          } catch { /* skip malformed line */ }
        }
      }

      setSteps((prev) => {
        if (!prev.some((s) => s.status === "error")) {
          setImportDone(true);
          setLastImport(new Date().toISOString());
        }
        return prev;
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setFatalError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      onImportingChange?.(false);
      abortRef.current = null;
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isConnecting        = connectStatus === "connecting";
  const canConnect          = !!fileUrl.trim() && !!token.trim() && !isConnecting;
  const displayName         = connectedName ?? config?.fileName;
  const hasImportError      = steps.some((s) => s.status === "error") || !!fatalError;
  const savedFileUrl        = config?.fileKey ? `https://www.figma.com/design/${config.fileKey}/` : "";
  const fieldsMatchSaved    = fileUrl.trim() === savedFileUrl && token.trim() === (config?.token ?? "");
  const isActivelyConnected = connectStatus === "success" || (isConnected && fieldsMatchSaved && connectStatus !== "error");
  const canImport           = (isConnected || connectStatus === "success") && !importing;

  // ── Single view — connection fields always visible ─────────────────────────
  return (
    <div className="flex flex-col gap-5">

      {/* File URL */}
      <Field>
        <FieldLabel htmlFor="figma-file-url-l2">File URL</FieldLabel>
        <Input
          id="figma-file-url-l2"
          type="url"
          placeholder="https://www.figma.com/design/…"
          value={fileUrl}
          onChange={(e) => { setFileUrl(e.target.value); setConnectStatus("idle"); setErrorMsg(null); setConnectedName(null); }}
          disabled={isConnecting}
        />
      </Field>

      {/* Token + connect */}
      <Field>
        <FieldLabel htmlFor="figma-token-l2">Personal access token</FieldLabel>
        <div className="relative">
          <Input
            id="figma-token-l2"
            type={showToken ? "text" : "password"}
            placeholder="figd_…"
            value={token}
            onChange={(e) => { setToken(e.target.value); setConnectStatus("idle"); setErrorMsg(null); setConnectedName(null); }}
            disabled={isConnecting}
            className="pr-9"
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowToken((v) => !v)}
            aria-label={showToken ? "Hide token" : "Show token"}
            tabIndex={-1}
          >
            {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <FieldDescription>
          Generate at{" "}
          <a href="https://www.figma.com/settings" target="_blank" rel="noopener noreferrer">
            figma.com/settings
          </a>
          {" "}→ Personal access tokens
        </FieldDescription>

        <div className="flex items-center gap-3 pt-1">
          {isActivelyConnected ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 pl-2.5 pr-2.5 py-1 rounded-full border border-border bg-muted text-sm">
                <CheckCircle2 size={13} className="shrink-0 text-green-500" />
                <span className="font-medium text-foreground">Connected</span>
                {displayName && <span className="text-muted-foreground">{displayName}</span>}
              </div>
              <button
                type="button"
                onClick={handleDisconnect}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <Button size="sm" onClick={handleConnect} disabled={!canConnect} className="gap-1.5">
              {isConnecting
                ? <><Loader2 size={13} className="animate-spin" />Connecting…</>
                : <><Plug size={13} />Connect</>
              }
            </Button>
          )}
          {connectStatus === "error" && errorMsg && (
            <span className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle size={13} />
              {errorMsg}
            </span>
          )}
        </div>
      </Field>

      <Separator />

      {/* Design system — import button + inline checklist growth */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium leading-none">Design system</p>

        {/* Import button row */}
        <div className="flex items-center justify-between gap-3">
          <Button
            size="sm"
            onClick={startImport}
            disabled={!canImport}
            className="gap-1.5"
          >
            {importing
              ? <><Loader2 size={13} className="animate-spin" />Importing…</>
              : <><Download size={13} />Import from Figma</>
            }
          </Button>
          <span className="text-xs text-muted-foreground shrink-0">
            {lastImport ? `Last imported: ${formatLastImport(lastImport)}` : "Last imported: never"}
          </span>
        </div>

        {/* Checklist — grows in place as steps stream in */}
        {steps.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {steps.map((s) => (
              <div key={s.step} className="flex items-start gap-2.5">
                <div className="mt-0.5"><StepIcon status={s.status} /></div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm leading-tight ${
                    s.status === "error"   ? "text-destructive" :
                    s.status === "running" ? "text-foreground"  :
                    s.status === "done"    ? "text-foreground"  :
                    "text-muted-foreground"
                  }`}>
                    {s.label}
                    {s.detail && <span className="text-muted-foreground font-normal"> ({s.detail})</span>}
                  </span>
                  {s.error && <span className="text-xs text-destructive mt-0.5">{s.error}</span>}
                </div>
              </div>
            ))}
            {fatalError && (
              <div className="flex items-start gap-2.5">
                <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                <span className="text-sm text-destructive">{fatalError}</span>
              </div>
            )}
          </div>
        )}

        {/* Post-import actions — appear below the checklist once done */}
        {!importing && hasImportError && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={startImport}>
              <RotateCcw size={13} />
              Retry
            </Button>
          </div>
        )}

        {/* Context copy — only when no checklist is showing */}
        {steps.length === 0 && !isConnected && connectStatus !== "success" && (
          <p className="text-xs text-muted-foreground">
            Connect a Figma file above to enable import.
          </p>
        )}
        {steps.length === 0 && canImport && !lastImport && (
          <p className="text-xs text-muted-foreground">
            Once imported, tokens.css, design.md, and the reference page will be generated automatically.
          </p>
        )}
        {steps.length === 0 && canImport && lastImport && builtCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Re-importing will update tokens.css. Already-built components will not be changed.
          </p>
        )}
      </div>

    </div>
  );
}
