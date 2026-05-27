/**
 * /api/design-system
 *
 * POST — Run the full design system import pipeline and stream progress via
 *        newline-delimited JSON (NDJSON). Each line is a ProgressEvent.
 *
 * GET  — Return the stored tokens.json snapshot (or 404 if not yet imported).
 *
 * DELETE — Remove all generated files (tokens.css, design.md, tokens.json).
 */

import { NextResponse }   from "next/server";
import fs                  from "fs";
import path                from "path";
import {
  processTokens,
  generateTokensCss,
  generateDesignMd,
  processStyleNode,
  type FigmaVariablesResponse,
  type FigmaStylesResponse,
  type FigmaNodesResponse,
  type FigmaStyle,
  type ProcessedStyle,
  type TokenSnapshot,
} from "@/app/lib/designSystem";

// ── Paths ──────────────────────────────────────────────────────────────────────

const CWD          = process.cwd();
const CONFIG_PATH  = path.join(CWD, ".figma-config.json");
const DOCS_DIR     = path.join(CWD, "docs");
const TOKENS_CSS   = path.join(CWD, "styles", "generated-tokens.css");
const DESIGN_MD    = path.join(DOCS_DIR, "design.md");
const TOKENS_JSON  = path.join(DOCS_DIR, "tokens.json");
const IMPORT_META  = path.join(DOCS_DIR, "import-meta.json");

const FIGMA_TIMEOUT_MS = 20_000;

// ── Types ──────────────────────────────────────────────────────────────────────

interface FigmaConfig { token: string; fileKey: string; fileName: string }

export type StepStatus = "pending" | "running" | "done" | "error";

export interface ProgressEvent {
  step:    number;       // 1-based index
  label:   string;
  status:  StepStatus;
  detail?: string;       // extra info shown under the label
  error?:  string;       // only on status=error
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function readConfig(): FigmaConfig | null {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw) as FigmaConfig;
  } catch { return null; }
}

async function figmaFetch<T>(path: string, token: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIGMA_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.figma.com/v1${path}`, {
      headers: { "X-Figma-Token": token },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Figma API ${res.status}: ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── SSE stream helpers ─────────────────────────────────────────────────────────

function encodeEvent(event: ProgressEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event) + "\n");
}

// ── GET — return stored tokens snapshot ───────────────────────────────────────

export async function GET() {
  try {
    if (!fs.existsSync(TOKENS_JSON)) {
      return NextResponse.json({ error: "Not imported yet" }, { status: 404 });
    }
    const raw  = fs.readFileSync(TOKENS_JSON, "utf8");
    const data = JSON.parse(raw) as TokenSnapshot;

    // Also return import metadata if present
    let importedAt: string | null = null;
    try {
      const meta = JSON.parse(fs.readFileSync(IMPORT_META, "utf8")) as { importedAt: string };
      importedAt = meta.importedAt;
    } catch { /* ok */ }

    return NextResponse.json({ ...data, _importedAt: importedAt });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read tokens" },
      { status: 500 }
    );
  }
}

// ── DELETE — remove generated files ───────────────────────────────────────────

export async function DELETE() {
  const files = [TOKENS_CSS, DESIGN_MD, TOKENS_JSON, IMPORT_META];
  for (const f of files) {
    try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* ok */ }
  }
  return NextResponse.json({ ok: true });
}

// ── POST — run import pipeline, stream progress ────────────────────────────────

export async function POST() {
  const STEPS = [
    "Connected to Figma",
    "Fetched variables",
    "Fetched styles",
    "Processing tokens",
    "Generating tokens.css",
    "Generating design.md",
    "Building reference page",
  ];

  // Initialize all steps as pending
  const stepStates: ProgressEvent[] = STEPS.map((label, i) => ({
    step:   i + 1,
    label,
    status: "pending" as StepStatus,
  }));

  const stream = new ReadableStream({
    async start(controller) {
      function emit(idx: number, status: StepStatus, detail?: string, error?: string) {
        stepStates[idx] = { ...stepStates[idx], status, detail, error };
        controller.enqueue(encodeEvent(stepStates[idx]));
      }

      // Emit initial state (all pending)
      for (const s of stepStates) controller.enqueue(encodeEvent(s));

      try {
        // ── Step 1: Verify Figma connection ─────────────────────────────────
        emit(0, "running");
        const config = readConfig();
        if (!config?.token || !config?.fileKey) {
          emit(0, "error", undefined, "No Figma connection — connect in Settings first");
          controller.close();
          return;
        }
        emit(0, "done", config.fileName);

        // ── Step 2: Fetch variables ──────────────────────────────────────────
        emit(1, "running");
        let variablesResponse: FigmaVariablesResponse | null = null;
        try {
          variablesResponse = await figmaFetch<FigmaVariablesResponse>(
            `/files/${config.fileKey}/variables/local`,
            config.token
          );
          const varCount = variablesResponse.meta
            ? Object.keys(variablesResponse.meta.variables ?? {}).length
            : 0;
          emit(1, "done", `${varCount} variables`);
        } catch (err) {
          // Variables API may require a paid plan — treat as non-fatal
          const msg = err instanceof Error ? err.message : String(err);
          emit(1, "done", `Skipped — ${msg.includes("403") ? "requires Figma paid plan" : msg}`);
          variablesResponse = null;
        }

        // ── Step 3: Fetch styles ─────────────────────────────────────────────
        emit(2, "running");
        let processedStyles: ProcessedStyle[] = [];
        try {
          const stylesRes = await figmaFetch<FigmaStylesResponse>(
            `/files/${config.fileKey}/styles`,
            config.token
          );
          const styles = stylesRes.meta?.styles ?? [];
          emit(2, "running", `Fetching ${styles.length} style nodes…`);

          // Fetch style node data in batches of 50
          const BATCH = 50;
          for (let i = 0; i < styles.length; i += BATCH) {
            const batch  = styles.slice(i, i + BATCH);
            const ids    = batch.map((s) => s.node_id).join(",");
            const nodesRes = await figmaFetch<FigmaNodesResponse>(
              `/files/${config.fileKey}/nodes?ids=${encodeURIComponent(ids)}`,
              config.token
            );

            for (const style of batch) {
              const node = nodesRes.nodes[style.node_id];
              if (!node?.document) continue;
              const processed = processStyleNode(style as FigmaStyle, node.document);
              if (processed) processedStyles.push(processed);
            }
          }
          emit(2, "done", `${processedStyles.length} styles`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          emit(2, "done", `Partial — ${msg}`);
        }

        // ── Step 4: Process tokens ───────────────────────────────────────────
        emit(3, "running");
        let snapshot: TokenSnapshot;
        try {
          snapshot = processTokens({
            variablesResponse,
            stylesData: processedStyles,
            fileName:   config.fileName,
          });
          emit(3, "done", `${snapshot.tokens.length} tokens`);
        } catch (err) {
          emit(3, "error", undefined, err instanceof Error ? err.message : "Processing failed");
          controller.close();
          return;
        }

        // ── Step 5: Write tokens.css ─────────────────────────────────────────
        emit(4, "running");
        try {
          const css = generateTokensCss(snapshot);
          fs.writeFileSync(TOKENS_CSS, css, "utf8");
          emit(4, "done", "styles/generated-tokens.css");
        } catch (err) {
          emit(4, "error", undefined, err instanceof Error ? err.message : "Write failed");
          controller.close();
          return;
        }

        // ── Step 6: Write design.md ──────────────────────────────────────────
        emit(5, "running");
        try {
          ensureDir(DOCS_DIR);
          const md = generateDesignMd(snapshot);
          fs.writeFileSync(DESIGN_MD, md, "utf8");
          emit(5, "done", "docs/design.md");
        } catch (err) {
          emit(5, "error", undefined, err instanceof Error ? err.message : "Write failed");
          controller.close();
          return;
        }

        // ── Step 7: Write tokens.json ────────────────────────────────────────
        emit(6, "running");
        try {
          ensureDir(DOCS_DIR);
          fs.writeFileSync(TOKENS_JSON, JSON.stringify(snapshot, null, 2), "utf8");
          // Persist import timestamp for the Settings panel "Last imported" label
          fs.writeFileSync(
            IMPORT_META,
            JSON.stringify({ importedAt: snapshot.meta.importedAt }),
            "utf8"
          );
          emit(6, "done", "docs/tokens.json");
        } catch (err) {
          emit(6, "error", undefined, err instanceof Error ? err.message : "Write failed");
          controller.close();
          return;
        }

        controller.close();
      } catch (err) {
        // Unhandled top-level error
        const msg = err instanceof Error ? err.message : "Unexpected error";
        controller.enqueue(encodeEvent({
          step:   0,
          label:  "Import failed",
          status: "error",
          error:  msg,
        }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "application/x-ndjson",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
