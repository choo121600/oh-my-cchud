#!/usr/bin/env bun
// oh-my-cchud — performance-focused HUD for Claude Code.
// Entry point: read statusLine JSON from stdin, derive live state from the
// transcript JSONL, render segments, print. Two data sources, one fast pass.
//
// Wire it up in ~/.claude/settings.json:
//   "statusLine": {
//     "type": "command",
//     "command": "bun /abs/path/to/oh-my-cchud/src/statusline.ts",
//     "refreshInterval": 2
//   }

import { loadConfig } from "./config";
import { resolveTheme } from "./theme";
import { parseTranscript } from "./transcript";
import { render } from "./render";
import { runStatusFetch } from "./status";
import type { StatuslineInput, Ctx } from "./types";

async function main() {
  // Detached refresh mode: the `status` segment re-spawns us with this flag to
  // refresh the service-status cache off the render path. Do that and exit —
  // don't read stdin or render anything.
  if (process.argv.includes("--fetch-status")) {
    await runStatusFetch();
    return;
  }

  const config = loadConfig();

  const raw = await Bun.stdin.text();
  let input: StatuslineInput = {};
  try {
    input = raw.trim() ? JSON.parse(raw) : {};
  } catch {
    input = {};
  }

  const cwd = input.workspace?.current_dir || input.cwd || process.cwd();
  const sessionId = input.session_id || "default";

  const transcript = await parseTranscript(
    input.transcript_path,
    config.transcript.tailBytes,
    config.transcript.recentTools,
  );

  const theme = resolveTheme(config.theme);
  const ctx: Ctx = { input, transcript, cwd, sessionId, config, theme };
  process.stdout.write(render(ctx));
}

main().catch((err) => {
  // Never crash the status line. Emit a tiny, quiet fallback instead.
  process.stdout.write("[33moh-my-cchud[0m " + String(err?.message ?? err));
});
