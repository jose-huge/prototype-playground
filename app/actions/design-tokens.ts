"use server";

/**
 * Server Action — reads docs/tokens.json directly from the filesystem.
 * Zero network calls: the file is the snapshot written by the import pipeline.
 */

import fs   from "fs";
import path from "path";
import type { TokenSnapshot } from "@/app/lib/designSystem";

const TOKENS_JSON = path.join(process.cwd(), "docs", "tokens.json");

export async function getDesignTokens(): Promise<TokenSnapshot | null> {
  try {
    const raw = fs.readFileSync(TOKENS_JSON, "utf8");
    return JSON.parse(raw) as TokenSnapshot;
  } catch {
    return null;
  }
}
