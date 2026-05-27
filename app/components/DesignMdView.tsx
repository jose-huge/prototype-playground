"use client";

import { useEffect, useRef, useState } from "react";
import { getDesignTokens }             from "@/app/actions/design-tokens";
import type { TokenEntry, TokenSnapshot } from "@/app/lib/designSystem";
import { Spinner } from "@/components/ui/spinner";
import styles from "./DesignMdView.module.css";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Last path segment of a Figma name: "Color/Brand/Primary" → "Primary" */
function shortName(figmaName: string) {
  const parts = figmaName.split("/");
  return parts[parts.length - 1].trim();
}

/** Group tokens by their first path segment */
function groupBy(tokens: TokenEntry[]) {
  const map = new Map<string, TokenEntry[]>();
  for (const t of tokens) {
    const key = t.figmaName.includes("/")
      ? t.figmaName.split("/")[0].trim()
      : "Other";
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
  }
  return map;
}

// ── Category sections ──────────────────────────────────────────────────────────

function ColorSection({ tokens }: { tokens: TokenEntry[] }) {
  const groups = groupBy(tokens);
  return (
    <div className={styles.colorGroups}>
      {[...groups.entries()].map(([group, entries]) => (
        <div key={group} className={styles.colorGroup}>
          <h3 className={styles.groupLabel}>{group}</h3>
          <div className={styles.colorGrid}>
            {entries.map((t) => (
              <div key={t.cssVar} className={styles.colorCard}>
                <div className={styles.swatchRow}>
                  <div
                    className={styles.swatch}
                    style={{ background: t.valueLight }}
                    title={`Light: ${t.valueLight}`}
                  />
                  {t.valueDark && (
                    <div
                      className={styles.swatch}
                      style={{ background: t.valueDark }}
                      title={`Dark: ${t.valueDark}`}
                    />
                  )}
                </div>
                <p className={styles.cardName}>{shortName(t.figmaName)}</p>
                <p className={styles.cardVar}>{t.cssVar}</p>
                <p className={styles.cardValue}>
                  {t.valueLight}
                  {t.valueDark && <span className={styles.darkValue}> / {t.valueDark}</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScaleSection({ tokens }: { tokens: TokenEntry[] }) {
  // Sort by numeric value so the scale reads in order
  const sorted = [...tokens].sort((a, b) => {
    const av = parseFloat(a.valueLight);
    const bv = parseFloat(b.valueLight);
    return (isNaN(av) ? 999 : av) - (isNaN(bv) ? 999 : bv);
  });

  return (
    <table className={styles.tokenTable}>
      <thead>
        <tr>
          <th>Token</th>
          <th>CSS variable</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) => (
          <tr key={t.cssVar}>
            <td>{shortName(t.figmaName)}</td>
            <td><code>{t.cssVar}</code></td>
            <td>{t.valueLight}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RadiusSection({ tokens }: { tokens: TokenEntry[] }) {
  const sorted = [...tokens].sort((a, b) => {
    const av = parseFloat(a.valueLight);
    const bv = parseFloat(b.valueLight);
    return (isNaN(av) ? 999 : av) - (isNaN(bv) ? 999 : bv);
  });

  return (
    <div className={styles.radiusRow}>
      {sorted.map((t) => (
        <div key={t.cssVar} className={styles.radiusCard}>
          <div
            className={styles.radiusSample}
            style={{ borderRadius: t.valueLight === "9999px" ? "9999px" : t.valueLight }}
          />
          <p className={styles.cardName}>{shortName(t.figmaName)}</p>
          <p className={styles.cardValue}>{t.valueLight}</p>
        </div>
      ))}
    </div>
  );
}

function ShadowSection({ tokens }: { tokens: TokenEntry[] }) {
  return (
    <div className={styles.shadowGrid}>
      {tokens.map((t) => (
        <div key={t.cssVar} className={styles.shadowCard}>
          <div className={styles.shadowSample} style={{ boxShadow: t.valueLight }} />
          <p className={styles.cardName}>{shortName(t.figmaName)}</p>
          <p className={styles.cardVar}>{t.cssVar}</p>
        </div>
      ))}
    </div>
  );
}

function TypographySection({ tokens }: { tokens: TokenEntry[] }) {
  const sorted = [...tokens].sort((a, b) => {
    const av = parseFloat(a.valueLight);
    const bv = parseFloat(b.valueLight);
    return (isNaN(bv) ? 0 : bv) - (isNaN(av) ? 0 : av); // largest first
  });

  return (
    <table className={styles.tokenTable}>
      <thead>
        <tr>
          <th>Token</th>
          <th>CSS variable</th>
          <th>Value</th>
          {sorted.some((t) => t.meta?.fontFamily) && <th>Family</th>}
          {sorted.some((t) => t.meta?.fontWeight) && <th>Weight</th>}
        </tr>
      </thead>
      <tbody>
        {sorted.map((t) => (
          <tr key={t.cssVar}>
            <td>{shortName(t.figmaName)}</td>
            <td><code>{t.cssVar}</code></td>
            <td>{t.valueLight}</td>
            {sorted.some((s) => s.meta?.fontFamily) && <td>{t.meta?.fontFamily ?? "—"}</td>}
            {sorted.some((s) => s.meta?.fontWeight) && <td>{t.meta?.fontWeight ?? "—"}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GenericSection({ tokens }: { tokens: TokenEntry[] }) {
  const hasDark = tokens.some((t) => t.valueDark);
  return (
    <table className={styles.tokenTable}>
      <thead>
        <tr>
          <th>Token</th>
          <th>CSS variable</th>
          <th>Value</th>
          {hasDark && <th>Dark</th>}
        </tr>
      </thead>
      <tbody>
        {tokens.map((t) => (
          <tr key={t.cssVar}>
            <td>{shortName(t.figmaName)}</td>
            <td><code>{t.cssVar}</code></td>
            <td>{t.valueLight}</td>
            {hasDark && <td>{t.valueDark ?? "—"}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Token viewer ───────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  colors:     "Colors",
  typography: "Typography",
  spacing:    "Spacing",
  radius:     "Border radius",
  shadows:    "Shadows",
  animation:  "Animation",
  other:      "Other",
};

function TokenViewer({ snapshot }: { snapshot: TokenSnapshot }) {
  const { meta, tokens } = snapshot;
  const date = new Date(meta.importedAt).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  const modeLabel: Record<string, string> = {
    both:         "Light + dark",
    "light-only": "Light only",
    "dark-only":  "Dark only",
    single:       "Single mode",
  };

  const categoryOrder = ["colors", "typography", "spacing", "radius", "shadows", "animation", "other"];

  return (
    <div className={styles.viewer}>
      {/* Header */}
      <div className={styles.viewerHeader}>
        <h1 className={styles.viewerTitle}>{meta.figmaFile}</h1>
        <p className={styles.viewerMeta}>
          {tokens.length} tokens · {modeLabel[meta.modeStructure] ?? meta.modeStructure} · Imported {date}
        </p>
      </div>

      {/* Category sections */}
      {categoryOrder.map((cat) => {
        const catTokens = tokens.filter((t) => t.category === cat);
        if (!catTokens.length) return null;
        return (
          <section key={cat} className={styles.section}>
            <h2 className={styles.sectionTitle}>
              {CATEGORY_LABELS[cat] ?? cat}
              <span className={styles.sectionCount}>{catTokens.length}</span>
            </h2>
            {cat === "colors"     && <ColorSection     tokens={catTokens} />}
            {cat === "typography" && <TypographySection tokens={catTokens} />}
            {cat === "spacing"    && <ScaleSection      tokens={catTokens} />}
            {cat === "radius"     && <RadiusSection     tokens={catTokens} />}
            {cat === "shadows"    && <ShadowSection     tokens={catTokens} />}
            {(cat === "animation" || cat === "other") && <GenericSection tokens={catTokens} />}
          </section>
        );
      })}
    </div>
  );
}

// ── Shell states ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className={styles.root}>
      <div className={styles.empty}>
        <div className={styles.emptyIcon} aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="6" y="10" width="28" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 16h16M12 21h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="31" cy="11" r="5" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" />
            <path d="M29 11l1.3 1.3L33 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className={styles.emptyTitle}>No design system imported yet</h2>
        <p className={styles.emptyBody}>
          Connect your Figma file in <strong>Settings → Import design system</strong> to
          populate this reference with your color schemes, typography, spacing, and tokens.
        </p>
      </div>
    </div>
  );
}

function BuildingState() {
  return (
    <div className={styles.root}>
      <div className={styles.empty}>
        <div className={styles.emptyIconSpinning} aria-hidden="true">
          <Spinner className="size-7 text-foreground" />
        </div>
        <h2 className={styles.emptyTitle}>Building your design system…</h2>
        <p className={styles.emptyBody}>
          Pulling variables, color schemes, typography, and tokens from your Figma file.
          This takes about 10–20 seconds.
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  isImporting?: boolean;
}

export default function DesignMdView({ isImporting = false }: Props) {
  const [snapshot,    setSnapshot]    = useState<TokenSnapshot | null>(null);
  const [initLoading, setInitLoading] = useState(true);
  const prevImporting = useRef(isImporting);

  async function load() {
    const data = await getDesignTokens();
    setSnapshot(data);
    setInitLoading(false);
  }

  // Read snapshot from disk on mount
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-read the moment import finishes (true → false transition)
  useEffect(() => {
    if (prevImporting.current === true && isImporting === false) {
      load();
    }
    prevImporting.current = isImporting;
  }, [isImporting]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isImporting)  return <BuildingState />;
  if (initLoading)  return <div className={styles.root}><Spinner className="size-5 text-muted-foreground" /></div>;
  if (!snapshot)    return <EmptyState />;
  return <TokenViewer snapshot={snapshot} />;
}
