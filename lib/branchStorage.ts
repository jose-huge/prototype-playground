/**
 * Branch-namespaced localStorage helpers.
 *
 * The root layout injects `window.__BRANCH__` (the current git branch) at
 * server-render time. Every key stored here is prefixed with that branch so
 * switching between content branches gives a fresh, isolated state.
 *
 * e.g.  "content/project-a:playground_components"
 *       "main:playground_figma_config"
 */

declare global {
  interface Window { __BRANCH__: string; }
}

function currentBranch(): string {
  if (typeof window === "undefined") return "main";
  return window.__BRANCH__ ?? "main";
}

/** Returns the full namespaced key for a given base key. */
export function nsKey(key: string): string {
  return `${currentBranch()}:${key}`;
}

export function lsGet(key: string): string | null {
  try { return localStorage.getItem(nsKey(key)); } catch { return null; }
}

export function lsSet(key: string, value: string): void {
  try { localStorage.setItem(nsKey(key), value); } catch {}
}

export function lsRemove(key: string): void {
  try { localStorage.removeItem(nsKey(key)); } catch {}
}
