"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface FigmaConfig {
  token:    string;
  fileKey:  string;
  fileName: string;
}

export interface UseFigmaConfigReturn {
  config:      FigmaConfig | null;
  isLoading:   boolean;
  isConnected: boolean;
  saveConfig:  (config: FigmaConfig) => Promise<void>;
  clearConfig: () => Promise<void>;
}

// ── localStorage helpers ───────────────────────────────────────────────────────
import { lsGet, lsSet, lsRemove } from "@/lib/branchStorage";

const LS_KEY = "playground_figma_config";

export function readLocalStorage(): FigmaConfig | null {
  try {
    const raw = lsGet(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FigmaConfig;
    return parsed.token && parsed.fileKey ? parsed : null;
  } catch { return null; }
}

export function writeLocalStorage(config: FigmaConfig) {
  try { lsSet(LS_KEY, JSON.stringify(config)); } catch { /* ok */ }
}

export function clearLocalStorage() {
  try { lsRemove(LS_KEY); } catch { /* ok */ }
}

// ── Shared context (populated by FigmaConfigProvider) ─────────────────────────
export const FigmaConfigContext = createContext<UseFigmaConfigReturn | null>(null);

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useFigmaConfig(): UseFigmaConfigReturn {
  const ctx = useContext(FigmaConfigContext);
  if (!ctx) throw new Error("useFigmaConfig must be used inside <FigmaConfigProvider>");
  return ctx;
}

// ── Internal hook used only by the Provider ───────────────────────────────────
export function useFigmaConfigState(): UseFigmaConfigReturn {
  const [config,    setConfig]    = useState<FigmaConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const local = readLocalStorage();
    if (local) setConfig(local);

    fetch("/api/figma-config")
      .then((r) => r.json())
      .then((data: Partial<FigmaConfig>) => {
        if (data.token && data.fileKey) {
          const persisted: FigmaConfig = {
            token:    data.token,
            fileKey:  data.fileKey,
            fileName: data.fileName ?? "",
          };
          setConfig(persisted);
          writeLocalStorage(persisted);
        } else if (!local) {
          setConfig(null);
        }
      })
      .catch(() => { /* keep localStorage value */ })
      .finally(() => setIsLoading(false));
  }, []);

  const saveConfig = useCallback(async (next: FigmaConfig) => {
    setConfig(next);
    setIsLoading(false);
    writeLocalStorage(next);
    await fetch("/api/figma-config", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(next),
    });
  }, []);

  const clearConfig = useCallback(async () => {
    setConfig(null);
    setIsLoading(false);
    clearLocalStorage();
    await fetch("/api/figma-config", { method: "DELETE" });
  }, []);

  return {
    config,
    isLoading,
    isConnected: !isLoading && config !== null,
    saveConfig,
    clearConfig,
  };
}
