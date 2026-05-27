"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getFrames, getThumbnails, type FigmaFrame, FigmaError } from "@/app/lib/figmaMcp";

// ── Types ──────────────────────────────────────────────────────────────────────

export type FrameLoadStatus = "idle" | "loading" | "done" | "error";

export interface FramesByPage {
  page:   string;
  frames: FigmaFrame[];
}

export interface UseFrameListReturn {
  /** Frames grouped by page, in document order */
  framesByPage:      FramesByPage[];
  /** Flat list (convenience) */
  allFrames:         FigmaFrame[];
  /** nodeId → thumbnail URL (populated lazily after frames load) */
  thumbnails:        Record<string, string>;
  status:            FrameLoadStatus;
  /** Human-readable error for display */
  error:             string | null;
  /** Re-fetch from the API, bypassing cache */
  refresh:           () => void;
  /** True while a manual refresh is in progress (frames still visible) */
  isRefreshing:      boolean;
  /** True while background thumbnail URLs are still being fetched */
  thumbnailsLoading: boolean;
}

// ── Cache ──────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS  = 5  * 60 * 1000;  // 5 min  — in-memory (survives re-mounts)
const LS_TTL_MS     = 10 * 60 * 1000;  // 10 min — localStorage (survives refresh)
// Kept short so a reload always triggers a background thumbnail refresh,
// making stale/expired S3 URLs much less likely to be served.

interface CacheEntry {
  fileKey:    string;
  frames:     FigmaFrame[];
  thumbnails: Record<string, string>;
  fetchedAt:  number;
}

// Module-level: lives for the browser session
let cache: CacheEntry | null = null;

function isCacheValid(fileKey: string): boolean {
  return (
    cache !== null &&
    cache.fileKey === fileKey &&
    Date.now() - cache.fetchedAt < CACHE_TTL_MS
  );
}

// ── localStorage helpers ───────────────────────────────────────────────────────

interface LsEntry {
  thumbnails: Record<string, string>;
  fetchedAt:  number;
}

function lsKey(fileKey: string) {
  return `figma_thumbs_${fileKey}`;
}

function readLsThumbnails(fileKey: string): Record<string, string> | null {
  try {
    const raw = localStorage.getItem(lsKey(fileKey));
    if (!raw) return null;
    const entry = JSON.parse(raw) as LsEntry;
    if (Date.now() - entry.fetchedAt > LS_TTL_MS) {
      localStorage.removeItem(lsKey(fileKey));
      return null;
    }
    return entry.thumbnails;
  } catch {
    return null;
  }
}

function writeLsThumbnails(fileKey: string, thumbnails: Record<string, string>) {
  try {
    const entry: LsEntry = { thumbnails, fetchedAt: Date.now() };
    localStorage.setItem(lsKey(fileKey), JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — non-fatal
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useFrameList(
  fileKey: string | null,
  token:   string | null
): UseFrameListReturn {
  const [frames,            setFrames]            = useState<FigmaFrame[]>([]);
  const [thumbnails,        setThumbnails]        = useState<Record<string, string>>({});
  const [status,            setStatus]            = useState<FrameLoadStatus>("idle");
  const [error,             setError]             = useState<string | null>(null);
  const [isRefreshing,      setIsRefreshing]      = useState(false);
  const [thumbnailsLoading, setThumbnailsLoading] = useState(false);

  // Prevent stale async callbacks from updating state after unmount or re-fetch
  const fetchIdRef = useRef(0);

  const fetchFrames = useCallback(
    async (bustCache = false) => {
      if (!fileKey || !token) return;

      // Invalidate caches if explicitly busted
      if (bustCache) {
        cache = null;
        localStorage.removeItem(lsKey(fileKey));
        setIsRefreshing(true);
      }

      // Serve from in-memory cache when fresh
      if (isCacheValid(fileKey)) {
        setFrames(cache!.frames);
        setThumbnails(cache!.thumbnails);
        setStatus("done");
        setIsRefreshing(false);
        return;
      }

      const fetchId = ++fetchIdRef.current;
      if (!bustCache) setStatus("loading");
      setError(null);

      // ── Hydrate thumbnails from localStorage immediately ──────────────────
      // Frames aren't cached yet, but we can pre-populate thumbnail URLs so
      // images appear instantly once the frame list arrives.
      const cachedThumbs = readLsThumbnails(fileKey);
      if (cachedThumbs) {
        setThumbnails(cachedThumbs);
      }

      try {
        const fetched = await getFrames(fileKey, token);
        if (fetchId !== fetchIdRef.current) return; // stale

        // Merge any cached thumbnails into frame objects right away so the
        // sidebar shows images before the fresh thumbnail fetch completes.
        const mergedWithCached = fetched.map((f) => ({
          ...f,
          thumbnailUrl: cachedThumbs?.[f.id] ?? f.thumbnailUrl,
        }));

        setFrames(mergedWithCached);
        setStatus("done");

        // Warm in-memory cache (thumbnails filled in below)
        cache = { fileKey, frames: mergedWithCached, thumbnails: cachedThumbs ?? {}, fetchedAt: Date.now() };

        // ── Background thumbnail refresh ────────────────────────────────────
        // Only show loading state when frames have no cached thumbnails yet.
        const needsThumbs = mergedWithCached.some((f) => !f.thumbnailUrl);
        if (needsThumbs) setThumbnailsLoading(true);

        const nodeIds = fetched.map((f) => f.id);
        getThumbnails(fileKey, nodeIds, token).then((thumbs) => {
          if (fetchId !== fetchIdRef.current) return;

          setThumbnails(thumbs);
          writeLsThumbnails(fileKey, thumbs);

          cache = { fileKey, frames: fetched, thumbnails: thumbs, fetchedAt: Date.now() };

          setFrames((prev) =>
            prev.map((f) => ({
              ...f,
              thumbnailUrl: thumbs[f.id] ?? f.thumbnailUrl,
            }))
          );
          setIsRefreshing(false);
          setThumbnailsLoading(false);
        }).catch(() => {
          if (fetchId !== fetchIdRef.current) return;
          setThumbnailsLoading(false);
        });
      } catch (err) {
        if (fetchId !== fetchIdRef.current) return;
        const msg =
          err instanceof FigmaError
            ? err.error.message
            : "Could not load frames — check your connection";
        setError(msg);
        setStatus("error");
        setIsRefreshing(false);
      }
    },
    [fileKey, token]
  );

  // Fetch on mount and whenever fileKey / token changes
  useEffect(() => {
    fetchFrames(false);
  }, [fetchFrames]);

  // Group by page, preserving document order
  const framesByPage: FramesByPage[] = [];
  const seen = new Map<string, FigmaFrame[]>();

  for (const frame of frames) {
    if (!seen.has(frame.page)) {
      seen.set(frame.page, []);
      framesByPage.push({ page: frame.page, frames: seen.get(frame.page)! });
    }
    seen.get(frame.page)!.push(frame);
  }

  return {
    framesByPage,
    allFrames: frames,
    thumbnails,
    status,
    error,
    isRefreshing,
    thumbnailsLoading,
    refresh: () => fetchFrames(true),
  };
}
