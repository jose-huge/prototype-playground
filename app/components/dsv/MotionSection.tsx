"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CopyButton } from "./shared";
import styles from "./MotionSection.module.css";

// ── Token data ─────────────────────────────────────────────────────────────────
// These mirror styles/motion.css exactly. They are hardcoded defaults shipped
// with the blank repo — not generated from Figma.

const DURATIONS = [
  { token: "--duration-instant", ms: 0,   desc: "State changes — no perceived motion" },
  { token: "--duration-xs",      ms: 120, desc: "Micro feedback — press, tap-state" },
  { token: "--duration-sm",      ms: 200, desc: "Hover, color, opacity" },
  { token: "--duration-md",      ms: 320, desc: "Reveal, expand, panel slide" },
  { token: "--duration-lg",      ms: 480, desc: "Page-level transitions" },
  { token: "--duration-xl",      ms: 640, desc: "Ambient / decorative only" },
] as const;

const EASINGS = [
  { token: "--ease-out",        curve: [0.22, 0.61, 0.36, 1]    as const, desc: "Default — entering elements" },
  { token: "--ease-emphasized", curve: [0.2,  0,    0,    1]    as const, desc: "Dramatic slow-finish reveals" },
  { token: "--ease-in-out",     curve: [0.65, 0.05, 0.36, 1]   as const, desc: "Symmetric — elements crossing viewport" },
  { token: "--ease-in",         curve: [0.55, 0.06, 0.68, 0.19] as const, desc: "Exit transitions — elements leaving" },
  { token: "--ease-linear",     curve: [0,    0,    1,    1]    as const, desc: "Progress bars, continuous rotation" },
] as const;

const SHIFTS = [
  { token: "--motion-shift-xs", px: 2  },
  { token: "--motion-shift-sm", px: 4  },
  { token: "--motion-shift-md", px: 8  },
  { token: "--motion-shift-lg", px: 16 },
] as const;

const TRANSITION_PRESETS = [
  { token: "--transition-hover",       use: "Color, bg, border, opacity on interactive states" },
  { token: "--transition-press",       use: "Transform, opacity on tap / click feedback" },
  { token: "--transition-reveal",      use: "Opacity, transform, width on element entering view" },
  { token: "--transition-expand",      use: "Width, height, max-width, max-height on layout open/close" },
  { token: "--transition-modal",       use: "Opacity, transform on modal or drawer entrance" },
  { token: "--transition-modal-scrim", use: "Opacity on backdrop / scrim fade" },
] as const;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Compute an SVG cubic-bezier path in a 64×64 viewBox (y-axis flipped). */
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const W = 64, H = 64;
  const c1x = x1 * W;
  const c1y = H - y1 * H;
  const c2x = x2 * W;
  const c2y = H - y2 * H;
  return `M 0 ${H} C ${c1x} ${c1y} ${c2x} ${c2y} ${W} 0`;
}

/**
 * Tracks which end the ball is currently at.
 * Toggling `atEnd` drives the CSS transition in whichever direction is needed:
 *   false → true  : slides forward  (left → right)
 *   true  → false : slides backward (right → left)
 * No force-reflow trick needed — CSS transition handles both directions.
 */
function usePlayDemo() {
  const [atEnd, setAtEnd] = useState(false);
  const play = () => setAtEnd((prev) => !prev);
  return { atEnd, play };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

/**
 * A pill track with a sliding ball.
 * Click 1 → slides forward. Click 2 → slides backward. Repeats.
 * CSS transition handles both directions; no animation restart needed.
 */
function DemoTrack({
  durToken,
  easeToken,
  "aria-label": ariaLabel,
}: {
  durToken?:    string;
  easeToken?:   string;
  "aria-label"?: string;
}) {
  const { atEnd, play } = usePlayDemo();

  const ballStyle: Record<string, string> = {};
  if (durToken)  ballStyle["--ball-dur"]  = `var(${durToken})`;
  if (easeToken) ballStyle["--ball-ease"] = `var(${easeToken})`;

  return (
    <button
      type="button"
      className={styles.track}
      onClick={play}
      aria-label={ariaLabel ?? "Toggle demo animation"}
      title="Click to slide forward / backward"
    >
      <div
        className={cn(styles.ball, atEnd && styles.ballAtEnd)}
        style={ballStyle as React.CSSProperties}
      />
    </button>
  );
}

/** Tiny bezier curve SVG with control-point handles. */
function BezierSvg({ curve }: { curve: readonly [number, number, number, number] }) {
  const [x1, y1, x2, y2] = curve;
  const W = 64, H = 64;
  const path = bezierPath(x1, y1, x2, y2);
  // Control point dot positions
  const cp1 = { x: x1 * W, y: H - y1 * H };
  const cp2 = { x: x2 * W, y: H - y2 * H };

  return (
    <svg
      width={64}
      height={64}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      style={{ color: "currentcolor", display: "block", flexShrink: 0 }}
    >
      {/* Axes */}
      <line x1="0" y1="64" x2="0"  y2="0"  stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
      <line x1="0" y1="64" x2="64" y2="64" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
      {/* Linear reference */}
      <line x1="0" y1="64" x2="64" y2="0" stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="3 3" />
      {/* Handle lines */}
      <line x1="0" y1="64" x2={cp1.x} y2={cp1.y} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      <line x1="64" y1="0" x2={cp2.x} y2={cp2.y} stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      {/* Control points */}
      <circle cx={cp1.x} cy={cp1.y} r="2.5" fill="currentColor" fillOpacity="0.4" />
      <circle cx={cp2.x} cy={cp2.y} r="2.5" fill="currentColor" fillOpacity="0.4" />
      {/* Curve */}
      <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {/* Start / end dots */}
      <circle cx="0"  cy="64" r="3" fill="currentColor" />
      <circle cx="64" cy="0"  r="3" fill="currentColor" />
    </svg>
  );
}

/** Shared sub-section heading. */
function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
      {children}
    </p>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function MotionSection() {
  return (
    <div className="flex flex-col gap-10">

      {/* ── 1. Durations ────────────────────────────────────────────────────── */}
      <div>
        <SubHead>Durations</SubHead>
        <div className="flex flex-col gap-1">
          {DURATIONS.map(({ token, ms, desc }) => (
            <div key={token} className="flex items-center gap-4 py-1.5 rounded-md hover:bg-muted/50 group">
              <DemoTrack durToken={token} aria-label={`Demo ${token}`} />
              <code className="font-mono text-xs text-foreground w-32 shrink-0">{token}</code>
              <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">{ms}ms</span>
              <span className="text-xs text-muted-foreground flex-1 min-w-0 truncate">{desc}</span>
              <CopyButton value={`var(${token})`} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground/70">Click a track to replay the animation at that duration.</p>
      </div>

      {/* ── 2. Easings ──────────────────────────────────────────────────────── */}
      <div>
        <SubHead>Easings</SubHead>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {EASINGS.map(({ token, curve, desc }) => (
            <div key={token} className={styles.bezierCard}>
              {/* Bezier curve SVG */}
              <BezierSvg curve={curve} />

              {/* Hover-demo ball — uses a fixed medium duration, varies easing */}
              <DemoTrack
                durToken="--duration-md"
                easeToken={token}
                aria-label={`Demo ${token}`}
              />

              {/* Name + description */}
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <code className="font-mono text-[11px] text-foreground truncate">{token}</code>
                  <CopyButton value={`var(${token})`} />
                </div>
                <span className="text-[11px] text-muted-foreground leading-snug">{desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Motion Shifts ────────────────────────────────────────────────── */}
      <div>
        <SubHead>Motion Shifts</SubHead>
        <div className="flex flex-col gap-2">
          {SHIFTS.map(({ token, px }) => (
            <div key={token} className="flex items-center gap-4 py-1 rounded-md hover:bg-muted/50 group">
              {/* Bar — visually proportional (scale ×6 so 2px is perceptible) */}
              <div
                className={styles.shiftBar}
                style={{ width: `${px * 6}px`, minWidth: "12px" }}
                aria-label={`${px}px`}
              />
              <code className="font-mono text-xs text-foreground w-36 shrink-0">{token}</code>
              <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">{px}px</span>
              <span className="text-xs text-muted-foreground flex-1">
                {px === 2  ? "Subtle nudge — micro feedback"    :
                 px === 4  ? "Small shift — hover lift"          :
                 px === 8  ? "Medium shift — reveal offset"      :
                             "Large shift — enter / exit travel"}
              </span>
              <CopyButton value={`var(${token})`} />
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. Transition Presets ────────────────────────────────────────────── */}
      <div>
        <SubHead>Transition Presets</SubHead>
        <div className="flex flex-col">
          {/* Header row */}
          <div className={styles.presetRow} style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Token</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Use case</span>
          </div>
          {TRANSITION_PRESETS.map(({ token, use }) => (
            <div key={token} className={styles.presetRow}>
              <div className="flex items-center gap-1 min-w-0">
                <code className="font-mono text-xs text-foreground truncate">{token}</code>
                <CopyButton value={`var(${token})`} />
              </div>
              <span className="text-xs text-muted-foreground">{use}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
