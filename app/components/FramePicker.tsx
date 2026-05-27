"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plug,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Check,
  Search,
  X,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { useFigmaConfig } from "@/hooks/useFigmaConfig";
import { useFrameList } from "@/hooks/useFrameList";
import { getMcpContext, FigmaError, type FigmaFrame } from "@/app/lib/figmaMcp";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SelectedFrame {
  frame:      FigmaFrame;
  mcpContext: string;
}

interface Props {
  onFrameSelect:    (selection: SelectedFrame) => void;
  /** Called when a frame context fetch starts so the parent can show a loading state */
  onFrameLoading?:  (frame: FigmaFrame) => void;
  /** Called when the fetch finishes (success or error) */
  onFrameLoadDone?: () => void;
  selectedFrameId?: string | null;
  builtFrameIds?:   Set<string>;
  onOpenConfig:     () => void;
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

function FrameThumbnail({
  url,
  name,
  loading,
}: {
  url?:     string;
  name:     string;
  loading?: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  // Reset error state whenever a new URL arrives (e.g. background refresh
  // replaced an expired S3 URL with a fresh one). Without this, imgError
  // stays true and the fresh URL is never rendered.
  useEffect(() => {
    if (url) setImgError(false);
  }, [url]);

  if (loading || (!url && !imgError)) {
    return (
      <div className="relative shrink-0 w-10 h-10 rounded overflow-hidden bg-muted">
        {loading && <Skeleton className="absolute inset-0 rounded-none" />}
        {!loading && !url && (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-muted-foreground uppercase select-none">
            {name.charAt(0)}
          </span>
        )}
      </div>
    );
  }

  if (imgError || !url) {
    return (
      <div className="shrink-0 w-10 h-10 rounded overflow-hidden bg-muted flex items-center justify-center">
        <span className="text-[10px] font-medium text-muted-foreground uppercase select-none">
          {name.charAt(0)}
        </span>
      </div>
    );
  }

  return (
    <div className="shrink-0 w-10 h-10 rounded overflow-hidden bg-muted">
      <img
        src={url}
        alt={name}
        className="w-full h-full object-cover"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

// ── Frame row (Browse sheet only) ─────────────────────────────────────────────

function FrameRow({
  frame,
  isSelected,
  isBuilt,
  isFetchingContext,
  onClick,
}: {
  frame:             FigmaFrame;
  isSelected:        boolean;
  isBuilt:           boolean;
  isFetchingContext: boolean;
  onClick:           () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        isSelected && "bg-sidebar-accent text-sidebar-accent-foreground",
        isFetchingContext && "opacity-60 pointer-events-none"
      )}
      onClick={onClick}
      aria-pressed={isSelected}
    >
      <FrameThumbnail
        url={frame.thumbnailUrl}
        name={frame.name}
        loading={!frame.thumbnailUrl && !isFetchingContext}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-sidebar-foreground truncate leading-tight">
          {frame.name}
        </p>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5 leading-tight">
          {frame.type === "COMPONENT" ? "Component · " : ""}{frame.page}
        </p>
      </div>
      <div className="shrink-0 w-4 flex items-center justify-center">
        {isFetchingContext && (
          <RefreshCw size={12} className="animate-spin text-muted-foreground" />
        )}
        {!isFetchingContext && isBuilt && (
          <CheckCircle2 size={12} className="text-green-500" />
        )}
      </div>
    </button>
  );
}


// ── Search input (Browse sheet) ────────────────────────────────────────────────

function SearchInput({
  value,
  onChange,
  placeholder = "Search frames…",
  autoFocus,
  className,
}: {
  value:        string;
  onChange:     (v: string) => void;
  placeholder?: string;
  autoFocus?:   boolean;
  className?:   string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        size={12}
        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
      />
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
        onKeyUp={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        className="h-7 pl-7 pr-7 text-xs"
      />
      {value && (
        <button
          type="button"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FramePicker({
  onFrameSelect,
  onFrameLoading,
  onFrameLoadDone,
  selectedFrameId,
  builtFrameIds = new Set(),
  onOpenConfig,
}: Props) {
  const { config, isConnected, isLoading: configLoading } = useFigmaConfig();
  const { framesByPage, allFrames, status, error, refresh, isRefreshing = false, thumbnailsLoading = false } = useFrameList(
    config?.fileKey ?? null,
    config?.token ?? null
  );

  const [fetchingId,   setFetchingId]   = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [browseOpen,   setBrowseOpen]   = useState(false);
  const [browseQuery,  setBrowseQuery]  = useState("");

  const handleFrameClick = useCallback(
    async (frame: FigmaFrame) => {
      if (!config || fetchingId) return;
      setBrowseOpen(false);
      setFetchingId(frame.id);
      setContextError(null);
      onFrameLoading?.(frame);

      try {
        const mcpContext = await getMcpContext(config.fileKey, frame.id, config.token);
        onFrameSelect({ frame, mcpContext });
      } catch (err) {
        const msg =
          err instanceof FigmaError
            ? err.error.message
            : "Could not fetch frame context";
        setContextError(msg);
      } finally {
        setFetchingId(null);
        onFrameLoadDone?.();
      }
    },
    [config, fetchingId, onFrameSelect]
  );

  // ── Filtered list for Browse sheet ──────────────────────────────────────────
  const browseNeedle = browseQuery.trim().toLowerCase();
  const browseFilteredByPage = useMemo(() => {
    if (!browseNeedle) return framesByPage;
    return framesByPage
      .map(({ page, frames }) => ({
        page,
        frames: frames.filter(
          (f) =>
            f.name.toLowerCase().includes(browseNeedle) ||
            f.page.toLowerCase().includes(browseNeedle)
        ),
      }))
      .filter(({ frames }) => frames.length > 0);
  }, [framesByPage, browseNeedle]);

  // ── Not yet hydrated ──────────────────────────────────────────────────────────
  if (configLoading) return null;

  // ── Not connected — CTA (no auto-open; dialog only on explicit click) ─────────
  if (!isConnected) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="uppercase tracking-wider text-[10px]">
          Figma Frames
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="px-2 py-3 flex flex-col gap-2">
            <p className="text-muted-foreground leading-relaxed" style={{ fontSize: "12px" }}>
              Connect a Figma file to browse frames and build components directly.
            </p>
            <Button
              size="sm"
              className="w-full gap-1.5 justify-start"
              onClick={onOpenConfig}
            >
              <Plug size={13} />
              Connect Figma
            </Button>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  // ── Loading frames — show Browse immediately, no skeleton ────────────────────
  if (status === "loading") {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="uppercase tracking-wider text-[10px]">
          Figma Frames
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="px-2 pb-3">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              onClick={() => setBrowseOpen(true)}
            >
              <LayoutGrid size={12} />
              Browse
            </Button>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  // ── Error loading frames ──────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="uppercase tracking-wider text-[10px]">
          Figma Frames
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="px-2 py-3 flex flex-col gap-2">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed">{error}</p>
            </div>
            <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={refresh}>
              <RefreshCw size={13} />
              Retry
            </Button>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  // ── Frame picker ──────────────────────────────────────────────────────────────
  const selectedFrameName = allFrames.find((f) => f.id === selectedFrameId)?.name;

  return (
    <>
      <SidebarGroup>
        <div className="flex items-center justify-between pr-2">
          <SidebarGroupLabel className="uppercase tracking-wider text-[10px]">
            Figma Frames
          </SidebarGroupLabel>
          <button
            type="button"
            className="text-muted-foreground hover:text-sidebar-foreground transition-colors p-1 rounded disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={refresh}
            disabled={isRefreshing}
            title="Refresh frames"
            aria-label="Refresh frame list"
          >
            <RefreshCw size={11} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>

        <SidebarGroupContent>
          <div className="px-2 pb-3 flex flex-col gap-1.5">

            {/* ── Browse button ─────────────────────────────────────────────── */}
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-center"
              onClick={() => setBrowseOpen(true)}
            >
              <LayoutGrid size={12} />
              Browse
            </Button>

            {/* Context fetch error */}
            {contextError && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-destructive">
                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                <p className="text-xs">{contextError}</p>
              </div>
            )}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>

      {/* ── Browse sheet (left drawer) ───────────────────────────────────────── */}
      <Sheet open={browseOpen} onOpenChange={setBrowseOpen}>
        {/* pg-chrome scopes headings — portal is outside <main>'s scope */}
        <SheetContent side="left" className="pg-chrome w-80 p-0 flex flex-col gap-0">
          {/* Header */}
          <SheetHeader className="shrink-0 px-4 pt-5 pb-3 border-b border-border">
            <SheetTitle>Figma Frames</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {allFrames.length} frame{allFrames.length !== 1 ? "s" : ""} in file
            </p>
          </SheetHeader>

          {/* Search */}
          <div className="shrink-0 px-2 py-2 border-b border-border">
            <SearchInput
              value={browseQuery}
              onChange={setBrowseQuery}
              autoFocus
            />
          </div>

          {/* Frame list — styled to match the Select dropdown groups */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-1">
              {browseFilteredByPage.map(({ page, frames }, groupIndex) => (
                <div key={page}>
                  {groupIndex > 0 && (
                    <div className="-mx-1 my-1 h-px bg-border" />
                  )}
                  <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {page}
                  </div>
                  {frames.map((frame) => {
                    const isSelected = selectedFrameId === frame.id;
                    const isFetching = fetchingId === frame.id;
                    return (
                      <button
                        key={frame.id}
                        type="button"
                        disabled={isFetching}
                        onClick={() => handleFrameClick(frame)}
                        className={cn(
                          "relative w-full flex items-center gap-2 rounded-md py-1.5 pl-2 pr-8 text-left outline-none transition-colors",
                          "hover:bg-accent hover:text-accent-foreground",
                          isSelected && "bg-accent/60 text-accent-foreground",
                          isFetching && "opacity-50 pointer-events-none"
                        )}
                      >
                        <FrameThumbnail
                          url={frame.thumbnailUrl}
                          name={frame.name}
                          loading={!frame.thumbnailUrl && thumbnailsLoading}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate leading-tight" style={{ fontSize: "12px" }}>
                            {frame.name}
                          </p>
                          <p className="text-muted-foreground truncate leading-tight" style={{ fontSize: "10px" }}>
                            {frame.type === "COMPONENT" ? "Component · " : ""}{frame.page}
                          </p>
                        </div>
                        {/* Fetching spinner */}
                        {isFetching && (
                          <span className="absolute right-2 flex items-center">
                            <RefreshCw size={12} className="animate-spin text-muted-foreground" />
                          </span>
                        )}
                        {/* Selected checkmark */}
                        {!isFetching && isSelected && (
                          <span className="absolute right-2 flex items-center">
                            <Check size={13} className="text-foreground" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
              {browseNeedle && browseFilteredByPage.length === 0 && (
                <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                  No frames match &ldquo;{browseQuery}&rdquo;
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
