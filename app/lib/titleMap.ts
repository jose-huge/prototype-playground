/**
 * Pathname → page title map.
 *
 * Used by PageTransition to show the destination page's name in the overlay
 * before the new page has loaded — no extra fetch needed.
 *
 * Built from the same nav/footer data the site already has. When Contentstack
 * is integrated, replace this static map with one populated from CMS nav data
 * (e.g. fetched in layout.tsx and passed via context).
 *
 * Keys must match the exact pathname (no trailing slash).
 */
export const titleMap: Record<string, string> = {
  "/":                "Home",
  "/about":           "Who We Are",
  "/commitment":      "Our Commitment",
  "/culture":         "Join Us",
  "/discoveries":     "What We Do",
  "/publications":    "Publications",
  "/pipeline":        "Our Products",
  "/products":        "Our Products",
  "/serve":           "Who We Serve",
  "/investors":       "Investors",
  "/mario-test":      "Test Page",
};

/**
 * Look up the display title for a pathname.
 * Falls back to an empty string — the overlay renders without text rather than
 * blocking navigation.
 */
export function getTitleForPath(pathname: string): string {
  // Strip trailing slash for consistent matching
  const key = pathname.replace(/\/$/, "") || "/";
  return titleMap[key] ?? "";
}
