"use client";

import { createContext, useContext } from "react";

/**
 * Fallback schemes used when no design system has been imported (blank
 * starter). Once a design system is imported, the live scheme list comes
 * from the imported snapshot (`GET /api/design-system` → snapshot.schemes),
 * so the picker reflects whatever modes the Figma file defines.
 */
export const SCHEME_NAMES = [
  "light",
  "dark",
] as const;

/**
 * A scheme name is any normalised `data-scheme` value. It is a plain string
 * (not a literal union) because imported design systems can define arbitrary
 * scheme names beyond the built-in light/dark fallback.
 */
export type SchemeName = string;

const SchemeContext = createContext<SchemeName | undefined>(undefined);

export function SchemeProvider({
  scheme,
  children,
}: {
  scheme?: SchemeName;
  children: React.ReactNode;
}) {
  // When a scheme is active, apply data-scheme to a wrapper div so that
  // CSS custom properties cascade into every child that has no competing
  // data-scheme of its own. Components that export `defaultScheme` and
  // have no data-scheme on their root get the override automatically.
  // display:contents keeps the wrapper invisible to layout.
  return (
    <SchemeContext.Provider value={scheme}>
      {scheme
        ? <div data-scheme={scheme} style={{ display: "contents" }}>{children}</div>
        : children
      }
    </SchemeContext.Provider>
  );
}

/**
 * @deprecated — only kept for existing components that still use it.
 * New components should export `defaultScheme` and have no data-scheme on
 * their root element; the playground handles scheme application externally.
 */
export function useSchemeOverride(defaultScheme: SchemeName): SchemeName {
  const override = useContext(SchemeContext);
  return override ?? defaultScheme;
}
