// Config loading. Defaults are inline so the HUD works with zero setup.
// Override by dropping a config.json next to the plugin (CLAUDE_PLUGIN_ROOT)
// or at ~/.claude/oh-my-cchud.json. User file is shallow-merged over defaults.

import { homedir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";

export interface Config {
  separator: string;
  theme: string; // see src/theme.ts — "default" | "nerd" | "ascii"
  // Each inner array is one rendered line; values are segment names.
  lines: string[][];
  context: { barWidth: number; warn: number; crit: number };
  // `reset`: how to show the rate-limit reset — "relative" (in 2h12m) | "clock" (14:30) | "off"
  rate: { warn: number; crit: number; reset: "relative" | "clock" | "off" };
  transcript: { tailBytes: number; recentTools: number };
  git: { cacheMs: number };
  // Claude service status (status.claude.com). The `status` segment self-hides
  // while Claude Code is operational; it only appears during an outage/incident.
  //   ttlMs       — how long a cached snapshot is fresh before a background refresh
  //   staleMaxMs  — past this age the snapshot is too old to trust → stay silent
  //   component   — which Statuspage component to watch
  status: { ttlMs: number; staleMaxMs: number; component: string };
}

export const DEFAULT_CONFIG: Config = {
  separator: "  ",
  theme: "default",
  // Line 1 = [project] anchor + identity + budget gauges (context% drives the
  // /compact decision, rate% the quota — both answer "how much headroom is
  // left"). `pr`/`worktree` auto-hide when absent, so they only show when relevant.
  // Line 2 leads with reasoning state (effort/thinking — what's driving token
  // burn) then the activity Claude Code's main UI does NOT persist: subagents
  // and todo progress.
  // Omitted by default (segments still available, add to a line to enable):
  //   `cost`         — flat-rate artifact for Pro/Max; rate_limits is the real signal.
  //   `tools`        — the active tool is already shown live in Claude Code's UI,
  //                    and the status line refreshes on a lag → redundant + staler.
  //   `output_style` — a rarely-changed, user-set value that drives no action.
  // `status` leads line 2: invisible while Claude Code is healthy, and lights up
  // (yellow/red) only during a service incident — exactly when you want to know
  // it's them, not you. It sits on the activity line, ahead of effort/thinking,
  // so an outage is the first thing that line shows when it shows anything.
  lines: [
    ["project", "model", "worktree", "git", "pr", "context", "rate"],
    ["status", "effort", "thinking", "agents", "todos"],
  ],
  context: { barWidth: 14, warn: 70, crit: 90 },
  rate: { warn: 60, crit: 85, reset: "relative" },
  // 128 KiB tail keeps parse cost flat regardless of total transcript size.
  transcript: { tailBytes: 128 * 1024, recentTools: 3 },
  git: { cacheMs: 3000 },
  status: { ttlMs: 60_000, staleMaxMs: 15 * 60_000, component: "Claude Code" },
};

function readJson(path: string): Partial<Config> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

export function loadConfig(): Config {
  const candidates = [
    process.env.OH_MY_CCHUD_CONFIG,
    process.env.CLAUDE_PLUGIN_ROOT
      ? join(process.env.CLAUDE_PLUGIN_ROOT, "config.json")
      : undefined,
    join(homedir(), ".claude", "oh-my-cchud.json"),
  ].filter(Boolean) as string[];

  let user: Partial<Config> | null = null;
  for (const path of candidates) {
    user = readJson(path);
    if (user) break;
  }

  // Shallow merge with one level of nesting for the object sub-keys.
  const merged: Config = {
    ...DEFAULT_CONFIG,
    ...user,
    context: { ...DEFAULT_CONFIG.context, ...user?.context },
    rate: { ...DEFAULT_CONFIG.rate, ...user?.rate },
    transcript: { ...DEFAULT_CONFIG.transcript, ...user?.transcript },
    git: { ...DEFAULT_CONFIG.git, ...user?.git },
    status: { ...DEFAULT_CONFIG.status, ...user?.status },
  };

  // Env override wins last — handy for `OH_MY_CCHUD_THEME=ascii` previews.
  if (process.env.OH_MY_CCHUD_THEME) merged.theme = process.env.OH_MY_CCHUD_THEME;
  return merged;
}
