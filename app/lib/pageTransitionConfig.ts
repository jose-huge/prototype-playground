/**
 * Page Transition — single source of truth for all timing and style values.
 * Edit here to tune the animation globally.
 *
 * Animation: 8 vertical panels scale in/out with staggered delays.
 * Matches the curtain transition in the Claude Design prototype.
 */
export const transitionConfig = {
  /** Number of panels — 1 = single full-width block */
  panelCount: 1,

  /** ms — scaleY transition duration */
  panelDuration: 500,

  /** ms — stagger between panels (irrelevant at panelCount: 1) */
  panelStagger: 0,

  /** CSS easing for panel scaleY — cubic-bezier(0.22, 0.61, 0.36, 1) = ease-soft */
  ease: "cubic-bezier(0.22, 0.61, 0.36, 1)",

  /**
   * ms — how long to wait in "covering" state before calling router.push().
   * Should be > panelDuration + (panelCount - 1) * panelStagger so the
   * curtain is fully down before the page swaps.
   */
  coverMs: 1100,

  /**
   * ms — how long to wait in "revealing" state before going idle.
   * Should be ≥ panelDuration + (panelCount - 1) * panelStagger.
   */
  revealMs: 1100,

  /** ms — max wait for a slow page before forcing wipe-out */
  maxHoldMs: 3000,

  /**
   * ms — how long to wait after triggering a nav close before starting the curtain.
   * Matches NAV_CLOSE_MS from Nav.tsx (620ms covers the worst-case mobile close).
   * PageTransition only applies this delay when the nav is actually open.
   */
  navCloseDelayMs: 150,

  /** Brand label fade duration (ms) */
  labelFadeMs: 320,

  /** Brand label fade-in delay — starts after first panels have dropped (ms) */
  labelDelayMs: 240,

  /**
   * Random colour palette — one is picked per navigation.
   * Matches the brand palette used in the Claude Design prototype.
   */
  palette: ["#D5AD65", "#FF8686", "#A3D0F1", "#A8C2A5", "#333333"] as const,

  /**
   * Which palette swatches are considered "dark" and need white label text.
   * All others use #111111.
   */
  darkSwatches: ["#333333"] as const,

  /**
   * Behaviour when prefers-reduced-motion is set:
   *   "skip"  — navigate instantly, no animation
   *   "fade"  — use a simple opacity fade instead (not yet implemented)
   */
  reducedMotion: "skip" as "skip" | "fade",
} as const;
