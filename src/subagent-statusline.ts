#!/usr/bin/env bun
// Subagent status line — overrides the per-agent rows shown under the main HUD.
// Unlike the main statusLine, a plugin CAN auto-apply this via its bundled
// settings.json ("subagentStatusLine" key). See:
// https://code.claude.com/docs/en/statusline#subagent-status-lines
//
// Input (single JSON object on stdin): base hook fields + `columns` + `tasks[]`,
// each task: { id, name, type, status, description, label, startTime,
//              tokenCount, tokenSamples, cwd }.
// Output: one JSON line per row to override — {"id","content"}. Omit id to keep
// the default row; emit empty content to hide it.

import { c } from "./ansi";

interface Task {
  id: string;
  name?: string;
  type?: string;
  status?: string;
  description?: string;
  label?: string;
  tokenCount?: number;
}

const fmtTokens = (n?: number) =>
  typeof n !== "number" ? "" : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const statusGlyph = (s?: string) =>
  s === "running" || s === "in_progress"
    ? c.brightGreen("●")
    : s === "completed"
      ? c.green("✓")
      : s === "failed" || s === "error"
        ? c.brightRed("✗")
        : c.gray("○");

async function main() {
  const raw = await Bun.stdin.text();
  let tasks: Task[] = [];
  try {
    tasks = JSON.parse(raw)?.tasks ?? [];
  } catch {
    return;
  }

  const out: string[] = [];
  for (const t of tasks) {
    const label = t.label || t.description || t.name || t.type || "agent";
    const toks = fmtTokens(t.tokenCount);
    const content =
      `${statusGlyph(t.status)} ${c.cyan(t.type || "agent")} ` +
      `${label}${toks ? " " + c.gray(toks) : ""}`;
    out.push(JSON.stringify({ id: t.id, content }));
  }
  if (out.length) process.stdout.write(out.join("\n"));
}

main().catch(() => {});
