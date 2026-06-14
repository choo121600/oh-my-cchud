#!/usr/bin/env bun
// Render the HUD against mock input so you can preview themes/segments without
// a live Claude Code session. Pass a transcript path as arg 1 to exercise the
// transcript parser against a real file:
//   bun run scripts/demo.ts ~/.claude/projects/<proj>/<session>.jsonl

import { loadConfig } from "../src/config";
import { resolveTheme, THEME_NAMES } from "../src/theme";
import { parseTranscript } from "../src/transcript";
import { render } from "../src/render";
import type { StatuslineInput, Ctx } from "../src/types";

const mock: StatuslineInput = {
  session_id: "demo-session",
  cwd: process.cwd(),
  model: { id: "claude-opus-4-8", display_name: "Opus" },
  workspace: {
    current_dir: process.cwd(),
    project_dir: process.cwd(),
    repo: { host: "github.com", owner: "choo121600", name: "oh-my-cchud" },
  },
  pr: { number: 1234, url: "https://github.com/choo121600/oh-my-cchud/pull/1234", review_state: "pending" },
  output_style: { name: "explanatory" },
  cost: { total_cost_usd: 0.1234, total_duration_ms: 754000 },
  context_window: { used_percentage: 73, context_window_size: 200000 },
  rate_limits: {
    five_hour: { used_percentage: 41.2 },
    seven_day: { used_percentage: 88 },
  },
  effort: { level: "high" },
  thinking: { enabled: true },
  worktree: { name: "feat-hud", branch: "feature/hud" },
};

const config = loadConfig();
const transcript = await parseTranscript(
  process.argv[2],
  config.transcript.tailBytes,
  config.transcript.recentTools,
);

// Preview every theme side by side.
for (const name of THEME_NAMES) {
  const ctx: Ctx = {
    input: mock,
    transcript,
    cwd: mock.cwd!,
    sessionId: mock.session_id!,
    config: { ...config, theme: name },
    theme: resolveTheme(name),
  };
  console.log(`\n┌─ theme: ${name} ${"─".repeat(Math.max(0, 30 - name.length))}`);
  console.log(
    render(ctx)
      .split("\n")
      .map((l) => "│ " + l)
      .join("\n"),
  );
  console.log("└" + "─".repeat(40));
}

console.log("\ntranscript state:", JSON.stringify(transcript));
