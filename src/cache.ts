// Session-keyed disk cache for expensive operations (git, etc.).
// The status line script re-runs on every event (debounced ~300ms), so we
// memoize across invocations to a temp file. Keyed by session_id because it is
// stable for the session and unique across concurrent sessions — pid-based keys
// change every invocation and defeat the cache (per the official docs).

import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

interface Entry<T> {
  at: number; // epoch ms
  value: T;
}

function cachePath(sessionId: string) {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "_") || "default";
  return join(tmpdir(), `oh-my-cchud-${safe}.json`);
}

function readStore(sessionId: string): Record<string, Entry<unknown>> {
  try {
    return JSON.parse(readFileSync(cachePath(sessionId), "utf8"));
  } catch {
    return {};
  }
}

function writeStore(sessionId: string, store: Record<string, Entry<unknown>>) {
  try {
    writeFileSync(cachePath(sessionId), JSON.stringify(store));
  } catch {
    /* cache is best-effort; never fail the HUD over it */
  }
}

// Return a fresh cached value, or recompute with `produce` and persist it.
export function cached<T>(
  sessionId: string,
  key: string,
  ttlMs: number,
  produce: () => T,
): T {
  const store = readStore(sessionId);
  const hit = store[key] as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;

  const value = produce();
  store[key] = { at: Date.now(), value };
  writeStore(sessionId, store);
  return value;
}
