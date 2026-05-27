"use client";

import styles from "./DesignMdView.module.css";

/**
 * Design Reference view — populated after a user imports their Figma design system.
 * Shows an empty state until then.
 */
export default function DesignMdView() {
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
