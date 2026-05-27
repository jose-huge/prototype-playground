"use client";

import { useState, useEffect, useRef } from "react";
import {
  Eye, EyeOff, Loader2, Plug, CheckCircle2, AlertCircle,
  Circle, Download, RotateCcw, ExternalLink, X,
} from "lucide-react";
import { Button }      from "@/components/ui/button";
import { Input }       from "@/components/ui/input";
import { Separator }   from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { validateConnection, extractFileKey, FigmaError } from "@/app/lib/figmaMcp";
import { useFigmaConfig } from "@/hooks/useFigmaConfig";
import { type ProgressEvent, type StepStatus } from "@/app/api/design-system/route";
import DesignSystemImport from "./DesignSystemImport";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  onConnected?:  () => void;
  builtCount?:   number;
}

type ConnectStatus = "idle" | "connecting" | "success" | "error";
type PanelView     = "setup" | "importing";

// ── Step icon ──────────────────────────────────────────────────────────────────

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done")    return <CheckCircle2 size={14} className="text-green-500 shrink-0" />;
  if (status === "running") return <Loader2     size={14} className="animate-spin text-primary shrink-0" />;
  if (status === "error")   return <AlertCircle size={14} className="text-destructive shrink-0" />;
  return <Circle size={14} className="text-muted-foreground/40 shrink-0" />;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function FigmaConfigPanel({
  open,
  onOpenChange,
  onConnected,
  builtCount = 0,
}: Props) {
  const { config, isConnected, saveConfig, clearConfig } = useFigmaConfig();

  // ── Connection state ───────────────────────────────────────────────────────
  const [fileUrl,       setFileUrl]       = useState(() => config?.fileKey ? `https://www.figma.com/design/${config.fileKey}/` : "");
  const [token,         setToken]         = useState(() => config?.token ?? "");
  const [showToken,     setShowToken]     = useState(false);
  const [connectStatus, setConnectStatus] = useState<ConnectStatus>("idle");
  const [errorMsg,      setErrorMsg]      = useState<string | null>(null);
  const [connectedName, setConnectedName] = useState<string | null>(null);

  // ── Import state ───────────────────────────────────────────────────────────
  const [view,            setView]            = useState<PanelView>("setup");
  const [steps,           setSteps]           = useState<ProgressEvent[]>([]);
  const [importing,       setImporting]       = useState(false);
  const [importDone,      setImportDone]      = useState(false);
  const [fatalError,      setFatalError]      = useState<string | null>(null);
  const [lastImport,      setLastImport]      = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load last import timestamp on mount
  useEffect(() => {
    fetch("/api/design-system")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?._importedAt) setLastImport(data._importedAt as string); })
      .catch(() => {});
  }, []);

  // ── Reset when dialog opens; abort stream when it closes ──────────────────
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setFileUrl(config?.fileKey ? `https://www.figma.com/design/${config.fileKey}/` : "");
      setToken(config?.token ?? "");
      setConnectStatus("idle");
      setErrorMsg(null);
      setConnectedName(null);
      setView("setup");
      setSteps([]);
      setImporting(false);
      setImportDone(false);
      setFatalError(null);
    } else {
      abortRef.current?.abort();
    }
    onOpenChange(next);
  };

  // ── Connect ────────────────────────────────────────────────────────────────
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

  // ── Disconnect ─────────────────────────────────────────────────────────────
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
    setView("importing");
    setSteps([]);
    setImporting(true);
    setImportDone(false);
    setFatalError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/design-system", {
        method: "POST",
        signal: controller.signal,
      });
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
              const next = [...prev];
              next[idx] = event;
              return next;
            });
          } catch { /* skip malformed line */ }
        }
      }

      setSteps((prev) => {
        const hasError = prev.some((s) => s.status === "error");
        if (!hasError) {
          setImportDone(true);
          const ts = new Date().toISOString();
          setLastImport(ts);
        }
        return prev;
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setFatalError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      abortRef.current = null;
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const isConnecting  = connectStatus === "connecting";
  const canConnect    = !!fileUrl.trim() && !!token.trim() && !isConnecting;
  const displayName   = connectedName ?? config?.fileName;
  const hasImportError = steps.some((s) => s.status === "error") || !!fatalError;

  // True when the current field values exactly match the saved config —
  // changing either field breaks this and unlocks the Connect button.
  const savedFileUrl       = config?.fileKey ? `https://www.figma.com/design/${config.fileKey}/` : "";
  const fieldsMatchSaved   = fileUrl.trim() === savedFileUrl && token.trim() === (config?.token ?? "");
  const isActivelyConnected = connectStatus === "success" || (isConnected && fieldsMatchSaved && connectStatus !== "error");

  // ── Header copy ────────────────────────────────────────────────────────────
  const title = view === "setup"
    ? "Figma connection"
    : importing    ? "Importing design system"
    : importDone   ? "Import complete"
    : hasImportError ? "Import failed"
    : "Importing design system";

  const description = view === "setup"
    ? "Connect your Figma file to browse frames and import design tokens."
    : importing ? "This takes about 10–20 seconds."
    : importDone ? "Design tokens, CSS variables, and the reference page have been generated."
    : undefined;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="pg-chrome max-w-md flex flex-col max-h-[90vh]">

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {view === "setup" && <Plug size={16} className="text-muted-foreground" />}
            {view === "importing" && importing  && <Loader2     size={15} className="animate-spin text-primary" />}
            {view === "importing" && importDone && <CheckCircle2 size={15} className="text-green-500" />}
            {view === "importing" && hasImportError && <AlertCircle size={15} className="text-destructive" />}
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        {/* ── Setup view ──────────────────────────────────────────────────── */}
        {view === "setup" && (
          <DialogBody className="flex-1 overflow-y-auto min-h-0 gap-5">

            <Field>
              <FieldLabel htmlFor="figma-file-url">File URL</FieldLabel>
              <Input
                id="figma-file-url"
                type="url"
                placeholder="https://www.figma.com/design/…"
                value={fileUrl}
                onChange={(e) => { setFileUrl(e.target.value); setConnectStatus("idle"); setErrorMsg(null); setConnectedName(null); }}
                disabled={isConnecting}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="figma-token">Personal access token</FieldLabel>
              <div className="relative">
                <Input
                  id="figma-token"
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
                  <div className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-border bg-muted text-sm">
                    <CheckCircle2 size={13} className="shrink-0 text-green-500" />
                    <span className="font-medium text-foreground">Connected</span>
                    {displayName && (
                      <span className="text-muted-foreground">{displayName}</span>
                    )}
                    <button
                      type="button"
                      onClick={handleDisconnect}
                      aria-label="Disconnect"
                      className="ml-0.5 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleConnect}
                    disabled={!canConnect}
                    className="gap-1.5"
                  >
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

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium leading-none">Design system</p>
              <DesignSystemImport
                isConnected={isConnected || connectStatus === "success"}
                builtCount={builtCount}
                lastImport={lastImport}
                onStartImport={startImport}
              />
            </div>

          </DialogBody>
        )}

        {/* ── Import progress view ─────────────────────────────────────────── */}
        {view === "importing" && (
          <DialogBody className="flex-1 overflow-y-auto min-h-0 gap-1.5">
            {steps.map((s) => (
              <div key={s.step} className="flex items-start gap-2.5">
                <div className="mt-0.5">
                  <StepIcon status={s.status} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-sm leading-tight ${
                    s.status === "error"   ? "text-destructive" :
                    s.status === "running" ? "text-foreground"  :
                    s.status === "done"    ? "text-foreground"  :
                    "text-muted-foreground"
                  }`}>
                    {s.label}
                    {s.detail && (
                      <span className="text-muted-foreground font-normal"> ({s.detail})</span>
                    )}
                  </span>
                  {s.error && (
                    <span className="text-xs text-destructive mt-0.5">{s.error}</span>
                  )}
                </div>
              </div>
            ))}

            {fatalError && (
              <div className="flex items-start gap-2.5 mt-1">
                <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                <span className="text-sm text-destructive">{fatalError}</span>
              </div>
            )}
          </DialogBody>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <DialogFooter>
          {view === "setup" && (
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}

          {view === "importing" && !importing && importDone && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  window.dispatchEvent(
                    new CustomEvent("playground:navigate", { detail: "Design Variables" })
                  );
                }}
              >
                <ExternalLink size={13} />
                View reference page
              </Button>
            </>
          )}

          {view === "importing" && !importing && hasImportError && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setView("setup")}
              >
                Back
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={startImport}
              >
                <RotateCcw size={13} />
                Retry
              </Button>
            </>
          )}
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
