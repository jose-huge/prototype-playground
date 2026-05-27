"use client";

import { Spinner } from "@/components/ui/spinner";
import styles from "./DesignMdView.module.css";

interface Props {
  isImporting?: boolean;
}

/**
 * Design Reference view — populated after a user imports their Figma design system.
 * Shows a building state while the import is running, empty state until then.
 */
export default function DesignMdView({ isImporting = false }: Props) {
  return (
    <div className={styles.root}>
      <div className={styles.empty}>
        <div className={styles.emptyIcon} aria-hidden="true">
          {isImporting ? (
            <Spinner className="size-6 text-muted-foreground" />
          ) : (
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="6" y="10" width="28" height="22" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 16h16M12 21h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="31" cy="11" r="5" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth="1.5" />
              <path d="M29 11l1.3 1.3L33 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <h2 className={styles.emptyTitle}>
          {isImporting ? "Building your design system…" : "No design system imported yet"}
        </h2>
        <p className={styles.emptyBody}>
          {isImporting
            ? "Pulling variables, color schemes, typography, and tokens from your Figma file. This takes about 10–20 seconds."
            : <>Connect your Figma file in <strong>Settings → Import design system</strong> to populate this reference with your color schemes, typography, spacing, and tokens.</>
          }
        </p>
      </div>
    </div>
  );
}
