// Claude service status from status.claude.com (a Statuspage page).
//
// The HUD's whole budget is ~47ms in a fresh process per refresh, so we must
// NOT fetch on the render path (a single request measured ~70ms and can hang).
// Instead: the segment reads a global tmpdir cache only, and — when that cache
// is missing or past its TTL — fires a detached child (`--fetch-status`) that
// refreshes the cache for the *next* render. The render never blocks, and a
// failed fetch just leaves the last snapshot in place (or nothing).
//
// One request to summary.json yields everything we need: the per-component
// status (we care about "Claude Code") plus the unresolved incidents, each of
// which lists the components it affects.

import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync, writeFileSync, statSync, renameSync } from "node:fs";

const SUMMARY_URL = "https://status.claude.com/api/v2/summary.json";
const CACHE = join(tmpdir(), "oh-my-cchud-status.json");
const LOCK = join(tmpdir(), "oh-my-cchud-status.lock");
const FETCH_TIMEOUT_MS = 4000;
const KICK_DEBOUNCE_MS = 15_000; // don't re-spawn a fetch within this window

export interface StatusComponent {
  id: string;
  name: string;
  status: string; // operational | degraded_performance | partial_outage | major_outage | under_maintenance
}
export interface StatusIncident {
  name: string;
  status: string; // investigating | identified | monitoring | resolved | ...
  impact: string; // none | minor | major | critical
  components?: { id: string }[];
}
export interface StatusSummary {
  components?: StatusComponent[];
  incidents?: StatusIncident[];
  status?: { indicator?: string; description?: string };
}

function ageMs(path: string): number {
  try {
    return Date.now() - statSync(path).mtimeMs;
  } catch {
    return Infinity; // missing file → infinitely old
  }
}

// Read the cached summary and how stale it is. null if we've never fetched.
export function readStatusCache(): { summary: StatusSummary; ageMs: number } | null {
  try {
    const summary = JSON.parse(readFileSync(CACHE, "utf8")) as StatusSummary;
    return { summary, ageMs: ageMs(CACHE) };
  } catch {
    return null;
  }
}

// Fire-and-forget a background refresh, debounced via a lock file so we don't
// spawn one on every ~300ms render while a fetch is already in flight. Reuses
// our own runtime/binary (process.argv) with a --fetch-status flag, so there's
// no curl / bun-on-PATH assumption and it works for the compiled binary too.
export function kickStatusFetch(): void {
  if (ageMs(LOCK) < KICK_DEBOUNCE_MS) return; // refreshed/kicked recently
  try {
    writeFileSync(LOCK, "");
  } catch {
    /* lock is best-effort; worst case is an extra fetch */
  }
  try {
    const child = Bun.spawn([...process.argv, "--fetch-status"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });
    child.unref(); // let this render's process exit without waiting on it
  } catch {
    /* never fail the HUD over a refresh */
  }
}

// The `--fetch-status` routine: fetch summary.json and atomically replace the
// cache. Runs in a short-lived detached child; every failure path is silent and
// leaves the previous cache untouched.
export async function runStatusFetch(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(SUMMARY_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return;
    const body = await res.text();
    JSON.parse(body); // validate before persisting; never cache garbage
    const tmp = `${CACHE}.tmp`;
    writeFileSync(tmp, body);
    renameSync(tmp, CACHE); // atomic swap so a reader never sees a partial file
  } catch {
    /* offline / timeout / parse error — keep the old snapshot */
  }
}
