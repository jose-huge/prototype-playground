"use client";

/**
 * ResetHandler
 *
 * Mounts invisibly in the root layout. When the URL contains ?reset=true:
 *   1. Calls POST /api/reset to wipe all server-side generated content
 *   2. Clears every localStorage key that belongs to the current branch
 *   3. Redirects to / so the URL is clean and the app starts fresh
 */

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function ResetHandler() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("reset") !== "true") return;

    (async () => {
      // 1. Wipe server-side content
      try { await fetch("/api/reset", { method: "POST" }); } catch { /* non-fatal */ }

      // 2. Clear branch-namespaced localStorage keys
      try {
        const branch = (window as Window & { __BRANCH__?: string }).__BRANCH__ ?? "main";
        const prefix = `${branch}:`;
        const toRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(prefix)) toRemove.push(key);
        }
        toRemove.forEach((k) => localStorage.removeItem(k));
      } catch { /* non-fatal */ }

      // 3. Navigate to clean URL
      router.replace("/");
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
