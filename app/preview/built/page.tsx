// Force Next.js to re-render on every request so a freshly updated barrel
// is always used — no stale cached bundle served after a new component is built.
export const dynamic = "force-dynamic";

import React from "react";
import * as Registry from "../../../components";
import { SchemeProvider, type SchemeName } from "../../components/SchemeContext";

// Built-component preview — rendered inside a Playground iframe.
// /preview/built?name=Chip&scheme=white
//
// Scheme resolution order:
//   1. ?scheme= query param  (playground toolbar selection)
//   2. component's exported `defaultScheme` constant
//   3. no scheme applied
export default async function BuiltPreview({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; scheme?: string }>;
}) {
  const { name, scheme } = await searchParams;

  if (!name) {
    return (
      <div style={{ padding: 32, fontFamily: "sans-serif", color: "#888" }}>
        No component name provided.
      </div>
    );
  }

  const mod = Registry as Record<string, unknown>;
  const Component = mod[name] as React.ComponentType | undefined;

  // Component not in the compiled bundle yet — the barrel was just updated and
  // Next.js hasn't recompiled this page yet. Return a lightweight auto-retry
  // page: it reloads itself every 1.5 s until the component is available.
  if (!Component) {
    return (
      <html>
        <body style={{ margin: 0, background: "transparent" }}>
          {/* eslint-disable-next-line @next/next/no-sync-scripts */}
          <script
            dangerouslySetInnerHTML={{
              __html: `setTimeout(function(){ location.reload(); }, 1500);`,
            }}
          />
        </body>
      </html>
    );
  }

  // Prefer explicit toolbar selection; fall back to the component's own default.
  const componentDefault = mod[`${name}DefaultScheme`] as SchemeName | undefined;
  const activeScheme = (scheme as SchemeName | undefined) ?? componentDefault;

  const rootStyle: React.CSSProperties = {
    containerType: "inline-size",
    containerName: "pg-root",
    width: "100%",
  };

  return (
    <SchemeProvider scheme={activeScheme}>
      <div style={rootStyle}>
        <Component />
      </div>
    </SchemeProvider>
  );
}
