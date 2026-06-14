#!/usr/bin/env bun
// Wire the main HUD into ~/.claude/settings.json. A plugin cannot auto-apply the
// main `statusLine` (only `subagentStatusLine`), so run this once after install:
//   bun run scripts/install-statusline.ts [refreshInterval]
// It points statusLine at THIS checkout's src/statusline.ts using an absolute path.

import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";

const settingsPath = join(homedir(), ".claude", "settings.json");
const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const refreshInterval = Number(process.argv[2] ?? 2);

// Prefer the compiled binary (self-contained, no `bun` on PATH needed) when it
// exists; otherwise run the TS entry through bun. (Both have ~the same speed —
// the cold-start floor is Bun runtime init, not TS parsing.)
const binary = join(root, "dist", "cchud");
const command = existsSync(binary) ? binary : `bun ${join(root, "src", "statusline.ts")}`;

let settings: Record<string, any> = {};
if (existsSync(settingsPath)) {
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    copyFileSync(settingsPath, settingsPath + ".bak"); // backup before edit
  } catch {
    console.error(`Could not parse ${settingsPath}; aborting.`);
    process.exit(1);
  }
}

settings.statusLine = {
  type: "command",
  command,
  refreshInterval,
};

writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
console.log(`✓ statusLine wired in ${settingsPath}`);
console.log(`  command: ${command}`);
console.log(`  refreshInterval: ${refreshInterval}s`);
console.log(`  (backup saved to ${settingsPath}.bak)`);
console.log("\nOpen a new Claude Code prompt to see the HUD.");
