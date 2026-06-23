// Segment registry. Each segment is (ctx) => string | null.
// Returning null (or "") omits the segment from its line entirely.
// Segments pull colors + glyphs from ctx.theme — never hardcoded.

import { c, link } from "./ansi";
import { cached } from "./cache";
import { readStatusCache, kickStatusFetch } from "./status";
import type { Ctx } from "./types";

export type Segment = (ctx: Ctx) => string | null;

const num = (v: unknown): v is number => typeof v === "number" && !Number.isNaN(v);

function project({ input, theme }: Ctx): string | null {
  // project_dir is the original project root (stable even inside a worktree or
  // subdir); fall back to the current dir. basename = the project name.
  const dir = input.workspace?.project_dir || input.workspace?.current_dir || input.cwd;
  if (!dir) return null;
  const name = dir.replace(/[/\\]+$/, "").split(/[/\\]/).pop();
  if (!name) return null;
  return theme.muted("[") + c.bold(name) + theme.muted("]");
}

function model({ input, theme }: Ctx): string | null {
  const name = input.model?.display_name;
  return name ? theme.accent(name) : null;
}

function context({ input, config, theme }: Ctx): string | null {
  const pct = input.context_window?.used_percentage;
  const { barWidth, warn, crit } = config.context;
  if (!num(pct)) return theme.muted("ctx —"); // null early in session / after /compact

  const filled = Math.round((pct / 100) * barWidth);
  const color = theme.scale(pct, warn, crit);
  const bar =
    color(theme.glyphs.barFull.repeat(filled)) +
    theme.muted(theme.glyphs.barEmpty.repeat(barWidth - filled));
  return `${bar} ${color(`${Math.round(pct)}%`)}`;
}

function cost({ input, theme }: Ctx): string | null {
  const usd = input.cost?.total_cost_usd;
  const ms = input.cost?.total_duration_ms; // wall-clock time since session start
  const parts: string[] = [];
  if (num(usd)) parts.push(c.yellow(`$${usd.toFixed(2)}`));
  if (num(ms)) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const dur = m > 0 ? `${m}m${s % 60}s` : `${s}s`;
    // parenthesize so it reads as "elapsed", distinct from the cost figure
    parts.push(theme.muted(`(${dur})`));
  }
  return parts.length ? parts.join(" ") : null;
}

function git({ cwd, sessionId, config, input, theme }: Ctx): string | null {
  // git status is slow on big repos; cache it per session for a few seconds.
  const info = cached(sessionId, "git", config.git.cacheMs, () => {
    const run = (args: string[]) => {
      const r = Bun.spawnSync(["git", "-C", cwd, ...args]);
      return r.success ? new TextDecoder().decode(r.stdout).trim() : "";
    };
    const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
    if (!branch) return null;
    const porcelain = run(["status", "--porcelain"]);
    const dirty = porcelain ? porcelain.split("\n").filter(Boolean).length : 0;
    return { branch, dirty };
  });

  if (!info) return null;
  // Make the branch clickable → the repo's tree at that branch, when we know the remote.
  const repo = input.workspace?.repo;
  let branchText = info.branch;
  if (repo?.host && repo.owner && repo.name) {
    const url = `https://${repo.host}/${repo.owner}/${repo.name}/tree/${info.branch}`;
    branchText = link(info.branch, url);
  }
  const head = `${theme.muted(theme.glyphs.branch)} ${branchText}`;
  return info.dirty > 0 ? `${head}${theme.warn(`${theme.glyphs.dirty}${info.dirty}`)}` : head;
}

function rate({ input, config, theme }: Ctx): string | null {
  const rl = input.rate_limits;
  if (!rl) return null; // Pro/Max only, after first API response
  const { warn, crit, reset } = config.rate;
  const seg = (label: string, w?: { used_percentage?: number; resets_at?: number }) => {
    if (!w || !num(w.used_percentage)) return null;
    let out = theme.scale(w.used_percentage, warn, crit)(`${label} ${Math.round(w.used_percentage)}%`);
    if (reset !== "off" && num(w.resets_at)) {
      const r = formatReset(w.resets_at, reset);
      if (r) out += theme.muted(` (${r})`);
    }
    return out;
  };
  const parts = [seg("5h", rl.five_hour), seg("7d", rl.seven_day)].filter(Boolean);
  return parts.length ? parts.join("  ") : null;
}

// rate-limit reset → "in 2h12m" (relative) or "14:30" (wall clock). resets_at is epoch seconds.
function formatReset(resetsAtSec: number, mode: "relative" | "clock"): string | null {
  const ms = resetsAtSec * 1000;
  if (mode === "clock") {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
  const sec = Math.floor((ms - Date.now()) / 1000);
  if (sec <= 0) return "now";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}d${h}h`;
  if (h > 0) return `${h}h${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

function tools({ transcript, theme }: Ctx): string | null {
  if (transcript.activeTool) {
    return `${theme.ok(theme.glyphs.activeTool)} ${c.bold(transcript.activeTool)}`;
  }
  if (transcript.recentTools.length) {
    return theme.muted(transcript.recentTools.join("·"));
  }
  return null;
}

function todos({ transcript, theme }: Ctx): string | null {
  const t = transcript.todos;
  if (!t || t.total === 0) return null;
  const done = t.completed === t.total ? theme.ok : c.cyan;
  const head = done(`${theme.glyphs.todo} ${t.completed}/${t.total}`);
  return t.active ? `${head} ${theme.muted(truncate(t.active, 28))}` : head;
}

function agents({ transcript, theme }: Ctx): string | null {
  if (transcript.runningAgents <= 0) return null;
  const names = transcript.agents
    .filter((a) => a.running)
    .map((a) => a.type)
    .slice(0, 2)
    .join(",");
  return `${c.magenta(names)} ${theme.muted(`${theme.glyphs.agent}${transcript.runningAgents}`)}`;
}

function worktree({ input, theme }: Ctx): string | null {
  // Prefer the explicit --worktree session object; fall back to a linked worktree dir.
  const wt = input.worktree;
  const name = wt?.name || input.workspace?.git_worktree;
  if (!name) return null;
  const branch = wt?.branch;
  const label = branch && branch !== name ? `${name}:${branch}` : name;
  return `${theme.muted(theme.glyphs.worktree)} ${c.blue(label)}`;
}

function output_style({ input, theme }: Ctx): string | null {
  const name = input.output_style?.name;
  if (!name || name === "default") return null; // only surface non-default styles
  return theme.muted(`style:${name}`);
}

function effort({ input, theme }: Ctx): string | null {
  const level = input.effort?.level;
  if (!level) return null; // only when the model supports reasoning effort
  // color by intensity — higher effort burns more tokens, so make it stand out
  const color =
    level === "xhigh" || level === "max"
      ? theme.crit
      : level === "high"
        ? theme.warn
        : level === "low"
          ? theme.muted
          : c.cyan;
  return `${theme.muted(theme.glyphs.effort)} ${color(level)}`;
}

function thinking({ input, theme }: Ctx): string | null {
  if (!input.thinking?.enabled) return null;
  return theme.accent(theme.glyphs.thinking);
}

function pr({ input, theme }: Ctx): string | null {
  const p = input.pr;
  if (!p?.number) return null;
  const state = p.review_state ? ` ${p.review_state}` : "";
  const text = `${theme.glyphs.pr} #${p.number}${state}`;
  return p.url ? c.blue(link(text, p.url)) : c.blue(text);
}

// Claude service status, scoped to the Claude Code component. Answers exactly
// one question: "can I use Claude Code right now?" — so it's driven solely by
// the Claude Code component's own status. It stays silent while that status is
// `operational`, even when an unresolved incident tags Claude Code among its
// affected surfaces: those are usually model-/surface-specific (e.g. one model
// suspended) and don't stop you using Claude Code with another model. A matching
// incident is pulled in only to explain WHY it's down once the component itself
// has flipped. Data comes from a global cache refreshed out-of-band (see
// ./status.ts); the render here never touches the network.
function status({ config, theme }: Ctx): string | null {
  const cfg = config.status;
  const cache = readStatusCache();

  // Missing or past its TTL → trigger a background refresh (debounced). Either
  // way we render from whatever we have right now: nothing, or the last snapshot.
  if (!cache || cache.ageMs > cfg.ttlMs) kickStatusFetch();
  if (!cache) return null;
  // Too old to trust (offline a while) — stay silent rather than show stale state.
  if (cache.ageMs > cfg.staleMaxMs) return null;

  const { summary } = cache;
  const comp = summary.components?.find((s) => s.name === cfg.component);
  if (!comp) return null;

  // The component status IS the answer. Operational → usable → stay silent.
  if (comp.status === "operational") return null;

  // Non-operational: pull a matching unresolved incident purely to caption WHY.
  const incident = summary.incidents?.find(
    (i) => i.status !== "resolved" && i.components?.some((c) => c.id === comp.id),
  );

  const severe =
    comp.status === "major_outage" || comp.status === "partial_outage";
  const color = severe ? theme.crit : theme.warn;
  const head = color(`${theme.glyphs.status} ${cfg.component}: ${prettyStatus(comp.status)}`);
  const detail = incident ? ` ${theme.muted(`— ${truncate(incident.name, 32)}`)}` : "";
  return head + detail;
}

function prettyStatus(s: string): string {
  const map: Record<string, string> = {
    degraded_performance: "degraded",
    partial_outage: "partial outage",
    major_outage: "major outage",
    under_maintenance: "maintenance",
  };
  return map[s] ?? s.replace(/_/g, " ");
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export const SEGMENTS: Record<string, Segment> = {
  project,
  model,
  context,
  cost,
  git,
  rate,
  tools,
  todos,
  agents,
  worktree,
  output_style,
  effort,
  thinking,
  pr,
  status,
};
